# Phase 9 — Pacman & Guest Networking Qualification

## 1. Pacman Configuration for Linux 6.6.0 NOMMU

- **Package Manager:** `Pacman v7.1.0 - libalpm v16.0.1`
- **Installed Package Closure:** `555` signed RISC-V (`riscv64` / `any`) packages (`docs/phase-9/arch-kde-packages.lock`).
- **Signature Verification:** `SigLevel = Required DatabaseOptional` retained with initialized `pacman-key` keyring.
- **NOMMU Adaptation (`/etc/pacman.conf`):**
  - Added `DisableSandbox` because the `6.6.0-wasm64_nommu` kernel does not enable Landlock sandboxing.
  - Commented `DownloadUser` so `alpm` downloads cleanly under root in the WebLinux guest environment.
- **Mirrors:** Official Arch Linux RISC-V community repositories (`core`, `extra`, `unsupported`) via `https://riscv.mirror.pkgbuild.com/` (fallback `https://archriscv.felixc.at/repo/`).

## 2. Live Guest Networking Verification

Verified inside the running Arch Linux RISC-V guest via `guest-net-relay.js` (`ws://127.0.0.1:8081`, DNS `1.1.1.1`, RFC1918 blocked):

```sh
curl -sI --max-time 10 https://riscv.mirror.pkgbuild.com/repo/extra/extra.db | head -n 2
```

Observed output:
- `HTTP/2 200`
- `server: nginx`

Cross-distribution networking regression (`tests/test-phase8-networking.js`) also passed with exit code `0` (`DNS: 104.20.23.154`, `HTTPS_STATUS: 200 TITLE_OK: True`, `RFC1918_BLOCK: OK URLError`).
