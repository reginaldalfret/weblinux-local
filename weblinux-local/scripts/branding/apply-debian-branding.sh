#!/usr/bin/env bash
# Apply authentic Debian 13 (Trixie) KDE Plasma 6 branding to the WebLinux Debian rootfs:
# - Reconstructs /root/branding-debian/debian-13-firefox.ext4 if not already present
# - Mounts with qemu-riscv64-static, installs desktop-base (Ceratopsian theme + Debian logos)
#   with --no-install-recommends and preserves APT GPG signature verification
# - Configures DebianTrixieDark color scheme (#A80030 / #D70A53), Breeze icons/cursors,
#   Konsole DebianTrixie profile (BidiRenderingEnabled=false), Dolphin, Kickoff, and LookAndFeel
# - Installs idempotent first-boot/migration script /usr/local/bin/weblinux-apply-debian-branding
#   using marker ~/.local/state/weblinux/branding-v1-applied
# - Exports verified branding assets to apps/web/public/branding/debian/ and D:\weblinux-disks\branding\debian\
# - Verifies inside chroot, runs e2fsck -fy, and re-slices 1 MiB chunks + manifest.json + integrity.json
#   to both D:\weblinux-disks\debian-13-firefox and apps/web/public/disk/debian-13-firefox
set -euo pipefail

WORKDIR="${DEBIAN_BRANDING_DIR:-/root/branding-debian}"
MNT="${WORKDIR}/mnt"
IMG="${WORKDIR}/debian-13-firefox.ext4"
CHUNKS="${DEBIAN_CHUNKS_DIR:-/mnt/d/weblinux-disks/debian-13-firefox}"
PUB="${DEBIAN_PUBLIC_DIR:-/mnt/e/Web-Linux/weblinux-local/apps/web/public/disk/debian-13-firefox}"
BRAND_WEB="${DEBIAN_BRAND_WEB:-/mnt/e/Web-Linux/weblinux-local/apps/web/public/branding/debian}"
BRAND_EXT="${DEBIAN_BRAND_EXT:-/mnt/d/weblinux-disks/branding/debian}"

mkdir -p "$MNT" "$BRAND_WEB" "$BRAND_EXT"

if [ ! -f "$IMG" ]; then
  echo "=== [1/6] Reconstructing debian-13-firefox.ext4 ==="
  CHUNKS="$CHUNKS" IMG="$IMG" python3 - <<'PY'
import json
import os

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
else
  echo "=== [1/6] Using existing $IMG ==="
fi

echo "=== [2/6] Mounting rootfs with qemu-riscv64-static ==="
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

echo "=== [3/6] Installing desktop-base (Ceratopsian + Debian logos) ==="
if [ ! -s "$MNT/etc/resolv.conf" ] && [ -s /etc/resolv.conf ]; then
  cp /etc/resolv.conf "$MNT/etc/resolv.conf"
fi

chroot "$MNT" /usr/bin/qemu-riscv64-static /bin/bash -c '
  set -euo pipefail
  export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
  export DEBIAN_FRONTEND=noninteractive
  if ! dpkg -s desktop-base 2>/dev/null | grep -q "Status: install ok installed"; then
    apt-get update
    apt-get install -y --no-install-recommends desktop-base
  fi
  apt-get clean
'

echo "=== [4/6] Applying Debian 13 (Trixie) KDE Plasma 6 branding ==="
mkdir -p "$MNT/usr/share/backgrounds/weblinux"
ln -sf /usr/share/desktop-base/ceratopsian-theme/wallpaper/contents/images/1920x1080.svg \
  "$MNT/usr/share/backgrounds/weblinux/debian-trixie-ceratopsian.svg"
ln -sf /usr/share/desktop-base/debian-logos/logo.svg \
  "$MNT/usr/share/backgrounds/weblinux/debian-swirl.svg"

# Export verified assets to repo and D:\weblinux-disks\branding\debian\
for dest in "$BRAND_WEB" "$BRAND_EXT"; do
  cp -f "$MNT/usr/share/desktop-base/ceratopsian-theme/wallpaper/contents/images/1920x1080.svg" \
    "$dest/ceratopsian-1920x1080.svg"
  cp -f "$MNT/usr/share/desktop-base/debian-logos/logo.svg" \
    "$dest/debian-swirl.svg"
  cp -f "$MNT/usr/share/desktop-base/debian-logos/logo-256.png" \
    "$dest/debian-swirl-256.png"
  cp -f "$MNT/usr/share/desktop-base/debian-logos/logo-64.png" \
    "$dest/debian-swirl-64.png"
  cp -f "$MNT/usr/share/icons/desktop-base/scalable/emblems/emblem-debian-symbolic.svg" \
    "$dest/debian-emblem-symbolic.svg"
  cp -f "$MNT/usr/share/desktop-base/debian-logos/logo-text-version.svg" \
    "$dest/debian-logo-text-version.svg"
done

# Generate DebianTrixieDark.colors from BreezeDark.colors with Debian Crimson/Ruby (#A80030 / #D70A53)
MNT="$MNT" python3 - <<'PY'
import os

mnt = os.environ["MNT"]
src = os.path.join(mnt, "usr/share/color-schemes/BreezeDark.colors")
dst = os.path.join(mnt, "usr/share/color-schemes/DebianTrixieDark.colors")
with open(src, "r", encoding="utf-8") as f:
    text = f.read()

# Replace Breeze blue accents with Debian Ruby (#D70A53 = 215,10,83) and Crimson (#A80030 = 168,0,48)
replacements = [
    ("61,174,233", "215,10,83"),
    ("30,87,116", "110,0,32"),
    ("29,153,243", "215,10,83"),
    ("ColorScheme=BreezeDark", "ColorScheme=DebianTrixieDark"),
    ("Name=Breeze Dark", "Name=Debian Trixie Dark"),
]
for old, new in replacements:
    text = text.replace(old, new)

with open(dst, "w", encoding="utf-8") as f:
    f.write(text)
PY

# Look-and-Feel package inheriting Breeze Dark with Debian Trixie defaults
LAF_DIR="$MNT/usr/share/plasma/look-and-feel/org.kde.debian-trixie.desktop"
mkdir -p "$LAF_DIR/contents"
cat > "$LAF_DIR/metadata.json" <<'EOF'
{
    "KPackageStructure": "Plasma/LookAndFeel",
    "KPlugin": {
        "Authors": [
            {
                "Name": "WebLinux Debian Branding"
            }
        ],
        "Category": "Global Themes",
        "Description": "Debian 13 (Trixie) Ceratopsian theme with Debian Crimson/Ruby accents",
        "Id": "org.kde.debian-trixie.desktop",
        "License": "GPL-2.0-or-later",
        "Name": "Debian Trixie"
    }
}
EOF

cat > "$LAF_DIR/contents/defaults" <<'EOF'
[kdeglobals][KDE]
widgetStyle=Breeze

[kdeglobals][General]
ColorScheme=DebianTrixieDark
AccentColor=215,10,83

[kdeglobals][Icons]
Theme=breeze-dark

[plasmarc][Theme]
name=default

[Wallpaper]
Image=DebianTheme

[kcminputrc][Mouse]
cursorTheme=breeze_cursors
cursorSize=24

[kwinrc][org.kde.kdecoration2]
library=org.kde.breeze
theme=Breeze

[KSplash]
Theme=None
EOF

# Konsole DebianTrixie profile and colorscheme
mkdir -p "$MNT/usr/share/konsole"
cat > "$MNT/usr/share/konsole/DebianTrixie.colorscheme" <<'EOF'
[Background]
Color=27,30,35

[BackgroundFaint]
Color=20,22,26

[BackgroundIntense]
Color=35,38,44

[Color0]
Color=35,38,41

[Color0Faint]
Color=49,54,59

[Color0Intense]
Color=127,140,141

[Color1]
Color=168,0,48

[Color1Faint]
Color=120,0,34

[Color1Intense]
Color=215,10,83

[Color2]
Color=28,220,154

[Color2Faint]
Color=23,168,118

[Color2Intense]
Color=61,235,176

[Color3]
Color=246,116,0

[Color3Faint]
Color=181,85,0

[Color3Intense]
Color=253,188,75

[Color4]
Color=29,153,243

[Color4Faint]
Color=21,110,176

[Color4Intense]
Color=61,174,233

[Color5]
Color=155,89,182

[Color5Faint]
Color=112,64,132

[Color5Intense]
Color=215,10,83

[Color6]
Color=26,188,156

[Color6Faint]
Color=19,138,114

[Color6Intense]
Color=61,222,191

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
Description=Debian Trixie
Opacity=1
EOF

cat > "$MNT/usr/share/konsole/DebianTrixie.profile" <<'EOF'
[General]
Name=Debian Trixie
Parent=FALLBACK/

[Appearance]
ColorScheme=DebianTrixie

[Terminal Features]
BidiRenderingEnabled=false
EOF

# System-wide /etc/xdg defaults
cat > "$MNT/etc/xdg/konsolerc" <<'EOF'
[Desktop Entry]
DefaultProfile=DebianTrixie.profile
EOF

cat > "$MNT/etc/xdg/kdeglobals" <<'EOF'
[General]
ColorScheme=DebianTrixieDark
AccentColor=215,10,83
Name=Debian Trixie Dark

[Icons]
Theme=breeze-dark

[KDE]
LookAndFeelPackage=org.kde.debian-trixie.desktop
widgetStyle=Breeze
EOF

cat > "$MNT/etc/xdg/kcminputrc" <<'EOF'
[Mouse]
cursorTheme=breeze_cursors
cursorSize=24
EOF

cat > "$MNT/etc/xdg/dolphinrc" <<'EOF'
[General]
ShowFullPath=true
EOF

cat > "$MNT/etc/xdg/kcm-about-distrorc" <<'EOF'
[General]
LogoPath=emblem-debian
Version=13 (Trixie)
Website=https://www.debian.org/
EOF

cat > "$MNT/etc/xdg/kickoffrc" <<'EOF'
[Branding]
Homepage=https://www.debian.org/
EOF

# Idempotent first-boot / migration script
cat > "$MNT/usr/local/bin/weblinux-apply-debian-branding" <<'EOF'
#!/usr/bin/env bash
# Idempotent first-boot / migration branding for Debian 13 (Trixie) KDE Plasma 6.
# Preserves existing user configs (backs them up before updating) and never deletes user files.
set -euo pipefail

STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/weblinux"
MARKER="${STATE_DIR}/branding-v1-applied"
[ -f "$MARKER" ] && exit 0

CFG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}"
BACKUP_DIR="${STATE_DIR}/backup-pre-branding-v1"
mkdir -p "$STATE_DIR" "$CFG_DIR" "$BACKUP_DIR"

for f in kdeglobals kcminputrc konsolerc dolphinrc kwinrc plasmarc kcm-about-distrorc kickoffrc plasma-org.kde.plasma.desktop-appletsrc; do
  if [ -f "${CFG_DIR}/${f}" ] && [ ! -f "${BACKUP_DIR}/${f}" ]; then
    cp -a "${CFG_DIR}/${f}" "${BACKUP_DIR}/${f}"
  fi
done

if command -v kwriteconfig6 >/dev/null 2>&1; then
  kwriteconfig6 --file kdeglobals --group General --key ColorScheme DebianTrixieDark
  kwriteconfig6 --file kdeglobals --group General --key AccentColor "215,10,83"
  kwriteconfig6 --file kdeglobals --group General --key Name "Debian Trixie Dark"
  kwriteconfig6 --file kdeglobals --group KDE --key LookAndFeelPackage org.kde.debian-trixie.desktop
  kwriteconfig6 --file kdeglobals --group KDE --key widgetStyle Breeze
  kwriteconfig6 --file kdeglobals --group Icons --key Theme breeze-dark

  kwriteconfig6 --file kcminputrc --group Mouse --key cursorTheme breeze_cursors
  kwriteconfig6 --file kcminputrc --group Mouse --key cursorSize 24

  kwriteconfig6 --file konsolerc --group "Desktop Entry" --key DefaultProfile DebianTrixie.profile
  kwriteconfig6 --file dolphinrc --group General --key ShowFullPath true
  kwriteconfig6 --file kcm-about-distrorc --group General --key LogoPath emblem-debian
  kwriteconfig6 --file kcm-about-distrorc --group General --key Version "13 (Trixie)"
  kwriteconfig6 --file kcm-about-distrorc --group General --key Website "https://www.debian.org/"
  kwriteconfig6 --file kickoffrc --group Branding --key Homepage "https://www.debian.org/"
fi

# Update existing Plasma appletsrc wallpaper & Kickoff icon if present
APPLETS="${CFG_DIR}/plasma-org.kde.plasma.desktop-appletsrc"
if [ -f "$APPLETS" ] && command -v python3 >/dev/null 2>&1; then
  APPLETS="$APPLETS" python3 - <<'PY'
import os, re
p = os.environ["APPLETS"]
with open(p, "r", encoding="utf-8") as f:
    s = f.read()
s = re.sub(r"(?m)^Image=.*$", "Image=file:///usr/share/wallpapers/DebianTheme", s)
with open(p, "w", encoding="utf-8") as f:
    f.write(s)
PY
fi

printf 'applied_at=%s\ndistro=debian-13-trixie\nversion=1\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$MARKER"
EOF
chmod 0755 "$MNT/usr/local/bin/weblinux-apply-debian-branding"

# Hook into /usr/local/bin/desktop kde_environment() idempotently
MNT="$MNT" python3 - <<'PY'
import os
p = os.path.join(os.environ["MNT"], "usr/local/bin/desktop")
with open(p, "r", encoding="utf-8") as f:
    s = f.read()
hook = '[ -x /usr/local/bin/weblinux-apply-debian-branding ] && /usr/local/bin/weblinux-apply-debian-branding || true'
if hook not in s:
    target = "kde_environment() {\n"
    assert target in s, "kde_environment() not found in /usr/local/bin/desktop"
    s = s.replace(target, target + "\t" + hook + "\n", 1)
    with open(p, "w", encoding="utf-8") as f:
        f.write(s)
PY

# Also add KDE autostart entry (phase 0) for direct Plasma launches
cat > "$MNT/etc/xdg/autostart/weblinux-debian-branding.desktop" <<'EOF'
[Desktop Entry]
Type=Application
Name=WebLinux Debian Trixie Branding
Exec=/usr/local/bin/weblinux-apply-debian-branding
OnlyShowIn=KDE;
X-KDE-autostart-phase=0
NoDisplay=true
EOF

# Clean interactive-only Debian shell prompt (never affects non-interactive scripts)
cat > "$MNT/etc/profile.d/weblinux-debian-prompt.sh" <<'EOF'
case "$-" in
  *i*)
    if [ -n "${PS1-}" ]; then
      if [ "$(id -u)" -eq 0 ]; then
        PS1='\[\033[1;38;5;161m\][debian]\[\033[0m\] \[\033[1;31m\]\u@\h\[\033[0m\]:\[\033[1;36m\]\w\[\033[0m\]# '
      else
        PS1='\[\033[1;38;5;161m\][debian]\[\033[0m\] \[\033[1;32m\]\u@\h\[\033[0m\]:\[\033[1;36m\]\w\[\033[0m\]\$ '
      fi
    fi
    ;;
esac
EOF

# Seed /root and /etc/skel via the idempotent script inside chroot
echo "=== [5/6] Verifying inside chroot ==="
chroot "$MNT" /usr/bin/qemu-riscv64-static /bin/bash -c '
  set -euo pipefail
  export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
  export LC_ALL=C.UTF-8
  export HOME=/root
  /usr/local/bin/weblinux-apply-debian-branding

  test -f /root/.local/state/weblinux/branding-v1-applied
  test -e /usr/share/wallpapers/DebianTheme/contents/images/1920x1080.svg
  test -e /usr/share/backgrounds/weblinux/debian-trixie-ceratopsian.svg
  test -e /usr/share/backgrounds/weblinux/debian-swirl.svg
  test -f /usr/share/color-schemes/DebianTrixieDark.colors
  test -f /usr/share/konsole/DebianTrixie.profile
  test -f /usr/share/konsole/DebianTrixie.colorscheme
  test -f /usr/share/plasma/look-and-feel/org.kde.debian-trixie.desktop/contents/defaults

  echo "--- os-release ---"
  cat /etc/os-release
  echo "--- Plasma / KDE versions ---"
  dpkg -l plasma-desktop plasma-workspace kwin-x11 breeze kf6-breeze-icon-theme konsole dolphin desktop-base | grep "^ii"
  echo "--- Browser check (must be empty) ---"
  dpkg -l firefox-esr chromium epiphany-browser netsurf-gtk 2>/dev/null | grep "^ii" || echo "NO_BROWSERS_INSTALLED"
  echo "--- kreadconfig6 checks ---"
  kreadconfig6 --file kdeglobals --group General --key ColorScheme
  kreadconfig6 --file kdeglobals --group Icons --key Theme
  kreadconfig6 --file kcminputrc --group Mouse --key cursorTheme
  kreadconfig6 --file konsolerc --group "Desktop Entry" --key DefaultProfile
  echo "--- marker ---"
  cat /root/.local/state/weblinux/branding-v1-applied
'

umount "$MNT/dev" "$MNT/sys" "$MNT/proc"
rm -f "$MNT/usr/bin/qemu-riscv64-static"
umount "$MNT"
trap - EXIT

echo "=== [6/6] Running e2fsck and re-slicing 1 MiB chunks ==="
e2fsck -fy "$IMG"
sync
echo 3 > /proc/sys/vm/drop_caches 2>/dev/null || true

IMG="$IMG" CHUNKS="$CHUNKS" PUB="$PUB" python3 - <<'PY'
import hashlib
import json
import os
import shutil

img_path = os.environ["IMG"]
chunks_dir = os.environ["CHUNKS"]
pub_dir = os.environ["PUB"]
size = os.path.getsize(img_path)
piece = 1048576
total = size // piece

os.makedirs(chunks_dir, exist_ok=True)
os.makedirs(pub_dir, exist_ok=True)

for d in (chunks_dir, pub_dir):
    for fname in os.listdir(d):
        if len(fname) == 6 and fname.isdigit():
            os.remove(os.path.join(d, fname))

hashes = []
nonzero = 0
zero_chunk = b"\x00" * piece
full_h = hashlib.sha256()

def drop_caches():
    try:
        with open("/proc/sys/vm/drop_caches", "w") as dc:
            dc.write("3\n")
    except OSError:
        pass

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
            if nonzero % 1000 == 0:
                drop_caches()

drop_caches()

for i, h in enumerate(hashes):
    if h:
        shutil.copyfile(os.path.join(chunks_dir, f"{i:06d}"), os.path.join(pub_dir, f"{i:06d}"))
        if i % 1000 == 0:
            drop_caches()

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
