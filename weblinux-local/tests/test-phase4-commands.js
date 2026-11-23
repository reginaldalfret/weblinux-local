const { chromium } = require('playwright');

(async () => {
  console.log('=== TESTING PHASE 4 DEBIAN GUEST COMMANDS ===');
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-features=SharedArrayBuffer'] });
  const page = await browser.newPage();
  await page.goto('http://localhost:3000');
  await page.click('button:has-text("Launch WebLinux")');
  for (let i = 0; i < 35; i++) {
    await page.waitForTimeout(1000);
    const ready = await page.evaluate(() => window.weblinuxAdapter && window.weblinuxAdapter.status.state === 'running');
    if (ready) break;
  }
  await page.waitForTimeout(4000);

  const execDebian = async (cmd) => {
    // Escape single quotes in cmd
    const escaped = cmd.replace(/'/g, "'\\''");
    const fullCmd = `chroot /debian /bin/sh -c '${escaped}'`;
    const res = await page.evaluate(c => window.weblinuxAdapter.runCommand(c, 15000), fullCmd);
    console.log(`\n$ ${cmd}`);
    console.log(`[Exit Code: ${res.exitCode !== undefined ? res.exitCode : res.rc}]`);
    console.log((res.stdout || res.out || '').trim());
    return res;
  };

  await execDebian('uname -a');
  await execDebian('cat /etc/os-release');
  await execDebian('whoami');
  await execDebian('pwd');
  await execDebian('id');
  await execDebian('free -m');
  await execDebian('df -h');
  await execDebian('ls /');
  
  // File operations test
  console.log('\n--- TESTING FILE OPERATIONS IN DEBIAN HOMEDIR ---');
  await execDebian('mkdir -p /root/WebLinux-Phase4-Test');
  await execDebian('cd /root/WebLinux-Phase4-Test && echo "WebLinux KDE Phase 4" > phase4.txt');
  await execDebian('cat /root/WebLinux-Phase4-Test/phase4.txt');
  await execDebian('cp /root/WebLinux-Phase4-Test/phase4.txt /root/WebLinux-Phase4-Test/phase4-copy.txt');
  await execDebian('mv /root/WebLinux-Phase4-Test/phase4-copy.txt /root/WebLinux-Phase4-Test/renamed-test.txt');
  await execDebian('ls -la /root/WebLinux-Phase4-Test');

  await browser.close();
  console.log('\n=== COMMAND SUITE COMPLETE ===');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
