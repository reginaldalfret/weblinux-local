#!/usr/bin/env bash
# Clean up Debian 13 (Trixie) riscv64 KDE image:
# - Reconstruct /root/debian-cleanup/debian-13-firefox.ext4 from chunked disk storage
# - Remove only browser application packages (epiphany-browser, epiphany-browser-data,
#   netsurf-gtk, plus firefox-esr / chromium if installed) without apt autoremove
# - Keep shared GTK/WebKit/NSS/GLib libraries, dbus, curl, wget, git, ca-certificates, apt
# - Remove /usr/local/bin/weblinux-browser and /usr/share/applications/weblinux-browser.desktop
#   while preserving /root/browser-home and user files
# - Run e2fsck -fy and re-slice 1 MiB chunks with present bitmask + integrity.json
set -euo pipefail

WORKDIR="${DEBIAN_CLEANUP_DIR:-/root/debian-cleanup}"
MNT="${WORKDIR}/mnt"
IMG="${WORKDIR}/debian-13-firefox.ext4"
CHUNKS="${DEBIAN_CHUNKS_DIR:-/mnt/d/weblinux-disks/debian-13-firefox}"
PUB="${DEBIAN_PUBLIC_DIR:-/mnt/e/Web-Linux/weblinux-local/apps/web/public/disk/debian-13-firefox}"

mkdir -p "$MNT"

echo "=== [1/4] Reconstructing debian-13-firefox.ext4 ==="
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

echo "=== [2/4] Mounting and removing browser packages + wrapper ==="
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

# Remove only browser application packages; NEVER run apt autoremove
chroot "$MNT" /usr/bin/qemu-riscv64-static /bin/bash -c '
  set -euo pipefail
  export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
  export DEBIAN_FRONTEND=noninteractive

  CANDIDATES=(epiphany-browser epiphany-browser-data netsurf-gtk firefox-esr chromium)
  TO_REMOVE=()
  for pkg in "${CANDIDATES[@]}"; do
    if dpkg -s "$pkg" 2>/dev/null | grep -q "Status: install ok installed"; then
      TO_REMOVE+=("$pkg")
    fi
  done

  if [ "${#TO_REMOVE[@]}" -gt 0 ]; then
    echo "Removing browser packages: ${TO_REMOVE[*]}"
    apt-get remove -y "${TO_REMOVE[@]}"
  else
    echo "No target browser packages installed."
  fi

  apt-get clean

  echo "Post-cleanup package check (shared/core tools preserved):"
  dpkg -l dbus curl wget git ca-certificates apt 2>/dev/null | grep -E "^ii" || true
'

# Remove project-added browser launcher and desktop entry; preserve /root/browser-home and user files
rm -f "$MNT/usr/local/bin/weblinux-browser"
rm -f "$MNT/usr/share/applications/weblinux-browser.desktop"

umount "$MNT/dev" "$MNT/sys" "$MNT/proc"
rm -f "$MNT/usr/bin/qemu-riscv64-static"
umount "$MNT"
trap - EXIT

echo "=== [3/4] Running e2fsck ==="
e2fsck -fy "$IMG"

echo "=== [4/4] Slicing updated chunks ==="
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

pieces = len(hashes)
pres = []
for i in range(0, pieces, 4):
    nib = 0
    for j in range(4):
        if i + j < pieces and hashes[i + j]:
            nib |= (1 << (3 - j))
    pres.append(format(nib, "x"))

full_sha = full_h.hexdigest()
manifest_id = full_sha[:32]
boot = list(range(min(64, total)))
manifest = {
    "size": size,
    "piece": piece,
    "id": manifest_id,
    "hashes": hashes,
    "boot": boot,
    "present": "".join(pres),
}
for d in (chunks_dir, pub_dir):
    with open(os.path.join(d, "manifest.json"), "w", encoding="utf-8") as mf:
        json.dump(manifest, mf)

integ = {
    "totalChunks": total,
    "nonZeroChunks": nonzero,
    "bootChunks": len(boot),
    "fullImageSha256": full_sha,
    "imageSizeBytes": size,
    "pieceSizeBytes": piece,
}
for d in (chunks_dir, pub_dir):
    with open(os.path.join(d, "integrity.json"), "w", encoding="utf-8") as f_int:
        json.dump(integ, f_int, indent=2)

# Verify round-trip reconstruction SHA-256
recon_h = hashlib.sha256()
for i in range(total):
    if hashes[i]:
        with open(os.path.join(chunks_dir, f"{i:06d}"), "rb") as cf:
            recon_h.update(cf.read())
    else:
        recon_h.update(zero_chunk)
assert recon_h.hexdigest() == full_sha, "Reconstruction SHA-256 mismatch!"

print(f"SLICE_DONE id={manifest_id} fullSha256={full_sha} nonzero={nonzero} RECONSTRUCT_OK=True")
PY

rm -rf "$WORKDIR"
