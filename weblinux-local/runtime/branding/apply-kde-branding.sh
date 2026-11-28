#!/bin/sh
# WebLinux Phase 16 — Shared KDE Branding Engine Helper (POSIX sh)
# Supports KDE Plasma 5.27 (Ubuntu 24.04.5) and KDE Plasma 6.x
# (Debian 13, Arch, openSUSE Tumbleweed, Fedora 45, Alpine 3.24.4).
#
# Idempotent: respects ~/.local/state/weblinux/branding-v1-applied,
# backs up existing ~/.config files before modifying, and supports --restore.

set -eu

PROFILE_ARG=""
TARGET_HOME="${HOME:-/root}"
PLASMA_MAJOR_OVERRIDE=""
FORCE=0
RESTORE=0
DRY_RUN=0
STATUS_ONLY=0

usage() {
  cat <<'EOF'
Usage: apply-kde-branding.sh [OPTIONS]

Options:
  --profile <id>          Distribution branding ID or alias:
                            debian-kde (alias: debian-firefox)
                            ubuntu-kde (alias: ubuntu-kde-epiphany)
                            arch-kde
                            opensuse-tumbleweed-kde
                            fedora-kde
                            alpine-kde
  --home <dir>            Target home directory (default: $HOME)
  --plasma-major <5|6>    Override Plasma major version (5 or 6)
  --force                 Re-apply even if branding-v1-applied marker exists
  --restore               Restore latest backed-up KDE config and clear marker
  --status                Show current branding migration status
  --dry-run               Print actions without modifying files
  -h, --help              Show this help message
EOF
}

log_info() {
  printf '[weblinux-branding] %s\n' "$1"
}

log_err() {
  printf '[weblinux-branding] ERROR: %s\n' "$1" >&2
}

while [ $# -gt 0 ]; do
  case "$1" in
    --profile)
      [ $# -ge 2 ] || { log_err "--profile requires an argument"; exit 1; }
      PROFILE_ARG="$2"
      shift 2
      ;;
    --home)
      [ $# -ge 2 ] || { log_err "--home requires an argument"; exit 1; }
      TARGET_HOME="$2"
      shift 2
      ;;
    --plasma-major)
      [ $# -ge 2 ] || { log_err "--plasma-major requires 5 or 6"; exit 1; }
      PLASMA_MAJOR_OVERRIDE="$2"
      shift 2
      ;;
    --force)
      FORCE=1
      shift
      ;;
    --restore)
      RESTORE=1
      shift
      ;;
    --status)
      STATUS_ONLY=1
      shift
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      log_err "Unknown option: $1"
      usage >&2
      exit 1
      ;;
  esac
done

STATE_DIR="$TARGET_HOME/.local/state/weblinux"
MARKER_FILE="$STATE_DIR/branding-v1-applied"
BACKUP_BASE="$STATE_DIR/backups"
LATEST_PTR="$BACKUP_BASE/latest-branding-v1"
CONFIG_DIR="$TARGET_HOME/.config"
KONSOLE_DIR="$TARGET_HOME/.local/share/konsole"

if [ "$STATUS_ONLY" -eq 1 ]; then
  if [ -f "$MARKER_FILE" ]; then
    log_info "Applied: $MARKER_FILE"
    cat "$MARKER_FILE"
  else
    log_info "Not applied (marker absent: $MARKER_FILE)"
  fi
  exit 0
fi

if [ "$RESTORE" -eq 1 ]; then
  if [ ! -f "$LATEST_PTR" ]; then
    log_err "No backup pointer found at $LATEST_PTR"
    exit 1
  fi
  BACKUP_DIR=$(cat "$LATEST_PTR")
  if [ ! -d "$BACKUP_DIR" ]; then
    log_err "Backup directory does not exist: $BACKUP_DIR"
    exit 1
  fi
  log_info "Restoring KDE configuration from $BACKUP_DIR -> $CONFIG_DIR"
  for f in kdeglobals kcminputrc kwinrc plasmarc ksplashrc kscreenlockerrc konsolerc plasma-org.kde.plasma.desktop-appletsrc; do
    if [ -f "$BACKUP_DIR/$f" ]; then
      if [ "$DRY_RUN" -eq 1 ]; then
        log_info "[dry-run] cp -p $BACKUP_DIR/$f $CONFIG_DIR/$f"
      else
        mkdir -p "$CONFIG_DIR"
        cp -p "$BACKUP_DIR/$f" "$CONFIG_DIR/$f"
      fi
    fi
  done
  if [ "$DRY_RUN" -eq 1 ]; then
    log_info "[dry-run] rm -f $MARKER_FILE"
  else
    rm -f "$MARKER_FILE"
  fi
  log_info "Restore complete."
  exit 0
fi

if [ -z "$PROFILE_ARG" ]; then
  log_err "--profile is required unless --status or --restore is used."
  usage >&2
  exit 1
fi

# Resolve aliases without altering OPFS disk IDs
CANONICAL_PROFILE=""
case "$PROFILE_ARG" in
  debian-kde|debian-firefox)
    CANONICAL_PROFILE="debian-kde"
    ;;
  ubuntu-kde|ubuntu-kde-epiphany)
    CANONICAL_PROFILE="ubuntu-kde"
    ;;
  arch-kde)
    CANONICAL_PROFILE="arch-kde"
    ;;
  opensuse-tumbleweed-kde)
    CANONICAL_PROFILE="opensuse-tumbleweed-kde"
    ;;
  fedora-kde)
    CANONICAL_PROFILE="fedora-kde"
    ;;
  alpine-kde)
    CANONICAL_PROFILE="alpine-kde"
    ;;
  *)
    log_err "Unsupported profile or alias: $PROFILE_ARG"
    exit 1
    ;;
esac

if [ -f "$MARKER_FILE" ] && [ "$FORCE" -eq 0 ]; then
  log_info "Branding already applied ($MARKER_FILE exists). Use --force to re-apply."
  exit 0
fi

# Profile metadata defaults
PLASMA_MAJOR=6
WALLPAPER_PATH=""
FALLBACK_COLOR="#1d1f21"
LOOK_AND_FEEL="org.kde.breezedark.desktop"
COLOR_SCHEME="BreezeDark"
ICON_THEME="breeze-dark"
CURSOR_THEME="breeze_cursors"
CURSOR_SIZE="24"
PLASMA_THEME="breeze-dark"
FONT_GENERAL="Noto Sans,10,-1,5,400,0,0,0,0,0"
FONT_FIXED="Noto Sans Mono,10,-1,5,400,0,0,0,0,0"
TERMINAL_PROFILE="WebLinux"
LAUNCHER_ICON="start-here-kde"
LAUNCHER_TITLE="Applications"
LOCKSCREEN_SUPPORTED=1
SPLASH_SUPPORTED=1

case "$CANONICAL_PROFILE" in
  debian-kde)
    PLASMA_MAJOR=6
    WALLPAPER_PATH="/usr/share/wallpapers/WebLinux-Debian/contents/images/1920x1080.png"
    FALLBACK_COLOR="#a80030"
    TERMINAL_PROFILE="Debian-WebLinux"
    LAUNCHER_ICON="distributor-logo-debian"
    LAUNCHER_TITLE="Debian 13"
    ;;
  ubuntu-kde)
    PLASMA_MAJOR=5
    WALLPAPER_PATH="/usr/share/wallpapers/WebLinux-Ubuntu/contents/images/1920x1080.png"
    FALLBACK_COLOR="#77216f"
    FONT_GENERAL="Ubuntu,10,-1,5,50,0,0,0,0,0"
    FONT_FIXED="Ubuntu Mono,11,-1,5,50,0,0,0,0,0"
    TERMINAL_PROFILE="Ubuntu-WebLinux"
    LAUNCHER_ICON="distributor-logo-ubuntu"
    LAUNCHER_TITLE="Ubuntu 24.04"
    ;;
  arch-kde)
    PLASMA_MAJOR=6
    WALLPAPER_PATH="/usr/share/wallpapers/WebLinux-Arch/contents/images/1920x1080.png"
    FALLBACK_COLOR="#1793d1"
    TERMINAL_PROFILE="Arch-WebLinux"
    LAUNCHER_ICON="distributor-logo-archlinux"
    LAUNCHER_TITLE="Arch Linux"
    ;;
  opensuse-tumbleweed-kde)
    PLASMA_MAJOR=6
    WALLPAPER_PATH="/usr/share/wallpapers/WebLinux-openSUSE/contents/images/1920x1080.png"
    FALLBACK_COLOR="#173f4f"
    LOOK_AND_FEEL="org.openSUSE.desktop"
    TERMINAL_PROFILE="openSUSE-WebLinux"
    LAUNCHER_ICON="distributor-logo-opensuse"
    LAUNCHER_TITLE="Tumbleweed"
    ;;
  fedora-kde)
    PLASMA_MAJOR=6
    WALLPAPER_PATH="/usr/share/wallpapers/WebLinux-Fedora/contents/images/1920x1080.png"
    FALLBACK_COLOR="#294172"
    LOOK_AND_FEEL="org.fedoraproject.fedora.desktop"
    TERMINAL_PROFILE="Fedora-WebLinux"
    LAUNCHER_ICON="distributor-logo-fedora"
    LAUNCHER_TITLE="Fedora 45"
    ;;
  alpine-kde)
    PLASMA_MAJOR=6
    WALLPAPER_PATH="/usr/share/wallpapers/WebLinux-Alpine/contents/images/1920x1080.png"
    FALLBACK_COLOR="#0d597f"
    FONT_GENERAL="DejaVu Sans,10,-1,5,400,0,0,0,0,0"
    FONT_FIXED="DejaVu Sans Mono,10,-1,5,400,0,0,0,0,0"
    TERMINAL_PROFILE="Alpine-WebLinux"
    LAUNCHER_ICON="distributor-logo-alpine"
    LAUNCHER_TITLE="Alpine 3.24"
    LOCKSCREEN_SUPPORTED=0
    ;;
esac

if [ -n "$PLASMA_MAJOR_OVERRIDE" ]; then
  case "$PLASMA_MAJOR_OVERRIDE" in
    5|6) PLASMA_MAJOR="$PLASMA_MAJOR_OVERRIDE" ;;
    *) log_err "Invalid --plasma-major value: $PLASMA_MAJOR_OVERRIDE"; exit 1 ;;
  esac
fi

KWRITE_TOOL="kwriteconfig6"
if [ "$PLASMA_MAJOR" -eq 5 ]; then
  KWRITE_TOOL="kwriteconfig5"
fi

# Portable INI setter: uses kwriteconfig5/6 if present, otherwise POSIX awk
ini_set() {
  _file="$1"
  _group="$2"
  _key="$3"
  _val="$4"

  if [ "$DRY_RUN" -eq 1 ]; then
    log_info "[dry-run] ($KWRITE_TOOL) $_file [$_group] $_key=$_val"
    return 0
  fi

  mkdir -p "$(dirname "$_file")"

  if command -v "$KWRITE_TOOL" >/dev/null 2>&1; then
    "$KWRITE_TOOL" --file "$_file" --group "$_group" --key "$_key" "$_val"
    return 0
  fi

  # Fallback pure-POSIX awk INI updater
  [ -f "$_file" ] || : > "$_file"
  _tmp="${_file}.tmp.$$"
  awk -v grp="$_group" -v key="$_key" -v val="$_val" '
    BEGIN { in_grp = 0; found_grp = 0; found_key = 0 }
    /^\[.*\]$/ {
      if (in_grp && !found_key) {
        print key "=" val
        found_key = 1
      }
      if ($0 == "[" grp "]") {
        in_grp = 1
        found_grp = 1
      } else {
        in_grp = 0
      }
      print $0
      next
    }
    {
      if (in_grp && index($0, key "=") == 1) {
        if (!found_key) {
          print key "=" val
          found_key = 1
        }
        next
      }
      print $0
    }
    END {
      if (!found_grp) {
        print ""
        print "[" grp "]"
        print key "=" val
      } else if (in_grp && !found_key) {
        print key "=" val
      }
    }
  ' "$_file" > "$_tmp" && mv "$_tmp" "$_file"
}

# Step 1: Backup existing user config files before modifying
TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
BACKUP_DIR="$BACKUP_BASE/branding-v1-$TIMESTAMP"

if [ "$DRY_RUN" -eq 1 ]; then
  log_info "[dry-run] Would back up existing configs in $CONFIG_DIR to $BACKUP_DIR"
else
  mkdir -p "$BACKUP_DIR" "$CONFIG_DIR" "$STATE_DIR" "$KONSOLE_DIR"
  for f in kdeglobals kcminputrc kwinrc plasmarc ksplashrc kscreenlockerrc konsolerc plasma-org.kde.plasma.desktop-appletsrc; do
    if [ -f "$CONFIG_DIR/$f" ]; then
      cp -p "$CONFIG_DIR/$f" "$BACKUP_DIR/$f"
    fi
  done
  printf '%s\n' "$BACKUP_DIR" > "$LATEST_PTR"
fi

log_info "Applying KDE Plasma $PLASMA_MAJOR branding for $CANONICAL_PROFILE (requested: $PROFILE_ARG)"

# Step 2: Core KDE globals, icons, cursor, plasma theme
ini_set "$CONFIG_DIR/kdeglobals" "KDE" "LookAndFeelPackage" "$LOOK_AND_FEEL"
ini_set "$CONFIG_DIR/kdeglobals" "General" "ColorScheme" "$COLOR_SCHEME"
ini_set "$CONFIG_DIR/kdeglobals" "General" "font" "$FONT_GENERAL"
ini_set "$CONFIG_DIR/kdeglobals" "General" "fixed" "$FONT_FIXED"
ini_set "$CONFIG_DIR/kdeglobals" "Icons" "Theme" "$ICON_THEME"

ini_set "$CONFIG_DIR/kcminputrc" "Mouse" "cursorTheme" "$CURSOR_THEME"
ini_set "$CONFIG_DIR/kcminputrc" "Mouse" "cursorSize" "$CURSOR_SIZE"

ini_set "$CONFIG_DIR/plasmarc" "Theme" "name" "$PLASMA_THEME"

# Step 3: KWin decoration (Plasma 5 vs Plasma 6 key compatibility)
if [ "$PLASMA_MAJOR" -eq 5 ]; then
  ini_set "$CONFIG_DIR/kwinrc" "org.kde.kdecoration2" "library" "org.kde.breeze"
else
  ini_set "$CONFIG_DIR/kwinrc" "org.kde.kdecoration2" "library" "org.kde.breeze"
  ini_set "$CONFIG_DIR/kwinrc" "org.kde.kdecoration2" "theme" "Breeze"
fi

# Step 4: Konsole terminal profile
ini_set "$CONFIG_DIR/konsolerc" "Desktop Entry" "DefaultProfile" "${TERMINAL_PROFILE}.profile"
KONSOLE_PROFILE_FILE="$KONSOLE_DIR/${TERMINAL_PROFILE}.profile"
if [ "$DRY_RUN" -eq 1 ]; then
  log_info "[dry-run] Would write Konsole profile $KONSOLE_PROFILE_FILE"
else
  if [ ! -f "$KONSOLE_PROFILE_FILE" ]; then
    cat > "$KONSOLE_PROFILE_FILE" <<EOF
[Appearance]
ColorScheme=Breeze
Font=${FONT_FIXED}

[General]
Name=${TERMINAL_PROFILE}
Parent=FALLBACK/
EOF
  fi
fi

# Step 5: Splash & Lockscreen (where supported)
if [ "$SPLASH_SUPPORTED" -eq 1 ]; then
  ini_set "$CONFIG_DIR/ksplashrc" "KSplash" "Engine" "KSplashQML"
  ini_set "$CONFIG_DIR/ksplashrc" "KSplash" "Theme" "org.kde.breeze.desktop"
fi

if [ "$LOCKSCREEN_SUPPORTED" -eq 1 ]; then
  ini_set "$CONFIG_DIR/kscreenlockerrc" "Greeter" "WallpaperPlugin" "org.kde.image"
  ini_set "$CONFIG_DIR/kscreenlockerrc" "Greeter" "Theme" "org.kde.breeze.desktop"
fi

# Step 6: Desktop wallpaper & Kickoff launcher metadata in appletsrc
APPLETS_RC="$CONFIG_DIR/plasma-org.kde.plasma.desktop-appletsrc"
ini_set "$APPLETS_RC" "Containments][1][Wallpaper][org.kde.image][General" "Image" "$WALLPAPER_PATH"
ini_set "$APPLETS_RC" "Containments][1][Wallpaper][org.kde.image][General" "Color" "$FALLBACK_COLOR"
ini_set "$APPLETS_RC" "Containments][1][Wallpaper][org.kde.image][General" "FillMode" "2"
ini_set "$APPLETS_RC" "Containments][2][Applets][3][Configuration][General" "icon" "$LAUNCHER_ICON"
ini_set "$APPLETS_RC" "Containments][2][Applets][3][Configuration][General" "menuLabel" "$LAUNCHER_TITLE"

# Step 7: Write idempotent state marker
if [ "$DRY_RUN" -eq 1 ]; then
  log_info "[dry-run] Would write marker $MARKER_FILE"
else
  cat > "$MARKER_FILE" <<EOF
profile=${CANONICAL_PROFILE}
alias_used=${PROFILE_ARG}
plasma_major=${PLASMA_MAJOR}
applied_at=${TIMESTAMP}
backup_dir=${BACKUP_DIR}
EOF
fi

log_info "Branding applied successfully."
