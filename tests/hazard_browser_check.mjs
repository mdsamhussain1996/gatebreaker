import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const outDir = path.resolve(process.cwd(), 'screenshots');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

async function runHazardBrowserCheck() {
  console.log('--- Starting Hazard Browser Check for All 18 Levels ---');

  const port = 9420 + Math.floor(Math.random() * 200);
  const dataDir = `/tmp/gb-hazard-${port}`;
  const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    '--headless',
    '--disable-gpu',
    `--user-data-dir=${dataDir}`,
    '--window-size=1280,720',
    `--remote-debugging-port=${port}`,
    'http://localhost:8094/'
  ]);

  await new Promise(r => setTimeout(r, 2000));

  try {
    const res = await fetch(`http://127.0.0.1:${port}/json`);
    const tabs = await res.json();
    const tab = tabs.find(t => t.type === 'page' && t.url.includes('localhost:8094')) || tabs.find(t => t.type === 'page') || tabs[0];
    console.log('Selected tab:', tab ? { url: tab.url, type: tab.type } : 'NONE');
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
        if (res?.result?.exceptionDetails) {
          console.error('Eval error:', res.result.exceptionDetails.text, res.result.exceptionDetails.exception?.description);
        }
        return res?.result?.result?.value;
      };

      const screenshot = async (filename) => {
        const msg = await rpc('Page.captureScreenshot', { format: 'png' });
        if (msg?.result?.data) {
          const buf = Buffer.from(msg.result.data, 'base64');
          fs.writeFileSync(path.join(outDir, filename), buf);
          console.log(`Saved screenshot: ${filename} (${buf.length} bytes)`);
        }
      };

      ws.onopen = async () => {
        await rpc('Page.enable');
        await rpc('Runtime.enable');

        const consoleErrors = [];
        ws.addEventListener('message', evt => {
          const m = JSON.parse(evt.data);
          if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
            consoleErrors.push(m.params.args.map(a => a.value || a.description).join(' '));
          }
          if (m.method === 'Runtime.exceptionThrown') {
            consoleErrors.push(m.params.exceptionDetails.text);
          }
        });

        // Wait for game module to initialize
        await evaluate(`new Promise(r => {
          const chk = () => (window.__gb && window.__gb.game) ? r(true) : setTimeout(chk, 50);
          chk();
        })`);

        await rpc('Emulation.setDeviceMetricsOverride', {
          width: 1280, height: 720, deviceScaleFactor: 1, mobile: false
        });
        await new Promise(r => setTimeout(r, 500));

        const targetScreenshots = ['1-2', '2-3', '3-1', '4-1', '5-2', '6-1', '6-2'];

        // Test all 18 levels
        const levelCount = await evaluate(`window.__gb.LEVELS.length`);
        console.log(`Found ${levelCount} levels to test`);

        for (let i = 0; i < levelCount; i++) {
          const levelInfo = await evaluate(`(() => {
            const def = window.__gb.LEVELS[${i}];
            window.__gb.startPlay(def);
            return { id: def.id, name: def.name, world: def.world };
          })()`);

          console.log(`Testing Level ${levelInfo.id} (${levelInfo.name})...`);

          const isTargetShot = targetScreenshots.includes(levelInfo.id);

          if (isTargetShot) {
            // Position camera to highlight the signature hazard
            await evaluate(`(() => {
              const g = window.__gb.game;
              if (g.level.id === '1-2') { g.cam.x = 24 * 32 - 400; g.cam.y = 20 * 32 - 250; }
              else if (g.level.id === '2-3') { g.cam.x = 20 * 32 - 400; g.cam.y = 12 * 32 - 250; }
              else if (g.level.id === '3-1') { g.cam.x = 18 * 32 - 400; g.cam.y = 22 * 32 - 250; }
              else if (g.level.id === '4-1') { g.cam.x = 22 * 32 - 400; g.cam.y = 20 * 32 - 250; }
              else if (g.level.id === '5-2') { g.cam.x = 18 * 32 - 400; g.cam.y = 14 * 32 - 250; }
              else if (g.level.id === '6-1') { g.cam.x = 26 * 32 - 400; g.cam.y = 14 * 32 - 250; }
              else if (g.level.id === '6-2') { g.cam.x = 20 * 32 - 400; g.cam.y = 12 * 32 - 250; }
            })()`);
            await new Promise(r => setTimeout(r, 400));
            await screenshot(`${levelInfo.id}_before.png`);
          }

          // Step 10 simulated seconds (600 frames at 1/60s) with active hazard updates & rendering
          await evaluate(`(() => {
            const g = window.__gb.game;
            const DT = 1 / 60;
            const emptyInput = { left: false, right: false, up: false, down: false, jump: false, knife: false, dash: false };
            for (let f = 0; f < 600; f++) {
              g.update(emptyInput, DT);
            }
          })()`);

          if (isTargetShot) {
            // After hazards have cycled, take 'after' screenshot
            await new Promise(r => setTimeout(r, 400));
            await screenshot(`${levelInfo.id}_after.png`);
          }

          if (consoleErrors.length > 0) {
            console.error(`ERROR: Level ${levelInfo.id} produced console errors:`, consoleErrors);
            reject(new Error(`Level ${levelInfo.id} produced console errors: ${consoleErrors.join('; ')}`));
            return;
          }
        }

        console.log(`\nAll ${levelCount} levels tested with hazards active for 10 simulated seconds.`);
        console.log(`Total console errors: ${consoleErrors.length}`);

        if (consoleErrors.length === 0) {
          console.log('✓ PASS: Zero console errors across all 18 levels.');
          resolve();
        } else {
          reject(new Error(`Console errors found: ${consoleErrors.join(', ')}`));
        }
      };
    });

  } finally {
    try { chrome.kill(); } catch (_) {}
  }
}

runHazardBrowserCheck().catch(err => {
  console.error(err);
  process.exit(1);
});
