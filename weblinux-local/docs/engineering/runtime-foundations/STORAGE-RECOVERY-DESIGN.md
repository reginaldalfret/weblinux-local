# WebLinux Local — Storage Recovery Design

## 1. On-Disk OPFS Layout (`disk-<name>/`)
```text
disk-<name>/
├── data   # 1 MiB piece slots, appended sequentially
├── map    # 64-byte "rvdisk 1 ..." heading + Uint32Array place[pieceCount]
└── meta   # 128-byte dual-slot (Slot A @ 0, Slot B @ 64) CRC32-protected commit header
```

## 2. Two-Phase Commit & Crash Recovery State Machine
```text
[Clean Gen N in Slot (N%2)]
        │
        ▼ (OP_FLUSH / 64 unsaved pieces / 1s idle / OP_SHUTDOWN)
  1. data.flush()
  2. Write Slot ((N+1)%2) with dirty=1, meta.flush()
  3. Write map.write(place), map.flush()
  4. Write Slot ((N+1)%2) with dirty=0, mapCrc32, entryCrc32, meta.flush()
        │
        ▼
[Clean Gen N+1 in Slot ((N+1)%2)]
```
- **Crash before step 2:** Slot `N` is still clean; trailing uncommitted pieces in `data` beyond `places * piece_size` are truncated by `data.truncate(places * piece_size)`.
- **Crash during step 2–3:** Slot `N+1` is either CRC-invalid or `dirty=1`. `selectRecoverySlot()` selects Slot `N`, rolling back cleanly to Generation `N`.
- **Crash after step 4:** Slot `N+1` is clean and selected.
