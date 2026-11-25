const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PROFILE_DIR = path.resolve(__dirname, `.edge-wait-profile-${Date.now()}`);
const SCREENSHOT_DIR = path.resolve(__dirname, 'screenshots/local-launch');

async function waitForPlasma() {
  console.log('Launching Edge to observe complete KDE Plasma desktop lifecycle...');
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
      if (text.includes('splash:') || text.includes('display:') || text.includes('plasma:')) {
        console.log('[Console]', text);
      }
    });

    console.log('Navigating to http://localhost:3000...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });

    console.log('Clicking "Launch WebLinux"...');
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Launch WebLinux'));
      if (btn) btn.click();
    });

    console.log('Tracking lifecycle across 120 seconds...');
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

    let desktopReady = false;
    for (let sec = 5; sec <= 120; sec += 5) {
      await new Promise(r => setTimeout(r, 5000));

      const status = await page.evaluate(() => {
        const d = window.rvDisplay;
        const sp = window.rvSplash ? window.rvSplash.state() : null;
        const wins = d && d.windows ? d.windows() : [];
        return {
          active: d ? d.active() : false,
          splashShown: sp ? sp.shown : false,
          splashText: sp ? sp.text : '',
          windowsCount: wins.length,
          windows: wins.map(w => ({ id: w.id, kind: w.kind, layer: w.layer, title: w.title, w: w.w, h: w.h })),
        };
      });

      console.log(`[T+${sec}s] Display active: ${status.active} | Splash: ${status.splashShown} ("${status.splashText}") | Windows: ${status.windowsCount}`);
      if (status.windows.length > 0) {
        console.log('   Windows details:', JSON.stringify(status.windows));
      }

      // Take intermediate screenshots
      if (sec === 25 || sec === 50 || sec === 80 || sec === 110 || (status.active && !status.splashShown)) {
        const shotFile = path.join(SCREENSHOT_DIR, `plasma-lifecycle-${sec}s.png`);
        await page.screenshot({ path: shotFile });
        console.log(`   --> Snapshot saved: ${shotFile}`);
      }

      if (status.active && (!status.splashShown || status.windowsCount > 0)) {
        desktopReady = true;
      }
    }

    // Try launching Konsole
    console.log('\nLaunching Konsole terminal on desktop...');
    await page.evaluate(async () => {
      if (window.weblinuxAdapter) {
        await window.weblinuxAdapter.runCommand('debian desktop wayland konsole &', 5000);
      }
    });

    console.log('Waiting 10 seconds for Konsole window...');
    await new Promise(r => setTimeout(r, 10000));

    // Capture final master screenshot
    const finalShot = path.join(SCREENSHOT_DIR, 'plasma-final-desktop.png');
    await page.screenshot({ path: finalShot });
    const stat = fs.statSync(finalShot);
    console.log(`\n======================================================`);
    console.log(`FINAL DESKTOP SCREENSHOT SAVED: ${finalShot} (${stat.size} bytes)`);
    console.log(`======================================================\n`);

  } finally {
    console.log('>>> MICROSOFT EDGE WINDOW LEFT RUNNING ON SCREEN <<<');
    browser.disconnect();
  }
}

waitForPlasma().catch(console.error);
