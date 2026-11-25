const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PROFILE_DIR = path.resolve(__dirname, `.edge-monitor-profile-${Date.now()}`);
const SCREENSHOT_PATH = path.resolve(__dirname, 'screenshots/local-launch/monitored-plasma-desktop.png');

async function monitorDesktop() {
  console.log('Starting Edge for full desktop boot monitoring...');
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
      '--window-size=1440,900',
    ],
  });

  try {
    const page = (await browser.pages())[0];
    await page.setViewport({ width: 1440, height: 900 });

    // Catch any page console errors
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('display:') || text.includes('Wayland') || text.includes('error') || text.includes('Error')) {
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

    console.log('Monitoring desktop startup for up to 120 seconds...');
    const startTime = Date.now();
    let desktopActive = false;

    for (let sec = 0; sec < 120; sec += 3) {
      await new Promise(r => setTimeout(r, 3000));
      const elapsed = Math.round((Date.now() - startTime) / 1000);

      const status = await page.evaluate(async () => {
        const a = window.weblinuxAdapter;
        const d = window.rvDisplay;
        const canvas = document.getElementById('display-canvas');
        const sc = document.getElementById('screen');
        
        let ps = '';
        let wlLog = '';
        let autoLog = '';
        if (a && a.runCommand) {
          try {
            const p = await a.runCommand('debian ps aux', 3000);
            ps = p.out ? p.out.split('\n').filter(l => l.includes('desktop') || l.includes('wlserver') || l.includes('plasma') || l.includes('kbuild') || l.includes('dbus')).join(' | ') : '';
          } catch(e) {}
          try {
            const w = await a.runCommand('debian cat /root/wlserver.log', 2000);
            wlLog = w.out || '';
          } catch(e) {}
          try {
            const al = await a.runCommand('debian cat /root/autostart.log', 2000);
            autoLog = al.out || '';
          } catch(e) {}
        }

        return {
          active: d ? d.active() : false,
          canvasDisplay: canvas ? canvas.style.display : null,
          canvasWidth: canvas ? canvas.width : 0,
          canvasHeight: canvas ? canvas.height : 0,
          scW: sc ? sc.clientWidth : 0,
          scH: sc ? sc.clientHeight : 0,
          ps,
          wlLog: wlLog.slice(-200),
          autoLog: autoLog.slice(-200),
        };
      });

      console.log(`[T+${elapsed}s] Active: ${status.active} | Canvas: ${status.canvasDisplay} (${status.canvasWidth}x${status.canvasHeight}) | Screen: ${status.scW}x${status.scH}`);
      if (status.ps) console.log(`   Processes: ${status.ps}`);
      if (status.wlLog) console.log(`   wlserver.log: ${status.wlLog.trim()}`);

      if (status.active) {
        console.log('\n>>> SUCCESS: rvDisplay.active() IS TRUE! Desktop is actively rendering! <<<');
        desktopActive = true;
        // Wait another 5 seconds for full paint of Plasma widgets
        await new Promise(r => setTimeout(r, 5000));
        break;
      }
    }

    // Take high-resolution screenshot
    fs.mkdirSync(path.dirname(SCREENSHOT_PATH), { recursive: true });
    await page.screenshot({ path: SCREENSHOT_PATH });
    const stat = fs.statSync(SCREENSHOT_PATH);
    console.log(`\nScreenshot captured: ${SCREENSHOT_PATH} (${stat.size} bytes)`);

    // Verify terminal execution
    console.log('\nVerifying guest terminal execution...');
    const unameRes = await page.evaluate(async () => {
      if (!window.weblinuxAdapter) return 'No adapter';
      return await window.weblinuxAdapter.runCommand('debian uname -a; debian uptime; debian ls -lh /debian/usr/bin/dolphin', 10000);
    });
    console.log('[Guest Verification]:\n', unameRes.out || unameRes);

  } finally {
    // Keep browser running on user screen
    console.log('\nLeaving Microsoft Edge open on host for user interaction.');
    browser.disconnect();
  }
}

monitorDesktop().catch(console.error);
