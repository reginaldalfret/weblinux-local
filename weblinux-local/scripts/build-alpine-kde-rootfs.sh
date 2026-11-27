#!/usr/bin/env bash
set -euo pipefail

TARBALL="/mnt/d/weblinux-disks/alpine-kde/staging/alpine-minirootfs-3.24.4-riscv64.tar.gz"
SHA_FILE="/mnt/d/weblinux-disks/alpine-kde/staging/alpine-minirootfs-3.24.4-riscv64.tar.gz.sha256"
BUILD_DIR="/root/alpine-build"
R="${BUILD_DIR}/rootfs"

if [ ! -f "$TARBALL" ] || [ ! -f "$SHA_FILE" ]; then
  echo "Missing verified tarball; run scripts/fetch-alpine-riscv-rootfs.sh first" >&2
  exit 1
fi

(cd "$(dirname "$TARBALL")" && sha256sum -c "$(basename "$SHA_FILE")")

rm -rf "$R"
mkdir -p "$R"
tar --no-same-owner -xzf "$TARBALL" -C "$R"

cp /usr/bin/qemu-riscv64-static "$R/usr/bin/qemu-riscv64-static"
cleanup() {
  rm -f "$R/usr/bin/qemu-riscv64-static"
}
trap cleanup EXIT

printf "nameserver 1.1.1.1\nnameserver 8.8.8.8\n" > "$R/etc/resolv.conf"
cat <<'EOF' > "$R/etc/apk/repositories"
https://dl-cdn.alpinelinux.org/alpine/v3.24/main
https://dl-cdn.alpinelinux.org/alpine/v3.24/community
EOF

chroot "$R" /usr/bin/qemu-riscv64-static /bin/sh -c '
  set -euo pipefail
  apk update
  apk add --no-cache \
    bash coreutils util-linux procps-ng shadow curl ca-certificates tzdata \
    dbus dbus-x11 font-dejavu fontconfig \
    plasma-desktop plasma-workspace kwin dolphin konsole \
    breeze breeze-icons plasma-integration kde-cli-tools \
    qt6-qtwayland qt6-qtdeclarative kio kio-extras \
    mesa-dri-gallium mesa-egl mesa-gl
  apk add --no-cache mesa-demos 2>/dev/null || true

  passwd -l root
  mkdir -p /var/lib/dbus /run/dbus
  rm -f /etc/machine-id /var/lib/dbus/machine-id
  dbus-uuidgen --ensure=/etc/machine-id
  dbus-uuidgen --ensure=/var/lib/dbus/machine-id
  apk info -v | sort > /tmp/alpine-kde-packages.lock
'

cp "$R/tmp/alpine-kde-packages.lock" /mnt/e/Web-Linux/weblinux-local/docs/phase-13/alpine-kde-packages.lock
rm -f "$R/tmp/alpine-kde-packages.lock" "$R/var/cache/apk/"*

mkdir -p "$R/usr/local/bin"
cat <<'EOF' > "$R/usr/local/bin/alpine-kde-session"
#!/bin/sh
set -e

export HOME=/root
export USER=root
export LOGNAME=root
export SHELL=/bin/bash
export LANG=C.UTF-8
export PATH=/run/hostopen/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
export XDG_RUNTIME_DIR=/tmp/runtime-root
export WAYLAND_DISPLAY=wayland-0
export QT_QPA_PLATFORM=wayland
export QT_WAYLAND_DISABLE_WINDOWDECORATION=0
export XDG_CURRENT_DESKTOP=KDE
export XDG_SESSION_DESKTOP=KDE
export XDG_SESSION_TYPE=wayland
export KDE_SESSION_VERSION=6
export MOZ_ENABLE_WAYLAND=1

mkdir -p "$XDG_RUNTIME_DIR"
chmod 700 "$XDG_RUNTIME_DIR"

echo "[Alpine KDE Launcher] Initializing Alpine Linux 3.24.4 RISC-V KDE Plasma 6 Session..." | tee /root/alpine-kde-session.log

for bin in plasmashell konsole dolphin; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "[Alpine KDE Launcher ERROR] Missing required binary: $bin" | tee -a /root/alpine-kde-session.log >&2
    exit 1
  fi
done
echo "[Alpine KDE Launcher] Preflight verified: plasmashell, konsole, dolphin installed." | tee -a /root/alpine-kde-session.log

# 1. D-Bus system + session buses
mkdir -p /run/dbus /var/run
[ -e /var/run/dbus ] || ln -s /run/dbus /var/run/dbus
[ -S /run/dbus/system_bus_socket ] || dbus-daemon --system --fork --nopidfile > /tmp/dbus.log 2>&1 || true
export DBUS_SYSTEM_BUS_ADDRESS="unix:path=/run/dbus/system_bus_socket"
if [ ! -S "$XDG_RUNTIME_DIR/bus" ]; then
  dbus-daemon --session --fork --address="unix:path=$XDG_RUNTIME_DIR/bus" >> /tmp/dbus.log 2>&1 || true
fi
export DBUS_SESSION_BUS_ADDRESS="unix:path=$XDG_RUNTIME_DIR/bus"

# 2. Start WebLinux GPU server (rvgpu -> WebGL2/WebGPU) if available
if [ -x /run/hostnode/hostnode ] && [ -f /run/rvgpu/boot.js ] && [ ! -S "$XDG_RUNTIME_DIR/rvgpu-0" ]; then
  rm -f "$XDG_RUNTIME_DIR/rvgpu-0.ready" "$XDG_RUNTIME_DIR/rvgpu-0.none"
  HOSTNODE_HOME=/run/rvgpu /run/hostnode/hostnode > /tmp/rvgpu.log 2>&1 &
  g=0
  while [ ! -f "$XDG_RUNTIME_DIR/rvgpu-0.ready" ] && [ ! -f "$XDG_RUNTIME_DIR/rvgpu-0.none" ] && [ $g -lt 20 ]; do
    sleep 0.1
    g=$((g + 1))
  done
fi
if [ -f "$XDG_RUNTIME_DIR/rvgpu-0.ready" ]; then
  export GALLIUM_DRIVER=virpipe
  export VTEST_SOCKET_NAME="$XDG_RUNTIME_DIR/rvgpu-0"
  echo "[Alpine KDE Launcher] rvgpu active ($VTEST_SOCKET_NAME, GALLIUM_DRIVER=virpipe)" >> /root/alpine-kde-session.log
else
  echo "[Alpine KDE Launcher] rvgpu unavailable; using software QML fallback" >> /root/alpine-kde-session.log
fi

# 3. Build KService 6 cache in background if missing
if ! ls /root/.cache/ksycoca6_* >/dev/null 2>&1 && command -v kbuildsycoca6 >/dev/null 2>&1; then
  kbuildsycoca6 >> /root/alpine-kde-session.log 2>&1 &
fi

# 4. Start WebLinux Wayland compositor (wlserver in WLSERVER_SHELL=plasma mode)
if [ ! -S "$XDG_RUNTIME_DIR/$WAYLAND_DISPLAY" ]; then
  if [ -x /run/hostnode/hostnode ] && [ -d /run/wlserver ]; then
    echo "plasma" > "$XDG_RUNTIME_DIR/wlserver.shell"
    WLSERVER_SHELL=plasma HOSTNODE_HOME=/run/wlserver /run/hostnode/hostnode > /tmp/kwin.log 2>&1 &
    i=0
    while [ ! -S "$XDG_RUNTIME_DIR/$WAYLAND_DISPLAY" ] && [ $i -lt 50 ]; do
      sleep 0.1
      i=$((i + 1))
    done
  fi
fi

if [ ! -S "$XDG_RUNTIME_DIR/$WAYLAND_DISPLAY" ]; then
  echo "[Alpine KDE Launcher ERROR] Wayland display socket $XDG_RUNTIME_DIR/$WAYLAND_DISPLAY did not start" | tee -a /root/alpine-kde-session.log >&2
  exit 1
fi

echo "[Alpine KDE Launcher] Wayland display $WAYLAND_DISPLAY ready. Launching Plasma 6..." | tee -a /root/alpine-kde-session.log
QT_QUICK_BACKEND=software QMLSCENE_DEVICE=softwarecontext LIBGL_ALWAYS_SOFTWARE=1 nohup plasmashell --no-respawn > /tmp/plasma-shell.log 2> /tmp/qt.log &
sleep 2
echo "[Alpine KDE Launcher] Plasma 6 session started (PID $!)." | tee -a /root/alpine-kde-session.log
EOF
chmod +x "$R/usr/local/bin/alpine-kde-session"

echo "ALPINE_BUILD_DONE"
du -sh "$R"
