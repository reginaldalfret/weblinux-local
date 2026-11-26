#!/usr/bin/env bash
set -euo pipefail

BUILD_DIR="/root/opensuse-build"
NAME="openSUSE-Tumbleweed-RISC-V-KDE.riscv64-rootfs.riscv64-2026.07.14-Snapshot20261106"
ARCHIVE="${NAME}.tar.xz"
ROOTFS="${BUILD_DIR}/rootfs"

mkdir -p "$BUILD_DIR"
cd "$BUILD_DIR"

dnf install -y aria2 xz >/dev/null 2>&1 || true

aria2c -c -x 4 -s 4 --disable-ipv6=true --lowest-speed-limit=0 --timeout=30 --max-tries=0 --retry-wait=5 --summary-interval=20 -o "$ARCHIVE" \
  "https://ftp.gwdg.de/pub/opensuse/ports/riscv/tumbleweed/appliances/${ARCHIVE}" \
  "https://mirrors.rit.edu/opensuse/ports/riscv/tumbleweed/appliances/${ARCHIVE}" \
  "https://fr2.rpmfind.net/linux/opensuse/ports/riscv/tumbleweed/appliances/${ARCHIVE}" \
  "https://download.opensuse.org/ports/riscv/tumbleweed/appliances/${ARCHIVE}" \
  "https://cdn.opensuse.org/ports/riscv/tumbleweed/appliances/${ARCHIVE}"

sha256sum -c "${ARCHIVE}.sha256"

rm -rf "$ROOTFS"
mkdir -p "$ROOTFS"
tar -xJf "$ARCHIVE" -C "$ROOTFS"
echo "OPENSUSE_EXTRACT_DONE"
du -sh "$ROOTFS"
