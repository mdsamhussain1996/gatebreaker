import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const outDir = '/Users/newtonuser/.gemini/antigravity-ide/brain/3d548fb5-2b76-41d6-95e2-088477819984';

async function runBrowserCheck() {
  console.log('--- Starting Browser Check for v2.2 Moving Enemies (1366x768 & 844x390) ---');

  const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    '--headless',
    '--disable-gpu',
    '--window-size=1366,768',
    '--remote-debugging-port=9229',
    'http://localhost:8094/'
  ]);

  await new Promise(r => setTimeout(r, 1500));

  try {
    const res = await fetch('http://127.0.0.1:9229/json');
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

        // Unlock all levels
        await evaluate(`
          const save = {
            unlocked: ['1-1','1-2','1-3','2-1','2-2','2-3','3-1','3-2','3-3'],
            best: {
              '1-1': { stars: 3, time: 45.2, coins: 65 },
              '1-2': { stars: 2, time: 58.4, coins: 74 },
              '1-3': { stars: 3, time: 82.1, coins: 62 },
              '2-1': { stars: 2, time: 64.0, coins: 70 },
              '2-2': { stars: 3, time: 71.5, coins: 68 },
              '2-3': { stars: 3, time: 94.2, coins: 66 }
            },
            settings: { sfx: 0.8, music: 0.5, shake: true }
          };
          localStorage.setItem('gatebreaker.v2.save', JSON.stringify(save));
        `);

        // Test Level 1-2: Night Bat & Hopper Frog
        console.log('Testing Level 1-2 (Night Bat & Hopper Frog)...');
        await evaluate(`
          import('./src/levels.js').then(m => {
            window.__gb.startPlay(m.LEVELS.find(l => l.id === '1-2'));
            const p = window.__gb.game.player;
            p.x = 24 * 32; p.y = 20 * 32;
            window.__gb.game.cam.x = 24 * 32 - 400;
            window.__gb.game.cam.y = 20 * 32 - 250;
          });
        `);
        await new Promise(r => setTimeout(r, 800));
        await screenshot('v22_laptop_world1_bats_frogs.png');

        // Test Level 2-2: Wild Boar & Leaf Glider
        console.log('Testing Level 2-2 (Wild Boar & Leaf Glider)...');
        await evaluate(`
          import('./src/levels.js').then(m => {
            window.__gb.startPlay(m.LEVELS.find(l => l.id === '2-2'));
            const p = window.__gb.game.player;
            p.x = 12 * 32; p.y = 38 * 32;
            window.__gb.game.cam.x = 12 * 32 - 300;
            window.__gb.game.cam.y = 38 * 32 - 300;
          });
        `);
        await new Promise(r => setTimeout(r, 800));
        const fps22 = await evaluate(`
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
        console.log(`  Level 2-2 FPS (Laptop): ${fps22}`);
        await screenshot('v22_laptop_world2_boar_glider.png');

        // Test Level 3-1: Rolling Armadillo & Spinning Saw
        console.log('Testing Level 3-1 (Rolling Armadillo & Spinning Saw)...');
        await evaluate(`
          import('./src/levels.js').then(m => {
            window.__gb.startPlay(m.LEVELS.find(l => l.id === '3-1'));
            const p = window.__gb.game.player;
            p.x = 20 * 32; p.y = 22 * 32;
            window.__gb.game.cam.x = 20 * 32 - 300;
            window.__gb.game.cam.y = 22 * 32 - 250;
          });
        `);
        await new Promise(r => setTimeout(r, 800));
        await screenshot('v22_laptop_world3_armadillo_saw.png');

        // Test Level 1-3: Mushroom King Boss Summon Phase
        console.log('Testing Level 1-3 Boss Summon Phase...');
        await evaluate(`
          import('./src/levels.js').then(m => {
            window.__gb.startPlay(m.LEVELS.find(l => l.id === '1-3'));
            const king = window.__gb.game.boss;
            if (king) king.hit(window.__gb.game, 1); // trigger summon at HP 2
            const p = window.__gb.game.player;
            p.x = 20 * 32; p.y = 8 * 32;
            window.__gb.game.cam.x = 200; window.__gb.game.cam.y = 0;
          });
        `);
        await new Promise(r => setTimeout(r, 800));
        await screenshot('v22_laptop_boss_summon.png');

        // 2. Phone Landscape (844x390)
        console.log('Switching to Phone landscape (844x390)...');
        await rpc('Emulation.setDeviceMetricsOverride', {
          width: 844, height: 390, deviceScaleFactor: 1, mobile: true
        });
        await rpc('Emulation.setTouchEmulationEnabled', { enabled: true });
        await evaluate(`document.body.classList.add('touch-device');`);
        await new Promise(r => setTimeout(r, 600));

        // Phone: World 2 Wild Boar
        console.log('Testing Phone Level 2-2...');
        await evaluate(`
          import('./src/levels.js').then(m => {
            window.__gb.startPlay(m.LEVELS.find(l => l.id === '2-2'));
            const p = window.__gb.game.player;
            p.x = 12 * 32; p.y = 38 * 32;
            window.__gb.game.cam.x = 12 * 32 - 300;
            window.__gb.game.cam.y = 38 * 32 - 250;
          });
        `);
        await new Promise(r => setTimeout(r, 800));
        const phoneFps22 = await evaluate(`
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
        console.log(`  Phone 844x390 Level 2-2 FPS: ${phoneFps22}`);
        await screenshot('v22_phone_world2_boar.png');

        // Phone: World 3 Desert Hawk
        console.log('Testing Phone Level 3-2 (Desert Hawk)...');
        await evaluate(`
          import('./src/levels.js').then(m => {
            window.__gb.startPlay(m.LEVELS.find(l => l.id === '3-2'));
            const p = window.__gb.game.player;
            p.x = 22 * 32; p.y = 12 * 32;
            window.__gb.game.cam.x = 22 * 32 - 300;
            window.__gb.game.cam.y = 12 * 32 - 250;
          });
        `);
        await new Promise(r => setTimeout(r, 800));
        await screenshot('v22_phone_world3_hawk.png');

        console.log(`Browser check summary:`);
        console.log(`  Console errors: ${consoleErrors.length}`);
        if (consoleErrors.length > 0) {
          consoleErrors.forEach(err => console.error(`    ${err}`));
        } else {
          console.log(`  ✓ No console errors across all levels with moving enemies!`);
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
