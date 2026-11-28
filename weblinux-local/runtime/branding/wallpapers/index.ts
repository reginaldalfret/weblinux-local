/**
 * WebLinux Phase 16.1 — Shared Distribution-Logo Wallpaper Registry
 *
 * Maps all six KDE Plasma distributions (and legacy aliases) to their
 * authentic distribution-logo SVG/PNG wallpapers and tracks known Phase 16
 * and default KDE wallpaper paths for safe, idempotent v2 migration.
 */

import { AnyBrandingIdentifier, BrandingProfileId, WallpaperRegistryEntry } from '../types';

export const WALLPAPER_V2_MIGRATION_MARKER =
  '~/.local/state/weblinux/branding-v2-logo-wallpaper-applied';

export const GENERIC_DEFAULT_WALLPAPER_PATHS: readonly string[] = [
  '/usr/share/wallpapers/Next',
  '/usr/share/wallpapers/Next/contents/images/1920x1080.png',
  '/usr/share/wallpapers/Next/contents/images/5120x2880.png',
  '/usr/share/wallpapers/Breeze',
  '/usr/share/wallpapers/Breeze/contents/images/1920x1080.png',
];

export const WALLPAPER_REGISTRY: Record<BrandingProfileId, WallpaperRegistryEntry> = {
  'debian-kde': {
    profileId: 'debian-kde',
    aliases: ['debian-firefox'],
    wallpaperId: 'debian-trixie-logo-weblinux',
    svgFilename: 'debian-trixie-logo-wallpaper.svg',
    pngFilename: 'debian-trixie-logo-wallpaper.png',
    svgPath: '/usr/share/wallpapers/WebLinux-Debian/contents/images/debian-trixie-logo-wallpaper.svg',
    pngPath: '/usr/share/wallpapers/WebLinux-Debian/contents/images/debian-trixie-logo-wallpaper.png',
    fallbackColor: '#a80030',
    previewAssetUri: '/branding/debian/debian-trixie-logo-wallpaper.png',
    previousPaths: [
      '/usr/share/wallpapers/WebLinux-Debian/contents/images/1920x1080.png',
      '/usr/share/wallpapers/DebianTheme',
      '/usr/share/wallpapers/DebianTheme/contents/images/1920x1080.svg',
      '/usr/share/wallpapers/DebianTheme/contents/images/1920x1080.png',
      '/usr/share/wallpapers/Ceratopsian',
    ],
  },
  'ubuntu-kde': {
    profileId: 'ubuntu-kde',
    aliases: ['ubuntu-kde-epiphany'],
    wallpaperId: 'ubuntu-2404-logo-weblinux',
    svgFilename: 'ubuntu-2404-logo-wallpaper.svg',
    pngFilename: 'ubuntu-2404-logo-wallpaper.png',
    svgPath: '/usr/share/wallpapers/WebLinux-Ubuntu/contents/images/ubuntu-2404-logo-wallpaper.svg',
    pngPath: '/usr/share/wallpapers/WebLinux-Ubuntu/contents/images/ubuntu-2404-logo-wallpaper.png',
    fallbackColor: '#77216f',
    previewAssetUri: '/branding/ubuntu/ubuntu-2404-logo-wallpaper.png',
    previousPaths: [
      '/usr/share/wallpapers/WebLinux-Ubuntu/contents/images/1920x1080.png',
      '/usr/share/wallpapers/UbuntuNoble',
      '/usr/share/wallpapers/UbuntuNoble/contents/images/3840x2160.png',
      '/usr/share/wallpapers/UbuntuNoble/contents/images/1920x1080.png',
    ],
  },
  'arch-kde': {
    profileId: 'arch-kde',
    aliases: [],
    wallpaperId: 'arch-linux-logo-weblinux',
    svgFilename: 'arch-linux-logo-wallpaper.svg',
    pngFilename: 'arch-linux-logo-wallpaper.png',
    svgPath: '/usr/share/wallpapers/WebLinux-Arch/contents/images/arch-linux-logo-wallpaper.svg',
    pngPath: '/usr/share/wallpapers/WebLinux-Arch/contents/images/arch-linux-logo-wallpaper.png',
    fallbackColor: '#1793d1',
    previewAssetUri: '/branding/arch/arch-linux-logo-wallpaper.png',
    previousPaths: [
      '/usr/share/wallpapers/WebLinux-Arch/contents/images/1920x1080.png',
      '/usr/share/wallpapers/ArchLinux',
      '/usr/share/wallpapers/ArchLinux/contents/images/5120x2880.png',
      '/usr/share/wallpapers/ArchLinux/contents/images/1920x1080.png',
    ],
  },
  'opensuse-tumbleweed-kde': {
    profileId: 'opensuse-tumbleweed-kde',
    aliases: [],
    wallpaperId: 'opensuse-tumbleweed-logo-weblinux',
    svgFilename: 'opensuse-tumbleweed-logo-wallpaper.svg',
    pngFilename: 'opensuse-tumbleweed-logo-wallpaper.png',
    svgPath:
      '/usr/share/wallpapers/WebLinux-openSUSE/contents/images/opensuse-tumbleweed-logo-wallpaper.svg',
    pngPath:
      '/usr/share/wallpapers/WebLinux-openSUSE/contents/images/opensuse-tumbleweed-logo-wallpaper.png',
    fallbackColor: '#173f4f',
    previewAssetUri: '/branding/opensuse/opensuse-tumbleweed-logo-wallpaper.png',
    previousPaths: [
      '/usr/share/wallpapers/WebLinux-openSUSE/contents/images/1920x1080.png',
      '/usr/share/wallpapers/openSUSEdefault',
      '/usr/share/wallpapers/openSUSEdefault/contents/images/default.png',
      '/usr/share/wallpapers/openSUSEdefault/contents/images/default-dark.png',
    ],
  },
  'fedora-kde': {
    profileId: 'fedora-kde',
    aliases: [],
    wallpaperId: 'fedora-45-logo-weblinux',
    svgFilename: 'fedora-45-logo-wallpaper.svg',
    pngFilename: 'fedora-45-logo-wallpaper.png',
    svgPath: '/usr/share/wallpapers/WebLinux-Fedora/contents/images/fedora-45-logo-wallpaper.svg',
    pngPath: '/usr/share/wallpapers/WebLinux-Fedora/contents/images/fedora-45-logo-wallpaper.png',
    fallbackColor: '#294172',
    previewAssetUri: '/branding/fedora/fedora-45-logo-wallpaper.png',
    previousPaths: [
      '/usr/share/wallpapers/WebLinux-Fedora/contents/images/1920x1080.png',
      '/usr/share/wallpapers/F45',
      '/usr/share/wallpapers/F45/contents/images/default.png',
      '/usr/share/wallpapers/F45/contents/images/default.jxl',
    ],
  },
  'alpine-kde': {
    profileId: 'alpine-kde',
    aliases: [],
    wallpaperId: 'alpine-324-logo-weblinux',
    svgFilename: 'alpine-324-logo-wallpaper.svg',
    pngFilename: 'alpine-324-logo-wallpaper.png',
    svgPath: '/usr/share/wallpapers/WebLinux-Alpine/contents/images/alpine-324-logo-wallpaper.svg',
    pngPath: '/usr/share/wallpapers/WebLinux-Alpine/contents/images/alpine-324-logo-wallpaper.png',
    fallbackColor: '#0d597f',
    previewAssetUri: '/branding/alpine/alpine-324-logo-wallpaper.png',
    previousPaths: ['/usr/share/wallpapers/WebLinux-Alpine/contents/images/1920x1080.png'],
  },
};

export const KNOWN_PREVIOUS_AND_DEFAULT_WALLPAPER_PATHS: readonly string[] = [
  ...Object.values(WALLPAPER_REGISTRY).flatMap((entry) => entry.previousPaths),
  ...GENERIC_DEFAULT_WALLPAPER_PATHS,
];

const WALLPAPER_ALIASES: Record<string, BrandingProfileId> = {
  'debian-kde': 'debian-kde',
  'debian-firefox': 'debian-kde',
  'ubuntu-kde': 'ubuntu-kde',
  'ubuntu-kde-epiphany': 'ubuntu-kde',
  'arch-kde': 'arch-kde',
  'opensuse-tumbleweed-kde': 'opensuse-tumbleweed-kde',
  'fedora-kde': 'fedora-kde',
  'alpine-kde': 'alpine-kde',
};

export function getWallpaperRegistryEntry(
  idOrAlias: AnyBrandingIdentifier
): WallpaperRegistryEntry | null {
  const canonical = WALLPAPER_ALIASES[idOrAlias.trim().toLowerCase()];
  return canonical ? WALLPAPER_REGISTRY[canonical] : null;
}

export function normalizeWallpaperPath(rawPath: string): string {
  return rawPath.trim().replace(/^file:\/\//, '').replace(/\/+$/, '');
}

export function isKnownPreviousOrDefaultWallpaperPath(rawPath: string): boolean {
  const normalized = normalizeWallpaperPath(rawPath);
  if (!normalized) {
    return true;
  }
  return KNOWN_PREVIOUS_AND_DEFAULT_WALLPAPER_PATHS.some((known) => {
    const k = normalizeWallpaperPath(known);
    return normalized === k || normalized.startsWith(`${k}/`);
  });
}
