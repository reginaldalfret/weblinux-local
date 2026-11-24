const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('[TEST SUITE 7] Ubuntu Session Supervisor (/bin/ubuntu) Specification');

const supervisorPath = path.resolve('E:/Web-Linux/.phase6-build/initramfs-staging/bin/ubuntu');
assert(fs.existsSync(supervisorPath), 'Supervisor script /bin/ubuntu must exist');
const supervisorContent = fs.readFileSync(supervisorPath, 'utf8');

// 1. Rootfs validation
assert(supervisorContent.includes('D=/ubuntu'), 'Supervisor must target /ubuntu');
assert(supervisorContent.includes('[ ! -x $D/usr/bin/bash ]'), 'Supervisor must verify bash binary executable');

// 2. Mount hierarchy
assert(supervisorContent.includes('mount -t proc none $D/proc'), 'Supervisor must mount proc');
assert(supervisorContent.includes('mount -t sysfs none $D/sys'), 'Supervisor must mount sysfs');
assert(supervisorContent.includes('mount -t tmpfs none $D/dev'), 'Supervisor must mount dev tmpfs');
assert(supervisorContent.includes('mount -t devpts none $D/dev/pts'), 'Supervisor must mount devpts');

// 3. Environment configuration
assert(supervisorContent.includes('HOME=/root'), 'Supervisor must set HOME=/root');
assert(supervisorContent.includes('SHELL=/bin/bash'), 'Supervisor must set SHELL=/bin/bash');
assert(supervisorContent.includes('LANG=C.UTF-8'), 'Supervisor must set UTF-8 locale');

// 4. Chroot execution
assert(supervisorContent.includes('exec chroot $D /usr/bin/env -i $ENV /bin/bash'), 'Supervisor must exec chroot with environment');

console.log('  ✓ Rootfs validation guard verified.');
console.log('  ✓ Device nodes & pseudo-filesystems verified.');
console.log('  ✓ Clean shell execution environment verified.');
console.log('  ✓ Chroot execution pipeline verified.');
