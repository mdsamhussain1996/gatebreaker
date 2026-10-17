/**
 * Gatebreaker — Top-Down Action-Adventure
 * Phase 1: Core Engine, Tilemap Loader, Hero Movement & Axis-Separated Collision,
 * Knife Combat, Slimes with Hop AI, Items, Key & Gate, Touch Controls & WebAudio.
 */

(() => {
'use strict';

/* ---------------- 1. Config & Constants ---------------- */
const TS = 32; // Tile size in pixels

const HERO_SPEED = 150; // px/s
const HERO_RADIUS = 11; // px
const HERO_MAX_HP = 100;
const HERO_INVULN_DUR = 0.7; // s

const KNIFE_REACH = 34; // px beyond hero radius (total radius = 45px)
const KNIFE_ARC = (120 * Math.PI) / 180; // 120 degree cone in radians
const KNIFE_DURATION = 0.18; // s
const KNIFE_COOLDOWN = 0.32; // s
const KNIFE_DAMAGE = 34;
const KNIFE_KNOCKBACK = 180; // px/s impulse

const SLIME_HP = 50;
const SLIME_SPEED = 58; // px/s
const SLIME_RADIUS = 12; // px
const SLIME_DAMAGE = 12;

const ITEM_MAGNET_DIST = 24; // px
const ITEM_MAGNET_SPEED = 180; // px/s

const FIXED_DT = 1 / 60; // 60 FPS fixed simulation step

/* ---------------- 2. Level Definitions ---------------- */
const LEVEL_1_ASCII = [
  '##############################',
  '#P...c.....#........c........#',
  '#..........#.................#',
  '#...c......#....s...######...#',
  '#..........t........#....#...#',
  '######..####........#.K..#...#',
  '#..........#........#....#.s.#',
  '#...s......#........##..##...#',
  '#.......c..#.................#',
  '#..........#....c............#',
  '#....h.....####..#######.....#',
  '#...........s....#.....#..c..#',
  '#..c.............#..s..#.....G',
  '##############################'
];

const LEVELS = [
  {
    id: 1,
    name: 'The Cellar',
    hint: 'Move with WASD / Stick. Swing your knife with Space / Click.',
    map: LEVEL_1_ASCII,
    darkness: 0.45
  }
];

/* ---------------- 3. Level Parser & Tilemap ---------------- */
function parseLevel(levelDef) {
  const lines = levelDef.map;
  const h = lines.length;
  const w = lines[0].length;
  const tiles = [];
  const torches = [];
  const slimes = [];
  const items = [];
  let heroSpawn = { x: 1.5 * TS, y: 1.5 * TS };
  let gate = null;
  let keyPos = null;

  for (let y = 0; y < h; y++) {
    const row = [];
    const line = lines[y];
    for (let x = 0; x < w; x++) {
      const ch = line[x] || '#';
      const cx = (x + 0.5) * TS;
      const cy = (y + 0.5) * TS;

      // Base tile assignment
      if (ch === '#') {
        row.push('#');
      } else if (ch === 't') {
        row.push('t');
        torches.push({ x: cx, y: cy, flicker: Math.random() * 10 });
      } else if (ch === 'G') {
        row.push('G');
        gate = { x: cx, y: cy, tileX: x, tileY: y, open: false, progress: 0 };
      } else {
        // Floor tile '.' with potential entity spawn
        row.push('.');
        if (ch === 'P') {
          heroSpawn = { x: cx, y: cy };
        } else if (ch === 'K') {
          keyPos = { x: cx, y: cy };
          items.push({ type: 'key', x: cx, y: cy, radius: 10, bob: 0 });
        } else if (ch === 'c') {
          items.push({ type: 'coin', x: cx, y: cy, radius: 8, bob: Math.random() * 6 });
        } else if (ch === 'h') {
          items.push({ type: 'heart', x: cx, y: cy, radius: 8, bob: Math.random() * 6 });
        } else if (ch === 's') {
          slimes.push({
            id: Math.random().toString(36).substring(2, 9),
            x: cx,
            y: cy,
            vx: 0,
            vy: 0,
            hp: SLIME_HP,
            maxHp: SLIME_HP,
            radius: SLIME_RADIUS,
            hopTimer: Math.random() * 0.8,
            hopPhase: 0, // 0: idle/squash, 1: airborne
            facing: 1,
            flashTimer: 0,
            aggro: false,
            dead: false
          });
        }
      }
    }
    tiles.push(row);
  }

  return {
    w,
    h,
    pixelW: w * TS,
    pixelH: h * TS,
    tiles,
    torches,
    slimes,
    items,
    heroSpawn,
    gate,
    keyPos,
    totalCoins: items.filter(it => it.type === 'coin').length,
    totalSlimes: slimes.length
  };
}

function isSolidTile(tiles, tx, ty, gateOpen = false) {
  if (ty < 0 || ty >= tiles.length || tx < 0 || tx >= tiles[0].length) return true;
  const t = tiles[ty][tx];
  if (t === '#' || t === 't') return true;
  if (t === 'G' && !gateOpen) return true;
  return false;
}

function checkTileCollision(tiles, x, y, radius, gateOpen = false) {
  const minX = Math.floor((x - radius) / TS);
  const maxX = Math.floor((x + radius) / TS);
  const minY = Math.floor((y - radius) / TS);
  const maxY = Math.floor((y + radius) / TS);

  for (let ty = minY; ty <= maxY; ty++) {
    for (let tx = minX; tx <= maxX; tx++) {
      if (isSolidTile(tiles, tx, ty, gateOpen)) {
        // Nearest point on tile bounding box to circle center
        const nearestX = Math.max(tx * TS, Math.min(x, (tx + 1) * TS));
        const nearestY = Math.max(ty * TS, Math.min(y, (ty + 1) * TS));
        const dx = x - nearestX;
        const dy = y - nearestY;
        if (dx * dx + dy * dy < radius * radius) {
          return true;
        }
      }
    }
  }
  return false;
}

function resolveEntityTileCollision(entity, tiles, gateOpen = false) {
  const r = entity.radius;

  // Horizontal motion check
  const minX = Math.floor((entity.x - r) / TS);
  const maxX = Math.floor((entity.x + r) / TS);
  const minY = Math.floor((entity.y - r) / TS);
  const maxY = Math.floor((entity.y + r) / TS);

  for (let ty = minY; ty <= maxY; ty++) {
    for (let tx = minX; tx <= maxX; tx++) {
      if (isSolidTile(tiles, tx, ty, gateOpen)) {
        const boxLeft = tx * TS;
        const boxRight = (tx + 1) * TS;
        const boxTop = ty * TS;
        const boxBottom = (ty + 1) * TS;

        const nearestX = Math.max(boxLeft, Math.min(entity.x, boxRight));
        const nearestY = Math.max(boxTop, Math.min(entity.y, boxBottom));
        const dx = entity.x - nearestX;
        const dy = entity.y - nearestY;
        const distSq = dx * dx + dy * dy;

        if (distSq < r * r && distSq > 0.0001) {
          const dist = Math.sqrt(distSq);
          const overlap = r - dist;
          entity.x += (dx / dist) * overlap;
          entity.y += (dy / dist) * overlap;
        } else if (distSq <= 0.0001) {
          // Entity center directly inside wall
          entity.y += 1;
        }
      }
    }
  }
}

/* ---------------- 4. Audio Engine (Web Audio API) ---------------- */
let audioCtx = null;
let soundVolume = 0.8;
let musicVolume = 0.5;

function initAudio() {
  if (!audioCtx && typeof window !== 'undefined') {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
}

function playSound(type) {
  if (!audioCtx || audioCtx.state !== 'running') return;
  const t = audioCtx.currentTime;

  try {
    if (type === 'knifeSwish') {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(450, t);
      osc.frequency.exponentialRampToValueAtTime(140, t + 0.12);
      gain.gain.setValueAtTime(0.25 * soundVolume, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + 0.13);
    } else if (type === 'knifeHit') {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180, t);
      osc.frequency.exponentialRampToValueAtTime(60, t + 0.1);
      gain.gain.setValueAtTime(0.4 * soundVolume, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + 0.11);
    } else if (type === 'slimeHop') {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(120, t);
      osc.frequency.exponentialRampToValueAtTime(260, t + 0.08);
      gain.gain.setValueAtTime(0.12 * soundVolume, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + 0.09);
    } else if (type === 'slimeDie') {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, t);
      osc.frequency.exponentialRampToValueAtTime(70, t + 0.22);
      gain.gain.setValueAtTime(0.3 * soundVolume, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.22);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + 0.23);
    } else if (type === 'playerHurt') {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.exponentialRampToValueAtTime(80, t + 0.2);
      gain.gain.setValueAtTime(0.35 * soundVolume, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + 0.21);
    } else if (type === 'coin') {
      const osc1 = audioCtx.createOscillator();
      const osc2 = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(987, t); // B5
      osc2.frequency.setValueAtTime(1318, t + 0.06); // E6
      gain.gain.setValueAtTime(0.25 * soundVolume, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(audioCtx.destination);
      osc1.start(t);
      osc1.stop(t + 0.06);
      osc2.start(t + 0.06);
      osc2.stop(t + 0.2);
    } else if (type === 'heart') {
      const notes = [440, 554, 659]; // A major
      notes.forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t + idx * 0.05);
        gain.gain.setValueAtTime(0.2 * soundVolume, t + idx * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, t + idx * 0.05 + 0.15);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(t + idx * 0.05);
        osc.stop(t + idx * 0.05 + 0.16);
      });
    } else if (type === 'key') {
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6 fanfare
      notes.forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t + idx * 0.09);
        gain.gain.setValueAtTime(0.3 * soundVolume, t + idx * 0.09);
        gain.gain.exponentialRampToValueAtTime(0.01, t + idx * 0.09 + 0.25);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(t + idx * 0.09);
        osc.stop(t + idx * 0.09 + 0.26);
      });
    } else if (type === 'gateOpen') {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(110, t);
      osc.frequency.linearRampToValueAtTime(220, t + 0.5);
      gain.gain.setValueAtTime(0.35 * soundVolume, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.6);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + 0.61);
    } else if (type === 'win') {
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
      notes.forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t + idx * 0.08);
        gain.gain.setValueAtTime(0.28 * soundVolume, t + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.01, t + idx * 0.08 + 0.35);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(t + idx * 0.08);
        osc.stop(t + idx * 0.08 + 0.36);
      });
    }
  } catch (err) {
    // Audio synthesis failure should never crash the game
  }
}

/* ---------------- 5. Combat Math ---------------- */
function normalizeAngle(a) {
  while (a < -Math.PI) a += Math.PI * 2;
  while (a > Math.PI) a -= Math.PI * 2;
  return a;
}

function isPointInKnifeArc(heroX, heroY, heroAimAngle, targetX, targetY, targetRadius) {
  const dx = targetX - heroX;
  const dy = targetY - heroY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Reach limit: hero center to enemy outer edge
  const maxReach = HERO_RADIUS + KNIFE_REACH + targetRadius;
  if (dist > maxReach) return false;

  const targetAngle = Math.atan2(dy, dx);
  const diff = Math.abs(normalizeAngle(targetAngle - heroAimAngle));

  // Within half the 120° arc (60° = PI / 3) + small angular leeway for target radius
  const angleAllowance = (KNIFE_ARC / 2) + Math.asin(Math.min(0.9, targetRadius / Math.max(1, dist)));
  return diff <= angleAllowance;
}

/* ---------------- 6. Game State Factory ---------------- */
function createGameState(levelIndex = 0) {
  const levelDef = LEVELS[levelIndex] || LEVELS[0];
  const parsed = parseLevel(levelDef);

  return {
    levelIndex,
    levelDef,
    map: parsed,
    timeElapsed: 0,
    hero: {
      x: parsed.heroSpawn.x,
      y: parsed.heroSpawn.y,
      vx: 0,
      vy: 0,
      radius: HERO_RADIUS,
      hp: HERO_MAX_HP,
      maxHp: HERO_MAX_HP,
      speed: HERO_SPEED,
      aimAngle: 0,
      facingX: 1,
      facingY: 0,
      invulnTimer: 0,
      damageTaken: 0,
      attackCooldown: 0,
      swinging: false,
      swingTimer: 0,
      swingAngle: 0,
      walkAnim: 0
    },
    inventory: {
      coins: 0,
      hasKey: false,
      hasGun: false,
      ammo: 0,
      bombs: 0
    },
    slimes: parsed.slimes,
    items: parsed.items,
    particles: [],
    floatingTexts: [],
    gate: parsed.gate,
    gateUnlocked: false,
    levelComplete: false,
    gameOver: false,
    camera: { x: parsed.heroSpawn.x, y: parsed.heroSpawn.y },
    screenShake: 0,
    hitStop: 0,
    stats: {
      coinsTotal: parsed.totalCoins,
      slimesTotal: parsed.totalSlimes,
      slimesKilled: 0
    }
  };
}

/* ---------------- 7. Simulation Step (Fixed 1/60s) ---------------- */
function stepGame(g, input, dt = FIXED_DT) {
  if (g.levelComplete || g.gameOver) return;

  // Hit-stop effect (pauses entity updates briefly for impact juice)
  if (g.hitStop > 0) {
    g.hitStop -= dt;
    return;
  }

  g.timeElapsed += dt;
  const hero = g.hero;

  // 1. Hero Movement from input
  let moveX = input.moveX || 0;
  let moveY = input.moveY || 0;
  const moveMagSq = moveX * moveX + moveY * moveY;

  if (moveMagSq > 0.0001) {
    const mag = Math.sqrt(moveMagSq);
    moveX /= mag;
    moveY /= mag;
    hero.x += moveX * hero.speed * dt;
    hero.y += moveY * hero.speed * dt;
    hero.facingX = moveX;
    hero.facingY = moveY;
    hero.walkAnim += dt * 10;
  }

  // Aiming direction
  if (input.hasMouseAim && (input.aimX !== undefined && input.aimY !== undefined)) {
    hero.aimAngle = Math.atan2(input.aimY - hero.y, input.aimX - hero.x);
  } else if (moveMagSq > 0.0001) {
    hero.aimAngle = Math.atan2(moveY, moveX);
  }

  // Resolve hero collision with solid tiles
  resolveEntityTileCollision(hero, g.map.tiles, g.gateUnlocked);

  // 2. Invulnerability Timer
  if (hero.invulnTimer > 0) {
    hero.invulnTimer -= dt;
  }

  // 3. Attack Cooldown & Knife Swing
  if (hero.attackCooldown > 0) {
    hero.attackCooldown -= dt;
  }

  if (input.attack && hero.attackCooldown <= 0 && !hero.swinging) {
    hero.swinging = true;
    hero.swingTimer = KNIFE_DURATION;
    hero.attackCooldown = KNIFE_COOLDOWN;
    hero.swingAngle = hero.aimAngle;
    playSound('knifeSwish');

    // Perform melee hit detection immediately on swing
    let hitAny = false;
    for (const slime of g.slimes) {
      if (slime.dead) continue;
      if (isPointInKnifeArc(hero.x, hero.y, hero.aimAngle, slime.x, slime.y, slime.radius)) {
        slime.hp -= KNIFE_DAMAGE;
        slime.flashTimer = 0.15;
        slime.aggro = true;
        hitAny = true;

        // Knockback on slime
        const kx = slime.x - hero.x;
        const ky = slime.y - hero.y;
        const kdist = Math.sqrt(kx * kx + ky * ky) || 1;
        slime.vx = (kx / kdist) * KNIFE_KNOCKBACK;
        slime.vy = (ky / kdist) * KNIFE_KNOCKBACK;

        // Spawn hit particles & floating damage text
        spawnDamageNumber(g, slime.x, slime.y - 12, KNIFE_DAMAGE);
        spawnSparks(g, slime.x, slime.y, '#f59e0b', 6);

        if (slime.hp <= 0) {
          slime.dead = true;
          g.stats.slimesKilled++;
          playSound('slimeDie');
          spawnSlimeDeath(g, slime.x, slime.y);

          // Loot drops (30% coin, 10% heart)
          const roll = Math.random();
          if (roll < 0.30) {
            g.items.push({ type: 'coin', x: slime.x, y: slime.y, radius: 8, bob: 0 });
          } else if (roll < 0.40) {
            g.items.push({ type: 'heart', x: slime.x, y: slime.y, radius: 8, bob: 0 });
          }
        } else {
          playSound('knifeHit');
        }
      }
    }

    if (hitAny) {
      g.hitStop = 0.04; // 40ms hit stop
      g.screenShake = 3;
    }
  }

  if (hero.swinging) {
    hero.swingTimer -= dt;
    if (hero.swingTimer <= 0) {
      hero.swinging = false;
    }
  }

  // 4. Slimes AI & Movement
  for (const slime of g.slimes) {
    if (slime.dead) continue;

    // Decay flash
    if (slime.flashTimer > 0) slime.flashTimer -= dt;

    // Distance to hero
    const dx = hero.x - slime.x;
    const dy = hero.y - slime.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Aggro check: Line of sight or proximity (220px aggro radius)
    if (!slime.aggro && dist < 220) {
      slime.aggro = true;
    }

    // Decay knockback velocity
    slime.x += slime.vx * dt;
    slime.y += slime.vy * dt;
    slime.vx *= 0.82;
    slime.vy *= 0.82;

    // Hop cycle logic: squash -> airborne jump -> squash land
    slime.hopTimer -= dt;
    if (slime.hopTimer <= 0) {
      slime.hopTimer = 0.55 + Math.random() * 0.2;
      slime.hopPhase = 1; // airborne jump
      playSound('slimeHop');
    }

    if (slime.hopPhase === 1) {
      // Slime is mid-hop
      if (slime.aggro && dist > 1) {
        slime.x += (dx / dist) * SLIME_SPEED * dt;
        slime.y += (dy / dist) * SLIME_SPEED * dt;
        slime.facing = dx >= 0 ? 1 : -1;
      }
      if (slime.hopTimer < 0.3) {
        slime.hopPhase = 0; // landing
      }
    }

    resolveEntityTileCollision(slime, g.map.tiles, g.gateUnlocked);

    // Contact damage to hero
    if (dist < hero.radius + slime.radius && hero.invulnTimer <= 0) {
      hero.hp -= SLIME_DAMAGE;
      hero.damageTaken += SLIME_DAMAGE;
      hero.invulnTimer = HERO_INVULN_DUR;
      g.screenShake = 6;
      playSound('playerHurt');
      spawnDamageNumber(g, hero.x, hero.y - 12, SLIME_DAMAGE, '#ef4444');

      // Hero knockback away from slime
      const hdx = hero.x - slime.x;
      const hdy = hero.y - slime.y;
      const hdist = Math.sqrt(hdx * hdx + hdy * hdy) || 1;
      hero.x += (hdx / hdist) * 16;
      hero.y += (hdy / hdist) * 16;
      resolveEntityTileCollision(hero, g.map.tiles, g.gateUnlocked);

      if (hero.hp <= 0) {
        hero.hp = 0;
        g.gameOver = true;
      }
    }
  }

  // 5. Items Magnet & Collection
  for (let i = g.items.length - 1; i >= 0; i--) {
    const it = g.items[i];
    it.bob += dt * 5;

    const idx = hero.x - it.x;
    const idy = hero.y - it.y;
    const idist = Math.sqrt(idx * idx + idy * idy);

    // Magnet pulling toward hero
    if (idist < ITEM_MAGNET_DIST && idist > 1) {
      it.x += (idx / idist) * ITEM_MAGNET_SPEED * dt;
      it.y += (idy / idist) * ITEM_MAGNET_SPEED * dt;
    }

    // Pickup collision
    if (idist < hero.radius + it.radius) {
      if (it.type === 'coin') {
        g.inventory.coins++;
        playSound('coin');
        spawnFloatingText(g, it.x, it.y - 10, '+1 Coin', '#fbbf24');
        spawnSparks(g, it.x, it.y, '#f59e0b', 5);
        g.items.splice(i, 1);
      } else if (it.type === 'heart') {
        if (hero.hp < hero.maxHp) {
          hero.hp = Math.min(hero.maxHp, hero.hp + 30);
          playSound('heart');
          spawnFloatingText(g, it.x, it.y - 10, '+30 HP', '#f87171');
          spawnSparks(g, it.x, it.y, '#ef4444', 5);
          g.items.splice(i, 1);
        }
      } else if (it.type === 'key') {
        g.inventory.hasKey = true;
        playSound('key');
        spawnFloatingText(g, it.x, it.y - 14, 'KEY FOUND!', '#fbbf24');
        spawnSparks(g, it.x, it.y, '#fbbf24', 12);
        showToast('Key found! Find the locked gate.');
        g.items.splice(i, 1);
      }
    }
  }

  // 6. Gate Interaction & Unlocking
  if (g.gate) {
    const gdx = hero.x - g.gate.x;
    const gdy = hero.y - g.gate.y;
    const gdist = Math.sqrt(gdx * gdx + gdy * gdy);

    if (gdist < TS * 1.5) {
      if (g.inventory.hasKey) {
        if (!g.gateUnlocked) {
          g.gateUnlocked = true;
          g.gate.open = true;
          playSound('gateOpen');
          spawnSparks(g, g.gate.x, g.gate.y, '#38bdf8', 16);
          showToast('The gate opens! Step through to victory.');
        }
      } else {
        // Locked warning throttled
        if (!g.lastLockedToast || g.timeElapsed - g.lastLockedToast > 2.0) {
          g.lastLockedToast = g.timeElapsed;
          showToast('Locked — find the key!');
        }
      }
    }

    // Walking through open gate doorway completes the level
    if (g.gateUnlocked && gdist < TS * 0.8) {
      g.levelComplete = true;
      playSound('win');
    }
  }

  // 7. Update Particles & Floating Text
  for (let i = g.particles.length - 1; i >= 0; i--) {
    const p = g.particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) g.particles.splice(i, 1);
  }

  for (let i = g.floatingTexts.length - 1; i >= 0; i--) {
    const ft = g.floatingTexts[i];
    ft.y -= 24 * dt;
    ft.life -= dt;
    if (ft.life <= 0) g.floatingTexts.splice(i, 1);
  }

  // 8. Smooth Camera Follow with Aim Lookahead
  const lookX = Math.cos(hero.aimAngle) * 36;
  const lookY = Math.sin(hero.aimAngle) * 36;
  const targetCamX = hero.x + lookX;
  const targetCamY = hero.y + lookY;
  g.camera.x += (targetCamX - g.camera.x) * (dt * 8);
  g.camera.y += (targetCamY - g.camera.y) * (dt * 8);

  // Screen shake decay
  if (g.screenShake > 0) {
    g.screenShake -= dt * 15;
    if (g.screenShake < 0) g.screenShake = 0;
  }
}

/* ---------------- 8. Particle Spawners ---------------- */
function spawnSparks(g, x, y, color = '#fbbf24', count = 6) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 40 + Math.random() * 80;
    g.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color,
      size: 2 + Math.random() * 2,
      life: 0.25 + Math.random() * 0.2,
      maxLife: 0.45
    });
  }
}

function spawnSlimeDeath(g, x, y) {
  for (let i = 0; i < 14; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 30 + Math.random() * 90;
    g.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color: Math.random() > 0.4 ? '#4ade80' : '#22c55e',
      size: 3 + Math.random() * 3,
      life: 0.35 + Math.random() * 0.25,
      maxLife: 0.6
    });
  }
}

function spawnDamageNumber(g, x, y, damage, color = '#fbbf24') {
  g.floatingTexts.push({
    x,
    y,
    text: '-' + Math.round(damage),
    color,
    life: 0.6,
    maxLife: 0.6
  });
}

function spawnFloatingText(g, x, y, text, color = '#fff') {
  g.floatingTexts.push({
    x,
    y,
    text,
    color,
    life: 0.8,
    maxLife: 0.8
  });
}

/* ---------------- 9. Procedural 2D Canvas Rendering ---------------- */
function render(ctx, g, cvWidth, cvHeight) {
  ctx.save();
  ctx.clearRect(0, 0, cvWidth, cvHeight);

  // Screen shake offset
  let shakeX = 0, shakeY = 0;
  if (g.screenShake > 0) {
    shakeX = (Math.random() - 0.5) * g.screenShake;
    shakeY = (Math.random() - 0.5) * g.screenShake;
  }

  // Camera viewport & zoom
  const zoom = (cvWidth < 600 || cvHeight < 500) ? 1.4 : 1.75;
  const viewW = cvWidth / zoom;
  const viewH = cvHeight / zoom;

  let camX = g.camera.x - viewW / 2;
  let camY = g.camera.y - viewH / 2;

  if (g.map.pixelW <= viewW) {
    camX = (g.map.pixelW - viewW) / 2;
  } else {
    camX = Math.max(0, Math.min(camX, g.map.pixelW - viewW));
  }

  if (g.map.pixelH <= viewH) {
    camY = (g.map.pixelH - viewH) / 2;
  } else {
    camY = Math.max(0, Math.min(camY, g.map.pixelH - viewH));
  }

  ctx.save();
  ctx.scale(zoom, zoom);
  ctx.translate(-Math.round(camX + shakeX), -Math.round(camY + shakeY));

  const tiles = g.map.tiles;
  const mapW = g.map.w;
  const mapH = g.map.h;

  // Render Floors and Walls
  for (let ty = 0; ty < mapH; ty++) {
    for (let tx = 0; tx < mapW; tx++) {
      const tile = tiles[ty][tx];
      const px = tx * TS;
      const py = ty * TS;

      // Deterministic per-tile seed
      const seed = (tx * 73856093 ^ ty * 19349663) >>> 0;
      const varIdx = seed % 4;

      if (tile === '.' || tile === 'G') {
        // Floor tile (stone tiles with subtle seams and shade variations)
        ctx.fillStyle = varIdx === 0 ? '#1e2430' : (varIdx === 1 ? '#1a202c' : '#1f2735');
        ctx.fillRect(px, py, TS, TS);

        // Subtle tile borders
        ctx.strokeStyle = '#141822';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 0.5, py + 0.5, TS - 1, TS - 1);

        // Occasional stone flecks / moss
        if (seed % 7 === 0) {
          ctx.fillStyle = '#273449';
          ctx.fillRect(px + 6, py + 8, 4, 3);
        }
      }

      if (tile === '#' || tile === 't') {
        // Pseudo-3D wall: Top face (lighter) and front face (darker)
        const isFloorBelow = (ty + 1 < mapH) && (tiles[ty + 1][tx] === '.' || tiles[ty + 1][tx] === 'G');

        // Top face
        ctx.fillStyle = '#374151';
        ctx.fillRect(px, py, TS, isFloorBelow ? TS - 10 : TS);

        // Highlight bevel on top
        ctx.fillStyle = '#4b5563';
        ctx.fillRect(px, py, TS, 3);
        ctx.fillRect(px, py, 3, isFloorBelow ? TS - 10 : TS);

        if (isFloorBelow) {
          // Dark front face
          ctx.fillStyle = '#1f2937';
          ctx.fillRect(px, py + TS - 10, TS, 10);
          ctx.fillStyle = '#111827';
          ctx.fillRect(px, py + TS - 2, TS, 2);
        }

        // Wall sconce torch
        if (tile === 't') {
          ctx.fillStyle = '#78350f';
          ctx.fillRect(px + 14, py + 12, 4, 10); // torch handle
          // Animated flame
          const flameOffset = Math.sin(g.timeElapsed * 12 + tx) * 1.5;
          ctx.fillStyle = '#ea580c';
          ctx.beginPath();
          ctx.arc(px + 16, py + 9 + flameOffset, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fbbf24';
          ctx.beginPath();
          ctx.arc(px + 16, py + 8 + flameOffset, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Gate rendering
      if (tile === 'G') {
        const isOpen = g.gateUnlocked;
        // Archway pillars
        ctx.fillStyle = '#4b5563';
        ctx.fillRect(px, py, 6, TS);
        ctx.fillRect(px + TS - 6, py, 6, TS);

        if (!isOpen) {
          // Closed iron portcullis bars
          ctx.fillStyle = '#94a3b8';
          for (let bx = px + 8; bx < px + TS - 6; bx += 5) {
            ctx.fillRect(bx, py, 2, TS);
          }
          // Padlock
          ctx.fillStyle = '#b45309';
          ctx.beginPath();
          ctx.arc(px + TS / 2, py + TS / 2, 5, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Open gate glowing portal
          const portalGrad = ctx.createLinearGradient(px, py, px + TS, py);
          portalGrad.addColorStop(0, 'rgba(56, 189, 248, 0.2)');
          portalGrad.addColorStop(0.5, 'rgba(125, 211, 252, 0.8)');
          portalGrad.addColorStop(1, 'rgba(56, 189, 248, 0.2)');
          ctx.fillStyle = portalGrad;
          ctx.fillRect(px + 6, py, TS - 12, TS);
        }
      }
    }
  }

  // Render Items (Bobbing gently)
  for (const it of g.items) {
    const bobY = Math.sin(it.bob) * 3;
    const ix = it.x;
    const iy = it.y + bobY;

    if (it.type === 'coin') {
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(ix, iy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(ix - 1, iy - 1, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (it.type === 'heart') {
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(ix, iy + 4);
      ctx.bezierCurveTo(ix - 7, iy - 4, ix - 7, iy - 8, ix, iy - 4);
      ctx.bezierCurveTo(ix + 7, iy - 8, ix + 7, iy - 4, ix, iy + 4);
      ctx.fill();
    } else if (it.type === 'key') {
      // Golden key
      ctx.save();
      ctx.translate(ix, iy);
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#fbbf24';
      // Key bow
      ctx.beginPath();
      ctx.arc(0, -4, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1e2430';
      ctx.beginPath();
      ctx.arc(0, -4, 2, 0, Math.PI * 2);
      ctx.fill();
      // Key shaft and bit
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(-1.5, 0, 3, 10);
      ctx.fillRect(1, 4, 3, 2);
      ctx.fillRect(1, 8, 3, 2);
      ctx.restore();
    }
  }

  // Render Slimes
  for (const slime of g.slimes) {
    if (slime.dead) continue;
    ctx.save();
    ctx.translate(slime.x, slime.y);

    // Squash and stretch scale
    let scaleX = 1;
    let scaleY = 1;
    if (slime.hopPhase === 1) {
      scaleX = 0.85;
      scaleY = 1.25; // airborne stretch
    } else {
      scaleX = 1.15;
      scaleY = 0.85; // landing squash
    }

    ctx.scale(scaleX * slime.facing, scaleY);

    // Hit flash or normal green
    if (slime.flashTimer > 0) {
      ctx.fillStyle = '#ffffff';
    } else {
      const grad = ctx.createRadialGradient(-2, -3, 2, 0, 0, slime.radius);
      grad.addColorStop(0, '#86efac');
      grad.addColorStop(0.7, '#22c55e');
      grad.addColorStop(1, '#15803d');
      ctx.fillStyle = grad;
    }

    // Slime blob body
    ctx.beginPath();
    ctx.ellipse(0, 0, slime.radius, slime.radius * 0.9, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cute specular eye
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(3, -2, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#065f46';
    ctx.beginPath();
    ctx.arc(4, -2, 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // Slime Health Bar (shown when damaged)
    if (slime.hp < slime.maxHp && slime.hp > 0) {
      const barW = 24, barH = 3;
      const bx = slime.x - barW / 2;
      const by = slime.y - slime.radius - 8;
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(bx, by, barW, barH);
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(bx, by, (slime.hp / slime.maxHp) * barW, barH);
    }
  }

  // Render Hero
  const hero = g.hero;
  ctx.save();
  ctx.translate(hero.x, hero.y);

  // Invulnerability blinking
  const isInvuln = hero.invulnTimer > 0;
  if (!isInvuln || Math.floor(g.timeElapsed * 18) % 2 === 0) {
    // Walk bob
    const walkBob = Math.sin(hero.walkAnim) * 1.5;

    // Hero shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(0, hero.radius + 1, hero.radius * 0.9, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Hero Cloak & Hood
    // Main cloak body
    ctx.fillStyle = '#0f766e'; // teal adventurer tunic
    ctx.beginPath();
    ctx.arc(0, walkBob, hero.radius, 0, Math.PI * 2);
    ctx.fill();

    // Hood rim / face shadow
    ctx.fillStyle = '#115e59';
    ctx.beginPath();
    ctx.arc(0, walkBob - 2, hero.radius * 0.8, 0, Math.PI * 2);
    ctx.fill();

    // Determined adventurer face & eyes facing aim angle
    const eyeDist = 4;
    const ex = Math.cos(hero.aimAngle) * eyeDist;
    const ey = Math.sin(hero.aimAngle) * eyeDist + walkBob - 2;

    ctx.fillStyle = '#fef08a'; // bright glowing eyes under hood
    ctx.beginPath();
    ctx.arc(ex - 2, ey, 1.5, 0, Math.PI * 2);
    ctx.arc(ex + 2, ey, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Knife weapon in hand rotating with aim
    ctx.save();
    ctx.rotate(hero.aimAngle);

    // Hand
    ctx.fillStyle = '#d97706';
    ctx.beginPath();
    ctx.arc(hero.radius + 2, 4, 3, 0, Math.PI * 2);
    ctx.fill();

    // Knife blade
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.moveTo(hero.radius + 4, 4);
    ctx.lineTo(hero.radius + 18, 2);
    ctx.lineTo(hero.radius + 20, 4);
    ctx.lineTo(hero.radius + 4, 6);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    // Knife Slash Arc Animation
    if (hero.swinging) {
      const swingPct = 1 - (hero.swingTimer / KNIFE_DURATION);
      ctx.save();
      ctx.rotate(hero.swingAngle);

      ctx.beginPath();
      const startAngle = -KNIFE_ARC / 2;
      const endAngle = startAngle + KNIFE_ARC * swingPct;
      ctx.arc(0, 0, HERO_RADIUS + KNIFE_REACH, startAngle, endAngle);
      ctx.strokeStyle = `rgba(254, 240, 138, ${0.8 - swingPct * 0.6})`;
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.restore();
    }
  }

  ctx.restore();

  // Render Particles
  for (const p of g.particles) {
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Render Floating Text
  for (const ft of g.floatingTexts) {
    const alpha = Math.max(0, ft.life / ft.maxLife);
    ctx.fillStyle = ft.color;
    ctx.globalAlpha = alpha;
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(ft.text, ft.x, ft.y);
  }
  ctx.globalAlpha = 1;

  // Dynamic Dungeon Lighting Pass
  renderLighting(ctx, g, camX, camY, zoom, cvWidth, cvHeight);

  ctx.restore();
}

/* ---------------- 10. Dynamic Lighting Layer ---------------- */
function renderLighting(ctx, g, camX, camY, zoom, cvWidth, cvHeight) {
  // Save state for darkness compositing
  ctx.save();

  // Screen-space overlay
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // Render ambient darkness
  const darknessAlpha = g.levelDef.darkness || 0.45;
  ctx.fillStyle = `rgba(5, 7, 12, ${darknessAlpha})`;
  ctx.fillRect(0, 0, cvWidth, cvHeight);

  // Cut light circles using 'destination-out'
  ctx.globalCompositeOperation = 'destination-out';

  // 1. Hero lantern light
  const hScreenX = (g.hero.x - camX) * zoom;
  const hScreenY = (g.hero.y - camY) * zoom;
  const heroLightRadius = 110 * zoom;
  const heroGrad = ctx.createRadialGradient(hScreenX, hScreenY, 20 * zoom, hScreenX, hScreenY, heroLightRadius);
  heroGrad.addColorStop(0, 'rgba(0, 0, 0, 0.95)');
  heroGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = heroGrad;
  ctx.beginPath();
  ctx.arc(hScreenX, hScreenY, heroLightRadius, 0, Math.PI * 2);
  ctx.fill();

  // 2. Torches light
  for (const t of g.map.torches) {
    const tx = (t.x - camX) * zoom;
    const ty = (t.y - camY) * zoom;
    if (tx > -100 && tx < cvWidth + 100 && ty > -100 && ty < cvHeight + 100) {
      const flickerRadius = (85 + Math.sin(g.timeElapsed * 10 + t.flicker) * 4) * zoom;
      const tGrad = ctx.createRadialGradient(tx, ty, 10 * zoom, tx, ty, flickerRadius);
      tGrad.addColorStop(0, 'rgba(0, 0, 0, 0.9)');
      tGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = tGrad;
      ctx.beginPath();
      ctx.arc(tx, ty, flickerRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 3. Key Golden Glow
  for (const it of g.items) {
    if (it.type === 'key') {
      const kx = (it.x - camX) * zoom;
      const ky = (it.y - camY) * zoom;
      const kGrad = ctx.createRadialGradient(kx, ky, 5 * zoom, kx, ky, 65 * zoom);
      kGrad.addColorStop(0, 'rgba(0, 0, 0, 0.9)');
      kGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = kGrad;
      ctx.beginPath();
      ctx.arc(kx, ky, 65 * zoom, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 4. Open Gate Light
  if (g.gate && g.gateUnlocked) {
    const gx = (g.gate.x - camX) * zoom;
    const gy = (g.gate.y - camY) * zoom;
    const gGrad = ctx.createRadialGradient(gx, gy, 10 * zoom, gx, gy, 100 * zoom);
    gGrad.addColorStop(0, 'rgba(0, 0, 0, 0.95)');
    gGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gGrad;
    ctx.beginPath();
    ctx.arc(gx, gy, 100 * zoom, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/* ---------------- 11. Input Management (Desktop + Touch) ---------------- */
const input = {
  moveX: 0,
  moveY: 0,
  hasMouseAim: false,
  aimX: 0,
  aimY: 0,
  attack: false
};

const keysDown = new Set();

function setupInput(canvas) {
  // Keyboard
  window.addEventListener('keydown', e => {
    initAudio();
    const k = e.key.toLowerCase();
    keysDown.add(k);

    if (k === ' ' || k === 'j') {
      input.attack = true;
    }
    if (k === 'p' || k === 'escape') {
      togglePause();
    }
  });

  window.addEventListener('keyup', e => {
    const k = e.key.toLowerCase();
    keysDown.delete(k);
    if (k === ' ' || k === 'j') {
      input.attack = false;
    }
  });

  // Mouse
  canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    input.hasMouseAim = true;
    if (window.activeGame) {
      const g = window.activeGame;
      const zoom = (canvas.width < 600 || canvas.height < 500) ? 1.4 : 1.75;
      const viewW = canvas.width / zoom;
      const viewH = canvas.height / zoom;
      let camX = g.map.pixelW <= viewW ? (g.map.pixelW - viewW) / 2 : Math.max(0, Math.min(g.camera.x - viewW / 2, g.map.pixelW - viewW));
      let camY = g.map.pixelH <= viewH ? (g.map.pixelH - viewH) / 2 : Math.max(0, Math.min(g.camera.y - viewH / 2, g.map.pixelH - viewH));

      input.aimX = camX + ((e.clientX - rect.left) * scaleX) / zoom;
      input.aimY = camY + ((e.clientY - rect.top) * scaleY) / zoom;
    }
  });

  canvas.addEventListener('mousedown', e => {
    initAudio();
    if (e.button === 0) {
      input.attack = true;
    }
  });

  window.addEventListener('mouseup', e => {
    if (e.button === 0) {
      input.attack = false;
    }
  });

  // Touch Virtual Controls
  setupTouchControls();
}

function updateKeyboardInput() {
  let mx = 0, my = 0;
  if (keysDown.has('w') || keysDown.has('arrowup')) my -= 1;
  if (keysDown.has('s') || keysDown.has('arrowdown')) my += 1;
  if (keysDown.has('a') || keysDown.has('arrowleft')) mx -= 1;
  if (keysDown.has('d') || keysDown.has('arrowright')) mx += 1;

  if (mx !== 0 || my !== 0) {
    input.moveX = mx;
    input.moveY = my;
  } else if (!touchJoystickActive) {
    input.moveX = 0;
    input.moveY = 0;
  }
}

let touchJoystickActive = false;

function setupTouchControls() {
  const joystickZone = document.getElementById('joystick-zone');
  const joystickBase = document.getElementById('joystick-base');
  const joystickThumb = document.getElementById('joystick-thumb');
  const touchAttack = document.getElementById('touchAttack');

  // Detect touch device
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (isTouch) {
    document.body.classList.add('touch-device');
  }

  let startX = 0, startY = 0;
  let activeTouchId = null;

  if (joystickZone) {
    joystickZone.addEventListener('touchstart', e => {
      initAudio();
      e.preventDefault();
      const touch = e.changedTouches[0];
      activeTouchId = touch.identifier;
      startX = touch.clientX;
      startY = touch.clientY;

      joystickBase.style.display = 'block';
      joystickBase.style.left = startX + 'px';
      joystickBase.style.top = startY + 'px';
      joystickThumb.style.transform = 'translate(-50%, -50%)';

      touchJoystickActive = true;
    }, { passive: false });

    joystickZone.addEventListener('touchmove', e => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === activeTouchId) {
          const dx = touch.clientX - startX;
          const dy = touch.clientY - startY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxDist = 45;

          const nx = dist > 0 ? dx / dist : 0;
          const ny = dist > 0 ? dy / dist : 0;
          const clampedDist = Math.min(dist, maxDist);

          joystickThumb.style.transform = `translate(calc(-50% + ${nx * clampedDist}px), calc(-50% + ${ny * clampedDist}px))`;

          input.moveX = nx * (clampedDist / maxDist);
          input.moveY = ny * (clampedDist / maxDist);
          input.hasMouseAim = false; // Aim in movement direction on touch
        }
      }
    }, { passive: false });

    const endTouch = e => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === activeTouchId) {
          activeTouchId = null;
          touchJoystickActive = false;
          input.moveX = 0;
          input.moveY = 0;
          joystickBase.style.display = 'none';
        }
      }
    };

    joystickZone.addEventListener('touchend', endTouch);
    joystickZone.addEventListener('touchcancel', endTouch);
  }

  if (touchAttack) {
    touchAttack.addEventListener('touchstart', e => {
      initAudio();
      e.preventDefault();
      input.attack = true;
    }, { passive: false });

    touchAttack.addEventListener('touchend', e => {
      e.preventDefault();
      input.attack = false;
    }, { passive: false });
  }
}

/* ---------------- 12. Toast Notifications & UI ---------------- */
function showToast(msg) {
  if (typeof document === 'undefined') return;
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 2200);
}

function updateHUD(g) {
  const hpFill = document.getElementById('hpFill');
  const hpText = document.getElementById('hpText');
  const coinCount = document.getElementById('coinCount');
  const keyPill = document.getElementById('keyPill');
  const keyStatus = document.getElementById('keyStatus');
  const objectiveText = document.getElementById('objectiveText');

  if (hpFill) hpFill.style.width = `${Math.max(0, (g.hero.hp / g.hero.maxHp) * 100)}%`;
  if (hpText) hpText.textContent = Math.round(g.hero.hp);
  if (coinCount) coinCount.textContent = g.inventory.coins;

  if (keyPill && keyStatus) {
    if (g.inventory.hasKey) {
      keyPill.classList.add('active');
      keyStatus.textContent = 'KEY HELD';
    } else {
      keyPill.classList.remove('active');
      keyStatus.textContent = 'NO KEY';
    }
  }

  if (objectiveText) {
    if (g.gateUnlocked) {
      objectiveText.textContent = 'GATE OPEN — STEP THROUGH!';
    } else if (g.inventory.hasKey) {
      objectiveText.textContent = 'REACH THE GATE!';
    } else {
      objectiveText.textContent = 'FIND THE KEY';
    }
  }
}

/* ---------------- 13. Screen Navigation & Game Control ---------------- */
let currentGame = null;
let isPaused = false;

function togglePause() {
  if (!currentGame || currentGame.levelComplete || currentGame.gameOver) return;
  isPaused = !isPaused;
  const pauseOverlay = document.getElementById('screen-pause');
  if (pauseOverlay) pauseOverlay.hidden = !isPaused;
}

function startLevel(levelIndex = 0) {
  currentGame = createGameState(levelIndex);
  window.activeGame = currentGame;
  isPaused = false;

  document.getElementById('screen-title').hidden = true;
  document.getElementById('screen-pause').hidden = true;
  document.getElementById('screen-complete').hidden = true;
  document.getElementById('screen-gameover').hidden = true;

  showToast(`Level 1: ${currentGame.levelDef.name}`);
}

function showCompleteScreen(g) {
  const completeScreen = document.getElementById('screen-complete');
  if (!completeScreen) return;

  const mins = Math.floor(g.timeElapsed / 60);
  const secs = Math.floor(g.timeElapsed % 60);
  const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  document.getElementById('completeTime').textContent = timeStr;
  document.getElementById('completeCoins').textContent = `${g.inventory.coins} / ${g.stats.coinsTotal}`;
  document.getElementById('completeEnemies').textContent = `${g.stats.slimesKilled} / ${g.stats.slimesTotal}`;
  document.getElementById('completeDamage').textContent = `${Math.round(g.hero.damageTaken)} HP`;

  completeScreen.hidden = false;
}

function showGameOverScreen() {
  const overScreen = document.getElementById('screen-gameover');
  if (overScreen) overScreen.hidden = false;
}

/* ---------------- 14. Main Application Initialization ---------------- */
function init() {
  const canvas = document.getElementById('gameCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  setupInput(canvas);

  // Resize canvas responsively to viewport
  function handleResize() {
    const container = document.getElementById('game-container');
    const cw = container.clientWidth;
    const ch = container.clientHeight;

    canvas.width = cw;
    canvas.height = ch;
  }

  window.addEventListener('resize', handleResize);
  handleResize();

  // Wire buttons
  document.getElementById('btnStartGame')?.addEventListener('click', () => {
    initAudio();
    startLevel(0);
  });
  document.getElementById('btnHowToPlay')?.addEventListener('click', () => {
    alert('Explore the dungeon cellar, slay the slimes with your knife, find the hidden golden key, and unlock the exit gate!');
  });
  document.getElementById('btnPause')?.addEventListener('click', togglePause);
  document.getElementById('btnResume')?.addEventListener('click', togglePause);
  document.getElementById('btnRestartLevel')?.addEventListener('click', () => startLevel(0));
  document.getElementById('btnQuitTitle')?.addEventListener('click', () => {
    isPaused = false;
    document.getElementById('screen-pause').hidden = true;
    document.getElementById('screen-title').hidden = false;
  });
  document.getElementById('btnPlayAgain')?.addEventListener('click', () => startLevel(0));
  document.getElementById('btnCompleteTitle')?.addEventListener('click', () => {
    document.getElementById('screen-complete').hidden = true;
    document.getElementById('screen-title').hidden = false;
  });
  document.getElementById('btnRetry')?.addEventListener('click', () => startLevel(0));
  document.getElementById('btnGameOverTitle')?.addEventListener('click', () => {
    document.getElementById('screen-gameover').hidden = true;
    document.getElementById('screen-title').hidden = false;
  });

  // Main Loop
  let lastTime = performance.now();
  let accumulator = 0;

  function loop(now) {
    requestAnimationFrame(loop);
    const frameTime = Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;

    if (currentGame && !isPaused) {
      updateKeyboardInput();
      accumulator += frameTime;
      while (accumulator >= FIXED_DT) {
        stepGame(currentGame, input, FIXED_DT);
        accumulator -= FIXED_DT;
      }

      render(ctx, currentGame, canvas.width, canvas.height);
      updateHUD(currentGame);

      if (currentGame.levelComplete && document.getElementById('screen-complete').hidden) {
        showCompleteScreen(currentGame);
      }
      if (currentGame.gameOver && document.getElementById('screen-gameover').hidden) {
        showGameOverScreen();
      }
    }
  }

  requestAnimationFrame(loop);
}

if (typeof window !== 'undefined') {
  window.gb = {
    startLevel,
    togglePause,
    showCompleteScreen,
    showGameOverScreen,
    getGame: () => currentGame
  };
}

// Module export guard for unit tests in Node
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    TS,
    HERO_SPEED,
    HERO_RADIUS,
    HERO_MAX_HP,
    KNIFE_REACH,
    KNIFE_ARC,
    KNIFE_DAMAGE,
    SLIME_HP,
    SLIME_SPEED,
    SLIME_DAMAGE,
    LEVELS,
    parseLevel,
    isSolidTile,
    checkTileCollision,
    resolveEntityTileCollision,
    isPointInKnifeArc,
    createGameState,
    stepGame
  };
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  window.addEventListener('DOMContentLoaded', init);
}

})();
