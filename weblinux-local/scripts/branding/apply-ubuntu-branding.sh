#!/usr/bin/env bash
# Phase 16 — Agent 2: Ubuntu 24.04.5 LTS KDE Plasma 5.27.12 Branding
# - Reconstructs /root/branding-ubuntu/ubuntu-24.04-kde-epiphany.ext4 from 1 MiB chunks
# - Mounts with qemu-riscv64-static, proc, sys, dev
# - Preserves KDE Plasma 5.27.12 (NEVER upgrades to Plasma 6), /etc/os-release,
#   package signature verification, and user data
# - Installs authentic Ubuntu 24.04 Noble Numbat wallpaper, Ubuntu logo,
#   UbuntuNoble Breeze-based color scheme (#77216F / #2C001E / #E95420),
#   Konsole profile & colors, Kickoff launcher identity, Dolphin styling,
#   idempotent Plasma 5.27 migration (~/.local/state/weblinux/branding-v1-applied),
#   and interactive-safe shell prompt
# - Verifies inside chroot, unmounts, runs e2fsck -fy, and re-slices 1 MiB chunks
#   with manifest.json and integrity.json to both disk and public directories.
set -euo pipefail

WORKDIR="${UBUNTU_BRANDING_DIR:-/root/branding-ubuntu}"
MNT="${WORKDIR}/mnt"
IMG="${WORKDIR}/ubuntu-24.04-kde-epiphany.ext4"
CHUNKS="${UBUNTU_CHUNKS_DIR:-/mnt/d/weblinux-disks/ubuntu-24.04-kde-epiphany}"
PUB="${UBUNTU_PUBLIC_DIR:-/mnt/e/Web-Linux/weblinux-local/apps/web/public/disk/ubuntu-24.04-kde-epiphany}"
ASSETS_DIR="${UBUNTU_ASSETS_DIR:-/mnt/e/Web-Linux/weblinux-local/apps/web/public/branding/ubuntu}"
SKIP_RECONSTRUCT="${SKIP_RECONSTRUCT:-0}"

mkdir -p "$MNT"

if [ "$SKIP_RECONSTRUCT" != "1" ] && [ ! -f "$IMG" ]; then
  echo "=== [1/5] Reconstructing ubuntu-24.04-kde-epiphany.ext4 ==="
  CHUNKS="$CHUNKS" IMG="$IMG" python3 - <<'PY'
import json
import os

chunks_dir = os.environ["CHUNKS"]
img_path = os.environ["IMG"]
with open(os.path.join(chunks_dir, "manifest.json"), "r", encoding="utf-8") as mf:
    manifest = json.load(mf)

piece = int(manifest["piece"])
size = int(manifest["size"])
total = size // piece
zero = b"\x00" * piece

with open(img_path, "wb") as out:
    for i in range(total):
        chunk_file = os.path.join(chunks_dir, f"{i:06d}")
        if manifest["hashes"][i] and os.path.exists(chunk_file):
            with open(chunk_file, "rb") as cf:
                buf = cf.read()
                if len(buf) != piece:
                    raise RuntimeError(f"Chunk {i:06d} size mismatch: {len(buf)} != {piece}")
                out.write(buf)
        else:
            out.write(zero)

actual_size = os.path.getsize(img_path)
assert actual_size == size, f"Reconstructed size mismatch: {actual_size} != {size}"
print(f"Reconstructed {img_path} ({total} MiB, {actual_size} bytes)")
PY
else
  echo "=== [1/5] Using existing $IMG ==="
fi

echo "=== [2/5] Mounting rootfs with qemu-riscv64-static ==="
if [ ! -x /usr/bin/qemu-riscv64-static ]; then
  echo "ERROR: /usr/bin/qemu-riscv64-static not found or not executable" >&2
  exit 1
fi

mountpoint -q "$MNT" || mount -o loop "$IMG" "$MNT"
cp /usr/bin/qemu-riscv64-static "$MNT/usr/bin/qemu-riscv64-static"
mountpoint -q "$MNT/proc" || mount -t proc none "$MNT/proc"
mountpoint -q "$MNT/sys" || mount -t sysfs none "$MNT/sys"
mountpoint -q "$MNT/dev" || mount --bind /dev "$MNT/dev"

cleanup() {
  umount "$MNT/dev" 2>/dev/null || true
  umount "$MNT/sys" 2>/dev/null || true
  umount "$MNT/proc" 2>/dev/null || true
  rm -f "$MNT/usr/bin/qemu-riscv64-static"
  while mountpoint -q "$MNT"; do
    umount -R "$MNT" 2>/dev/null || umount "$MNT" 2>/dev/null || break
  done
}
trap cleanup EXIT

echo "=== [3/5] Installing Ubuntu 24.04.5 Noble Numbat KDE Plasma 5.27 branding ==="
for req_asset in warty-final-ubuntu.png ubuntu-wallpaper-d.png ubuntu-logo.svg; do
  if [ ! -f "$ASSETS_DIR/$req_asset" ]; then
    echo "ERROR: Missing staged asset: $ASSETS_DIR/$req_asset" >&2
    exit 1
  fi
done

# 3a. Wallpapers & Ubuntu Logo
mkdir -p "$MNT/usr/share/backgrounds"
cp "$ASSETS_DIR/warty-final-ubuntu.png" "$MNT/usr/share/backgrounds/warty-final-ubuntu.png"
cp "$ASSETS_DIR/ubuntu-wallpaper-d.png" "$MNT/usr/share/backgrounds/ubuntu-wallpaper-d.png"
chmod 0644 "$MNT/usr/share/backgrounds/warty-final-ubuntu.png" "$MNT/usr/share/backgrounds/ubuntu-wallpaper-d.png"

WP_DIR="$MNT/usr/share/wallpapers/UbuntuNoble"
mkdir -p "$WP_DIR/contents/images" "$WP_DIR/contents/images_dark"
cp "$ASSETS_DIR/warty-final-ubuntu.png" "$WP_DIR/contents/images/3840x2160.png"
cp "$ASSETS_DIR/ubuntu-wallpaper-d.png" "$WP_DIR/contents/images_dark/3840x2160.png"
cp "$ASSETS_DIR/warty-final-ubuntu.png" "$WP_DIR/contents/screenshot.png"
chmod 0644 "$WP_DIR/contents/images/3840x2160.png" "$WP_DIR/contents/images_dark/3840x2160.png" "$WP_DIR/contents/screenshot.png"

cat > "$WP_DIR/metadata.json" <<'EOF'
{
    "KPlugin": {
        "Authors": [
            {
                "Name": "Canonical Ltd."
            }
        ],
        "Id": "UbuntuNoble",
        "License": "CC-BY-SA-4.0",
        "Name": "Ubuntu Noble Numbat"
    },
    "X-KDE-PlasmaImageWallpaper-AccentColor": {
        "Dark": "#77216F",
        "Light": "#E95420"
    }
}
EOF
chmod 0644 "$WP_DIR/metadata.json"

# Install start-here-ubuntu icon
mkdir -p "$MNT/usr/share/icons/hicolor/scalable/places" "$MNT/usr/share/icons/breeze-dark/places/22"
cp "$ASSETS_DIR/ubuntu-logo.svg" "$MNT/usr/share/icons/hicolor/scalable/places/start-here-ubuntu.svg"
cp "$ASSETS_DIR/ubuntu-logo.svg" "$MNT/usr/share/icons/breeze-dark/places/22/start-here-ubuntu.svg"
chmod 0644 "$MNT/usr/share/icons/hicolor/scalable/places/start-here-ubuntu.svg" "$MNT/usr/share/icons/breeze-dark/places/22/start-here-ubuntu.svg"

# 3b. UbuntuNoble Breeze-based Color Scheme (#2C001E, #77216F, #E95420)
mkdir -p "$MNT/usr/share/color-schemes"
cat > "$MNT/usr/share/color-schemes/UbuntuNoble.colors" <<'EOF'
[ColorEffects:Disabled]
Color=56,56,56
ColorAmount=0
ColorEffect=0
ContrastAmount=0.65
ContrastEffect=1
IntensityAmount=0.1
IntensityEffect=2

[ColorEffects:Inactive]
ChangeSelectionColor=true
Color=44,0,30
ColorAmount=0.025
ColorEffect=2
ContrastAmount=0.1
ContrastEffect=2
Enable=false
IntensityAmount=0
IntensityEffect=0

[Colors:Button]
BackgroundAlternate=119,33,111
BackgroundNormal=56,36,52
DecorationFocus=233,84,32
DecorationHover=119,33,111
ForegroundActive=233,84,32
ForegroundInactive=175,165,172
ForegroundLink=233,84,32
ForegroundNegative=218,68,83
ForegroundNeutral=246,116,0
ForegroundNormal=247,247,247
ForegroundPositive=39,174,96
ForegroundVisited=155,89,182

[Colors:Complementary]
BackgroundAlternate=119,33,111
BackgroundNormal=44,0,30
DecorationFocus=233,84,32
DecorationHover=119,33,111
ForegroundActive=233,84,32
ForegroundInactive=175,165,172
ForegroundLink=233,84,32
ForegroundNegative=218,68,83
ForegroundNeutral=246,116,0
ForegroundNormal=247,247,247
ForegroundPositive=39,174,96
ForegroundVisited=155,89,182

[Colors:Header]
BackgroundAlternate=48,10,36
BackgroundNormal=44,0,30
DecorationFocus=233,84,32
DecorationHover=119,33,111
ForegroundActive=233,84,32
ForegroundInactive=175,165,172
ForegroundLink=233,84,32
ForegroundNegative=218,68,83
ForegroundNeutral=246,116,0
ForegroundNormal=255,255,255
ForegroundPositive=39,174,96
ForegroundVisited=155,89,182

[Colors:Header][Inactive]
BackgroundAlternate=35,28,34
BackgroundNormal=35,28,34
DecorationFocus=233,84,32
DecorationHover=119,33,111
ForegroundActive=233,84,32
ForegroundInactive=161,150,158
ForegroundLink=233,84,32
ForegroundNegative=218,68,83
ForegroundNeutral=246,116,0
ForegroundNormal=220,214,218
ForegroundPositive=39,174,96
ForegroundVisited=155,89,182

[Colors:Selection]
BackgroundAlternate=119,33,111
BackgroundNormal=233,84,32
DecorationFocus=233,84,32
DecorationHover=119,33,111
ForegroundActive=255,255,255
ForegroundInactive=235,235,235
ForegroundLink=255,255,255
ForegroundNegative=255,200,200
ForegroundNeutral=255,230,200
ForegroundNormal=255,255,255
ForegroundPositive=200,255,220
ForegroundVisited=230,210,240

[Colors:Tooltip]
BackgroundAlternate=48,10,36
BackgroundNormal=44,0,30
DecorationFocus=233,84,32
DecorationHover=119,33,111
ForegroundActive=233,84,32
ForegroundInactive=175,165,172
ForegroundLink=233,84,32
ForegroundNegative=218,68,83
ForegroundNeutral=246,116,0
ForegroundNormal=247,247,247
ForegroundPositive=39,174,96
ForegroundVisited=155,89,182

[Colors:View]
BackgroundAlternate=38,26,35
BackgroundNormal=29,21,27
DecorationFocus=233,84,32
DecorationHover=119,33,111
ForegroundActive=233,84,32
ForegroundInactive=175,165,172
ForegroundLink=233,84,32
ForegroundNegative=218,68,83
ForegroundNeutral=246,116,0
ForegroundNormal=247,247,247
ForegroundPositive=39,174,96
ForegroundVisited=155,89,182

[Colors:Window]
BackgroundAlternate=44,0,30
BackgroundNormal=35,28,34
DecorationFocus=233,84,32
DecorationHover=119,33,111
ForegroundActive=233,84,32
ForegroundInactive=175,165,172
ForegroundLink=233,84,32
ForegroundNegative=218,68,83
ForegroundNeutral=246,116,0
ForegroundNormal=247,247,247
ForegroundPositive=39,174,96
ForegroundVisited=155,89,182

[General]
AccentColor=233,84,32
ColorScheme=UbuntuNoble
Name=Ubuntu Noble
shadeSortColumn=true

[KDE]
contrast=4

[WM]
activeBackground=44,0,30
activeBlend=255,255,255
activeForeground=255,255,255
inactiveBackground=35,28,34
inactiveBlend=180,165,175
inactiveForeground=180,165,175
EOF
chmod 0644 "$MNT/usr/share/color-schemes/UbuntuNoble.colors"

# 3c. Plasma 5 Look-and-Feel Package (org.ubuntu.noble.desktop)
LAF_DIR="$MNT/usr/share/plasma/look-and-feel/org.ubuntu.noble.desktop"
mkdir -p "$LAF_DIR/contents/layouts"
cat > "$LAF_DIR/metadata.json" <<'EOF'
{
    "KPlugin": {
        "Authors": [
            {
                "Name": "WebLinux Ubuntu Branding"
            }
        ],
        "Description": "Ubuntu 24.04.5 LTS Noble Numbat Plasma 5.27 theme",
        "Id": "org.ubuntu.noble.desktop",
        "License": "GPLv2+",
        "Name": "Ubuntu Noble"
    },
    "KPackageStructure": "Plasma/LookAndFeel"
}
EOF
cat > "$LAF_DIR/contents/defaults" <<'EOF'
[kdeglobals][KDE]
widgetStyle=Breeze

[kdeglobals][General]
ColorScheme=UbuntuNoble

[kdeglobals][Icons]
Theme=breeze-dark

[plasmarc][Theme]
name=breeze-dark

[Wallpaper]
Image=UbuntuNoble

[kcminputrc][Mouse]
cursorTheme=breeze_cursors

[kwinrc][WindowSwitcher]
LayoutName=org.kde.breeze.desktop

[kwinrc][DesktopSwitcher]
LayoutName=org.kde.breeze.desktop

[kwinrc][org.kde.kdecoration2]
library=org.kde.breeze
theme=Breeze

[KSplash]
Theme=org.kde.Breeze
EOF
cat > "$LAF_DIR/contents/layouts/org.kde.plasma.desktop-layout.js" <<'EOF'
loadTemplate("org.kde.plasma.desktop.defaultPanel")

var desktopsArray = desktopsForActivity(currentActivity());
for (var j = 0; j < desktopsArray.length; j++) {
    desktopsArray[j].wallpaperPlugin = "org.kde.image";
    desktopsArray[j].currentConfigGroup = ["Wallpaper", "org.kde.image", "General"];
    desktopsArray[j].writeConfig("Image", "/usr/share/wallpapers/UbuntuNoble/contents/images/3840x2160.png");
}

var allPanels = panels();
for (var i = 0; i < allPanels.length; i++) {
    var widgets = allPanels[i].widgets();
    for (var w = 0; w < widgets.length; w++) {
        if (widgets[w].type === "org.kde.plasma.kickoff") {
            widgets[w].currentConfigGroup = ["General"];
            widgets[w].writeConfig("icon", "start-here-ubuntu");
            widgets[w].writeConfig("menuLabel", "Ubuntu");
            widgets[w].writeConfig("favorites", "org.kde.konsole.desktop,org.kde.dolphin.desktop,systemsettings.desktop");
        }
    }
}
EOF
chmod 0644 "$LAF_DIR/metadata.json" "$LAF_DIR/contents/defaults" "$LAF_DIR/contents/layouts/org.kde.plasma.desktop-layout.js"

# 3d. Konsole UbuntuNoble Colorscheme & Profile
mkdir -p "$MNT/usr/share/konsole"
cat > "$MNT/usr/share/konsole/UbuntuNoble.colorscheme" <<'EOF'
[Background]
Color=44,0,30

[BackgroundFaint]
Color=44,0,30

[BackgroundIntense]
Color=44,0,30

[Color0]
Color=46,52,54

[Color0Faint]
Color=46,52,54

[Color0Intense]
Color=85,87,83

[Color1]
Color=204,0,0

[Color1Faint]
Color=204,0,0

[Color1Intense]
Color=239,41,41

[Color2]
Color=78,154,6

[Color2Faint]
Color=78,154,6

[Color2Intense]
Color=138,226,52

[Color3]
Color=196,160,0

[Color3Faint]
Color=196,160,0

[Color3Intense]
Color=252,233,79

[Color4]
Color=52,101,164

[Color4Faint]
Color=52,101,164

[Color4Intense]
Color=114,159,207

[Color5]
Color=119,33,111

[Color5Faint]
Color=119,33,111

[Color5Intense]
Color=173,127,168

[Color6]
Color=6,152,154

[Color6Faint]
Color=6,152,154

[Color6Intense]
Color=52,226,226

[Color7]
Color=211,215,207

[Color7Faint]
Color=211,215,207

[Color7Intense]
Color=238,238,236

[Foreground]
Color=255,255,255

[ForegroundFaint]
Color=211,215,207

[ForegroundIntense]
Color=233,84,32

[General]
Anchor=0.5,0.5
Blur=false
ColorRandomization=false
Description=Ubuntu Noble
FillStyle=Tile
Opacity=1
Wallpaper=
WallpaperFlipType=NoFlip
WallpaperOpacity=1
EOF

cat > "$MNT/usr/share/konsole/UbuntuNoble.profile" <<'EOF'
[Appearance]
ColorScheme=UbuntuNoble
Font=DejaVu Sans Mono,11,-1,5,50,0,0,0,0,0

[General]
Name=Ubuntu Noble
Parent=FALLBACK/
EOF
chmod 0644 "$MNT/usr/share/konsole/UbuntuNoble.colorscheme" "$MNT/usr/share/konsole/UbuntuNoble.profile"

# 3e. System-wide /etc/xdg defaults
cat > "$MNT/etc/xdg/kdeglobals" <<'EOF'
[General]
AccentColor=233,84,32
ColorScheme=UbuntuNoble
Name=Ubuntu Noble

[Icons]
Theme=breeze-dark

[KDE]
AnimationDurationFactor=0
LookAndFeelPackage=org.ubuntu.noble.desktop
SingleClick=false
widgetStyle=Breeze

[WM]
activeBackground=44,0,30
activeForeground=255,255,255
inactiveBackground=35,28,34
inactiveForeground=180,165,175
EOF

cat > "$MNT/etc/xdg/konsolerc" <<'EOF'
[Desktop Entry]
DefaultProfile=UbuntuNoble.profile

[MainWindow]
MenuBar=Disabled
EOF

cat > "$MNT/etc/xdg/dolphinrc" <<'EOF'
[General]
ShowFullPath=true

[MainWindow]
MenuBar=Disabled
EOF

cat > "$MNT/etc/xdg/kcminputrc" <<'EOF'
[Mouse]
cursorTheme=breeze_cursors
EOF

cat > "$MNT/etc/xdg/plasmarc" <<'EOF'
[Theme]
name=breeze-dark
EOF

cat > "$MNT/etc/xdg/kwinrc" <<'EOF'
[org.kde.kdecoration2]
library=org.kde.breeze
theme=Breeze
EOF
chmod 0644 "$MNT/etc/xdg/kdeglobals" "$MNT/etc/xdg/konsolerc" "$MNT/etc/xdg/dolphinrc" "$MNT/etc/xdg/kcminputrc" "$MNT/etc/xdg/plasmarc" "$MNT/etc/xdg/kwinrc"

# 3f. Idempotent Plasma 5.27 migration script & autostart
cat > "$MNT/usr/local/bin/weblinux-apply-branding" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

STATE_DIR="${HOME}/.local/state/weblinux"
MARKER="${STATE_DIR}/branding-v1-applied"
BACKUP_DIR="${STATE_DIR}/backup-branding-v1"
CFG_DIR="${HOME}/.config"

if [ -f "$MARKER" ]; then
  exit 0
fi

mkdir -p "$STATE_DIR" "$CFG_DIR"

# Back up any existing user configs before modifying (never delete .config or user files)
for f in kdeglobals konsolerc dolphinrc kcminputrc plasmarc kwinrc plasma-org.kde.plasma.desktop-appletsrc; do
  if [ -f "${CFG_DIR}/${f}" ]; then
    mkdir -p "$BACKUP_DIR"
    cp -a "${CFG_DIR}/${f}" "${BACKUP_DIR}/${f}"
  fi
done

if command -v kwriteconfig5 >/dev/null 2>&1; then
  kwriteconfig5 --file kdeglobals --group General --key Name "Ubuntu Noble"
  kwriteconfig5 --file kdeglobals --group General --key ColorScheme "UbuntuNoble"
  kwriteconfig5 --file kdeglobals --group General --key AccentColor "233,84,32"
  kwriteconfig5 --file kdeglobals --group Icons --key Theme "breeze-dark"
  kwriteconfig5 --file kdeglobals --group KDE --key LookAndFeelPackage "org.ubuntu.noble.desktop"
  kwriteconfig5 --file kdeglobals --group KDE --key widgetStyle "Breeze"
  kwriteconfig5 --file kdeglobals --group KDE --key AnimationDurationFactor "0"
  kwriteconfig5 --file kdeglobals --group KDE --key SingleClick "false"
  kwriteconfig5 --file kdeglobals --group WM --key activeBackground "44,0,30"
  kwriteconfig5 --file kdeglobals --group WM --key activeForeground "255,255,255"

  kwriteconfig5 --file konsolerc --group "Desktop Entry" --key DefaultProfile "UbuntuNoble.profile"
  kwriteconfig5 --file konsolerc --group MainWindow --key MenuBar "Disabled"

  kwriteconfig5 --file dolphinrc --group General --key ShowFullPath "true"
  kwriteconfig5 --file dolphinrc --group MainWindow --key MenuBar "Disabled"

  kwriteconfig5 --file kcminputrc --group Mouse --key cursorTheme "breeze_cursors"
  kwriteconfig5 --file plasmarc --group Theme --key name "breeze-dark"
  kwriteconfig5 --file kwinrc --group org.kde.kdecoration2 --key library "org.kde.breeze"
  kwriteconfig5 --file kwinrc --group org.kde.kdecoration2 --key theme "Breeze"
fi

touch "$MARKER"
EOF
chmod 0755 "$MNT/usr/local/bin/weblinux-apply-branding"

mkdir -p "$MNT/etc/xdg/autostart"
cat > "$MNT/etc/xdg/autostart/weblinux-branding.desktop" <<'EOF'
[Desktop Entry]
Type=Application
Name=WebLinux Ubuntu Branding Migration
Exec=/usr/local/bin/weblinux-apply-branding
OnlyShowIn=KDE;
X-KDE-StartupNotify=false
NoDisplay=true
EOF
chmod 0644 "$MNT/etc/xdg/autostart/weblinux-branding.desktop"

# 3g. Interactive-safe Ubuntu shell prompt
mkdir -p "$MNT/etc/profile.d"
cat > "$MNT/etc/profile.d/weblinux-ubuntu-prompt.sh" <<'EOF'
# Interactive-only Ubuntu Noble shell prompt (safe for non-interactive scripts)
case $- in
  *i*) ;;
  *) return 0 2>/dev/null || exit 0 ;;
esac

export TERM="${TERM:-xterm-256color}"
export PS1='\[\e[1;38;2;233;84;32m\]\u@ubuntu-noble\[\e[0m\]:\[\e[1;34m\]\w\[\e[0m\]\$ '
EOF
chmod 0644 "$MNT/etc/profile.d/weblinux-ubuntu-prompt.sh"

echo "=== [4/5] Applying migration & verifying inside riscv64 chroot ==="
chroot "$MNT" /usr/bin/qemu-riscv64-static /bin/bash -c '
  set -euo pipefail
  export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
  export HOME=/root

  /usr/local/bin/weblinux-apply-branding
  # Verify idempotency (second run must succeed with marker intact)
  /usr/local/bin/weblinux-apply-branding

  test -f /root/.local/state/weblinux/branding-v1-applied
  test -f /usr/share/wallpapers/UbuntuNoble/contents/images/3840x2160.png
  test -f /usr/share/backgrounds/warty-final-ubuntu.png
  test -f /usr/share/color-schemes/UbuntuNoble.colors
  test -f /usr/share/konsole/UbuntuNoble.profile
  test -f /usr/share/konsole/UbuntuNoble.colorscheme
  test -f /usr/share/icons/hicolor/scalable/places/start-here-ubuntu.svg

  PLASMA_VER=$(QT_QPA_PLATFORM=offscreen plasmashell --version 2>/dev/null)
  echo "Verified Plasma version: $PLASMA_VER"
  echo "$PLASMA_VER" | grep -q "5\.27\.12"

  echo "Verified os-release:"
  grep -E "^(PRETTY_NAME|VERSION)=" /etc/os-release

  if dpkg -l | grep -qiE "epiphany-browser|firefox|chromium"; then
    echo "ERROR: Graphical browser package detected!" >&2
    exit 1
  fi
  echo "Browser check: none installed"

  # Non-interactive shell check with profile.d script
  /bin/bash -c "source /etc/profile.d/weblinux-ubuntu-prompt.sh; echo non-interactive-ok"
'

# Unmount cleanly before running e2fsck
cleanup
trap - EXIT

echo "=== [5/5] Running e2fsck -fy and slicing 1 MiB chunks ==="
e2fsck -fy "$IMG"

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

pres = []
for i in range(0, total, 4):
    nib = 0
    for j in range(4):
        if i + j < total and hashes[i + j]:
            nib |= (1 << (3 - j))
    pres.append(format(nib, "x"))

full_sha = full_h.hexdigest()
manifest_id = full_sha[:32]
boot = [i for i in range(min(64, total)) if hashes[i]]

manifest = {
    "size": size,
    "piece": piece,
    "id": manifest_id,
    "hashes": hashes,
    "boot": boot,
    "present": "".join(pres),
}
integ = {
    "distributionId": "ubuntu-24.04-kde-epiphany",
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
    with open(os.path.join(d, "integrity.json"), "w", encoding="utf-8") as f_int:
        json.dump(integ, f_int, indent=2)

recon_h = hashlib.sha256()
for i in range(total):
    if hashes[i]:
        with open(os.path.join(chunks_dir, f"{i:06d}"), "rb") as cf:
            recon_h.update(cf.read())
    else:
        recon_h.update(zero_chunk)
assert recon_h.hexdigest() == full_sha, "Reconstruction SHA-256 mismatch!"

print(f"SLICE_DONE id={manifest_id} fullSha256={full_sha} total={total} nonzero={nonzero} boot={len(boot)} RECONSTRUCT_OK=True")
PY
