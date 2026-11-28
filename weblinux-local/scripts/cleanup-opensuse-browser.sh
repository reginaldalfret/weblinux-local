#!/usr/bin/env bash
# Remove pre-installed browser packages and WebLinux browser launcher/desktop entry
# from the openSUSE Tumbleweed RISC-V KDE image while preserving Plasma 6, shared
# libraries, terminal networking tools, GPG/zypper verification, and /root/browser-home.
set -euo pipefail

WORKDIR="${OPENSUSE_CLEANUP_DIR:-/root/opensuse-cleanup}"
MNT="${WORKDIR}/mnt"
IMG="${WORKDIR}/opensuse-tumbleweed-kde.ext4"
CHUNKS="${OPENSUSE_CHUNKS_DIR:-/mnt/d/weblinux-disks/opensuse-tumbleweed-kde}"
PUB="${OPENSUSE_PUBLIC_DIR:-/mnt/e/Web-Linux/weblinux-local/apps/web/public/disk/opensuse-tumbleweed-kde}"

mkdir -p "$MNT"

echo "=== [1/4] Reconstructing opensuse-tumbleweed-kde.ext4 ==="
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

echo "=== [2/4] Mounting and removing browser packages ==="
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

# Remove only browser application packages that are actually installed.
# Never pass --clean-deps so shared libraries (GTK, WebKit, Qt, NSS, GLib, D-Bus)
# and Plasma 6 / CLI networking / zypper / GPG verification remain intact.
chroot "$MNT" /usr/bin/qemu-riscv64-static /bin/bash -c '
  set -euo pipefail
  export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

  CANDIDATES=(
    epiphany
    epiphany-branding-openSUSE
    chromium
    MozillaFirefox
    MozillaFirefox-branding-openSUSE
  )

  PRESENT=()
  for pkg in "${CANDIDATES[@]}"; do
    if rpm -q "$pkg" >/dev/null 2>&1; then
      PRESENT+=("$pkg")
    fi
  done

  if [ "${#PRESENT[@]}" -gt 0 ]; then
    echo "Removing browser packages: ${PRESENT[*]}"
    zypper --non-interactive remove "${PRESENT[@]}"
  else
    echo "No target browser packages installed; skipping zypper remove."
  fi

  zypper clean --all
'

# Remove only the WebLinux browser launcher and desktop entry; preserve /root/browser-home.
rm -f "$MNT/usr/local/bin/weblinux-browser" "$MNT/usr/share/applications/weblinux-browser.desktop"

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

print(f"SLICE_DONE id={manifest_id} fullSha256={full_sha} nonzero={nonzero}")
PY

rm -rf "$WORKDIR"
