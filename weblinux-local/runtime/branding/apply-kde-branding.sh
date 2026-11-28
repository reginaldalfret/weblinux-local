#!/bin/sh
# WebLinux Phase 16.1 — Shared KDE Branding & Wallpaper Migration Helper (POSIX sh)
# Supports KDE Plasma 5.27 (Ubuntu 24.04.5) and KDE Plasma 6.x
# (Debian 13, Arch, openSUSE Tumbleweed, Fedora 45, Alpine 3.24.4).
#
# Idempotent:
#   - Retains ~/.local/state/weblinux/branding-v1-applied
#   - Implements ~/.local/state/weblinux/branding-v2-logo-wallpaper-applied
#   - Replaces empty or known Phase 16 / default wallpapers with the new
#     distribution-logo wallpaper while preserving custom user wallpapers.
#   - Backs up existing ~/.config files before modifying and supports --restore.

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
  --force                 Re-apply even if v1/v2 markers exist
  --restore               Restore latest backed-up KDE config and clear marker(s)
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
MARKER_V1="$STATE_DIR/branding-v1-applied"
MARKER_V2="$STATE_DIR/branding-v2-logo-wallpaper-applied"
BACKUP_BASE="$STATE_DIR/backups"
LATEST_PTR_V1="$BACKUP_BASE/latest-branding-v1"
LATEST_PTR_V2="$BACKUP_BASE/latest-branding-v2"
CONFIG_DIR="$TARGET_HOME/.config"
KONSOLE_DIR="$TARGET_HOME/.local/share/konsole"
APPLETS_RC="$CONFIG_DIR/plasma-org.kde.plasma.desktop-appletsrc"

# Known Phase 16 / default WebLinux & KDE Plasma wallpaper paths (normalized without file://)
KNOWN_PREVIOUS_WALLPAPERS="
/usr/share/wallpapers/WebLinux-Debian/contents/images/1920x1080.png
/usr/share/wallpapers/WebLinux-Ubuntu/contents/images/1920x1080.png
/usr/share/wallpapers/WebLinux-Arch/contents/images/1920x1080.png
/usr/share/wallpapers/WebLinux-openSUSE/contents/images/1920x1080.png
/usr/share/wallpapers/WebLinux-Fedora/contents/images/1920x1080.png
/usr/share/wallpapers/WebLinux-Alpine/contents/images/1920x1080.png
/usr/share/wallpapers/DebianTheme
/usr/share/wallpapers/DebianTheme/contents/images/1920x1080.svg
/usr/share/wallpapers/DebianTheme/contents/images/1920x1080.png
/usr/share/wallpapers/Ceratopsian
/usr/share/wallpapers/UbuntuNoble
/usr/share/wallpapers/UbuntuNoble/contents/images/3840x2160.png
/usr/share/wallpapers/UbuntuNoble/contents/images/1920x1080.png
/usr/share/wallpapers/ArchLinux
/usr/share/wallpapers/ArchLinux/contents/images/5120x2880.png
/usr/share/wallpapers/ArchLinux/contents/images/1920x1080.png
/usr/share/wallpapers/openSUSEdefault
/usr/share/wallpapers/openSUSEdefault/contents/images/default.png
/usr/share/wallpapers/openSUSEdefault/contents/images/default-dark.png
/usr/share/wallpapers/F45
/usr/share/wallpapers/F45/contents/images/default.png
/usr/share/wallpapers/F45/contents/images/default.jxl
/usr/share/wallpapers/Next
/usr/share/wallpapers/Next/contents/images/1920x1080.png
/usr/share/wallpapers/Next/contents/images/5120x2880.png
/usr/share/wallpapers/Breeze
/usr/share/wallpapers/Breeze/contents/images/1920x1080.png
"

normalize_wallpaper_path() {
  printf '%s' "$1" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//; s|^file://||; s|/*$||'
}

is_known_or_empty_wallpaper() {
  _norm=$(normalize_wallpaper_path "$1")
  if [ -z "$_norm" ]; then
    return 0
  fi
  for _known in $KNOWN_PREVIOUS_WALLPAPERS; do
    _knorm=$(normalize_wallpaper_path "$_known")
    if [ "$_norm" = "$_knorm" ]; then
      return 0
    fi
    case "$_norm" in
      "$_knorm"/*)
        return 0
        ;;
    esac
  done
  return 1
}

# Portable INI reader (POSIX awk fallback, or kreadconfig5/6 if provided)
ini_get_awk() {
  _file="$1"
  _group="$2"
  _key="$3"
  [ -f "$_file" ] || return 0
  awk -v grp="$_group" -v key="$_key" '
    /^\[.*\]$/ {
      in_grp = ($0 == "[" grp "]")
      next
    }
    in_grp && index($0, key "=") == 1 {
      val = substr($0, length(key) + 2)
      print val
      exit
    }
  ' "$_file"
}

# Find current wallpaper group & value in appletsrc.
# Sets WALLPAPER_GROUP and CURRENT_WALLPAPER.
detect_appletsrc_wallpaper() {
  WALLPAPER_GROUP="Containments][1][Wallpaper][org.kde.image][General"
  CURRENT_WALLPAPER=""

  if [ ! -f "$APPLETS_RC" ]; then
    return 0
  fi

  if [ -n "${KREAD_TOOL:-}" ] && command -v "$KREAD_TOOL" >/dev/null 2>&1; then
    CURRENT_WALLPAPER=$("$KREAD_TOOL" --file "$APPLETS_RC" --group "$WALLPAPER_GROUP" --key "Image" 2>/dev/null || true)
  fi

  if [ -z "$CURRENT_WALLPAPER" ]; then
    CURRENT_WALLPAPER=$(ini_get_awk "$APPLETS_RC" "$WALLPAPER_GROUP" "Image")
  fi

  if [ -z "$CURRENT_WALLPAPER" ]; then
    _detected=$(awk '
      /^\[Containments\]\[[0-9]+\]\[Wallpaper\]\[org\.kde\.image\]\[General\]$/ {
        grp = substr($0, 2, length($0) - 2)
        next
      }
      /^\[.*\]$/ {
        grp = ""
        next
      }
      grp != "" && /^Image=/ {
        val = substr($0, 7)
        if (val != "") {
          print grp "\t" val
          exit
        }
      }
    ' "$APPLETS_RC")
    if [ -n "$_detected" ]; then
      WALLPAPER_GROUP=$(printf '%s' "$_detected" | cut -f1)
      CURRENT_WALLPAPER=$(printf '%s' "$_detected" | cut -f2-)
    fi
  fi
}

if [ "$STATUS_ONLY" -eq 1 ]; then
  if [ -f "$MARKER_V1" ]; then
    log_info "v1 Applied: $MARKER_V1"
    cat "$MARKER_V1"
  else
    log_info "v1 Not applied (marker absent: $MARKER_V1)"
  fi
  if [ -f "$MARKER_V2" ]; then
    log_info "v2 Logo Wallpaper Applied: $MARKER_V2"
    cat "$MARKER_V2"
  else
    log_info "v2 Logo Wallpaper Not applied (marker absent: $MARKER_V2)"
  fi
  detect_appletsrc_wallpaper
  log_info "Current appletsrc wallpaper ($WALLPAPER_GROUP): ${CURRENT_WALLPAPER:-<empty>}"
  exit 0
fi

if [ "$RESTORE" -eq 1 ]; then
  RESTORE_PTR=""
  RESTORE_MODE=""
  if [ -f "$LATEST_PTR_V2" ]; then
    RESTORE_PTR="$LATEST_PTR_V2"
    RESTORE_MODE="v2"
  elif [ -f "$LATEST_PTR_V1" ]; then
    RESTORE_PTR="$LATEST_PTR_V1"
    RESTORE_MODE="v1"
  else
    log_err "No backup pointer found at $LATEST_PTR_V2 or $LATEST_PTR_V1"
    exit 1
  fi

  BACKUP_DIR=$(cat "$RESTORE_PTR")
  if [ ! -d "$BACKUP_DIR" ]; then
    log_err "Backup directory does not exist: $BACKUP_DIR"
    exit 1
  fi

  log_info "Restoring KDE configuration ($RESTORE_MODE) from $BACKUP_DIR -> $CONFIG_DIR"
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
    log_info "[dry-run] rm -f $MARKER_V2"
    if [ "$RESTORE_MODE" = "v1" ] || { [ -f "$LATEST_PTR_V1" ] && [ "$(cat "$LATEST_PTR_V1")" = "$BACKUP_DIR" ]; }; then
      log_info "[dry-run] rm -f $MARKER_V1"
    fi
  else
    rm -f "$MARKER_V2"
    if [ "$RESTORE_MODE" = "v1" ] || { [ -f "$LATEST_PTR_V1" ] && [ "$(cat "$LATEST_PTR_V1")" = "$BACKUP_DIR" ]; }; then
      rm -f "$MARKER_V1"
    fi
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

if [ -f "$MARKER_V1" ] && [ -f "$MARKER_V2" ] && [ "$FORCE" -eq 0 ]; then
  log_info "Branding v1 and v2 already applied ($MARKER_V1, $MARKER_V2 exist). Use --force to re-apply."
  exit 0
fi

# Profile metadata defaults (Phase 16.1 distribution-logo wallpapers)
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
    WALLPAPER_PATH="/usr/share/wallpapers/WebLinux-Debian/contents/images/debian-trixie-logo-wallpaper.png"
    FALLBACK_COLOR="#a80030"
    TERMINAL_PROFILE="Debian-WebLinux"
    LAUNCHER_ICON="distributor-logo-debian"
    LAUNCHER_TITLE="Debian 13"
    ;;
  ubuntu-kde)
    PLASMA_MAJOR=5
    WALLPAPER_PATH="/usr/share/wallpapers/WebLinux-Ubuntu/contents/images/ubuntu-2404-logo-wallpaper.png"
    FALLBACK_COLOR="#77216f"
    FONT_GENERAL="Ubuntu,10,-1,5,50,0,0,0,0,0"
    FONT_FIXED="Ubuntu Mono,11,-1,5,50,0,0,0,0,0"
    TERMINAL_PROFILE="Ubuntu-WebLinux"
    LAUNCHER_ICON="distributor-logo-ubuntu"
    LAUNCHER_TITLE="Ubuntu 24.04"
    ;;
  arch-kde)
    PLASMA_MAJOR=6
    WALLPAPER_PATH="/usr/share/wallpapers/WebLinux-Arch/contents/images/arch-linux-logo-wallpaper.png"
    FALLBACK_COLOR="#1793d1"
    TERMINAL_PROFILE="Arch-WebLinux"
    LAUNCHER_ICON="distributor-logo-archlinux"
    LAUNCHER_TITLE="Arch Linux"
    ;;
  opensuse-tumbleweed-kde)
    PLASMA_MAJOR=6
    WALLPAPER_PATH="/usr/share/wallpapers/WebLinux-openSUSE/contents/images/opensuse-tumbleweed-logo-wallpaper.png"
    FALLBACK_COLOR="#173f4f"
    LOOK_AND_FEEL="org.openSUSE.desktop"
    TERMINAL_PROFILE="openSUSE-WebLinux"
    LAUNCHER_ICON="distributor-logo-opensuse"
    LAUNCHER_TITLE="Tumbleweed"
    ;;
  fedora-kde)
    PLASMA_MAJOR=6
    WALLPAPER_PATH="/usr/share/wallpapers/WebLinux-Fedora/contents/images/fedora-45-logo-wallpaper.png"
    FALLBACK_COLOR="#294172"
    LOOK_AND_FEEL="org.fedoraproject.fedora.desktop"
    TERMINAL_PROFILE="Fedora-WebLinux"
    LAUNCHER_ICON="distributor-logo-fedora"
    LAUNCHER_TITLE="Fedora 45"
    ;;
  alpine-kde)
    PLASMA_MAJOR=6
    WALLPAPER_PATH="/usr/share/wallpapers/WebLinux-Alpine/contents/images/alpine-324-logo-wallpaper.png"
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
KREAD_TOOL="kreadconfig6"
if [ "$PLASMA_MAJOR" -eq 5 ]; then
  KWRITE_TOOL="kwriteconfig5"
  KREAD_TOOL="kreadconfig5"
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
    case "$_group" in
      *\]\[*)
        # Nested KConfig group: use POSIX awk updater directly to avoid kwriteconfig ][ escaping
        ;;
      *)
        "$KWRITE_TOOL" --file "$_file" --group "$_group" --key "$_key" "$_val"
        return 0
        ;;
    esac
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

APPLY_V1=0
if [ ! -f "$MARKER_V1" ] || [ "$FORCE" -eq 1 ]; then
  APPLY_V1=1
fi

TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
if [ "$APPLY_V1" -eq 1 ]; then
  BACKUP_DIR="$BACKUP_BASE/branding-v1-$TIMESTAMP"
else
  BACKUP_DIR="$BACKUP_BASE/branding-v2-$TIMESTAMP"
fi

# Step 1: Backup existing user config files before modifying
if [ "$DRY_RUN" -eq 1 ]; then
  log_info "[dry-run] Would back up existing configs in $CONFIG_DIR to $BACKUP_DIR"
else
  mkdir -p "$BACKUP_DIR" "$CONFIG_DIR" "$STATE_DIR" "$KONSOLE_DIR"
  for f in kdeglobals kcminputrc kwinrc plasmarc ksplashrc kscreenlockerrc konsolerc plasma-org.kde.plasma.desktop-appletsrc; do
    if [ -f "$CONFIG_DIR/$f" ]; then
      cp -p "$CONFIG_DIR/$f" "$BACKUP_DIR/$f"
    fi
  done
  if [ "$APPLY_V1" -eq 1 ]; then
    printf '%s\n' "$BACKUP_DIR" > "$LATEST_PTR_V1"
  fi
  printf '%s\n' "$BACKUP_DIR" > "$LATEST_PTR_V2"
fi

if [ "$APPLY_V1" -eq 1 ]; then
  log_info "Applying KDE Plasma $PLASMA_MAJOR branding (v1 + v2) for $CANONICAL_PROFILE (requested: $PROFILE_ARG)"

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

  # Kickoff launcher metadata in appletsrc
  ini_set "$APPLETS_RC" "Containments][2][Applets][3][Configuration][General" "icon" "$LAUNCHER_ICON"
  ini_set "$APPLETS_RC" "Containments][2][Applets][3][Configuration][General" "menuLabel" "$LAUNCHER_TITLE"
else
  log_info "Retaining v1 branding ($MARKER_V1 exists); running v2 logo-wallpaper migration for $CANONICAL_PROFILE"
fi

# Step 6: v2 Distribution-Logo Wallpaper Migration (safe & custom-wallpaper-preserving)
detect_appletsrc_wallpaper
WALLPAPER_ACTION="preserved_custom"

if is_known_or_empty_wallpaper "$CURRENT_WALLPAPER"; then
  WALLPAPER_ACTION="replaced"
  log_info "Updating wallpaper ($WALLPAPER_GROUP): '${CURRENT_WALLPAPER:-<empty>}' -> '$WALLPAPER_PATH'"
  ini_set "$APPLETS_RC" "$WALLPAPER_GROUP" "Image" "$WALLPAPER_PATH"
  ini_set "$APPLETS_RC" "$WALLPAPER_GROUP" "Color" "$FALLBACK_COLOR"
  ini_set "$APPLETS_RC" "$WALLPAPER_GROUP" "FillMode" "2"
  if [ "$LOCKSCREEN_SUPPORTED" -eq 1 ]; then
    ini_set "$CONFIG_DIR/kscreenlockerrc" "Greeter][Wallpaper][org.kde.image][General" "Image" "$WALLPAPER_PATH"
  fi
else
  log_info "Preserving custom user wallpaper ($WALLPAPER_GROUP): '$CURRENT_WALLPAPER'"
fi

# Step 7: Write idempotent state markers
if [ "$DRY_RUN" -eq 1 ]; then
  if [ "$APPLY_V1" -eq 1 ]; then
    log_info "[dry-run] Would write marker $MARKER_V1"
  fi
  log_info "[dry-run] Would write marker $MARKER_V2 (wallpaper_action=$WALLPAPER_ACTION)"
else
  if [ "$APPLY_V1" -eq 1 ]; then
    cat > "$MARKER_V1" <<EOF
profile=${CANONICAL_PROFILE}
alias_used=${PROFILE_ARG}
plasma_major=${PLASMA_MAJOR}
applied_at=${TIMESTAMP}
backup_dir=${BACKUP_DIR}
EOF
  fi
  cat > "$MARKER_V2" <<EOF
profile=${CANONICAL_PROFILE}
alias_used=${PROFILE_ARG}
plasma_major=${PLASMA_MAJOR}
wallpaper_action=${WALLPAPER_ACTION}
previous_wallpaper=${CURRENT_WALLPAPER}
new_wallpaper=${WALLPAPER_PATH}
applied_at=${TIMESTAMP}
backup_dir=${BACKUP_DIR}
EOF
fi

log_info "Branding applied successfully (v2 wallpaper_action=$WALLPAPER_ACTION)."
