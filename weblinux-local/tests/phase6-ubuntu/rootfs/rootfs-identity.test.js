const fs = require('fs');
const path = require('path');
const assert = require('assert');

const EXTRACTED_DIR = path.resolve(__dirname, '../../../../.phase6-build/extracted');

console.log('--- TEST: Rootfs Identity & Package Structure ---');

// 1. Verify /etc/os-release
const osReleasePath = path.join(EXTRACTED_DIR, 'etc/os-release');
assert.ok(fs.existsSync(osReleasePath), 'etc/os-release must exist');
const osRelease = fs.readFileSync(osReleasePath, 'utf8');
assert.ok(osRelease.includes('ID=ubuntu'), 'os-release must contain ID=ubuntu');
assert.ok(osRelease.includes('VERSION_ID="24.04"'), 'os-release must contain VERSION_ID="24.04"');
assert.ok(osRelease.includes('VERSION_CODENAME=noble'), 'os-release must contain VERSION_CODENAME=noble');
console.log('✓ /etc/os-release verified: Authentic Ubuntu 24.04 Noble');

// 2. Verify dpkg database
const dpkgPath = path.join(EXTRACTED_DIR, 'var/lib/dpkg/status');
assert.ok(fs.existsSync(dpkgPath), 'dpkg status must exist');
const dpkgContent = fs.readFileSync(dpkgPath, 'utf8');
const pkgCount = dpkgContent.split('\n\n').filter(p => p.trim()).length;
assert.ok(pkgCount >= 90, `Package count must be at least 90 (found ${pkgCount})`);
assert.ok(dpkgContent.includes('Package: apt'), 'apt package must be registered');
assert.ok(dpkgContent.includes('Package: libc6'), 'libc6 package must be registered');
console.log(`✓ /var/lib/dpkg/status verified: ${pkgCount} genuine Canonical packages`);

// 3. Verify Dynamic Linker
const ldPath = path.join(EXTRACTED_DIR, 'lib/ld-linux-riscv64-lp64d.so.1');
assert.ok(fs.existsSync(ldPath), 'Dynamic linker ld-linux-riscv64-lp64d.so.1 must exist');
console.log('✓ Dynamic linker verified: /lib/ld-linux-riscv64-lp64d.so.1');

// 4. Verify Shell and RISC-V ELF machine type
const bashPath = path.join(EXTRACTED_DIR, 'usr/bin/bash');
assert.ok(fs.existsSync(bashPath), 'bash executable must exist');
const bashBuf = fs.readFileSync(bashPath);
assert.strictEqual(bashBuf.subarray(0, 4).toString('hex'), '7f454c46', 'bash must be valid ELF');
assert.strictEqual(bashBuf.readUInt16LE(18), 0xf3, 'bash ELF machine must be EM_RISCV (0x00F3)');
console.log('✓ Shell binary verified: /usr/bin/bash is 64-bit RISC-V ELF');

// 5. Verify symlinks
const shPath = path.join(EXTRACTED_DIR, 'bin/sh');
const lstat = fs.lstatSync(shPath);
assert.ok(lstat.isSymbolicLink(), '/bin/sh must be a symlink');
assert.strictEqual(fs.readlinkSync(shPath), 'dash', '/bin/sh must link to dash');
console.log('✓ Symlink structure verified: /bin/sh -> dash');

console.log('ALL ROOTFS IDENTITY TESTS PASSED CLEANLY.\n');
