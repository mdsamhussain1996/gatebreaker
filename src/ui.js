/**
 * Gatebreaker — DOM UI: HUD, toasts, screens, stage scaling, and World Map.
 */
import { VIEW_W, VIEW_H } from './constants.js';
import { loadSave, getTotalStars, isLevelUnlocked } from './save.js';
import { LEVELS } from './levels.js';

const $ = id => document.getElementById(id);
let toastTimer = 0;

export function fitStage() {
  const stage = $('stage');
  const s = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
  stage.style.width = `${Math.floor(VIEW_W * s)}px`;
  stage.style.height = `${Math.floor(VIEW_H * s)}px`;
  document.documentElement.style.setProperty('--s', s.toFixed(4));
  return s;
}

export function toast(text, ms = 2200) {
  const el = $('toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

export function showScreen(id) {
  for (const el of document.querySelectorAll('.screen')) {
    el.hidden = el.id !== `screen-${id}`;
  }
}

export function hideScreens() {
  showScreen('none');
}

export function setPlaying(on) {
  $('hud').hidden = !on;
  $('touch-controls').classList.toggle('active', on);
}

const fmtTime = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
let lastHud = '';

export function updateHud(game) {
  const p = game.player;
  const sig = `${p.hearts}|${p.lives}|${game.coinCount}|${p.hasKey}|${Math.floor(game.time)}`;
  if (sig === lastHud) return;
  lastHud = sig;
  $('hudLives').textContent = game.infiniteLives ? '∞' : p.lives;
  $('hudHearts').innerHTML = Array.from({ length: 3 }, (_, i) =>
    i < p.hearts ? '♥' : '<span class="lost">♥</span>').join('');
  $('hudCoins').textContent = game.coinCount;
  $('hudKey').classList.toggle('on', p.hasKey);
  $('hudTime').textContent = fmtTime(game.time);
}

export function showComplete(stats) {
  const starCount = stats.stars || 0;
  $('completeStars').innerHTML = [1, 2, 3].map(i => (i <= starCount ? '★' : '<span class="off">★</span>')).join('');
  $('completeStats').innerHTML =
    `Level <b>${stats.levelId || '1-1'}</b> — ${stats.name || ''}<br>` +
    `Time <b>${fmtTime(stats.time)}</b> <small>(target ${fmtTime(stats.target)})</small><br>` +
    `Coins <b>${stats.coins}</b> / ${stats.coinsTotal}<br>` +
    `Stars Collected: <b>${starCount} / 3</b>`;
  setTimeout(() => showScreen('complete'), 500);
}

export function renderWorldMap(worldNum = 1, onSelectLevel) {
  const save = loadSave();
  const totalStars = getTotalStars();
  const worldLevels = LEVELS.filter(l => (l.world || 1) === worldNum);

  const worldNames = {
    1: 'World 1: Green Hills',
    2: 'World 2: Autumn Forest',
    3: 'World 3: Sandy Desert Ruins',
    4: 'World 4: Frozen Peaks',
    5: 'World 5: Crystal Caves',
    6: 'World 6: Volcano Sky Fortress'
  };

  $('mapWorldName').textContent = worldNames[worldNum] || `World ${worldNum}`;
  $('mapStarsTotal').textContent = `★ ${totalStars} / 54 Stars`;

  const container = $('mapNodes');
  container.innerHTML = '';

  worldLevels.forEach(lvl => {
    const isUnlocked = isLevelUnlocked(lvl.id);
    const stats = save.best[lvl.id] || {};
    const stars = stats.stars || 0;
    const isBoss = lvl.id.endsWith('-3');

    const node = document.createElement('div');
    node.className = `map-node ${isUnlocked ? '' : 'locked'} ${isBoss ? 'boss-node' : ''}`;

    const starIcons = [1, 2, 3].map(i => i <= stars ? '★' : '☆').join('');
    const timeStr = stats.time ? `⏱ ${fmtTime(stats.time)}` : '⏱ --:--';

    node.innerHTML = `
      <div class="node-id">${lvl.id}${isBoss ? ' 👑' : ''}</div>
      <div class="node-name">${lvl.name}</div>
      <div class="node-stars">${isUnlocked ? starIcons : '🔒'}</div>
      <div class="node-time">${isUnlocked ? timeStr : 'Locked'}</div>
    `;

    if (isUnlocked) {
      node.addEventListener('click', () => {
        if (onSelectLevel) onSelectLevel(lvl);
      });
    }

    container.appendChild(node);
  });
}

export function setFps(text, visible) {
  const el = $('fps');
  el.hidden = !visible;
  if (visible) el.textContent = text;
}
