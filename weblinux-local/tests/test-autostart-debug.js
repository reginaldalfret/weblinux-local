const puppeteer = require('puppeteer-core');

async function testAutostart() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: null
  });

  const pages = await browser.pages();
  const page = pages.find(p => p.url().includes('localhost:3000'));
  if (!page) {
    console.log('No localhost:3000 page');
    browser.disconnect();
    return;
  }

  // Click Launch WebLinux
  console.log('Clicking Launch WebLinux...');
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Launch WebLinux'));
    if (btn) btn.click();
  });

  // Wait for shell ready
  console.log('Waiting for shell...');
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const status = await page.evaluate(() => window.weblinuxAdapter ? window.weblinuxAdapter.getStatus() : null);
    if (status && status.shellReady) {
      console.log('Shell ready!');
      break;
    }
  }

  // Check /etc/rvwasm
  console.log('Checking /debian/etc/rvwasm...');
  const res1 = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand('ls -la /debian/etc/rvwasm; cat /debian/etc/rvwasm/autostart', 15000);
  });
  console.log('rvwasm output:\n', res1.out);

  // Check /root/autostart.log and ps
  const res2 = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand('ls -la /debian/root; ps aux || ps', 15000);
  });
  console.log('root and ps output:\n', res2.out);

  // Check Wayland wlserver log
  const res3 = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand('cat /debian/root/wlserver.log || cat /root/wlserver.log', 15000);
  });
  console.log('wlserver log:\n', res3.out);

  // Check start desktop manually if needed
  const res4 = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand('which desktop; /bin/debian desktop wayland plasma-native &', 15000);
  });
  console.log('desktop command:\n', res4.out);

  await new Promise(r => setTimeout(r, 3000));

  // Take screenshot
  const shotPath = 'e:\\Web-Linux\\weblinux-local\\tests\\screenshots\\local-launch\\diagnose-desktop.png';
  await page.screenshot({ path: shotPath });
  console.log('Screenshot saved to:', shotPath);

  browser.disconnect();
}

testAutostart().catch(console.error);
