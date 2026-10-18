/**
 * Automated Screenshot Capture for Gatebreaker v2.3 Phase A
 */
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const outDir = '/Users/newtonuser/.gemini/antigravity-ide/brain/3d548fb5-2b76-41d6-95e2-088477819984';

async function captureScreen(width, height, setupFnStr, filename, isMobile = false) {
  const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    '--headless',
    '--disable-gpu',
    `--window-size=${width},${height}`,
    '--remote-debugging-port=9227',
    'http://localhost:8094/'
  ]);

  await new Promise(r => setTimeout(r, 1400));

  try {
    const res = await fetch('http://127.0.0.1:9227/json');
    const tabs = await res.json();
    const tab = tabs.find(t => t.url.includes('localhost:8094')) || tabs[0];
    const ws = new WebSocket(tab.webSocketDebuggerUrl);

    await new Promise((resolve, reject) => {
      let id = 1;
      const send = (method, params = {}) => {
        ws.send(JSON.stringify({ id: id++, method, params }));
      };

      ws.onopen = async () => {
        send('Page.enable');
        send('Runtime.enable');
        send('Emulation.setDeviceMetricsOverride', {
          width,
          height,
          deviceScaleFactor: 1,
          mobile: isMobile
        });
        if (isMobile) {
          send('Emulation.setTouchEmulationEnabled', { enabled: true });
        }
        await new Promise(r => setTimeout(r, 600));

        if (setupFnStr) {
          await new Promise((evalRes) => {
            const evalId = id;
            const evalHandler = (evt) => {
              const m = JSON.parse(evt.data);
              if (m.id === evalId) {
                ws.removeEventListener('message', evalHandler);
                setTimeout(evalRes, 500);
              }
            };
            ws.addEventListener('message', evalHandler);
            send('Runtime.evaluate', {
              expression: `(async () => { ${setupFnStr} })()`,
              awaitPromise: true
            });
          });
        }

        ws.onmessage = (evt) => {
          const msg = JSON.parse(evt.data);
          if (msg.result && msg.result.data) {
            const buf = Buffer.from(msg.result.data, 'base64');
            const filePath = path.join(outDir, filename);
            fs.writeFileSync(filePath, buf);
            console.log(`Saved screenshot: ${filename} (${width}x${height})`);
            resolve();
          }
        };

        send('Page.captureScreenshot', { format: 'png' });
      };
      ws.onerror = reject;
    });

    ws.close();
  } catch (err) {
    console.error(`Error capturing ${filename}:`, err);
  } finally {
    chrome.kill();
    await new Promise(r => setTimeout(r, 700));
  }
}

async function run() {
  console.log('Capturing screenshots for Phase A...');

  // 1. Level 1-3 Start (Laptop: 1366x768) - Boss bar should be hidden at start
  await captureScreen(1366, 768, `
    await new Promise(res => {
      const t = setInterval(() => {
        if (window.__gb && window.__gb.game) {
          clearInterval(t);
          window.__gb.startLevel('1-3');
          setTimeout(res, 500);
        }
      }, 50);
    });
  `, 'phaseA_l1_3_start_laptop.png', false);

  // 2. Level 1-3 Boss Arena (Laptop: 1366x768) - Boss bar visible with "MUSHROOM KING" only, phase notches, HUD super ready & power-up
  await captureScreen(1366, 768, `
    await new Promise(res => {
      const t = setInterval(() => {
        if (window.__gb && window.__gb.game) {
          clearInterval(t);
          const g = window.__gb.game;
          window.__gb.startLevel('1-3');
          setTimeout(() => {
            const boss = g.boss;
            if (boss) {
              g.player.place(boss.cx - 150, boss.y + boss.h);
              g.bossArenaEntered = true;
            }
            g.superMeter = 100;
            g.player.activePowerup = { type: 'blaster', duration: 15, ammo: 10, maxAmmo: 10 };
            window.__gb.ui.updateHud(g);
            res();
          }, 500);
        }
      }, 50);
    });
  `, 'phaseA_l1_3_arena_laptop.png', false);

  // 3. Level 1-3 Boss Arena (Mobile: 844x390 landscape)
  await captureScreen(844, 390, `
    await new Promise(res => {
      const t = setInterval(() => {
        if (window.__gb && window.__gb.game) {
          clearInterval(t);
          const g = window.__gb.game;
          window.__gb.startLevel('1-3');
          setTimeout(() => {
            const boss = g.boss;
            if (boss) {
              g.player.place(boss.cx - 150, boss.y + boss.h);
              g.bossArenaEntered = true;
            }
            g.superMeter = 100;
            g.player.activePowerup = { type: 'fire_knife', duration: 12, ammo: 8, maxAmmo: 8 };
            window.__gb.ui.updateHud(g);
            res();
          }, 500);
        }
      }, 50);
    });
  `, 'phaseA_l1_3_arena_mobile.png', true);

  // 4. Level 3-3 Hint Clamping (Laptop: 1366x768)
  await captureScreen(1366, 768, `
    await new Promise(res => {
      const t = setInterval(() => {
        if (window.__gb && window.__gb.game) {
          clearInterval(t);
          window.__gb.startLevel('3-3');
          setTimeout(res, 500);
        }
      }, 50);
    });
  `, 'phaseA_l3_3_hint_laptop.png', false);

  console.log('Done Phase A screenshots!');
}

run();
