const http = require('http');

async function getPageWsUrl() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:9222/json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const list = JSON.parse(data);
          const page = list.find(t => t.type === 'page' && t.url.includes('localhost:3000'));
          if (page) resolve(page.webSocketDebuggerUrl);
          else reject(new Error('No localhost:3000 page target found'));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function query() {
  const wsUrl = await getPageWsUrl();
  console.log('Connecting to:', wsUrl);
  const ws = new WebSocket(wsUrl);

  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  const expr = `(() => {
    const stage = document.getElementById("rv-stage");
    const canvas = document.getElementById("display-canvas");
    const sc = document.getElementById("screen");
    const bar = document.getElementById("rv-bar");

    return {
      hasStage: !!stage,
      stageParent: stage ? (stage.parentElement ? stage.parentElement.tagName + "." + stage.parentElement.className : "no-parent") : null,
      stageStyle: stage ? stage.getAttribute("style") : null,
      stageChildren: stage ? Array.from(stage.children).map(c => ({
        id: c.id,
        tag: c.tagName,
        w: c.clientWidth,
        h: c.clientHeight,
        pos: window.getComputedStyle(c).position,
        display: window.getComputedStyle(c).display,
        style: c.getAttribute("style")
      })) : [],
      scInfo: sc ? {
        id: sc.id,
        parent: sc.parentElement ? sc.parentElement.id : null,
        w: sc.width,
        h: sc.height,
        clientW: sc.clientWidth,
        clientH: sc.clientHeight,
        style: sc.getAttribute("style")
      } : null,
      canvasInfo: canvas ? {
        id: canvas.id,
        parent: canvas.parentElement ? canvas.parentElement.id : null,
        w: canvas.width,
        h: canvas.height,
        clientW: canvas.clientWidth,
        clientH: canvas.clientHeight,
        style: canvas.getAttribute("style")
      } : null,
      rvDisplayActive: typeof window.rvDisplay !== "undefined" && window.rvDisplay.active ? window.rvDisplay.active() : false,
      rvStats: typeof window.rvDisplay !== "undefined" ? window.rvDisplay.stats : null,
      adapterState: window.weblinuxAdapter ? window.weblinuxAdapter.getStatus() : null
    };
  })()`;

  ws.send(JSON.stringify({
    id: 1,
    method: 'Runtime.evaluate',
    params: {
      expression: expr,
      returnByValue: true
    }
  }));

  const result = await new Promise((resolve) => {
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.id === 1) {
        resolve(data.result);
      }
    };
  });

  console.log('Result:', JSON.stringify(result.result.value, null, 2));
  ws.close();
}

query().catch(console.error);
