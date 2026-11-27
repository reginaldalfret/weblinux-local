#!/bin/bash
set -euo pipefail
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

# Phase 14.2 — Arch Linux RISC-V Browser Replacement (Chromium 157 -> Signed Epiphany 51.2)
# Replaces chromium-157.0.8103.78-1 (blocked on libsimdutf.so.36 vs extra's simdutf 9.3.3-1 libsimdutf.so.37)
# with signed epiphany from Arch RISC-V extra, preserving full Pacman signature verification.

ROOTFS="/root/arch-test/rootfs"
SRC_CHUNKS="/mnt/d/weblinux-disks/arch-kde"
PKG_ARCHIVE="/mnt/d/weblinux-build/arch-pkg-cache"
IMG="/root/arch-test/arch-kde.ext4"
CHUNKS="/mnt/d/weblinux-disks/arch-kde"
PUB="/mnt/e/Web-Linux/weblinux-local/apps/web/public/disk/arch-kde"
SIZE=5368709120
PIECE=1048576

MNT="/root/arch-test/mnt-src"

cleanup() {
  umount -lf "$ROOTFS/dev/pts" 2>/dev/null || true
  umount -lf "$ROOTFS/dev" 2>/dev/null || true
  umount -lf "$ROOTFS/sys" 2>/dev/null || true
  umount -lf "$ROOTFS/proc" 2>/dev/null || true
  umount -lf "$MNT" 2>/dev/null || true
  rm -f "$ROOTFS/usr/bin/qemu-riscv64-static"
}
trap cleanup EXIT

mkdir -p /root/arch-test "$PKG_ARCHIVE" "$CHUNKS" "$PUB"

echo "=== [1/6] Preparing Arch Linux RISC-V rootfs ==="
if [ ! -x "$ROOTFS/usr/bin/pacman" ]; then
  echo "Reconstructing source ext4 image from $SRC_CHUNKS..."
  python3 - <<'PY'
import os, json
CHUNKS = "/mnt/d/weblinux-disks/arch-kde"
IMG = "/root/arch-test/arch-kde.ext4"
with open(os.path.join(CHUNKS, "manifest.json"), "r") as f:
    m = json.load(f)
total = m["size"] // m["piece"]
with open(IMG, "wb") as out:
    for i in range(total):
        p = os.path.join(CHUNKS, f"{i:06d}")
        with open(p, "rb") as cf:
            out.write(cf.read())
print(f"Reconstructed {IMG} ({m['size']} bytes)")
PY
  rm -rf "$ROOTFS"
  mkdir -p "$ROOTFS" "$MNT"
  mount -o loop,ro "$IMG" "$MNT"
  tar -C "$MNT" -cpf - . | tar -C "$ROOTFS" -xpf -
  umount "$MNT"
  rm -f "$IMG"
fi

cp /usr/bin/qemu-riscv64-static "$ROOTFS/usr/bin/qemu-riscv64-static"
cp /etc/resolv.conf "$ROOTFS/etc/resolv.conf"
mount -t proc proc "$ROOTFS/proc"
mount -t sysfs sysfs "$ROOTFS/sys"
mount --bind /dev "$ROOTFS/dev"
mount -t devpts devpts "$ROOTFS/dev/pts"

echo "=== [2/6] Removing broken Chromium & installing signed Epiphany via pacman ==="
chroot "$ROOTFS" /usr/bin/qemu-riscv64-static /usr/bin/bash -c '
set -euo pipefail
# Remove chromium-157.0.8103.78-1 (linked against missing libsimdutf.so.36) to reclaim ~427 MiB
if pacman -Q chromium >/dev/null 2>&1; then
  pacman -R --noconfirm chromium
fi

# Preserve full Pacman GPG signature verification (SigLevel unchanged)
pacman -Syu --noconfirm epiphany

# Ensure unprivileged browser user (uid=1000) and persistent home exist
if ! getent group browser >/dev/null 2>&1; then
  groupadd -g 1000 browser
fi
if ! id -u browser >/dev/null 2>&1; then
  useradd -m -u 1000 -g 1000 -d /root/browser-home -s /bin/bash browser
fi
mkdir -p /root/browser-home
chown 1000:1000 /root/browser-home
chmod 711 /root

echo "--- Installed browser packages ---"
pacman -Q epiphany webkitgtk-6.0
'

# Archive cached packages out of rootfs before ext4 packaging
mkdir -p "$PKG_ARCHIVE"
if [ -d "$ROOTFS/var/cache/pacman/pkg" ]; then
  mv "$ROOTFS/var/cache/pacman/pkg/"* "$PKG_ARCHIVE/" 2>/dev/null || true
fi

echo "=== [3/6] Configuring /usr/local/bin/weblinux-browser & desktop entry ==="
mkdir -p "$ROOTFS/usr/local/bin" "$ROOTFS/usr/share/applications"

cat <<'EOF' > "$ROOTFS/usr/local/bin/weblinux-browser"
#!/bin/sh
set -eu

BUID=$(id -u browser 2>/dev/null || echo 1000)
BGID=$(id -g browser 2>/dev/null || echo 1000)

chmod 711 /root 2>/dev/null || true
[ -d /tmp/runtime-root ] && chmod 711 /tmp/runtime-root 2>/dev/null || true
[ -S /tmp/runtime-root/wayland-0 ] && chmod 666 /tmp/runtime-root/wayland-0 2>/dev/null || true

mkdir -p /root/browser-home /tmp/runtime-browser
chown "$BUID:$BGID" /root/browser-home /tmp/runtime-browser
chmod 700 /tmp/runtime-browser
ln -sf /tmp/runtime-root/wayland-0 /tmp/runtime-browser/wayland-0

export HOME=/root/browser-home
export USER=browser
export LOGNAME=browser
export XDG_RUNTIME_DIR=/tmp/runtime-browser
export WAYLAND_DISPLAY=wayland-0
export GDK_BACKEND=wayland
export GSK_RENDERER=cairo
export LIBGL_ALWAYS_SOFTWARE=1
export NO_AT_BRIDGE=1
export GTK_A11Y=none
export JSC_useJIT=0
export WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1

exec setpriv --reuid="$BUID" --regid="$BGID" --clear-groups \
  /usr/bin/dbus-run-session -- /usr/bin/epiphany "$@"
EOF
chmod 755 "$ROOTFS/usr/local/bin/weblinux-browser"

cat <<'EOF' > "$ROOTFS/usr/share/applications/weblinux-browser.desktop"
[Desktop Entry]
Version=1.0
Type=Application
Name=Epiphany Web Browser
GenericName=Web Browser
Comment=Browse the web with GNOME Web (Epiphany)
Exec=/usr/local/bin/weblinux-browser %U
Icon=org.gnome.Epiphany
Terminal=false
Categories=Network;WebBrowser;
MimeType=text/html;text/xml;application/xhtml+xml;x-scheme-handler/http;x-scheme-handler/https;
StartupNotify=true
EOF

# Unmount chroot virtual filesystems before imaging
cleanup
trap - EXIT

echo "=== [4/6] Building 5.0 GiB ext4 image ==="
du -sh "$ROOTFS"
rm -f "$IMG"
truncate -s "$SIZE" "$IMG"
mke2fs -t ext4 -d "$ROOTFS" -L arch-kde -m 1 -O ^metadata_csum_seed "$IMG"

echo "=== [5/6] Running e2fsck -fy ==="
e2fsck -fy "$IMG"

echo "=== [6/6] Slicing 5120 x 1 MiB chunks & writing manifest.json + integrity.json ==="
python3 - <<'PY'
import os, json, hashlib

IMG = "/root/arch-test/arch-kde.ext4"
CHUNKS = "/mnt/d/weblinux-disks/arch-kde"
PUB = "/mnt/e/Web-Linux/weblinux-local/apps/web/public/disk/arch-kde"
SIZE = 5368709120
PIECE = 1048576
TOTAL = SIZE // PIECE

full_h = hashlib.sha256()
hashes = []
nz = set()

with open(IMG, "rb") as f:
    for i in range(TOTAL):
        buf = f.read(PIECE)
        full_h.update(buf)
        hashes.append(hashlib.sha256(buf).hexdigest())
        if any(buf):
            nz.add(i)
        with open(os.path.join(CHUNKS, f"{i:06d}"), "wb") as cf:
            cf.write(buf)

full_sha = full_h.hexdigest()
words = (TOTAL + 31) // 32
present = ""
for w in range(words):
    val = 0
    for b in range(32):
        if (w * 32 + b) in nz:
            val |= (1 << (31 - b))
    present += f"{val:08x}"

boot = [i for i in sorted(nz) if i < 64]
manifest = {
    "size": SIZE,
    "piece": PIECE,
    "id": full_sha[:32],
    "hashes": hashes,
    "boot": boot,
    "present": present,
}
integrity = {
    "totalChunks": TOTAL,
    "nonZeroChunks": len(nz),
    "bootChunks": len(boot),
    "fullImageSha256": full_sha,
    "imageSizeBytes": SIZE,
    "pieceSizeBytes": PIECE,
}

for d in (CHUNKS, PUB):
    with open(os.path.join(d, "manifest.json"), "w") as mf:
        json.dump(manifest, mf)
    with open(os.path.join(d, "integrity.json"), "w") as inf:
        json.dump(integrity, inf, indent=2)

print(f"DONE: total={TOTAL} nonzero={len(nz)} boot={len(boot)} id={full_sha[:32]} sha256={full_sha}")
PY

rm -f "$IMG"
