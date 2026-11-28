#!/usr/bin/env bash
set -euo pipefail

# WebLinux Phase 16 — Fedora 45 KDE Plasma 6 Branding Script
# Applies authentic Fedora 45 branding (fedora-logos, f45-backgrounds-kde,
# plasma-lookandfeel-fedora, Fedora Blue #51A2DA / #3C6EB4 palette, Konsole
# colorscheme/profile/prompt, and idempotent user migration).
#
# Usage: apply-fedora-branding.sh [ROOTFS_MOUNT]
# Default ROOTFS_MOUNT: /root/branding-fedora/mnt

MNT="${1:-/root/branding-fedora/mnt}"

if [ ! -d "$MNT/etc" ] || [ ! -d "$MNT/usr/share" ]; then
  echo "ERROR: Rootfs mount '$MNT' does not look like a valid Linux rootfs." >&2
  exit 1
fi

echo "=== [1/6] Verifying Fedora 45 base, Plasma 6, and DNF5 GPG trust ==="
for pkg_file in \
  "$MNT/etc/os-release" \
  "$MNT/etc/dnf/repos.override.d/99-weblinux-security.repo" \
  "$MNT/usr/share/pki/rpm-gpg/RPM-GPG-KEY-fedora-45-primary" \
  "$MNT/usr/share/pixmaps/fedora-logo-sprite.svg" \
  "$MNT/usr/share/icons/hicolor/scalable/places/start-here.svg" \
  "$MNT/usr/share/wallpapers/F45/metadata.json" \
  "$MNT/usr/share/backgrounds/f45/default/f45-01-day.jxl" \
  "$MNT/usr/share/plasma/look-and-feel/org.fedoraproject.fedora.desktop/metadata.json" \
  "$MNT/usr/share/color-schemes/BreezeLight.colors" \
  "$MNT/usr/share/color-schemes/BreezeDark.colors"; do
  if [ ! -e "$pkg_file" ]; then
    echo "ERROR: Required Fedora asset/config missing: $pkg_file" >&2
    exit 1
  fi
done

if ! grep -q '^gpgcheck=1$' "$MNT/etc/dnf/repos.override.d/99-weblinux-security.repo"; then
  echo "ERROR: gpgcheck=1 missing in 99-weblinux-security.repo; refusing to proceed." >&2
  exit 1
fi

echo "=== [2/6] Installing Fedora Breeze color schemes (#51A2DA / #3C6EB4) ==="
mkdir -p "$MNT/usr/share/color-schemes"

python3 - "$MNT" <<'PY'
import os, sys

mnt = sys.argv[1]
schemes_dir = os.path.join(mnt, "usr/share/color-schemes")

def make_fedora_scheme(src_name, dst_name, scheme_id, display_name):
    src = os.path.join(schemes_dir, src_name)
    dst = os.path.join(schemes_dir, dst_name)
    with open(src, "r", encoding="utf-8") as f:
        lines = f.readlines()

    out = []
    for line in lines:
        # Replace Breeze Cyan/Blue accents with Fedora Blue #51A2DA (81,162,218)
        # and Fedora Classic Blue #3C6EB4 (60,110,180)
        s = line.strip()
        if s.startswith("ColorScheme="):
            out.append(f"ColorScheme={scheme_id}\n")
        elif s.startswith("Name="):
            out.append(f"Name={display_name}\n")
        elif s.startswith("Name["):
            continue
        elif "=61,174,233" in line:
            out.append(line.replace("=61,174,233", "=81,162,218"))
        elif "=41,128,185" in line or "=29,153,243" in line:
            out.append(line.replace("=41,128,185", "=60,110,180").replace("=29,153,243", "=81,162,218"))
        elif "=163,212,250" in line:
            out.append(line.replace("=163,212,250", "=168,209,239"))
        else:
            out.append(line)

    with open(dst, "w", encoding="utf-8") as f:
        f.writelines(out)

make_fedora_scheme("BreezeLight.colors", "FedoraBreeze.colors", "FedoraBreeze", "Fedora Breeze")
make_fedora_scheme("BreezeDark.colors", "FedoraBreezeDark.colors", "FedoraBreezeDark", "Fedora Breeze Dark")
PY

echo "=== [3/6] Installing Fedora Konsole color scheme, profile, and bash prompt ==="
mkdir -p "$MNT/usr/share/konsole"
cat <<'EOF' > "$MNT/usr/share/konsole/Fedora.colorscheme"
[Background]
Color=30,36,43

[BackgroundFaint]
Color=24,29,35

[BackgroundIntense]
Color=38,45,54

[Color0]
Color=35,38,41

[Color0Faint]
Color=49,54,59

[Color0Intense]
Color=127,140,141

[Color1]
Color=219,50,121

[Color1Faint]
Color=166,38,92

[Color1Intense]
Color=230,85,146

[Color2]
Color=121,219,50

[Color2Faint]
Color=92,166,38

[Color2Intense]
Color=152,230,96

[Color3]
Color=229,151,40

[Color3Faint]
Color=181,115,24

[Color3Intense]
Color=243,181,90

[Color4]
Color=60,110,180

[Color4Faint]
Color=41,79,133

[Color4Intense]
Color=81,162,218

[Color5]
Color=160,124,203

[Color5Faint]
Color=120,89,158

[Color5Intense]
Color=190,160,226

[Color6]
Color=81,162,218

[Color6Faint]
Color=60,110,180

[Color6Intense]
Color=125,193,238

[Color7]
Color=239,240,241

[Color7Faint]
Color=189,195,199

[Color7Intense]
Color=252,252,252

[Foreground]
Color=239,240,241

[ForegroundFaint]
Color=189,195,199

[ForegroundIntense]
Color=255,255,255

[General]
Blur=false
ColorRandomization=false
Description=Fedora 45 Blue
Opacity=1
Wallpaper=
EOF

cat <<'EOF' > "$MNT/usr/share/konsole/Fedora.profile"
[Appearance]
ColorScheme=Fedora
Font=DejaVu Sans Mono,10,-1,5,400,0,0,0,0,0,0,0,0,0,0,1

[General]
Name=Fedora
Parent=FALLBACK/

[Scrolling]
HistorySize=5000
EOF

cat <<'EOF' > "$MNT/etc/xdg/konsolerc"
[Desktop Entry]
DefaultProfile=Fedora.profile

[MainWindow]
MenuBar=Disabled

[FileLocation]
scrollbackUseCacheLocation=true
scrollbackUseSystemLocation=false
EOF

mkdir -p "$MNT/etc/profile.d" "$MNT/root/.bashrc.d"
cat <<'EOF' > "$MNT/etc/profile.d/weblinux-fedora-prompt.sh"
# WebLinux Fedora 45 interactive prompt (Fedora Blue #51A2DA / #3C6EB4)
case "$-" in
  *i*)
    PS1='\[\033[38;2;81;162;218m\][\[\033[1;38;2;60;110;180m\]\u\[\033[0;38;2;81;162;218m\]@\[\033[1;38;2;81;162;218m\]\h \[\033[0;38;2;239;240;241m\]\W\[\033[38;2;81;162;218m\]]\[\033[0m\]\$ '
    ;;
esac
EOF
chmod 0644 "$MNT/etc/profile.d/weblinux-fedora-prompt.sh"
cp "$MNT/etc/profile.d/weblinux-fedora-prompt.sh" "$MNT/root/.bashrc.d/weblinux-fedora-prompt.sh"
chmod 0644 "$MNT/root/.bashrc.d/weblinux-fedora-prompt.sh"

echo "=== [4/6] Writing Fedora KDE branding defaults and /etc/xdg configs ==="
DEFAULTS_DIR="$MNT/usr/share/weblinux-branding/fedora/defaults"
mkdir -p "$DEFAULTS_DIR" "$MNT/etc/xdg" "$MNT/etc/skel/.config"

cat <<'EOF' > "$MNT/etc/xdg/kcm-about-distrorc"
[General]
LogoPath=/usr/share/pixmaps/system-logo-white.png
Website=https://fedoraproject.org/
EOF

cat <<'EOF' > "$DEFAULTS_DIR/kdeglobals"
[General]
AccentColor=81,162,218
ColorScheme=FedoraBreeze
fixed=DejaVu Sans Mono,10,-1,5,400,0,0,0,0,0
font=DejaVu Sans,10,-1,5,400,0,0,0,0,0
menuFont=DejaVu Sans,10,-1,5,400,0,0,0,0,0
smallestReadableFont=DejaVu Sans,8,-1,5,400,0,0,0,0,0
toolBarFont=DejaVu Sans,9,-1,5,400,0,0,0,0,0

[Icons]
Theme=breeze

[KDE]
LookAndFeelPackage=org.fedoraproject.fedora.desktop
SingleClick=false
widgetStyle=Breeze
EOF

cat <<'EOF' > "$DEFAULTS_DIR/kcminputrc"
[Mouse]
cursorTheme=breeze_cursors
EOF

cat <<'EOF' > "$DEFAULTS_DIR/plasmarc"
[Theme]
name=breeze-dark
EOF

cat <<'EOF' > "$DEFAULTS_DIR/kwinrc"
[Wayland]
InputMethod[$e]=/usr/share/applications/org.kde.plasma.keyboard.desktop
VirtualKeyboardEnabled=true

[org.kde.kdecoration2]
BorderSize=Normal
library=org.kde.breeze
theme=Breeze
EOF

cat <<'EOF' > "$DEFAULTS_DIR/konsolerc"
[Desktop Entry]
DefaultProfile=Fedora.profile

[MainWindow]
MenuBar=Disabled

[FileLocation]
scrollbackUseCacheLocation=true
scrollbackUseSystemLocation=false
EOF

cat <<'EOF' > "$DEFAULTS_DIR/kscreenlockerrc"
[Greeter][Wallpaper][org.kde.image][General]
Image=file:///usr/share/wallpapers/F45/
EOF

cat <<'EOF' > "$DEFAULTS_DIR/plasma-org.kde.plasma.desktop-appletsrc"
[Containments][1]
activityId=
formfactor=0
immutability=1
lastScreen=0
location=0
plugin=org.kde.plasma.folder
wallpaperplugin=org.kde.image

[Containments][1][Wallpaper][org.kde.image][General]
Image=file:///usr/share/wallpapers/F45/

[Containments][2]
activityId=
formfactor=2
immutability=1
lastScreen=0
location=4
plugin=org.kde.panel
wallpaperplugin=org.kde.image

[Containments][2][Applets][3]
immutability=1
plugin=org.kde.plasma.kickoff

[Containments][2][Applets][3][Configuration][General]
favoritesPortedToKAstats=true
icon=start-here

[Containments][2][Applets][4]
immutability=1
plugin=org.kde.plasma.pager

[Containments][2][Applets][5]
immutability=1
plugin=org.kde.plasma.icontasks

[Containments][2][Applets][6]
immutability=1
plugin=org.kde.plasma.systemtray

[Containments][2][Applets][7]
immutability=1
plugin=org.kde.plasma.digitalclock

[Containments][2][General]
AppletOrder=3;4;5;6;7
EOF

cp -a "$DEFAULTS_DIR/"* "$MNT/etc/xdg/" 2>/dev/null || true
# Keep /etc/xdg/plasma-org.kde.plasma.desktop-appletsrc out of /etc/xdg if not standard,
# instead seed /etc/skel/.config/ and apply via migration script.
rm -f "$MNT/etc/xdg/plasma-org.kde.plasma.desktop-appletsrc"
cp -a "$DEFAULTS_DIR/"* "$MNT/etc/skel/.config/"

echo "=== [5/6] Installing idempotent Plasma migration script & session hook ==="
cat <<'EOF' > "$MNT/usr/local/bin/weblinux-fedora-branding-migrate"
#!/usr/bin/env bash
set -euo pipefail

HOME_DIR="${HOME:-/root}"
STATE_DIR="$HOME_DIR/.local/state/weblinux"
MARKER="$STATE_DIR/branding-v1-applied"
DEFAULTS_DIR="/usr/share/weblinux-branding/fedora/defaults"

if [ -f "$MARKER" ]; then
  exit 0
fi

mkdir -p "$STATE_DIR" "$HOME_DIR/.config"
BACKUP_DIR="$STATE_DIR/backup-pre-branding-v1-$(date +%Y%m%d%H%M%S)"
BACKUP_CREATED=0

for cfg in \
  kdeglobals \
  kcminputrc \
  plasmarc \
  kwinrc \
  konsolerc \
  kscreenlockerrc \
  plasma-org.kde.plasma.desktop-appletsrc; do
  SRC="$DEFAULTS_DIR/$cfg"
  DST="$HOME_DIR/.config/$cfg"
  if [ ! -f "$SRC" ]; then
    continue
  fi
  if [ -e "$DST" ]; then
    if [ "$BACKUP_CREATED" -eq 0 ]; then
      mkdir -p "$BACKUP_DIR"
      BACKUP_CREATED=1
    fi
    cp -a "$DST" "$BACKUP_DIR/$cfg"
  fi
  if [ ! -e "$DST" ]; then
    cp -a "$SRC" "$DST"
  else
    # Merge branding keys into existing config without deleting user keys
    python3 - "$SRC" "$DST" <<'PY' || cp -a "$SRC" "$DST"
import sys, configparser

src_path, dst_path = sys.argv[1], sys.argv[2]
src = configparser.RawConfigParser(interpolation=None)
src.optionxform = str
dst = configparser.RawConfigParser(interpolation=None)
dst.optionxform = str
src.read(src_path, encoding="utf-8")
dst.read(dst_path, encoding="utf-8")

for section in src.sections():
    if not dst.has_section(section):
        dst.add_section(section)
    for k, v in src.items(section):
        dst.set(section, k, v)

with open(dst_path, "w", encoding="utf-8") as f:
    dst.write(f, space_around_delimiters=False)
PY
  fi
done

{
  echo "distro=fedora-45"
  echo "version=1"
  echo "applied_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
} > "$MARKER"
EOF
chmod 0755 "$MNT/usr/local/bin/weblinux-fedora-branding-migrate"

# Hook migration into /usr/local/bin/fedora-kde-session idempotently
if [ -f "$MNT/usr/local/bin/fedora-kde-session" ] && ! grep -q "weblinux-fedora-branding-migrate" "$MNT/usr/local/bin/fedora-kde-session"; then
  python3 - "$MNT/usr/local/bin/fedora-kde-session" <<'PY'
import sys
p = sys.argv[1]
with open(p, "r", encoding="utf-8") as f:
    txt = f.read()
hook = '# 0. Apply idempotent WebLinux Fedora 45 branding migration\n[ -x /usr/local/bin/weblinux-fedora-branding-migrate ] && /usr/local/bin/weblinux-fedora-branding-migrate >> /root/fedora-kde-session.log 2>&1 || true\n\n'
target = "# 1. D-Bus system + session buses"
if target in txt:
    txt = txt.replace(target, hook + target, 1)
else:
    txt = txt + "\n" + hook
with open(p, "w", encoding="utf-8") as f:
    f.write(txt)
PY
fi

echo "=== [6/6] Running idempotent migration for /root inside chroot ==="
HOME=/root chroot "$MNT" /usr/bin/qemu-riscv64-static /usr/bin/bash /usr/local/bin/weblinux-fedora-branding-migrate
# Re-run once to prove idempotency
HOME=/root chroot "$MNT" /usr/bin/qemu-riscv64-static /usr/bin/bash /usr/local/bin/weblinux-fedora-branding-migrate

echo "FEDORA_BRANDING_APPLIED"
