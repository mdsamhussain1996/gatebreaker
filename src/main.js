/**
 * Gatebreaker — entry point: fixed-timestep loop, wiring, and progression.
 */
import { DT } from './constants.js';
import { LEVELS, getLevel } from './levels.js';
import { Game } from './game.js';
import { Renderer } from './render.js';
import { InputManager } from './input.js';
import { playSound, initAudio } from './audio.js';
import { recordResult, loadSave, getUnlockedAbilities } from './save.js';
import * as ui from './ui.js';

const canvas = document.getElementById('gameCanvas');
const renderer = new Renderer(canvas);
const input = new InputManager();
input.setup();

const debug = new URLSearchParams(location.search).has('debug');
let mode = 'title';          // title | playing | paused | complete | gameover | map
let acc = 0, last = performance.now();
let frames = 0, fpsClock = 0, fps = 0, worstFrame = 0;
let currentWorld = 1;
let currentLevelDef = LEVELS[0];

const game = new Game({
  sfx: playSound,
  toast: ui.toast,
  onComplete: stats => {
    mode = 'complete';
    const unlockedBefore = getUnlockedAbilities();
    recordResult(stats.levelId, stats.time, stats.coins, stats.stars);
    const unlockedAfter = getUnlockedAbilities();
    const newlyUnlocked = unlockedAfter.find(a => !unlockedBefore.includes(a));
    if (newlyUnlocked) {
      ui.showPowerUnlocked(newlyUnlocked, () => {
        ui.showComplete(stats);
      });
    } else {
      ui.showComplete(stats);
    }
  },
  onGameOver: () => {
    mode = 'gameover';
    setTimeout(() => ui.showScreen('gameover'), 500);
  }
});

function loadLevel(defOrIndex = 0) {
  const def = typeof defOrIndex === 'number' ? LEVELS[defOrIndex] : defOrIndex;
  currentLevelDef = def;
  currentWorld = def.world || 1;
  game.load(def);
  renderer.setLevel(game.world, game.theme);
}

function startPlay(defOrIndex = 0) {
  initAudio();
  loadLevel(defOrIndex);
  mode = 'playing';
  ui.hideScreens();
  ui.setPlaying(true);
  ui.toast(`World ${currentLevelDef.world} · ${currentLevelDef.name}`, 2400);
}

function showWorldMap(w = currentWorld) {
  currentWorld = Math.max(1, Math.min(6, w));
  mode = 'map';
  ui.setPlaying(false);
  ui.renderWorldMap(currentWorld, (lvl) => {
    startPlay(lvl);
  });
  ui.showScreen('map');
}

// Test / debug hook
window.__gb = {
  game,
  input,
  renderer,
  ui,
  LEVELS,
  loadLevel,
  startPlay,
  startLevel: (idOrIndex) => {
    const def = typeof idOrIndex === 'string' ? (LEVELS.find(l => l.id === idOrIndex) || LEVELS[0]) : LEVELS[idOrIndex || 0];
    startPlay(def);
  },
  showWorldMap,
  getMode: () => mode,
  getFps: () => fps
};

function togglePause() {
  if (mode === 'playing') {
    mode = 'paused';
    ui.updatePausePowers();
    ui.showScreen('pause');
  } else if (mode === 'paused') {
    mode = 'playing';
    ui.hideScreens();
  }
}
input.onPause = togglePause;

const chkShake = document.getElementById('chkShake');
if (chkShake) {
  chkShake.addEventListener('change', () => {
    game.shakeEnabled = chkShake.checked;
  });
}

// Button bindings
const click = (id, fn) => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', fn);
};

click('btnStart', () => startPlay(LEVELS[0]));
click('btnMap', () => showWorldMap(currentWorld));
click('btnMapBack', () => { mode = 'title'; ui.showScreen('title'); });
click('btnPrevWorld', () => showWorldMap(currentWorld - 1));
click('btnNextWorld', () => showWorldMap(currentWorld + 1));
click('btnPause', togglePause);
click('btnResume', togglePause);
click('btnRestart', () => startPlay(currentLevelDef));
click('btnAgain', () => startPlay(currentLevelDef));
click('btnRetry', () => startPlay(currentLevelDef));
click('btnMapFromPause', () => showWorldMap(currentWorld));
click('btnMapFromComplete', () => showWorldMap(currentWorld));
click('btnMapFromOver', () => showWorldMap(currentWorld));

click('btnNextLevel', () => {
  const idx = LEVELS.findIndex(l => l.id === currentLevelDef.id);
  if (idx >= 0 && idx + 1 < LEVELS.length) {
    startPlay(LEVELS[idx + 1]);
  } else {
    showWorldMap(currentWorld);
  }
});

ui.fitStage();
window.addEventListener('resize', ui.fitStage);
window.addEventListener('orientationchange', () => setTimeout(ui.fitStage, 200));
document.addEventListener('visibilitychange', () => {
  if (document.hidden && mode === 'playing') togglePause();
});

// Title backdrop: show Level 1-1 behind the title card.
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

  frames++;
  fpsClock += dt;
  if (fpsClock >= 0.5) {
    fps = frames / fpsClock;
    frames = 0;
    fpsClock = 0;
    ui.setFps(`${fps.toFixed(0)} fps · worst ${(worstFrame * 1000).toFixed(0)} ms`, debug);
    worstFrame = 0;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

