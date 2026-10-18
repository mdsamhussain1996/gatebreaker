/**
 * Gatebreaker — DOM UI: HUD, toasts, screens, stage scaling, and World Map.
 */
import { VIEW_W, VIEW_H } from './constants.js';
import { loadSave, getTotalStars, isLevelUnlocked, getUnlockedAbilities } from './save.js';
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
  if (id === 'title') {
    updateTitleControls();
  }
}

export function updateTitleControls() {
  const el = $('titleControls');
  if (!el) return;
  const abilities = getUnlockedAbilities();
  let html = `
    <li><b>Move</b> ← → / A D</li>
    <li><b>Jump</b> Space / Z / K <i>(hold = higher)</i></li>
    <li><b>Climb</b> ↑ ↓ / W S on ladders &amp; ropes</li>
    <li><b>Drop through</b> ↓ + Jump on planks &amp; bridges</li>
    <li><b>Knife</b> X / J <i>(↓ + X in air = pogo bounce)</i></li>
  `;
  if (abilities.includes('double_jump')) {
    html += `<li><b>Double Jump</b> Space in mid-air ✨</li>`;
  }
  if (abilities.includes('dash')) {
    html += `<li><b>Dash</b> Shift / Touch DASH (break cracked walls) ⚡</li>`;
  }
  if (abilities.includes('ground_pound')) {
    html += `<li><b>Ground Pound</b> ↓ + Jump in air (slam &amp; stun) 💥</li>`;
  }
  if (abilities.includes('wall_jump')) {
    html += `<li><b>Wall Jump</b> slide wall &amp; jump 🧗</li>`;
  }
  if (abilities.includes('glide')) {
    html += `<li><b>Glide</b> hold Jump while falling 🪂</li>`;
  }
  html += `<li><b>Goal</b> grab the golden key, unlock the exit gate</li>`;
  el.innerHTML = html;
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
  const sig = `${p.hearts}|${p.lives}|${game.coinCount}|${p.hasKey}|${Math.floor(game.time)}|${Math.floor(game.superMeter)}|${p.powerup?.type}|${p.powerup?.ammo}|${Math.floor(p.powerup?.duration || 0)}`;
  if (sig === lastHud) return;
  lastHud = sig;
  $('hudLives').textContent = game.infiniteLives ? '∞' : p.lives;
  $('hudHearts').innerHTML = Array.from({ length: 3 }, (_, i) =>
    i < p.hearts ? '♥' : '<span class="lost">♥</span>').join('');
  $('hudCoins').textContent = game.coinCount;
  $('hudKey').classList.toggle('on', p.hasKey);
  $('hudTime').textContent = fmtTime(game.time);

  // Super meter
  const superFill = Math.min(100, Math.max(0, game.superMeter || 0));
  const fillEl = $('hudSuperFill');
  if (fillEl) fillEl.style.width = superFill + '%';
  const iconEl = $('hudSuperIcon');
  if (iconEl) iconEl.classList.toggle('ready', superFill >= 100);

  // Active Power-up slot
  const puPanel = $('hudPowerupPanel');
  if (puPanel) {
    if (p.powerup) {
      puPanel.style.display = 'flex';
      $('hudPowerupIcon').textContent = p.powerup.icon || '⭐';
      const ammoEl = $('hudPowerupAmmo');
      if (ammoEl) {
        if (p.powerup.type === 'blaster') {
          ammoEl.style.display = 'inline';
          ammoEl.textContent = `×${p.powerup.ammo}`;
        } else {
          ammoEl.style.display = 'none';
        }
      }
      const ring = $('hudPowerupRing');
      if (ring) {
        ring.classList.toggle('powerup-flash', typeof p.powerup.duration === 'number' && p.powerup.duration <= 2.2);
      }
    } else {
      puPanel.style.display = 'none';
    }
  }

  // Abilities slots
  const jEl = $('hudAbilJump');
  if (jEl) jEl.classList.toggle('on', game.hasAbility('double_jump'));
  const dEl = $('hudAbilDash');
  if (dEl) dEl.classList.toggle('on', game.hasAbility('dash'));
  const pEl = $('hudAbilPound');
  if (pEl) pEl.classList.toggle('on', game.hasAbility('ground_pound'));

  // Touch controls dynamic button visibility
  const btnDash = $('btnTouchDash');
  if (btnDash) btnDash.style.display = game.hasAbility('dash') ? 'flex' : 'none';
  const btnSuper = $('btnTouchSuper');
  if (btnSuper) btnSuper.style.display = (game.superMeter >= 100) ? 'flex' : 'none';
  const btnBlaster = $('btnTouchBlaster');
  if (btnBlaster) btnBlaster.style.display = (p.powerup?.type === 'blaster') ? 'flex' : 'none';
}

export function showPowerUnlocked(abilityKey, onContinue) {
  const info = {
    double_jump: {
      icon: '✨',
      title: 'Double Jump',
      desc: 'Jump a second time in mid-air with a cloud-puff ring! Reach higher ledges and cross wider gaps.',
      key: 'Space / Z / K in mid-air',
      touch: 'Tap JUMP button while airborne'
    },
    dash: {
      icon: '⚡',
      title: 'Dash',
      desc: 'Burst forward at extreme speed with invulnerability frames. Smashes cracked walls and wooden crates!',
      key: 'Shift (horizontal burst)',
      touch: 'Tap DASH button'
    },
    ground_pound: {
      icon: '💥',
      title: 'Ground Pound',
      desc: 'Halt and slam straight down! Smashes cracked floors and crates below, and stuns nearby enemies with a shockwave.',
      key: 'Down + Jump in mid-air',
      touch: 'Down + JUMP button while airborne'
    }
  }[abilityKey] || {
    icon: '⭐',
    title: 'Super Power',
    desc: 'A new ancient power has awakened within Rook!',
    key: 'Check controls in pause menu',
    touch: 'Touch controls updated'
  };

  $('powerShowcaseIcon').textContent = info.icon;
  $('powerShowcaseTitle').textContent = info.title;
  $('powerShowcaseDesc').textContent = info.desc;
  $('powerKeyHint').textContent = info.key;
  $('powerTouchHint').textContent = info.touch;

  const btn = $('btnPowerContinue');
  btn.onclick = () => {
    btn.onclick = null;
    hideScreens();
    if (onContinue) onContinue();
  };

  showScreen('power');
}

export function updatePausePowers() {
  const container = $('pausePowersList');
  if (!container) return;
  const abilities = getUnlockedAbilities();
  let html = '<b>Powers &amp; Abilities:</b>';
  html += `<div>• <b>Knife / Pogo</b>: X / J (↓+X in air = pogo bounce)</div>`;
  if (abilities.includes('double_jump')) {
    html += `<div>• <b>Double Jump</b>: Space in air ✨</div>`;
  }
  if (abilities.includes('dash')) {
    html += `<div>• <b>Dash</b>: Shift / DASH button ⚡</div>`;
  }
  if (abilities.includes('ground_pound')) {
    html += `<div>• <b>Ground Pound</b>: ↓ + Jump in air 💥</div>`;
  }
  html += `<div>• <b>Shockwave Burst</b>: Q / ⚡ button (when Super meter is full)</div>`;
  container.innerHTML = html;
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
