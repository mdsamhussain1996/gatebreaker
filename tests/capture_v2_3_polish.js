/**
 * Automated Screenshot Capture for Gatebreaker v2.3 Polish & Quality Fixes
 * Captures laptop (1280x720) and mobile (414x736) screenshots of:
 * - 1-3 Mushroom King boss fight
 * - 2-3 Ancient Oak (organic tree climbing inside hollow with knot-hole windows)
 * - 2-3 Old Oak Guardian boss fight
 * - 3-3 Sand Wyrm boss fight
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
    '--remote-debugging-port=9228',
    '--user-data-dir=/tmp/chrome-v2-3-polish-cdp',
    'http://localhost:8094/'
  ]);

  await new Promise(r => setTimeout(r, 1400));

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
            const timer = setTimeout(evalRes, 5000);
            const evalHandler = (evt) => {
              const m = JSON.parse(evt.data);
              if (m.id === evalId) {
                clearTimeout(timer);
                ws.removeEventListener('message', evalHandler);
                setTimeout(evalRes, 800);
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
    await new Promise(r => setTimeout(r, 800));
  }
}

async function run() {
  console.log('Capturing screenshots for Gatebreaker v2.3 Polish...');

  // Setup scripts
  const setupBoss13 = `
    await new Promise(res => {
      const t = setInterval(() => {
        if (window.__gb && window.__gb.game) {
          clearInterval(t);
          window.__gb.startLevel('1-3');
          setTimeout(() => {
            const g = window.__gb.game;
            const b = g.boss;
            if (b) {
              g.player.place(b.x - 130, b.y + b.h);
              g.bossArenaEntered = true;
              g.arenaLocked = true;
              g.skipBossIntro();
              g.cam.fx = (b.x + g.player.cx) / 2;
              g.cam.fy = b.y + b.h / 2;
              g.applyCamera();
            }
            res();
          }, 600);
        }
      }, 100);
    });
  `;

  const setupTree23 = `
    await new Promise(res => {
      const t = setInterval(() => {
        if (window.__gb && window.__gb.game) {
          clearInterval(t);
          window.__gb.startLevel('2-3');
          setTimeout(() => {
            const g = window.__gb.game;
            // Place hero midway inside hollow Ancient Oak tree climbing up
            g.player.place(19 * 32, 23 * 32);
            g.cam.fx = g.player.cx;
            g.cam.fy = g.player.cy;
            g.applyCamera();
            res();
          }, 600);
        }
      }, 100);
    });
  `;

  const setupBoss23 = `
    await new Promise(res => {
      const t = setInterval(() => {
        if (window.__gb && window.__gb.game) {
          clearInterval(t);
          window.__gb.startLevel('2-3');
          setTimeout(() => {
            const g = window.__gb.game;
            const b = g.boss;
            if (b) {
              g.player.place(b.x - 140, b.y + b.h);
              g.bossArenaEntered = true;
              g.arenaLocked = true;
              g.skipBossIntro();
              g.cam.fx = (b.x + g.player.cx) / 2;
              g.cam.fy = b.y + b.h / 2;
              g.applyCamera();
            }
            res();
          }, 600);
        }
      }, 100);
    });
  `;

  const setupBoss33 = `
    await new Promise(res => {
      const t = setInterval(() => {
        if (window.__gb && window.__gb.game) {
          clearInterval(t);
          window.__gb.startLevel('3-3');
          setTimeout(() => {
            const g = window.__gb.game;
            const b = g.boss;
            if (b) {
              g.player.place(b.x - 140, b.y + b.h);
              g.bossArenaEntered = true;
              g.arenaLocked = true;
              g.skipBossIntro();
              g.cam.fx = (b.x + g.player.cx) / 2;
              g.cam.fy = b.y + b.h / 2;
              g.applyCamera();
            }
            res();
          }, 600);
        }
      }, 100);
    });
  `;

  // 1. Level 1-3 Mushroom King Boss Fight
  await captureScreen(1280, 720, setupBoss13, 'boss_1_3_mushroom_king_laptop.png');
  await captureScreen(414, 736, setupBoss13, 'boss_1_3_mushroom_king_phone.png', true);

  // 2. Level 2-3 Ancient Oak (Organic tree climbing inside hollow trunk)
  await captureScreen(1280, 720, setupTree23, 'level_2_3_ancient_oak_climb_laptop.png');
  await captureScreen(414, 736, setupTree23, 'level_2_3_ancient_oak_climb_phone.png', true);

  // 3. Level 2-3 Old Oak Guardian Boss Fight (Crown Arena)
  await captureScreen(1280, 720, setupBoss23, 'boss_2_3_old_oak_guardian_laptop.png');
  await captureScreen(414, 736, setupBoss23, 'boss_2_3_old_oak_guardian_phone.png', true);

  // 4. Level 3-3 Sand Wyrm Boss Fight
  await captureScreen(1280, 720, setupBoss33, 'boss_3_3_sand_wyrm_laptop.png');
  await captureScreen(414, 736, setupBoss33, 'boss_3_3_sand_wyrm_phone.png', true);

  console.log('All 8 screenshots captured successfully!');
}

run();
