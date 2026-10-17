/**
 * Gatebreaker — save data (localStorage, always wrapped in try/catch).
 */
const KEY = 'gatebreaker.v2.save';

const defaults = () => ({ best: {}, settings: { sfx: 0.8, music: 0.5, shake: true } });

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    return Object.assign(defaults(), JSON.parse(raw));
  } catch (_) {
    return defaults();
  }
}

export function writeSave(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (_) { /* storage unavailable */ }
}

export function recordResult(levelId, time, coins) {
  const data = loadSave();
  const prev = data.best[levelId];
  const isBest = !prev || time < prev.time;
  if (isBest) data.best[levelId] = { time, coins: Math.max(coins, prev ? prev.coins : 0) };
  writeSave(data);
  return { isBest, previous: prev };
}
