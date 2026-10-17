/**
 * Gatebreaker — DOM UI: HUD, toasts, screens, stage scaling.
 */
import { VIEW_W, VIEW_H } from './constants.js';

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
  for (const el of document.querySelectorAll('.screen')) el.hidden = el.id !== `screen-${id}`;
}
export function hideScreens() { showScreen('none'); }

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
  const rating = stats.time <= stats.target ? 3 : stats.time <= stats.target * 1.5 ? 2 : 1;
  $('completeStars').innerHTML = [1, 2, 3].map(i => (i <= rating ? '★' : '<span class="off">★</span>')).join('');
  $('completeStats').innerHTML =
    `Time <b>${fmtTime(stats.time)}</b> <small>(target ${fmtTime(stats.target)})</small><br>` +
    `Coins <b>${stats.coins}</b> / ${stats.coinsTotal}`;
  setTimeout(() => showScreen('complete'), 500);
  return rating;
}

export function setFps(text, visible) {
  const el = $('fps');
  el.hidden = !visible;
  if (visible) el.textContent = text;
}
