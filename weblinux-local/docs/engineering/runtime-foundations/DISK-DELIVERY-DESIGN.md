# WebLinux Local — Virtual Disk Delivery Design

```text
disk-worker.js (disk_main)
  ├── manifest.rangeImage present?
  │     ├── YES -> async fetch Range: bytes=0-511
  │     │           ├── HTTP 206 + valid Content-Range -> Range Transport Active (ETag locked)
  │     │           └── HTTP 200 / error -> Fallback to Chunk Transport
  │     └── NO  -> Chunk Transport (1 MiB files / object storage)
  │
  └── bring(piece)
        ├── Already in OPFS (`place[piece] > 0`) -> read from OPFS `data`
        ├── Zero piece (`present[piece] == 0`)    -> fill(0) without network request
        └── Fetch needed -> get_range() [or fallback get(chunk)] -> write OPFS `data`
```
