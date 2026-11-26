# Phase 11 — Fedora 45 Guest Networking

## 1. Verified Guest Connectivity (`tests/test-phase11-fedora-kde.js`, `task-9022`)

Using WebLinux `guest-net-relay.js` (`ws://127.0.0.1:8081`, DNS `1.1.1.1`, RFC1918 blocked):

- **`getent hosts example.com`:**
  - `2606:4700:10::ac42:93f3 example.com`
  - `2606:4700:10::6814:179a example.com`
- **`curl -sI --max-time 10 https://example.com | head -n 2`:**
  - `HTTP/2 200`
- **`dnf5 repolist`:**
  - `fedora` (`Fedora RISC-V 45`)
  - `fedora-staging` (`Fedora RISC-V 45 - Staging`)
