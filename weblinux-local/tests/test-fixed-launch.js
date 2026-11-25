const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const FRESH_PROFILE = path.resolve(__dirname, `.edge-profile-${Date.now()}`);
const SCREENSHOT = path.resolve(__dirname, 'screenshots/local-launch/fixed-desktop-test.png');

async function test() {
  console.log('Launching Edge with fresh profile:', FRESH_PROFILE);
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: false,
    userDataDir: FRESH_PROFILE,
    defaultViewport: null,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--enable-features=SharedArrayBuffer',
      '--enable-unsafe-webgpu',
      '--use-gl=angle',
      '--use-angle=default',
      '--window-size=1440,900',
    ],
  });

  try {
    const page = (await browser.pages())[0];
    await page.setViewport({ width: 1440, height: 900 });

    console.log('Navigating to http://localhost:3000...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });

    console.log('Clicking "Launch WebLinux"...');
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Launch WebLinux'));
      if (btn) btn.click();
    });

    console.log('Awaiting boot sequence and desktop...');
    let lastLen = 0;
    for (let i = 0; i < 90; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const res = await page.evaluate(() => {
        const a = window.weblinuxAdapter;
        if (!a) return { out: '', shellReady: false, state: '' };
        return {
          out: a.getOutput ? a.getOutput() : '',
          shellReady: a.getStatus ? a.getStatus().shellReady : false,
          state: a.getStatus ? a.getStatus().state : '',
        };
      });

      if (res.out.length > lastLen) {
        process.stdout.write(res.out.slice(lastLen));
        lastLen = res.out.length;
      }

      if (res.out.includes('autostart: the desktop') || (res.out.includes('# ') && res.out.includes('EXT4-fs (wda)'))) {
        console.log('\n  ✓ Debian rootfs mounted & autostart detected!');
        break;
      }
    }

    // Wait 5 seconds for Wayland surface presentation
    console.log('\nAwaiting Wayland compositor presentation...');
    await new Promise(r => setTimeout(r, 5000));

    // Capture screenshot
    await page.screenshot({ path: SCREENSHOT });
    const stat = fs.statSync(SCREENSHOT);
    console.log(`\nScreenshot saved: ${SCREENSHOT} (${stat.size} bytes)`);

    // Check DOM stage & canvas
    const dom = await page.evaluate(() => {
      const stage = document.getElementById('rv-stage');
      const canvas = document.getElementById('display-canvas');
      const sc = document.getElementById('screen');
      return {
        stageParent: stage ? stage.parentElement.className : null,
        stageStyle: stage ? stage.getAttribute('style') : null,
        canvasStyle: canvas ? canvas.getAttribute('style') : null,
        canvasW: canvas ? canvas.width : 0,
        canvasH: canvas ? canvas.height : 0,
        scW: sc ? sc.clientWidth : 0,
        scH: sc ? sc.clientHeight : 0,
        active: window.rvDisplay ? window.rvDisplay.active() : false,
      };
    });
    console.log('[DOM Layout Status]:', JSON.stringify(dom, null, 2));

  } finally {
    // Keep browser open for user or disconnect
    browser.disconnect();
    console.log('\n>>> BROWSER LEFT OPEN FOR USER <<<');
  }
}

test().catch(console.error);
