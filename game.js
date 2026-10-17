/**
 * Gatebreaker v2 — Side-View Puzzle-Platformer (Jungle Ruins)
 * Main Game Loop, Simulation Controller, and Screen Management.
 */

import { VIEW_W, VIEW_H, CAM_DEADZONE_X, CAM_LOOKAHEAD, CAM_LERP } from './src/constants.js';
import { InputManager } from './src/input.js';
import { updateHeroPhysics } from './src/physics.js';
import { updateKnifeCombat, updateBeetlebots, updateKeyAndGate } from './src/entities.js';
import { GameRenderer } from './src/renderer.js';
import { LEVEL_1_MAP, createLevelState } from './src/levels.js';
import { initAudio } from './src/audio.js';

const FIXED_DT = 1 / 60;
let gameState = null;
let renderer = null;
let input = null;
let isPaused = false;

export function init() {
  const canvas = document.getElementById('gameCanvas');
  if (!canvas) return;

  canvas.width = VIEW_W;
  canvas.height = VIEW_H;

  renderer = new GameRenderer(canvas);
  input = new InputManager();
  input.setup(canvas);

  setupUI();
  resetGame();

  let lastTime = performance.now();
  let accumulator = 0;

  function loop(now) {
    requestAnimationFrame(loop);
    const frameTime = Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;

    input.update();

    if (input.pausePressed) {
      togglePause();
    }

    if (gameState && !isPaused) {
      accumulator += frameTime;
      while (accumulator >= FIXED_DT) {
        stepSimulation(gameState, input, FIXED_DT);
        accumulator -= FIXED_DT;
      }

      renderer.render(gameState, frameTime);
      updateHUD(gameState);

      if (gameState.levelComplete && document.getElementById('screen-complete').hidden) {
        showCompleteScreen();
      }
      if (gameState.gameOver && document.getElementById('screen-gameover').hidden) {
        showGameOverScreen();
      }
    }
  }

  requestAnimationFrame(loop);
}

export function resetGame() {
  gameState = createLevelState(LEVEL_1_MAP);
  window.activeGame = gameState;
  isPaused = false;

  document.getElementById('screen-title').hidden = true;
  document.getElementById('screen-pause').hidden = true;
  document.getElementById('screen-complete').hidden = true;
  document.getElementById('screen-gameover').hidden = true;
}

export function stepSimulation(state, inputState, dt) {
  if (state.levelComplete || state.gameOver) return;

  state.time += dt;

  // 1. Hero Physics & Movement
  updateHeroPhysics(state.hero, inputState, state.tiles, dt);

  // 2. Knife Attacks & Pogo
  updateKnifeCombat(state.hero, inputState, state);

  // 3. Enemies AI (Beetlebots)
  updateBeetlebots(state, dt);

  // 4. Key & Gate Interactions
  updateKeyAndGate(state, dt);

  // 5. Update Particles
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) state.particles.splice(i, 1);
  }

  // 6. Camera Follow with Dead-Zone & Look-Ahead
  const hero = state.hero;
  const targetCamX = hero.x + hero.w / 2 - VIEW_W / 2 + hero.facing * CAM_LOOKAHEAD;
  const targetCamY = hero.y + hero.h / 2 - VIEW_H / 2;

  // Smooth lerp
  state.camera.x += (targetCamX - state.camera.x) * Math.min(1, dt * CAM_LERP);
  state.camera.y += (targetCamY - state.camera.y) * Math.min(1, dt * CAM_LERP);

  // Clamp camera to level bounds
  const maxCamX = Math.max(0, state.pixelW - VIEW_W);
  const maxCamY = Math.max(0, state.pixelH - VIEW_H);
  state.camera.x = Math.max(0, Math.min(state.camera.x, maxCamX));
  state.camera.y = Math.max(0, Math.min(state.camera.y, maxCamY));
}

function updateHUD(state) {
  const livesEl = document.getElementById('hudLives');
  const heartsEl = document.getElementById('hudHearts');
  const keyEl = document.getElementById('hudKeyStatus');
  const timeEl = document.getElementById('hudTimer');

  if (livesEl) livesEl.textContent = `×0${state.hero.lives}`;
  if (heartsEl) {
    let heartsStr = '';
    for (let i = 0; i < state.hero.maxHearts; i++) {
      heartsStr += i < state.hero.hearts ? '❤️' : '🖤';
    }
    heartsEl.textContent = heartsStr;
  }
  if (keyEl) {
    if (state.hero.hasKey) {
      keyEl.classList.add('active');
      keyEl.textContent = '🗝️ KEY HELD';
    } else {
      keyEl.classList.remove('active');
      keyEl.textContent = '🗝️ FIND KEY';
    }
  }
  if (timeEl) {
    const mins = Math.floor(state.time / 60);
    const secs = Math.floor(state.time % 60);
    timeEl.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}

function togglePause() {
  if (!gameState || gameState.levelComplete || gameState.gameOver) return;
  isPaused = !isPaused;
  const pauseEl = document.getElementById('screen-pause');
  if (pauseEl) pauseEl.hidden = !isPaused;
}

function showCompleteScreen() {
  const el = document.getElementById('screen-complete');
  if (el) {
    const mins = Math.floor(gameState.time / 60);
    const secs = Math.floor(gameState.time % 60);
    document.getElementById('completeTime').textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    el.hidden = false;
  }
}

function showGameOverScreen() {
  const el = document.getElementById('screen-gameover');
  if (el) el.hidden = false;
}

function setupUI() {
  document.getElementById('btnStartGame')?.addEventListener('click', () => {
    initAudio();
    resetGame();
  });
  document.getElementById('btnPause')?.addEventListener('click', togglePause);
  document.getElementById('btnResume')?.addEventListener('click', togglePause);
  document.getElementById('btnRestartLevel')?.addEventListener('click', resetGame);
  document.getElementById('btnQuitTitle')?.addEventListener('click', () => {
    isPaused = false;
    document.getElementById('screen-pause').hidden = true;
    document.getElementById('screen-title').hidden = false;
  });
  document.getElementById('btnPlayAgain')?.addEventListener('click', resetGame);
  document.getElementById('btnRetry')?.addEventListener('click', resetGame);
}

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', init);
  window.gatebreaker = {
    getState: () => gameState,
    resetGame,
    togglePause,
    stepSimulation
  };
}
