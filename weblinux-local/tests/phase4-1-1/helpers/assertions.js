/**
 * WebLinux Phase 4.1.1 Assertion Utilities
 * Deterministic validation functions returning boolean pass flags and detailed messages.
 */

const crypto = require('crypto');

function assertExitCode(cmdResult, expectedCode = 0, context = '') {
  const actualCode = cmdResult ? (cmdResult.exitCode ?? cmdResult.rc) : -1;
  const passed = actualCode === expectedCode;
  const details = passed
    ? `Command ${context} exited with expected code ${expectedCode}`
    : `Command ${context} failed: expected exit code ${expectedCode}, got ${actualCode}. Output: ${(cmdResult.stdout || cmdResult.out || '').slice(0, 120)}`;
  return { passed, details };
}

function assertContains(actual, expectedSubstr, context = '') {
  const actualStr = String(actual || '');
  const passed = actualStr.includes(expectedSubstr);
  const details = passed
    ? `${context} contains expected text "${expectedSubstr}"`
    : `${context} missing expected text "${expectedSubstr}". Received: "${actualStr.slice(0, 150)}"`;
  return { passed, details };
}

function assertExact(actual, expected, context = '') {
  const passed = actual === expected;
  const details = passed
    ? `${context} matches exact value: "${expected}"`
    : `${context} mismatch: expected "${expected}", got "${actual}"`;
  return { passed, details };
}

function assertSha256(content, expectedHash, context = '') {
  const actualHash = crypto.createHash('sha256').update(content).digest('hex');
  const passed = actualHash === expectedHash;
  const details = passed
    ? `${context} SHA-256 hash verified: ${expectedHash}`
    : `${context} SHA-256 mismatch! Expected ${expectedHash}, computed ${actualHash}`;
  return { passed, details, actualHash };
}

function assertGeometryChanged(before, after, op = 'MOVE') {
  if (!before || !after) {
    return { passed: false, details: `Window geometry missing for operation ${op}` };
  }
  let passed = false;
  let details = '';

  if (op === 'MOVE') {
    const moved = before.x !== after.x || before.y !== after.y;
    passed = moved;
    details = moved
      ? `Window moved from (${before.x}, ${before.y}) to (${after.x}, ${after.y})`
      : `Window position unchanged at (${before.x}, ${before.y})`;
  } else if (op === 'RESIZE') {
    const resized = before.w !== after.w || before.h !== after.h;
    passed = resized;
    details = resized
      ? `Window dimensions resized from ${before.w}x${before.h} to ${after.w}x${after.h}`
      : `Window dimensions unchanged at ${before.w}x${before.h}`;
  } else if (op === 'MAXIMIZE') {
    const expanded = after.w >= before.w && after.h >= before.h;
    passed = expanded;
    details = expanded
      ? `Window maximized from ${before.w}x${before.h} to ${after.w}x${after.h}`
      : `Window failed to maximize: before ${before.w}x${before.h}, after ${after.w}x${after.h}`;
  } else if (op === 'MINIMIZE') {
    passed = !!after.minimized;
    details = passed ? 'Window minimized successfully' : 'Window minimized flag not set';
  } else if (op === 'RESTORE') {
    passed = !after.minimized;
    details = passed ? 'Window restored from minimized state' : 'Window remains minimized';
  }

  return { passed, details };
}

module.exports = {
  assertExitCode,
  assertContains,
  assertExact,
  assertSha256,
  assertGeometryChanged
};
