/**
 * Gatebreaker v2 — Comprehensive Test Suite (Plain Node.js, ES Module)
 * Run: node tests/run.js
 */

import assert from 'assert';
import {
  TS,
  HERO_W,
  HERO_H,
  RUN_SPEED,
  RUN_ACCEL,
  RUN_DECEL,
  JUMP_VEL,
  GRAVITY,
  FALL_GRAV_MULT,
  MAX_FALL,
  JUMP_CUT_MULT,
  COYOTE_TIME,
  JUMP_BUFFER,
  CORNER_CORRECTION,
  ROPE_CLIMB_SPEED,
  POGO_BOUNCE_VEL,
  STOMP_BOUNCE_VEL
} from '../src/constants.js';
import {
  isSolidTile,
  isOneWayTile,
  isRopeTile,
  updateHeroPhysics
} from '../src/physics.js';
import {
  createHero,
  updateKnifeCombat,
  updateBeetlebots,
  updateKeyAndGate
} from '../src/entities.js';
import { LEVEL_1_MAP, parseLevel, createLevelState } from '../src/levels.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

console.log('====================================================');
console.log('Gatebreaker v2 (Platformer Prototype) Test Suite');
console.log('====================================================\n');

/* ---------------- Section 1: Level Map Parsing & Validation ---------------- */
console.log('Section 1: Level Parsing & Spawns');

test('Level 1 parses correctly with valid dimensions (30x17)', () => {
  const parsed = parseLevel(LEVEL_1_MAP);
  assert.strictEqual(parsed.w, 30, `Expected 30 columns, got ${parsed.w}`);
  assert.strictEqual(parsed.h, 17, `Expected 17 rows, got ${parsed.h}`);
  assert.ok(parsed.heroSpawn, 'Hero spawn must exist');
  assert.ok(parsed.gate, 'Keyhole Gate must exist');
  assert.strictEqual(parsed.crates.length, 1, 'Expected 1 gift crate');
  assert.strictEqual(parsed.enemies.length, 1, 'Expected 1 Beetlebot');
});

test('No entity spawns inside solid tiles', () => {
  const parsed = parseLevel(LEVEL_1_MAP);
  const tiles = parsed.tiles;

  // Hero spawn check
  const htx = Math.floor(parsed.heroSpawn.x / TS);
  const hty = Math.floor(parsed.heroSpawn.y / TS);
  assert.strictEqual(isSolidTile(tiles, htx, hty), false, 'Hero spawned inside solid tile');

  // Gate check
  const gtx = Math.floor(parsed.gate.x / TS);
  const gty = Math.floor(parsed.gate.y / TS);
  assert.strictEqual(isSolidTile(tiles, gtx, gty), false, 'Gate spawned inside solid tile');

  // Crate check
  for (const c of parsed.crates) {
    const ctx = Math.floor(c.x / TS);
    const cty = Math.floor(c.y / TS);
    assert.strictEqual(isSolidTile(tiles, ctx, cty), false, 'Crate spawned inside solid tile');
  }

  // Enemy check
  for (const e of parsed.enemies) {
    const etx = Math.floor(e.x / TS);
    const ety = Math.floor(e.y / TS);
    assert.strictEqual(isSolidTile(tiles, etx, ety), false, 'Enemy spawned inside solid tile');
  }
});

/* ---------------- Section 2: Platformer Physics ---------------- */
console.log('\nSection 2: Platformer Physics (Jump, Coyote, Buffer, Run)');

test('Max jump height matches theoretical 92.2 px within 5%', () => {
  // Empty room: floor at y = 400
  const tiles = Array.from({ length: 20 }, () => Array(30).fill('.'));
  for (let x = 0; x < 30; x++) tiles[15][x] = '#'; // floor at y = 15 * 32 = 480

  const hero = createHero(100, 480 - HERO_H);
  hero.grounded = true;

  // Trigger jump holding jump button
  const input = { left: false, right: false, up: false, down: false, jumpPressed: true, jumpHeld: true };
  const initialY = hero.y;
  let minY = hero.y;

  const dt = 1 / 120; // high precision simulation step
  for (let i = 0; i < 120; i++) {
    updateHeroPhysics(hero, input, tiles, dt);
    if (hero.y < minY) minY = hero.y;
    input.jumpPressed = false; // release edge
  }

  const simulatedHeight = initialY - minY;
  const theoreticalHeight = (JUMP_VEL * JUMP_VEL) / (2 * GRAVITY); // 560^2 / (2 * 1700) = 92.235 px
  const diffPct = Math.abs(simulatedHeight - theoreticalHeight) / theoreticalHeight;

  assert.ok(diffPct < 0.05, `Jump height ${simulatedHeight.toFixed(2)}px differed from theoretical ${theoreticalHeight.toFixed(2)}px by ${(diffPct * 100).toFixed(1)}%`);
});

test('Variable jump height cuts velocity by 0.45x on early release', () => {
  const tiles = Array.from({ length: 20 }, () => Array(30).fill('.'));
  const hero = createHero(100, 300);
  hero.grounded = true;

  // Jump and immediately release
  const input = { jumpPressed: true, jumpHeld: false };
  updateHeroPhysics(hero, input, tiles, 1 / 60);

  // Velocity should have been cut from -560 to -560 * 0.45 = -252 (plus 1 frame of gravity)
  assert.ok(hero.vy > -300, `Expected cut velocity > -300, got ${hero.vy}`);
});

test('Terminal fall velocity is capped at MAX_FALL (650 px/s)', () => {
  const tiles = Array.from({ length: 50 }, () => Array(30).fill('.'));
  const hero = createHero(100, 100);

  const input = {};
  for (let i = 0; i < 30; i++) {
    updateHeroPhysics(hero, input, tiles, 1 / 60);
  }

  assert.strictEqual(hero.vy, MAX_FALL, `Fall velocity should cap at ${MAX_FALL}, got ${hero.vy}`);
});

test('Anti-tunneling: Falling at max speed (650 px/s) does NOT penetrate floor', () => {
  const tiles = Array.from({ length: 20 }, () => Array(30).fill('.'));
  for (let x = 0; x < 30; x++) tiles[10][x] = '#'; // floor top at y = 10 * 32 = 320

  const hero = createHero(100, 310 - HERO_H);
  hero.vy = MAX_FALL; // 650 px/s downwards (displacement ~10.8 px)

  updateHeroPhysics(hero, {}, tiles, 1 / 60);

  const floorTop = 10 * TS;
  assert.strictEqual(hero.y, floorTop - HERO_H, `Hero tunneled into floor! y=${hero.y}, expected ${floorTop - HERO_H}`);
  assert.strictEqual(hero.grounded, true, 'Hero should be grounded on floor');
  assert.strictEqual(hero.vy, 0, 'Vertical velocity should be zero on landing');
});

test('Coyote Time allows jumping within 0.10s after leaving ledge', () => {
  // Ledge ends at x = 100
  const tiles = Array.from({ length: 20 }, () => Array(30).fill('.'));
  tiles[10][1] = '#'; tiles[10][2] = '#'; tiles[10][3] = '#';

  const hero = createHero(110, 320 - HERO_H);
  hero.grounded = true;

  // Walk off the ledge
  hero.x = 135; // off the ledge
  updateHeroPhysics(hero, {}, tiles, 1 / 60);
  assert.strictEqual(hero.grounded, false, 'Hero should not be grounded');
  assert.ok(hero.coyoteTimer > 0, `Coyote timer should be active, got ${hero.coyoteTimer}`);

  // Jump within coyote window (0.05s after leaving ledge)
  const input = { jumpPressed: true, jumpHeld: true };
  updateHeroPhysics(hero, input, tiles, 1 / 60);
  assert.ok(hero.vy < 0, `Hero failed to jump during coyote time! vy=${hero.vy}`);
});

test('Jump Buffer registers jump 0.08s before landing and triggers on touchdown', () => {
  const tiles = Array.from({ length: 20 }, () => Array(30).fill('.'));
  for (let x = 0; x < 30; x++) tiles[10][x] = '#'; // floor at 320

  const hero = createHero(100, 320 - HERO_H - 12);
  hero.vy = 200; // falling toward floor

  // Press jump while in air (before landing)
  const input = { jumpPressed: true, jumpHeld: true };
  updateHeroPhysics(hero, input, tiles, 1 / 60);
  assert.strictEqual(hero.grounded, false);
  assert.ok(hero.jumpBufferTimer > 0, 'Jump buffer should be set');

  // Step frames until hero touches down and jumps
  let jumped = false;
  for (let i = 0; i < 4; i++) {
    updateHeroPhysics(hero, { jumpPressed: false, jumpHeld: true }, tiles, 1 / 60);
    if (hero.vy < 0) {
      jumped = true;
      break;
    }
  }
  assert.ok(jumped, `Hero should have jumped from buffer on touchdown! vy=${hero.vy}`);
});

test('Corner Correction nudges hero 6px around ceiling corners', () => {
  // Single ceiling tile at tx = 5 (x = 160 to 192, y = 100)
  const tiles = Array.from({ length: 20 }, () => Array(30).fill('.'));
  tiles[3][5] = '#';

  // Hero jumping up, overlapping the right edge of tile by 4px (x = 188, hero.w = 20)
  const hero = createHero(188, 3 * TS + TS + 2);
  hero.vy = -300;

  updateHeroPhysics(hero, { jumpHeld: true }, tiles, 1 / 60);

  // Hero should be nudged rightwards around the corner
  assert.ok(hero.x >= 192, `Corner correction failed to nudge hero right! x=${hero.x}`);
});

/* ---------------- Section 3: One-Way Planks & Ropes ---------------- */
console.log('\nSection 3: One-Way Planks & Ropes');

test('One-way platform allows jumping up through from below', () => {
  const tiles = Array.from({ length: 20 }, () => Array(30).fill('.'));
  tiles[5][5] = '='; // one-way plank at y = 160

  const hero = createHero(5 * TS, 175); // just below plank
  hero.vy = -400; // jumping upward

  updateHeroPhysics(hero, { jumpHeld: true }, tiles, 1 / 60);

  // Hero should pass through upward without being blocked
  assert.ok(hero.y < 175, 'Hero should continue moving upward through one-way plank');
  assert.ok(hero.vy < 0, 'Upward velocity should not be stopped by one-way plank');
});

test('One-way platform blocks downward fall and grounds hero', () => {
  const tiles = Array.from({ length: 20 }, () => Array(30).fill('.'));
  tiles[5][5] = '='; // one-way plank at y = 5 * 32 = 160

  const hero = createHero(5 * TS, 160 - HERO_H - 4); // just above plank
  hero.vy = 200; // falling down

  updateHeroPhysics(hero, {}, tiles, 1 / 60);

  assert.strictEqual(hero.y, 160 - HERO_H, 'Hero should land exactly on plank top');
  assert.strictEqual(hero.grounded, true, 'Hero should be grounded on one-way plank');
  assert.strictEqual(hero.vy, 0, 'Vertical velocity should zero upon landing on plank');
});

test('Down + Jump drops down through one-way platform', () => {
  const tiles = Array.from({ length: 20 }, () => Array(30).fill('.'));
  tiles[5][5] = '=';

  const hero = createHero(5 * TS, 160 - HERO_H);
  hero.grounded = true;

  // Press Down + Jump
  const input = { down: true, jumpPressed: true, jumpHeld: true };
  updateHeroPhysics(hero, input, tiles, 1 / 60);

  assert.ok(hero.dropThroughTimer > 0, 'Drop through timer should be active');
  assert.strictEqual(hero.grounded, false, 'Hero should un-ground and drop through');
});

test('Climbing rope attaches on Up/Down and moves at 120 px/s', () => {
  const tiles = Array.from({ length: 20 }, () => Array(30).fill('.'));
  tiles[4][5] = '|'; tiles[5][5] = '|'; tiles[6][5] = '|';

  const hero = createHero(5 * TS + 6, 5 * TS);
  const input = { up: true };

  updateHeroPhysics(hero, input, tiles, 1 / 60);

  assert.strictEqual(hero.onRope, true, 'Hero should latch onto rope');
  assert.strictEqual(hero.vy, -ROPE_CLIMB_SPEED, `Climb speed should be ${-ROPE_CLIMB_SPEED}, got ${hero.vy}`);
});

/* ---------------- Section 4: Combat, Beetlebot, Crate, Key, Gate ---------------- */
console.log('\nSection 4: Combat, Beetlebot Stomp, Crate & Gate Loop');

test('Forward knife slash damages Beetlebot', () => {
  const state = createLevelState(LEVEL_1_MAP);
  const beetle = state.enemies[0];

  // Position hero in front of beetle facing it
  state.hero.x = beetle.x - 22;
  state.hero.y = beetle.y;
  state.hero.facing = 1;

  updateKnifeCombat(state.hero, { knifePressed: true }, state);

  assert.ok(beetle.dead, 'Beetlebot should be killed by knife slash');
});

test('Air Down-Slash on enemy bounces hero upward (Pogo)', () => {
  const state = createLevelState(LEVEL_1_MAP);
  const beetle = state.enemies[0];

  // Hero directly above beetle in air
  state.hero.x = beetle.x;
  state.hero.y = beetle.y - HERO_H + 4;
  state.hero.grounded = false;
  state.hero.vy = 100;

  updateKnifeCombat(state.hero, { knifePressed: true, down: true }, state);

  assert.strictEqual(state.hero.vy, POGO_BOUNCE_VEL, `Hero should bounce with pogo velocity ${POGO_BOUNCE_VEL}, got ${state.hero.vy}`);
});

test('Falling stomp on Beetlebot head defeats beetlebot and bounces hero', () => {
  const state = createLevelState(LEVEL_1_MAP);
  const beetle = state.enemies[0];

  state.hero.x = beetle.x;
  state.hero.y = beetle.y - HERO_H + 2; // hero feet hitting head
  state.hero.vy = 240; // falling

  updateBeetlebots(state, 1 / 60);

  assert.ok(beetle.dead, 'Beetlebot should be defeated by stomp');
  assert.strictEqual(state.hero.vy, STOMP_BOUNCE_VEL, 'Hero should bounce upon stomping enemy');
});

test('Knife slash on Gift Crate opens crate and drops Key', () => {
  const state = createLevelState(LEVEL_1_MAP);
  const crate = state.crates[0];

  state.hero.x = crate.x - 20;
  state.hero.y = crate.y;
  state.hero.facing = 1;

  updateKnifeCombat(state.hero, { knifePressed: true }, state);

  assert.strictEqual(crate.opened, true, 'Gift crate should be opened');
  assert.ok(state.keyItem, 'Key should be spawned from crate');
});

test('Key pickup sets hasKey and unlocks Keyhole Gate upon touch', () => {
  const state = createLevelState(LEVEL_1_MAP);
  const crate = state.crates[0];

  // Open crate
  state.hero.x = crate.x - 20;
  state.hero.y = crate.y;
  state.hero.facing = 1;
  updateKnifeCombat(state.hero, { knifePressed: true }, state);

  // Pick up key
  state.hero.x = state.keyItem.x;
  state.hero.y = state.keyItem.y;
  updateKeyAndGate(state, 1 / 60);
  assert.strictEqual(state.hero.hasKey, true, 'Hero should possess Key');

  // Move to gate
  state.hero.x = state.gate.x;
  state.hero.y = state.gate.y;
  updateKeyAndGate(state, 1 / 60);

  assert.strictEqual(state.gate.unlocked, true, 'Gate should be unlocked with key');
  assert.strictEqual(state.levelComplete, true, 'Level should be completed upon unlocking gate');
});

console.log('\n====================================================');
console.log(`Test Results: ${passed} passed, ${failed} failed`);
console.log('====================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('All Phase 1 prototype tests passed successfully! 🎉\n');
}
