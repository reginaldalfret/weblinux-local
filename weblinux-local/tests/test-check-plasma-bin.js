const puppeteer = require('puppeteer-core');
const path = require('path');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PROFILE_DIR = path.resolve(__dirname, `.edge-chk-profile-${Date.now()}`);

async function checkPlasmaBin() {
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
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Launch WebLinux'));
      if (btn) btn.click();
    });

    console.log('Waiting 20 seconds for shell...');
    await new Promise(r => setTimeout(r, 20000));

    const res = await page.evaluate(async () => {
      if (!window.weblinuxAdapter) return 'No adapter';
      const cmd = 'debian which plasmashell; debian ls -la /opt /opt/nq /run /usr/bin/plasmashell 2>&1; debian ps aux';
      return (await window.weblinuxAdapter.runCommand(cmd, 10000)).out;
    });

    console.log('\n[PLASMASHELL CHECK]:\n', res);

  } finally {
    browser.disconnect();
  }
}

checkPlasmaBin().catch(console.error);
