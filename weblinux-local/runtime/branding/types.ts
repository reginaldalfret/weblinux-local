/**
 * WebLinux Local - Shared KDE Branding Engine Types
 * Version-aware branding configuration supporting KDE Plasma 5.27 and Plasma 6.x
 * across all WebLinux distributions without breaking OPFS disk identities.
 */

export type BrandingProfileId =
  | 'debian-kde'
  | 'ubuntu-kde'
  | 'arch-kde'
  | 'opensuse-tumbleweed-kde'
  | 'fedora-kde'
  | 'alpine-kde';

export type BrandingAliasId =
  | 'debian-firefox'
  | 'ubuntu-kde-epiphany';

export type AnyBrandingIdentifier = BrandingProfileId | BrandingAliasId | string;

export type PlasmaMajorVersion = 5 | 6;

export type DesktopLayoutPreset =
  | 'breeze-classic'
  | 'ubuntu-dock'
  | 'arch-minimal'
  | 'opensuse-emerald'
  | 'fedora-workstation'
  | 'alpine-light';

export interface WallpaperConfig {
  id: string;
  path: string;
  svgPath: string;
  pngPath: string;
  svgFilename: string;
  pngFilename: string;
  previousPaths: string[];
  fallbackColor: string;
  fillMode: 'PreserveAspectCrop' | 'PreserveAspectFit' | 'Stretch' | 'Tile';
  previewAssetUri: string;
}

export interface WallpaperRegistryEntry {
  profileId: BrandingProfileId;
  aliases: BrandingAliasId[];
  wallpaperId: string;
  svgFilename: string;
  pngFilename: string;
  svgPath: string;
  pngPath: string;
  fallbackColor: string;
  previewAssetUri: string;
  previousPaths: string[];
}

export interface KdeThemeConfig {
  lookAndFeel: string;
  colorScheme: string;
  iconTheme: string;
  cursorTheme: string;
  cursorSize: number;
  plasmaTheme: string;
  windowDecoration: string;
  fontGeneral: string;
  fontFixed: string;
}

export interface TerminalProfileConfig {
  profileName: string;
  colorScheme: string;
  font: string;
  opacity: number;
  shellPromptTag: string;
}

export interface LauncherConfig {
  icon: string;
  title: string;
  showFavorites: boolean;
  accentHex: string;
}

export interface ArtworkAssetConfig {
  supported: boolean;
  path?: string;
  themePlugin?: string;
  notes?: string;
}

export interface PlasmaConfigPaths {
  kdeglobals: string;
  kwinrc: string;
  plasmarc: string;
  appletsrc: string;
  ksplashrc: string;
  kscreenlockerrc: string;
  konsolerc: string;
}

export interface BrandingMigrationPolicy {
  stateMarkerPath: string;
  v2WallpaperMarkerPath: string;
  backupBaseDir: string;
  idempotent: boolean;
  preserveUserData: boolean;
}

export interface KdeBrandingProfile {
  id: BrandingProfileId;
  aliases: BrandingAliasId[];
  displayName: string;
  distroName: string;
  releaseVersion: string;
  plasmaMajor: PlasmaMajorVersion;
  plasmaVersion: string;
  qtMajor: 5 | 6;
  kwriteconfigTool: 'kwriteconfig5' | 'kwriteconfig6';
  kreadconfigTool: 'kreadconfig5' | 'kreadconfig6';
  configPaths: PlasmaConfigPaths;
  wallpaper: WallpaperConfig;
  theme: KdeThemeConfig;
  terminal: TerminalProfileConfig;
  launcher: LauncherConfig;
  layoutPreset: DesktopLayoutPreset;
  lockScreen: ArtworkAssetConfig;
  splashScreen: ArtworkAssetConfig;
  migration: BrandingMigrationPolicy;
}

export interface PlasmaToolingInfo {
  plasmaMajor: PlasmaMajorVersion;
  qtMajor: 5 | 6;
  kwriteconfig: 'kwriteconfig5' | 'kwriteconfig6';
  kreadconfig: 'kreadconfig5' | 'kreadconfig6';
  qdbus: 'qdbus' | 'qdbus6';
}
