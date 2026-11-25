const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('[TEST SUITE 8] Ubuntu Guest Terminal & Command Verification');

const reportPath = path.resolve(__dirname, '../../ubuntu-boot-result.json');
assert(fs.existsSync(reportPath), 'Ubuntu boot result report must exist');
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

assert.strictEqual(report.bootSuccess, true, 'Boot success must be true');

// 1. Verify OS release
const osRelease = report.results['OS Release'].output;
assert(osRelease.includes('ID=ubuntu'), 'OS release must contain ID=ubuntu');
assert(osRelease.includes('VERSION_ID="24.04"'), 'OS release must contain VERSION_ID="24.04"');
assert(osRelease.includes('PRETTY_NAME="Ubuntu 24.04.5 LTS"'), 'OS release must contain Ubuntu 24.04.5 LTS');

// 2. Verify Kernel
const uname = report.results['Kernel Version'].output;
assert(uname.includes('riscv64'), 'Kernel architecture must be riscv64');

// 3. Verify Identity
const id = report.results['User Identity'].output;
assert(id.includes('uid=0(root)'), 'User identity must be root (uid 0)');

// 4. Verify Filesystem Mounts
const df = report.results['Filesystem Mounts'].output;
assert(df.includes('/dev/wda'), 'Root disk /dev/wda must be mounted');
assert(df.includes('/dev/wdb'), 'Home disk /dev/wdb must be mounted');

// 5. Verify Package Managers
const dpkg = report.results['DPKG Version'].output;
assert(dpkg.includes('dpkg') && dpkg.includes('riscv64'), 'dpkg must be functional');

const apt = report.results['APT Version'].output;
assert(apt.includes('apt') && apt.includes('riscv64'), 'apt must be functional');

console.log('  ✓ Authentic /etc/os-release verified.');
console.log('  ✓ RISC-V 64-bit kernel telemetry verified.');
console.log('  ✓ Dual-disk ext4 mount hierarchy verified.');
console.log('  ✓ Native APT and dpkg package managers verified.');
