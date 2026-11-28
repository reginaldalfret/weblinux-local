#!/bin/sh
# WebLinux Phase 16 — Alpine Linux 3.24.4 KDE Plasma 6.6.6 Branding Migration
# POSIX sh compatible (BusyBox ash & GNU bash on musl).
# Idempotent: respects ~/.local/state/weblinux/branding-v1-applied,
# backs up existing ~/.config files before modifying, and supports --restore.

set -eu

TARGET_HOME="${HOME:-/root}"
FORCE=0
RESTORE=0
DRY_RUN=0
STATUS_ONLY=0

usage() {
  cat <<'EOF'
Usage: apply-alpine-branding.sh [OPTIONS]

Options:
  --home <dir>    Target home directory (default: $HOME)
  --force         Re-apply even if branding-v1-applied marker exists
  --restore       Restore latest backed-up KDE config and clear marker
  --status        Show current branding migration status
  --dry-run       Print actions without modifying files
  -h, --help      Show this help message
EOF
}

log_info() {
  printf '[weblinux-alpine-branding] %s\n' "$1"
}

log_err() {
  printf '[weblinux-alpine-branding] ERROR: %s\n' "$1" >&2
}

while [ $# -gt 0 ]; do
  case "$1" in
    --home)
      [ $# -ge 2 ] || { log_err "--home requires an argument"; exit 1; }
      TARGET_HOME="$2"
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
  for f in kdeglobals kcminputrc kwinrc plasmarc ksplashrc konsolerc plasma-org.kde.plasma.desktop-appletsrc; do
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

if [ -f "$MARKER_FILE" ] && [ "$FORCE" -eq 0 ]; then
  log_info "Branding already applied ($MARKER_FILE exists). Use --force to re-apply."
  exit 0
fi

WALLPAPER_PATH="/usr/share/wallpapers/WebLinux-Alpine/contents/images/1920x1080.png"
FALLBACK_COLOR="#0d597f"
LOOK_AND_FEEL="org.kde.breezedark.desktop"
COLOR_SCHEME="BreezeDark"
ACCENT_COLOR="13,89,127"
ICON_THEME="breeze-dark"
CURSOR_THEME="breeze_cursors"
CURSOR_SIZE="24"
PLASMA_THEME="breeze-dark"
FONT_GENERAL="DejaVu Sans,10,-1,5,400,0,0,0,0,0"
FONT_FIXED="DejaVu Sans Mono,10,-1,5,400,0,0,0,0,0"
TERMINAL_PROFILE="Alpine-WebLinux"
LAUNCHER_ICON="distributor-logo-alpine"
LAUNCHER_TITLE="Alpine 3.24"

ini_set() {
  _file="$1"
  _group="$2"
  _key="$3"
  _val="$4"

  if [ "$DRY_RUN" -eq 1 ]; then
    log_info "[dry-run] (kwriteconfig6) $_file [$_group] $_key=$_val"
    return 0
  fi

  mkdir -p "$(dirname "$_file")"

  if command -v kwriteconfig6 >/dev/null 2>&1; then
    case "$_group" in
      *\]\[*)
        # Split "A][B][C" into "--group A --group B --group C" for kwriteconfig6
        _old_ifs="$IFS"
        IFS='['
        set -f
        # Replace "][" with "[" via sed so POSIX sh splits cleanly
        _split=$(printf '%s' "$_group" | sed 's/\]\[/[/g')
        set --
        for _part in $_split; do
          set -- "$@" --group "$_part"
        done
        set +f
        IFS="$_old_ifs"
        kwriteconfig6 --file "$_file" "$@" --key "$_key" "$_val"
        ;;
      *)
        kwriteconfig6 --file "$_file" --group "$_group" --key "$_key" "$_val"
        ;;
    esac
    return 0
  fi

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

TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
BACKUP_DIR="$BACKUP_BASE/branding-v1-$TIMESTAMP"

if [ "$DRY_RUN" -eq 1 ]; then
  log_info "[dry-run] Would back up existing configs in $CONFIG_DIR to $BACKUP_DIR"
else
  mkdir -p "$BACKUP_DIR" "$CONFIG_DIR" "$STATE_DIR" "$KONSOLE_DIR"
  for f in kdeglobals kcminputrc kwinrc plasmarc ksplashrc konsolerc plasma-org.kde.plasma.desktop-appletsrc; do
    if [ -f "$CONFIG_DIR/$f" ]; then
      cp -p "$CONFIG_DIR/$f" "$BACKUP_DIR/$f"
    fi
  done
  printf '%s\n' "$BACKUP_DIR" > "$LATEST_PTR"
fi

log_info "Applying Alpine Linux 3.24.4 KDE Plasma 6.6.6 branding to $TARGET_HOME"

# Core KDE globals, Alpine blue accent (#0D597F), icons, cursor, plasma theme
ini_set "$CONFIG_DIR/kdeglobals" "KDE" "LookAndFeelPackage" "$LOOK_AND_FEEL"
ini_set "$CONFIG_DIR/kdeglobals" "General" "ColorScheme" "$COLOR_SCHEME"
ini_set "$CONFIG_DIR/kdeglobals" "General" "AccentColor" "$ACCENT_COLOR"
ini_set "$CONFIG_DIR/kdeglobals" "General" "font" "$FONT_GENERAL"
ini_set "$CONFIG_DIR/kdeglobals" "General" "fixed" "$FONT_FIXED"
ini_set "$CONFIG_DIR/kdeglobals" "Icons" "Theme" "$ICON_THEME"

ini_set "$CONFIG_DIR/kcminputrc" "Mouse" "cursorTheme" "$CURSOR_THEME"
ini_set "$CONFIG_DIR/kcminputrc" "Mouse" "cursorSize" "$CURSOR_SIZE"

ini_set "$CONFIG_DIR/plasmarc" "Theme" "name" "$PLASMA_THEME"

ini_set "$CONFIG_DIR/kwinrc" "org.kde.kdecoration2" "library" "org.kde.breeze"
ini_set "$CONFIG_DIR/kwinrc" "org.kde.kdecoration2" "theme" "Breeze"

ini_set "$CONFIG_DIR/ksplashrc" "KSplash" "Engine" "none"
ini_set "$CONFIG_DIR/ksplashrc" "KSplash" "Theme" "None"

# Konsole profile with Alpine colorscheme
ini_set "$CONFIG_DIR/konsolerc" "Desktop Entry" "DefaultProfile" "${TERMINAL_PROFILE}.profile"
KONSOLE_PROFILE_FILE="$KONSOLE_DIR/${TERMINAL_PROFILE}.profile"
if [ "$DRY_RUN" -eq 1 ]; then
  log_info "[dry-run] Would write Konsole profile $KONSOLE_PROFILE_FILE"
else
  if [ ! -f "$KONSOLE_PROFILE_FILE" ] || [ "$FORCE" -eq 1 ]; then
    cat > "$KONSOLE_PROFILE_FILE" <<EOF
[Appearance]
ColorScheme=Alpine
Font=${FONT_FIXED}

[General]
Name=${TERMINAL_PROFILE}
Parent=FALLBACK/
EOF
  fi
fi

# Desktop wallpaper & Kickoff launcher metadata
APPLETS_RC="$CONFIG_DIR/plasma-org.kde.plasma.desktop-appletsrc"
ini_set "$APPLETS_RC" "Containments][1][Wallpaper][org.kde.image][General" "Image" "$WALLPAPER_PATH"
ini_set "$APPLETS_RC" "Containments][1][Wallpaper][org.kde.image][General" "Color" "$FALLBACK_COLOR"
ini_set "$APPLETS_RC" "Containments][1][Wallpaper][org.kde.image][General" "FillMode" "2"
ini_set "$APPLETS_RC" "Containments][2][Applets][3][Configuration][General" "icon" "$LAUNCHER_ICON"
ini_set "$APPLETS_RC" "Containments][2][Applets][3][Configuration][General" "menuLabel" "$LAUNCHER_TITLE"

# Idempotent state marker
if [ "$DRY_RUN" -eq 1 ]; then
  log_info "[dry-run] Would write marker $MARKER_FILE"
else
  cat > "$MARKER_FILE" <<EOF
profile=alpine-kde
distro=alpine-3.24.4
plasma_major=6
plasma_version=6.6.6
applied_at=${TIMESTAMP}
backup_dir=${BACKUP_DIR}
EOF
fi

log_info "Alpine branding applied successfully."
