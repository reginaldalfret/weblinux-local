#!/bin/bash
set -euo pipefail
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

# Phase 16 — Arch Linux RISC-V KDE Plasma 6.8.3 Branding Script
# Applies official Arch Linux artwork, #1793D1 + dark/black palette,
# minimal KDE desktop, Arch-branded Kickoff menu, Konsole theme,
# Arch terminal prompt, and idempotent user migration.

WORKDIR="/root/branding-arch"
IMG="$WORKDIR/arch-kde.ext4"
MNT="$WORKDIR/mnt"
CHUNKS="/mnt/d/weblinux-disks/arch-kde"
PUB="/mnt/e/Web-Linux/weblinux-local/apps/web/public/disk/arch-kde"
BRAND_PUB="/mnt/e/Web-Linux/weblinux-local/apps/web/public/branding/arch"
BRAND_D="/mnt/d/weblinux-disks/branding/arch"
PKG_ARCHIVE="/mnt/d/weblinux-build/arch-pkg-cache"
PIECE=1048576

cleanup() {
  umount -lf "$MNT/dev/pts" 2>/dev/null || true
  umount -lf "$MNT/dev" 2>/dev/null || true
  umount -lf "$MNT/sys" 2>/dev/null || true
  umount -lf "$MNT/proc" 2>/dev/null || true
  rm -f "$MNT/usr/bin/qemu-riscv64-static" 2>/dev/null || true
  if [ -f "$MNT/etc/resolv.conf.branding-bak" ]; then
    mv -f "$MNT/etc/resolv.conf.branding-bak" "$MNT/etc/resolv.conf" 2>/dev/null || true
  fi
  umount -lf "$MNT" 2>/dev/null || true
}
trap cleanup EXIT

mkdir -p "$WORKDIR" "$MNT" "$CHUNKS" "$PUB" "$BRAND_PUB" "$BRAND_D" "$PKG_ARCHIVE"

echo "=== [1/7] Reconstructing & mounting arch-kde.ext4 ==="
if ! mountpoint -q "$MNT"; then
  if [ ! -f "$IMG" ]; then
    python3 - <<'PY'
import json
import os

CHUNKS = "/mnt/d/weblinux-disks/arch-kde"
IMG = "/root/branding-arch/arch-kde.ext4"

with open(os.path.join(CHUNKS, "manifest.json"), "r") as f:
    m = json.load(f)

piece = m["piece"]
total = m["size"] // piece
with open(IMG, "wb") as out:
    for i in range(total):
        with open(os.path.join(CHUNKS, f"{i:06d}"), "rb") as cf:
            out.write(cf.read())
print(f"Reconstructed {IMG} ({m['size']} bytes, {total} chunks)")
PY
  fi
  mount -o loop "$IMG" "$MNT"
fi

cp /usr/bin/qemu-riscv64-static "$MNT/usr/bin/qemu-riscv64-static"
mountpoint -q "$MNT/proc" || mount -t proc proc "$MNT/proc"
mountpoint -q "$MNT/sys" || mount -t sysfs sysfs "$MNT/sys"
mountpoint -q "$MNT/dev" || mount --bind /dev "$MNT/dev"
mountpoint -q "$MNT/dev/pts" || mount -t devpts devpts "$MNT/dev/pts"

echo "=== [2/7] Installing official archlinux-wallpaper (signed pacman repo) ==="
if ! chroot "$MNT" /usr/bin/qemu-riscv64-static /usr/bin/pacman -Q archlinux-wallpaper >/dev/null 2>&1; then
  cp "$MNT/etc/resolv.conf" "$MNT/etc/resolv.conf.branding-bak"
  cp /etc/resolv.conf "$MNT/etc/resolv.conf"
  chroot "$MNT" /usr/bin/qemu-riscv64-static /usr/bin/pacman -S --noconfirm --needed archlinux-wallpaper
  mv -f "$MNT/etc/resolv.conf.branding-bak" "$MNT/etc/resolv.conf"
  mv "$MNT/var/cache/pacman/pkg/"* "$PKG_ARCHIVE/" 2>/dev/null || true
else
  echo "archlinux-wallpaper already installed."
fi

echo "=== [3/7] Exporting verified Arch branding assets to repo & D: ==="
WALL_SRC="$MNT/usr/share/backgrounds/archlinux/archwave.png"
LOGO_SVG="$MNT/usr/share/pixmaps/archlinux-logo.svg"
LOGO_PNG="$MNT/usr/share/pixmaps/archlinux-logo.png"
LOGO_TEXT_DARK="$MNT/usr/share/pixmaps/archlinux-logo-text-dark.svg"
LOGO_TEXT="$MNT/usr/share/pixmaps/archlinux-logo-text.svg"
WALL_LIC="$MNT/usr/share/licenses/archlinux-wallpaper/LICENSE.md"

for d in "$BRAND_PUB" "$BRAND_D"; do
  cp -f "$WALL_SRC" "$d/archwave.png"
  cp -f "$LOGO_SVG" "$d/archlinux-logo.svg"
  cp -f "$LOGO_PNG" "$d/archlinux-logo.png"
  cp -f "$LOGO_TEXT_DARK" "$d/archlinux-logo-text-dark.svg"
  cp -f "$LOGO_TEXT" "$d/archlinux-logo-text.svg"
  cp -f "$WALL_LIC" "$d/LICENSE.md"
  (cd "$d" && sha256sum archwave.png archlinux-logo.svg archlinux-logo.png archlinux-logo-text-dark.svg archlinux-logo-text.svg LICENSE.md > checksums.sha256)
done

echo "=== [4/7] Installing Plasma 6 wallpaper, icons, color scheme & Konsole theme ==="
# 4a. Plasma 6 wallpaper package
mkdir -p "$MNT/usr/share/wallpapers/ArchLinux/contents/images" \
         "$MNT/usr/share/wallpapers/ArchLinux/contents/images_dark"
cp -f "$WALL_SRC" "$MNT/usr/share/wallpapers/ArchLinux/contents/images/5120x2880.png"
cp -f "$WALL_SRC" "$MNT/usr/share/wallpapers/ArchLinux/contents/images_dark/5120x2880.png"
cat <<'EOF' > "$MNT/usr/share/wallpapers/ArchLinux/metadata.json"
{
    "KPlugin": {
        "Authors": [
            {
                "Name": "rhysperry111 (Arch Linux Wallpapers)"
            }
        ],
        "Id": "ArchLinux",
        "License": "CC0-1.0",
        "Name": "Arch Linux Wave"
    }
}
EOF

# 4b. Hicolor icon registration for archlinux-logo
mkdir -p "$MNT/usr/share/icons/hicolor/scalable/apps" \
         "$MNT/usr/share/icons/hicolor/128x128/apps"
cp -f "$LOGO_SVG" "$MNT/usr/share/icons/hicolor/scalable/apps/archlinux-logo.svg"
cp -f "$LOGO_SVG" "$MNT/usr/share/icons/hicolor/scalable/apps/distributor-logo-archlinux.svg"
cp -f "$LOGO_PNG" "$MNT/usr/share/icons/hicolor/128x128/apps/archlinux-logo.png"
if [ -x "$MNT/usr/bin/gtk-update-icon-cache" ]; then
  chroot "$MNT" /usr/bin/qemu-riscv64-static /usr/bin/gtk-update-icon-cache -f -t /usr/share/icons/hicolor >/dev/null 2>&1 || true
fi

# 4c. ArchBreezeDark color scheme (#1793D1 Arch Blue + dark/black)
python3 - <<'PY'
src = "/root/branding-arch/mnt/usr/share/color-schemes/BreezeDark.colors"
dst = "/root/branding-arch/mnt/usr/share/color-schemes/ArchBreezeDark.colors"
with open(src, "r", encoding="utf-8") as f:
    data = f.read()

data = data.replace("61,174,233", "23,147,209")
data = data.replace("29,153,243", "23,147,209")
data = data.replace("30,87,116", "15,74,105")
data = data.replace("Name=Breeze Dark", "Name=Arch Breeze Dark")
data = data.replace("ColorScheme=BreezeDark", "ColorScheme=ArchBreezeDark")
with open(dst, "w", encoding="utf-8") as f:
    f.write(data)
PY

# 4d. Konsole ArchLinux color scheme & profile
mkdir -p "$MNT/usr/share/konsole"
cat <<'EOF' > "$MNT/usr/share/konsole/ArchLinux.colorscheme"
[Background]
Color=15,18,22

[BackgroundFaint]
Color=10,12,15

[BackgroundIntense]
Color=24,29,36

[Color0]
Color=24,29,36

[Color0Faint]
Color=18,22,27

[Color0Intense]
Color=107,116,128

[Color1]
Color=224,108,117

[Color1Faint]
Color=166,79,86

[Color1Intense]
Color=240,128,136

[Color2]
Color=152,195,121

[Color2Faint]
Color=110,145,86

[Color2Intense]
Color=174,217,143

[Color3]
Color=229,192,123

[Color3Faint]
Color=168,140,88

[Color3Intense]
Color=242,211,148

[Color4]
Color=23,147,209

[Color4Faint]
Color=15,101,145

[Color4Intense]
Color=56,178,240

[Color5]
Color=198,120,221

[Color5Faint]
Color=145,86,163

[Color5Intense]
Color=214,148,235

[Color6]
Color=86,182,194

[Color6Faint]
Color=62,135,145

[Color6Intense]
Color=112,206,219

[Color7]
Color=215,221,229

[Color7Faint]
Color=166,173,184

[Color7Intense]
Color=240,244,248

[Foreground]
Color=230,237,243

[ForegroundFaint]
Color=166,173,184

[ForegroundIntense]
Color=255,255,255

[General]
Blur=false
ColorRandomization=false
Description=Arch Linux (#1793D1)
Opacity=1
Wallpaper=
EOF

cat <<'EOF' > "$MNT/usr/share/konsole/ArchLinux.profile"
[Appearance]
ColorScheme=ArchLinux

[General]
Command=/bin/bash
Name=Arch Linux
Parent=FALLBACK/

[Scrolling]
HistoryMode=2
EOF

echo "=== [5/7] Installing system-wide /etc/xdg defaults, /etc/skel/.bashrc & migration script ==="
mkdir -p "$MNT/etc/xdg"

cat <<'EOF' > "$MNT/etc/xdg/kdeglobals"
[General]
AccentColor=23,147,209
ColorScheme=ArchBreezeDark

[Icons]
Theme=breeze-dark

[KDE]
LookAndFeelPackage=org.kde.breezedark.desktop
widgetStyle=Breeze
EOF

cat <<'EOF' > "$MNT/etc/xdg/plasmarc"
[Theme]
name=breeze-dark
EOF

cat <<'EOF' > "$MNT/etc/xdg/kcminputrc"
[Mouse]
cursorTheme=breeze_cursors
EOF

cat <<'EOF' > "$MNT/etc/xdg/kwinrc"
[org.kde.kdecoration2]
library=org.kde.breeze
theme=Breeze
EOF

cat <<'EOF' > "$MNT/etc/xdg/konsolerc"
[Desktop Entry]
DefaultProfile=ArchLinux.profile
EOF

cat <<'EOF' > "$MNT/etc/xdg/kscreenlockerrc"
[Greeter]
WallpaperPlugin=org.kde.image

[Greeter][Wallpaper][org.kde.image][General]
Image=file:///usr/share/wallpapers/ArchLinux/contents/images/5120x2880.png
EOF

cat <<'EOF' > "$MNT/etc/skel/.bashrc"
#
# ~/.bashrc — Arch Linux WebLinux Edition
#

# If not running interactively, don't do anything
[[ $- != *i* ]] && return

alias ls='ls --color=auto'
alias grep='grep --color=auto'

if [ "$EUID" -eq 0 ]; then
  PS1='\[\e[38;2;23;147;209m\][\[\e[1;38;2;23;147;209m\]\u\[\e[0;38;2;23;147;209m\]@\h \[\e[1;37m\]\W\[\e[38;2;23;147;209m\]]#\[\e[0m\] '
else
  PS1='\[\e[38;2;23;147;209m\][\[\e[1;38;2;23;147;209m\]\u\[\e[0;38;2;23;147;209m\]@\h \[\e[1;37m\]\W\[\e[38;2;23;147;209m\]]$\[\e[0m\] '
fi
EOF

cat <<'EOF' > "$MNT/usr/local/bin/weblinux-arch-branding-migrate"
#!/bin/sh
set -eu

STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/weblinux"
MARKER="$STATE_DIR/branding-v1-applied"

if [ -f "$MARKER" ]; then
  exit 0
fi

CFG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}"
TS="$(date -u +%Y%m%dT%H%M%SZ 2>/dev/null || echo 'init')"
BACKUP_DIR="$STATE_DIR/backup-pre-branding-v1-$TS"

mkdir -p "$STATE_DIR" "$CFG_DIR"

# Back up any existing user configs before applying branding
for f in kdeglobals plasmarc kcminputrc kwinrc konsolerc kscreenlockerrc plasma-org.kde.plasma.desktop-appletsrc; do
  if [ -f "$CFG_DIR/$f" ]; then
    mkdir -p "$BACKUP_DIR"
    cp -a "$CFG_DIR/$f" "$BACKUP_DIR/$f"
  fi
done
if [ -f "$HOME/.bashrc" ]; then
  mkdir -p "$BACKUP_DIR"
  cp -a "$HOME/.bashrc" "$BACKUP_DIR/.bashrc"
fi

# Apply Arch KDE Plasma 6.8.3 configs
cp -f /etc/xdg/kdeglobals "$CFG_DIR/kdeglobals"
cp -f /etc/xdg/plasmarc "$CFG_DIR/plasmarc"
cp -f /etc/xdg/kcminputrc "$CFG_DIR/kcminputrc"
cp -f /etc/xdg/kwinrc "$CFG_DIR/kwinrc"
cp -f /etc/xdg/konsolerc "$CFG_DIR/konsolerc"
cp -f /etc/xdg/kscreenlockerrc "$CFG_DIR/kscreenlockerrc"

# Minimal clean Arch KDE desktop + Arch-branded Kickoff + Konsole/Dolphin pinned
cat <<'PLASMA_EOF' > "$CFG_DIR/plasma-org.kde.plasma.desktop-appletsrc"
[Containments][1]
activityId=
formfactor=0
immutability=1
lastScreen=0
location=0
plugin=org.kde.plasma.folder
wallpaperplugin=org.kde.image

[Containments][1][Wallpaper][org.kde.image][General]
FillMode=2
Image=file:///usr/share/wallpapers/ArchLinux/contents/images/5120x2880.png

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
icon=archlinux-logo
menuLabel=Arch Linux

[Containments][2][Applets][4]
immutability=1
plugin=org.kde.plasma.pager

[Containments][2][Applets][5]
immutability=1
plugin=org.kde.plasma.icontasks

[Containments][2][Applets][5][Configuration][General]
launchers=applications:org.kde.konsole.desktop,applications:org.kde.dolphin.desktop

[Containments][2][Applets][6]
immutability=1
plugin=org.kde.plasma.marginsseparator

[Containments][2][Applets][7]
immutability=1
plugin=org.kde.plasma.systemtray

[Containments][2][Applets][8]
immutability=1
plugin=org.kde.plasma.digitalclock

[Containments][2][Applets][9]
immutability=1
plugin=org.kde.plasma.showdesktop

[Containments][2][General]
AppletOrder=3;4;5;6;7;8;9
PLASMA_EOF

# Arch Linux terminal prompt in ~/.bashrc (append/install cleanly without deleting custom aliases)
if [ ! -f "$HOME/.bashrc" ]; then
  cp -f /etc/skel/.bashrc "$HOME/.bashrc"
elif ! grep -q "Arch Linux WebLinux Edition" "$HOME/.bashrc" 2>/dev/null; then
  cat <<'BASH_EOF' >> "$HOME/.bashrc"

# Arch Linux WebLinux Edition prompt (#1793D1)
if [ "$EUID" -eq 0 ]; then
  PS1='\[\e[38;2;23;147;209m\][\[\e[1;38;2;23;147;209m\]\u\[\e[0;38;2;23;147;209m\]@\h \[\e[1;37m\]\W\[\e[38;2;23;147;209m\]]#\[\e[0m\] '
else
  PS1='\[\e[38;2;23;147;209m\][\[\e[1;38;2;23;147;209m\]\u\[\e[0;38;2;23;147;209m\]@\h \[\e[1;37m\]\W\[\e[38;2;23;147;209m\]]$\[\e[0m\] '
fi
BASH_EOF
fi

cat <<MARKER_EOF > "$MARKER"
version=1
distro=arch
plasma=6.8.3
applied_at=$TS
MARKER
EOF
chmod +x "$MNT/usr/local/bin/weblinux-arch-branding-migrate"

# Hook idempotent migration into arch-kde-session before launching plasmashell
if ! grep -q "weblinux-arch-branding-migrate" "$MNT/usr/local/bin/arch-kde-session"; then
  python3 - <<'PY'
p = "/root/branding-arch/mnt/usr/local/bin/arch-kde-session"
with open(p, "r", encoding="utf-8") as f:
    txt = f.read()
target = "# 4. Build KService 6 cache in background if missing"
hook = "# 3b. Apply idempotent Arch Linux KDE branding migration\nif [ -x /usr/local/bin/weblinux-arch-branding-migrate ]; then\n  /usr/local/bin/weblinux-arch-branding-migrate || true\nfi\n\n" + target
if target not in txt:
    raise RuntimeError("Expected hook anchor not found in arch-kde-session")
txt = txt.replace(target, hook, 1)
with open(p, "w", encoding="utf-8") as f:
    f.write(txt)
PY
fi

echo "=== [6/7] Running migration & verifying inside chroot ==="
chroot "$MNT" /usr/bin/qemu-riscv64-static /usr/bin/bash -c '
  set -euo pipefail
  export HOME=/root USER=root
  /usr/local/bin/weblinux-arch-branding-migrate
  # Second run must be a no-op (idempotent)
  /usr/local/bin/weblinux-arch-branding-migrate

  echo "--- Verification ---"
  cat /etc/os-release | grep -E "^(NAME|ID|ANSI_COLOR|LOGO)="
  QT_QPA_PLATFORM=offscreen plasmashell --version
  pacman -Q archlinux-wallpaper breeze breeze-icons breeze-cursors konsole dolphin
  for b in epiphany chromium firefox; do
    if pacman -Q "$b" >/dev/null 2>&1; then
      echo "ERROR: browser package installed: $b" >&2
      exit 1
    fi
  done
  test -f /root/.local/state/weblinux/branding-v1-applied
  test -f /root/.config/kdeglobals
  test -f /root/.config/plasma-org.kde.plasma.desktop-appletsrc
  test -f /root/.config/konsolerc
  test -f /root/.bashrc
  test -f /usr/share/wallpapers/ArchLinux/contents/images/5120x2880.png
  test -f /usr/share/color-schemes/ArchBreezeDark.colors
  test -f /usr/share/konsole/ArchLinux.colorscheme
  test -f /usr/share/konsole/ArchLinux.profile
  test -f /usr/share/icons/hicolor/scalable/apps/archlinux-logo.svg
  cat /root/.local/state/weblinux/branding-v1-applied
'

sync
cleanup
trap - EXIT

echo "=== [7/7] Running e2fsck -fy & slicing 1 MiB chunks ==="
rc=0
e2fsck -fy "$IMG" || rc=$?
if [ "$rc" -gt 1 ]; then
  echo "e2fsck failed with exit code $rc" >&2
  exit "$rc"
fi

python3 - <<'PY'
import hashlib
import json
import os

IMG = "/root/branding-arch/arch-kde.ext4"
CHUNKS = "/mnt/d/weblinux-disks/arch-kde"
PUB = "/mnt/e/Web-Linux/weblinux-local/apps/web/public/disk/arch-kde"
PIECE = 1048576

SIZE = os.path.getsize(IMG)
if SIZE % PIECE != 0:
    raise RuntimeError(f"Image size {SIZE} is not a multiple of {PIECE}")
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
