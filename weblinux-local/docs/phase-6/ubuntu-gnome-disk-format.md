# WebLinux Local — Phase 6.4: Ubuntu GNOME Virtual Disk Format Analysis

## 1. Virtual Disk Architecture
The Ubuntu GNOME 46 root filesystem is encapsulated as an ext4 virtual disk image and sliced into chunks for on-demand HTTP range retrieval.

### 1.1 Geometry & Parameters
- **Raw Disk Image Size:** 3,221,225,472 bytes (3.0 GiB)
- **Block Size:** 4,096 bytes
- **Total Inodes:** 196,608
- **Filesystem Label:** `ubuntu-gnome`
- **Filesystem UUID:** `57f55339-762f-4d76-a40e-fa536b13847b`
- **Features:** `has_journal,ext_attr,resize_inode,dir_index,filetype,extent,flex_bg,sparse_super,large_file,huge_file,dir_nlink,extra_isize`
- **Integrity Verification:** Certified clean by `e2fsck 1.47.3`:
  `ubuntu-gnome: 26173/196608 files (0.2% non-contiguous), 224809/786432 blocks`

---

## 2. Chunk Slicing & Sparse Optimization

### 2.1 Chunk Metrics
- **Chunk Size:** 1,048,576 bytes (1 MiB)
- **Total Slices:** 3,072 chunks
- **Non-Zero Chunks:** 776 chunks (776 MiB of allocated ext4 data)
- **Zero / Sparse Chunks:** 2,296 chunks (74.7% sparse savings)
- **Boot Prefetch Chunks:** 40 chunks (first 64 MiB accessed during kernel mount and init)
- **Full Image SHA-256:** `6e83ffacc25bfefe08cdaada8b4771acc5e422a171ba7506840fc38fa0094a0e`

### 2.2 Present Bitmap Encoding
WebLinux Local uses a compact hex bitmap where each bit indicates whether a chunk exists on the server or is entirely sparse zeros.
- Total bits: 3,072
- Total 32-bit big-endian words: 96 words
- Present hex bitmap length: 768 characters
- Location: `apps/web/public/disk/ubuntu-24.04-gnome/manifest.json`
