#!/usr/bin/env bash
# Deploy Phase 16.1 distribution-logo wallpapers, shared apply-kde-branding.sh (v2 migration),
# and verify-compositor-readiness.sh into a staging ext4 rootfs, run e2fsck -fy, and slice 1 MiB chunks.
# Usage: deploy-v2-wallpapers-to-rootfs.sh <debian|ubuntu|arch|opensuse|fedora|alpine>
set -euo pipefail

DISTRO="${1:-}"
if [ -z "$DISTRO" ]; then
  echo "Usage: $0 <debian|ubuntu|arch|opensuse|fedora|alpine>" >&2
  exit 1
fi

REPO="/mnt/e/Web-Linux/weblinux-local"
WALL_SRC="${REPO}/runtime/branding/wallpapers"
APPLY_SRC="${REPO}/runtime/branding/apply-kde-branding.sh"
PROBE_SRC="${REPO}/scripts/branding/verify-compositor-readiness.sh"

case "$DISTRO" in
  debian)
    WORKDIR="/root/branding-debian"
    IMG="${WORKDIR}/debian-13-firefox.ext4"
    DISK_DIR="debian-13-firefox"
    PROFILE_ID="debian-kde"
    PLASMA_MAJOR="6"
    WALL_ID="WebLinux-Debian"
    SVG_FILE="debian-trixie-logo-wallpaper.svg"
    PNG_FILE="debian-trixie-logo-wallpaper.png"
    ;;
  ubuntu)
    WORKDIR="/root/branding-ubuntu"
    IMG="${WORKDIR}/ubuntu-24.04-kde-epiphany.ext4"
    DISK_DIR="ubuntu-24.04-kde-epiphany"
    PROFILE_ID="ubuntu-kde"
    PLASMA_MAJOR="5"
    WALL_ID="WebLinux-Ubuntu"
    SVG_FILE="ubuntu-2404-logo-wallpaper.svg"
    PNG_FILE="ubuntu-2404-logo-wallpaper.png"
    ;;
  arch)
    WORKDIR="/root/branding-arch"
    IMG="${WORKDIR}/arch-kde.ext4"
    DISK_DIR="arch-kde"
    PROFILE_ID="arch-kde"
    PLASMA_MAJOR="6"
    WALL_ID="WebLinux-Arch"
    SVG_FILE="arch-linux-logo-wallpaper.svg"
    PNG_FILE="arch-linux-logo-wallpaper.png"
    ;;
  opensuse)
    WORKDIR="/root/branding-opensuse"
    IMG="${WORKDIR}/opensuse-tumbleweed-kde.ext4"
    DISK_DIR="opensuse-tumbleweed-kde"
    PROFILE_ID="opensuse-tumbleweed-kde"
    PLASMA_MAJOR="6"
    WALL_ID="WebLinux-openSUSE"
    SVG_FILE="opensuse-tumbleweed-logo-wallpaper.svg"
    PNG_FILE="opensuse-tumbleweed-logo-wallpaper.png"
    ;;
  fedora)
    WORKDIR="/root/branding-fedora"
    IMG="${WORKDIR}/fedora-kde.ext4"
    DISK_DIR="fedora-kde"
    PROFILE_ID="fedora-kde"
    PLASMA_MAJOR="6"
    WALL_ID="WebLinux-Fedora"
    SVG_FILE="fedora-45-logo-wallpaper.svg"
    PNG_FILE="fedora-45-logo-wallpaper.png"
    ;;
  alpine)
    WORKDIR="/root/branding-alpine"
    IMG="${WORKDIR}/alpine-kde.ext4"
    DISK_DIR="alpine-kde"
    PROFILE_ID="alpine-kde"
    PLASMA_MAJOR="6"
    WALL_ID="WebLinux-Alpine"
    SVG_FILE="alpine-324-logo-wallpaper.svg"
    PNG_FILE="alpine-324-logo-wallpaper.png"
    ;;
  *)
    echo "Unknown distro: $DISTRO" >&2
    exit 1
    ;;
esac

MNT="${WORKDIR}/mnt"
CHUNKS="/mnt/d/weblinux-disks/${DISK_DIR}"
PUB="${REPO}/apps/web/public/disk/${DISK_DIR}"

mkdir -p "$WORKDIR" "$MNT" "$CHUNKS" "$PUB"

if [ ! -f "$IMG" ]; then
  echo "=== [$DISTRO] Reconstructing $IMG from $CHUNKS ==="
  CHUNKS="$CHUNKS" IMG="$IMG" python3 - <<'PY'
import json, os
chunks_dir = os.environ["CHUNKS"]
img_path = os.environ["IMG"]
with open(os.path.join(chunks_dir, "manifest.json"), "r", encoding="utf-8") as mf:
    manifest = json.load(mf)
piece = int(manifest["piece"])
total = int(manifest["size"]) // piece
zero = b"\x00" * piece
with open(img_path, "wb") as out:
    for i in range(total):
        if manifest["hashes"][i]:
            with open(os.path.join(chunks_dir, f"{i:06d}"), "rb") as cf:
                out.write(cf.read())
        else:
            out.write(zero)
PY
fi

echo "=== [$DISTRO] Mounting $IMG ==="
mountpoint -q "$MNT" || mount -o loop "$IMG" "$MNT"
cp -f /usr/bin/qemu-riscv64-static "$MNT/usr/bin/qemu-riscv64-static"
mountpoint -q "$MNT/proc" || mount -t proc none "$MNT/proc"
mountpoint -q "$MNT/sys" || mount -t sysfs none "$MNT/sys"
mountpoint -q "$MNT/dev" || mount --bind /dev "$MNT/dev"

cleanup() {
  umount "$MNT/dev" 2>/dev/null || true
  umount "$MNT/sys" 2>/dev/null || true
  umount "$MNT/proc" 2>/dev/null || true
  rm -f "$MNT/usr/bin/qemu-riscv64-static"
  umount "$MNT" 2>/dev/null || true
}
trap cleanup EXIT

echo "=== [$DISTRO] Deploying $PNG_FILE + apply-kde-branding.sh (v2) ==="
WALL_DEST="${MNT}/usr/share/wallpapers/${WALL_ID}/contents/images"
mkdir -p "$WALL_DEST" "$MNT/usr/local/bin" "$MNT/etc/xdg/autostart"
cp -f "${WALL_SRC}/${SVG_FILE}" "${WALL_DEST}/${SVG_FILE}"
cp -f "${WALL_SRC}/${PNG_FILE}" "${WALL_DEST}/${PNG_FILE}"
# Also provide standard 1920x1080.png symlink/copy for Plasma image plugin discovery
cp -f "${WALL_SRC}/${PNG_FILE}" "${WALL_DEST}/1920x1080.png"

cat > "${MNT}/usr/share/wallpapers/${WALL_ID}/metadata.json" <<EOF
{
  "KPlugin": {
    "Id": "${WALL_ID}",
    "Name": "${WALL_ID}",
    "License": "Upstream Distro Logo / CC-BY-SA-4.0"
  }
}
EOF

cp -f "$APPLY_SRC" "${MNT}/usr/local/bin/weblinux-apply-kde-branding"
chmod 0755 "${MNT}/usr/local/bin/weblinux-apply-kde-branding"
cp -f "$PROBE_SRC" "${MNT}/usr/local/bin/weblinux-verify-compositor-readiness"
chmod 0755 "${MNT}/usr/local/bin/weblinux-verify-compositor-readiness"

cat > "${MNT}/etc/xdg/autostart/weblinux-branding-v2.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=WebLinux Branding v2 Logo Wallpaper Migration
Exec=/usr/local/bin/weblinux-apply-kde-branding --profile ${PROFILE_ID} --plasma-major ${PLASMA_MAJOR}
OnlyShowIn=KDE;
X-KDE-autostart-phase=1
NoDisplay=true
EOF

echo "=== [$DISTRO] Running v2 wallpaper migration in chroot ==="
if [ "$DISTRO" = "alpine" ]; then
  # Preserve Alpine clean /root/.config if absent; run --dry-run to validate, autostart handles first Plasma boot,
  # and set fallback wallpaper symlink if Next exists
  chroot "$MNT" /bin/sh -lc "HOME=/root /usr/local/bin/weblinux-apply-kde-branding --profile ${PROFILE_ID} --plasma-major ${PLASMA_MAJOR} --dry-run"
else
  rm -f "${MNT}/root/.local/state/weblinux/branding-v2-logo-wallpaper-applied"
  chroot "$MNT" /bin/sh -lc "HOME=/root /usr/local/bin/weblinux-apply-kde-branding --profile ${PROFILE_ID} --plasma-major ${PLASMA_MAJOR}"
  chroot "$MNT" /bin/sh -lc "HOME=/root /usr/local/bin/weblinux-apply-kde-branding --profile ${PROFILE_ID} --status"
fi

cleanup
trap - EXIT

echo "=== [$DISTRO] Running e2fsck -fy & slicing 1 MiB chunks ==="
e2fsck -fy "$IMG"

IMG="$IMG" CHUNKS="$CHUNKS" PUB="$PUB" python3 - <<'PY'
import hashlib, json, os

img_path = os.environ["IMG"]
chunks_dir = os.environ["CHUNKS"]
pub_dir = os.environ["PUB"]
piece = 1048576
size = os.path.getsize(img_path)
total = size // piece
assert size == total * piece

os.makedirs(chunks_dir, exist_ok=True)
os.makedirs(pub_dir, exist_ok=True)

for d in (chunks_dir, pub_dir):
    for fn in os.listdir(d):
        if len(fn) == 6 and fn.isdigit():
            os.remove(os.path.join(d, fn))

hashes = []
present_bits = [0] * total
nonzero = 0
full_hash = hashlib.sha256()

with open(img_path, "rb") as fp:
    for i in range(total):
        buf = fp.read(piece)
        full_hash.update(buf)
        if any(buf):
            h = hashlib.sha256(buf).hexdigest()
            hashes.append(h)
            present_bits[i] = 1
            nonzero += 1
            with open(os.path.join(chunks_dir, f"{i:06d}"), "wb") as cf:
                cf.write(buf)
        else:
            hashes.append("")

while len(present_bits) % 4 != 0:
    present_bits.append(0)

present_hex = "".join(
    f"{(present_bits[i]<<3)|(present_bits[i+1]<<2)|(present_bits[i+2]<<1)|present_bits[i+3]:x}"
    for i in range(0, len(present_bits), 4)
)
full_sha = full_hash.hexdigest()
boot = list(range(min(64, total)))

manifest = {
    "size": size,
    "piece": piece,
    "id": full_sha[:32],
    "hashes": hashes,
    "boot": boot,
    "present": present_hex,
}
integrity = {
    "totalChunks": total,
    "nonZeroChunks": nonzero,
    "bootChunks": len(boot),
    "fullImageSha256": full_sha,
    "imageSizeBytes": size,
    "pieceSizeBytes": piece,
}

for d in (chunks_dir, pub_dir):
    with open(os.path.join(d, "manifest.json"), "w", encoding="utf-8") as mf:
        json.dump(manifest, mf)
    with open(os.path.join(d, "integrity.json"), "w", encoding="utf-8") as inf:
        json.dump(integrity, inf, indent=2)

print(f"DEPLOY_V2_DONE: total={total} nonzero={nonzero} boot={len(boot)} sha256={full_sha}")
PY
