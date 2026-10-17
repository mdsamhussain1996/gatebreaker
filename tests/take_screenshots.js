/**
 * Automated Screenshot Capture for Gatebreaker Phase 1
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
    '--remote-debugging-port=9226',
    'http://localhost:8094/'
  ]);

  await new Promise(r => setTimeout(r, 1400));

  try {
    const res = await fetch('http://127.0.0.1:9226/json');
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
          send('Runtime.evaluate', {
            expression: `(async () => { ${setupFnStr} })()`,
            awaitPromise: true
          });
          await new Promise(r => setTimeout(r, 600));
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
  console.log('Capturing screenshots for Gatebreaker v2 (Platformer Prototype)...');

  // 1. Laptop Title Screen (1366x768)
  await captureScreen(1366, 768, '', 'gb2_laptop_title.png', false);

  // 2. Laptop Game Screen (1366x768)
  await captureScreen(1366, 768, `
    await new Promise(res => {
      const t = setInterval(() => {
        if (window.gatebreaker) {
          clearInterval(t);
          window.gatebreaker.resetGame();
          res();
        }
      }, 30);
    });
  `, 'gb2_laptop_game.png', false);

  // 3. Laptop Level Complete (1366x768)
  await captureScreen(1366, 768, `
    await new Promise(res => {
      const t = setInterval(() => {
        if (window.gatebreaker) {
          clearInterval(t);
          window.gatebreaker.resetGame();
          const g = window.gatebreaker.getState();
          g.hero.hasKey = true;
          g.gate.unlocked = true;
          g.levelComplete = true;
          g.time = 36;
          document.getElementById('screen-complete').hidden = false;
          document.getElementById('completeTime').textContent = '00:36';
          res();
        }
      }, 30);
    });
  `, 'gb2_laptop_complete.png', false);

  // 4. Phone Landscape Game (844x390)
  await captureScreen(844, 390, `
    document.body.classList.add('touch-device');
    await new Promise(res => {
      const t = setInterval(() => {
        if (window.gatebreaker) {
          clearInterval(t);
          window.gatebreaker.resetGame();
          res();
        }
      }, 30);
    });
  `, 'gb2_phone_landscape_game.png', true);

  // 5. Phone Portrait Game (390x844)
  await captureScreen(390, 844, `
    document.body.classList.add('touch-device');
    await new Promise(res => {
      const t = setInterval(() => {
        if (window.gatebreaker) {
          clearInterval(t);
          window.gatebreaker.resetGame();
          res();
        }
      }, 30);
    });
  `, 'gb2_phone_portrait_game.png', true);

  console.log('All Gatebreaker v2 screenshots captured successfully!');
}

run();
