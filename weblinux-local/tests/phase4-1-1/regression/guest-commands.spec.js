/**
 * WebLinux Phase 4.1.1 - Guest Command Execution API Regression Spec
 * Distinct from GUI testing. Validates low-level kernel, Debian 13 userspace,
 * memory, filesystem, and coreutils via WasmLinuxAdapter.
 */

const { assertExitCode, assertContains, assertExact } = require('../helpers/assertions');

async function runGuestCommandRegression(page, recorder) {
  console.log('\n--- EXECUTING GUEST API COMMAND REGRESSION ---');

  const testCommands = [
    {
      id: 'API-CMD-01',
      title: 'Kernel & Architecture Identification (uname -a)',
      cmd: 'uname -a',
      check: (res) => {
        const out = res.stdout || res.out || '';
        return res.exitCode === 0 && out.includes('riscv64') && out.includes('Linux');
      },
      expected: 'Linux ... riscv64'
    },
    {
      id: 'API-CMD-02',
      title: 'Debian Distribution Release Details (cat /etc/os-release)',
      cmd: 'cat /etc/os-release',
      check: (res) => {
        const out = res.stdout || res.out || '';
        return res.exitCode === 0 && out.includes('Debian GNU/Linux 13 (trixie)');
      },
      expected: 'Debian GNU/Linux 13 (trixie)'
    },
    {
      id: 'API-CMD-03',
      title: 'Current User Identity (whoami & id)',
      cmd: 'whoami && id',
      check: (res) => {
        const out = res.stdout || res.out || '';
        return res.exitCode === 0 && out.includes('root') && out.includes('uid=0(root)');
      },
      expected: 'root, uid=0(root)'
    },
    {
      id: 'API-CMD-04',
      title: 'Guest RAM & Memory Allocation (free -m)',
      cmd: 'free -m',
      check: (res) => {
        const out = res.stdout || res.out || '';
        // Bounded to 2048 MiB guest RAM
        const hasTotal = /Mem:\s+([12]\d{3})/.test(out);
        return res.exitCode === 0 && hasTotal;
      },
      expected: 'Mem: ~2009 MiB total'
    },
    {
      id: 'API-CMD-05',
      title: 'Filesystem Mounts & Partitions (df -h)',
      cmd: 'df -h',
      check: (res) => {
        const out = res.stdout || res.out || '';
        return res.exitCode === 0 && out.includes('/dev/wda') && out.includes('/dev/wdb');
      },
      expected: '/dev/wda (rootfs) and /dev/wdb (persistent home)'
    },
    {
      id: 'API-CMD-06',
      title: 'Guest Process Table & Daemons (ps w)',
      cmd: 'ps w',
      check: (res) => {
        const out = res.stdout || res.out || '';
        // Busybox or Debian ps
        return res.exitCode === 0 && (out.includes('plasmashell') || out.includes('wlserver') || out.includes('init') || out.includes('sh'));
      },
      expected: 'Active process list containing desktop or system daemons'
    },
    {
      id: 'API-CMD-07',
      title: 'Debian Userspace Directory Tree (ls -la /usr)',
      cmd: 'ls -la /usr',
      check: (res) => {
        const out = res.stdout || res.out || '';
        return res.exitCode === 0 && out.includes('bin') && out.includes('lib');
      },
      expected: 'bin, lib directory entries'
    },
    {
      id: 'API-CMD-08',
      title: 'Filesystem CRUD: Directory creation & File write',
      cmd: 'mkdir -p /root/api-test-dir && echo "api-test-payload" > /root/api-test-dir/data.txt && cat /root/api-test-dir/data.txt',
      check: (res) => {
        const out = res.stdout || res.out || '';
        return res.exitCode === 0 && out.includes('api-test-payload');
      },
      expected: 'api-test-payload written and verified'
    },
    {
      id: 'API-CMD-09',
      title: 'Filesystem CRUD: Copy, Move, and Cleanup',
      cmd: 'cp /root/api-test-dir/data.txt /root/api-test-dir/moved.txt && rm -f /root/api-test-dir/data.txt && [ -f /root/api-test-dir/moved.txt ] && [ ! -f /root/api-test-dir/data.txt ] && echo "CRUD_SUCCESS"',
      check: (res) => {
        const out = res.stdout || res.out || '';
        return res.exitCode === 0 && out.includes('CRUD_SUCCESS');
      },
      expected: 'moved.txt present and data.txt removed'
    }
  ];

  for (const tc of testCommands) {
    const t0 = performance.now();
    try {
      const res = await page.evaluate(async (command) => {
        return await window.weblinuxAdapter.runCommand(`chroot /debian /bin/sh -c "${command}"`, 8000);
      }, tc.cmd);

      const elapsed = Math.round(performance.now() - t0);
      const passed = tc.check(res);
      const outSummary = (res.stdout || res.out || '').trim().replace(/\s+/g, ' ').slice(0, 100);

      recorder.record(
        tc.id,
        tc.title,
        'regression',
        passed,
        passed ? `Expected "${tc.expected}". Output: "${outSummary}"` : `Failed check for "${tc.expected}". Code: ${res.exitCode}, Output: "${outSummary}"`,
        [],
        elapsed
      );
    } catch (err) {
      const elapsed = Math.round(performance.now() - t0);
      recorder.record(
        tc.id,
        tc.title,
        'regression',
        false,
        `Execution exception: ${err.message}`,
        [],
        elapsed
      );
    }
  }
}

module.exports = { runGuestCommandRegression };
