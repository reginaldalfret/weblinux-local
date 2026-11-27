#!/usr/bin/env bash
# Update Debian 13 (Trixie) riscv64 KDE image:
# - Ensure signed epiphany-browser, dbus (dbus-run-session), and lightweight fallback netsurf-gtk are installed
# - Configure /usr/local/bin/weblinux-browser with chmod 711 /root, browser-owned /tmp/runtime-browser,
#   wayland-0 symlink, dbus-run-session, MALLOC_ARENA_MAX=2, NOMMU cache reclaim, and setpriv
# - Run e2fsck -fy and re-slice with present bitmask + integrity.json
set -euo pipefail

WORKDIR="${DEBIAN_BUILD_DIR:-/root/debian-build}"
MNT="${WORKDIR}/mnt"
IMG="${WORKDIR}/debian-13-firefox.ext4"
CHUNKS="${DEBIAN_CHUNKS_DIR:-/mnt/d/weblinux-disks/debian-13-firefox}"
PUB="${DEBIAN_PUBLIC_DIR:-/mnt/e/Web-Linux/weblinux-local/apps/web/public/disk/debian-13-firefox}"

mkdir -p "$MNT"

echo "=== [1/4] Reconstructing debian-13-firefox.ext4 ==="
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

echo "=== [2/4] Mounting and updating Debian 13 browser + wrapper ==="
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

# Install signed packages from Debian Trixie (never --allow-unauthenticated)
chroot "$MNT" /usr/bin/qemu-riscv64-static /bin/bash -c '
  set -euo pipefail
  export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
  export DEBIAN_FRONTEND=noninteractive
  if ! id -u browser >/dev/null 2>&1; then
    useradd -m -s /bin/bash browser
  fi
  apt-get update
  apt-get install -y --no-install-recommends epiphany-browser dbus netsurf-gtk
  dpkg -l epiphany-browser dbus netsurf-gtk
  apt-get clean
  rm -rf /var/lib/apt/lists/*
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
export MALLOC_ARENA_MAX=2

chmod 711 /root 2>/dev/null || true
mkdir -p /root/browser-home/.config /root/browser-home/.local/share /root/browser-home/.cache /root/browser-home/Downloads
chown -R browser:browser /root/browser-home
chmod 755 /tmp/runtime-root 2>/dev/null || true
chmod 777 /tmp/runtime-root/wayland-0* 2>/dev/null || true
mkdir -p /tmp/runtime-browser
chown browser:browser /tmp/runtime-browser
chmod 700 /tmp/runtime-browser
ln -sf /tmp/runtime-root/wayland-0 /tmp/runtime-browser/wayland-0

# Reclaim page cache on 2048 MiB NOMMU before ld.so maps WebKitGTK shared libraries
if [ "$(id -u)" -eq 0 ]; then
  sync 2>/dev/null || true
  echo 3 > /proc/sys/vm/drop_caches 2>/dev/null || true
fi

run_as_browser() {
  if [ "$(id -u)" -eq 0 ] && command -v setpriv >/dev/null 2>&1; then
    BUID="$(id -u browser)"
    BGID="$(id -g browser)"
    setpriv --reuid="$BUID" --regid="$BGID" --clear-groups /usr/bin/dbus-run-session -- "$@"
  elif [ "$(id -u)" -eq 0 ]; then
    chroot --userspec=browser:browser / /usr/bin/dbus-run-session -- "$@"
  else
    /usr/bin/dbus-run-session -- "$@"
  fi
}

set +e
run_as_browser /usr/bin/epiphany "$@"
RC=$?
set -e

if [ "$RC" -eq 127 ] && [ -x /usr/bin/netsurf-gtk ]; then
  echo "weblinux-browser: epiphany failed (rc=$RC), falling back to netsurf-gtk" >&2
  exec sh -c '
    if [ "$(id -u)" -eq 0 ] && command -v setpriv >/dev/null 2>&1; then
      BUID="$(id -u browser)"
      BGID="$(id -g browser)"
      exec setpriv --reuid="$BUID" --regid="$BGID" --clear-groups /usr/bin/dbus-run-session -- /usr/bin/netsurf-gtk "$@"
    elif [ "$(id -u)" -eq 0 ]; then
      exec chroot --userspec=browser:browser / /usr/bin/dbus-run-session -- /usr/bin/netsurf-gtk "$@"
    else
      exec /usr/bin/dbus-run-session -- /usr/bin/netsurf-gtk "$@"
    fi
  ' sh "$@"
fi

exit "$RC"
EOF
chmod +x "$MNT/usr/local/bin/weblinux-browser"

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
        assert len(buf) == piece
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

# Verify round-trip reconstruction SHA-256
recon_h = hashlib.sha256()
for i in range(total):
    if hashes[i]:
        with open(os.path.join(chunks_dir, f"{i:06d}"), "rb") as cf:
            recon_h.update(cf.read())
    else:
        recon_h.update(zero_chunk)
assert recon_h.hexdigest() == full_sha, "Reconstruction SHA-256 mismatch!"

print(f"SLICE_DONE id={manifest_id} fullSha256={full_sha} nonzero={nonzero} RECONSTRUCT_OK=True")
PY

rm -rf "$WORKDIR"
