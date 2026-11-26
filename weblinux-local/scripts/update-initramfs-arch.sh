#!/bin/bash
set -euo pipefail
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

INITRD="/mnt/e/Web-Linux/weblinux-local/apps/web/public/runtime/initramfs-wasm64_nommu.cpio.gz"
BACKUP="/mnt/d/weblinux-build/initramfs-wasm64_nommu.cpio.gz.bak"
WORK="/tmp/initrd-arch"

[ -f "$BACKUP" ] || cp "$INITRD" "$BACKUP"

rm -rf "$WORK"
mkdir -p "$WORK"
gzip -dc "$BACKUP" | (cd "$WORK" && cpio -idm 2>/dev/null)

# 1. Create /bin/arch-root (leaving /bin/arch -> busybox untouched)
cat <<'EOF' > "$WORK/bin/arch-root"
#!/bin/sh
# `arch-root` on the Linux/Wasm system: enter the Arch Linux riscv64 system in /arch
D=/arch
if [ ! -x $D/usr/bin/bash ]; then
	echo "arch-root: no Arch Linux system mounted at /arch (boot with distro=arch-kde)" >&2
	exit 1
fi

if [ ! -e $D/proc/self ]; then
	mount -t proc none $D/proc
	mount -t sysfs none $D/sys
	mount -t tmpfs none $D/dev
	mount -t tmpfs none $D/run
	mount -t tmpfs -o mode=1777 none $D/tmp
	while read -r name major minor; do
		mknod -m 666 $D/dev/$name c $major $minor
	done <<-END
		null 1 3
		zero 1 5
		full 1 7
		random 1 8
		urandom 1 9
		tty 5 0
		ptmx 5 2
		fb0 29 0
		tty0 4 0
		tty1 4 1
		tty2 4 2
		tty3 4 3
		tty4 4 4
		tty5 4 5
		tty6 4 6
		tty7 4 7
		tty8 4 8
	END
	mkdir -p $D/dev/input $D/dev/pts $D/dev/shm
	mknod -m 660 $D/dev/input/event0 c 13 64
	mknod -m 660 $D/dev/input/event1 c 13 65
	mknod -m 660 $D/dev/input/event2 c 13 66
	mount -t devpts none $D/dev/pts
	if [ -d /dev/snd ]; then
		mkdir -p $D/dev/snd
		cp -a /dev/snd/. $D/dev/snd/
	fi
	if [ -d /usr/lib/hostnode ]; then
		mkdir -p $D/run/hostnode
		mount -o bind /usr/lib/hostnode $D/run/hostnode
	fi
	if [ -d /usr/lib/wlserver ]; then
		mkdir -p $D/run/wlserver
		mount -o bind /usr/lib/wlserver $D/run/wlserver
	fi
	if [ -d /usr/lib/rvgpu ]; then
		mkdir -p $D/run/rvgpu
		mount -o bind /usr/lib/rvgpu $D/run/rvgpu
	fi
	if [ -d /usr/lib/hostopen ]; then
		mkdir -p $D/run/hostopen
		mount -o bind /usr/lib/hostopen $D/run/hostopen
	fi
	cp /etc/resolv.conf $D/etc/resolv.conf 2> /dev/null
	ln -s /proc/self/fd $D/dev/fd 2> /dev/null
	ln -s /proc/self/fd/0 $D/dev/stdin 2> /dev/null
	ln -s /proc/self/fd/1 $D/dev/stdout 2> /dev/null
	ln -s /proc/self/fd/2 $D/dev/stderr 2> /dev/null
fi

ENV="HOME=/root SHELL=/bin/bash USER=root LOGNAME=root TERM=${TERM:-xterm-256color} LANG=C.UTF-8 PATH=/run/hostopen/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
if [ $# -eq 0 ]; then
	exec chroot $D /usr/bin/env -i $ENV /bin/bash -l
fi
exec chroot $D /usr/bin/env -i $ENV /bin/bash -c "$*"
EOF
chmod +x "$WORK/bin/arch-root"

# 2. Create /bin/arch-kde
cat <<'EOF' > "$WORK/bin/arch-kde"
#!/bin/sh
# `/bin/arch-kde` — Dedicated session supervisor for Arch Linux RISC-V KDE Plasma 6
D=/arch
if [ ! -x "$D/usr/bin/bash" ]; then
	echo "arch-kde: no Arch Linux system mounted at /arch (boot with distro=arch-kde)" >&2
	exit 1
fi

/bin/arch-root true || exit 1

if [ $# -eq 0 ]; then
	set -- /usr/local/bin/arch-kde-session
fi

exec /bin/arch-root "$@"
EOF
chmod +x "$WORK/bin/arch-kde"

# 3. Patch /init for arch* alongside ubuntu* and debian
python3 - <<'PY'
p = "/tmp/initrd-arch/init"
s = open(p).read()

s = s.replace(
    'ubuntu*)\n\t\tmkdir -p /ubuntu\n\t\tmount -t ext4 -o noatime /dev/wda /ubuntu\n\t\t;;',
    'ubuntu*)\n\t\tmkdir -p /ubuntu\n\t\tmount -t ext4 -o noatime /dev/wda /ubuntu\n\t\t;;\n\tarch*)\n\t\tmkdir -p /arch\n\t\tmount -t ext4 -o noatime /dev/wda /arch\n\t\t;;'
)
s = s.replace(
    'ubuntu*) target_root="/ubuntu/root" ;;',
    'ubuntu*) target_root="/ubuntu/root" ;;\narch*) target_root="/arch/root" ;;'
)
s = s.replace(
    'ubuntu*)\n\techo "autostart: Ubuntu 24.04.5 LTS (Noble Numbat) RISC-V 64-bit runtime ready."\n\texport PATH=/sbin:/usr/sbin:/bin:/usr/bin\n\t/bin/ubuntu true < /dev/null > /dev/console 2>&1\n\t;;',
    'ubuntu*)\n\techo "autostart: Ubuntu 24.04.5 LTS (Noble Numbat) RISC-V 64-bit runtime ready."\n\texport PATH=/sbin:/usr/sbin:/bin:/usr/bin\n\t/bin/ubuntu true < /dev/null > /dev/console 2>&1\n\t;;\narch*)\n\techo "autostart: Arch Linux RISC-V (RV64GC) runtime ready."\n\texport PATH=/sbin:/usr/sbin:/bin:/usr/bin\n\t/bin/arch-root true < /dev/null > /dev/console 2>&1\n\t;;'
)
open(p, "w").write(s)
PY

# 4. Repack cpio.gz and print exact hashes
(cd "$WORK" && find . -print0 | cpio --null -o -H newc 2>/dev/null > /tmp/initrd-arch.cpio)
gzip -9 -n -c /tmp/initrd-arch.cpio > "$INITRD"

echo "UNCOMPRESSED_SIZE=$(stat -c %s /tmp/initrd-arch.cpio)"
echo "UNCOMPRESSED_SHA256=$(sha256sum /tmp/initrd-arch.cpio | awk '{print $1}')"
echo "COMPRESSED_SIZE=$(stat -c %s "$INITRD")"
echo "COMPRESSED_SHA256=$(sha256sum "$INITRD" | awk '{print $1}')"
rm -rf "$WORK" /tmp/initrd-arch.cpio
