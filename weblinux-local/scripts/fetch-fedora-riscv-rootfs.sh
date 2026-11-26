#!/usr/bin/env bash
set -euo pipefail

BUILD_DIR="/root/fedora-build"
BASE="https://dl.fedoraproject.org/pub/alt/risc-v/release/45/Container/riscv64/images"
NAME="Fedora-Container-Base-Generic-45-20261022.0.riscv64.oci.tar.xz"
ROOTFS="${BUILD_DIR}/rootfs"
OCI_DIR="${BUILD_DIR}/oci"

mkdir -p "$BUILD_DIR"
cd "$BUILD_DIR"

curl -fSL --proto '=https' --tlsv1.2 -C - -O "${BASE}/${NAME}.sha256"
curl -fSL --proto '=https' --tlsv1.2 -C - -O "${BASE}/${NAME}"

echo "=== CHECKSUM ==="
cat "${NAME}.sha256"
sha256sum -c "${NAME}.sha256"

rm -rf "$OCI_DIR" "$ROOTFS"
mkdir -p "$OCI_DIR" "$ROOTFS"
tar --no-same-owner -xJf "$NAME" -C "$OCI_DIR"

# Extract OCI image layer blob(s) safely
python3 - <<'PY'
import json, os, subprocess
oci = "/root/fedora-build/oci"
rootfs = "/root/fedora-build/rootfs"
idx = json.load(open(os.path.join(oci, "index.json")))
m_digest = idx["manifests"][0]["digest"].split(":")[1]
manifest = json.load(open(os.path.join(oci, "blobs", "sha256", m_digest)))
for layer in manifest["layers"]:
    l_digest = layer["digest"].split(":")[1]
    blob = os.path.join(oci, "blobs", "sha256", l_digest)
    print("Extracting layer:", l_digest)
    subprocess.run(["tar", "--no-overwrite-dir", "-xf", blob, "-C", rootfs], check=True)
PY

echo "=== EXTRACTED ROOTFS ==="
du -sh "$ROOTFS"
cat "$ROOTFS/etc/os-release"
ls -la "$ROOTFS/etc/yum.repos.d/" "$ROOTFS/etc/pki/rpm-gpg/"
