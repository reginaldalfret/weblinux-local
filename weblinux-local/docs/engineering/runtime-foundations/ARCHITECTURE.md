# WebLinux Local — Runtime Foundations Architecture

```text
+-----------------------------------------------------------------------+
| Browser Host (Microsoft Edge / Chrome, COOP + COEP Isolated)          |
|  ├── React + Vite + TypeScript UI (App.tsx, DesktopSelector.tsx)      |
|  ├── WasmLinuxAdapter.ts (lifecycle, boot, shutdown, VIRGL flag)      |
|  ├── linux.js (Memory64 4GiB shared, CPU/task workers, OP_SHUTDOWN)   |
|  ├── disk-worker.js (OPFS Web Lock, dual-slot meta, Range/Chunk)      |
|  └── display.js + gpu-exec.js (WebGL2 compositor & RVGP VirGL ring)   |
+-----------------------------------------------------------------------+
         │ SharedArrayBuffer / Atomics        │ HTTP 206 Range / Chunks
         ▼                                    ▼
+----------------------------+    +-------------------------------------+
| Guest Kernel (Wasm64)      |    | Virtual Disk Delivery               |
| Linux 6.6.0 NOMMU          |    |  ├── /disk/ubuntu-24.04/rootfs.img  |
| /bin/rv riscv64 binfmt     |    |  ├── /disk/ubuntu-24.04-gnome/      |
| ext4 (/dev/wda, /dev/wdb)  |    |  └── Chunk fallback (1 MiB slices)  |
+----------------------------+    +-------------------------------------+
```
