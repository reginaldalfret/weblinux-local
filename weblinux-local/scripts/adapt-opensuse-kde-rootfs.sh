#!/usr/bin/env bash
set -euo pipefail

R="/root/opensuse-build/rootfs"
cp /usr/bin/qemu-riscv64-static "$R/usr/bin/qemu-riscv64-static"

# Ensure DNS for chroot zypper
rm -f "$R/etc/resolv.conf"
printf "nameserver 1.1.1.1\nnameserver 8.8.8.8\n" > "$R/etc/resolv.conf"

# Mount proc/sys/dev for chroot zypper
mount --bind /proc "$R/proc"
mount --bind /sys "$R/sys"
mount --bind /dev "$R/dev"
cleanup() {
  umount "$R/dev" 2>/dev/null || true
  umount "$R/sys" 2>/dev/null || true
  umount "$R/proc" 2>/dev/null || true
  rm -f "$R/usr/bin/qemu-riscv64-static"
}
trap cleanup EXIT

chroot "$R" /usr/bin/qemu-riscv64-static /usr/bin/bash -c "
  set -euo pipefail
  export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

  # Verify signed openSUSE repos and install Dolphin + dbus-1-daemon (never --no-gpg-checks)
  zypper --non-interactive --gpg-auto-import-keys refresh
  zypper --non-interactive install --no-recommends dolphin dbus-1-daemon
  zypper --non-interactive install --no-recommends Mesa-demo-egl 2>/dev/null || true

  # Lock root account so no default password remains active
  passwd -l root

  # Ensure D-Bus machine-id exists
  mkdir -p /var/lib/dbus /run/dbus
  [ -s /etc/machine-id ] || rm -f /etc/machine-id
  [ -s /var/lib/dbus/machine-id ] || rm -f /var/lib/dbus/machine-id
  dbus-uuidgen --ensure=/etc/machine-id
  dbus-uuidgen --ensure=/var/lib/dbus/machine-id

  # Clean package cache and record final package inventory
  zypper clean --all
  rpm -qa | sort > /tmp/opensuse-kde-packages.lock
"

cp "$R/tmp/opensuse-kde-packages.lock" /mnt/e/Web-Linux/weblinux-local/docs/phase-10/opensuse-kde-packages.lock
rm -f "$R/tmp/opensuse-kde-packages.lock"

# Write WebLinux openSUSE KDE Plasma 6 session supervisor
mkdir -p "$R/usr/local/bin"
cat <<'EOF' > "$R/usr/local/bin/opensuse-kde-session"
#!/usr/bin/env bash
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

echo "[openSUSE KDE Launcher] Initializing openSUSE Tumbleweed RISC-V KDE Plasma 6.8.2 Session..." | tee /root/opensuse-kde-session.log

for bin in plasmashell konsole dolphin; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "[openSUSE KDE Launcher ERROR] Missing required binary: $bin" | tee -a /root/opensuse-kde-session.log >&2
    exit 1
  fi
done
echo "[openSUSE KDE Launcher] Preflight verified: plasmashell, konsole, dolphin installed." | tee -a /root/opensuse-kde-session.log

# 1. Ensure /etc/machine-id and D-Bus system + session buses
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
  echo "[openSUSE KDE Launcher] rvgpu active ($VTEST_SOCKET_NAME, GALLIUM_DRIVER=virpipe)" >> /root/opensuse-kde-session.log
else
  echo "[openSUSE KDE Launcher] rvgpu unavailable; using software QML fallback" >> /root/opensuse-kde-session.log
fi

# 3. Build KService 6 cache in background if missing
if ! ls /root/.cache/ksycoca6_* >/dev/null 2>&1 && command -v kbuildsycoca6 >/dev/null 2>&1; then
  kbuildsycoca6 >> /root/opensuse-kde-session.log 2>&1 &
fi

# 4. Start WebLinux Wayland/KWin compositor (wlserver in WLSERVER_SHELL=plasma mode)
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
  echo "[openSUSE KDE Launcher ERROR] Wayland display socket $XDG_RUNTIME_DIR/$WAYLAND_DISPLAY did not start" | tee -a /root/opensuse-kde-session.log >&2
  exit 1
fi

echo "[openSUSE KDE Launcher] Wayland display $WAYLAND_DISPLAY ready. Launching Plasma 6.8.2..." | tee -a /root/opensuse-kde-session.log
QT_QUICK_BACKEND=software QMLSCENE_DEVICE=softwarecontext LIBGL_ALWAYS_SOFTWARE=1 nohup plasmashell --no-respawn > /tmp/plasma-shell.log 2> /tmp/qt.log &
sleep 2
echo "[openSUSE KDE Launcher] Plasma 6.8.2 session started (PID $!)." | tee -a /root/opensuse-kde-session.log
EOF
chmod +x "$R/usr/local/bin/opensuse-kde-session"

cleanup
echo "OPENSUSE_ADAPT_DONE"
du -sh "$R"
