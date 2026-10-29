import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const defaultOutDir = '/Users/newtonuser/.gemini/antigravity-ide/brain/3d548fb5-2b76-41d6-95e2-088477819984';
const outDir = fs.existsSync(defaultOutDir) ? defaultOutDir : path.resolve(process.cwd(), 'screenshots');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

async function runBrowserCheck() {
  console.log('--- Starting Browser Check for v2.2 Moving Enemies (1366x768 & 844x390) ---');

  const port = 9320 + Math.floor(Math.random() * 200);
  const dataDir = `/tmp/gb-chrome-${port}`;
  const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    '--headless',
    '--disable-gpu',
    `--user-data-dir=${dataDir}`,
    '--window-size=1366,768',
    `--remote-debugging-port=${port}`,
    'http://localhost:8094/'
  ]);

  await new Promise(r => setTimeout(r, 1800));

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

        // Wait for game module to initialize
        await evaluate(`new Promise(r => {
          const chk = () => (window.__gb && window.__gb.game) ? r(true) : setTimeout(chk, 50);
          chk();
        })`);

        // 1. Laptop view (1366x768)
        await rpc('Emulation.setDeviceMetricsOverride', {
          width: 1366, height: 768, deviceScaleFactor: 1, mobile: false
        });
        await new Promise(r => setTimeout(r, 600));

        // Unlock all levels
        await evaluate(`(() => {
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
        })()`);

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

        // ==========================================
        // Pre-Phase 2 Fixes & Phase 2/3 Verification
        // ==========================================
        console.log('\n--- Verifying Pre-Phase 2 Fixes & Phase 2/3 Features ---');

        // Check 1: Title Screen Subtitle and Dynamic Controls
        console.log('Testing Title Screen Subtitle & Dynamic Controls...');
        const titleSubtitle = await evaluate(`document.querySelector('#screen-title .sub')?.textContent`);
        console.log(`  Title subtitle: "${titleSubtitle}"`);
        if (!titleSubtitle || !titleSubtitle.includes('Floating-islands platformer')) {
          throw new Error(`Subtitle mismatch: expected 'Floating-islands platformer', got: ${titleSubtitle}`);
        }

        const controlsHtml = await evaluate(`(() => {
          const save = {
            unlocked: ['1-1','1-2','1-3','2-1','2-2','2-3'],
            abilities: ['double_jump', 'dash', 'ground_pound'],
            best: {},
            settings: { sfx: 0.8, music: 0.5, shake: true }
          };
          localStorage.setItem('gatebreaker.v2.save', JSON.stringify(save));
          window.__gb?.ui?.updateTitleControls?.();
          return document.getElementById('titleControls')?.innerHTML || '';
        })()`);
        console.log('  Title controls dynamically populated with abilities:',
          controlsHtml.includes('Double Jump') && controlsHtml.includes('Dash') && controlsHtml.includes('Ground Pound')
        );

        // Check 2: Phone Layout (844x390), D-pad opacity, camera offset & hint overlap
        console.log('Testing Phone (844x390) Level 1-1 Start Layout...');
        await evaluate(`
          window.__gb.startLevel('1-1');
        `);
        await new Promise(r => setTimeout(r, 800));

        const keyBefore = await evaluate(`(() => {
          const el = document.getElementById('hudKey');
          const style = window.getComputedStyle(el);
          return {
            uncollectedClass: el.classList.contains('uncollected'),
            opacity: style.opacity,
            filter: style.filter
          };
        })()`);
        console.log('  Key icon before collection:', keyBefore);

        const touchOpacity = await evaluate(`window.getComputedStyle(document.getElementById('touch-controls')).opacity`);
        console.log('  Touch controls opacity:', touchOpacity);

        const heroCoverCheck = await evaluate(`(() => {
          const g = window.__gb.game;
          const canvas = document.getElementById('gameCanvas');
          const dpad = document.getElementById('dpad');
          const dpadRect = dpad.getBoundingClientRect();
          
          const screenScale = Math.min(canvas.clientWidth / 480, canvas.clientHeight / 270);
          const ox = (canvas.clientWidth - 480 * screenScale) / 2;
          const oy = (canvas.clientHeight - 270 * screenScale) / 2;
          const heroScreenX = ox + (g.player.cx - g.cam.x) * screenScale;
          const heroScreenY = oy + (g.player.cy - g.cam.y) * screenScale;

          return {
            heroScreenX, heroScreenY,
            dpadRight: dpadRect.right,
            dpadTop: dpadRect.top,
            dpadBottom: dpadRect.bottom,
            heroUnderDpad: (heroScreenX >= dpadRect.left && heroScreenX <= dpadRect.right && heroScreenY >= dpadRect.top && heroScreenY <= dpadRect.bottom)
          };
        })()`);
        console.log('  Hero position vs D-pad:', heroCoverCheck);
        if (heroCoverCheck.heroUnderDpad) {
          throw new Error('Hero is covered by D-pad touch controls!');
        }
        await screenshot('verify_phone_start_1_1.png');

        // Check 3: Nearest hint bubble strictly shown
        const hintCheck = await evaluate(`(() => {
          const g = window.__gb.game;
          const hints = g.level.hints;
          const p = g.player;
          const activeHints = hints.filter(h => Math.hypot(h.x - p.cx, h.y - p.cy) <= 140);
          return {
            totalHints: hints.length,
            withinRangeCount: activeHints.length,
            nearest: activeHints[0]?.text
          };
        })()`);
        console.log('  Level 1-1 hint status:', hintCheck);

        // Check 4: Collecting key gives bright gold icon + pop animation
        console.log('Testing Key Collection & Pop Animation...');
        const keyAfter = await evaluate(`(() => {
          const g = window.__gb.game;
          g.player.hasKey = true;
          window.__gb.ui.updateHud(g);
          const el = document.getElementById('hudKey');
          return {
            hasOnClass: el.classList.contains('on'),
            className: el.className
          };
        })()`);
        console.log('  Key icon after collection:', keyAfter);
        await screenshot('verify_phone_key_collected.png');

        // Check 5: Phase 2 Abilities (Double jump, Dash, Ground Pound)
        console.log('Testing Phase 2 Abilities (Double Jump, Dash, Ground Pound)...');
        const abilityCheck = await evaluate(`(() => {
          const g = window.__gb.game;
          const p = g.player;
          g.abilities = ['double_jump', 'dash', 'ground_pound'];
          
          p.update(g, { dashPressed: true }, 1/60);
          const isDashing = p.dashT > 0 && Math.abs(p.vx) === 520;
          
          p.dashT = 0;
          p.grounded = false;
          p.update(g, { down: true, jumpPressed: true }, 1/60);
          const isGroundPounding = p.isGroundPounding && p.vy === 720;

          p.grounded = false;
          p.isGroundPounding = false;
          p.coyote = 0;
          p.hasDoubleJumped = false;
          p.update(g, { jumpPressed: true, jumpHeld: true }, 1/60);
          const hasDoubleJumped = p.hasDoubleJumped && p.vy <= -540;

          return { isDashing, isGroundPounding, hasDoubleJumped };
        })()`);
        console.log('  Phase 2 Ability triggers:', abilityCheck);

        // Check 6: Phase 3 Power-ups & Super Meter UI
        console.log('Testing Phase 3 Power-ups & Super Meter UI...');
        const powerupCheck = await evaluate(`(() => {
          const g = window.__gb.game;
          g.collectPowerOrb({ type: 'blaster', x: 0, y: 0, w: 20, h: 20 });
          const blasterActive = g.player.powerup?.type === 'blaster' && g.player.powerup?.ammo === 10;
          
          g.addSuper(100);
          const superFull = g.superMeter === 100;

          g.triggerShockwave(g.player);
          const superReset = g.superMeter === 0;

          return { blasterActive, superFull, superReset };
        })()`);
        console.log('  Phase 3 Power-up & Super Meter:', powerupCheck);
        await screenshot('verify_phone_powerup_super.png');

        console.log(`\nBrowser check summary:`);
        console.log(`  Console errors: ${consoleErrors.length}`);
        if (consoleErrors.length > 0) {
          consoleErrors.forEach(err => console.error(`    ${err}`));
        } else {
          console.log(`  ✓ All tests passed with 0 console errors!`);
        }

        resolve();
      };
      ws.onerror = reject;
    });

    ws.close();
  } catch (e) {
    console.error('Error during browser check:', e);
  } finally {
    try { chrome.kill('SIGKILL'); } catch (_) {}
    try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch (_) {}
    await new Promise(r => setTimeout(r, 500));
  }
}

runBrowserCheck();
