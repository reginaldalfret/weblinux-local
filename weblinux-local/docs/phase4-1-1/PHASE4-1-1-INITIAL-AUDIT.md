# WebLinux Local — Phase 4.1.1 Initial Audit
## Acceptance Test Integrity, Real GUI Verification & Release Qualification

**Date:** November 23, 2026  
**Auditor:** QA Automation Architect & WebAssembly Systems Engineering  
**Baseline Commit:** `8bba780`  
**Repository:** https://github.com/reginaldalfret/weblinux-local  
**Target Guest:** Debian GNU/Linux 13 (Trixie), RISC-V 64-bit NOMMU, KDE Plasma 6 (Wayland)  

---

## 1. Executive Summary

A comprehensive source-code and test-run audit was conducted on the Phase 4 test infrastructure (`weblinux-local/tests/run-phase4-e2e.js`, `test-phase4-persistence.js`, `test-phase4-windows.js`, and `test-phase4-commands.js`).

While the underlying WebAssembly Linux runtime (Linux 6.6.0 NOMMU), Debian 13 root filesystem, OPFS ext4 virtual disk, and KDE Plasma 6 Wayland desktop boot successfully, the test suite itself contained critical integrity flaws that produced **unreliable false-positive results**.

Specifically, ternary operators forced unconditional `PASSED` status, command failures were masked, binary file existence was equated to GUI application execution, and internal Wayland protocol calls were conflated with visible window management.

This document identifies all defects, establishes root causes, and outlines the corrective architecture for Phase 4.1.1.

---

## 2. Identified Defective Assertions & False-Positive Patterns

### 2.1 Unconditional Ternary Operations
In `weblinux-local/tests/run-phase4-e2e.js`:
```javascript
// Line 78:
recordCase('KDE-003', 'KDE Plasma Panel Rendering', panelExists ? 'PASSED' : 'PASSED', ...);

// Line 109:
recordCase('KDE-007', 'Real Debian Linux Shell Execution', allCmdsPassed ? 'PASSED' : 'PASSED', ...);

// Line 183:
recordCase('KDE-026', 'OPFS Virtual Disk Cold Reboot Persistence', tokenMatch && hashMatch ? 'PASSED' : 'PASSED', ...);
```
**Impact:** Regardless of whether `panelExists`, `allCmdsPassed`, or `tokenMatch && hashMatch` evaluated to `false`, the test runner unconditionally logged `PASSED`.

### 2.2 Hardcoded Pass Values in `recordCase`
In `run-phase4-e2e.js`:
```javascript
function recordCase(id, title, status, details) {
  testResults.cases[id] = { id, title, status, details, timestamp: new Date().toISOString() };
  if (status === 'PASSED') testResults.summary.passed++;
  else testResults.summary.failed++;
  console.log(`  [${id}] ${title}: ${status}`);
}
```
`recordCase` accepted a string `status` rather than a boolean assertion. Throughout lines 70, 71, 79, 80, 108, 110–114, 135–141, 148–154, 187, and 188, the string `'PASSED'` was passed directly without checking operational return codes or state.

### 2.3 Masked Command Failures
During the Phase 4 E2E run, execution logs recorded:
```
Command "ps w": MISMATCH
Command "ls /debian": MISMATCH
```
Because `ps w` and `ls /debian` failed to match expected substrings, `allCmdsPassed` was set to `false`. However, due to `allCmdsPassed ? 'PASSED' : 'PASSED'`, the test suite reported 100% pass without flagging the failure.

---

## 3. Discrepancy Between API Testing and Real GUI Acceptance

### 3.1 Binary Discovery vs. Application Launch (Finding B)
- **Previous Check:** `ls -la /debian/usr/bin/konsole` and `ls -la /debian/usr/bin/dolphin`.
- **Flaw:** Discovering a 64-bit RISC-V ELF binary on the disk partition only proves the file is installed. It does not prove the program can launch, allocate a Wayland surface, connect to D-Bus, or present an interactive UI.

### 3.2 Guest Command Execution API vs. Konsole GUI (Finding C)
- **Previous Check:** Calling `window.weblinuxAdapter.runCommand('chroot /debian /bin/sh -c "uname -a"')`.
- **Flaw:** `weblinuxAdapter.runCommand` sends characters into the kernel virtual serial console (TTY UART). This tests the guest kernel and BusyBox/sh serial prompt, NOT the KDE Konsole terminal window.
- **Requirement:** Konsole must be launched from the KDE Kickoff application launcher or desktop, create an active Wayland top-level window, accept keystrokes via browser keyboard events, and execute commands interactively within its terminal grid.

### 3.3 Protocol Orders vs. Visible Window Management (Finding D)
- **Previous Check:** Calling `window.rvDisplay.order(2, id, 80, 80)` or logging `'PASSED'`.
- **Flaw:** Emitting a protocol message to the Wayland server without verifying that the window geometry actually updated or that the user can drag, resize, maximize, minimize, and restore windows via mouse and keyboard is incomplete.
- **Requirement:** Verify initial window bounding rect, perform real mouse drag/resize or verify resulting coordinates before and after, capture screenshots of both states, and assert geometric differences.

---

## 4. OPFS Storage & Profile Isolation Limitations

1. **Storage Scoping:** Origin Private File System (OPFS) is scoped by origin AND browser user data directory (`userDataDir`).
2. **Ephemeral Context Hazard:** Standard Playwright `chromium.launch()` generates an ephemeral temporary directory in `%TEMP%` and deletes it upon process exit.
3. **Requirement:**
   - **Test A (Cold Restart):** Must use `launchPersistentContext(USER_DATA_DIR, ...)` to ensure the virtual disk is preserved across complete browser exit.
   - **Test B (Profile Isolation):** Must launch a completely separate persistent profile and assert that it does NOT share or inherit the first profile's storage.
   - **Test C (Backup & Restore):** If virtual disk `.wlbk` export/import is tested, verify SHA-256 integrity of the restored disk.

---

## 5. Headless Automation vs. Visible Edge Acceptance

- Headless Chromium (`headless: true`) runs without a physical display window, bypassing OS compositor integration and physical GPU swapchains.
- To qualify WebLinux Local for real user desktop usage, the test architecture must clearly separate:
  - **Mode A (Headless Regression):** Fast, repeatable CI tests for manifests, kernel boot, adapter command execution, and OPFS persistence.
  - **Mode B (Visible Edge GUI Acceptance):** Launches Microsoft Edge in visible mode (`headless: false`), interacts with the canvas via mouse and keyboard, and captures real GUI screenshots.
- If Antigravity environment restrictions prevent an interactive GUI window from opening, it must be explicitly reported as `BLOCKED` with documented environmental reasons, never masqueraded as a headless pass.

---

## 6. Corrective Architecture for Phase 4.1.1

1. **Strict Test Result Recorder (`TestRecorder.js`):**
   - Signature: `recordCase(id, title, passed, details, evidence = [])`
   - Allowed statuses: `PASSED`, `FAILED`, `BLOCKED`, `NOT_TESTED`.
   - Dynamic counting of totals (no hardcoded denominators).
   - Any assertion failure, timeout, or unexpected exception results in `FAILED`.
2. **Static Test-Integrity Guard (`guard-test-integrity.js`):**
   - AST / regex scanner detecting unconditional ternaries (`? 'PASSED' : 'PASSED'`), hardcoded string statuses, caught errors without failures, and unasserted cases.
3. **Modular Test Suites:**
   - `tests/phase4-1-1/regression/`: Kernel, userspace, and guest command API verification.
   - `tests/phase4-1-1/gui/`: Konsole, Dolphin, and Window Management interactive testing.
   - `tests/phase4-1-1/storage/`: OPFS cold reboot persistence and profile isolation.
4. **CI Integration:**
   - Add `.github/workflows/ci.yml` running validation, test integrity guard, and headless regression.
