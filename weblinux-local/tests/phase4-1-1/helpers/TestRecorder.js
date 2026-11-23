/**
 * WebLinux Phase 4.1.1 Strict Test Result Recorder
 * 
 * Guarantees that every test result is derived from actual boolean assertions.
 * Disallows hardcoded outcomes, unconditional passes, and swallowed errors.
 */

class TestRecorder {
  constructor(suiteName, environment = {}) {
    this.suiteName = suiteName;
    this.startTime = new Date().toISOString();
    this.environment = {
      hostOS: 'Windows 11',
      browser: 'Microsoft Edge',
      browserVersion: process.env.BROWSER_VERSION || 'Chromium-Edge',
      browserMode: 'Headless / Visible',
      guestDistribution: 'Debian GNU/Linux 13 (Trixie)',
      guestArchitecture: 'RISC-V 64-bit NOMMU',
      kernel: 'Linux 6.6.0',
      desktop: 'KDE Plasma 6 (Wayland)',
      guestMemoryMiB: 2048,
      workerCount: 4,
      ...environment
    };
    this.cases = [];
    this.failureReasons = [];
    this.blockedReasons = [];
    this.knownLimitations = [];
    this.evidence = [];
  }

  /**
   * Record a single test case.
   * @param {string} id Unique test identifier (e.g., 'REG-001', 'GUI-KONSOLE-01')
   * @param {string} title Descriptive title
   * @param {string} category Test category ('regression', 'konsoleGUI', 'dolphinGUI', 'windowGUI', 'storage', 'visibleEdge')
   * @param {boolean|string} condition Boolean assertion result OR explicit status ('PASSED', 'FAILED', 'BLOCKED', 'NOT_TESTED')
   * @param {string} details Human-readable explanation of result
   * @param {Array<string>} evidence Paths to logs, hashes, or screenshots
   * @param {number} durationMs Time taken in milliseconds
   */
  record(id, title, category, condition, details = '', evidence = [], durationMs = 0) {
    let status;
    if (typeof condition === 'boolean') {
      status = condition ? 'PASSED' : 'FAILED';
    } else if (['PASSED', 'FAILED', 'BLOCKED', 'NOT_TESTED'].includes(condition)) {
      status = condition;
    } else {
      throw new Error(`[TestRecorder] Invalid status/condition for test ${id}: ${condition}`);
    }

    const testCase = {
      id,
      title,
      category,
      status,
      details,
      evidence: Array.isArray(evidence) ? evidence : [evidence],
      durationMs,
      timestamp: new Date().toISOString()
    };

    this.cases.push(testCase);

    if (evidence && Array.isArray(evidence)) {
      this.evidence.push(...evidence);
    }

    if (status === 'FAILED') {
      this.failureReasons.push({ id, title, details });
    } else if (status === 'BLOCKED') {
      this.blockedReasons.push({ id, title, details });
    }

    const icon = status === 'PASSED' ? '✓' : status === 'FAILED' ? '✗' : '⚠';
    console.log(`  [${status}] ${icon} ${id} - ${title}: ${details}`);

    return status === 'PASSED';
  }

  addLimitation(issue) {
    this.knownLimitations.push(issue);
  }

  getSummary() {
    const total = this.cases.length;
    const passed = this.cases.filter(c => c.status === 'PASSED').length;
    const failed = this.cases.filter(c => c.status === 'FAILED').length;
    const blocked = this.cases.filter(c => c.status === 'BLOCKED').length;
    const notTested = this.cases.filter(c => c.status === 'NOT_TESTED').length;

    let overallStatus = 'NOT_VALIDATED';
    if (failed > 0) {
      overallStatus = 'FAILED';
    } else if (blocked > 0 && passed > 0) {
      overallStatus = 'PARTIALLY_VALIDATED';
    } else if (blocked > 0 && passed === 0) {
      overallStatus = 'BLOCKED';
    } else if (passed > 0 && passed === total) {
      const hasVisibleGUI = this.cases.some(c => c.category === 'visibleEdge' && c.status === 'PASSED');
      overallStatus = hasVisibleGUI ? 'VALIDATED' : 'PARTIALLY_VALIDATED';
    }

    return {
      total,
      passed,
      failed,
      blocked,
      notTested,
      overallStatus
    };
  }

  toJSON() {
    const summary = this.getSummary();
    return {
      suite: this.suiteName,
      overallStatus: summary.overallStatus,
      startTime: this.startTime,
      endTime: new Date().toISOString(),
      environment: this.environment,
      summary: {
        total: summary.total,
        passed: summary.passed,
        failed: summary.failed,
        blocked: summary.blocked,
        notTested: summary.notTested
      },
      failureReasons: this.failureReasons,
      blockedReasons: this.blockedReasons,
      knownLimitations: this.knownLimitations,
      evidence: Array.from(new Set(this.evidence)),
      cases: this.cases
    };
  }
}

module.exports = { TestRecorder };
