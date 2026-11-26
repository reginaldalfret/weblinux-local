# Phase 10 — Zypper & RPM Package Management

## 1. Verified Guest Package Stack

Inside the running openSUSE Tumbleweed RISC-V guest (`tests/test-phase10-opensuse-kde.js`, `task-8876`):
- `PRETTY_NAME="openSUSE Tumbleweed"`
- `RPM version 4.20.1`
- `zypper 1.14.102`
- Installed RPM count: `1697` (`docs/phase-10/opensuse-kde-packages.lock`)

## 2. Configured Official Repositories (`zypper repos -u`)

| Alias | Enabled | GPG Check | Refresh | URI |
|---|---|---|---|---|
| `repo-oss` | Yes | `( p) Yes` | Yes | `http://download.opensuse.org/ports/riscv/tumbleweed/repo/oss/` |
| `repo-update` | Yes | `( p) Yes` | Yes | `http://download.opensuse.org/ports/riscv/update/tumbleweed/` |
| `repo-openh264` | Yes | `( p) Yes` | Yes | `http://codecs.opensuse.org/openh264/openSUSE_Tumbleweed` |
| `repo-debug` | No | `----` | `----` | `http://download.opensuse.org/ports/riscv/debug/tumbleweed/repo/oss/` |
| `repo-source` | No | `----` | `----` | `http://download.opensuse.org/ports/riscv/source/tumbleweed/repo/oss/` |

## 3. Live Network & Repository Verification

- `curl -sI http://download.opensuse.org/ports/riscv/tumbleweed/repo/oss/repodata/repomd.xml` -> `HTTP/1.1 200 OK`
- `zypper --non-interactive refresh repo-update` -> `Retrieving repository 'openSUSE-Tumbleweed-Update' metadata ... [done]`, `Building repository 'openSUSE-Tumbleweed-Update' cache ... [done]`, `Specified repositories have been refreshed.`
- Package installations during rootfs adaptation (`dolphin`, `dbus-1-daemon`, `Mesa-demo-egl`) succeeded with GPG signature checks enabled (no `--no-gpg-checks`).
- Full `zypper dup` rolling upgrade was not executed on the live persistent disk per Phase 10 policy.
