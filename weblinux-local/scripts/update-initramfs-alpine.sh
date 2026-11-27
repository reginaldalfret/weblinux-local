#!/usr/bin/env bash
set -euo pipefail

INITRD="/mnt/e/Web-Linux/weblinux-local/apps/web/public/runtime/initramfs-wasm64_nommu.cpio.gz"
WORK="/tmp/initrd-alpine"

rm -rf "$WORK"
mkdir -p "$WORK"
cd "$WORK"
gzip -dc "$INITRD" | cpio -idmu 2>/dev/null

# 1. Create /bin/alpine-root
cat <<'EOF' > "$WORK/bin/alpine-root"
#!/bin/sh
# Run a command inside the Alpine Linux 3.24.4 RISC-V root on /alpine.

if [ ! -x /alpine/bin/busybox ] || [ ! -x /alpine/lib/ld-musl-riscv64.so.1 ]; then
	echo "alpine-root: /alpine does not look like an Alpine RISC-V rootfs" >&2
	exit 1
fi

mkdir -p /alpine/proc /alpine/sys /alpine/dev /alpine/dev/pts /alpine/run /alpine/tmp /alpine/root
chmod 1777 /alpine/tmp 2>/dev/null || true

if [ ! -e /alpine/proc/mounts ]; then
	mount -t proc none /alpine/proc 2>/dev/null || true
fi
if [ ! -d /alpine/sys/kernel ]; then
	mount -t sysfs none /alpine/sys 2>/dev/null || true
fi
if [ ! -c /alpine/dev/null ]; then
	mount -t tmpfs none /alpine/dev 2>/dev/null || true
	cp -a /dev/null /dev/zero /dev/urandom /dev/random /dev/tty /dev/console /dev/ptmx /alpine/dev/ 2>/dev/null || true
	mkdir -p /alpine/dev/pts /alpine/dev/shm /alpine/dev/input
	mknod -m 660 /alpine/dev/input/event0 c 13 64 2>/dev/null || true
	mknod -m 660 /alpine/dev/input/event1 c 13 65 2>/dev/null || true
	mknod -m 660 /alpine/dev/input/event2 c 13 66 2>/dev/null || true
	chmod 1777 /alpine/dev/shm 2>/dev/null || true
fi
if [ ! -e /alpine/dev/pts/ptmx ]; then
	mount -t devpts none /alpine/dev/pts -o newinstance,ptmxmode=0666 2>/dev/null || \
	mount -t devpts none /alpine/dev/pts 2>/dev/null || true
fi
if ! grep -q " /alpine/run " /proc/mounts 2>/dev/null; then
	mount -t tmpfs none /alpine/run 2>/dev/null || true
	mkdir -p /alpine/run/dbus /alpine/run/lock
fi
if ! grep -q " /alpine/tmp " /proc/mounts 2>/dev/null; then
	mount -t tmpfs -o mode=1777 none /alpine/tmp 2>/dev/null || true
fi

for dir in hostnode wlserver rvgpu hostopen; do
	if [ -d "/usr/lib/$dir" ] && ! grep -q " /alpine/run/$dir " /proc/mounts 2>/dev/null; then
		mkdir -p "/alpine/run/$dir"
		mount -o bind "/usr/lib/$dir" "/alpine/run/$dir" 2>/dev/null || cp -a "/usr/lib/$dir/." "/alpine/run/$dir/" 2>/dev/null || true
	fi
done

if [ -f /etc/resolv.conf ] && [ ! -f /alpine/etc/resolv.conf.weblinux ]; then
	cp /etc/resolv.conf /alpine/etc/resolv.conf 2>/dev/null || true
fi

SHELL_BIN="/bin/sh"
[ -x /alpine/bin/bash ] && SHELL_BIN="/bin/bash"

ENV="HOME=/root SHELL=$SHELL_BIN USER=root LOGNAME=root TERM=${TERM:-xterm-256color} LANG=C.UTF-8 XDG_RUNTIME_DIR=/tmp/runtime-root WAYLAND_DISPLAY=wayland-0 QT_QPA_PLATFORM=wayland DBUS_SESSION_BUS_ADDRESS=unix:path=/tmp/runtime-root/bus PATH=/run/hostopen/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

if [ $# -eq 0 ]; then
	exec env -i $ENV chroot /alpine "$SHELL_BIN" -l
fi

exec env -i $ENV chroot /alpine "$SHELL_BIN" -c "$*"
EOF
chmod +x "$WORK/bin/alpine-root"

# 2. Create /bin/alpine-kde
cat <<'EOF' > "$WORK/bin/alpine-kde"
#!/bin/sh
# Launch Alpine Linux 3.24.4 RISC-V KDE Plasma 6 session

if [ ! -x /alpine/usr/bin/plasmashell ]; then
	echo "alpine-kde: KDE Plasma not found in /alpine" >&2
	exit 1
fi

/bin/alpine-root true || exit 1

if [ $# -eq 0 ]; then
	set -- /usr/local/bin/alpine-kde-session
fi

exec /bin/alpine-root "$@"
EOF
chmod +x "$WORK/bin/alpine-kde"

# 3. Patch /init for alpine* alongside fedora*, opensuse*, arch*, ubuntu*, and debian (idempotent)
python3 - <<'PY'
p = "/tmp/initrd-alpine/init"
s = open(p).read()

if "alpine*)" not in s:
    s = s.replace(
        'fedora*)\n\t\tmkdir -p /fedora\n\t\tmount -t ext4 -o noatime /dev/wda /fedora\n\t\t;;',
        'fedora*)\n\t\tmkdir -p /fedora\n\t\tmount -t ext4 -o noatime /dev/wda /fedora\n\t\t;;\n\talpine*)\n\t\tmkdir -p /alpine\n\t\tmount -t ext4 -o noatime /dev/wda /alpine\n\t\t;;'
    )
    s = s.replace(
        'fedora*) target_root="/fedora/root" ;;',
        'fedora*) target_root="/fedora/root" ;;\nalpine*) target_root="/alpine/root" ;;'
    )
    s = s.replace(
        'fedora*)\n\techo "autostart: Fedora 45 RISC-V runtime ready."\n\texport PATH=/sbin:/usr/sbin:/bin:/usr/bin\n\t/bin/fedora-root true < /dev/null > /dev/console 2>&1\n\t;;',
        'fedora*)\n\techo "autostart: Fedora 45 RISC-V runtime ready."\n\texport PATH=/sbin:/usr/sbin:/bin:/usr/bin\n\t/bin/fedora-root true < /dev/null > /dev/console 2>&1\n\t;;\nalpine*)\n\techo "autostart: Alpine 3.24.4 RISC-V runtime ready."\n\texport PATH=/sbin:/usr/sbin:/bin:/usr/bin\n\t/bin/alpine-root true < /dev/null > /dev/console 2>&1\n\t;;'
    )
    open(p, "w").write(s)
PY

# 4. Repack cpio.gz
(cd "$WORK" && find . -print0 | cpio --null -o -H newc 2>/dev/null > /tmp/initrd-alpine.cpio)
gzip -9 -n -c /tmp/initrd-alpine.cpio > "$INITRD"

python3 - <<'PY'
import hashlib, gzip
p = "/mnt/e/Web-Linux/weblinux-local/apps/web/public/runtime/initramfs-wasm64_nommu.cpio.gz"
gz = open(p, "rb").read()
raw = gzip.decompress(gz)
print("COMPRESSED_SIZE=", len(gz))
print("COMPRESSED_SHA256=", hashlib.sha256(gz).hexdigest())
print("UNCOMPRESSED_SIZE=", len(raw))
print("UNCOMPRESSED_SHA256=", hashlib.sha256(raw).hexdigest())
PY

rm -rf "$WORK" /tmp/initrd-alpine.cpio
