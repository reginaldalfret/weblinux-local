#!/usr/bin/env bash
# WebLinux Phase 15 — Fedora 45 KDE Browser-Free & GPG Security Verification
# Verifies either a mounted Fedora 45 rootfs (default: /root/fedora-build/rootfs)
# or a live guest (pass "/" as $1).
set -euo pipefail

if [ $# -ge 1 ]; then
  RAW_ROOT="$1"
elif [ -d "/root/fedora-build/rootfs" ]; then
  RAW_ROOT="/root/fedora-build/rootfs"
else
  RAW_ROOT="/"
fi

R="${RAW_ROOT%/}"
if [ -n "$R" ]; then
  if [ ! -d "$R" ]; then
    echo "ERROR: Fedora rootfs directory not found: $R" >&2
    exit 1
  fi
  RPM_ROOT=(--root "$R")
  DISPLAY_ROOT="$R"
else
  RPM_ROOT=()
  DISPLAY_ROOT="/"
fi

FAILURES=0
pass() { echo "[PASS] $*"; }
fail() { echo "[FAIL] $*" >&2; FAILURES=$((FAILURES + 1)); }

echo "=== WebLinux Phase 15: Fedora 45 KDE No-Browser Verification ==="
echo "Target rootfs: $DISPLAY_ROOT"

# 1. Verify Fedora 45 identity
if [ -f "$R/etc/os-release" ] && grep -q '^ID=fedora$' "$R/etc/os-release" && grep -q '^VERSION_ID=45$' "$R/etc/os-release"; then
  pass "Fedora 45 identity verified ($R/etc/os-release)"
else
  fail "Missing or non-Fedora-45 $R/etc/os-release"
fi

# 2. Verify fail-closed GPG / DNF5 security configuration (gpgcheck=1)
OVERRIDE_FILE="$R/etc/dnf/repos.override.d/99-weblinux-security.repo"
KEY_FILE="$R/usr/share/pki/rpm-gpg/RPM-GPG-KEY-fedora-45-primary"

if [ -f "$OVERRIDE_FILE" ] && grep -q '^gpgcheck=1$' "$OVERRIDE_FILE"; then
  pass "DNF5 security override enforces gpgcheck=1 ($OVERRIDE_FILE)"
else
  fail "Missing or invalid gpgcheck=1 in $OVERRIDE_FILE"
fi

if [ -f "$OVERRIDE_FILE" ] && grep -q '^sslverify=1$' "$OVERRIDE_FILE"; then
  pass "DNF5 security override enforces sslverify=1 ($OVERRIDE_FILE)"
else
  fail "Missing sslverify=1 in $OVERRIDE_FILE"
fi

if [ -f "$KEY_FILE" ]; then
  pass "Fedora 45 primary GPG key present ($KEY_FILE)"
else
  fail "Missing Fedora 45 primary GPG key ($KEY_FILE)"
fi

for cfg_dir in "$R/etc/dnf" "$R/etc/dnf/repos.override.d" "$R/etc/yum.repos.d"; do
  if [ -d "$cfg_dir" ]; then
    if grep -rnE '^[[:space:]]*(gpgcheck|sslverify)[[:space:]]*=[[:space:]]*0\b' "$cfg_dir" >/dev/null 2>&1; then
      fail "Insecure gpgcheck=0 or sslverify=0 found under $cfg_dir"
    fi
  fi
done
pass "No gpgcheck=0 or sslverify=0 overrides detected in DNF/YUM config"

# 3. Verify zero browser RPMs and binaries
BROWSER_PKGS=(firefox epiphany falkon chromium)
for pkg in "${BROWSER_PKGS[@]}"; do
  if rpm "${RPM_ROOT[@]}" -q "$pkg" >/dev/null 2>&1; then
    fail "Browser RPM is installed: $pkg"
  else
    pass "Browser RPM absent: $pkg"
  fi
done

BROWSER_BINS=(firefox epiphany falkon chromium chromium-browser)
for bin in "${BROWSER_BINS[@]}"; do
  if [ -e "$R/usr/bin/$bin" ] || [ -L "$R/usr/bin/$bin" ]; then
    fail "Browser binary present: $R/usr/bin/$bin"
  fi
done
pass "No browser binaries present in $R/usr/bin"

# 4. Verify no WebLinux browser wrapper or desktop entry
if [ -e "$R/usr/local/bin/weblinux-browser" ] || [ -L "$R/usr/local/bin/weblinux-browser" ]; then
  fail "Browser wrapper still exists: $R/usr/local/bin/weblinux-browser"
else
  pass "Browser wrapper absent: $R/usr/local/bin/weblinux-browser"
fi

if [ -e "$R/usr/share/applications/weblinux-browser.desktop" ] || [ -L "$R/usr/share/applications/weblinux-browser.desktop" ]; then
  fail "Browser desktop entry still exists: $R/usr/share/applications/weblinux-browser.desktop"
else
  pass "Browser desktop entry absent: $R/usr/share/applications/weblinux-browser.desktop"
fi

for app_dir in "$R/usr/share/applications" "$R/usr/local/share/applications"; do
  if [ -d "$app_dir" ]; then
    if find "$app_dir" -maxdepth 2 -name '*weblinux-browser*.desktop' -print -quit | grep -q .; then
      fail "Unexpected weblinux-browser desktop file found in $app_dir"
    fi
  fi
done

# 5. Verify retained essential CLI and package management tools
REQUIRED_TOOLS=(curl git dnf5)
for tool in "${REQUIRED_TOOLS[@]}"; do
  if [ -x "$R/usr/bin/$tool" ] || [ -L "$R/usr/bin/$tool" ]; then
    owner=$(rpm "${RPM_ROOT[@]}" -qf "/usr/bin/$tool" 2>/dev/null || echo "unowned")
    pass "Retained tool present: /usr/bin/$tool ($owner)"
  else
    fail "Missing required tool: $R/usr/bin/$tool"
  fi
done

if [ -x "$R/usr/bin/wget" ] || [ -L "$R/usr/bin/wget" ]; then
  owner=$(rpm "${RPM_ROOT[@]}" -qf "/usr/bin/wget" 2>/dev/null || echo "unowned")
  pass "Retained tool present: /usr/bin/wget ($owner)"
else
  echo "[INFO] /usr/bin/wget not present (not included in Fedora 45 Container Base; curl is retained)"
fi

echo "=== Summary ==="
if [ "$FAILURES" -ne 0 ]; then
  echo "FAILED: $FAILURES verification check(s) failed." >&2
  exit 1
fi
echo "ALL CHECKS PASSED: Fedora 45 KDE rootfs is browser-free with gpgcheck=1 enforced."
