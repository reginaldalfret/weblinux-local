#!/usr/bin/env bash
# Phase 15 — Agent 2: Ubuntu 24.04.5 LTS KDE Browser Cleanup
# - Reconstruct /root/ubuntu-cleanup/ubuntu-24.04-kde-epiphany.ext4 from 1 MiB chunks
# - Mount with qemu-riscv64-static, proc, sys, dev
# - Remove only browser application packages (epiphany-browser, epiphany-browser-data,
#   plus firefox / chromium if installed) via `apt-get remove -y` (NEVER `apt autoremove -y`)
# - Preserve KDE Plasma 5.27.12, shared GTK/WebKit/Qt libs, curl, wget, git, ca-certificates, apt,
#   and all /home/ubuntu and /root user files
# - Remove /usr/local/bin/weblinux-browser and /usr/share/applications/weblinux-browser.desktop
# - Run e2fsck -fy, re-slice 1 MiB chunks, and write manifest.json (with present hex bitmask)
#   and integrity.json to both disk chunks dir and apps/web/public/disk/ubuntu-24.04-kde-epiphany
set -euo pipefail

WORKDIR="${UBUNTU_CLEANUP_DIR:-/root/ubuntu-cleanup}"
MNT="${WORKDIR}/mnt"
IMG="${WORKDIR}/ubuntu-24.04-kde-epiphany.ext4"
CHUNKS="${UBUNTU_CHUNKS_DIR:-/mnt/d/weblinux-disks/ubuntu-24.04-kde-epiphany}"
PUB="${UBUNTU_PUBLIC_DIR:-/mnt/e/Web-Linux/weblinux-local/apps/web/public/disk/ubuntu-24.04-kde-epiphany}"

mkdir -p "$MNT"

echo "=== [1/4] Reconstructing ubuntu-24.04-kde-epiphany.ext4 ==="
CHUNKS="$CHUNKS" IMG="$IMG" python3 - <<'PY'
import json
import os

chunks_dir = os.environ["CHUNKS"]
img_path = os.environ["IMG"]
manifest_path = os.path.join(chunks_dir, "manifest.json")
with open(manifest_path, "r", encoding="utf-8") as mf:
    manifest = json.load(mf)

piece = int(manifest["piece"])
size = int(manifest["size"])
total = size // piece
zero = b"\x00" * piece

with open(img_path, "wb") as out:
    for i in range(total):
        chunk_file = os.path.join(chunks_dir, f"{i:06d}")
        if manifest["hashes"][i] and os.path.exists(chunk_file):
            with open(chunk_file, "rb") as cf:
                buf = cf.read()
                if len(buf) != piece:
                    raise RuntimeError(f"Chunk {i:06d} size mismatch: {len(buf)} != {piece}")
                out.write(buf)
        else:
            out.write(zero)

actual_size = os.path.getsize(img_path)
assert actual_size == size, f"Reconstructed size mismatch: {actual_size} != {size}"
print(f"Reconstructed {img_path} ({total} MiB, {actual_size} bytes)")
PY

echo "=== [2/4] Mounting and removing browser packages in riscv64 chroot ==="
if [ ! -x /usr/bin/qemu-riscv64-static ]; then
  echo "ERROR: /usr/bin/qemu-riscv64-static not found or not executable" >&2
  exit 1
fi

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

chroot "$MNT" /usr/bin/qemu-riscv64-static /bin/bash -c '
  set -euo pipefail
  export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
  export DEBIAN_FRONTEND=noninteractive

  CANDIDATES=(
    epiphany-browser
    epiphany-browser-data
    firefox
    firefox-esr
    chromium
    chromium-browser
  )

  TO_REMOVE=()
  for pkg in "${CANDIDATES[@]}"; do
    if dpkg -s "$pkg" 2>/dev/null | grep -q "Status: install ok installed"; then
      TO_REMOVE+=("$pkg")
    fi
  done

  if [ "${#TO_REMOVE[@]}" -gt 0 ]; then
    echo "Removing browser packages: ${TO_REMOVE[*]}"
    # NEVER run apt autoremove -y so Plasma 5.27.12 and shared GTK/WebKit/Qt libs remain intact
    apt-get remove -y "${TO_REMOVE[@]}"
  else
    echo "No target browser packages installed."
  fi

  apt-get clean

  echo "Verifying preserved tools and desktop packages..."
  for req in curl apt-get; do
    if ! command -v "$req" >/dev/null 2>&1; then
      echo "ERROR: Required tool missing after cleanup: $req" >&2
      exit 1
    fi
  done
'

echo "=== [3/4] Removing browser binaries, wrapper, and desktop entries (preserving user files) ==="
rm -f "$MNT/usr/bin/epiphany"
rm -f "$MNT/usr/share/applications/org.gnome.Epiphany.desktop"
rm -f "$MNT/usr/local/bin/weblinux-browser"
rm -f "$MNT/usr/share/applications/weblinux-browser.desktop"

# Unmount cleanly before running e2fsck
cleanup
trap - EXIT

echo "=== [4/4] Running e2fsck -fy and slicing 1 MiB chunks ==="
e2fsck -fy "$IMG"

IMG="$IMG" CHUNKS="$CHUNKS" PUB="$PUB" python3 - <<'PY'
import hashlib
import json
import os

img_path = os.environ["IMG"]
chunks_dir = os.environ["CHUNKS"]
pub_dir = os.environ["PUB"]
size = os.path.getsize(img_path)
piece = 1048576
total = size // piece

os.makedirs(chunks_dir, exist_ok=True)
os.makedirs(pub_dir, exist_ok=True)

for fname in os.listdir(chunks_dir):
    if len(fname) == 6 and fname.isdigit():
        os.remove(os.path.join(chunks_dir, fname))

hashes = []
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
            with open(os.path.join(chunks_dir, f"{i:06d}"), "wb") as out:
                out.write(buf)
            nonzero += 1

pres = []
for i in range(0, total, 4):
    nib = 0
    for j in range(4):
        if i + j < total and hashes[i + j]:
            nib |= (1 << (3 - j))
    pres.append(format(nib, "x"))

full_sha = full_h.hexdigest()
manifest_id = full_sha[:32]
boot = [i for i in range(min(64, total)) if hashes[i]]

manifest = {
    "size": size,
    "piece": piece,
    "id": manifest_id,
    "hashes": hashes,
    "boot": boot,
    "present": "".join(pres),
}
integ = {
    "distributionId": "ubuntu-24.04-kde-epiphany",
    "totalChunks": total,
    "nonZeroChunks": nonzero,
    "bootChunks": len(boot),
    "fullImageSha256": full_sha,
    "imageSizeBytes": size,
    "pieceSizeBytes": piece,
}

for d in (chunks_dir, pub_dir):
    with open(os.path.join(d, "manifest.json"), "w", encoding="utf-8") as mf:
        json.dump(manifest, mf)
    with open(os.path.join(d, "integrity.json"), "w", encoding="utf-8") as f_int:
        json.dump(integ, f_int, indent=2)

# Verify round-trip chunk reconstruction SHA-256
recon_h = hashlib.sha256()
for i in range(total):
    if hashes[i]:
        with open(os.path.join(chunks_dir, f"{i:06d}"), "rb") as cf:
            recon_h.update(cf.read())
    else:
        recon_h.update(zero_chunk)
assert recon_h.hexdigest() == full_sha, "Reconstruction SHA-256 mismatch!"

print(f"SLICE_DONE id={manifest_id} fullSha256={full_sha} total={total} nonzero={nonzero} boot={len(boot)} RECONSTRUCT_OK=True")
PY

rm -rf "$WORKDIR"
