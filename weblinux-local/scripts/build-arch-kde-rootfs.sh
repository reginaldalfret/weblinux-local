#!/bin/bash
set -euo pipefail
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

ROOTFS="/root/arch-test/rootfs"
TARBALL="/mnt/d/weblinux-build/archriscv-2026-08-27.tar.zst"
LOCKFILE="/mnt/e/Web-Linux/weblinux-local/docs/phase-9/arch-kde-packages.lock"

cleanup() {
  umount -lf "$ROOTFS/dev/pts" 2>/dev/null || true
  umount -lf "$ROOTFS/dev" 2>/dev/null || true
  umount -lf "$ROOTFS/sys" 2>/dev/null || true
  umount -lf "$ROOTFS/proc" 2>/dev/null || true
  rm -f "$ROOTFS/usr/bin/qemu-riscv64-static"
}
trap cleanup EXIT

if [ ! -x "$ROOTFS/usr/bin/pacman" ]; then
  rm -rf "$ROOTFS"
  mkdir -p "$ROOTFS"
  tar --zstd -xf "$TARBALL" -C "$ROOTFS"
fi

cp /usr/bin/qemu-riscv64-static "$ROOTFS/usr/bin/qemu-riscv64-static"
cp /etc/resolv.conf "$ROOTFS/etc/resolv.conf"
mount -t proc proc "$ROOTFS/proc"
mount -t sysfs sysfs "$ROOTFS/sys"
mount --bind /dev "$ROOTFS/dev"
mount -t devpts devpts "$ROOTFS/dev/pts"

echo "=== [1/4] Initializing & populating Arch RISC-V pacman keyring ==="
if [ ! -f "$ROOTFS/etc/pacman.d/gnupg/pubring.gpg" ]; then
  chroot "$ROOTFS" /usr/bin/qemu-riscv64-static /usr/bin/bash -c '
set -eu
mkdir -p /etc/pacman.d/gnupg
pacman-key --init
for kr in /usr/share/pacman/keyrings/*.gpg; do
  name=$(basename "$kr" .gpg)
  pacman-key --populate "$name" || true
done
'
fi

echo "=== [2/4] Configuring mirrors & running full system upgrade (pacman -Syu) ==="
chroot "$ROOTFS" /usr/bin/qemu-riscv64-static /usr/bin/bash -c '
set -eu
sed -i "s/^CheckSpace/#CheckSpace/" /etc/pacman.conf
sed -i "s/^DownloadUser/#DownloadUser/" /etc/pacman.conf
sed -i "s/^ParallelDownloads.*/ParallelDownloads = 2/" /etc/pacman.conf
grep -q "^DisableSandbox" /etc/pacman.conf || sed -i "/^\[options\]/a DisableSandbox" /etc/pacman.conf
grep -q "archriscv.felixc.at" /etc/pacman.d/mirrorlist || echo "Server = https://archriscv.felixc.at/repo/\$repo" >> /etc/pacman.d/mirrorlist
pacman -Syu --noconfirm
'

echo "=== [3/4] Installing KDE Plasma 6 + Wayland + Konsole + Dolphin + Mesa ==="
chroot "$ROOTFS" /usr/bin/qemu-riscv64-static /usr/bin/bash -c '
set -eu
pacman -S --noconfirm --needed \
  plasma-workspace \
  plasma-desktop \
  kwin \
  dolphin \
  konsole \
  breeze \
  breeze-icons \
  qt6-base \
  qt6-wayland \
  dbus \
  ttf-dejavu \
  noto-fonts \
  mesa \
  mesa-demos \
  xorg-xwayland \
  which \
  procps-ng
'

echo "=== [4/4] Securing account, recording package lock, and measuring size ==="
chroot "$ROOTFS" /usr/bin/qemu-riscv64-static /usr/bin/bash -c '
set -eu
passwd -l root || true
pacman -Q > /tmp/pkg-lock.txt
pacman -Qi | awk "/^Name|^Version|^Architecture|^Installed Size/{print}" > /tmp/pkg-details.txt
'
cp "$ROOTFS/tmp/pkg-lock.txt" "$LOCKFILE"
rm -f "$ROOTFS/tmp/pkg-lock.txt" "$ROOTFS/tmp/pkg-details.txt"
du -sh "$ROOTFS"
wc -l "$LOCKFILE"
echo "ARCH_KDE_ROOTFS_READY"
