# WebLinux Local — Copy-on-Write Root Filesystem Design

```text
Debian Root (root-debian-kde-plasma):
  Immutable Base (/disk/release/) + COW Upper Layer + Independent Home (/dev/wdb: home-debian)

Ubuntu CLI (root-ubuntu-cli):
  Immutable Base (/disk/ubuntu-24.04/) + COW Upper Layer + Independent Home (/dev/wdb: home-ubuntu)

Ubuntu GNOME (root-ubuntu-gnome):
  Immutable Base (/disk/ubuntu-24.04-gnome/) + COW Upper Layer + Independent Home (/dev/wdb: home-ubuntu)
```

- **Read Path:** `upperMap[blockIdx] > 0` -> read from `upperBlocks`; else -> read from `baseStore`.
- **Write Path:** On `upperMap[blockIdx] === 0`, read base block, allocate upper slot, apply write in upper slot. Base checksum never changes.
- **Rollback Path:** Restore CRC32-verified `mapCopy` & `blocksCopy` from committed snapshot; `/dev/wdb` (`home-<distro>`) is untouched.
