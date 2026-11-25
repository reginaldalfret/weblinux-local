const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PROFILE_DIR = path.resolve(__dirname, `.edge-full-profile-${Date.now()}`);
const SCREENSHOT_PATH = path.resolve(__dirname, 'screenshots/local-launch/full-kde-plasma-desktop.png');

async function launchFullDesktop() {
  console.log('Launching Edge for live KDE Plasma desktop demonstration...');
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: false,
    userDataDir: PROFILE_DIR,
    defaultViewport: null,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--enable-features=SharedArrayBuffer',
      '--enable-unsafe-webgpu',
      '--use-gl=angle',
      '--use-angle=default',
      '--window-size=1600,1000',
    ],
  });

  try {
    const page = (await browser.pages())[0];
    await page.setViewport({ width: 1600, height: 1000 });

    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('display:') || text.includes('plasma:')) {
        console.log('[Browser Console]', text);
      }
    });

    console.log('Opening http://localhost:3000...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });

    console.log('Clicking "Launch WebLinux"...');
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Launch WebLinux'));
      if (btn) btn.click();
    });

    console.log('Waiting for Wayland display activation...');
    let activated = false;
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const active = await page.evaluate(() => window.rvDisplay ? window.rvDisplay.active() : false);
      if (active) {
        console.log(`\n  ✓ Wayland active at T+${i}s!`);
        activated = true;
        break;
      }
    }

    if (!activated) {
      throw new Error('Wayland display did not become active in 60s');
    }

    // Wait for Plasma session to complete its splash and settle
    console.log('Waiting for Plasma session to finish splash and present desktop panel...');
    for (let i = 0; i < 45; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const winCount = await page.evaluate(() => {
        if (!window.rvDisplay || !window.rvDisplay.windows) return 0;
        return window.rvDisplay.windows().length;
      });
      if (winCount > 0) {
        console.log(`  ✓ Plasma windows/panel detected: ${winCount} surfaces active at T+${i}s!`);
      }
      if (i >= 15 && winCount >= 1) break;
    }

    // Launch Konsole and Dolphin terminal on Wayland display
    console.log('\nLaunching Konsole terminal in KDE session...');
    const konsoleRes = await page.evaluate(async () => {
      if (!window.weblinuxAdapter) return 'No adapter';
      return await window.weblinuxAdapter.runCommand('debian desktop wayland konsole &', 8000);
    });
    console.log('[Konsole launch]:', konsoleRes.out || konsoleRes);

    console.log('Waiting 6 seconds for Konsole window to paint...');
    await new Promise(r => setTimeout(r, 6000));

    // Verify guest system info
    console.log('\nQuerying Linux guest info...');
    const guestInfo = await page.evaluate(async () => {
      if (!window.weblinuxAdapter) return 'No adapter';
      const u = await window.weblinuxAdapter.runCommand('debian uname -a; debian uptime', 8000);
      const ps = await window.weblinuxAdapter.runCommand('debian ps aux | grep -E "plasma|konsole|wlserver"', 8000);
      return { uname: u.out, ps: ps.out };
    });
    console.log('[Guest Info]:\n', guestInfo.uname);
    console.log('[Active Session Processes]:\n', guestInfo.ps);

    // Capture screenshot of live desktop
    fs.mkdirSync(path.dirname(SCREENSHOT_PATH), { recursive: true });
    await page.screenshot({ path: SCREENSHOT_PATH });
    const stat = fs.statSync(SCREENSHOT_PATH);
    console.log(`\n======================================================`);
    console.log(`✓ SCREENSHOT SAVED: ${SCREENSHOT_PATH} (${stat.size} bytes)`);
    console.log(`======================================================\n`);

  } finally {
    // Keep Microsoft Edge open and running for the user!
    console.log('>>> MICROSOFT EDGE IS LEFT RUNNING ON YOUR SCREEN <<<');
    browser.disconnect();
  }
}

launchFullDesktop().catch(console.error);
