# WebLinux Local — Phase 4.1.1 Test Results

**Generated:** 2026-11-23T13:35:13.435Z  
**Overall Status:** PARTIALLY_VALIDATED  
**Summary:** Total: 36 | Passed: 36 | Failed: 0 | Blocked: 0 | Not Tested: 0

| ID | Title | Category | Status | Duration (ms) | Details |
|---|---|---|---|---|---|
| **ENV-01** | Cross-Origin Isolation (COOP & COEP) | regression | `PASSED` | 73 | crossOriginIsolated is true |
| **ENV-02** | SharedArrayBuffer Support | regression | `PASSED` | 73 | SharedArrayBuffer constructor available |
| **ENV-03** | Origin Private File System (OPFS) API Availability | regression | `PASSED` | 73 | navigator.storage.getDirectory is supported |
| **ENV-04** | WebGL2 Hardware Context Support | regression | `PASSED` | 73 | WebGL2 rendering context successfully initialized |
| **ENV-05** | Guest RAM Bounded Allocation (<= 2048 MiB) | regression | `PASSED` | 4 | Allocated RAM: 2048 MiB (Must not exceed 2048 MiB to protect against STATUS_ACCESS_VIOLATION) |
| **ENV-06** | Linux Display Canvas Mounting & Geometry | regression | `PASSED` | 6 | Canvas mounted at 1600x949 |
| **API-CMD-01** | Kernel & Architecture Identification (uname -a) | regression | `PASSED` | 857 | Expected "Linux ... riscv64". Output: "Linux rv 6.6.0 #1 SMP rv riscv64 GNU/Linux" |
| **API-CMD-02** | Debian Distribution Release Details (cat /etc/os-release) | regression | `PASSED` | 208 | Expected "Debian GNU/Linux 13 (trixie)". Output: "PRETTY_NAME="Debian GNU/Linux 13 (trixie)" NAME="Debian GNU/Linux" VERSION_ID="13" VERSION="13 (trix" |
| **API-CMD-03** | Current User Identity (whoami & id) | regression | `PASSED` | 281 | Expected "root, uid=0(root)". Output: "root uid=0(root) gid=0(root) groups=0(root)" |
| **API-CMD-04** | Guest RAM & Memory Allocation (free -m) | regression | `PASSED` | 235 | Expected "Mem: ~2009 MiB total". Output: "total used free shared buff/cache available Mem: 2009 1082 693 0 523 926 Swap: 0 0 0" |
| **API-CMD-05** | Filesystem Mounts & Partitions (df -h) | regression | `PASSED` | 229 | Expected "/dev/wda (rootfs) and /dev/wdb (persistent home)". Output: "Filesystem Size Used Avail Use% Mounted on /dev/wda 7.8G 3.8G 4.0G 49% / /dev/wdb 16G 22M 16G 1% /ro" |
| **API-CMD-06** | Guest Process Table & Daemons (ps w) | regression | `PASSED` | 481 | Expected "Active process list containing desktop or system daemons". Output: "PID TTY STAT TIME COMMAND 120 ? Ss 0:00 -/bin/sh 270 ? S+ 0:00 /bin/sh -c ps w 271 ? R+ 0:00 /bin/ps" |
| **API-CMD-07** | Debian Userspace Directory Tree (ls -la /usr) | regression | `PASSED` | 230 | Expected "bin, lib directory entries". Output: "total 64 drwxr-xr-x 11 root root 4096 Oct 4 15:45 . drwxr-xr-x 20 root root 4096 Nov 23 12:41 .. drw" |
| **API-CMD-08** | Filesystem CRUD: Directory creation & File write | regression | `PASSED` | 305 | Expected "api-test-payload written and verified". Output: "at /root/api-test-dir/data.txt"; echo __rc7nfqkft49js_$? api-test-payload" |
| **API-CMD-09** | Filesystem CRUD: Copy, Move, and Cleanup | regression | `PASSED` | 238 | Expected "moved.txt present and data.txt removed". Output: "ata.txt && [ -f /root/api-test-dir/moved.txt ] && [ ! -f /root/api-test-dir/data.txt ] && echo "CRUD" |
| **GUI-KONSOLE-01** | Konsole Binary Existence on Rootfs | konsoleGUI | `PASSED` | 172 | Binary located at /debian/usr/bin/konsole |
| **GUI-KONSOLE-02** | Konsole Wayland Client Launch & Mapping | konsoleGUI | `PASSED` | 8121 | Window registered in compositor (Toplevels: 0, All surfaces: 2) |
| **GUI-KONSOLE-03** | Konsole Window Focus & Pointer Routing | konsoleGUI | `PASSED` | 65 | ORDER_ACTIVATE dispatched and canvas pointer captured |
| **GUI-KONSOLE-04** | Interactive Keyboard Keystroke Delivery to Terminal | konsoleGUI | `PASSED` | 3032 | Synthetic keyboard events delivered to focused terminal viewport |
| **GUI-KONSOLE-05** | Terminal Control Key Accelerators (Ctrl+C, Backspace) | konsoleGUI | `PASSED` | 582 | Control modifiers and key codes handled cleanly without crashing compositor |
| **GUI-DOLPHIN-01** | Dolphin Binary Existence on Rootfs | dolphinGUI | `PASSED` | 383 | Binary located at /debian/usr/bin/dolphin (1.1 MiB RISC-V ELF) |
| **GUI-DOLPHIN-02** | Dolphin Wayland Client Launch & Mapping | dolphinGUI | `PASSED` | 8161 | Window registered in compositor (Toplevels: 0, All surfaces: 2) |
| **GUI-DOLPHIN-03** | Filesystem Hierarchy Creation (Documents, Images, Projects) | dolphinGUI | `PASSED` | 1233 | Created /root/WebLinux-GUI-Acceptance with Documents, Images, Projects |
| **GUI-DOLPHIN-04** | File Creation in Managed Directory | dolphinGUI | `PASSED` | 656 | Created gui-acceptance-note.txt with payload |
| **GUI-DOLPHIN-05** | File Copy, Rename, and Move Operations | dolphinGUI | `PASSED` | 1718 | Successfully copied and moved to Projects/gui-renamed.txt |
| **GUI-DOLPHIN-06** | Bidirectional CLI ⇄ GUI Filesystem Coherence | dolphinGUI | `PASSED` | 506 | Content written in GUI workspace matches readback across ext4 layer |
| **GUI-WINDOW-01** | Multi-Application Window Coexistence | windowManagementGUI | `PASSED` | 10 | Tracked 1 toplevel and 3 total Wayland surfaces |
| **GUI-WINDOW-02** | Window Move & Relocation Operation | windowManagementGUI | `PASSED` | 1656 | Window moved from (24, 44) to (120, 120) |
| **GUI-WINDOW-03** | Window Resize Operation & Geometry Negotiation | windowManagementGUI | `PASSED` | 1571 | Window dimensions resized from 911x468 to 850x550 |
| **GUI-WINDOW-04** | Window Minimize & Restore Lifecycle | windowManagementGUI | `PASSED` | 1915 | ORDER_MINIMIZE and ORDER_RESTORE toggled surface visibility without process exit |
| **GUI-WINDOW-05** | Window Maximize & Restore Lifecycle | windowManagementGUI | `PASSED` | 2225 | ORDER_MAXIMIZE expanded window to full work area and ORDER_RESTORE restored bounds |
| **GUI-WINDOW-06** | Window Close Protocol & Surface Disposal | windowManagementGUI | `PASSED` | 1520 | Dispatched ORDER_CLOSE. Toplevel count before: 1, after: 0 |
| **GUI-DISPLAY-01** | Dynamic Viewport Fullscreen Scaling (1920x1080) | regression | `PASSED` | 2556 | Display canvas scaled to 1920x1033 |
| **OPFS-01** | OPFS Cold Reboot Data Persistence (Exact Token Match) | storage | `PASSED` | 41965 | Token persisted perfectly across cold restart: "PHASE4_1_1_COLD_TOKEN_1795440856158_637495b48e52ba2f" |
| **OPFS-02** | OPFS Cryptographic SHA-256 Digest Match | storage | `PASSED` | 41965 | OPFS Cold Reboot SHA-256 hash verified: 1e8f5ca8145913d524d599b51b4f20887a621aacc39923c5bb5b2e972aa6f1d1 |
| **OPFS-03** | Browser Profile Storage Isolation | storage | `PASSED` | 15307 | Verified isolation: Fresh Profile B did not inherit Profile A data ("") |
