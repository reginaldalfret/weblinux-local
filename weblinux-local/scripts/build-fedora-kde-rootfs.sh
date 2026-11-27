#!/usr/bin/env bash
set -euo pipefail

R="/root/fedora-build/rootfs"
cp /usr/bin/qemu-riscv64-static "$R/usr/bin/qemu-riscv64-static"
cleanup() {
  rm -f "$R/usr/bin/qemu-riscv64-static"
}
trap cleanup EXIT

printf "nameserver 1.1.1.1\nnameserver 8.8.8.8\n" > "$R/etc/resolv.conf"

DNF_OPTS=(
  --installroot="$R"
  --forcearch=riscv64
  --releasever=45
  --setopt=reposdir="$R/usr/share/dnf5/repos.d"
  --setopt=minrate=100
  --setopt=timeout=120
  --setopt=retries=20
  --setopt=keepcache=True
  --setopt=max_parallel_downloads=2
  --setopt=install_weak_deps=False
  -y
)

for attempt in 1 2 3 4; do
  if dnf5 "${DNF_OPTS[@]}" install \
    plasma-workspace plasma-desktop kwin dolphin konsole \
    breeze-icon-theme plasma-breeze qt6-qtwayland \
    mesa-dri-drivers dbus-daemon dejavu-sans-fonts \
    shadow-utils passwd procps-ng iproute; then
    break
  fi
  echo "dnf5 install attempt $attempt failed; retrying with cached packages..."
  sleep 3
done

# Optional GL/EGL demo package if available
dnf5 "${DNF_OPTS[@]}" install mesa-demos 2>/dev/null || true

# Verify Fedora 45 GPG key fingerprint and import into RPM DB
KEY="$R/usr/share/pki/rpm-gpg/RPM-GPG-KEY-fedora-45-primary"
EXPECTED_FP="4F50A6114CD5C6976A7F1179655A4B02F577861E"
ACTUAL_FP=$(gpg --show-keys --with-colons "$KEY" | python3 -c 'import sys; print(next(l.split(":")[9] for l in sys.stdin if l.startswith("fpr:")))')
if [ "$ACTUAL_FP" != "$EXPECTED_FP" ]; then
  echo "ERROR: Fedora 45 GPG key fingerprint mismatch: $ACTUAL_FP != $EXPECTED_FP" >&2
  exit 1
fi
rpmkeys --root "$R" --import "$KEY"

# Harden DNF5 repository configuration via /etc/dnf/repos.override.d/ (keep /usr/share/dnf5/repos.d/ intact)
rm -f "$R/etc/yum.repos.d/fedora.repo" "$R/etc/yum.repos.d/fedora-staging.repo" "$R/etc/yum.repos.d/fedora-koji.repo"
mkdir -p "$R/etc/dnf/repos.override.d"
cat <<'EOF' > "$R/etc/dnf/repos.override.d/99-weblinux-security.repo"
[fedora]
enabled=1
gpgcheck=1
sslverify=1
skip_if_unavailable=0
gpgkey=file:///usr/share/pki/rpm-gpg/RPM-GPG-KEY-fedora-45-primary

[fedora-staging]
enabled=0
gpgcheck=1
sslverify=1

[fedora-koji]
enabled=0
gpgcheck=1
sslverify=1

[fedora-debuginfo]
enabled=0
gpgcheck=1
sslverify=1

[fedora-source]
enabled=0
gpgcheck=1
sslverify=1

[fedora-staging-debuginfo]
enabled=0
gpgcheck=1
sslverify=1

[fedora-staging-source]
enabled=0
gpgcheck=1
sslverify=1
EOF

# Lock root password, ensure machine-id, clean dnf cache, capture package lock
chroot "$R" /usr/bin/qemu-riscv64-static /usr/bin/bash -c "
  set -euo pipefail
  passwd -l root
  mkdir -p /var/lib/dbus /run/dbus
  [ -s /etc/machine-id ] || rm -f /etc/machine-id
  [ -s /var/lib/dbus/machine-id ] || rm -f /var/lib/dbus/machine-id
  dbus-uuidgen --ensure=/etc/machine-id
  dbus-uuidgen --ensure=/var/lib/dbus/machine-id
  rpm -qa | sort > /tmp/fedora-kde-packages.lock
"
dnf5 "${DNF_OPTS[@]}" clean all

cp "$R/tmp/fedora-kde-packages.lock" /mnt/e/Web-Linux/weblinux-local/docs/phase-11/fedora-kde-packages.lock
rm -f "$R/tmp/fedora-kde-packages.lock"

# Write WebLinux Fedora 45 KDE Plasma 6 session supervisor
mkdir -p "$R/usr/local/bin"
cat <<'EOF' > "$R/usr/local/bin/fedora-kde-session"
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

echo "[Fedora KDE Launcher] Initializing Fedora 45 RISC-V KDE Plasma 6 Session..." | tee /root/fedora-kde-session.log

for bin in plasmashell konsole dolphin; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "[Fedora KDE Launcher ERROR] Missing required binary: $bin" | tee -a /root/fedora-kde-session.log >&2
    exit 1
  fi
done
echo "[Fedora KDE Launcher] Preflight verified: plasmashell, konsole, dolphin installed." | tee -a /root/fedora-kde-session.log

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
  echo "[Fedora KDE Launcher] rvgpu active ($VTEST_SOCKET_NAME, GALLIUM_DRIVER=virpipe)" >> /root/fedora-kde-session.log
else
  echo "[Fedora KDE Launcher] rvgpu unavailable; using software QML fallback" >> /root/fedora-kde-session.log
fi

# 3. Build KService 6 cache in background if missing
if ! ls /root/.cache/ksycoca6_* >/dev/null 2>&1 && command -v kbuildsycoca6 >/dev/null 2>&1; then
  kbuildsycoca6 >> /root/fedora-kde-session.log 2>&1 &
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
  echo "[Fedora KDE Launcher ERROR] Wayland display socket $XDG_RUNTIME_DIR/$WAYLAND_DISPLAY did not start" | tee -a /root/fedora-kde-session.log >&2
  exit 1
fi

echo "[Fedora KDE Launcher] Wayland display $WAYLAND_DISPLAY ready. Launching Plasma 6..." | tee -a /root/fedora-kde-session.log
QT_QUICK_BACKEND=software QMLSCENE_DEVICE=softwarecontext LIBGL_ALWAYS_SOFTWARE=1 nohup plasmashell --no-respawn > /tmp/plasma-shell.log 2> /tmp/qt.log &
sleep 2
echo "[Fedora KDE Launcher] Plasma 6 session started (PID $!)." | tee -a /root/fedora-kde-session.log
EOF
chmod +x "$R/usr/local/bin/fedora-kde-session"

echo "FEDORA_BUILD_DONE"
du -sh "$R"
