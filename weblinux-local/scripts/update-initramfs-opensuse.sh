#!/usr/bin/env bash
set -euo pipefail

INITRD="/mnt/e/Web-Linux/weblinux-local/apps/web/public/runtime/initramfs-wasm64_nommu.cpio.gz"
WORK="/tmp/initrd-opensuse"

rm -rf "$WORK"
mkdir -p "$WORK"
cd "$WORK"
gzip -dc "$INITRD" | cpio -idmu 2>/dev/null

# 1. Create /bin/opensuse-root
cat <<'EOF' > "$WORK/bin/opensuse-root"
#!/bin/sh
# Run a command inside the openSUSE Tumbleweed RISC-V root on /opensuse.

if [ ! -x /opensuse/usr/bin/bash ] || [ ! -x /opensuse/lib/ld-linux-riscv64-lp64d.so.1 ]; then
	echo "opensuse-root: /opensuse does not look like an openSUSE RISC-V rootfs" >&2
	exit 1
fi

mkdir -p /opensuse/proc /opensuse/sys /opensuse/dev /opensuse/dev/pts /opensuse/run /opensuse/tmp /opensuse/root
chmod 1777 /opensuse/tmp 2>/dev/null || true

if [ ! -e /opensuse/proc/mounts ]; then
	mount -t proc none /opensuse/proc 2>/dev/null || true
fi
if [ ! -d /opensuse/sys/kernel ]; then
	mount -t sysfs none /opensuse/sys 2>/dev/null || true
fi
if [ ! -c /opensuse/dev/null ]; then
	mount -t tmpfs none /opensuse/dev 2>/dev/null || true
	cp -a /dev/null /dev/zero /dev/urandom /dev/random /dev/tty /dev/console /dev/ptmx /opensuse/dev/ 2>/dev/null || true
	mkdir -p /opensuse/dev/pts /opensuse/dev/shm /opensuse/dev/input
	mknod -m 660 /opensuse/dev/input/event0 c 13 64 2>/dev/null || true
	mknod -m 660 /opensuse/dev/input/event1 c 13 65 2>/dev/null || true
	mknod -m 660 /opensuse/dev/input/event2 c 13 66 2>/dev/null || true
	chmod 1777 /opensuse/dev/shm 2>/dev/null || true
fi
if [ ! -e /opensuse/dev/pts/ptmx ]; then
	mount -t devpts none /opensuse/dev/pts -o newinstance,ptmxmode=0666 2>/dev/null || \
	mount -t devpts none /opensuse/dev/pts 2>/dev/null || true
fi
if ! grep -q " /opensuse/run " /proc/mounts 2>/dev/null; then
	mount -t tmpfs none /opensuse/run 2>/dev/null || true
	mkdir -p /opensuse/run/dbus /opensuse/run/lock
fi
if ! grep -q " /opensuse/tmp " /proc/mounts 2>/dev/null; then
	mount -t tmpfs -o mode=1777 none /opensuse/tmp 2>/dev/null || true
fi

for dir in hostnode wlserver rvgpu hostopen; do
	if [ -d "/usr/lib/$dir" ] && ! grep -q " /opensuse/run/$dir " /proc/mounts 2>/dev/null; then
		mkdir -p "/opensuse/run/$dir"
		mount -o bind "/usr/lib/$dir" "/opensuse/run/$dir" 2>/dev/null || cp -a "/usr/lib/$dir/." "/opensuse/run/$dir/" 2>/dev/null || true
	fi
done

# Ensure DNS resolver points to WebLinux guest-net-relay gateway
if [ -f /etc/resolv.conf ] && [ ! -f /opensuse/etc/resolv.conf.weblinux ]; then
	cp /etc/resolv.conf /opensuse/etc/resolv.conf 2>/dev/null || true
fi

ENV="HOME=/root SHELL=/bin/bash USER=root LOGNAME=root TERM=${TERM:-xterm-256color} LANG=C.UTF-8 XDG_RUNTIME_DIR=/tmp/runtime-root WAYLAND_DISPLAY=wayland-0 QT_QPA_PLATFORM=wayland DBUS_SESSION_BUS_ADDRESS=unix:path=/tmp/runtime-root/bus PATH=/run/hostopen/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

if [ $# -eq 0 ]; then
	exec env -i $ENV chroot /opensuse /usr/bin/bash -l
fi

exec env -i $ENV chroot /opensuse /usr/bin/bash -c "$*"
EOF
chmod +x "$WORK/bin/opensuse-root"

# 2. Create /bin/opensuse-kde
cat <<'EOF' > "$WORK/bin/opensuse-kde"
#!/bin/sh
# Launch openSUSE Tumbleweed RISC-V KDE Plasma 6 session

if [ ! -x /opensuse/usr/bin/plasmashell ]; then
	echo "opensuse-kde: KDE Plasma not found in /opensuse" >&2
	exit 1
fi

/bin/opensuse-root true || exit 1

if [ $# -eq 0 ]; then
	set -- /usr/local/bin/opensuse-kde-session
fi

exec /bin/opensuse-root "$@"
EOF
chmod +x "$WORK/bin/opensuse-kde"

# 3. Patch /init for opensuse* alongside arch*, ubuntu*, and debian (idempotent)
python3 - <<'PY'
p = "/tmp/initrd-opensuse/init"
s = open(p).read()

if "opensuse*)" not in s:
    s = s.replace(
        'arch*)\n\t\tmkdir -p /arch\n\t\tmount -t ext4 -o noatime /dev/wda /arch\n\t\t;;',
        'arch*)\n\t\tmkdir -p /arch\n\t\tmount -t ext4 -o noatime /dev/wda /arch\n\t\t;;\n\topensuse*)\n\t\tmkdir -p /opensuse\n\t\tmount -t ext4 -o noatime /dev/wda /opensuse\n\t\t;;'
    )
    s = s.replace(
        'arch*) target_root="/arch/root" ;;',
        'arch*) target_root="/arch/root" ;;\nopensuse*) target_root="/opensuse/root" ;;'
    )
    s = s.replace(
        'arch*)\n\techo "autostart: Arch Linux RISC-V (RV64GC) runtime ready."\n\texport PATH=/sbin:/usr/sbin:/bin:/usr/bin\n\t/bin/arch-root true < /dev/null > /dev/console 2>&1\n\t;;',
        'arch*)\n\techo "autostart: Arch Linux RISC-V (RV64GC) runtime ready."\n\texport PATH=/sbin:/usr/sbin:/bin:/usr/bin\n\t/bin/arch-root true < /dev/null > /dev/console 2>&1\n\t;;\nopensuse*)\n\techo "autostart: openSUSE Tumbleweed RISC-V runtime ready."\n\texport PATH=/sbin:/usr/sbin:/bin:/usr/bin\n\t/bin/opensuse-root true < /dev/null > /dev/console 2>&1\n\t;;'
    )
    open(p, "w").write(s)
PY

# 4. Repack cpio.gz
(cd "$WORK" && find . -print0 | cpio --null -o -H newc 2>/dev/null > /tmp/initrd-opensuse.cpio)
gzip -9 -n -c /tmp/initrd-opensuse.cpio > "$INITRD"

python3 - <<'PY'
import hashlib, os, gzip
p = "/mnt/e/Web-Linux/weblinux-local/apps/web/public/runtime/initramfs-wasm64_nommu.cpio.gz"
gz = open(p, "rb").read()
raw = gzip.decompress(gz)
print("COMPRESSED_SIZE=", len(gz))
print("COMPRESSED_SHA256=", hashlib.sha256(gz).hexdigest())
print("UNCOMPRESSED_SIZE=", len(raw))
print("UNCOMPRESSED_SHA256=", hashlib.sha256(raw).hexdigest())
PY

rm -rf "$WORK" /tmp/initrd-opensuse.cpio
