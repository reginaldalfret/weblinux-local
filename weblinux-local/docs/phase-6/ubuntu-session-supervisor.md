# WebLinux Local — Phase 6.3: Ubuntu Session Supervisor (/bin/ubuntu)

## 1. Role and Design
In WebLinux Local, guest operating systems run under an initramfs that hosts the core WebAssembly services and device drivers. To run an authentic distribution inside this environment, a session supervisor bridges the initramfs host into the guest rootfs.

The supervisor `/bin/ubuntu` is a native Wasm/sh script located in `/bin/ubuntu` inside the initramfs.

---

## 2. Complete Supervisor Implementation
The script `/bin/ubuntu` performs the following operations:
1. **Target Validation:** Checks if `/ubuntu/usr/bin/bash` is present and executable.
2. **Pseudo-Filesystem Mounts:** If not already mounted, creates and mounts `/ubuntu/proc`, `/ubuntu/sys`, `/ubuntu/dev`, `/ubuntu/run`, `/ubuntu/tmp`, and `/ubuntu/dev/pts`.
3. **Essential Device Nodes:** Generates necessary character devices (`null`, `zero`, `full`, `random`, `urandom`, `tty`, `ptmx`, `fb0`, `tty0`-`tty8`, `event0`-`event2`).
4. **Environment Sanitization:** Configures `HOME=/root`, `SHELL=/bin/bash`, `USER=root`, `LOGNAME=root`, `LANG=C.UTF-8`, and standard system `PATH`.
5. **Chroot Execution:** Enters `/ubuntu` using `chroot` and launches `/bin/bash` via `/bin/rv` (the RISC-V 64-bit userspace emulator).

```sh
#!/bin/sh
D=/ubuntu
if [ ! -x $D/usr/bin/bash ]; then
	echo "ubuntu: no Ubuntu system mounted at /ubuntu (boot with distro=ubuntu)" >&2
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
	cp /etc/resolv.conf $D/etc/resolv.conf 2> /dev/null
	ln -s /proc/self/fd $D/dev/fd 2> /dev/null
	ln -s /proc/self/fd/0 $D/dev/stdin 2> /dev/null
	ln -s /proc/self/fd/1 $D/dev/stdout 2> /dev/null
	ln -s /proc/self/fd/2 $D/dev/stderr 2> /dev/null
fi

ENV="HOME=/root SHELL=/bin/bash USER=root LOGNAME=root TERM=${TERM:-xterm-256color} LANG=C.UTF-8 PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
if [ $# -eq 0 ]; then
	exec chroot $D /usr/bin/env -i $ENV /bin/bash -l
fi
exec chroot $D /usr/bin/env -i $ENV /bin/bash -c "$*"
```

---

## 3. Integration with Init
During the `/init` execution when `distro=ubuntu`:
1. `/dev/wda` is mounted to `/ubuntu`.
2. `/dev/wdb` is mounted to `/ubuntu/root`.
3. `/bin/ubuntu true` is called once in background to initialize device nodes and mounts.
4. The user terminal is handed over to busybox ash prompt `# ` where typing `ubuntu <command>` transparently runs `<command>` inside Ubuntu Noble.

---

## 4. Supervisor Qualification
**Result: VERIFIED**
The supervisor functions reliably across interactive CLI invocations and automated programmatic command execution via `weblinuxAdapter.runCommand()`.
