console.log('================================================================');
console.log('  WEBLINUX LOCAL — PHASE 6.2 ACCEPTANCE TEST SUITE');
console.log('  Ubuntu 24.04.5 LTS Noble Rootfs & Chunk Integrity Qualification');
console.log('================================================================\n');

try {
  require('./rootfs/rootfs-identity.test.js');
  require('./chunks/chunks-validation.test.js');
  require('./reconstruction/reconstruction.test.js');
  require('./manifest/manifest-integration.test.js');

  console.log('================================================================');
  console.log('  STATUS: ALL PHASE 6.2 TESTS PASSED WITH 100% SUCCESS');
  console.log('================================================================');
} catch (err) {
  console.error('\n❌ PHASE 6.2 TEST FAILURE:', err.message);
  process.exit(1);
}
