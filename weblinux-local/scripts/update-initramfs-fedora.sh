#!/usr/bin/env bash
set -euo pipefail

INITRD="/mnt/e/Web-Linux/weblinux-local/apps/web/public/runtime/initramfs-wasm64_nommu.cpio.gz"
WORK="/tmp/initrd-fedora"

rm -rf "$WORK"
mkdir -p "$WORK"
cd "$WORK"
gzip -dc "$INITRD" | cpio -idmu 2>/dev/null

# 1. Create /bin/fedora-root
cat <<'EOF' > "$WORK/bin/fedora-root"
#!/bin/sh
# Run a command inside the Fedora 45 RISC-V root on /fedora.

if [ ! -x /fedora/usr/bin/bash ] || [ ! -x /fedora/lib/ld-linux-riscv64-lp64d.so.1 ]; then
	echo "fedora-root: /fedora does not look like a Fedora RISC-V rootfs" >&2
	exit 1
fi

mkdir -p /fedora/proc /fedora/sys /fedora/dev /fedora/dev/pts /fedora/run /fedora/tmp /fedora/root
chmod 1777 /fedora/tmp 2>/dev/null || true

if [ ! -e /fedora/proc/mounts ]; then
	mount -t proc none /fedora/proc 2>/dev/null || true
fi
if [ ! -d /fedora/sys/kernel ]; then
	mount -t sysfs none /fedora/sys 2>/dev/null || true
fi
if [ ! -c /fedora/dev/null ]; then
	mount -t tmpfs none /fedora/dev 2>/dev/null || true
	cp -a /dev/null /dev/zero /dev/urandom /dev/random /dev/tty /dev/console /dev/ptmx /fedora/dev/ 2>/dev/null || true
	mkdir -p /fedora/dev/pts /fedora/dev/shm /fedora/dev/input
	mknod -m 660 /fedora/dev/input/event0 c 13 64 2>/dev/null || true
	mknod -m 660 /fedora/dev/input/event1 c 13 65 2>/dev/null || true
	mknod -m 660 /fedora/dev/input/event2 c 13 66 2>/dev/null || true
	chmod 1777 /fedora/dev/shm 2>/dev/null || true
fi
if [ ! -e /fedora/dev/pts/ptmx ]; then
	mount -t devpts none /fedora/dev/pts -o newinstance,ptmxmode=0666 2>/dev/null || \
	mount -t devpts none /fedora/dev/pts 2>/dev/null || true
fi
if ! grep -q " /fedora/run " /proc/mounts 2>/dev/null; then
	mount -t tmpfs none /fedora/run 2>/dev/null || true
	mkdir -p /fedora/run/dbus /fedora/run/lock
fi
if ! grep -q " /fedora/tmp " /proc/mounts 2>/dev/null; then
	mount -t tmpfs -o mode=1777 none /fedora/tmp 2>/dev/null || true
fi

for dir in hostnode wlserver rvgpu hostopen; do
	if [ -d "/usr/lib/$dir" ] && ! grep -q " /fedora/run/$dir " /proc/mounts 2>/dev/null; then
		mkdir -p "/fedora/run/$dir"
		mount -o bind "/usr/lib/$dir" "/fedora/run/$dir" 2>/dev/null || cp -a "/usr/lib/$dir/." "/fedora/run/$dir/" 2>/dev/null || true
	fi
done

if [ -f /etc/resolv.conf ] && [ ! -f /fedora/etc/resolv.conf.weblinux ]; then
	cp /etc/resolv.conf /fedora/etc/resolv.conf 2>/dev/null || true
fi

ENV="HOME=/root SHELL=/bin/bash USER=root LOGNAME=root TERM=${TERM:-xterm-256color} LANG=C.UTF-8 XDG_RUNTIME_DIR=/tmp/runtime-root WAYLAND_DISPLAY=wayland-0 QT_QPA_PLATFORM=wayland DBUS_SESSION_BUS_ADDRESS=unix:path=/tmp/runtime-root/bus PATH=/run/hostopen/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

if [ $# -eq 0 ]; then
	exec env -i $ENV chroot /fedora /usr/bin/bash -l
fi

exec env -i $ENV chroot /fedora /usr/bin/bash -c "$*"
EOF
chmod +x "$WORK/bin/fedora-root"

# 2. Create /bin/fedora-kde
cat <<'EOF' > "$WORK/bin/fedora-kde"
#!/bin/sh
# Launch Fedora 45 RISC-V KDE Plasma 6 session

if [ ! -x /fedora/usr/bin/plasmashell ]; then
	echo "fedora-kde: KDE Plasma not found in /fedora" >&2
	exit 1
fi

/bin/fedora-root true || exit 1

if [ $# -eq 0 ]; then
	set -- /usr/local/bin/fedora-kde-session
fi

exec /bin/fedora-root "$@"
EOF
chmod +x "$WORK/bin/fedora-kde"

# 3. Patch /init for fedora* alongside opensuse*, arch*, ubuntu*, and debian (idempotent)
python3 - <<'PY'
p = "/tmp/initrd-fedora/init"
s = open(p).read()

if "fedora*)" not in s:
    s = s.replace(
        'opensuse*)\n\t\tmkdir -p /opensuse\n\t\tmount -t ext4 -o noatime /dev/wda /opensuse\n\t\t;;',
        'opensuse*)\n\t\tmkdir -p /opensuse\n\t\tmount -t ext4 -o noatime /dev/wda /opensuse\n\t\t;;\n\tfedora*)\n\t\tmkdir -p /fedora\n\t\tmount -t ext4 -o noatime /dev/wda /fedora\n\t\t;;'
    )
    s = s.replace(
        'opensuse*) target_root="/opensuse/root" ;;',
        'opensuse*) target_root="/opensuse/root" ;;\nfedora*) target_root="/fedora/root" ;;'
    )
    s = s.replace(
        'opensuse*)\n\techo "autostart: openSUSE Tumbleweed RISC-V runtime ready."\n\texport PATH=/sbin:/usr/sbin:/bin:/usr/bin\n\t/bin/opensuse-root true < /dev/null > /dev/console 2>&1\n\t;;',
        'opensuse*)\n\techo "autostart: openSUSE Tumbleweed RISC-V runtime ready."\n\texport PATH=/sbin:/usr/sbin:/bin:/usr/bin\n\t/bin/opensuse-root true < /dev/null > /dev/console 2>&1\n\t;;\nfedora*)\n\techo "autostart: Fedora 45 RISC-V runtime ready."\n\texport PATH=/sbin:/usr/sbin:/bin:/usr/bin\n\t/bin/fedora-root true < /dev/null > /dev/console 2>&1\n\t;;'
    )
    open(p, "w").write(s)
PY

# 4. Repack cpio.gz
(cd "$WORK" && find . -print0 | cpio --null -o -H newc 2>/dev/null > /tmp/initrd-fedora.cpio)
gzip -9 -n -c /tmp/initrd-fedora.cpio > "$INITRD"

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

rm -rf "$WORK" /tmp/initrd-fedora.cpio
