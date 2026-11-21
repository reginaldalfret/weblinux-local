# WebLinux Local Licensing & Legal Compliance Specification

## 1. Executive Summary & Legal Framework

WebLinux Local is an independent open-source platform providing direct browser-executed Linux environments. The WebLinux project utilizes WebAssembly, the Linux kernel, RISC-V application emulation, and graphical desktop technologies.

WebLinux Local is built upon and interfaces with components licensed under various open-source licenses, primarily the **GNU General Public License (GPL) version 2 or later**, **GPL version 2 only**, **GNU Lesser General Public License (LGPL)**, and permissive licenses including **MIT**, **BSD-3-Clause**, and **Apache-2.0**.

This document outlines:
1. Exact licensing breakdown across every architectural layer.
2. Corresponding Source code distribution obligations under GPL-2.0/GPL-3.0.
3. Separation of WebLinux Local branding and trademark assets from upstream trademarks.
4. Attribution requirements and copyright notices.

---

## 2. Upstream Core: rvwasm & linux-wasm

### 2.1 Upstream Foundation Licenses

| Component | Upstream Author / Project | License | Source / Repository |
|---|---|---|---|
| **rvwasm** | Swap | GPL-2.0-or-later | https://github.com/Pogo-Bash/rvwasm |
| **linux-wasm** | Joel Severin | GPL-2.0-only | https://github.com/joelseverin/linux-wasm |
| **Linux Kernel** | Linus Torvalds & contributors | GPL-2.0-only | https://kernel.org |
| **rv (RV64 JIT)** | Swap (rvwasm project) | GPL-2.0-or-later | `upstream-rvwasm/rv/` |
| **wlserver (Wayland Compositor)** | Swap (rvwasm project) | GPL-2.0-or-later | `upstream-rvwasm/wlserver/` |
| **hostnode & hostopen** | Swap (rvwasm project) | GPL-2.0-or-later | `upstream-rvwasm/hostnode/` |
| **gpuserver & vrend** | Swap / virglrenderer authors | GPL-2.0-or-later / MIT | `upstream-rvwasm/gpu/` |
| **video decoder (vdec)** | Swap / libva authors | MIT | `upstream-rvwasm/gpu/vdec/` |
| **Berkeley SoftFloat 3** | John R. Hauser / UC Berkeley | BSD-3-Clause | `third_party/berkeley-softfloat-3` |
| **musl libc** | Rich Felker et al. | MIT | https://musl.libc.org |
| **BusyBox** | Erik Andersen, Denys Vlasenko et al. | GPL-2.0-only | https://busybox.net |

---

## 3. Desktop Environments & System Libraries

### 3.1 KDE Plasma, Qt, and Native Desktop Binaries

| Package / Library | Upstream Author / Entity | License | WebLinux Treatment |
|---|---|---|---|
| **KDE Plasma 6** | KDE Community | LGPL-2.0-or-later, GPL-2.0-or-later | Native Wasm & riscv64 guest packages |
| **KDE Frameworks 6** | KDE Community | LGPL-2.0-or-later, BSD-3-Clause | Native Wasm & riscv64 guest packages |
| **Qt 6.8+** | The Qt Company & KDE Project | LGPL-3.0-only, GPL-2.0/3.0 | Static and dynamic Wasm binaries |
| **IceWM** | Marko Macek & contributors | LGPL-2.0-or-later | Experimental lightweight desktop target |
| **X.Org / Xwayland** | X.Org Foundation | MIT / X11 | riscv64 guest X11 subsystem |
| **PulseAudio** | Lennart Poettering & contributors | LGPL-2.1-or-later | Machine audio subsystem |
| **Mesa 3D (virgl/zink)** | Mesa Contributors | MIT | 3D graphics translation pipeline |

---

## 4. Corresponding Source Distribution Obligations

Because WebLinux Local distributes and serves compiled WebAssembly binaries (`vmlinux-wasm64_nommu.wasm`, `initramfs-wasm64_nommu.cpio.gz`, runtime JavaScript adapters, and RISC-V system image chunks) derived from GPL-2.0 and GPL-3.0 licensed works:

1. **Browser Distribution Constitutes Distribution:** In modern WebAssembly architectures, transmitting compiled binary wasm modules and JavaScript runtimes to the visitor's browser for client-side execution triggers software distribution provisions under GPL-2.0 Section 3.
2. **Availability of Complete Corresponding Source:**
   - WebLinux Local provides the complete machine-readable corresponding source code for all modified GPL components, including build scripts, patches, kernel configurations, and runtime glue code.
   - The upstream source repository snapshot is retained in `upstream-rvwasm` and documented patch pipelines are maintained in `runtime/` and `image-builder/`.
   - Links to all source repositories and patch sets are permanently published in the WebLinux Local interface footer and Documentation page.

---

## 5. Trademark & Branding Separation

1. **Independent Identity:** WebLinux Local is an independent project. It does not use, infringe, or claim ownership of upstream trademarks:
   - "rvwasm" and "plasmaontheweb.com" are trademarks of their respective owner (Swap). WebLinux Local explicitly designates itself as an independent downstream implementation.
   - "KDE", "KDE Plasma", and the KDE logo are registered trademarks of KDE e.V.
   - "Linux" is a registered trademark of Linus Torvalds.
   - "Debian" is a registered trademark of Software in the Public Interest, Inc.
   - "Ubuntu" is a registered trademark of Canonical Ltd.
   - "Fedora" is a trademark of Red Hat, Inc. / Fedora Project.
   - "Arch Linux" is a trademark of Aaron Griffin / Arch Linux Project.
   - "Kali Linux" is a trademark of OffSec Services Limited.
2. **Nominative Fair Use:** All operating system and distribution names are used solely for descriptive identification of compatibility and software packages.
3. **No Affiliation or Endorsement:** WebLinux Local is not endorsed by, affiliated with, or officially sponsored by KDE e.V., Canonical, Red Hat, Arch Linux, Debian, or OffSec.

---

## 6. Notices and Disclaimers

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
