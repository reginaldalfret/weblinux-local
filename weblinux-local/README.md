# WebLinux Local

> **"Your Linux. Your Browser. No Installation."**

A public, client-side operating system platform that allows anyone to launch a genuine graphical Linux desktop directly inside a modern web browser without installing Linux, creating an account, paying for cloud VMs, or configuring hypervisors.

Execution occurs 100% locally on the visitor's computer via WebAssembly, WebGL2/WebGPU, and the Origin Private File System (OPFS).

---

## 1. Architectural Highlights

- **Linux Kernel (`wasm64_nommu`):** Linux kernel compiled to 64-bit WebAssembly based on Joel Severin's `linux-wasm` with custom patches for atomic synchronization, signal frames, and sound devices.
- **Process Concurrency:** Multi-threaded process model where every task runs in a Web Worker sharing a single 4–16 GiB `SharedArrayBuffer` via `Atomics.wait`/`notify`.
- **RISC-V 64 JIT Translation (`rv`):** Executes unmodified Debian `riscv64` ELF packages via a fast RISC-V user-mode JIT translator that translates hot execution regions into native WebAssembly modules and caches them across visits (`jitcache.bin`).
- **Native WebAssembly Desktop Shell:** KDE Plasma 6 (`plasmashell`), Qt 6.8, and KDE Frameworks 6 run directly as native WebAssembly binaries with zero emulation latency for the window shell.
- **Wayland Window Compositor (`wlserver`):** Full JavaScript-based Wayland compositor that drives window surfaces, pointer events, XKB keyboard layout translation, and clipboard synchronization to a WebGL2 canvas.
- **Persistent Storage Subsystem:** Ext4 filesystem images divided into 1 MiB chunked blocks, fetched on-demand and persisted inside the browser's Origin Private File System (OPFS). User home directory (`/root`) survives page reloads and browser restarts.

---

## 2. Linux Distribution Catalogue

| Distribution | Architecture | Default Desktop | Validation Status | Notes |
|---|---|---|---|---|
| **Debian (Trixie)** | `riscv64` | KDE Plasma 6 | **Validated (Active)** | Full pre-built package set, native Plasma 6 desktop, IceWM, and terminal tools. |
| **Ubuntu (24.04 LTS)** | `riscv64` | IceWM | **Experimental Port** | Active investigation into minimal rootfs NOMMU compatibility. |
| **Fedora 41** | `riscv64` | IceWM | **Experimental Port** | RPM package manager and glibc NOMMU testing in progress. |
| **Arch Linux** | `riscv64` | IceWM | **Experimental Port** | Rolling release port and pacman hook testing. |
| **WebLinux Security Lab** | `riscv64` | IceWM | **Experimental Port** | Unofficial custom security-lab evaluation image based on verified Debian baseline. |

---

## 3. Desktop Environments

1. **KDE Plasma 6 (Primary Complete Desktop):**
   Full desktop environment with Kickoff launcher, Dolphin file manager, Konsole terminal, Kate text editor, and System Settings.
2. **IceWM (Lightweight Desktop):**
   Fast, minimal resource footprint X11/Wayland desktop environment for lower-spec hardware or rapid boot.
3. **XFCE & GNOME:**
   Future roadmap targets undergoing compatibility evaluation.

---

## 4. Repository Layout

```
weblinux-local/
│
├── apps/
│   └── web/                     # React + Vite + TypeScript frontend
│       ├── src/
│       │   ├── pages/           # Landing, Compatibility, Distros, Desktop, Storage, Docs
│       │   ├── components/      # Navbar, Footer, TerminalDrawer, Controls
│       │   ├── runtime/         # Frontend runtime types and integration hooks
│       │   └── styles/          # Dark premium styling & Tailwind CSS
│       └── public/
│           ├── manifests/       # Distribution metadata specifications
│           └── runtime/         # Compiled kernel (wasm), initrd, and runtime adapters
│
├── runtime/
│   ├── adapters/                # WasmLinuxAdapter (IRuntimeAdapter implementation)
│   ├── boot/                    # Kernel boot parameters and hardware pre-flight
│   ├── filesystem/              # OpfsManager (OPFS block device & disaster recovery)
│   └── display/                 # WebGL2 surface presentation & Wayland canvas bridge
│
├── distributions/
│   ├── debian/                  # Debian riscv64 rootfs and build definitions
│   ├── ubuntu/                  # Ubuntu port tracking
│   ├── fedora/                  # Fedora port tracking
│   ├── arch/                    # Arch port tracking
│   └── kali-lab/                # Security lab package manifest
│
├── image-builder/
│   ├── manifests/               # Distribution manifests schema
│   ├── scripts/                 # Chunking and image creation scripts
│   └── validation/              # Automated integrity verification
│
├── infrastructure/
│   ├── cdn/                     # Chunk distribution and caching policy
│   ├── hosting/                 # Static web server configuration (COOP/COEP headers)
│   └── networking/              # Restricted WebSocket relay & abuse prevention
│
├── tests/                       # Automated manifest and boot pre-flight tests
│
├── docs/
│   ├── ARCHITECTURE.md          # Comprehensive architecture decision record
│   └── LICENSING.md             # Complete GPL-2.0 compliance and legal audit
│
└── README.md
```

---

## 5. Getting Started

### Prerequisites

- Node.js 18+ (tested on Node v24)
- Recent desktop browser: Google Chrome, Microsoft Edge, or Brave Browser (for SharedArrayBuffer & OPFS support)

### Development Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the local development server with COOP/COEP isolation:**
   ```bash
   npm run dev
   ```

3. **Open in browser:**
   Navigate to `http://localhost:3000`

### Automated Tests

Run the automated test suites:
```bash
# Manifest validation, preflight binary checks, and cryptographic integrity
npm test

# Phase 3.1 Comprehensive Multi-Session Acceptance Suite:
# (Cryptographic validation, OPFS persistence across reboots, real virtual disk backup/wipe/restore, KDE desktop)
node tests/test-phase3-1-acceptance.js
```

---

## 6. Phase 3.1 Reliability, Storage Integrity & Hardening Verification

Debian GNU/Linux 13 (Trixie) RISC-V 64 has achieved full **VALIDATED** certification across all Phase 3.1 reliability criteria:

- **Cryptographic Asset Integrity:** Verified genuine SHA-256 digests and byte counts for kernel and initrd, with automatic rejection of corrupted buffers.
- **OPFS Disk Persistence:** Exact cryptographic token (`WEBLINUX_PHASE31_TOKEN_*`) verified across four completely separate browser processes.
- **Production Virtual Disk Backup & Restore:** Full `.wlbk` v2.0 backup export with gzip compression (compressing ~36 MiB sparse ext4 home disk to ~115 KiB), cryptographic pre-validation, clean wipe confirmation, and bit-exact data restoration.
- **Desktop Environments:** Native WebAssembly KDE Plasma 6 Wayland desktop session validated with screenshot evidence (`tests/screenshots/kde-plasma-desktop.png`).
- **Distribution Status Safety:** Launch gate in `App.tsx` prevents booting unvalidated or experimental images.
- **Comprehensive Reports:**
  - [Phase 3.1 Execution Report](docs/PHASE3-1-EXECUTION-REPORT.md)
  - [Machine-Readable Report](tests/phase3-1-acceptance-report.json)
  - [Phase 2 & 3 Report](docs/PHASE2-3-EXECUTION-REPORT.md)

---

## 7. Licensing & Attribution

- **rvwasm Foundation:** GPL-2.0-or-later. Copyright (c) 2026 Swap (`https://plasmaontheweb.com`).
- **linux-wasm:** GPL-2.0-only. Copyright (c) Joel Severin (`https://github.com/joelseverin/linux-wasm`).
- **Linux Kernel:** GPL-2.0-only. Copyright Linus Torvalds and contributors.
- **Berkeley SoftFloat 3:** BSD-3-Clause.
- **Musl Libc & Mesa:** MIT.
- **KDE Plasma & Qt:** LGPL-2.1/3.0 & GPL-2.0/3.0.
- Complete licensing compliance obligations, source distribution notices, and trademark separation terms are detailed in [docs/LICENSING.md](docs/LICENSING.md).
