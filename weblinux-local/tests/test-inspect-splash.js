const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PROFILE_DIR = path.resolve(__dirname, `.edge-splash-profile-${Date.now()}`);

async function inspectSplash() {
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

    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Launch WebLinux'));
      if (btn) btn.click();
    });

    console.log('Waiting 25 seconds for Wayland and Plasma splash initialization...');
    await new Promise(r => setTimeout(r, 25000));

    const state = await page.evaluate(async () => {
      const sp = window.rvSplash ? window.rvSplash.state() : null;
      const pl = window.rvPlasma ? {
        ready: window.rvPlasma.ready(),
        theme: window.rvPlasma.theme ? {
          wallpaper: window.rvPlasma.theme.wallpaper,
          colorScheme: window.rvPlasma.theme.colorScheme,
        } : null,
      } : null;
      const disp = window.rvDisplay ? {
        active: window.rvDisplay.active(),
        nativeShell: window.rvDisplay.nativeShell ? window.rvDisplay.nativeShell() : null,
        windows: window.rvDisplay.windows ? window.rvDisplay.windows() : [],
        screenSize: window.rvDisplay.screenSize ? window.rvDisplay.screenSize() : null,
      } : null;
      const panelLayer = !!document.querySelector('#rv-panel .rv-pp-layer');
      const panelEl = document.getElementById('rv-panel') ? document.getElementById('rv-panel').outerHTML.slice(0, 300) : null;

      let pLog = '', wlLog = '';
      if (window.weblinuxAdapter) {
        try { pLog = (await window.weblinuxAdapter.runCommand('debian cat /root/plasmashell.log', 2000)).out; } catch(e){}
        try { wlLog = (await window.weblinuxAdapter.runCommand('debian cat /root/wlserver.log', 2000)).out; } catch(e){}
      }

      return { sp, pl, disp, panelLayer, panelEl, pLog: pLog ? pLog.slice(-500) : '', wlLog: wlLog ? wlLog.slice(-500) : '' };
    });

    console.log('\n[SPLASH STATE]:', JSON.stringify(state.sp, null, 2));
    console.log('\n[PLASMA STATE]:', JSON.stringify(state.pl, null, 2));
    console.log('\n[DISPLAY STATE]:', JSON.stringify(state.disp, null, 2));
    console.log('\n[PANEL LAYER EXISTS]:', state.panelLayer);
    console.log('\n[PANEL HTML]:', state.panelEl);
    console.log('\n[PLASMASHELL LOG]:', state.pLog);
    console.log('\n[WLSERVER LOG]:', state.wlLog);

  } finally {
    browser.disconnect();
  }
}

inspectSplash().catch(console.error);
