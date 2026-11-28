# Phase 16: Cross-Distribution Regression Report

## Build & TypeScript Verification
- `npx tsc --noEmit` + `npm run build` in `apps/web`: **PASS** (`✓ 2156 modules transformed`, `✓ built in 34.75s`).
- `runtime/branding/` strict TypeScript check (`npx tsc --noEmit --strict ...`): **PASS**.

## Browser-Free Policy & Terminal Internet Regression
- **Debian (`debian-firefox`):** `BIN_CHECK`/`PKG_CHECK` empty, `NO_WRAPPER_OK`, `NO_DESKTOP_OK`, DNS + `HTTP/2 200` (`SHA256 25ddf2c8...`), `RFC1918_BLOCKED_OK`.
- **Fedora (`fedora-kde`):** `BIN_CHECK`/`PKG_CHECK` empty, `NO_WRAPPER_OK`, `NO_DESKTOP_OK`, DNS + `HTTP/2 200` (`SHA256 25ddf2c8...`), `RFC1918_BLOCKED_OK`, `gpgcheck=1` preserved.
- **Arch (`arch-kde`):** `BIN_CHECK` empty, `NO_WRAPPER_OK`, `NO_DESKTOP_OK`, DNS + `HTTP/2 200` (`SHA256 25ddf2c8...`), `RFC1918_BLOCKED_OK`.
- **openSUSE (`opensuse-tumbleweed-kde`):** `BIN_CHECK`/`PKG_CHECK` empty, `NO_WRAPPER_OK`, `NO_DESKTOP_OK`, DNS + `HTTP/2 200` (`SHA256 25ddf2c8...`), `RFC1918_BLOCKED_OK`, Zypper GPG checks preserved.
- **Ubuntu (`ubuntu-kde-epiphany`):** Chroot verified zero browsers, `ubuntu-archive-keyring.gpg` preserved, Plasma `5.27.12` preserved.
- **Alpine (`alpine-kde`):** Chroot verified `NO_BROWSERS_OK`, musl userspace & APK signatures preserved, Plasma `6.6.6` preserved.
- **Phase 8 Networking (`tests/test-phase8-networking.js`):** Executed after final rootfs and frontend changes.
