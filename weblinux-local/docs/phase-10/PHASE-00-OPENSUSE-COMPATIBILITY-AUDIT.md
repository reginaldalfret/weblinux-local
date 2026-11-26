# Phase 10 — openSUSE Tumbleweed RISC-V Provenance & Compatibility Audit

## 1. Rootfs Source & Provenance Verification

- **Artifact:** `openSUSE-Tumbleweed-RISC-V-KDE.riscv64-rootfs.riscv64-2026.07.14-Snapshot20261106.tar.xz`
- **Source URL:** `https://cdn.opensuse.org/ports/riscv/tumbleweed/appliances/` (downloaded via official openSUSE mirrors)
- **Archive Size:** `1.70 GiB` compressed (`4.1 GiB` extracted)
- **Published SHA-256:** `94062099bd52c92eb2bbfc37d3aea8e3adab285ffaa5c666bae686820f7ca607` (`sha256sum -c`: **OK**)
- **PGP Signature Verification:** `gpg --batch --verify ...tar.xz.sha256.asc ...tar.xz.sha256` -> **Good signature** (`GPG_RC: 0`) from RSA key `35A2F86E29B700A4` (`openSUSE Project Signing Key <opensuse@opensuse.org>`, fingerprint `AD48 5664 E901 B867 051A  B15F 35A2 F86E 29B7 00A4`).
- **SPDX SBOM SHA-256:** `4702f40570d3505cc18f0cc78da9702d5698535e148e1af005ead3f097599350`
- **CycloneDX SBOM SHA-256:** `278daf389d11e5678044a6bbc2ff5c383bbe45041858176b1e250bc326c01a8f`
- **Snapshot Alignment:** Matches `openSUSE-Tumbleweed` `VERSION_ID="20261106"` (`1689` signed RPM packages in `docs/phase-10/opensuse-kde-packages.lock`).

## 2. RISC-V ABI & Binary Audit (`readelf`)

Audited `/usr/bin/bash`, `/usr/bin/rpm`, and `/usr/bin/zypper`:
- **Class / Endianness:** `ELF64`, `2's complement, little endian`
- **Machine / Flags:** `RISC-V`, `0x5, RVC, double-float ABI` (`LP64D`)
- **Program Interpreter:** `/lib/ld-linux-riscv64-lp64d.so.1`
- **RISC-V ISA Extensions:** `rv64i2p1_m2p0_a2p1_f2p2_d2p2_c2p0_zicsr2p0_zifencei2p0_zmmul1p0_zaamo1p0_zalrsc1p0_zca1p0_zcd1p0` (pure `RV64GC`, compatible with WebLinux `/bin/rv` without vector/bitmanip extensions).

## 3. Core Userspace & KDE Stack Inventory

- `glibc-2.44-3.1.riscv64`
- `rpm-4.20.1-11.1.riscv64`, `zypper-1.14.102-1.1.riscv64`
- `plasma6-workspace-6.8.2-1.1.riscv64`, `plasma6-desktop-6.8.2-1.1.riscv64`, `kwin6-6.8.2-2.1.riscv64`
- `qt6-wayland-6.12.0-3.1.riscv64`
- `konsole-26.08.3-1.1.riscv64`
- `Mesa-26.2.5-1.1.riscv64`, `Mesa-dri-26.2.5-1.1.riscv64`
- `dbus-1-1.14.10-5.1.riscv64` (`messagebus` UID `496`, GID `481`)
- `btrfsprogs-7.1-1.1.riscv64`

## 4. Kernel Btrfs Check (`vmlinux-wasm64_nommu.wasm`)

Inspection of `apps/web/public/runtime/vmlinux-wasm64_nommu.wasm` confirmed `ext4` symbols are present and `btrfs` symbols are absent (`CONFIG_BTRFS_FS` is not compiled in). Therefore, `opensuse-tumbleweed-kde` must use `ext4` for `/dev/wda` (`root-opensuse-tumbleweed-kde`) and `/dev/wdb` (`home-opensuse-tumbleweed-kde`).
