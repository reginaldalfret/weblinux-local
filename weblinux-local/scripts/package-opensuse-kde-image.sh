#!/usr/bin/env bash
set -euo pipefail

ROOTFS="/root/opensuse-build/rootfs"
IMG="/root/opensuse-build/opensuse-tumbleweed-kde.ext4"
CHUNKS="/mnt/d/weblinux-disks/opensuse-tumbleweed-kde"
PUB="/mnt/e/Web-Linux/weblinux-local/apps/web/public/disk/opensuse-tumbleweed-kde"

mkdir -p "$CHUNKS" "$PUB"

echo "=== [1/4] Sizing & formatting 5.6 GiB (5632 MiB) ext4 image ==="
du -sh "$ROOTFS"
rm -f "$IMG"
# 5632 MiB = 5,905,580,032 bytes (~4.1 GiB rootfs + ~1.5 GiB headroom for Zypper/logs/updates)
truncate -s 5905580032 "$IMG"
mke2fs -t ext4 -d "$ROOTFS" -L opensuse-kde -m 1 -O ^metadata_csum_seed "$IMG"

echo "=== [2/4] Running e2fsck ==="
e2fsck -fy "$IMG"

echo "=== [3/4] Slicing 5632 x 1 MiB chunks & writing manifest ==="
python3 - <<'PY'
import os, json, hashlib

IMG = "/root/opensuse-build/opensuse-tumbleweed-kde.ext4"
CHUNKS = "/mnt/d/weblinux-disks/opensuse-tumbleweed-kde"
PUB = "/mnt/e/Web-Linux/weblinux-local/apps/web/public/disk/opensuse-tumbleweed-kde"
SIZE = 5905580032
PIECE = 1048576
TOTAL = SIZE // PIECE

for d in (CHUNKS, PUB):
    os.makedirs(d, exist_ok=True)
for f in os.listdir(CHUNKS):
    if f.endswith(".bin") or (len(f) == 6 and f.isdigit()):
        os.remove(os.path.join(CHUNKS, f))

hashes = []
present_bits = [0] * TOTAL
nonzero = 0
full_hash = hashlib.sha256()

with open(IMG, "rb") as fp:
    for i in range(TOTAL):
        buf = fp.read(PIECE)
        assert len(buf) == PIECE
        full_hash.update(buf)
        if any(buf):
            h = hashlib.sha256(buf).hexdigest()
            hashes.append(h)
            present_bits[i] = 1
            nonzero += 1
            with open(os.path.join(CHUNKS, f"{i:06d}"), "wb") as out:
                out.write(buf)
        else:
            hashes.append("")

present_hex = "".join(
    f"{(present_bits[i]<<3)|(present_bits[i+1]<<2)|(present_bits[i+2]<<1)|present_bits[i+3]:x}"
    for i in range(0, TOTAL, 4)
)

full_sha256 = full_hash.hexdigest()
boot = list(range(min(64, TOTAL)))

manifest = {
    "size": SIZE,
    "piece": PIECE,
    "id": full_sha256[:32],
    "hashes": hashes,
    "boot": boot,
    "present": present_hex,
}
integrity = {
    "totalChunks": TOTAL,
    "nonZeroChunks": nonzero,
    "bootChunks": len(boot),
    "fullImageSha256": full_sha256,
    "imageSizeBytes": SIZE,
    "pieceSizeBytes": PIECE,
}

for d in (CHUNKS, PUB):
    with open(os.path.join(d, "manifest.json"), "w") as f:
        json.dump(manifest, f)
    with open(os.path.join(d, "integrity.json"), "w") as f:
        json.dump(integrity, f, indent=2)

print("=== [4/4] Verifying round-trip chunk reconstruction SHA-256 ===")
recon_hash = hashlib.sha256()
zero_buf = b"\x00" * PIECE
for i in range(TOTAL):
    if present_bits[i]:
        with open(os.path.join(CHUNKS, f"{i:06d}"), "rb") as cf:
            recon_hash.update(cf.read())
    else:
        recon_hash.update(zero_buf)

assert recon_hash.hexdigest() == full_sha256, "Reconstruction SHA-256 mismatch!"
print(f"DONE: total={TOTAL} nonzero={nonzero} boot={len(boot)} sha256={full_sha256} RECONSTRUCT_OK=True")
PY
