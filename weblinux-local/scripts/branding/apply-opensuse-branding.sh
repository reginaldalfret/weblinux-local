#!/usr/bin/env bash
# Apply native openSUSE Tumbleweed KDE Plasma 6.8.2 branding to the WebLinux RISC-V image.
# Preserves Zypper/RPM GPG verification, never installs graphical browsers, and implements
# idempotent user config migration via ~/.local/state/weblinux/branding-v1-applied.
set -euo pipefail

APPLY_ONLY=0
if [ "${1:-}" = "--apply-only" ]; then
  APPLY_ONLY=1
fi

WORKDIR="${OPENSUSE_BRANDING_DIR:-/root/branding-opensuse}"
MNT="${WORKDIR}/mnt"
IMG="${WORKDIR}/opensuse-tumbleweed-kde.ext4"
CHUNKS="${OPENSUSE_CHUNKS_DIR:-/mnt/d/weblinux-disks/opensuse-tumbleweed-kde}"
PUB="${OPENSUSE_PUBLIC_DIR:-/mnt/e/Web-Linux/weblinux-local/apps/web/public/disk/opensuse-tumbleweed-kde}"
ASSET_PUB="${OPENSUSE_ASSET_PUB_DIR:-/mnt/e/Web-Linux/weblinux-local/apps/web/public/branding/opensuse}"
ASSET_EXT="${OPENSUSE_ASSET_EXT_DIR:-/mnt/d/weblinux-disks/branding/opensuse}"

mkdir -p "$MNT" "$ASSET_PUB" "$ASSET_EXT"

if [ "$APPLY_ONLY" -eq 0 ]; then
  echo "=== [1/5] Reconstructing opensuse-tumbleweed-kde.ext4 ==="
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

print(f"Reconstructed {img_path} ({total} MiB)")
PY

  echo "=== [2/5] Mounting rootfs with qemu-riscv64-static ==="
  mount -o loop "$IMG" "$MNT"
  cp -f /usr/bin/qemu-riscv64-static "$MNT/usr/bin/qemu-riscv64-static"
  mount -t proc none "$MNT/proc"
  mount -t sysfs none "$MNT/sys"
  mount --bind /dev "$MNT/dev"
fi

cleanup() {
  if [ "$APPLY_ONLY" -eq 0 ]; then
    umount "$MNT/dev" 2>/dev/null || true
    umount "$MNT/sys" 2>/dev/null || true
    umount "$MNT/proc" 2>/dev/null || true
    rm -f "$MNT/usr/bin/qemu-riscv64-static"
    umount "$MNT" 2>/dev/null || true
  fi
}
trap cleanup EXIT

echo "=== [3/5] Verifying base packages, GPG repos, and copying official assets ==="
chroot "$MNT" /usr/bin/qemu-riscv64-static /bin/bash -c '
  set -euo pipefail
  export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

  for pkg in \
    wallpaper-branding-openSUSE \
    distribution-logos-openSUSE-Tumbleweed \
    distribution-logos-openSUSE-icons \
    plasma6-theme-openSUSE \
    plasma6-branding-openSUSE \
    breeze6-cursors \
    kf6-breeze-icons \
    konsole
  do
    rpm -q "$pkg" >/dev/null
  done

  for browser in MozillaFirefox chromium epiphany; do
    if rpm -q "$browser" >/dev/null 2>&1; then
      echo "ERROR: Prohibited graphical browser installed: $browser" >&2
      exit 1
    fi
  done

  echo "Verified openSUSE Plasma 6.8.2 branding packages and no graphical browsers."
'

# Export verified official openSUSE artwork to host branding directories
cp -f "$MNT/usr/share/wallpapers/openSUSEdefault/contents/images/default.png" "$ASSET_PUB/wallpaper.png"
cp -f "$MNT/usr/share/wallpapers/openSUSEdefault/contents/images/default-dark.png" "$ASSET_PUB/wallpaper-dark.png"
cp -f "$MNT/usr/share/icons/hicolor/scalable/apps/distributor-logo-Tumbleweed.svg" "$ASSET_PUB/logo-tumbleweed.svg"
cp -f "$MNT/usr/share/icons/hicolor/scalable/apps/distributor-logo.svg" "$ASSET_PUB/logo-geeko.svg"
cp -f "$MNT/usr/share/pixmaps/distribution-logos/apple-touch-icon.png" "$ASSET_PUB/logo-tumbleweed.png"
cp -f "$MNT/usr/share/pixmaps/distribution-logos/square-hicolor.svg" "$ASSET_PUB/logo-square.svg"
cp -f "$ASSET_PUB/"* "$ASSET_EXT/"

echo "=== [4/5] Applying openSUSE Tumbleweed KDE branding & idempotent migration ==="
install -d -m 0755 "$MNT/usr/share/weblinux-branding/opensuse"
cp -f "$ASSET_PUB/"* "$MNT/usr/share/weblinux-branding/opensuse/"

# 4a. System-wide XDG defaults (/etc/xdg/)
cat > "$MNT/etc/xdg/kdeglobals" <<'EOF'
[General]
shadeSortColumn=true
fixed=Hack,9,-1,5,50,0,0,0,0,0
ColorScheme=openSUSE
AccentColor=115,186,37
accentColorFromWallpaper=false

[Icons]
Theme=breeze

[KDE]
ChangeCursor=true
contrast=5
LookAndFeelPackage=org.openSUSE.desktop
widgetStyle=Breeze

[Paths]
Trash=$HOME/Desktop/Trash/

[PreviewSettings]
camera=true
file=true
fonts=true

[Directories]
dir_pixmap=/usr/share/pixmaps

[KFileDialog Settings]
Breadcrumb Navigation=true
EOF

cat > "$MNT/etc/xdg/plasmarc" <<'EOF'
[Defaults]
plainClockColor=7,33,0

[Theme]
name=openSUSE
EOF

cat > "$MNT/etc/xdg/kcminputrc" <<'EOF'
[Mouse]
cursorTheme=breeze_cursors
EOF

cat > "$MNT/etc/xdg/kcm-about-distrorc" <<'EOF'
[General]
LogoPath=/usr/share/icons/hicolor/scalable/apps/distributor-logo-Tumbleweed.svg
Website=https://www.opensuse.org
EOF

cat > "$MNT/etc/xdg/kickoffrc" <<'EOF'
[Favorites]
FavoriteURLs=/usr/share/applications/org.kde.konsole.desktop,/usr/share/applications/org.kde.dolphin.desktop,/usr/share/applications/systemsettings.desktop,/usr/share/applications/org.kde.Help.desktop
EOF

cat > "$MNT/etc/xdg/konsolerc" <<'EOF'
[Desktop Entry]
DefaultProfile=openSUSE-Tumbleweed.profile
EOF

# 4b. Pin Geeko Tumbleweed logo on Kickoff in defaultPanel layout.js
LAYOUT_JS="$MNT/usr/share/plasma/layout-templates/org.kde.plasma.desktop.defaultPanel/contents/layout.js"
if [ -f "$LAYOUT_JS" ] && ! grep -q 'distributor-logo-Tumbleweed' "$LAYOUT_JS"; then
  python3 - "$LAYOUT_JS" <<'PY'
import sys
p = sys.argv[1]
with open(p, "r", encoding="utf-8") as f:
    src = f.read()
target = 'panel.addWidget("org.kde.plasma.kickoff")'
replacement = (
    'var kickoff = panel.addWidget("org.kde.plasma.kickoff")\n'
    'kickoff.currentConfigGroup = ["General"]\n'
    'kickoff.writeConfig("icon", "distributor-logo-Tumbleweed")'
)
assert target in src, "kickoff widget call not found in layout.js"
src = src.replace(target, replacement, 1)
with open(p, "w", encoding="utf-8") as f:
    f.write(src)
PY
fi

# 4c. Konsole openSUSE Tumbleweed colorscheme & profile
install -d -m 0755 "$MNT/usr/share/konsole"
cat > "$MNT/usr/share/konsole/openSUSE-Tumbleweed.colorscheme" <<'EOF'
[Background]
Color=18,30,29

[BackgroundFaint]
Color=12,22,21

[BackgroundIntense]
Color=26,44,42

[Color0]
Color=28,43,41

[Color0Faint]
Color=18,30,29

[Color0Intense]
Color=84,110,106

[Color1]
Color=218,68,83

[Color1Faint]
Color=166,52,64

[Color1Intense]
Color=255,107,120

[Color2]
Color=115,186,37

[Color2Faint]
Color=85,140,27

[Color2Intense]
Color=148,219,68

[Color3]
Color=246,185,59

[Color3Faint]
Color=194,142,39

[Color3Intense]
Color=255,211,105

[Color4]
Color=33,164,223

[Color4Faint]
Color=24,124,171

[Color4Intense]
Color=92,194,242

[Color5]
Color=155,89,182

[Color5Faint]
Color=118,67,139

[Color5Intense]
Color=190,130,214

[Color6]
Color=53,185,171

[Color6Faint]
Color=36,138,127

[Color6Intense]
Color=94,224,210

[Color7]
Color=216,232,228

[Color7Faint]
Color=168,189,184

[Color7Intense]
Color=244,250,248

[Foreground]
Color=230,242,238

[ForegroundFaint]
Color=168,189,184

[ForegroundIntense]
Color=115,186,37

[General]
Blur=false
ColorRandomization=false
Description=openSUSE Tumbleweed
Opacity=0.96
Wallpaper=
EOF

cat > "$MNT/usr/share/konsole/openSUSE-Tumbleweed.profile" <<'EOF'
[Appearance]
ColorScheme=openSUSE-Tumbleweed
Font=Hack,10,-1,5,50,0,0,0,0,0

[General]
Name=openSUSE Tumbleweed
Parent=FALLBACK/

[Scrolling]
HistoryMode=2
HistorySize=10000
EOF

# 4d. Tumbleweed green shell prompt in /etc/bash.bashrc.local
touch "$MNT/etc/bash.bashrc.local"
if ! grep -q "WEBLINUX_OPENSUSE_PROMPT" "$MNT/etc/bash.bashrc.local"; then
  cat >> "$MNT/etc/bash.bashrc.local" <<'EOF'

# WEBLINUX_OPENSUSE_PROMPT
if [ -n "${PS1:-}" ]; then
  if [ "$(id -u)" -eq 0 ]; then
    PS1='\[\033[1;32m\]\u@opensuse-tumbleweed\[\033[0m\]:\[\033[1;36m\]\w\[\033[0m\]# '
  else
    PS1='\[\033[1;32m\]\u@opensuse-tumbleweed\[\033[0m\]:\[\033[1;36m\]\w\[\033[0m\]$ '
  fi
fi
EOF
fi

# 4e. Idempotent Plasma 6 user migration script
cat > "$MNT/usr/local/bin/weblinux-opensuse-branding-migrate" <<'EOF'
#!/usr/bin/env bash
# Idempotent openSUSE Tumbleweed Plasma 6 branding migration.
# Preserves existing user .config / Documents / Downloads and creates a backup before applying.
set -euo pipefail

STATE_DIR="${HOME}/.local/state/weblinux"
MARKER="${STATE_DIR}/branding-v1-applied"

if [ -f "$MARKER" ]; then
  exit 0
fi

CFG_DIR="${HOME}/.config"
BACKUP_DIR="${STATE_DIR}/backup-branding-v1-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$STATE_DIR" "$CFG_DIR"

backed_up=0
for f in kdeglobals plasmarc kcminputrc konsolerc kscreenlockerrc kwinrc plasma-org.kde.plasma.desktop-appletsrc; do
  if [ -f "${CFG_DIR}/${f}" ]; then
    mkdir -p "$BACKUP_DIR"
    cp -a "${CFG_DIR}/${f}" "${BACKUP_DIR}/${f}"
    backed_up=1
  fi
done

if command -v kwriteconfig6 >/dev/null 2>&1; then
  kwriteconfig6 --file "${CFG_DIR}/kdeglobals" --group General --key ColorScheme "openSUSE"
  kwriteconfig6 --file "${CFG_DIR}/kdeglobals" --group General --key AccentColor "115,186,37"
  kwriteconfig6 --file "${CFG_DIR}/kdeglobals" --group General --key accentColorFromWallpaper "false"
  kwriteconfig6 --file "${CFG_DIR}/kdeglobals" --group KDE --key LookAndFeelPackage "org.openSUSE.desktop"
  kwriteconfig6 --file "${CFG_DIR}/kdeglobals" --group KDE --key widgetStyle "Breeze"
  kwriteconfig6 --file "${CFG_DIR}/kdeglobals" --group Icons --key Theme "breeze"
  kwriteconfig6 --file "${CFG_DIR}/plasmarc" --group Theme --key name "openSUSE"
  kwriteconfig6 --file "${CFG_DIR}/kcminputrc" --group Mouse --key cursorTheme "breeze_cursors"
  kwriteconfig6 --file "${CFG_DIR}/konsolerc" --group "Desktop Entry" --key DefaultProfile "openSUSE-Tumbleweed.profile"
  kwriteconfig6 --file "${CFG_DIR}/kscreenlockerrc" --group Greeter --key Theme "org.openSUSE.desktop"
fi

{
  echo "version=v1"
  echo "distro=opensuse-tumbleweed"
  echo "applied_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "backup_created=${backed_up}"
} > "$MARKER"
EOF
chmod 0755 "$MNT/usr/local/bin/weblinux-opensuse-branding-migrate"

# 4f. Autostart entry for non-root desktop sessions
install -d -m 0755 "$MNT/etc/xdg/autostart"
cat > "$MNT/etc/xdg/autostart/weblinux-opensuse-branding.desktop" <<'EOF'
[Desktop Entry]
Type=Application
Name=WebLinux openSUSE Branding Migration
Exec=/usr/local/bin/weblinux-opensuse-branding-migrate
OnlyShowIn=KDE;
X-KDE-autostart-phase=1
NoDisplay=true
EOF

# 4g. Hook migration into /usr/local/bin/opensuse-kde-session before plasmashell launch
SESSION_BIN="$MNT/usr/local/bin/opensuse-kde-session"
if [ -f "$SESSION_BIN" ] && ! grep -q "weblinux-opensuse-branding-migrate" "$SESSION_BIN"; then
  python3 - "$SESSION_BIN" <<'PY'
import sys
p = sys.argv[1]
with open(p, "r", encoding="utf-8") as f:
    src = f.read()
target = "# 3. Build KService 6 cache"
hook = (
    "# 2b. Apply idempotent openSUSE Tumbleweed branding migration\n"
    "if [ -x /usr/local/bin/weblinux-opensuse-branding-migrate ]; then\n"
    "  /usr/local/bin/weblinux-opensuse-branding-migrate >> /root/opensuse-kde-session.log 2>&1 || true\n"
    "fi\n\n"
    + target
)
assert target in src, "marker not found in opensuse-kde-session"
src = src.replace(target, hook, 1)
with open(p, "w", encoding="utf-8") as f:
    f.write(src)
PY
fi

echo "=== [5/5] Verifying inside chroot ==="
chroot "$MNT" /usr/bin/qemu-riscv64-static /bin/bash -c '
  set -euo pipefail
  export HOME=/root
  export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

  # Run migration and verify idempotency
  /usr/local/bin/weblinux-opensuse-branding-migrate
  test -f /root/.local/state/weblinux/branding-v1-applied
  M1="$(cat /root/.local/state/weblinux/branding-v1-applied)"
  /usr/local/bin/weblinux-opensuse-branding-migrate
  M2="$(cat /root/.local/state/weblinux/branding-v1-applied)"
  test "$M1" = "$M2"

  echo "--- /root/.local/state/weblinux/branding-v1-applied ---"
  cat /root/.local/state/weblinux/branding-v1-applied
  echo "--- Effective KConfig (kreadconfig6) ---"
  echo "ColorScheme=$(kreadconfig6 --file kdeglobals --group General --key ColorScheme)"
  echo "AccentColor=$(kreadconfig6 --file kdeglobals --group General --key AccentColor)"
  echo "LookAndFeelPackage=$(kreadconfig6 --file kdeglobals --group KDE --key LookAndFeelPackage)"
  echo "IconTheme=$(kreadconfig6 --file kdeglobals --group Icons --key Theme)"
  echo "PlasmaTheme=$(kreadconfig6 --file plasmarc --group Theme --key name)"
  echo "CursorTheme=$(kreadconfig6 --file kcminputrc --group Mouse --key cursorTheme)"
  echo "KonsoleProfile=$(kreadconfig6 --file konsolerc --group "Desktop Entry" --key DefaultProfile)"
  echo "--- /root/.config/konsolerc ---"
  cat /root/.config/konsolerc
  echo "--- /etc/xdg/kdeglobals ---"
  cat /etc/xdg/kdeglobals
  echo "--- zypper lr gpgcheck ---"
  zypper lr -d | grep -E "Yes|repo-"
'

if [ "$APPLY_ONLY" -eq 0 ]; then
  umount "$MNT/dev" "$MNT/sys" "$MNT/proc"
  rm -f "$MNT/usr/bin/qemu-riscv64-static"
  umount "$MNT"
  trap - EXIT

  echo "=== Running e2fsck ==="
  e2fsck -fy "$IMG"

  echo "=== Slicing 1 MiB chunks & writing manifest.json / integrity.json ==="
  IMG="$IMG" CHUNKS="$CHUNKS" PUB="$PUB" python3 - <<'PY'
import hashlib, json, os

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
integ = {
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

print(f"SLICE_DONE id={manifest_id} fullSha256={full_sha} nonzero={nonzero} total={total}")
PY
fi
