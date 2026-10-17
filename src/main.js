/**
 * Gatebreaker — entry point: fixed-timestep loop, wiring.
 */
import { DT } from './constants.js';
import { LEVELS } from './levels.js';
import { Game } from './game.js';
import { Renderer } from './render.js';
import { InputManager } from './input.js';
import { playSound, initAudio } from './audio.js';
import { recordResult } from './save.js';
import * as ui from './ui.js';

const canvas = document.getElementById('gameCanvas');
const renderer = new Renderer(canvas);
const input = new InputManager();
input.setup();

const debug = new URLSearchParams(location.search).has('debug');
let mode = 'title';          // title | playing | paused | complete | gameover
let acc = 0, last = performance.now();
let frames = 0, fpsClock = 0, fps = 0, worstFrame = 0;

const game = new Game({
  sfx: playSound,
  toast: ui.toast,
  onComplete: stats => {
    mode = 'complete';
    recordResult(game.def.id, stats.time, stats.coins);
    ui.showComplete(stats);
  },
  onGameOver: () => {
    mode = 'gameover';
    setTimeout(() => ui.showScreen('gameover'), 500);
  }
});

function loadLevel(index = 0) {
  game.load(LEVELS[index]);
  renderer.setLevel(game.world);
}

function startPlay() {
  initAudio();
  loadLevel(0);
  mode = 'playing';
  ui.hideScreens();
  ui.setPlaying(true);
  ui.toast('Find the key, reach the gate!', 2600);
}

function togglePause() {
  if (mode === 'playing') { mode = 'paused'; ui.showScreen('pause'); }
  else if (mode === 'paused') { mode = 'playing'; ui.hideScreens(); }
}
input.onPause = togglePause;

const click = (id, fn) => document.getElementById(id).addEventListener('click', fn);
click('btnStart', startPlay);
click('btnPause', togglePause);
click('btnResume', togglePause);
click('btnRestart', startPlay);
click('btnAgain', startPlay);
click('btnRetry', startPlay);

ui.fitStage();
window.addEventListener('resize', ui.fitStage);
window.addEventListener('orientationchange', () => setTimeout(ui.fitStage, 200));
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'playing') togglePause(); });

// Title backdrop: show the level behind the title card.
loadLevel(0);
ui.showScreen('title');
ui.setPlaying(false);

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  worstFrame = Math.max(worstFrame, dt);

  if (mode === 'playing') {
    acc += dt;
    while (acc >= DT) {
      input.poll();
      game.update(input, DT);
      acc -= DT;
    }
    ui.updateHud(game);
  } else {
    acc = 0;
    if (mode === 'complete' || mode === 'gameover') game.updateEffects(dt);
  }

  renderer.draw(game, dt);

  frames++; fpsClock += dt;
  if (fpsClock >= 0.5) { fps = frames / fpsClock; frames = 0; fpsClock = 0; ui.setFps(`${fps.toFixed(0)} fps · worst ${(worstFrame * 1000).toFixed(0)} ms`, debug); worstFrame = 0; }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Test / debug hook
window.__gb = { game, input, renderer, startPlay, getMode: () => mode, getFps: () => fps };
