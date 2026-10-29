/**
 * Gatebreaker — save & progression data (localStorage, wrapped in try/catch).
 */
const KEY = 'gatebreaker.v2.save';

const defaults = () => ({
  unlocked: ['1-1'],
  abilities: [],
  best: {}, // { '1-1': { time: 42.5, coins: 85, stars: 3 } }
  settings: { sfx: 0.8, music: 0.5, shake: true, difficulty: 'normal' }
});

let memStore = null;
function getStorage() {
  if (typeof localStorage !== 'undefined') return localStorage;
  if (!memStore) memStore = {};
  return {
    getItem(k) { return memStore[k] || null; },
    setItem(k, v) { memStore[k] = String(v); },
    removeItem(k) { delete memStore[k]; }
  };
}

export function loadSave() {
  try {
    const raw = getStorage().getItem(KEY);
    if (!raw) return defaults();
    const parsed = JSON.parse(raw);
    const def = defaults();
    return {
      unlocked: Array.isArray(parsed.unlocked) && parsed.unlocked.length ? parsed.unlocked : def.unlocked,
      abilities: Array.isArray(parsed.abilities) ? parsed.abilities : [],
      best: parsed.best || {},
      settings: Object.assign(def.settings, parsed.settings || {})
    };
  } catch (_) {
    return defaults();
  }
}

export function getDifficulty() {
  const save = loadSave();
  return save.settings.difficulty || 'normal';
}

export function setDifficulty(difficulty) {
  const save = loadSave();
  save.settings.difficulty = difficulty;
  writeSave(save);
}

export function writeSave(data) {
  try {
    getStorage().setItem(KEY, JSON.stringify(data));
  } catch (_) {
    /* storage unavailable in private mode or quota exceeded */
  }
}

export function isLevelUnlocked(levelId) {
  const data = loadSave();
  return data.unlocked.includes(levelId);
}

export function getTotalStars() {
  const data = loadSave();
  let total = 0;
  for (const k in data.best) {
    if (data.best[k] && data.best[k].stars) {
      total += data.best[k].stars;
    }
  }
  return total;
}

export function recordResult(levelId, time, coins, stars = 0) {
  const data = loadSave();
  const prev = data.best[levelId];
  const newStars = Math.max(stars, prev ? (prev.stars || 0) : 0);
  const bestTime = prev && prev.time ? Math.min(time, prev.time) : time;
  const bestCoins = Math.max(coins, prev ? (prev.coins || 0) : 0);

  data.best[levelId] = { time: bestTime, coins: bestCoins, stars: newStars };

  // Calculate next level to unlock (e.g. 1-1 -> 1-2, 1-2 -> 1-3)
  const [wStr, lStr] = String(levelId).split('-');
  const w = parseInt(wStr, 10);
  const l = parseInt(lStr, 10);
  let nextId = null;
  if (!isNaN(w) && !isNaN(l)) {
    if (l < 3) nextId = `${w}-${l + 1}`;
    else nextId = `${w + 1}-1`;
  }
  if (nextId && !data.unlocked.includes(nextId)) {
    data.unlocked.push(nextId);
  }

  writeSave(data);
  return { previous: prev, isUnlockedNext: nextId };
}

export function getUnlockedAbilities() {
  const save = loadSave();
  const abilities = Array.isArray(save.abilities) ? [...save.abilities] : [];
  if (save.best['1-3'] && !abilities.includes('double_jump')) abilities.push('double_jump');
  if (save.best['2-3'] && !abilities.includes('dash')) abilities.push('dash');
  if (save.best['3-3'] && !abilities.includes('ground_pound')) abilities.push('ground_pound');
  if (save.best['4-3'] && !abilities.includes('wall_jump')) abilities.push('wall_jump');
  if (save.best['5-3'] && !abilities.includes('glide')) abilities.push('glide');
  return abilities;
}

export function hasAbility(name) {
  return getUnlockedAbilities().includes(name);
}

