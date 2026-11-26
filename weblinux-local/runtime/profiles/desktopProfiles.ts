/**
 * WebLinux Local - Official Desktop Profiles
 * Implements strict metadata, system requirements, launch commands,
 * and operational constraints for KDE Plasma 6, GNOME 48, and XFCE 4.20.
 */

import { DesktopProfile } from '../types';

export const DEBIAN_DESKTOP_PROFILES: Record<string, DesktopProfile> = {
  'kde-plasma': {
    id: 'kde-plasma',
    name: 'KDE Plasma 6',
    version: '6.3.0',
    tagline: 'Modern, Adaptive Desktop Environment',
    description: 'Full-featured KDE Plasma 6 desktop shell running on Qt 6.8 and KDE Frameworks 6 over Wayland. Integrated with Konsole, Dolphin file manager, Breeze themes, and full multi-window compositor capabilities.',
    distributionId: 'debian',
    status: 'validated',
    sessionCommand: 'desktop wayland plasma-native',
    compositor: 'wlserver / KWin 6',
    rootfsManifestId: 'debian-13-kde-plasma6',
    minimumRamMB: 2048,
    recommendedRamMB: 2048,
    supportedFeatures: [
      'Kickoff Application Launcher',
      'Konsole Terminal with Wayland clipboard',
      'Dolphin File Manager with full ext4 CRUD',
      'Multi-Window Lifecycle (Move, Resize, Min/Max)',
      'Hardware-accelerated WebGL2 rendering',
      'Persistent OPFS storage synchronization'
    ],
    knownLimitations: [
      'Qt Quick complex 3D particle animations fall back to software rasters on low-end GPUs',
      'Virtual screen resolution adjustments require client surface renegotiation'
    ],
    previewImage: '/screenshots/phase4/02-debian-kde-desktop.png'
  },
  'gnome': {
    id: 'gnome',
    name: 'GNOME 48',
    version: '48.0',
    tagline: 'Streamlined Workspace-Centric Desktop',
    description: 'Modern, intuitive GNOME 48 desktop powered by Mutter and Libadwaita. Features the top bar, Activities spatial overview, application grid, Nautilus file manager, and GNOME Console.',
    distributionId: 'debian',
    status: 'experimental',
    sessionCommand: 'debian /usr/local/bin/weblinux-gnome-session',
    compositor: 'Mutter (Nested Wayland Session)',
    rootfsManifestId: 'debian-13-gnome-48',
    minimumRamMB: 2048,
    recommendedRamMB: 3072,
    supportedFeatures: [
      'GNOME Top Bar with Status Area & System Indicators',
      'Activities Spatial Overview & Dynamic Workspaces',
      'Application Grid Navigation',
      'Nautilus (GNOME Files) ext4 browsing',
      'GNOME Console / Terminal integration',
      'Nested Wayland compositor surface pipeline'
    ],
    knownLimitations: [
      'Higher memory baseline than XFCE/KDE; 3072 MiB recommended on host systems',
      'Hardware cursor acceleration requires WebGL2 vertex uniform extensions'
    ],
    previewImage: '/screenshots/phase5/04-gnome-desktop.png'
  },
  'xfce': {
    id: 'xfce',
    name: 'XFCE 4.20',
    version: '4.20.0',
    tagline: 'Fast, Traditional Lightweight Desktop',
    description: 'Ultra-lightweight modular desktop running XFCE 4.20 with the Labwc Wayland stacking compositor. Includes traditional panel, Whisker/Applications menu, Thunar file manager, and XFCE Terminal.',
    distributionId: 'debian',
    status: 'experimental',
    sessionCommand: 'debian /usr/local/bin/weblinux-xfce-session',
    compositor: 'Labwc 0.8 (wlroots-based Wayland Compositor)',
    rootfsManifestId: 'debian-13-xfce-420',
    minimumRamMB: 1024,
    recommendedRamMB: 2048,
    supportedFeatures: [
      'Traditional desktop panel with applets & system tray',
      'Application Menu & Desktop Finder',
      'Thunar File Manager with tabbed navigation',
      'XFCE Terminal with low memory footprint',
      'Labwc lightweight window management',
      'Instantaneous boot & minimal worker load'
    ],
    knownLimitations: [
      'XFCE Wayland session is experimental in upstream Debian 13; xfwm4 fallback unavailable in pure Wayland',
      'Some legacy X11 panel plugins require Xwayland rootful bridge'
    ],
    previewImage: '/screenshots/phase5/10-xfce-desktop.png'
  },
  'cli': {
    id: 'cli',
    name: 'Ubuntu CLI Shell',
    version: '24.04.5 LTS',
    tagline: 'High-Performance RISC-V 64-bit Terminal Environment',
    description: 'Official Ubuntu 24.04.5 LTS (Noble Numbat) interactive terminal environment running under the RISC-V 64-bit NOMMU WebAssembly execution engine with /bin/rv syscall emulation, full ext4 root filesystem, and APT package management.',
    distributionId: 'ubuntu',
    status: 'validated',
    sessionCommand: 'ubuntu /bin/bash',
    compositor: 'Linux Native Terminal / TTY',
    rootfsManifestId: 'ubuntu-24.04-cli',
    minimumRamMB: 2048,
    recommendedRamMB: 2048,
    supportedFeatures: [
      'Interactive Bash 5.2 / Dash shell',
      'Authentic Ubuntu Noble userspace (/etc/os-release)',
      'APT / Dpkg package management inspection',
      'Ext4 virtual disk mount on /ubuntu with 2,555 files',
      'Persistent OPFS home directory on /ubuntu/root (/dev/wdb)',
      'Full Linux utilities: ls, cat, uname, df, ps, env, id'
    ],
    knownLimitations: [
      'Graphical Wayland compositor disabled in Phase 6.3 (CLI only)',
      'Fork/exec emulation handled via /bin/rv binfmt_misc'
    ],
    previewImage: '/screenshots/phase6/ubuntu-cli-terminal.png'
  },
  'ubuntu-gnome': {
    id: 'ubuntu-gnome',
    name: 'Ubuntu GNOME 46',
    version: '46.0',
    tagline: 'Authentic Ubuntu Noble Desktop Experience',
    description: 'Official Ubuntu 24.04.5 LTS (Noble Numbat) GNOME 46 graphical desktop environment powered by Mutter 46 and GNOME Shell on RISC-V 64-bit NOMMU. Features the Ubuntu Yaru theme, GNOME top bar, dynamic workspaces, Nautilus 46 file manager, and nested Wayland display architecture.',
    distributionId: 'ubuntu',
    status: 'validated',
    sessionCommand: 'ubuntu /usr/local/bin/ubuntu-gnome-session',
    compositor: 'Mutter 46 (Nested Wayland Session)',
    rootfsManifestId: 'ubuntu-24.04-gnome',
    minimumRamMB: 2048,
    recommendedRamMB: 2048,
    supportedFeatures: [
      'Authentic Ubuntu Noble GNOME 46 Shell and Mutter compositor',
      'Ubuntu Yaru theme and icons',
      'GNOME Top Bar with system indicators and quick settings',
      'Activities Spatial Overview and dynamic workspaces',
      'Nautilus 46 File Manager with ext4 persistence',
      'Nested Wayland compositor over WebGL2 display bridge',
      'Hardware-isolated persistent home storage on /ubuntu/root'
    ],
    knownLimitations: [
      'GJS and SpiderMonkey running in interpreter mode (JS_DISABLE_JIT=1) under NOMMU',
      'Animations disabled via GSettings override for smooth browser rendering'
    ],
    previewImage: '/screenshots/phase6/04-ubuntu-gnome-desktop.png'
  },
  'ubuntu-kde': {
    id: 'ubuntu-kde',
    name: 'Ubuntu KDE Plasma 5.27',
    version: '5.27.12 LTS',
    tagline: 'Qt5-Powered Ubuntu Noble Graphical Desktop',
    description: 'Authentic Ubuntu 24.04.5 LTS (Noble Numbat) KDE Plasma 5.27 LTS desktop environment powered by Qt 5.15.13, KDE Frameworks 5.115, plasmashell, Konsole, Dolphin, and System Settings over WebLinux Wayland.',
    distributionId: 'ubuntu',
    status: 'experimental',
    sessionCommand: 'ubuntu-kde /usr/local/bin/ubuntu-kde-session',
    compositor: 'wlserver / KWin 5.27',
    rootfsManifestId: 'ubuntu-24.04-kde',
    minimumRamMB: 2048,
    recommendedRamMB: 2048,
    supportedFeatures: [
      'Authentic Ubuntu Noble KDE Plasma 5.27.12 LTS Shell',
      'Konsole 23.08 Terminal & Dolphin 23.08 File Manager',
      'System Settings & Breeze 5.27 Theme',
      'Qt Quick Software Renderer (no SpiderMonkey JIT overhead)',
      'Native wlserver WLSERVER_SHELL=plasma Wayland integration',
      'Isolated root-ubuntu-kde disk + persistent home-ubuntu'
    ],
    knownLimitations: [
      'Software Qt Quick rendering (QT_QUICK_BACKEND=software)',
      'Experimental Ubuntu graphical profile'
    ],
    previewImage: '/screenshots/phase6/04-ubuntu-kde-desktop.png'
  },
  'arch-kde': {
    id: 'arch-kde',
    name: 'Arch KDE Plasma 6',
    version: '6.8.3',
    tagline: 'Arch Linux RISC-V Rolling KDE Plasma 6 Desktop',
    description: 'Authentic Arch Linux RISC-V (RV64GC / LP64D) community port running KDE Plasma 6.8.3, Qt 6.12.0, KWin 6.8.3, Konsole 26.08.3, and Dolphin 26.08.3 with pacman 7.1 package management.',
    distributionId: 'arch-kde',
    status: 'experimental',
    sessionCommand: 'arch-kde /usr/local/bin/arch-kde-session',
    compositor: 'wlserver / KWin 6.8.3',
    rootfsManifestId: 'arch-kde',
    minimumRamMB: 2048,
    recommendedRamMB: 2048,
    supportedFeatures: [
      'Arch Linux RISC-V (RV64GC / LP64D) userspace',
      'KDE Plasma 6.8.3 & Qt 6.12.0 over Wayland',
      'Konsole 26.08.3 Terminal & Dolphin 26.08.3 File Manager',
      'Pacman 7.1.0 package manager with signed repos',
      'Isolated root-arch-kde + persistent home-arch-kde'
    ],
    knownLimitations: [
      'Community-maintained RISC-V port (experimental)',
      'Software QML fallback when RVGPU is unavailable'
    ],
    previewImage: '/screenshots/phase9/arch-kde-desktop.png'
  },
  'opensuse-tumbleweed-kde': {
    id: 'opensuse-tumbleweed-kde',
    name: 'openSUSE Tumbleweed KDE Plasma 6',
    version: '6.8.2',
    tagline: 'openSUSE Tumbleweed RISC-V Rolling KDE Plasma 6 Desktop',
    description: 'Authentic openSUSE Tumbleweed RISC-V (RV64GC / LP64D, Snapshot 20261106) running KDE Plasma 6.8.2, Qt 6.12.0, KWin 6.8.2, Konsole 26.08.3, and Dolphin 26.08.3 with RPM 4.20.1 & Zypper 1.14.102.',
    distributionId: 'opensuse-tumbleweed-kde',
    status: 'experimental',
    sessionCommand: 'opensuse-kde /usr/local/bin/opensuse-kde-session',
    compositor: 'wlserver / KWin 6.8.2',
    rootfsManifestId: 'opensuse-tumbleweed-kde',
    minimumRamMB: 2048,
    recommendedRamMB: 2048,
    supportedFeatures: [
      'openSUSE Tumbleweed RISC-V (RV64GC / LP64D) userspace',
      'KDE Plasma 6.8.2 & Qt 6.12.0 over Wayland',
      'Konsole 26.08.3 Terminal & Dolphin 26.08.3 File Manager',
      'Zypper 1.14.102 & RPM 4.20.1 with GPG-signed repositories',
      'Isolated root-opensuse-tumbleweed-kde + persistent home-opensuse-tumbleweed-kde'
    ],
    knownLimitations: [
      'Experimental RISC-V community port on Linux 6.6.0 NOMMU',
      'Software QML rendering fallback for Qt 6.12 Plasma Shell'
    ],
    previewImage: '/screenshots/phase10/opensuse-kde-desktop.png'
  }
};
