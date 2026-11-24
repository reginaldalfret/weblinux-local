const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('[TEST SUITE 6] Ubuntu Boot Pipeline & Init Mounting Verification');

// Inspect staged init script
const initPath = path.resolve('E:/Web-Linux/.phase6-build/initramfs-staging/init');
assert(fs.existsSync(initPath), 'Staged init script must exist');
const initContent = fs.readFileSync(initPath, 'utf8');

// 1. Verify distro argument extraction
assert(initContent.includes('distro=*) distro="${arg#distro=}"'), 'Init must parse distro command line argument');

// 2. Verify /ubuntu mount point
assert(initContent.includes('[ "$distro" = "ubuntu" ]'), 'Init must branch on distro=ubuntu');
assert(initContent.includes('mkdir -p /ubuntu'), 'Init must create /ubuntu mount point');
assert(initContent.includes('mount -t ext4 -o noatime /dev/wda /ubuntu'), 'Init must mount /dev/wda to /ubuntu');

// 3. Verify persistent home isolation
assert(initContent.includes('[ "$distro" = "ubuntu" ] && target_root="/ubuntu/root"'), 'Init must set target_root to /ubuntu/root for ubuntu');

// 4. Verify CLI autostart
assert(initContent.includes('Ubuntu 24.04.5 LTS (Noble Numbat) RISC-V 64-bit CLI ready'), 'Init must announce Ubuntu CLI readiness');
assert(initContent.includes('/bin/ubuntu true'), 'Init must pre-initialize Ubuntu mount hierarchy');

console.log('  ✓ Command line argument parsing verified.');
console.log('  ✓ Rootfs mounting logic at /ubuntu verified.');
console.log('  ✓ Persistent home namespace isolation verified.');
console.log('  ✓ Session supervisor pre-initialization verified.');
