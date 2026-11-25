const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
    args: ['--enable-features=SharedArrayBuffer', '--no-sandbox']
  });
  const page = await browser.newPage();
  await page.goto('http://localhost:3000');
  await page.click('button:has-text("Launch WebLinux")');
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(1000);
    const ready = await page.evaluate(() => window.weblinuxAdapter && window.weblinuxAdapter.status.state === 'running');
    if (ready) break;
  }
  await page.waitForTimeout(3000);

  const binInfo = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand('ls -la /debian/usr/bin/konsole /debian/usr/bin/dolphin /debian/bin/bash /debian/bin/sh 2>&1', 5000);
  });
  console.log('--- BIN INFO ---');
  console.log((binInfo.stdout || binInfo.out || '').trim());

  const binfmt = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand('cat /proc/sys/fs/binfmt_misc/* 2>&1', 5000);
  });
  console.log('--- BINFMT MISC ---');
  console.log((binfmt.stdout || binfmt.out || '').trim());

  const fileHead = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand('head -c 64 /debian/usr/bin/konsole | hexdump -C', 5000);
  });
  console.log('--- KONSOLE HEX ---');
  console.log((fileHead.stdout || fileHead.out || '').trim());

  const runBash = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand('chroot /debian /bin/bash --version 2>&1', 5000);
  });
  console.log('--- BASH TEST ---');
  console.log((runBash.stdout || runBash.out || '').trim());

  await browser.close();
})().catch(console.error);
