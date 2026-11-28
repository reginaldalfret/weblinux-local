#!/bin/sh
# WebLinux Phase 16.1 — Guest-side KDE Wayland / Compositor / Plasma Readiness Probe
# POSIX sh compatible (BusyBox ash on Alpine musl & GNU bash on glibc distros).
#
# Checks:
#   1. Wayland socket $XDG_RUNTIME_DIR/$WAYLAND_DISPLAY exists (-S)
#   2. Compositor (wlserver / kwin_wayland) process is running
#   3. plasmashell process is running
#   4. D-Bus org.kde.plasmashell service is active on session bus
#
# Usage:
#   verify-compositor-readiness.sh [--wait <seconds>] [--interval <seconds>] [--quiet]

set -u

WAIT_SEC=0
INTERVAL_SEC=1
QUIET=0

while [ $# -gt 0 ]; do
  case "$1" in
    --wait)
      WAIT_SEC="${2:-0}"
      shift 2
      ;;
    --interval)
      INTERVAL_SEC="${2:-1}"
      shift 2
      ;;
    --quiet|-q)
      QUIET=1
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [--wait <seconds>] [--interval <seconds>] [--quiet]"
      exit 0
      ;;
    *)
      shift
      ;;
  esac
done

# Inherit live plasmashell environment if available
PLASMA_PID=""
if command -v pidof >/dev/null 2>&1; then
  PLASMA_PID=$(pidof plasmashell 2>/dev/null | awk '{print $1}' || true)
fi

if [ -n "$PLASMA_PID" ] && [ -r "/proc/$PLASMA_PID/environ" ]; then
  for kv in $(tr '\0' '\n' < "/proc/$PLASMA_PID/environ" 2>/dev/null | grep -E '^(XDG_RUNTIME_DIR|WAYLAND_DISPLAY|DBUS_SESSION_BUS_ADDRESS|HOME)=' || true); do
    key="${kv%%=*}"
    val="${kv#*=}"
    case "$key" in
      XDG_RUNTIME_DIR) export XDG_RUNTIME_DIR="$val" ;;
      WAYLAND_DISPLAY) export WAYLAND_DISPLAY="$val" ;;
      DBUS_SESSION_BUS_ADDRESS) export DBUS_SESSION_BUS_ADDRESS="$val" ;;
      HOME) export HOME="$val" ;;
    esac
  done
fi

export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/tmp/runtime-root}"
export WAYLAND_DISPLAY="${WAYLAND_DISPLAY:-wayland-0}"
export DBUS_SESSION_BUS_ADDRESS="${DBUS_SESSION_BUS_ADDRESS:-unix:path=${XDG_RUNTIME_DIR}/bus}"

check_process_cmdline() {
  pattern="$1"
  for p in /proc/[0-9]*/cmdline; do
    [ -r "$p" ] || continue
    if tr '\0' ' ' < "$p" 2>/dev/null | grep -qE "$pattern"; then
      return 0
    fi
  done
  return 1
}

check_once() {
  WAYLAND_SOCKET_OK=0
  COMPOSITOR_OK=0
  PLASMASHELL_OK=0
  DBUS_BUS_OK=0
  DBUS_PLASMASHELL_OK=0

  if [ -S "${XDG_RUNTIME_DIR}/${WAYLAND_DISPLAY}" ]; then
    WAYLAND_SOCKET_OK=1
  fi

  # WebLinux uses wlserver (hostnode /run/wlserver) or native kwin_wayland
  if check_process_cmdline '(^|/)(wlserver|kwin_wayland)(\s|$)|HOSTNODE_HOME=/run/wlserver|/run/wlserver'; then
    COMPOSITOR_OK=1
  fi

  if [ -n "$(pidof plasmashell 2>/dev/null || true)" ] || check_process_cmdline '(^|/)plasmashell(\s|$)'; then
    PLASMASHELL_OK=1
  fi

  if [ -S "${XDG_RUNTIME_DIR}/bus" ]; then
    DBUS_BUS_OK=1
  fi

  if [ "$DBUS_BUS_OK" -eq 1 ]; then
    if command -v dbus-send >/dev/null 2>&1; then
      if dbus-send --session --dest=org.freedesktop.DBus --type=method_call --print-reply \
        /org/freedesktop/DBus org.freedesktop.DBus.NameHasOwner string:org.kde.plasmashell 2>/dev/null | grep -q 'boolean true'; then
        DBUS_PLASMASHELL_OK=1
      fi
    elif command -v qdbus6 >/dev/null 2>&1; then
      if qdbus6 org.kde.plasmashell /MainApplication >/dev/null 2>&1; then
        DBUS_PLASMASHELL_OK=1
      fi
    elif command -v qdbus >/dev/null 2>&1; then
      if qdbus org.kde.plasmashell /MainApplication >/dev/null 2>&1; then
        DBUS_PLASMASHELL_OK=1
      fi
    fi
  fi

  if [ "$WAYLAND_SOCKET_OK" -eq 1 ] && [ "$COMPOSITOR_OK" -eq 1 ] && [ "$PLASMASHELL_OK" -eq 1 ] && [ "$DBUS_PLASMASHELL_OK" -eq 1 ]; then
    COMPOSITOR_READY=1
  else
    COMPOSITOR_READY=0
  fi
}

elapsed=0
while :; do
  check_once
  if [ "$COMPOSITOR_READY" -eq 1 ] || [ "$elapsed" -ge "$WAIT_SEC" ]; then
    break
  fi
  sleep "$INTERVAL_SEC"
  elapsed=$((elapsed + INTERVAL_SEC))
done

if [ "$QUIET" -eq 0 ]; then
  echo "XDG_RUNTIME_DIR=${XDG_RUNTIME_DIR}"
  echo "WAYLAND_DISPLAY=${WAYLAND_DISPLAY}"
  echo "WAYLAND_SOCKET_OK=${WAYLAND_SOCKET_OK}"
  echo "COMPOSITOR_OK=${COMPOSITOR_OK}"
  echo "PLASMASHELL_OK=${PLASMASHELL_OK}"
  echo "DBUS_BUS_OK=${DBUS_BUS_OK}"
  echo "DBUS_PLASMASHELL_OK=${DBUS_PLASMASHELL_OK}"
  echo "COMPOSITOR_READY=${COMPOSITOR_READY}"
fi

[ "$COMPOSITOR_READY" -eq 1 ] && exit 0 || exit 1
