const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const FRESH_PROFILE = path.resolve(__dirname, `.edge-profile-${Date.now()}`);

async function inspectBoot() {
  console.log('Launching Edge for boot log inspection...');
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

    console.log('Waiting for shell prompt (# )...');
    for (let i = 0; i < 90; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const res = await page.evaluate(() => {
        const a = window.weblinuxAdapter;
        if (!a) return { out: '', shellReady: false };
        return {
          out: a.getOutput ? a.getOutput() : '',
          shellReady: a.getStatus ? a.getStatus().shellReady : false,
        };
      });

      if (res.shellReady || (res.out.includes('# ') && res.out.includes('EXT4-fs (wda)'))) {
        console.log('Shell ready detected!');
        break;
      }
    }

    console.log('Sleeping 4 seconds for autostart commands to execute...');
    await new Promise(r => setTimeout(r, 4000));

    // Inspect logs
    const cmds = [
      'cat /proc/cmdline',
      'debian cat /root/autostart.log',
      'debian cat /root/wlserver.log',
      'debian cat /root/desktop-status.log',
      'debian ps aux',
      'debian ls -la /run /run/hostnode /run/wlserver',
    ];

    for (const cmd of cmds) {
      console.log(`\n================ [CMD: ${cmd}] ================`);
      const r = await page.evaluate(async (command) => {
        if (!window.weblinuxAdapter) return 'NO ADAPTER';
        return await window.weblinuxAdapter.runCommand(command, 15000);
      }, cmd);
      console.log(r.out || r);
    }

    // Check display active and window.rvTabId
    const rvInfo = await page.evaluate(() => {
      return {
        tabId: window.rvTabId,
        active: window.rvDisplay ? window.rvDisplay.active() : 'no rvDisplay',
        canvasDisplay: document.getElementById('display-canvas') ? document.getElementById('display-canvas').style.display : 'no canvas',
        stage: document.getElementById('rv-stage') ? document.getElementById('rv-stage').outerHTML.slice(0, 300) : 'no stage',
      };
    });
    console.log('\n[RV Info]:', JSON.stringify(rvInfo, null, 2));

  } finally {
    browser.disconnect();
  }
}

inspectBoot().catch(console.error);
