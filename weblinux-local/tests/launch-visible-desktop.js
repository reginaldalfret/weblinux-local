const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const USER_DATA_DIR = path.resolve(__dirname, '.edge-live-profile');
const SCREENSHOT_DIR = path.resolve(__dirname, 'screenshots/local-launch');
const FINAL_SCREENSHOT = path.join(SCREENSHOT_DIR, 'weblinux-visible-desktop.png');

async function main() {
  console.log('Launching headful visible Microsoft Edge...');
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: false,
    userDataDir: USER_DATA_DIR,
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

  const pages = await browser.pages();
  const page = pages[0] || (await browser.newPage());

  page.on('console', msg => {
    const text = msg.text();
    if (!text.includes('requestAnimationFrame') && !text.includes('pointer') && !text.includes('[vite]')) {
      console.log(`[Browser Console] ${msg.type().toUpperCase()}: ${text}`);
    }
  });

  page.on('pageerror', err => {
    console.error(`[Browser PageError]:`, err.message);
  });

  console.log('Navigating to http://localhost:3000...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 30000 });

  console.log('Clicking "Launch WebLinux"...');
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Launch WebLinux'));
    if (btn) btn.click();
  });

  console.log('Waiting for Linux kernel and root shell prompt...');
  let lastLen = 0;
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const res = await page.evaluate(() => {
      const a = window.weblinuxAdapter;
      if (!a) return { out: '', ready: false };
      return {
        out: a.getOutput ? a.getOutput() : '',
        ready: a.getStatus ? a.getStatus().shellReady : false,
      };
    });

    if (res.out.length > lastLen) {
      process.stdout.write(res.out.slice(lastLen));
      lastLen = res.out.length;
    }

    if (res.out.includes('# ') || res.ready || res.out.includes('autostart: the desktop')) {
      console.log('\n  ✓ Shell prompt detected!');
      break;
    }
  }

  // Wait 4 seconds for KDE Plasma rendering
  console.log('\nAwaiting KDE Plasma Wayland rendering...');
  await new Promise(r => setTimeout(r, 4000));

  // Inspect stage and display-canvas in DOM
  const domStatus = await page.evaluate(() => {
    const stage = document.getElementById('rv-stage');
    const canvas = document.getElementById('display-canvas');
    const sc = document.getElementById('screen');
    const bar = document.getElementById('rv-bar');
    return {
      stageInDom: !!stage,
      stageParent: stage ? stage.parentElement.className : null,
      stageStyle: stage ? stage.getAttribute('style') : null,
      stageChildren: stage ? Array.from(stage.children).map(c => ({ id: c.id, tag: c.tagName, display: window.getComputedStyle(c).display, w: c.clientWidth, h: c.clientHeight })) : [],
      canvasVisible: canvas ? (canvas.style.display !== 'none' && canvas.clientWidth > 0) : false,
      rvDisplayActive: typeof window.rvDisplay !== 'undefined' ? window.rvDisplay.active() : false,
      rvStats: typeof window.rvDisplay !== 'undefined' ? window.rvDisplay.stats : null,
    };
  });
  console.log('\n[DOM & Stage Status]:', JSON.stringify(domStatus, null, 2));

  // Check guest desktop processes
  const psRes = await page.evaluate(async () => {
    return await window.weblinuxAdapter.runCommand('ps aux || ps', 15000);
  });
  console.log('\n[Guest Processes]:\n', psRes.out);

  // Take screenshot
  console.log(`\nCapturing screenshot to ${FINAL_SCREENSHOT}...`);
  await page.screenshot({ path: FINAL_SCREENSHOT });
  console.log('  ✓ Screenshot saved!');

  console.log('\n>>> LEAVING VISIBLE EDGE WINDOW OPEN <<<');
  // Disconnect from browser without closing it
  browser.disconnect();
}

main().catch(console.error);
