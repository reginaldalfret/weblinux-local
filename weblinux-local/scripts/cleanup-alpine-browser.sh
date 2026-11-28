#!/usr/bin/env bash
# Remove Alpine 3.24.4 RISC-V browser packages (epiphany, badwolf) and
# WebLinux browser launcher/desktop entry from alpine-kde.ext4 while
# preserving gvfs, dbus, Plasma 6.6.6, curl, wget, git, apk, APK signature
# verification, and /root/browser-home. Runs e2fsck -fy and slices 1 MiB chunks
# with present hex bitmask + integrity.json.
set -euo pipefail

WORKDIR="${ALPINE_CLEANUP_DIR:-/root/alpine-cleanup}"
MNT="${WORKDIR}/mnt"
IMG="${WORKDIR}/alpine-kde.ext4"
CHUNKS="${ALPINE_CHUNKS_DIR:-/mnt/d/weblinux-disks/alpine-kde}"
PUB="${ALPINE_PUBLIC_DIR:-/mnt/e/Web-Linux/weblinux-local/apps/web/public/disk/alpine-kde}"

mkdir -p "$WORKDIR" "$MNT"

echo "=== [1/4] Reconstructing alpine-kde.ext4 from chunks ==="
CHUNKS="$CHUNKS" IMG="$IMG" python3 - <<'PY'
import json
import os

chunks_dir = os.environ["CHUNKS"]
img_path = os.environ["IMG"]
with open(os.path.join(chunks_dir, "manifest.json"), "r", encoding="utf-8") as mf:
    manifest = json.load(mf)
piece = manifest["piece"]
total = manifest["size"] // piece
zero = b"\x00" * piece

with open(img_path, "wb") as out:
    for i in range(total):
        if manifest["hashes"][i]:
            with open(os.path.join(chunks_dir, f"{i:06d}"), "rb") as cf:
                out.write(cf.read())
        else:
            out.write(zero)

print(f"Reconstructed {img_path} ({total} MiB)")
PY

echo "=== [2/4] Mounting and removing browser packages in chroot ==="
mount -o loop "$IMG" "$MNT"
cp /usr/bin/qemu-riscv64-static "$MNT/usr/bin/qemu-riscv64-static"
mount -t proc none "$MNT/proc"
mount -t sysfs none "$MNT/sys"
mount --bind /dev "$MNT/dev"

cleanup() {
  umount "$MNT/dev" 2>/dev/null || true
  umount "$MNT/sys" 2>/dev/null || true
  umount "$MNT/proc" 2>/dev/null || true
  rm -f "$MNT/usr/bin/qemu-riscv64-static"
  umount "$MNT" 2>/dev/null || true
}
trap cleanup EXIT

# Remove only epiphany and badwolf; preserve gvfs, dbus, Plasma 6.6.6,
# curl, wget, git, apk, and APK signature verification.
chroot "$MNT" /usr/bin/qemu-riscv64-static /bin/sh -c '
  set -eu
  export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
  apk del epiphany badwolf
  rm -rf /var/cache/apk/*
  apk info -v gvfs dbus curl wget git 2>/dev/null || true
'

# Remove project-added browser launcher and desktop entry; preserve /root/browser-home.
rm -f "$MNT/usr/local/bin/weblinux-browser" "$MNT/usr/share/applications/weblinux-browser.desktop"

umount "$MNT/dev" "$MNT/sys" "$MNT/proc"
rm -f "$MNT/usr/bin/qemu-riscv64-static"
umount "$MNT"
trap - EXIT

echo "=== [3/4] Running e2fsck ==="
e2fsck -fy "$IMG"

echo "=== [4/4] Slicing updated chunks with present bitmask & integrity.json ==="
IMG="$IMG" CHUNKS="$CHUNKS" PUB="$PUB" python3 - <<'PY'
import hashlib
import json
import os

img_path = os.environ["IMG"]
chunks_dir = os.environ["CHUNKS"]
pub_dir = os.environ["PUB"]
size = os.path.getsize(img_path)
piece = 1048576
assert size % piece == 0, f"Image size {size} is not a multiple of {piece}"
total = size // piece

os.makedirs(chunks_dir, exist_ok=True)
os.makedirs(pub_dir, exist_ok=True)

for d in (chunks_dir, pub_dir):
    for fname in os.listdir(d):
        if len(fname) == 6 and fname.isdigit():
            os.remove(os.path.join(d, fname))

hashes = []
present_bits = [0] * total
nonzero = 0
zero_chunk = b"\x00" * piece
full_h = hashlib.sha256()

with open(img_path, "rb") as f:
    for i in range(total):
        buf = f.read(piece)
        assert len(buf) == piece
        full_h.update(buf)
        if buf == zero_chunk:
            hashes.append("")
        else:
            ch = hashlib.sha256(buf).hexdigest()
            hashes.append(ch)
            present_bits[i] = 1
            nonzero += 1
            with open(os.path.join(chunks_dir, f"{i:06d}"), "wb") as out:
                out.write(buf)

while len(present_bits) % 4 != 0:
    present_bits.append(0)

present_hex = "".join(
    f"{(present_bits[i]<<3)|(present_bits[i+1]<<2)|(present_bits[i+2]<<1)|present_bits[i+3]:x}"
    for i in range(0, len(present_bits), 4)
)

full_sha256 = full_h.hexdigest()
boot = list(range(min(64, total)))

manifest = {
    "size": size,
    "piece": piece,
    "id": full_sha256[:32],
    "hashes": hashes,
    "boot": boot,
    "present": present_hex,
}
integrity = {
    "totalChunks": total,
    "nonZeroChunks": nonzero,
    "bootChunks": len(boot),
    "fullImageSha256": full_sha256,
    "imageSizeBytes": size,
    "pieceSizeBytes": piece,
}

for d in (chunks_dir, pub_dir):
    with open(os.path.join(d, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f)
    with open(os.path.join(d, "integrity.json"), "w", encoding="utf-8") as f:
        json.dump(integrity, f, indent=2)

recon_hash = hashlib.sha256()
for i in range(total):
    if present_bits[i]:
        with open(os.path.join(chunks_dir, f"{i:06d}"), "rb") as cf:
            recon_hash.update(cf.read())
    else:
        recon_hash.update(zero_chunk)

assert recon_hash.hexdigest() == full_sha256, "Reconstruction SHA-256 mismatch!"
print(f"DONE: total={total} nonzero={nonzero} boot={len(boot)} sha256={full_sha256} RECONSTRUCT_OK=True")
PY
