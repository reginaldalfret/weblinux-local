#!/usr/bin/env bash
# Package Alpine Linux 3.24.4 KDE Plasma 6.6.6 branding into alpine-kde.ext4:
# - Uses /root/alpine-cleanup/alpine-kde.ext4 (or reconstructs from D:\weblinux-disks\alpine-kde)
# - Installs verified Alpine logo & wallpaper from apps/web/public/branding/alpine/
# - Installs AlpineBlue color scheme, Konsole Alpine-WebLinux profile, shell prompt,
#   and /usr/local/bin/weblinux-apply-alpine-branding + autostart desktop entry
# - Runs idempotent migration inside chroot (HOME=/root), e2fsck -fy, and re-slices 1 MiB chunks
set -euo pipefail

WORKDIR="${ALPINE_BRANDING_DIR:-/root/branding-alpine}"
MNT="${WORKDIR}/mnt"
IMG="${WORKDIR}/alpine-kde.ext4"
SRC_IMG="/root/alpine-cleanup/alpine-kde.ext4"
CHUNKS="${ALPINE_CHUNKS_DIR:-/mnt/d/weblinux-disks/alpine-kde}"
PUB="${ALPINE_PUBLIC_DIR:-/mnt/e/Web-Linux/weblinux-local/apps/web/public/disk/alpine-kde}"
ASSET_DIR="/mnt/e/Web-Linux/weblinux-local/apps/web/public/branding/alpine"
APPLY_SCRIPT="/mnt/e/Web-Linux/weblinux-local/scripts/branding/apply-alpine-branding.sh"

mkdir -p "$WORKDIR" "$MNT"

if [ -f "$SRC_IMG" ]; then
  echo "=== [1/5] Copying clean Phase 15 alpine-kde.ext4 ==="
  cp -f "$SRC_IMG" "$IMG"
elif [ ! -f "$IMG" ]; then
  echo "=== [1/5] Reconstructing alpine-kde.ext4 from chunks ==="
  CHUNKS="$CHUNKS" IMG="$IMG" python3 - <<'PY'
import json, os
chunks_dir = os.environ["CHUNKS"]
img_path = os.environ["IMG"]
with open(os.path.join(chunks_dir, "manifest.json"), "r", encoding="utf-8") as mf:
    manifest = json.load(mf)
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
PY
else
  echo "=== [1/5] Using existing $IMG ==="
fi

echo "=== [2/5] Mounting alpine-kde.ext4 with qemu-riscv64-static ==="
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

echo "=== [3/5] Installing Alpine wallpaper, logos, Konsole profile, prompt & migration script ==="
mkdir -p \
  "$MNT/usr/share/wallpapers/WebLinux-Alpine/contents/images" \
  "$MNT/usr/share/backgrounds/weblinux" \
  "$MNT/usr/share/icons/hicolor/scalable/places" \
  "$MNT/usr/share/icons/hicolor/256x256/places" \
  "$MNT/usr/share/pixmaps" \
  "$MNT/usr/share/konsole" \
  "$MNT/etc/profile.d" \
  "$MNT/etc/xdg/autostart" \
  "$MNT/usr/local/bin"

cp -f "$ASSET_DIR/wallpaper-1920x1080.png" "$MNT/usr/share/wallpapers/WebLinux-Alpine/contents/images/1920x1080.png"
cp -f "$ASSET_DIR/wallpaper-1920x1080.png" "$MNT/usr/share/backgrounds/weblinux/alpine-1920x1080.png"
cp -f "$ASSET_DIR/alpine-icon.svg" "$MNT/usr/share/icons/hicolor/scalable/places/distributor-logo-alpine.svg"
cp -f "$ASSET_DIR/distributor-logo-alpine-256.png" "$MNT/usr/share/icons/hicolor/256x256/places/distributor-logo-alpine.png"
cp -f "$ASSET_DIR/distributor-logo-alpine-256.png" "$MNT/usr/share/pixmaps/distributor-logo-alpine.png"
cp -f "$ASSET_DIR/alpinelinux-logo.svg" "$MNT/usr/share/pixmaps/alpinelinux-logo.svg"

cat > "$MNT/usr/share/wallpapers/WebLinux-Alpine/metadata.json" <<'EOF'
{
  "KPlugin": {
    "Id": "WebLinux-Alpine",
    "Name": "Alpine Linux 3.24",
    "License": "MIT / CC-BY-SA-4.0"
  }
}
EOF

cat > "$MNT/usr/share/konsole/Alpine-WebLinux.colorscheme" <<'EOF'
[Background]
Color=13,25,38

[BackgroundIntense]
Color=18,35,52

[Color0]
Color=13,25,38

[Color0Intense]
Color=79,107,130

[Color1]
Color=214,73,55

[Color1Intense]
Color=240,104,88

[Color2]
Color=46,160,115

[Color2Intense]
Color=82,204,153

[Color3]
Color=217,164,65

[Color3Intense]
Color=242,194,97

[Color4]
Color=13,89,127

[Color4Intense]
Color=59,153,204

[Color5]
Color=122,104,184

[Color5Intense]
Color=158,142,219

[Color6]
Color=45,156,184

[Color6Intense]
Color=91,196,222

[Color7]
Color=216,228,238

[Color7Intense]
Color=255,255,255

[Foreground]
Color=230,239,246

[ForegroundIntense]
Color=255,255,255

[General]
Description=Alpine WebLinux
Opacity=1
EOF

cat > "$MNT/usr/share/konsole/Alpine-WebLinux.profile" <<'EOF'
[Appearance]
ColorScheme=Alpine-WebLinux
Font=DejaVu Sans Mono,10,-1,5,400,0,0,0,0,0

[General]
Name=Alpine-WebLinux
Parent=FALLBACK/

[Interaction Options]
BidiRenderingEnabled=false
EOF

cat > "$MNT/etc/profile.d/weblinux-alpine-prompt.sh" <<'EOF'
# WebLinux Alpine Linux interactive shell prompt (POSIX sh / ash / bash compatible)
case "$-" in
  *i*)
    if [ -n "${PS1:-}" ]; then
      PS1='[\u@alpine \W]\$ '
    fi
    ;;
esac
EOF
chmod 0644 "$MNT/etc/profile.d/weblinux-alpine-prompt.sh"

cp -f "$APPLY_SCRIPT" "$MNT/usr/local/bin/weblinux-apply-alpine-branding"
chmod 0755 "$MNT/usr/local/bin/weblinux-apply-alpine-branding"

cat > "$MNT/etc/xdg/autostart/weblinux-branding.desktop" <<'EOF'
[Desktop Entry]
Type=Application
Name=WebLinux Alpine Branding Migration
Exec=/usr/local/bin/weblinux-apply-alpine-branding
OnlyShowIn=KDE;
X-KDE-autostart-phase=1
NoDisplay=true
EOF

echo "=== [4/5] Writing /etc/xdg defaults & verifying inside chroot ==="
cat > "$MNT/etc/xdg/kdeglobals" <<'EOF'
[General]
AccentColor=13,89,127
ColorScheme=BreezeDark
fixed=DejaVu Sans Mono,10,-1,5,400,0,0,0,0,0
font=DejaVu Sans,10,-1,5,400,0,0,0,0,0

[Icons]
Theme=breeze-dark

[KDE]
LookAndFeelPackage=org.kde.breezedark.desktop
widgetStyle=Breeze
EOF

cat > "$MNT/etc/xdg/konsolerc" <<'EOF'
[Desktop Entry]
DefaultProfile=Alpine-WebLinux.profile
EOF

chroot "$MNT" /bin/sh -lc '
  set -e
  export HOME=/root
  /usr/local/bin/weblinux-apply-alpine-branding --dry-run
  cat /etc/os-release | grep -E "^(NAME|VERSION_ID|ID)="
  apk info -e epiphany chromium firefox badwolf netsurf falkon 2>/dev/null || echo "NO_BROWSERS_OK"
'

cleanup
trap - EXIT

echo "=== [5/5] Running e2fsck -fy & slicing 1 MiB chunks ==="
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

for d in (chunks_dir, pub_dir):
    os.makedirs(d, exist_ok=True)
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
    "bootChunks": 64,
    "fullImageSha256": full_sha,
    "imageSizeBytes": size,
    "pieceSizeBytes": piece,
}

for d in (chunks_dir, pub_dir):
    with open(os.path.join(d, "manifest.json"), "w", encoding="utf-8") as mf:
        json.dump(manifest, mf)
    with open(os.path.join(d, "integrity.json"), "w", encoding="utf-8") as inf:
        json.dump(integrity, inf, indent=2)

print(f"DONE: total={total} nonzero={nonzero} boot=64 sha256={full_sha}")
PY
