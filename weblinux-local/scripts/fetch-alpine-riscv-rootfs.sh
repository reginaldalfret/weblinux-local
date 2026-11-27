#!/usr/bin/env bash
set -euo pipefail

VER="3.24.4"
ARCH="riscv64"
BASE="https://dl-cdn.alpinelinux.org/alpine/v3.24/releases/${ARCH}"
NAME="alpine-minirootfs-${VER}-${ARCH}.tar.gz"
KEY_URL="https://alpinelinux.org/keys/ncopa.asc"
EXPECTED_FP="0482D84022F52DF1C4E7CD43293ACD0907D9495A"

STAGE_DIR="/mnt/d/weblinux-disks/alpine-kde/staging"
ROOTFS="${STAGE_DIR}/rootfs"
GNUPG_DIR="${STAGE_DIR}/gnupg"

mkdir -p "$STAGE_DIR"
cd "$STAGE_DIR"

echo "=== [1/5] Downloading Alpine ${VER} ${ARCH} minirootfs, checksum, signature, and signing key ==="
curl -fSL --proto '=https' --tlsv1.2 -C - -O "${BASE}/${NAME}"
curl -fSL --proto '=https' --tlsv1.2 -O "${BASE}/${NAME}.sha256"
curl -fSL --proto '=https' --tlsv1.2 -O "${BASE}/${NAME}.asc"
curl -fSL --proto '=https' --tlsv1.2 -o ncopa.asc "${KEY_URL}"

echo "=== [2/5] Verifying release signing key fingerprint ==="
ACTUAL_FP=$(gpg --show-keys --with-colons ncopa.asc | python3 -c 'import sys; print(next(l.split(":")[9] for l in sys.stdin if l.startswith("fpr:")))')
echo "KEY_FINGERPRINT=$ACTUAL_FP"
if [ "$ACTUAL_FP" != "$EXPECTED_FP" ]; then
  echo "ERROR: Signing key fingerprint mismatch! Expected $EXPECTED_FP, got $ACTUAL_FP" >&2
  exit 1
fi

echo "=== [3/5] Verifying detached OpenPGP signature ==="
rm -rf "$GNUPG_DIR"
mkdir -p "$GNUPG_DIR"
chmod 700 "$GNUPG_DIR"
GNUPGHOME="$GNUPG_DIR" gpg --batch --import ncopa.asc
GNUPGHOME="$GNUPG_DIR" gpg --batch --verify "${NAME}.asc" "${NAME}"

echo "=== [4/5] Verifying SHA-256 checksum ==="
cat "${NAME}.sha256"
sha256sum -c "${NAME}.sha256"
ls -lh "$NAME"

echo "=== [5/5] Extracting verified minirootfs to ${ROOTFS} ==="
rm -rf "$ROOTFS"
mkdir -p "$ROOTFS"
tar --no-same-owner --no-overwrite-dir -xzf "${NAME}" -C "$ROOTFS"

echo "=== EXTRACTED ALPINE MINIROOTFS ==="
du -sh "$ROOTFS"
cat "$ROOTFS/etc/os-release"
cat "$ROOTFS/etc/alpine-release"
ls -la "$ROOTFS/etc/apk/keys/"
