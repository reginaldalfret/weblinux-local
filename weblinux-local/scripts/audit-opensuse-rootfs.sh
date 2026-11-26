#!/usr/bin/env bash
set -euo pipefail

R="/root/opensuse-build/rootfs"
cp /usr/bin/qemu-riscv64-static "$R/usr/bin/qemu-riscv64-static"

echo "=== OS-RELEASE ==="
cat "$R/etc/os-release"

echo "=== READELF /usr/bin/bash /usr/bin/rpm /usr/bin/zypper ==="
for b in /usr/bin/bash /usr/bin/rpm /usr/bin/zypper; do
  echo "--- $b ---"
  readelf -h "$R$b" | grep -E "Class|Data|Machine|Flags"
  readelf -l "$R$b" | grep interpreter || true
  readelf -A "$R$b" 2>&1 | head -n 8 || true
done

echo "=== LIB64 ==="
ls -la "$R/lib64/ld-linux"* "$R/usr/lib64/libc.so.6" 2>&1 || true

echo "=== PASSWD ==="
cat "$R/etc/passwd"

echo "=== ZYPPER REPOS ==="
ls -la "$R/etc/zypp/repos.d/" 2>&1 || true
cat "$R/etc/zypp/repos.d/"*.repo 2>&1 || true

echo "=== QEMU-RISCV64 PACKAGE INVENTORY ==="
chroot "$R" /usr/bin/qemu-riscv64-static /usr/bin/bash -c "
  /lib64/ld-linux-riscv64-lp64d.so.1 --version | head -n 2
  rpm --version
  zypper --version
  rpm -qa | wc -l
  rpm -qa | sort | grep -E '^(plasma6-workspace|plasma6-desktop|kwin6|dolphin|konsole|qt6-base|qt6-wayland|Mesa|btrfsprogs|snapper|dbus-1|zypper|rpm|glibc)-' | head -n 40
"
rm -f "$R/usr/bin/qemu-riscv64-static"
