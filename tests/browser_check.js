import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const outDir = '/Users/newtonuser/.gemini/antigravity-ide/brain/3d548fb5-2b76-41d6-95e2-088477819984';

async function runBrowserCheck() {
  console.log('--- Starting Browser Check & Performance Pass (1366x768 & 844x390) ---');

  const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    '--headless',
    '--disable-gpu',
    '--window-size=1366,768',
    '--remote-debugging-port=9228',
    'http://localhost:8094/'
  ]);

  await new Promise(r => setTimeout(r, 1500));

  try {
    const res = await fetch('http://127.0.0.1:9228/json');
    const tabs = await res.json();
    const tab = tabs.find(t => t.url.includes('localhost:8094')) || tabs[0];
    const ws = new WebSocket(tab.webSocketDebuggerUrl);

    await new Promise((resolve, reject) => {
      let id = 1;
      const send = (method, params = {}) => {
        const msgId = id++;
        ws.send(JSON.stringify({ id: msgId, method, params }));
        return msgId;
      };

      const pending = new Map();
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
        const res = await rpc('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
        return res?.result?.result?.value;
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

        // Check console errors
        const consoleErrors = [];
        ws.addEventListener('message', evt => {
          const m = JSON.parse(evt.data);
          if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
            consoleErrors.push(m.params.args.map(a => a.value || a.description).join(' '));
          }
        });

        // 1. Laptop view (1366x768)
        await rpc('Emulation.setDeviceMetricsOverride', {
          width: 1366, height: 768, deviceScaleFactor: 1, mobile: false
        });
        await new Promise(r => setTimeout(r, 600));

        // Open World Map
        await evaluate(`
          if (window.__gb) {
            window.__gb.showWorldMap(1);
          }
        `);
        await new Promise(r => setTimeout(r, 600));
        await screenshot('phase1_laptop_worldmap.png');

        // Test Level 1-1
        console.log('Testing Level 1-1 in browser...');
        await evaluate(`
          import('./src/levels.js').then(m => {
            window.__gb.startPlay(m.LEVELS[0]);
          });
        `);
        await new Promise(r => setTimeout(r, 800));
        const fps11 = await evaluate(`
          new Promise(res => {
            let frames = 0, start = performance.now();
            function step() {
              frames++;
              if (performance.now() - start >= 500) {
                res(Math.round((frames * 1000) / (performance.now() - start)));
              } else requestAnimationFrame(step);
            }
            requestAnimationFrame(step);
          })
        `);
        console.log(`  Level 1-1 FPS: ${fps11}`);
        await screenshot('phase1_laptop_level1_1.png');

        // Test Level 1-2
        console.log('Testing Level 1-2 in browser...');
        await evaluate(`
          import('./src/levels.js').then(m => {
            window.__gb.startPlay(m.LEVELS[1]);
          });
        `);
        await new Promise(r => setTimeout(r, 800));
        const fps12 = await evaluate(`
          new Promise(res => {
            let frames = 0, start = performance.now();
            function step() {
              frames++;
              if (performance.now() - start >= 500) {
                res(Math.round((frames * 1000) / (performance.now() - start)));
              } else requestAnimationFrame(step);
            }
            requestAnimationFrame(step);
          })
        `);
        console.log(`  Level 1-2 FPS: ${fps12}`);
        await screenshot('phase1_laptop_level1_2.png');

        // Test Level 1-3 (Boss Level)
        console.log('Testing Level 1-3 (Boss Level) in browser...');
        await evaluate(`
          import('./src/levels.js').then(m => {
            window.__gb.startPlay(m.LEVELS[2]);
            const p = window.__gb.game.player;
            p.x = 24 * 32;
            p.y = 8 * 32;
            window.__gb.game.cam.x = 200;
            window.__gb.game.cam.y = 0;
          });
        `);
        await new Promise(r => setTimeout(r, 800));
        const fps13 = await evaluate(`
          new Promise(res => {
            let frames = 0, start = performance.now();
            function step() {
              frames++;
              if (performance.now() - start >= 500) {
                res(Math.round((frames * 1000) / (performance.now() - start)));
              } else requestAnimationFrame(step);
            }
            requestAnimationFrame(step);
          })
        `);
        console.log(`  Level 1-3 FPS: ${fps13}`);
        await screenshot('phase1_laptop_level1_3_boss.png');

        // 2. Phone Landscape (844x390)
        console.log('Switching to Phone landscape (844x390)...');
        await rpc('Emulation.setDeviceMetricsOverride', {
          width: 844, height: 390, deviceScaleFactor: 1, mobile: true
        });
        await rpc('Emulation.setTouchEmulationEnabled', { enabled: true });
        await evaluate(`
          document.body.classList.add('touch-device');
          window.__gb.showWorldMap(1);
        `);
        await new Promise(r => setTimeout(r, 600));
        await screenshot('phase1_phone_worldmap.png');

        await evaluate(`
          import('./src/levels.js').then(m => {
            window.__gb.startPlay(m.LEVELS[2]);
            const p = window.__gb.game.player;
            p.x = 24 * 32;
            p.y = 8 * 32;
            window.__gb.game.cam.x = 200;
            window.__gb.game.cam.y = 0;
          });
        `);
        await new Promise(r => setTimeout(r, 800));
        const phoneFps = await evaluate(`
          new Promise(res => {
            let frames = 0, start = performance.now();
            function step() {
              frames++;
              if (performance.now() - start >= 500) {
                res(Math.round((frames * 1000) / (performance.now() - start)));
              } else requestAnimationFrame(step);
            }
            requestAnimationFrame(step);
          })
        `);
        console.log(`  Phone 844x390 Level 1-3 FPS: ${phoneFps}`);
        await screenshot('phase1_phone_level1_3_boss.png');

        console.log(`Browser check summary:`);
        console.log(`  Console errors: ${consoleErrors.length}`);
        if (consoleErrors.length > 0) {
          consoleErrors.forEach(err => console.error(`    ${err}`));
        } else {
          console.log(`  ✓ No console errors across all levels!`);
        }

        resolve();
      };
      ws.onerror = reject;
    });

    ws.close();
  } catch (e) {
    console.error('Error during browser check:', e);
  } finally {
    chrome.kill();
    await new Promise(r => setTimeout(r, 700));
  }
}

runBrowserCheck();
