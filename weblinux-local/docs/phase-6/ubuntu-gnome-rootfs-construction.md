# WebLinux Local — Phase 6.4: Ubuntu GNOME Rootfs Construction

## 1. Rootfs Build Pipeline
The GNOME 46 candidate root filesystem was constructed in an isolated staging environment at `.phase6-build/ubuntu-gnome/rootfs`.

### 1.1 Assembly Steps
1. **Base Rootfs Replication:**
   The verified baseline Ubuntu 24.04.5 LTS rootfs extracted from Canonical's `ubuntu-base-24.04.5-base-riscv64.tar.gz` was replicated with preserved file permissions and ownership.
2. **Package Unpacking:**
   All 401 verified `.deb` packages were unpacked using `dpkg-deb -x`.
3. **Usr-Merge Protection:**
   To maintain riscv64 compatibility (`PT_INTERP: /lib/ld-linux-riscv64-lp64d.so.1`), any legacy directories extracted into `/lib` were moved to `/usr/lib`, and the canonical symlinks were established:
   - `/lib -> usr/lib`
   - `/lib64 -> usr/lib`
4. **Package Status Cataloging:**
   Control metadata for each package was extracted and added to `/var/lib/dpkg/status`, registering all packages with `Status: install ok installed`.
5. **System Identity & D-Bus Machine ID:**
   A persistent machine ID was generated and stored in `/etc/machine-id` and symlinked to `/var/lib/dbus/machine-id`.
6. **GSettings Configuration & Schema Compilation:**
   Custom schema overrides (`99_weblinux_gnome.gschema.override`) were placed in `/usr/share/glib-2.0/schemas/` to disable animations and lock screen timeouts, followed by `glib-compile-schemas`.
7. **Session Launcher Installation:**
   `/usr/local/bin/ubuntu-gnome-session` was installed with permissions `0755`.
