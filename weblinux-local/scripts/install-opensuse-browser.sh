#!/usr/bin/env bash
# Install GPG-signed Epiphany (GNOME Web) into the openSUSE Tumbleweed RISC-V KDE image
# and configure the /usr/local/bin/weblinux-browser unprivileged Wayland launcher.
set -euo pipefail

WORKDIR="${OPENSUSE_BUILD_DIR:-/root/opensuse-build}"
MNT="${WORKDIR}/mnt"
IMG="${WORKDIR}/opensuse-tumbleweed-kde.ext4"
CHUNKS="${OPENSUSE_CHUNKS_DIR:-/mnt/d/weblinux-disks/opensuse-tumbleweed-kde}"
PUB="${OPENSUSE_PUBLIC_DIR:-/mnt/e/Web-Linux/weblinux-local/apps/web/public/disk/opensuse-tumbleweed-kde}"

mkdir -p "$MNT"

echo "=== [1/4] Reconstructing opensuse-tumbleweed-kde.ext4 ==="
CHUNKS="$CHUNKS" IMG="$IMG" python3 - <<'PY'
import json
import os

chunks_dir = os.environ["CHUNKS"]
img_path = os.environ["IMG"]
manifest = json.load(open(os.path.join(chunks_dir, "manifest.json"), "r", encoding="utf-8"))
piece = manifest["piece"]
total = manifest["size"] // piece
zero = b"\x00" * piece

with open(img_path, "wb") as out:
    for i in range(total):
        if manifest["hashes"][i]:
            with open(os.path.join(chunks_dir, f"{i:06d}"), "rb") as cf:
                out.write(cf.read())
        else:
            out.write(zero)

print(f"Reconstructed {img_path} ({total} MiB)")
PY

echo "=== [2/4] Mounting and installing signed epiphany ==="
mount -o loop "$IMG" "$MNT"
cp /usr/bin/qemu-riscv64-static "$MNT/usr/bin/qemu-riscv64-static"
mount -t proc none "$MNT/proc"
mount -t sysfs none "$MNT/sys"
mount --bind /dev "$MNT/dev"

cleanup() {
  umount "$MNT/dev" 2>/dev/null || true
  umount "$MNT/sys" 2>/dev/null || true
  umount "$MNT/proc" 2>/dev/null || true
  rm -f "$MNT/usr/bin/qemu-riscv64-static"
  umount "$MNT" 2>/dev/null || true
}
trap cleanup EXIT

rm -f "$MNT/etc/resolv.conf"
printf "nameserver 1.1.1.1\nnameserver 8.8.8.8\n" > "$MNT/etc/resolv.conf"

# Install signed epiphany from openSUSE-Tumbleweed-Oss (never --no-gpg-checks)
chroot "$MNT" /usr/bin/qemu-riscv64-static /bin/bash -c '
  set -euo pipefail
  export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
  if ! id -u browser >/dev/null 2>&1; then
    useradd -m -s /bin/bash browser
  fi
  zypper --non-interactive install --no-recommends epiphany
  rpm -q epiphany
  zypper clean --all
'

mkdir -p "$MNT/usr/local/bin"
cat <<'EOF' > "$MNT/usr/local/bin/weblinux-browser"
#!/bin/sh
set -e
export HOME=/root/browser-home
export XDG_CONFIG_HOME=/root/browser-home/.config
export XDG_DATA_HOME=/root/browser-home/.local/share
export XDG_CACHE_HOME=/root/browser-home/.cache
export XDG_RUNTIME_DIR=/tmp/runtime-browser
unset DBUS_SESSION_BUS_ADDRESS
export WAYLAND_DISPLAY=wayland-0
export GDK_BACKEND=wayland
export GSK_RENDERER=cairo
export LIBGL_ALWAYS_SOFTWARE=1
export NO_AT_BRIDGE=1
export GTK_A11Y=none
export JSC_useJIT=0
export WEBKIT_DISABLE_COMPOSITING_MODE=1
export WEBKIT_DISABLE_DMABUF_RENDERER=1
export WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1

chmod 711 /root 2>/dev/null || true
mkdir -p /root/browser-home/.config /root/browser-home/.local/share /root/browser-home/.cache /root/browser-home/Downloads
chown -R browser:browser /root/browser-home
chmod 755 /tmp/runtime-root 2>/dev/null || true
chmod 777 /tmp/runtime-root/wayland-0* 2>/dev/null || true
mkdir -p /tmp/runtime-browser
chown browser:browser /tmp/runtime-browser
chmod 700 /tmp/runtime-browser
ln -sf /tmp/runtime-root/wayland-0 /tmp/runtime-browser/wayland-0

if [ "$(id -u)" -eq 0 ] && command -v setpriv >/dev/null 2>&1; then
  BUID="$(id -u browser)"
  BGID="$(id -g browser)"
  exec setpriv --reuid="$BUID" --regid="$BGID" --clear-groups /usr/bin/dbus-run-session -- /usr/bin/epiphany "$@"
elif [ "$(id -u)" -eq 0 ]; then
  exec chroot --userspec=browser:browser / /usr/bin/dbus-run-session -- /usr/bin/epiphany "$@"
else
  exec /usr/bin/dbus-run-session -- /usr/bin/epiphany "$@"
fi
EOF
chmod +x "$MNT/usr/local/bin/weblinux-browser"

if [ -f "$MNT/usr/share/applications/weblinux-browser.desktop" ]; then
  sed -i 's/Name=Chromium Web Browser/Name=Epiphany Web Browser/' "$MNT/usr/share/applications/weblinux-browser.desktop"
  sed -i 's/Icon=chromium/Icon=org.gnome.Epiphany/' "$MNT/usr/share/applications/weblinux-browser.desktop"
fi

umount "$MNT/dev" "$MNT/sys" "$MNT/proc"
rm -f "$MNT/usr/bin/qemu-riscv64-static"
umount "$MNT"
trap - EXIT

echo "=== [3/4] Running e2fsck ==="
e2fsck -fy "$IMG"

echo "=== [4/4] Slicing updated chunks ==="
IMG="$IMG" CHUNKS="$CHUNKS" PUB="$PUB" python3 - <<'PY'
import hashlib
import json
import os

img_path = os.environ["IMG"]
chunks_dir = os.environ["CHUNKS"]
pub_dir = os.environ["PUB"]
size = os.path.getsize(img_path)
piece = 1048576
total = size // piece

os.makedirs(chunks_dir, exist_ok=True)
os.makedirs(pub_dir, exist_ok=True)

for fname in os.listdir(chunks_dir):
    if len(fname) == 6 and fname.isdigit():
        os.remove(os.path.join(chunks_dir, fname))

hashes = []
nonzero = 0
zero_chunk = b"\x00" * piece
full_h = hashlib.sha256()

with open(img_path, "rb") as f:
    for i in range(total):
        buf = f.read(piece)
        full_h.update(buf)
        if buf == zero_chunk:
            hashes.append("")
        else:
            ch = hashlib.sha256(buf).hexdigest()
            hashes.append(ch)
            with open(os.path.join(chunks_dir, f"{i:06d}"), "wb") as out:
                out.write(buf)
            nonzero += 1

pieces = len(hashes)
pres = []
for i in range(0, pieces, 4):
    nib = 0
    for j in range(4):
        if i + j < pieces and hashes[i + j]:
            nib |= (1 << (3 - j))
    pres.append(format(nib, "x"))

full_sha = full_h.hexdigest()
manifest_id = full_sha[:32]
boot = list(range(min(64, total)))
manifest = {
    "size": size,
    "piece": piece,
    "id": manifest_id,
    "hashes": hashes,
    "boot": boot,
    "present": "".join(pres),
}
for d in (chunks_dir, pub_dir):
    with open(os.path.join(d, "manifest.json"), "w", encoding="utf-8") as mf:
        json.dump(manifest, mf)

integ = {
    "totalChunks": total,
    "nonZeroChunks": nonzero,
    "bootChunks": len(boot),
    "fullImageSha256": full_sha,
    "imageSizeBytes": size,
    "pieceSizeBytes": piece,
}
for d in (chunks_dir, pub_dir):
    with open(os.path.join(d, "integrity.json"), "w", encoding="utf-8") as f_int:
        json.dump(integ, f_int, indent=2)

print(f"SLICE_DONE id={manifest_id} fullSha256={full_sha} nonzero={nonzero}")
PY

rm -rf "$WORKDIR"
