#!/bin/bash
set -euo pipefail
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

ROOTFS="/root/arch-test/rootfs"
PKG_ARCHIVE="/mnt/d/weblinux-build/arch-pkg-cache"
IMG="/root/arch-test/arch-kde.ext4"
CHUNKS="/mnt/d/weblinux-disks/arch-kde"
PUB="/mnt/e/Web-Linux/weblinux-local/apps/web/public/disk/arch-kde"

echo "=== [1/4] Archiving signed pacman packages & preparing Arch KDE session ==="
mkdir -p "$PKG_ARCHIVE" "$CHUNKS" "$PUB" "$ROOTFS/usr/local/bin" "$ROOTFS/root"
if [ -d "$ROOTFS/var/cache/pacman/pkg" ]; then
  mv "$ROOTFS/var/cache/pacman/pkg/"* "$PKG_ARCHIVE/" 2>/dev/null || true
fi

# Basic Arch system config for WebLinux
echo "archriscv" > "$ROOTFS/etc/hostname"
echo "LANG=C.UTF-8" > "$ROOTFS/etc/locale.conf"
cat <<'EOF' > "$ROOTFS/etc/hosts"
127.0.0.1 localhost
127.0.1.1 archriscv
EOF
echo "nameserver 10.0.5.1" > "$ROOTFS/etc/resolv.conf"

# Disable non-functional setuid UDisks2 D-Bus activation inside NOMMU guest
rm -f "$ROOTFS/usr/share/dbus-1/system-services/org.freedesktop.UDisks2.service" 2>/dev/null || true

# Install Arch KDE Plasma 6 session supervisor
cat <<'EOF' > "$ROOTFS/usr/local/bin/arch-kde-session"
#!/bin/sh
echo "[Arch KDE Launcher] Initializing Arch Linux RISC-V KDE Plasma 6.8.3 Session..." > /root/arch-kde-session.log
MISSING=""
for b in plasmashell konsole dolphin; do
  if ! command -v "$b" >/dev/null 2>&1; then MISSING="$MISSING $b"; fi
done
if [ -n "$MISSING" ]; then
  echo "[Arch KDE Launcher ERROR] Required KDE components missing: $MISSING" | tee -a /root/arch-kde-session.log >&2
  exit 127
fi
echo "[Arch KDE Launcher] Preflight verified: plasmashell, konsole, dolphin installed." | tee -a /root/arch-kde-session.log

export HOME=/root USER=root SHELL=/bin/bash LANG=C.UTF-8
export XDG_RUNTIME_DIR=/tmp/runtime-root
export WAYLAND_DISPLAY=wayland-0
export DISPLAY=:0
export XDG_SESSION_TYPE=wayland
export XDG_CURRENT_DESKTOP=KDE
export KDE_FULL_SESSION=true
export KDE_SESSION_VERSION=6
export QT_QPA_PLATFORM=wayland
export QT_QUICK_BACKEND=software
export QMLSCENE_DEVICE=softwarecontext
export LIBGL_ALWAYS_SOFTWARE=1
export QV4_FORCE_INTERPRETER=1
export NO_AT_BRIDGE=1
mkdir -p -m 700 "$XDG_RUNTIME_DIR"

# 1. Disable non-functional setuid UDisks2 D-Bus activation
rm -f /usr/share/dbus-1/system-services/org.freedesktop.UDisks2.service 2>/dev/null || true

# 2. System & session D-Bus
grep -q '^dbus:' /etc/passwd 2>/dev/null || echo 'dbus:x:81:81:System Message Bus:/:/usr/bin/nologin' >> /etc/passwd
grep -q '^dbus:' /etc/group 2>/dev/null || echo 'dbus:x:81:' >> /etc/group
mkdir -p /run/dbus /var/run
[ -e /var/run/dbus ] || ln -s /run/dbus /var/run/dbus
[ -S /run/dbus/system_bus_socket ] || dbus-daemon --system --fork --nopidfile > /root/dbus.log 2>&1 || true
export DBUS_SYSTEM_BUS_ADDRESS="unix:path=/run/dbus/system_bus_socket"
if [ ! -S "$XDG_RUNTIME_DIR/bus" ]; then
  dbus-daemon --session --fork --address="unix:path=$XDG_RUNTIME_DIR/bus" >> /root/dbus.log 2>&1 || true
fi
export DBUS_SESSION_BUS_ADDRESS="unix:path=$XDG_RUNTIME_DIR/bus"

# 3. Start WebLinux GPU server (rvgpu -> WebGL2/WebGPU) if available
if [ -x /run/hostnode/hostnode ] && [ -f /run/rvgpu/boot.js ] && [ ! -S "$XDG_RUNTIME_DIR/rvgpu-0" ]; then
  rm -f "$XDG_RUNTIME_DIR/rvgpu-0.ready" "$XDG_RUNTIME_DIR/rvgpu-0.none"
  HOSTNODE_HOME=/run/rvgpu /run/hostnode/hostnode > /root/rvgpu.log 2>&1 &
  g=0
  while [ ! -f "$XDG_RUNTIME_DIR/rvgpu-0.ready" ] && [ ! -f "$XDG_RUNTIME_DIR/rvgpu-0.none" ] && [ $g -lt 20 ]; do
    sleep 0.1
    g=$((g + 1))
  done
fi
if [ -f "$XDG_RUNTIME_DIR/rvgpu-0.ready" ]; then
  export GALLIUM_DRIVER=virpipe
  export VTEST_SOCKET_NAME="$XDG_RUNTIME_DIR/rvgpu-0"
  unset LIBGL_ALWAYS_SOFTWARE QT_QUICK_BACKEND QMLSCENE_DEVICE
  export QSG_INFO=1
  echo "[Arch KDE Launcher] rvgpu active ($VTEST_SOCKET_NAME, GALLIUM_DRIVER=virpipe, OpenGL QSG)" >> /root/arch-kde-session.log
else
  echo "[Arch KDE Launcher] rvgpu unavailable; using software QML fallback" >> /root/arch-kde-session.log
fi

# 4. Build KService 6 cache in background if missing
if ! ls /root/.cache/ksycoca6_* >/dev/null 2>&1 && command -v kbuildsycoca6 >/dev/null 2>&1; then
  kbuildsycoca6 >> /root/arch-kde-session.log 2>&1 &
fi

# 5. Start WebLinux Wayland/KWin compositor (wlserver in WLSERVER_SHELL=plasma mode)
if [ ! -S "$XDG_RUNTIME_DIR/$WAYLAND_DISPLAY" ]; then
  if [ -x /run/hostnode/hostnode ] && [ -d /run/wlserver ]; then
    echo "plasma" > "$XDG_RUNTIME_DIR/wlserver.shell"
    WLSERVER_SHELL=plasma HOSTNODE_HOME=/run/wlserver /run/hostnode/hostnode > /root/kwin.log 2>&1 &
    i=0
    while [ ! -S "$XDG_RUNTIME_DIR/$WAYLAND_DISPLAY" ] && [ $i -lt 50 ]; do
      sleep 0.1
      i=$((i + 1))
    done
  fi
fi

if [ ! -S "$XDG_RUNTIME_DIR/$WAYLAND_DISPLAY" ]; then
  echo "[Arch KDE Launcher ERROR] Wayland display socket $XDG_RUNTIME_DIR/$WAYLAND_DISPLAY did not start" | tee -a /root/arch-kde-session.log >&2
  exit 1
fi

echo "[Arch KDE Launcher] Wayland display $WAYLAND_DISPLAY ready. Launching Plasma 6.8.3..." | tee -a /root/arch-kde-session.log
# Keep gpuserver (rvgpu-0) active for virpipe GL apps (es2_info, es2gears_wayland),
# while running plasmashell (Qt 6.12 QRhi) on software QML so it does not drop the rvgpu fd.
QT_QUICK_BACKEND=software QMLSCENE_DEVICE=softwarecontext LIBGL_ALWAYS_SOFTWARE=1 nohup plasmashell --no-respawn > /root/plasma-shell.log 2> /root/qt.log &
sleep 2
echo "[Arch KDE Launcher] Plasma 6.8.3 session started (PID $!)." | tee -a /root/arch-kde-session.log
EOF
chmod +x "$ROOTFS/usr/local/bin/arch-kde-session"

echo "=== [2/4] Sizing & formatting 5.0 GiB ext4 image ==="
du -sh "$ROOTFS"
rm -f "$IMG"
truncate -s 5368709120 "$IMG"
mke2fs -t ext4 -d "$ROOTFS" -L arch-kde -m 1 -O ^metadata_csum_seed "$IMG"

echo "=== [3/4] Running e2fsck ==="
e2fsck -fy "$IMG"

echo "=== [4/4] Slicing 5120 x 1 MiB chunks & writing manifest ==="
python3 - <<'PY'
import os, json, hashlib
IMG = "/root/arch-test/arch-kde.ext4"
CHUNKS = "/mnt/d/weblinux-disks/arch-kde"
PUB = "/mnt/e/Web-Linux/weblinux-local/apps/web/public/disk/arch-kde"
SIZE = 5368709120
PIECE = 1048576
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
manifest = {"size": SIZE, "piece": PIECE, "id": full_sha[:32], "hashes": hashes, "boot": boot, "present": present}
integrity = {"distributionId": "arch-kde", "imageSize": SIZE, "chunkCount": TOTAL, "nonZeroChunkCount": len(nz), "fullImageSha256": full_sha}
for d in (CHUNKS, PUB):
    with open(os.path.join(d, "manifest.json"), "w") as mf: json.dump(manifest, mf, indent=2)
    with open(os.path.join(d, "integrity.json"), "w") as inf: json.dump(integrity, inf, indent=2)
print(f"DONE: total={TOTAL} nonzero={len(nz)} boot={len(boot)} sha256={full_sha}")
PY
rm -f "$IMG"
