#!/bin/bash
set -euo pipefail
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

# Phase 15 — Arch Linux RISC-V KDE Browser Cleanup
# Removes only epiphany and chromium (if installed) via `pacman -R --noconfirm`
# (no -Rs cascade) and removes /usr/local/bin/weblinux-browser and
# /usr/share/applications/weblinux-browser.desktop while preserving Plasma 6,
# Dolphin, Konsole, curl, wget, git, pacman, Pacman GPG signatures, and
# /root/browser-home.

WORKDIR="/root/arch-cleanup"
IMG="$WORKDIR/arch-kde.ext4"
MNT="$WORKDIR/mnt"
CHUNKS="/mnt/d/weblinux-disks/arch-kde"
PUB="/mnt/e/Web-Linux/weblinux-local/apps/web/public/disk/arch-kde"
PIECE=1048576

cleanup() {
  umount -lf "$MNT/dev/pts" 2>/dev/null || true
  umount -lf "$MNT/dev" 2>/dev/null || true
  umount -lf "$MNT/sys" 2>/dev/null || true
  umount -lf "$MNT/proc" 2>/dev/null || true
  rm -f "$MNT/usr/bin/qemu-riscv64-static" 2>/dev/null || true
  umount -lf "$MNT" 2>/dev/null || true
}
trap cleanup EXIT

mkdir -p "$WORKDIR" "$MNT" "$CHUNKS" "$PUB"

echo "=== [1/5] Reconstructing arch-kde.ext4 from $CHUNKS ==="
python3 - <<'PY'
import json
import os

CHUNKS = "/mnt/d/weblinux-disks/arch-kde"
IMG = "/root/arch-cleanup/arch-kde.ext4"

with open(os.path.join(CHUNKS, "manifest.json"), "r") as f:
    m = json.load(f)

piece = m["piece"]
total = m["size"] // piece
with open(IMG, "wb") as out:
    for i in range(total):
        p = os.path.join(CHUNKS, f"{i:06d}")
        with open(p, "rb") as cf:
            out.write(cf.read())
print(f"Reconstructed {IMG} ({m['size']} bytes, {total} chunks)")
PY

echo "=== [2/5] Mounting image & chrooting to remove browser packages ==="
mount -o loop "$IMG" "$MNT"
cp /usr/bin/qemu-riscv64-static "$MNT/usr/bin/qemu-riscv64-static"
mount -t proc proc "$MNT/proc"
mount -t sysfs sysfs "$MNT/sys"
mount --bind /dev "$MNT/dev"
mount -t devpts devpts "$MNT/dev/pts"

chroot "$MNT" /usr/bin/qemu-riscv64-static /usr/bin/bash -c '
set -euo pipefail

for pkg in epiphany chromium; do
  if pacman -Q "$pkg" >/dev/null 2>&1; then
    echo "Removing package: $pkg (pacman -R --noconfirm, no cascade)"
    pacman -R --noconfirm "$pkg"
  else
    echo "Package not installed (skipping): $pkg"
  fi
done

echo "--- Verifying retained core & KDE packages ---"
for pkg in pacman curl wget git dolphin konsole; do
  if pacman -Q "$pkg" >/dev/null 2>&1; then
    pacman -Q "$pkg"
  else
    echo "WARN: expected package not found: $pkg"
  fi
done
'

echo "=== [3/5] Removing browser wrapper & desktop entry (preserving /root/browser-home) ==="
rm -f "$MNT/usr/local/bin/weblinux-browser"
rm -f "$MNT/usr/share/applications/weblinux-browser.desktop"
if [ -d "$MNT/root/browser-home" ]; then
  echo "Preserved $MNT/root/browser-home"
fi

sync
cleanup
trap - EXIT

echo "=== [4/5] Running e2fsck -fy ==="
rc=0
e2fsck -fy "$IMG" || rc=$?
if [ "$rc" -gt 1 ]; then
  echo "e2fsck failed with exit code $rc" >&2
  exit "$rc"
fi

echo "=== [5/5] Slicing 1 MiB chunks & writing manifest.json + integrity.json ==="
python3 - <<'PY'
import hashlib
import json
import os

IMG = "/root/arch-cleanup/arch-kde.ext4"
CHUNKS = "/mnt/d/weblinux-disks/arch-kde"
PUB = "/mnt/e/Web-Linux/weblinux-local/apps/web/public/disk/arch-kde"
PIECE = 1048576

SIZE = os.path.getsize(IMG)
if SIZE % PIECE != 0:
    raise RuntimeError(f"Image size {SIZE} is not a multiple of {PIECE}")
TOTAL = SIZE // PIECE

full_h = hashlib.sha256()
hashes = []
nz = set()

with open(IMG, "rb") as f:
    for i in range(TOTAL):
        buf = f.read(PIECE)
        full_h.update(buf)
        hashes.append(hashlib.sha256(buf).hexdigest())
        if any(buf):
            nz.add(i)
        with open(os.path.join(CHUNKS, f"{i:06d}"), "wb") as cf:
            cf.write(buf)

full_sha = full_h.hexdigest()
words = (TOTAL + 31) // 32
present = ""
for w in range(words):
    val = 0
    for b in range(32):
        if (w * 32 + b) in nz:
            val |= (1 << (31 - b))
    present += f"{val:08x}"

boot = [i for i in sorted(nz) if i < 64]
manifest = {
    "size": SIZE,
    "piece": PIECE,
    "id": full_sha[:32],
    "hashes": hashes,
    "boot": boot,
    "present": present,
}
integrity = {
    "totalChunks": TOTAL,
    "nonZeroChunks": len(nz),
    "bootChunks": len(boot),
    "fullImageSha256": full_sha,
    "imageSizeBytes": SIZE,
    "pieceSizeBytes": PIECE,
}

for d in (CHUNKS, PUB):
    with open(os.path.join(d, "manifest.json"), "w") as mf:
        json.dump(manifest, mf)
    with open(os.path.join(d, "integrity.json"), "w") as inf:
        json.dump(integrity, inf, indent=2)

print(f"DONE: total={TOTAL} nonzero={len(nz)} boot={len(boot)} id={full_sha[:32]} sha256={full_sha}")
PY

rm -f "$IMG"
