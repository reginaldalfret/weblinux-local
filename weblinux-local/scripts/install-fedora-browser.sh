#!/usr/bin/env bash
# WebLinux Phase 14.2 — Fedora 45 RISC-V Browser Installer (Fail-Closed GPG Policy)
# Strictly enforces gpgcheck=1 from Phase 11.1; refuses unsigned RPMs and never uses --nogpgcheck.
set -euo pipefail

R="${1:-/root/fedora-build/rootfs}"
BROWSER_PKG="${BROWSER_PKG:-epiphany}"
KEY="$R/usr/share/pki/rpm-gpg/RPM-GPG-KEY-fedora-45-primary"
EXPECTED_FP="4F50A6114CD5C6976A7F1179655A4B02F577861E"
OVERRIDE_FILE="$R/etc/dnf/repos.override.d/99-weblinux-security.repo"

case "$BROWSER_PKG" in
  epiphany|falkon|firefox|chromium) ;;
  *)
    echo "ERROR: Unsupported BROWSER_PKG '$BROWSER_PKG' (allowed: epiphany, falkon, firefox, chromium)" >&2
    exit 2
    ;;
esac

if [ ! -d "$R" ]; then
  echo "ERROR: Fedora rootfs not found at $R" >&2
  exit 1
fi

if [ ! -f "$KEY" ]; then
  echo "ERROR: Missing Fedora 45 GPG key: $KEY" >&2
  exit 1
fi

ACTUAL_FP=$(gpg --show-keys --with-colons "$KEY" | python3 -c 'import sys; print(next(l.split(":")[9] for l in sys.stdin if l.startswith("fpr:")))')
if [ "$ACTUAL_FP" != "$EXPECTED_FP" ]; then
  echo "ERROR: Fedora 45 GPG key fingerprint mismatch: $ACTUAL_FP != $EXPECTED_FP" >&2
  exit 1
fi
rpmkeys --root "$R" --import "$KEY"

# Ensure Phase 11.1 fail-closed DNF5 security overrides are active
if [ ! -f "$OVERRIDE_FILE" ] || ! grep -q '^gpgcheck=1$' "$OVERRIDE_FILE"; then
  echo "ERROR: Missing or invalid gpgcheck=1 override in $OVERRIDE_FILE" >&2
  exit 1
fi

# Verify whether an official signed Fedora 45 riscv64 repository exists
SIGNED_REPO_URLS=(
  "https://dl.fedoraproject.org/pub/fedora-secondary/releases/45/Everything/riscv64/os/repodata/repomd.xml"
  "https://dl.fedoraproject.org/pub/alt/risc-v/release/45/Everything/riscv64/os/repodata/repomd.xml"
)

SIGNED_REPO_FOUND=0
for url in "${SIGNED_REPO_URLS[@]}"; do
  code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 15 "$url" || echo "000")
  if [ "$code" = "200" ]; then
    asc_code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 15 "${url}.asc" || echo "000")
    if [ "$asc_code" = "200" ]; then
      SIGNED_REPO_FOUND=1
      echo "Found signed Fedora 45 riscv64 repository: $url"
      break
    fi
  fi
done

if [ "$SIGNED_REPO_FOUND" -eq 0 ]; then
  echo "BLOCKED: No GPG-signed Fedora 45 riscv64 repository is available upstream." >&2
  echo "Attempting dnf5 install with gpgcheck=1 enforced (fail-closed verification)..." >&2
fi

DNF_OPTS=(
  --installroot="$R"
  --forcearch=riscv64
  --releasever=45
  --setopt=reposdir="$R/usr/share/dnf5/repos.d"
  --setopt=gpgcheck=1
  --setopt=sslverify=1
  --setopt=skip_if_unavailable=0
  --setopt=install_weak_deps=False
  --setopt=minrate=100
  --setopt=timeout=60
  --setopt=retries=3
  -y
)

# Never pass --nogpgcheck; dnf5 must fail closed on unsigned RPMs
if ! dnf5 "${DNF_OPTS[@]}" install "$BROWSER_PKG"; then
  echo "REFUSED: dnf5 failed closed with gpgcheck=1 (unsigned RPMs or unavailable signed repository for $BROWSER_PKG)." >&2
  exit 1
fi

# Double-check installed browser RPM has a valid OpenPGP signature in RPM DB
SIG_CHECK=$(rpm --root "$R" -q --qf '%{NAME}-%{VERSION}-%{RELEASE}.%{ARCH} %{RSAHEADER:pgpsig} %{SIGPGP:pgpsig}\n' "$BROWSER_PKG")
echo "Installed signature check: $SIG_CHECK"
if echo "$SIG_CHECK" | grep -q '(none) (none)'; then
  echo "ERROR: Unsigned RPM detected for $BROWSER_PKG; removing immediately." >&2
  rpm --root "$R" -e --nodeps "$BROWSER_PKG" || true
  exit 1
fi

echo "SUCCESS: $BROWSER_PKG installed with valid Fedora 45 GPG signature."
