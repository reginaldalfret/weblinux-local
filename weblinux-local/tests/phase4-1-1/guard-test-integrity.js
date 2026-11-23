/**
 * WebLinux Phase 4.1.1 Static Test-Integrity Guard
 * Scans test source files to enforce strict assertion honesty and disallow false-positive patterns.
 */

const fs = require('fs');
const path = require('path');
const { TestRecorder } = require('./helpers/TestRecorder');
const { assertExact } = require('./helpers/assertions');

const FORBIDDEN_PATTERNS = [
  {
    regex: /\?\s*['"]PASSED['"]\s*:\s*['"]PASSED['"]/i,
    description: 'Unconditional ternary expression forcing PASSED (e.g. cond ? "PASSED" : "PASSED")'
  },
  {
    regex: /\?\s*true\s*:\s*true\b/i,
    description: 'Tautological ternary returning true unconditionally'
  },
  {
    regex: /summary\s*:\s*\{\s*total\s*:\s*\d+\s*,\s*passed\s*:\s*\d+/i,
    description: 'Hardcoded test summary object (totals must be calculated dynamically)'
  }
];

function scanDirectory(dir, violations = []) {
  if (!fs.existsSync(dir)) return violations;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
        scanDirectory(fullPath, violations);
      }
    } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.ts'))) {
      // Exclude the guard itself and historical obsolete tests
      if (entry.name === 'guard-test-integrity.js') continue;

      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');

      lines.forEach((line, idx) => {
        for (const pattern of FORBIDDEN_PATTERNS) {
          if (pattern.regex.test(line)) {
            violations.push({
              file: path.relative(process.cwd(), fullPath),
              line: idx + 1,
              code: line.trim(),
              issue: pattern.description
            });
          }
        }
      });
    }
  }
  return violations;
}

function verifyTestRecorderIntegrity() {
  console.log('Testing TestRecorder integrity self-checks...');
  const rec = new TestRecorder('Integrity Check Suite');

  rec.record('T-01', 'True condition', 'regression', true, 'True is passed');
  rec.record('T-02', 'False condition', 'regression', false, 'False is failed');
  rec.record('T-03', 'Blocked condition', 'regression', 'BLOCKED', 'Resource blocked');
  rec.record('T-04', 'Not tested condition', 'regression', 'NOT_TESTED', 'Skipped test');

  const summary = rec.getSummary();
  if (summary.total !== 4) throw new Error(`Summary total mismatch: expected 4, got ${summary.total}`);
  if (summary.passed !== 1) throw new Error(`Passed count mismatch: expected 1, got ${summary.passed}`);
  if (summary.failed !== 1) throw new Error(`Failed count mismatch: expected 1, got ${summary.failed}`);
  if (summary.blocked !== 1) throw new Error(`Blocked count mismatch: expected 1, got ${summary.blocked}`);
  if (summary.notTested !== 1) throw new Error(`NotTested count mismatch: expected 1, got ${summary.notTested}`);
  if (summary.overallStatus !== 'FAILED') throw new Error(`Overall status must be FAILED when failures exist`);

  console.log('  ✓ TestRecorder self-check passed: Dynamic calculation and strict status mapping verified.\n');
}

function run() {
  console.log('================================================================');
  console.log('🛡️ RUNNING STATIC TEST-INTEGRITY GUARD');
  console.log('================================================================\n');

  // 1. Verify recorder
  verifyTestRecorderIntegrity();

  // 2. Scan Phase 4.1.1 test files
  const targetDir = path.resolve(__dirname);
  console.log(`Scanning test files in: ${targetDir}`);
  const violations = scanDirectory(targetDir);

  if (violations.length > 0) {
    console.error(`\n❌ TEST INTEGRITY GUARD FAILED: Found ${violations.length} forbidden false-positive patterns:`);
    violations.forEach(v => {
      console.error(`  - ${v.file}:${v.line} -> ${v.issue}`);
      console.error(`    Line: ${v.code}`);
    });
    process.exit(1);
  }

  console.log('✓ Zero forbidden false-positive patterns found in test suite.');
  console.log('================================================================');
  console.log('🛡️ STATIC TEST-INTEGRITY GUARD PASSED (100% CLEAN)');
  console.log('================================================================\n');
}

if (require.main === module) {
  run();
}

module.exports = { run, scanDirectory };
