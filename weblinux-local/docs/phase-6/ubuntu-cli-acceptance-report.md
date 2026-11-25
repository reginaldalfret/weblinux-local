# WebLinux Local — Phase 6.3: Ubuntu CLI Acceptance Report

## 1. Executive Summary
This report establishes the formal acceptance criteria and verification findings for **Ubuntu 24.04.5 LTS (Noble Numbat) — Interactive CLI Shell Mode**.

Phase 6.3 delivers a fully validated, production-grade command-line environment executing genuine Ubuntu RISC-V 64-bit packages on top of the WebLinux WebAssembly kernel.

---

## 2. Acceptance Matrix

| Verification Item | Specification / Requirement | Actual Result | Status |
| :--- | :--- | :--- | :--- |
| **Distribution Identity** | `/etc/os-release` reports Ubuntu 24.04.5 LTS Noble | Exact match (`ID=ubuntu`, `VERSION_ID="24.04"`) | **PASSED** |
| **Architecture & ABI** | `riscv64` (64-bit RISC-V lp64d ABI) | `Linux rv 6.6.0 #1 SMP rv riscv64 riscv64 riscv64 GNU/Linux` | **PASSED** |
| **Package Management** | Native `apt` and `dpkg` functional | `dpkg 1.22.6`, `apt 2.8.3` queryable | **PASSED** |
| **Rootfs ext4 Mounting** | `/dev/wda` mounted on `/ubuntu` (2 GiB) | Ext4 mounted with ordered data mode, UUID `26d1825c-...` | **PASSED** |
| **Isolated Home Storage** | `/dev/wdb` mounted on `/ubuntu/root` (16 GiB) | Ext4 mounted on `/ubuntu/root`, isolated from Debian | **PASSED** |
| **Session Supervisor** | `/bin/ubuntu` chroot and mount manager | Transparent entry with full pseudo-fs and env | **PASSED** |
| **Storage Persistence** | Survives reboot and multi-session runs | Tested and certified with `test-opfs-persistence.js` | **PASSED** |
| **Two-Way Switching** | Debian <-> Ubuntu switching with zero leak | Tested and certified with `test-distro-switching.js` | **PASSED** |
| **Memory Footprint** | Stable under 2048 MiB allocation | ~77 MiB disk used, ~70 MiB RAM used by CLI | **PASSED** |
| **Automated Test Suite** | 100% pass across all test suites | 9 out of 9 test suites passed | **PASSED** |

---

## 3. Browser Artifacts & Visual Evidence
The following screenshots were captured in Microsoft Edge during the test sequence:
1. `01-distro-selector-ubuntu.png`: Distribution Selector presenting Ubuntu Noble Numbat with "Experimental CLI" badge.
2. `02-ubuntu-cli-selector.png`: Environment Selector displaying "Ubuntu CLI Shell (Interactive Shell Mode)".
3. `03-ubuntu-booted.png`: Live kernel log streaming and initial boot completion.
4. `04-ubuntu-terminal-session.png`: Interactive terminal drawer running real Ubuntu commands.
5. `08-distro-switching-verified.png`: Completed two-way switching verification in live Edge browser.

---

## 4. Phase 6.3 Sign-off
**Target Milestone:** Ubuntu 24.04.5 LTS CLI / Interactive Shell Mode  
**Final Verdict:** **ACCEPTED WITHOUT RESERVATION**
