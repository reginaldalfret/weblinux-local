# WEBLINUX LOCAL — PHASE 5.4
# RUNTIME LIFECYCLE STATE MACHINE SPECIFICATION

**Document ID:** `PHASE5-4-LIFE-001`  
**Adapter:** `WasmLinuxAdapter.ts`  
**Date:** 2026-11-24  

---

## 1. Verified Lifecycle State Machine

The WebLinux Local runtime implements a deterministic 12-state finite state machine:

```text
       UNINITIALIZED
             │
             ▼
        INITIALIZING
             │
             ▼
           READY
             │
             ▼
        DOWNLOADING
             │
             ▼
          BOOTING
             │
             ▼
        SHELL_READY
             │
             ▼
    COMPOSITOR_STARTING
             │
             ▼
       DESKTOP_READY
             │
             ▼
          RUNNING ◄─── (Active Session)
             │
             ▼
       SHUTTING_DOWN
             │
             ▼
          STOPPED
```

### 1.1 State Definitions & Transition Criteria
1. **`uninitialized`:** Adapter instantiated; scripts not yet loaded in DOM.
2. **`initializing`:** Runtime scripts dynamically inserted; BroadcastChannels established.
3. **`ready`:** Manifests parsed; WebGL2, OPFS, and SharedArrayBuffer verified.
4. **`downloading`:** Pre-flight download and cryptographic checksum verification of kernel and initrd.
5. **`booting`:** Linux kernel invoked; WebAssembly worker pool started; `/init` mounting ext4 disks.
6. **`shell_ready`:** Console output reports shell prompt (`# `). Command execution is unlocked.
7. **`compositor_starting`:** Session launcher executed; Wayland socket negotiation begins.
8. **`desktop_ready`:** Wayland window surface table registered via `rv-display` BroadcastChannel.
9. **`running`:** Desktop shell and compositor actively managing window surfaces; telemetry live.
10. **`paused`:** CPU clocks suspended.
11. **`shutting_down`:** Asynchronous `sync` issued to ext4 persistent storage; processes terminated.
12. **`stopped`:** Machine halted; memory released; storage synced.
13. **`error`:** Fatal execution fault or blocked launcher trap caught with diagnostic message.
