/**
 * WebLinux Local - Shared KDE Branding Profiles & Alias Resolution
 *
 * Provides canonical branding configurations for all 6 KDE Plasma distributions,
 * preserving Plasma 5.27 (Ubuntu 24.04.5) vs Plasma 6 (Debian, Arch, openSUSE,
 * Fedora, Alpine) tooling differences and mapping legacy/disk-isolated manifest IDs
 * (`debian-firefox`, `ubuntu-kde-epiphany`) to stable branding IDs without
 * altering OPFS disk identities.
 */

import {
  AnyBrandingIdentifier,
  BrandingMigrationPolicy,
  BrandingProfileId,
  KdeBrandingProfile,
  PlasmaConfigPaths,
  PlasmaMajorVersion,
  PlasmaToolingInfo,
} from './types';

export const DEFAULT_CONFIG_PATHS: PlasmaConfigPaths = {
  kdeglobals: '~/.config/kdeglobals',
  kwinrc: '~/.config/kwinrc',
  plasmarc: '~/.config/plasmarc',
  appletsrc: '~/.config/plasma-org.kde.plasma.desktop-appletsrc',
  ksplashrc: '~/.config/ksplashrc',
  kscreenlockerrc: '~/.config/kscreenlockerrc',
  konsolerc: '~/.config/konsolerc',
};

export const DEFAULT_MIGRATION_POLICY: BrandingMigrationPolicy = {
  stateMarkerPath: '~/.local/state/weblinux/branding-v1-applied',
  backupBaseDir: '~/.local/state/weblinux/backups',
  idempotent: true,
  preserveUserData: true,
};

export const BRANDING_PROFILE_ALIASES: Record<string, BrandingProfileId> = {
  'debian-kde': 'debian-kde',
  'debian-firefox': 'debian-kde',
  'ubuntu-kde': 'ubuntu-kde',
  'ubuntu-kde-epiphany': 'ubuntu-kde',
  'arch-kde': 'arch-kde',
  'opensuse-tumbleweed-kde': 'opensuse-tumbleweed-kde',
  'fedora-kde': 'fedora-kde',
  'alpine-kde': 'alpine-kde',
};

export function getPlasmaConfigTools(plasmaMajor: PlasmaMajorVersion): PlasmaToolingInfo {
  if (plasmaMajor === 5) {
    return {
      plasmaMajor: 5,
      qtMajor: 5,
      kwriteconfig: 'kwriteconfig5',
      kreadconfig: 'kreadconfig5',
      qdbus: 'qdbus',
    };
  }
  return {
    plasmaMajor: 6,
    qtMajor: 6,
    kwriteconfig: 'kwriteconfig6',
    kreadconfig: 'kreadconfig6',
    qdbus: 'qdbus6',
  };
}

export const BRANDING_PROFILES: Record<BrandingProfileId, KdeBrandingProfile> = {
  'debian-kde': {
    id: 'debian-kde',
    aliases: ['debian-firefox'],
    displayName: 'Debian 13 (Trixie) KDE Plasma 6',
    distroName: 'Debian GNU/Linux',
    releaseVersion: '13 / trixie',
    plasmaMajor: 6,
    plasmaVersion: '6.3',
    qtMajor: 6,
    kwriteconfigTool: 'kwriteconfig6',
    kreadconfigTool: 'kreadconfig6',
    configPaths: DEFAULT_CONFIG_PATHS,
    wallpaper: {
      id: 'debian-ceratopsian-weblinux',
      path: '/usr/share/wallpapers/WebLinux-Debian/contents/images/1920x1080.png',
      fallbackColor: '#a80030',
      fillMode: 'PreserveAspectCrop',
      previewAssetUri: '/branding/debian/wallpaper.png',
    },
    theme: {
      lookAndFeel: 'org.kde.breezedark.desktop',
      colorScheme: 'BreezeDark',
      iconTheme: 'breeze-dark',
      cursorTheme: 'breeze_cursors',
      cursorSize: 24,
      plasmaTheme: 'breeze-dark',
      windowDecoration: 'org.kde.breeze',
      fontGeneral: 'Noto Sans,10,-1,5,400,0,0,0,0,0',
      fontFixed: 'Noto Sans Mono,10,-1,5,400,0,0,0,0,0',
    },
    terminal: {
      profileName: 'Debian-WebLinux',
      colorScheme: 'Breeze',
      font: 'Noto Sans Mono,10,-1,5,400,0,0,0,0,0',
      opacity: 0.95,
      shellPromptTag: 'debian-riscv64',
    },
    launcher: {
      icon: 'distributor-logo-debian',
      title: 'Debian 13',
      showFavorites: true,
      accentHex: '#d70a53',
    },
    layoutPreset: 'breeze-classic',
    lockScreen: {
      supported: true,
      path: '/usr/share/wallpapers/WebLinux-Debian/contents/images/1920x1080.png',
      themePlugin: 'org.kde.breeze.desktop',
    },
    splashScreen: {
      supported: true,
      themePlugin: 'org.kde.breeze.desktop',
      notes: 'Uses Plasma 6 Breeze splash with Debian launcher emblem',
    },
    migration: DEFAULT_MIGRATION_POLICY,
  },

  'ubuntu-kde': {
    id: 'ubuntu-kde',
    aliases: ['ubuntu-kde-epiphany'],
    displayName: 'Ubuntu 24.04.5 LTS KDE Plasma 5.27',
    distroName: 'Ubuntu',
    releaseVersion: '24.04.5 LTS',
    plasmaMajor: 5,
    plasmaVersion: '5.27.12',
    qtMajor: 5,
    kwriteconfigTool: 'kwriteconfig5',
    kreadconfigTool: 'kreadconfig5',
    configPaths: DEFAULT_CONFIG_PATHS,
    wallpaper: {
      id: 'ubuntu-noble-weblinux',
      path: '/usr/share/wallpapers/WebLinux-Ubuntu/contents/images/1920x1080.png',
      fallbackColor: '#77216f',
      fillMode: 'PreserveAspectCrop',
      previewAssetUri: '/branding/ubuntu/wallpaper.png',
    },
    theme: {
      lookAndFeel: 'org.kde.breezedark.desktop',
      colorScheme: 'BreezeDark',
      iconTheme: 'breeze-dark',
      cursorTheme: 'breeze_cursors',
      cursorSize: 24,
      plasmaTheme: 'breeze-dark',
      windowDecoration: 'org.kde.breeze',
      fontGeneral: 'Ubuntu,10,-1,5,50,0,0,0,0,0',
      fontFixed: 'Ubuntu Mono,11,-1,5,50,0,0,0,0,0',
    },
    terminal: {
      profileName: 'Ubuntu-WebLinux',
      colorScheme: 'Breeze',
      font: 'Ubuntu Mono,11,-1,5,50,0,0,0,0,0',
      opacity: 0.95,
      shellPromptTag: 'ubuntu-noble',
    },
    launcher: {
      icon: 'distributor-logo-ubuntu',
      title: 'Ubuntu 24.04',
      showFavorites: true,
      accentHex: '#e95420',
    },
    layoutPreset: 'ubuntu-dock',
    lockScreen: {
      supported: true,
      path: '/usr/share/wallpapers/WebLinux-Ubuntu/contents/images/1920x1080.png',
      themePlugin: 'org.kde.breeze.desktop',
      notes: 'Plasma 5.27 kscreenlockerrc Greeter configuration',
    },
    splashScreen: {
      supported: true,
      themePlugin: 'org.kde.breeze.desktop',
      notes: 'Plasma 5.27 ksplashrc Breeze theme',
    },
    migration: DEFAULT_MIGRATION_POLICY,
  },

  'arch-kde': {
    id: 'arch-kde',
    aliases: [],
    displayName: 'Arch Linux RISC-V KDE Plasma 6',
    distroName: 'Arch Linux',
    releaseVersion: 'Rolling',
    plasmaMajor: 6,
    plasmaVersion: '6.8.3',
    qtMajor: 6,
    kwriteconfigTool: 'kwriteconfig6',
    kreadconfigTool: 'kreadconfig6',
    configPaths: DEFAULT_CONFIG_PATHS,
    wallpaper: {
      id: 'arch-weblinux',
      path: '/usr/share/wallpapers/WebLinux-Arch/contents/images/1920x1080.png',
      fallbackColor: '#1793d1',
      fillMode: 'PreserveAspectCrop',
      previewAssetUri: '/branding/arch/wallpaper.png',
    },
    theme: {
      lookAndFeel: 'org.kde.breezedark.desktop',
      colorScheme: 'BreezeDark',
      iconTheme: 'breeze-dark',
      cursorTheme: 'breeze_cursors',
      cursorSize: 24,
      plasmaTheme: 'breeze-dark',
      windowDecoration: 'org.kde.breeze',
      fontGeneral: 'Noto Sans,10,-1,5,400,0,0,0,0,0',
      fontFixed: 'Noto Sans Mono,10,-1,5,400,0,0,0,0,0',
    },
    terminal: {
      profileName: 'Arch-WebLinux',
      colorScheme: 'Breeze',
      font: 'Noto Sans Mono,10,-1,5,400,0,0,0,0,0',
      opacity: 0.94,
      shellPromptTag: 'arch-riscv64',
    },
    launcher: {
      icon: 'distributor-logo-archlinux',
      title: 'Arch Linux',
      showFavorites: true,
      accentHex: '#1793d1',
    },
    layoutPreset: 'arch-minimal',
    lockScreen: {
      supported: true,
      path: '/usr/share/wallpapers/WebLinux-Arch/contents/images/1920x1080.png',
      themePlugin: 'org.kde.breeze.desktop',
    },
    splashScreen: {
      supported: true,
      themePlugin: 'org.kde.breeze.desktop',
    },
    migration: DEFAULT_MIGRATION_POLICY,
  },

  'opensuse-tumbleweed-kde': {
    id: 'opensuse-tumbleweed-kde',
    aliases: [],
    displayName: 'openSUSE Tumbleweed RISC-V KDE Plasma 6',
    distroName: 'openSUSE Tumbleweed',
    releaseVersion: 'Snapshot 20261106',
    plasmaMajor: 6,
    plasmaVersion: '6.8.2',
    qtMajor: 6,
    kwriteconfigTool: 'kwriteconfig6',
    kreadconfigTool: 'kreadconfig6',
    configPaths: DEFAULT_CONFIG_PATHS,
    wallpaper: {
      id: 'opensuse-tumbleweed-weblinux',
      path: '/usr/share/wallpapers/WebLinux-openSUSE/contents/images/1920x1080.png',
      fallbackColor: '#173f4f',
      fillMode: 'PreserveAspectCrop',
      previewAssetUri: '/branding/opensuse/wallpaper.png',
    },
    theme: {
      lookAndFeel: 'org.openSUSE.desktop',
      colorScheme: 'BreezeDark',
      iconTheme: 'breeze-dark',
      cursorTheme: 'breeze_cursors',
      cursorSize: 24,
      plasmaTheme: 'breeze-dark',
      windowDecoration: 'org.kde.breeze',
      fontGeneral: 'Noto Sans,10,-1,5,400,0,0,0,0,0',
      fontFixed: 'Noto Sans Mono,10,-1,5,400,0,0,0,0,0',
    },
    terminal: {
      profileName: 'openSUSE-WebLinux',
      colorScheme: 'Breeze',
      font: 'Noto Sans Mono,10,-1,5,400,0,0,0,0,0',
      opacity: 0.95,
      shellPromptTag: 'tumbleweed-riscv64',
    },
    launcher: {
      icon: 'distributor-logo-opensuse',
      title: 'Tumbleweed',
      showFavorites: true,
      accentHex: '#73ba25',
    },
    layoutPreset: 'opensuse-emerald',
    lockScreen: {
      supported: true,
      path: '/usr/share/wallpapers/WebLinux-openSUSE/contents/images/1920x1080.png',
      themePlugin: 'org.kde.breeze.desktop',
    },
    splashScreen: {
      supported: true,
      themePlugin: 'org.kde.breeze.desktop',
    },
    migration: DEFAULT_MIGRATION_POLICY,
  },

  'fedora-kde': {
    id: 'fedora-kde',
    aliases: [],
    displayName: 'Fedora 45 RISC-V KDE Plasma 6',
    distroName: 'Fedora Linux',
    releaseVersion: '45',
    plasmaMajor: 6,
    plasmaVersion: '6.7.4',
    qtMajor: 6,
    kwriteconfigTool: 'kwriteconfig6',
    kreadconfigTool: 'kreadconfig6',
    configPaths: DEFAULT_CONFIG_PATHS,
    wallpaper: {
      id: 'fedora-45-weblinux',
      path: '/usr/share/wallpapers/WebLinux-Fedora/contents/images/1920x1080.png',
      fallbackColor: '#294172',
      fillMode: 'PreserveAspectCrop',
      previewAssetUri: '/branding/fedora/wallpaper.png',
    },
    theme: {
      lookAndFeel: 'org.fedoraproject.fedora.desktop',
      colorScheme: 'BreezeDark',
      iconTheme: 'breeze-dark',
      cursorTheme: 'breeze_cursors',
      cursorSize: 24,
      plasmaTheme: 'breeze-dark',
      windowDecoration: 'org.kde.breeze',
      fontGeneral: 'Noto Sans,10,-1,5,400,0,0,0,0,0',
      fontFixed: 'Noto Sans Mono,10,-1,5,400,0,0,0,0,0',
    },
    terminal: {
      profileName: 'Fedora-WebLinux',
      colorScheme: 'Breeze',
      font: 'Noto Sans Mono,10,-1,5,400,0,0,0,0,0',
      opacity: 0.95,
      shellPromptTag: 'fedora45-riscv64',
    },
    launcher: {
      icon: 'distributor-logo-fedora',
      title: 'Fedora 45',
      showFavorites: true,
      accentHex: '#3c6eb4',
    },
    layoutPreset: 'fedora-workstation',
    lockScreen: {
      supported: true,
      path: '/usr/share/wallpapers/WebLinux-Fedora/contents/images/1920x1080.png',
      themePlugin: 'org.kde.breeze.desktop',
    },
    splashScreen: {
      supported: true,
      themePlugin: 'org.kde.breeze.desktop',
    },
    migration: DEFAULT_MIGRATION_POLICY,
  },

  'alpine-kde': {
    id: 'alpine-kde',
    aliases: [],
    displayName: 'Alpine Linux 3.24.4 KDE Plasma 6',
    distroName: 'Alpine Linux',
    releaseVersion: '3.24.4',
    plasmaMajor: 6,
    plasmaVersion: '6.6.6',
    qtMajor: 6,
    kwriteconfigTool: 'kwriteconfig6',
    kreadconfigTool: 'kreadconfig6',
    configPaths: DEFAULT_CONFIG_PATHS,
    wallpaper: {
      id: 'alpine-324-weblinux',
      path: '/usr/share/wallpapers/WebLinux-Alpine/contents/images/1920x1080.png',
      fallbackColor: '#0d597f',
      fillMode: 'PreserveAspectCrop',
      previewAssetUri: '/branding/alpine/wallpaper.png',
    },
    theme: {
      lookAndFeel: 'org.kde.breezedark.desktop',
      colorScheme: 'BreezeDark',
      iconTheme: 'breeze-dark',
      cursorTheme: 'breeze_cursors',
      cursorSize: 24,
      plasmaTheme: 'breeze-dark',
      windowDecoration: 'org.kde.breeze',
      fontGeneral: 'DejaVu Sans,10,-1,5,400,0,0,0,0,0',
      fontFixed: 'DejaVu Sans Mono,10,-1,5,400,0,0,0,0,0',
    },
    terminal: {
      profileName: 'Alpine-WebLinux',
      colorScheme: 'Breeze',
      font: 'DejaVu Sans Mono,10,-1,5,400,0,0,0,0,0',
      opacity: 0.96,
      shellPromptTag: 'alpine-musl',
    },
    launcher: {
      icon: 'distributor-logo-alpine',
      title: 'Alpine 3.24',
      showFavorites: true,
      accentHex: '#0d597f',
    },
    layoutPreset: 'alpine-light',
    lockScreen: {
      supported: false,
      notes: 'Alpine NOMMU session runs direct KWin/Plasma without logind lockscreen daemon',
    },
    splashScreen: {
      supported: true,
      themePlugin: 'org.kde.breeze.desktop',
    },
    migration: DEFAULT_MIGRATION_POLICY,
  },
};

/**
 * Resolves a manifest ID or alias (e.g. `debian-firefox` -> `debian-kde`,
 * `ubuntu-kde-epiphany` -> `ubuntu-kde`) to its canonical BrandingProfileId.
 */
export function resolveBrandingProfileId(idOrAlias: AnyBrandingIdentifier): BrandingProfileId | null {
  const normalized = idOrAlias.trim().toLowerCase();
  return BRANDING_PROFILE_ALIASES[normalized] ?? null;
}

/**
 * Returns the KDE branding profile for a canonical ID or alias, or null if unknown.
 */
export function getBrandingProfile(idOrAlias: AnyBrandingIdentifier): KdeBrandingProfile | null {
  const resolved = resolveBrandingProfileId(idOrAlias);
  return resolved ? BRANDING_PROFILES[resolved] : null;
}

/**
 * Lists all canonical KDE branding profiles.
 */
export function listBrandingProfiles(): KdeBrandingProfile[] {
  return Object.values(BRANDING_PROFILES);
}
