# Phase 10 — Btrfs & Snapper Feasibility Investigation

## 1. Kernel Configuration Inspection

Inspected `apps/web/public/runtime/vmlinux-wasm64_nommu.wasm`:
- `CONFIG_IKCONFIG` is not compiled into the shipped binary.
- Binary symbol scan confirmed `ext4` symbols (`ext4_get_group_number`, `ext4_inode_table`, `ext4_block_bitmap`, `ext4_error`, etc.) are compiled in.
- **Zero `btrfs` symbols** were found (`btrfs strings: []`).

## 2. Userspace Packages

- `btrfsprogs-7.1-1.1.riscv64` is installed in the openSUSE Tumbleweed rootfs.
- `snapper` is not installed by default in the appliance rootfs.

## 3. Conclusion

`CONFIG_BTRFS_FS` is not enabled in WebLinux Local's `6.6.0-wasm64_nommu` kernel. Therefore, `opensuse-tumbleweed-kde` uses `ext4` on `/dev/wda` and `/dev/wdb`, and Btrfs/Snapper rollback is **not supported** until a future kernel build enables `CONFIG_BTRFS_FS` (along with required compression/checksum modules).
