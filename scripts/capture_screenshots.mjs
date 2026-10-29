import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const outDir = '/Users/newtonuser/.gemini/antigravity-ide/scratch/gatebreaker/screenshots';
const suffix = process.argv[2] || 'before';

async function captureAll() {
  const port = 9380;
  const dataDir = `/tmp/gb-capture-${port}`;
  const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    '--headless=new',
    '--disable-gpu',
    `--user-data-dir=${dataDir}`,
    '--window-size=1280,720',
    `--remote-debugging-port=${port}`,
    'http://127.0.0.1:8095/'
  ]);

  await new Promise(r => setTimeout(r, 2000));

  try {
    const res = await fetch(`http://127.0.0.1:${port}/json`);
    const tabs = await res.json();
    console.log('All tabs:', tabs.map(t => ({ url: t.url, type: t.type })));
    const tab = tabs.find(t => t.type === 'page' && t.url.includes('8095')) || tabs.find(t => t.type === 'page') || tabs[0];
    console.log('Using tab:', tab.url);
    const ws = new WebSocket(tab.webSocketDebuggerUrl);

    await new Promise((resolve, reject) => {
      let id = 1;
      const pending = new Map();
      const send = (method, params = {}) => {
        const msgId = id++;
        ws.send(JSON.stringify({ id: msgId, method, params }));
        return msgId;
      };

      ws.onmessage = (evt) => {
        const msg = JSON.parse(evt.data);
        if (msg.id && pending.has(msg.id)) {
          pending.get(msg.id)(msg);
          pending.delete(msg.id);
        }
      };

      const rpc = (method, params = {}) => new Promise(res => {
        const msgId = send(method, params);
        pending.set(msgId, res);
      });

      const evaluate = async (expr) => {
        const r = await rpc('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
        if (r?.result?.exceptionDetails) {
          console.error('Eval error:', r.result.exceptionDetails);
        }
        return r?.result?.result?.value;
      };

      const screenshot = async (filename) => {
        const msg = await rpc('Page.captureScreenshot', { format: 'png' });
        if (msg?.result?.data) {
          const buf = Buffer.from(msg.result.data, 'base64');
          fs.writeFileSync(path.join(outDir, filename), buf);
          console.log(`Saved screenshot: ${filename}`);
        }
      };

      ws.onopen = async () => {
        await rpc('Page.enable');
        await rpc('Runtime.enable');
        await rpc('Emulation.setDeviceMetricsOverride', {
          width: 960, height: 540, deviceScaleFactor: 1, mobile: false
        });

        console.log('Navigating to http://127.0.0.1:8095/...');
        await rpc('Page.navigate', { url: 'http://127.0.0.1:8095/' });
        await new Promise(r => setTimeout(r, 2500));

        const href = await evaluate('location.href');
        console.log('Current page location:', href);

        // Ensure title screen is dismissed
        await evaluate(`
          if (window.__gb) {
            window.__gb.ui.hideScreens();
            window.__gb.ui.setPlaying(true);
          }
        `);

        const levels = ['1-1', '2-1', '3-1', '4-1', '5-1', '6-1'];
        for (const lvl of levels) {
          console.log(`Loading level ${lvl}...`);
          const res = await evaluate(`
            if (window.__gb) {
              window.__gb.startLevel('${lvl}');
              window.__gb.ui.hideScreens();
              window.__gb.ui.setPlaying(true);
              'OK';
            } else {
              'NO_GB';
            }
          `);
          console.log(`Level ${lvl} load result:`, res);
          await new Promise(r => setTimeout(r, 800));
          await screenshot(`${lvl}_${suffix}.png`);
        }

        resolve();
      };
      ws.onerror = reject;
    });

    ws.close();
  } catch (err) {
    console.error('Capture error:', err);
  } finally {
    try { chrome.kill('SIGKILL'); } catch (_) {}
    try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch (_) {}
  }
}

captureAll();
