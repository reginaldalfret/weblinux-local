# Phase 14.1 — Final Results (`PHASE-06-FINAL-RESULTS.md`)

## Summary Status by Distribution

| Distribution | Status | Browser | Key Finding |
|---|---|---|---|
| **Ubuntu 24.04.5 KDE** | **PASS** | Epiphany `Web 46.5` | Pre-installed Epiphany + `WebKitNetworkProcess` running on Plasma 5.27; HTTPS + OPFS persistence verified. |
| **openSUSE Tumbleweed KDE** | **PASS WITH LIMITATION** | Epiphany `Web 51.2` | Chromium 155 failed on NOMMU `fork()` and 359 MiB guest OOM; replaced with signed `epiphany-51.2-1.1` (`dbus-run-session`, `browser` user), verified running (`PID 468`, `WebKitNetworkProcess` `PID 492`). |
| **Alpine 3.24.4 KDE** | **PASS WITH LIMITATION** | Epiphany `Web 50.4` | Fixed BusyBox `%q`, `/root` `0711` traversal, `/tmp/runtime-browser`, and `dbus-run-session`; `BROWSER_LOG` clean, though `epiphany` exited before `ps`. |
| **Debian 13 KDE** | **PASS WITH LIMITATION** | Epiphany `Web 48.5` | Fixed `su: Authentication failure` via `setpriv`, updated manifest/UI from Firefox ESR to Epiphany Web; hit `libz.so.1: failed to map segment` under 2048 MiB NOMMU pressure after Plasma 6 startup. |
| **Arch Linux KDE** | **BLOCKED** | Chromium `157.0.8103.78-1` | Upstream `extra` repo has `simdutf 9.3.2-1` (`libsimdutf.so.37`) while `chromium` requires `libsimdutf.so.36`. |
| **Fedora 45 KDE** | **BLOCKED** | None | `gpgcheck=1` preserved; `dl.fedoraproject.org` `404` on `Everything/riscv64` and `riscv-koji` RPMs are unsigned. |

> [!NOTE]
> All browser configurations use experimental unsandboxed flags (`WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1` / `--no-sandbox`), keep TLS certificate verification enabled, and preserve RFC1918 private-network filtering on the host relay (`ws://127.0.0.1:8081`).
