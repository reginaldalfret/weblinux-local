console.log('================================================================');
console.log('  WEBLINUX LOCAL — PHASE 6 CONSOLIDATED ACCEPTANCE TEST SUITE');
console.log('  Ubuntu 24.04.5 LTS Noble Rootfs, Boot, Supervisor & Persistence');
console.log('================================================================\n');

try {
  require('./rootfs/rootfs-identity.test.js');
  require('./chunks/chunks-validation.test.js');
  require('./reconstruction/reconstruction.test.js');
  require('./manifest/manifest-integration.test.js');
  require('./runtime/runtime-config.test.js');
  require('./boot/boot-pipeline.test.js');
  require('./supervisor/supervisor-execution.test.js');
  require('./terminal/terminal-commands.test.js');
  require('./storage/storage-isolation.test.js');
  require('./gnome/ubuntu-gnome.test.js');

  console.log('\n================================================================');
  console.log('  STATUS: ALL 10 TEST SUITES PASSED WITH 100% SUCCESS');
  console.log('================================================================');
} catch (err) {
  console.error('\n❌ TEST FAILURE:', err.message);
  process.exit(1);
}
