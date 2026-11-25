const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('[TEST SUITE 9] OPFS Storage Persistence & Two-Way Switching Isolation');

const reportPath = path.resolve(__dirname, '../../switching-audit-report.json');
assert(fs.existsSync(reportPath), 'Switching audit report must exist');
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

// 1. Verify Isolation
assert.strictEqual(report.isolation_passed, true, 'Isolation verification must pass with 100% success');
assert(report.stage2_debian.isolationCheck.includes('No such file'), 'Debian must not see Ubuntu persistent files');
assert(report.stage3_ubuntu_return.debianLeakCheck.includes('No such file'), 'Ubuntu must not see Debian persistent files');

// 2. Verify Persistence
assert.strictEqual(report.persistence_passed, true, 'Persistence verification must pass with 100% success');
assert(report.stage3_ubuntu_return.ubuntuPersistentFile.includes('Ubuntu Session 2 Marker'), 'Ubuntu state must persist across full reboot and switching');

console.log('  ✓ Two-way distribution switching verified.');
console.log('  ✓ Zero cross-contamination across home partitions verified.');
console.log('  ✓ Multi-session OPFS ext4 state persistence verified.');
