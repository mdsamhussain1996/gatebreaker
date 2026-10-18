/**
 * Automated Screenshot Capture for Gatebreaker v2.3 Phase B (All 9 Levels)
 * Captures Laptop (1366x768) and Mobile (844x390) for all 9 unique level layouts.
 */
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const outDir = '/Users/newtonuser/.gemini/antigravity-ide/brain/3d548fb5-2b76-41d6-95e2-088477819984';
const LEVELS = ['1-1', '1-2', '1-3', '2-1', '2-2', '2-3', '3-1', '3-2', '3-3'];

async function captureAllLevels(width, height, isMobile, prefix) {
  const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    '--headless',
    '--disable-gpu',
    '--user-data-dir=/tmp/chrome-phase-b-cdp',
    `--window-size=${width},${height}`,
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
        ws.send(JSON.stringify({ id: id++, method, params }));
      };

      const sendAsync = (method, params = {}) => {
        return new Promise((evalRes) => {
          const reqId = id++;
          const handler = (evt) => {
            const m = JSON.parse(evt.data);
            if (m.id === reqId) {
              ws.removeEventListener('message', handler);
              evalRes(m.result);
            }
          };
          ws.addEventListener('message', handler);
          ws.send(JSON.stringify({ id: reqId, method, params }));
        });
      };

      ws.onopen = async () => {
        await sendAsync('Page.enable');
        await sendAsync('Runtime.enable');
        await sendAsync('Emulation.setDeviceMetricsOverride', {
          width,
          height,
          deviceScaleFactor: 1,
          mobile: isMobile
        });
        if (isMobile) {
          await sendAsync('Emulation.setTouchEmulationEnabled', { enabled: true });
        }
        await new Promise(r => setTimeout(r, 600));

        // Wait for game ready
        await sendAsync('Runtime.evaluate', {
          expression: `new Promise(res => {
            const t = setInterval(() => {
              if (window.__gb && window.__gb.game) {
                clearInterval(t);
                res();
              }
            }, 50);
          })`,
          awaitPromise: true
        });

        // Loop through each level
        for (const levelId of LEVELS) {
          const filename = `${prefix}_${levelId.replace('-', '_')}.png`;
          console.log(`Setting up ${levelId} for ${filename}...`);

          await sendAsync('Runtime.evaluate', {
            expression: `(async () => {
              window.__gb.startLevel('${levelId}');
              const g = window.__gb.game;
              if (g) {
                // If boss level, let camera and entities settle nicely
                g.cam.x = Math.max(0, g.player.x - 300);
                g.cam.y = Math.max(0, g.player.y - 180);
                window.__gb.ui.updateHud(g);
              }
              await new Promise(r => setTimeout(r, 600));
            })()`,
            awaitPromise: true
          });

          // Take screenshot
          const screenshotRes = await sendAsync('Page.captureScreenshot', { format: 'png' });
          if (screenshotRes && screenshotRes.data) {
            const buf = Buffer.from(screenshotRes.data, 'base64');
            fs.writeFileSync(path.join(outDir, filename), buf);
            console.log(`Saved: ${filename} (${width}x${height})`);
          }
        }
        resolve();
      };

      ws.onerror = reject;
    });

    ws.close();
  } catch (err) {
    console.error(`Error during capture (${prefix}):`, err);
  } finally {
    chrome.kill();
    await new Promise(r => setTimeout(r, 700));
  }
}

async function run() {
  console.log('Capturing Laptop screenshots for all 9 levels...');
  await captureAllLevels(1366, 768, false, 'phaseB_laptop');

  console.log('Capturing Mobile screenshots for all 9 levels...');
  await captureAllLevels(844, 390, true, 'phaseB_mobile');

  console.log('All screenshots captured successfully!');
}

run();
