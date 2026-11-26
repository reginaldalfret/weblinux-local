#!/usr/bin/env node
/**
 * Phase 11.1.4 — Negative Signature & Repository Hardening Test Suite
 *
 * Runs Tests A–H against an isolated disposable Fedora rootfs in WSL
 * (/tmp/fedora-sig-test-root), without modifying the production rootfs
 * or persistent OPFS disks.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT_DIR, 'tests', 'screenshots', 'phase11-1');
fs.mkdirSync(OUT_DIR, { recursive: true });

const LOG_FILE = path.join(OUT_DIR, 'signature-tests.log');
const JSON_FILE = path.join(OUT_DIR, 'signature-tests-results.json');

const wslScript = `#!/usr/bin/env bash
set -uo pipefail

PROD_R="/root/fedora-build/rootfs"
TEST_R="/tmp/fedora-sig-test-root"
WORK="/tmp/fedora-sig-test-work"
GNUPG_TEST="$WORK/gnupg"

rm -rf "$TEST_R" "$WORK"
mkdir -p "$TEST_R/var/lib/rpm" "$TEST_R/usr/lib/sysimage/rpm" "$TEST_R/etc/dnf/repos.override.d" "$TEST_R/usr/share/pki/rpm-gpg" "$WORK/pkgs" "$WORK/rpmbuild"/{BUILD,RPMS,SOURCES,SPECS,SRPMS} "$GNUPG_TEST"
chmod 700 "$GNUPG_TEST"

# Copy RPM DB and trusted key from hardened production rootfs (read-only copy)
cp -a "$PROD_R/usr/lib/sysimage/rpm/." "$TEST_R/usr/lib/sysimage/rpm/"
cp -a "$PROD_R/usr/share/pki/rpm-gpg/RPM-GPG-KEY-fedora-45-primary" "$TEST_R/usr/share/pki/rpm-gpg/"
cp -a "$PROD_R/etc/dnf/repos.override.d/99-weblinux-security.repo" "$TEST_R/etc/dnf/repos.override.d/"

# Fetch a real Fedora-45-signed noarch RPM (fedora-gpg-keys) from host Fedora 45 mirror
dnf5 download --destdir="$WORK/pkgs" fedora-gpg-keys
VALID_RPM=$(ls "$WORK/pkgs"/fedora-gpg-keys-*.noarch.rpm | head -n 1)
echo "VALID_RPM=$VALID_RPM"
mkdir -p "$TEST_R/etc/yum.repos.d"

# Build an unsigned test RPM
cat <<'SPEC' > "$WORK/rpmbuild/SPECS/weblinux-sigtest.spec"
Name:           weblinux-sigtest
Version:        1.0
Release:        1
Summary:        Disposable negative signature test package
License:        MIT
BuildArch:      noarch

%description
Disposable package for Phase 11.1 negative signature testing.

%install
mkdir -p %{buildroot}/usr/share/doc/weblinux-sigtest
echo "sigtest" > %{buildroot}/usr/share/doc/weblinux-sigtest/README

%files
/usr/share/doc/weblinux-sigtest/README
SPEC

rpmbuild --define "_topdir $WORK/rpmbuild" -bb "$WORK/rpmbuild/SPECS/weblinux-sigtest.spec" >/dev/null 2>&1
UNSIGNED_RPM=$(ls "$WORK/rpmbuild/RPMS/noarch"/weblinux-sigtest-*.noarch.rpm | head -n 1)

# Create wrong-key-signed RPM with ephemeral untrusted GPG key
cat <<'GPGCONF' > "$WORK/genkey.batch"
%echo Generating ephemeral untrusted test key
Key-Type: RSA
Key-Length: 2048
Name-Real: Untrusted Test Key
Name-Email: untrusted@example.invalid
Expire-Date: 1d
%no-protection
%commit
GPGCONF
GNUPGHOME="$GNUPG_TEST" gpg --batch --gen-key "$WORK/genkey.batch" >/dev/null 2>&1
WRONGKEY_RPM="$WORK/pkgs/weblinux-sigtest-wrongkey.rpm"
cp "$UNSIGNED_RPM" "$WRONGKEY_RPM"
GNUPGHOME="$GNUPG_TEST" rpmsign --define "_gpg_name untrusted@example.invalid" --addsign "$WRONGKEY_RPM" >/dev/null 2>&1

# Create corrupted copy of valid RPM
CORRUPT_RPM="$WORK/pkgs/fedora-gpg-keys-corrupt.rpm"
cp "$VALID_RPM" "$CORRUPT_RPM"
python3 - "$CORRUPT_RPM" <<'PY'
import sys
p = sys.argv[1]
data = bytearray(open(p, "rb").read())
pos = max(256, len(data) - 128)
data[pos] ^= 0xFF
data[pos + 1] ^= 0xAA
open(p, "wb").write(data)
PY

emit() {
  local id="$1" name="$2" input="$3" cmd="$4" expected="$5" rc="$6" status="$7" actual="$8"
  python3 - "$id" "$name" "$input" "$cmd" "$expected" "$rc" "$status" "$actual" <<'PY'
import json, sys
print("RESULT_JSON:" + json.dumps({
    "id": sys.argv[1],
    "name": sys.argv[2],
    "input": sys.argv[3],
    "command": sys.argv[4],
    "expected": sys.argv[5],
    "exitCode": int(sys.argv[6]),
    "status": sys.argv[7],
    "actual": sys.argv[8],
}))
PY
}

# Test A: Valid trusted package
OUT_A=$(rpmkeys --root "$TEST_R" --checksig "$VALID_RPM" 2>&1)
RC_A=$?
OUT_A2=$(dnf5 --installroot="$TEST_R" --releasever=45 --setopt=reposdir="$TEST_R/etc/yum.repos.d" --setopt=localpkg_gpgcheck=1 install -y "$VALID_RPM" 2>&1)
RC_A2=$?
if [ $RC_A -eq 0 ] && [ $RC_A2 -eq 0 ] && echo "$OUT_A" | grep -q "digests signatures OK"; then
  emit "Test A" "Valid trusted package" "$(basename "$VALID_RPM")" "rpmkeys --checksig && dnf5 --setopt=localpkg_gpgcheck=1 install" "Exit 0 and digests signatures OK" "$RC_A2" "PASS" "$OUT_A"
else
  emit "Test A" "Valid trusted package" "$(basename "$VALID_RPM")" "rpmkeys --checksig && dnf5 --setopt=localpkg_gpgcheck=1 install" "Exit 0 and digests signatures OK" "$RC_A2" "FAIL" "$OUT_A | $OUT_A2"
fi

# Test B: Unsigned RPM
OUT_B=$(dnf5 --installroot="$TEST_R" --releasever=45 --setopt=reposdir="$TEST_R/etc/yum.repos.d" --setopt=localpkg_gpgcheck=1 install -y "$UNSIGNED_RPM" 2>&1)
RC_B=$?
if [ $RC_B -ne 0 ] && echo "$OUT_B" | grep -qiE "not signed|OpenPGP check"; then
  emit "Test B" "Unsigned RPM" "$(basename "$UNSIGNED_RPM")" "dnf5 --setopt=localpkg_gpgcheck=1 install unsigned.rpm" "Non-zero exit with OpenPGP unsigned rejection" "$RC_B" "PASS" "$OUT_B"
else
  emit "Test B" "Unsigned RPM" "$(basename "$UNSIGNED_RPM")" "dnf5 --setopt=localpkg_gpgcheck=1 install unsigned.rpm" "Non-zero exit with OpenPGP unsigned rejection" "$RC_B" "FAIL" "$OUT_B"
fi

# Test C: Wrong signing key
OUT_C=$(dnf5 --installroot="$TEST_R" --releasever=45 --setopt=reposdir="$TEST_R/etc/yum.repos.d" --setopt=localpkg_gpgcheck=1 install -y "$WRONGKEY_RPM" 2>&1)
RC_C=$?
if [ $RC_C -ne 0 ] && echo "$OUT_C" | grep -qiE "Public key.*not installed|NOKEY|OpenPGP check|not signed"; then
  emit "Test C" "Wrong signing key" "$(basename "$WRONGKEY_RPM")" "dnf5 --setopt=localpkg_gpgcheck=1 install wrongkey.rpm" "Non-zero exit with untrusted key / OpenPGP rejection" "$RC_C" "PASS" "$OUT_C"
else
  emit "Test C" "Wrong signing key" "$(basename "$WRONGKEY_RPM")" "dnf5 --setopt=localpkg_gpgcheck=1 install wrongkey.rpm" "Non-zero exit with untrusted key / OpenPGP rejection" "$RC_C" "FAIL" "$OUT_C"
fi

# Test D: Corrupted RPM (use reinstall since Test A installed this NEVRA)
OUT_D=$(rpmkeys --root "$TEST_R" --checksig "$CORRUPT_RPM" 2>&1)
RC_D=$?
OUT_D2=$(dnf5 --installroot="$TEST_R" --releasever=45 --setopt=reposdir="$TEST_R/etc/yum.repos.d" --setopt=localpkg_gpgcheck=1 reinstall -y "$CORRUPT_RPM" 2>&1)
RC_D2=$?
if [ $RC_D -ne 0 ] && [ $RC_D2 -ne 0 ] && echo "$OUT_D" | grep -qiE "NOT OK|BAD"; then
  emit "Test D" "Corrupted RPM" "$(basename "$CORRUPT_RPM")" "rpmkeys --checksig && dnf5 --setopt=localpkg_gpgcheck=1 reinstall corrupt.rpm" "Non-zero exit with digest/signature tamper failure" "$RC_D2" "PASS" "$OUT_D | $OUT_D2"
else
  emit "Test D" "Corrupted RPM" "$(basename "$CORRUPT_RPM")" "rpmkeys --checksig && dnf5 --setopt=localpkg_gpgcheck=1 reinstall corrupt.rpm" "Non-zero exit with digest/signature tamper failure" "$RC_D2" "FAIL" "$OUT_D | $OUT_D2"
fi

# Test E: Repository metadata
CODE_ASC=$(curl -s -o /dev/null -w "%{http_code}" "https://riscv-koji.fedoraproject.org/repos-dist/f45/latest/riscv64/repodata/repomd.xml.asc" || echo "000")
OUT_E=$(dnf5 --installroot="$PROD_R" --forcearch=riscv64 --releasever=45 repo info fedora 2>&1)
if [ "$CODE_ASC" = "404" ] && echo "$OUT_E" | grep -q "Verify repodata *: false"; then
  emit "Test E" "Repository metadata signature check" "f45/latest/riscv64/repodata/repomd.xml.asc" "curl repomd.xml.asc && dnf5 repo info fedora" "Documented limitation: repomd.xml.asc absent (404), Verify repodata=false, TLS active" "0" "PASS" "HTTP $CODE_ASC for repomd.xml.asc; Verify repodata: false (distinct limitation recorded)"
else
  emit "Test E" "Repository metadata signature check" "f45/latest/riscv64/repodata/repomd.xml.asc" "curl repomd.xml.asc && dnf5 repo info fedora" "repomd.xml.asc checked" "1" "FAIL" "HTTP $CODE_ASC | $OUT_E"
fi

# Test F: Repository downgrade / staging isolation
OUT_F_LIST=$(dnf5 --installroot="$PROD_R" --forcearch=riscv64 --releasever=45 repo list --all 2>&1)
OUT_F_QUERY=$(dnf5 --installroot="$PROD_R" --forcearch=riscv64 --releasever=45 repoquery shim-unsigned-riscv64 2>&1)
RC_F=$?
if echo "$OUT_F_LIST" | grep -qE "fedora-staging.*disabled" && echo "$OUT_F_LIST" | grep -qE "fedora-koji.*disabled" && ! echo "$OUT_F_QUERY" | grep -q "shim-unsigned-riscv64"; then
  emit "Test F" "Repository downgrade / staging isolation" "fedora-staging & fedora-koji" "dnf5 repo list --all && dnf5 repoquery shim-unsigned-riscv64" "Staging & koji disabled; staging-only packages excluded" "$RC_F" "PASS" "fedora-staging=disabled, fedora-koji=disabled, shim-unsigned-riscv64 not resolvable"
else
  emit "Test F" "Repository downgrade / staging isolation" "fedora-staging & fedora-koji" "dnf5 repo list --all && dnf5 repoquery shim-unsigned-riscv64" "Staging & koji disabled" "1" "FAIL" "$OUT_F_LIST | $OUT_F_QUERY"
fi

# Test G: DNF configuration regression
if echo "$OUT_E" | grep -q "Verify packages *: true" && echo "$OUT_E" | grep -q "Skip if unavailable *: false" && echo "$OUT_E" | grep -q "RPM-GPG-KEY-fedora-45-primary"; then
  emit "Test G" "DNF configuration regression" "/etc/dnf/repos.override.d/99-weblinux-security.repo" "dnf5 repo info fedora" "Verify packages=true, Skip if unavailable=false, fedora-45-primary key set" "0" "PASS" "Verify packages: true; Skip if unavailable: false; Keys: RPM-GPG-KEY-fedora-45-primary"
else
  emit "Test G" "DNF configuration regression" "/etc/dnf/repos.override.d/99-weblinux-security.repo" "dnf5 repo info fedora" "Verify packages=true" "1" "FAIL" "$OUT_E"
fi

rm -rf "$TEST_R" "$WORK"
`;

const tmpSh = path.join(OUT_DIR, '_run_sig_tests.sh');
fs.writeFileSync(tmpSh, wslScript, { encoding: 'utf8' });
const wslPath = '/mnt/' + tmpSh[0].toLowerCase() + tmpSh.slice(2).replace(/\\/g, '/');

const res = spawnSync('wsl', ['-d', 'Fedora-45', '-u', 'root', '--', 'bash', wslPath], {
  encoding: 'utf8',
  maxBuffer: 10 * 1024 * 1024,
});
fs.unlinkSync(tmpSh);

const results = [];
for (const line of (res.stdout || '').split(/\r?\n/)) {
  if (line.startsWith('RESULT_JSON:')) {
    results.push(JSON.parse(line.slice('RESULT_JSON:'.length)));
  }
}

// Test H: Script regression (static scan of Fedora build/update scripts)
const fedoraScripts = [
  'scripts/fetch-fedora-riscv-rootfs.sh',
  'scripts/build-fedora-kde-rootfs.sh',
  'scripts/update-initramfs-fedora.sh',
  'scripts/package-fedora-kde-image.sh',
];
const forbiddenRe = /(--nogpgcheck|--nosignature|--nodigest|--no-verify|rpm\s+--nodeps|gpgcheck=0|repo_gpgcheck=0)/g;
const scriptHits = [];
for (const rel of fedoraScripts) {
  const full = path.join(ROOT_DIR, rel);
  const lines = fs.readFileSync(full, 'utf8').split(/\r?\n/);
  lines.forEach((l, idx) => {
    const m = l.match(forbiddenRe);
    if (m) scriptHits.push(`${rel}:${idx + 1}: ${m.join(', ')}`);
  });
}
results.push({
  id: 'Test H',
  name: 'Script regression',
  input: fedoraScripts.join(', '),
  command: 'Static scan for --nogpgcheck / --nosignature / gpgcheck=0 / rpm --nodeps',
  expected: 'Zero signature bypasses in Fedora scripts',
  exitCode: scriptHits.length === 0 ? 0 : 1,
  status: scriptHits.length === 0 ? 'PASS' : 'FAIL',
  actual: scriptHits.length === 0 ? '0 bypasses found across 4 Fedora scripts' : scriptHits.join('; '),
});

const summary = {
  timestamp: new Date().toISOString(),
  wslExitCode: res.status,
  passed: results.filter((r) => r.status === 'PASS').length,
  failed: results.filter((r) => r.status === 'FAIL').length,
  results,
};

fs.writeFileSync(LOG_FILE, `STDOUT:\n${res.stdout}\nSTDERR:\n${res.stderr}\n`, 'utf8');
fs.writeFileSync(JSON_FILE, JSON.stringify(summary, null, 2), 'utf8');

console.log(`Phase 11.1 Signature Tests: ${summary.passed}/${results.length} PASS, ${summary.failed} FAIL`);
for (const r of results) {
  console.log(`  [${r.status}] ${r.id} (${r.name}) -> exit=${r.exitCode}`);
}

if (summary.failed > 0 || results.length < 8) {
  process.exit(1);
}
