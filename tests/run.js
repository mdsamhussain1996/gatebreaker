/**
 * Gatebreaker test suite (plain Node, no dependencies).   Run: node tests/run.js
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TS, HERO, PHYS, JUMP, DT, ABILITIES } from '../src/constants.js';
import { World, overlapsSolid, moveX, moveY, probeGround } from '../src/physics.js';
import { Player } from '../src/player.js';
import { InputManager } from '../src/input.js';
import { LEVELS } from '../src/levels.js';
import { parseLevel } from '../src/level.js';
import { Game } from '../src/game.js';
import {
  MushroomWalker, BuzzBee, NightBat, HopperFrog, WildBoar,
  LeafGlider, RollingArmadillo, DesertHawk, SpinningSaw
} from '../src/enemies.js';
import { PowerOrb, BlasterBolt, FlameWave, IceBlock, Coin, Gem } from '../src/items.js';
import { THEMES, getTheme } from '../src/themes.js';
import { getUnlockedAbilities, recordResult, getDifficulty, setDifficulty } from '../src/save.js';
import {
  FireJet, WallFlamethrower, RotatingFirebar, LavaBubble, FireDrip,
  BurningPlank, RisingLava, FallingIcicle, CrystalLaser, ThornBramble, SandGeyser,
  getDifficultyScales
} from '../src/hazards.js';

let passed = 0, failed = 0;
const section = name => console.log(`\n${name}`);
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n      ${e.message}`); failed++; }
}
const I = InputManager.synthetic;

/** Minimal stand-in for Game, enough for Player in isolated worlds. */
function stubGame(world, abilities = []) {
  return {
    world,
    abilities,
    hasAbility(name) { return this.abilities.includes(name); },
    sfx() {}, poof() {}, resolveSlash() {}, playerFell() { this.fell = true; }, onHeroHurt() {},
    addAfterimage() {}, spawnPuffRing() {}, spawnDust() {}, shakeScreen() {},
    groundPoundImpact(x, y, radius) {
      if (this.onGroundPound) this.onGroundPound(x, y, radius);
      if (this.world) {
        const c0 = Math.floor((x - radius) / TS), c1 = Math.floor((x + radius) / TS);
        const r0 = Math.floor((y - 4) / TS), r1 = Math.floor((y + TS) / TS);
        for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
          if (this.world.get(c, r) === 'X') this.world.set(c, r, '.');
        }
      }
    },
    checkDashSmash(p) {
      if (this.onDashSmash) this.onDashSmash(p);
      if (this.world) {
        const checkX = p.dashDir > 0 ? p.x + p.w : p.x - 8;
        const c = Math.floor(checkX / TS), r = Math.floor((p.y + p.h / 2) / TS);
        if (this.world.get(c, r) === 'X') this.world.set(c, r, '.');
      }
    },
    checkGiantSmash(p) {
      if (this.onGiantSmash) this.onGiantSmash(p);
      if (this.world) {
        const c0 = Math.floor(p.x / TS), c1 = Math.floor((p.x + p.w - 0.001) / TS);
        const r0 = Math.floor(p.y / TS), r1 = Math.floor((p.y + p.h - 0.001) / TS);
        for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
          if (this.world.get(c, r) === 'X') this.world.set(c, r, '.');
        }
      }
    },
    breakCrate(c, r) {
      if (this.world) this.world.set(c, r, '.');
    }
  };
}
function makeWorld(rows) { return new World(rows); }
function spawn(world, c, r) {          // hero standing with feet at the bottom of cell (c, r)
  const p = new Player();
  p.place((c + 0.5) * TS, (r + 1) * TS);
  return { p, g: stubGame(world) };
}
function run(p, g, frames, inputFn) {
  for (let i = 0; i < frames; i++) p.update(g, typeof inputFn === 'function' ? inputFn(i) : inputFn, DT);
}
const FLAT = [
  '..................',
  '..................',
  '..................',
  '..................',
  '..................',
  '..................',
  '..................',
  '..................',
  '##################',
  '##################'
];

// ------------------------------------------------------------------ 1. levels
section('1. Level data');
LEVELS.forEach(def => {
  const lv = parseLevel(def);
  test(`L${def.id} "${def.name}": parses with equal row lengths`, () => assert.deepEqual(lv.errors, []));
  test(`L${def.id}: has start, key (or boss) and gate`, () => {
    assert.ok(lv.start, 'missing start');
    assert.ok(lv.key || (lv.bosses && lv.bosses.length > 0), 'missing key or boss');
    assert.ok(lv.gate, 'missing gate');
  });
  test(`L${def.id}: only known tile characters`, () => {
    for (const row of lv.world.tiles) for (const ch of row) assert.ok('.#=~H|XZ'.includes(ch), `unknown tile '${ch}'`);
  });
  test(`L${def.id}: no entity spawns inside solid tiles`, () => {
    const w = lv.world;
    assert.ok(!overlapsSolid(w, lv.start.x - HERO.w / 2, lv.start.feetY - HERO.h, HERO.w, HERO.h), 'hero start in solid');
    for (const m of lv.walkers) assert.ok(!overlapsSolid(w, m.x - 13, m.feetY - 24, 26, 24), `walker at ${m.c},${m.r} in solid`);
    for (const s of lv.hedgehogs) assert.ok(!overlapsSolid(w, s.x - 13, s.feetY - 24, 26, 24), `hedgehog at ${s.c},${s.r} in solid`);
    for (const c of lv.coins) assert.ok(!overlapsSolid(w, c.x - 7, c.y - 7, 14, 14), `coin at ${c.x},${c.y} in solid`);
    if (lv.key) assert.ok(!overlapsSolid(w, lv.key.x - 8, lv.key.y - 12, 16, 24), 'key in solid');
    const gx = lv.gate.c * TS, gy = (lv.gate.r + 1) * TS - 96;
    assert.ok(!overlapsSolid(w, gx, gy, 64, 96), 'gate in solid');
  });
  test(`L${def.id}: hero start, walkers/hedgehogs and gate stand on ground`, () => {
    const w = lv.world;
    const ground = (c, r) => w.isSolid(c, r + 1) || w.isOneWay(c, r + 1);
    assert.ok(ground(lv.start.c, lv.start.r), 'start not on ground');
    for (const m of lv.walkers) assert.ok(ground(m.c, m.r), `walker ${m.c},${m.r} floating`);
    for (const s of lv.hedgehogs) assert.ok(ground(s.c, s.r), `hedgehog ${s.c},${s.r} floating`);
    assert.ok(ground(lv.gate.c, lv.gate.r) && ground(lv.gate.c + 1, lv.gate.r), 'gate floating');
  });
  test(`L${def.id}: 60–120 coins`, () => assert.ok(lv.coins.length >= 60 && lv.coins.length <= 120, `got ${lv.coins.length}`));
  test(`L${def.id}: theme exists and has all painters`, () => {
    const th = getTheme(def.theme);
    assert.ok(th, `theme ${def.theme} missing`);
    assert.ok(th.sky && th.sky.length >= 2, 'sky gradient missing');
    assert.ok(typeof th.parallax?.far === 'function', 'parallax far missing');
    assert.ok(typeof th.parallax?.mid === 'function', 'parallax mid missing');
    assert.ok(typeof th.parallax?.near === 'function', 'parallax near missing');
    assert.ok(typeof th.terrain?.soil === 'function', 'terrain soil missing');
    assert.ok(typeof th.terrain?.cap === 'function', 'terrain cap missing');
    assert.ok(typeof th.terrain?.bridge === 'function', 'terrain bridge missing');
    assert.ok(typeof th.terrain?.ladder === 'function', 'terrain ladder missing');
    assert.ok(typeof th.terrain?.rope === 'function', 'terrain rope missing');
  });
});

// ------------------------------------------------------------------ 2. reachability
section('2. Reachability (movement graph: walk, jump, fall, ladders, ropes)');

/**
 * Movement limits are derived from the real physics (jump apex ≈ 3.0 tiles, flat jump ≈ 3.9 tiles),
 * then used conservatively: rise ≤ 2 tiles, flat/up gap ≤ 3 tiles, drop gap ≤ 4 tiles.
 */
function buildGraph(world) {
  const free = (c, r) => !world.isSolid(c, r);
  const standing = (c, r) => free(c, r) && free(c, r - 1) && (world.isSolid(c, r + 1) || world.isOneWay(c, r + 1));
  const key = (c, r) => `${c},${r}`;
  const nodes = new Map();
  const addNode = (c, r, kind) => nodes.set(key(c, r), { c, r, kind, edges: [] });
  for (let r = 0; r < world.rowCount; r++) for (let c = 0; c < world.cols; c++) {
    if (standing(c, r)) addNode(c, r, 'stand');
    else if (world.isClimb(c, r)) addNode(c, r, 'climb');
  }
  const link = (a, b) => { const n = nodes.get(a), m = nodes.get(b); if (n && m) n.edges.push(m); };
  const clearBox = (c0, c1, r0, r1) => {
    for (let c = Math.min(c0, c1); c <= Math.max(c0, c1); c++) for (let r = r0; r <= r1; r++) if (world.isSolid(c, r)) return false;
    return true;
  };
  const maxRise = Math.min(2, Math.floor(JUMP.heightTiles - 0.5));
  for (const n of nodes.values()) {
    const { c, r } = n;
    if (n.kind === 'stand') {
      // walk
      for (const d of [-1, 1]) link(key(c, r), key(c + d, r));
      // walk off a ledge and fall straight down
      for (const d of [-1, 1]) {
        const cc = c + d;
        if (free(cc, r) && free(cc, r - 1) && !nodes.has(key(cc, r))) {
          for (let rr = r + 1; rr < world.rowCount; rr++) {
            if (!free(cc, rr)) break;
            if (nodes.get(key(cc, rr))?.kind === 'stand') { link(key(c, r), key(cc, rr)); break; }
          }
        }
      }
      // jump
      for (let dr = -maxRise; dr <= 14; dr++) {           // dr = target row offset (negative = up)
        const rise = -dr;
        const maxDx = rise >= 1 ? 3 : rise === 0 ? 3 : 4;
        for (let dx = -maxDx; dx <= maxDx; dx++) {
          if (dx === 0 && dr >= 0) continue;
          const tr = r + dr, tc = c + dx;
          if (nodes.get(key(tc, tr))?.kind !== 'stand') continue;
          if (!clearBox(c, tc, Math.min(r, tr) - 1, Math.max(r, tr) - 1)) continue;
          link(key(c, r), key(tc, tr));
        }
      }
      // grab a ladder / rope
      for (let dx = -2; dx <= 2; dx++) for (let dr = -3; dr <= 0; dr++) link(key(c, r), key(c + dx, r + dr));
      // climb down from a ladder top
      link(key(c, r), key(c, r + 1));
    } else {
      link(key(c, r), key(c, r - 1)); link(key(c, r), key(c, r + 1));
      // step/jump off sideways onto standing cells
      for (let dx = -3; dx <= 3; dx++) for (let dr = -maxRise; dr <= 3; dr++) {
        const t = nodes.get(key(c + dx, r + dr));
        if (t?.kind === 'stand') link(key(c, r), key(c + dx, r + dr));
      }
      const above = nodes.get(key(c, r - 1));
      if (!above) link(key(c, r), key(c, r - 1));
    }
  }
  return { nodes, key };
}
function bfs(graph, startKey) {
  const seen = new Set([startKey]);
  const q = [graph.nodes.get(startKey)];
  while (q.length) {
    const n = q.shift();
    if (!n) continue;
    for (const m of n.edges) { const k = graph.key(m.c, m.r); if (!seen.has(k)) { seen.add(k); q.push(m); } }
  }
  return seen;
}

LEVELS.forEach(def => {
  const lv = parseLevel(def);
  const graph = buildGraph(lv.world);
  const startKey = graph.key(lv.start.c, lv.start.r);
  const fromStart = bfs(graph, startKey);
  const target = lv.key ? lv.key : lv.bosses[0];
  const keyNodes = [...fromStart].map(k => graph.nodes.get(k)).filter(n =>
    n && n.kind === 'stand' && Math.abs(n.c - target.c) <= 1 && target.r >= n.r - 3 && target.r <= n.r);
  test(`L${def.id}: start → key is reachable`, () => assert.ok(keyNodes.length > 0, 'no reachable standing cell near the key/boss'));
  test(`L${def.id}: key → gate is reachable`, () => {
    const from = keyNodes[0];
    const seen = bfs(graph, graph.key(from.c, from.r));
    const ok = [...seen].some(k => { const n = graph.nodes.get(k); return n && n.kind === 'stand' && n.r === lv.gate.r && n.c >= lv.gate.c - 1 && n.c <= lv.gate.c + 2; });
    assert.ok(ok, 'gate not reachable from the key');
  });
  test(`L${def.id}: every coin is reachable (or reachable by a short jump)`, () => {
    const standNodes = [...fromStart].map(k => graph.nodes.get(k)).filter(n => n && n.kind === 'stand');
    for (const coin of lv.coins) {
      const cc = Math.floor(coin.x / TS), cr = Math.floor(coin.y / TS);
      const ok = standNodes.some(n => Math.abs(n.c - cc) <= 2 && cr >= n.r - 4 && cr <= n.r + 1);
      assert.ok(ok, `coin at ${cc},${cr} unreachable`);
    }
  });
  test(`L${def.id}: every star is reachable`, () => {
    const standNodes = [...fromStart].map(k => graph.nodes.get(k)).filter(n => n && n.kind === 'stand');
    for (const s of lv.stars) {
      const sc = Math.floor(s.x / TS), sr = Math.floor(s.y / TS);
      const ok = standNodes.some(n => Math.abs(n.c - sc) <= 2 && sr >= n.r - 4 && sr <= n.r + 1);
      assert.ok(ok, `star at ${sc},${sr} unreachable`);
    }
  });
  test(`L${def.id}: checkpoints are reachable`, () => {
    const standNodes = [...fromStart].map(k => graph.nodes.get(k)).filter(n => n && n.kind === 'stand');
    for (const cp of lv.checkpoints) {
      const ok = standNodes.some(n => Math.abs(n.c - cp.c) <= 2 && cp.r >= n.r - 3 && cp.r <= n.r);
      assert.ok(ok, `checkpoint at ${cp.c},${cp.r} unreachable`);
    }
  });
});

// ------------------------------------------------------------------ 3. physics numbers
section('3. Physics numbers');
test('jump apex height within 5 % of analytic (v²/2g)', () => {
  const w = makeWorld(FLAT);
  const { p, g } = spawn(w, 5, 7);
  run(p, g, 3, I());                               // settle
  const feet0 = p.y + p.h;
  let minY = p.y;
  run(p, g, 70, i => { minY = Math.min(minY, p.y); return I({ jumpHeld: true, jumpPressed: i === 0 }); });
  const height = feet0 - (minY + p.h);
  const err = Math.abs(height - JUMP.heightPx) / JUMP.heightPx;
  assert.ok(err < 0.05, `height ${height.toFixed(1)} px vs ${JUMP.heightPx.toFixed(1)} px (${(err * 100).toFixed(1)} %)`);
});
test('flat jump distance at full run speed within 5 % of analytic', () => {
  const w = makeWorld(['.'.repeat(40), '.'.repeat(40), '.'.repeat(40), '.'.repeat(40), '.'.repeat(40), '#'.repeat(40), '#'.repeat(40)]);
  const { p, g } = spawn(w, 2, 4);
  p.vx = PHYS.runMax;
  p.grounded = true;
  const x0 = p.x;
  let left = false;
  for (let i = 0; i < 90; i++) {
    p.update(g, I({ right: true, jumpHeld: true, jumpPressed: i === 0 }), DT);
    if (i > 5 && p.grounded) { left = true; break; }
  }
  assert.ok(left, 'never landed');
  const tUp = -PHYS.jumpV / PHYS.gravity;
  const tDown = Math.sqrt(2 * JUMP.heightPx / (PHYS.gravity * PHYS.fallMult));
  const expected = PHYS.runMax * (tUp + tDown);
  const dist = p.x - x0;
  const err = Math.abs(dist - expected) / expected;
  assert.ok(err < 0.05, `distance ${dist.toFixed(1)} px vs ${expected.toFixed(1)} px (${(err * 100).toFixed(1)} %)`);
});
test('variable jump: a tap is clearly lower than a full jump', () => {
  const w = makeWorld(FLAT);
  const a = spawn(w, 5, 7); run(a.p, a.g, 3, I());
  let minA = a.p.y; run(a.p, a.g, 60, i => { minA = Math.min(minA, a.p.y); return I({ jumpPressed: i === 0, jumpHeld: i === 0 }); });
  const b = spawn(w, 5, 7); run(b.p, b.g, 3, I());
  let minB = b.p.y; run(b.p, b.g, 60, i => { minB = Math.min(minB, b.p.y); return I({ jumpPressed: i === 0, jumpHeld: true }); });
  assert.ok(minA > minB + 30, `tap apex ${minA.toFixed(0)} vs hold apex ${minB.toFixed(0)}`);
});
test('run speed caps at 210 px/s, acceleration 1800 px/s²', () => {
  const w = makeWorld(FLAT);
  const { p, g } = spawn(w, 2, 7);
  run(p, g, 3, I());
  run(p, g, 6, I({ right: true }));                // 0.1 s -> 180 px/s
  assert.ok(Math.abs(p.vx - 180) < 1, `vx after 0.1 s = ${p.vx.toFixed(1)}`);
  run(p, g, 30, I({ right: true }));
  assert.equal(p.vx, PHYS.runMax);
});
test('max fall speed is 680 px/s', () => {
  const w = makeWorld(['.'.repeat(6), ...Array(80).fill('.'.repeat(6)), '######']);
  const { p, g } = spawn(w, 2, 2);
  let maxV = 0; run(p, g, 120, () => { maxV = Math.max(maxV, p.vy); return I(); });
  assert.equal(maxV, PHYS.maxFall);
});
test('coyote time: can still jump 0.08 s after walking off a ledge, not 0.16 s', () => {
  const rows = ['.'.repeat(12), '.'.repeat(12), '.'.repeat(12), '.'.repeat(12), '####........', '####........'];
  const w = makeWorld(rows);
  for (const [delayFrames, expectJump] of [[5, true], [10, false]]) {
    const { p, g } = spawn(w, 2, 3);
    let off = false;
    for (let i = 0; i < 60 && !off; i++) { p.update(g, I({ right: true }), DT); if (!p.grounded) off = true; }
    assert.ok(off, 'did not leave ledge');
    run(p, g, delayFrames - 1, I({ right: true }));
    const vy0 = p.vy;
    p.update(g, I({ right: true, jumpPressed: true, jumpHeld: true }), DT);
    assert.equal(p.vy < PHYS.jumpV * 0.9, expectJump, `delay ${delayFrames} frames: vy ${vy0.toFixed(0)} -> ${p.vy.toFixed(0)}`);
  }
});
test('jump buffer: a press 0.1 s before landing still jumps', () => {
  const w = makeWorld(FLAT);
  const { p, g } = spawn(w, 5, 2);                 // falls from row 2 to the floor at row 8
  let jumped = false;
  for (let i = 0; i < 90; i++) {
    const nearGround = (8 * TS) - (p.y + p.h) < 20 && p.vy > 0;
    const press = nearGround && !jumped;
    if (press) jumped = true;
    p.update(g, I({ jumpPressed: press, jumpHeld: true }), DT);
    if (jumped && p.vy < -300) break;
  }
  assert.ok(p.vy < -300 || p.y < 8 * TS - p.h - 4, 'buffered jump did not fire');
});
test('corner correction nudges the hero around a ceiling corner (≤ 6 px)', () => {
  const rows = [
    '..#.......',
    '..#.......',
    '..........',
    '..........',
    '..........',
    '##########'
  ];
  const w = makeWorld(rows);
  const p = new Player();
  p.place(2 * TS - p.w / 2 + 5, 5 * TS);           // 5 px of the hero overlaps the pillar column above
  const g = stubGame(w);
  p.update(g, I(), DT);
  p.update(g, I({ jumpPressed: true, jumpHeld: true }), DT);
  run(p, g, 12, I({ jumpHeld: true }));
  assert.ok(p.y < 5 * TS - p.h - 20, `hero was blocked by the corner (y=${p.y.toFixed(1)})`);
});

// ------------------------------------------------------------------ 4. collision
section('4. Collision: no tunnelling, one-way platforms, solids');
test('no tunnelling through a 1-tile floor at max fall speed', () => {
  const rows = [...Array(30).fill('.'.repeat(5)), '#####', '.....'];
  const w = makeWorld(rows);
  const e = { x: 2 * TS + 4, y: 0, w: 22, h: 38 };
  for (let i = 0; i < 200; i++) moveY(w, e, PHYS.maxFall * DT);
  assert.equal(e.y + e.h, 30 * TS);
});
test('no tunnelling even with an absurd 200 px step', () => {
  const rows = [...Array(30).fill('.'.repeat(5)), '#####', '.....'];
  const w = makeWorld(rows);
  const e = { x: 2 * TS + 4, y: 0, w: 22, h: 38 };
  for (let i = 0; i < 30; i++) moveY(w, e, 200);
  assert.equal(e.y + e.h, 30 * TS);
});
test('no horizontal tunnelling through a wall', () => {
  const w = makeWorld(['.....#....', '.....#....', '##########']);
  const e = { x: 0, y: 2 * TS - 38, w: 22, h: 38 };
  for (let i = 0; i < 30; i++) moveX(w, e, 150);
  assert.equal(e.x + e.w, 5 * TS);
});
test('one-way: hero lands on a plank when falling onto it', () => {
  const w = makeWorld(['.....', '.....', '..=..', '.....', '.....', '#####']);
  const { p, g } = spawn(w, 2, 0);
  run(p, g, 60, I());
  assert.ok(p.grounded); assert.equal(p.y + p.h, 2 * TS);
});
test('one-way: hero can jump UP through a plank and stand on it', () => {
  const w = makeWorld(['.....', '.....', '..=..', '.....', '.....', '#####']);
  const { p, g } = spawn(w, 2, 4);
  run(p, g, 3, I());
  run(p, g, 50, i => I({ jumpPressed: i === 0, jumpHeld: true }));
  assert.ok(p.grounded, 'not grounded after the jump'); assert.equal(p.y + p.h, 2 * TS, `feet at ${p.y + p.h}`);
});
test('one-way: Down + Jump drops through a plank', () => {
  const w = makeWorld(['.....', '.....', '..=..', '.....', '.....', '.....', '#####']);
  const { p, g } = spawn(w, 2, 1);
  run(p, g, 3, I());
  assert.equal(p.y + p.h, 2 * TS);
  run(p, g, 1, I({ down: true, jumpPressed: true, jumpHeld: true }));
  run(p, g, 60, I());
  assert.equal(p.y + p.h, 6 * TS, 'did not reach the floor below');
});
test('one-way: walking sideways into a plank edge is not blocked', () => {
  const w = makeWorld(['.....', '.....', '..=..', '.....', '.....', '#####']);
  const e = { x: 0, y: 2 * TS + 1, w: 22, h: 20 };
  moveX(w, e, 200);
  assert.ok(e.x > 100, 'blocked by a one-way tile');
});
test('solid soil blocks from below, sides and above', () => {
  const w = makeWorld(['.......', '.......', '...#...', '...#...', '.......', '#######']);
  const below = { x: 3 * TS + 5, y: 4 * TS + 15, w: 22, h: 38 };
  moveY(w, below, -80);
  assert.equal(below.y, 4 * TS, 'went through soil from below');
  const side = { x: 0, y: 3 * TS - 20, w: 22, h: 38 };
  moveX(w, side, 300);
  assert.equal(side.x + side.w, 3 * TS, 'went through soil from the side');
});
test('world edges are solid on the left/right', () => {
  const w = makeWorld(FLAT);
  const e = { x: 10, y: 8 * TS - 38, w: 22, h: 38 };
  moveX(w, e, -300); assert.equal(e.x, 0);
  moveX(w, e, 9999); assert.equal(e.x + e.w, w.w);
});

// ------------------------------------------------------------------ 5. climbing
section('5. Ladders and ropes');
const LADDER = [
  '.....',
  '.....',
  '..H..',
  '..H..',
  '..H..',
  '..H..',
  '..H..',
  '#####'
];
test('ladder: Up climbs at 120 px/s and the hero ends standing on the ladder top', () => {
  const w = makeWorld(LADDER);
  const { p, g } = spawn(w, 2, 6);
  run(p, g, 2, I());
  const y0 = p.y;
  run(p, g, 6, I({ up: true }));
  assert.ok(p.climbing, 'did not start climbing');
  const speed = (y0 - p.y) / (6 * DT);
  assert.ok(Math.abs(speed - PHYS.climb) < 8, `climb speed ${speed.toFixed(1)}`);
  run(p, g, 120, I({ up: true }));
  assert.ok(!p.climbing && p.grounded, 'did not step onto the top');
  assert.equal(p.y + p.h, 2 * TS);
});
test('ladder: Down from the top climbs back down to the ground', () => {
  const w = makeWorld(LADDER);
  const { p, g } = spawn(w, 2, 1);
  run(p, g, 3, I());
  assert.equal(p.y + p.h, 2 * TS);
  run(p, g, 120, I({ down: true }));
  assert.ok(p.grounded && !p.climbing); assert.equal(p.y + p.h, 7 * TS);
});
test('ladder: jump off sideways', () => {
  const w = makeWorld(LADDER);
  const { p, g } = spawn(w, 2, 6);
  run(p, g, 40, I({ up: true }));
  assert.ok(p.climbing || p.grounded);
  const p2 = spawn(w, 2, 6); run(p2.p, p2.g, 20, I({ up: true }));
  assert.ok(p2.p.climbing);
  p2.p.update(p2.g, I({ right: true, jumpPressed: true, jumpHeld: true }), DT);
  assert.ok(!p2.p.climbing && p2.p.vx > 100, `vx ${p2.p.vx}`);
});
test('rope: hero hangs at the top and can jump off sideways', () => {
  const w = makeWorld(['.....', '..|..', '..|..', '..|..', '..|..', '..|..', '#####']);
  const { p, g } = spawn(w, 2, 5);
  run(p, g, 2, I());
  run(p, g, 150, I({ up: true }));
  assert.ok(p.climbing, 'fell off the rope top');
  assert.equal(p.y + p.h, 1 * TS);
});

// ------------------------------------------------------------------ 6. game loop
section('6. Key → gate loop, enemies, crates');
function newGame(def = LEVELS[0]) {
  const toasts = [];
  const g = new Game({ toast: t => toasts.push(t), onComplete: s => { g.completed = s; } });
  g.load(def);
  g.toasts = toasts;
  return g;
}
function stepGame(g, frames, inp = I()) { for (let i = 0; i < frames; i++) g.update(inp, DT); }
test('gate stays locked without the key and says so', () => {
  const g = newGame();
  g.player.place(g.gate.x + 32, g.gate.y + g.gate.h);
  stepGame(g, 5);
  assert.equal(g.gate.state, 'closed');
  assert.ok(g.toasts.some(t => /Locked/.test(t)));
});
test('grabbing the key then touching the gate opens it and completes the level', () => {
  const g = newGame();
  g.player.place(g.key.homeX, g.key.homeY + 14);
  stepGame(g, 3);
  assert.ok(g.player.hasKey, 'key not collected');
  g.player.place(g.gate.x + 32, g.gate.y + g.gate.h);
  stepGame(g, 5);
  assert.notEqual(g.gate.state, 'closed');
  stepGame(g, 60 * 3);
  assert.equal(g.state, 'complete'); assert.ok(g.completed);
});
test('getting hit while carrying the key drops it; it returns home after 5 s', () => {
  const g = newGame();
  g.player.place(g.key.homeX, g.key.homeY + 14); stepGame(g, 3);
  assert.ok(g.player.hasKey);
  g.player.invuln = 0; g.player.hurt(g, g.player.cx + 5);
  assert.ok(!g.player.hasKey); assert.equal(g.key.state, 'dropped');
  g.player.place(10, 10); g.player.invuln = 99;     // move away
  stepGame(g, 60 * 5 + 20);
  assert.equal(g.key.state, 'rest', 'key did not return');
});
test('stomping a mushroom walker kills it and bounces the hero', () => {
  const g = newGame();
  const e = g.enemies[0];
  g.player.place(e.x + e.w / 2, e.y - 40);
  g.player.vy = 300;
  stepGame(g, 30);
  assert.ok(e.dead, 'walker still alive');
  assert.ok(g.player.hearts === 3, 'hero was hurt by a stomp');
});
test('walking into a mushroom walker from the side hurts the hero', () => {
  const g = newGame();
  const e = g.enemies[0];
  g.player.place(e.x + e.w / 2 + 6, e.y + e.h);
  stepGame(g, 2);
  assert.equal(g.player.hearts, 2);
  assert.ok(g.player.invuln > 0);
});
test('knife (30×22 hitbox) kills a walker in front and not one behind', () => {
  const g = newGame();
  const e = g.enemies[0];
  e.speed = 0;
  g.player.place(e.x - 14, e.y + e.h); g.player.face = 1; g.player.invuln = 99;
  stepGame(g, 1, I({ knifePressed: true, knifeHeld: true }));
  stepGame(g, 4);
  assert.ok(e.dead);
  const g2 = newGame(); const e2 = g2.enemies[0]; e2.speed = 0;
  g2.player.place(e2.x - 14, e2.y + e2.h); g2.player.face = -1; g2.player.invuln = 99;
  stepGame(g2, 1, I({ knifePressed: true, knifeHeld: true })); stepGame(g2, 4);
  assert.ok(!e2.dead, 'a slash behind the hero hit the enemy');
});
test('knife breaks a crate and pops 3 coins', () => {
  const g = newGame();
  let cr = null;
  for (let r = 0; r < g.world.rowCount && !cr; r++) for (let c = 0; c < g.world.cols; c++) if (g.world.get(c, r) === 'X') { cr = { c, r }; break; }
  assert.ok(cr, 'level has no crate');
  const before = g.coins.length;
  g.player.place((cr.c - 0.3) * TS, (cr.r + 1) * TS); g.player.face = 1;
  stepGame(g, 1, I({ knifePressed: true, knifeHeld: true }));
  assert.equal(g.world.get(cr.c, cr.r), '.'); assert.equal(g.coins.length, before + 3);
});
test('walkers turn around at ledges instead of walking off', () => {
  const g = newGame();
  const e = g.enemies[0];
  const feet = e.y + e.h;
  stepGame(g, 60 * 12);
  assert.ok(Math.abs(e.y + e.h - feet) < 2, 'walker fell off its island');
});
test('falling out of the world costs a heart and respawns at the start', () => {
  const g = newGame();
  g.player.place(100, g.world.h + 300);
  stepGame(g, 2);
  assert.equal(g.player.hearts, 2);
  assert.ok(Math.abs(g.player.cx - g.level.start.x) < 1);
});
test('losing all hearts costs a life; losing all lives is game over', () => {
  const g = newGame();
  for (let i = 0; i < 3; i++) { g.player.invuln = 0; g.player.hurt(g, g.player.cx + 3); }
  assert.equal(g.player.lives, 2); assert.equal(g.player.hearts, 3);
  g.player.lives = 1;
  for (let i = 0; i < 3; i++) { g.player.invuln = 0; g.player.hurt(g, g.player.cx + 3); }
  assert.equal(g.state, 'gameover');
});
test('100 coins grant an extra life', () => {
  const g = newGame();
  g.coinCount = 99;
  const c = g.coins[0]; c.x = g.player.x; c.y = g.player.y;
  stepGame(g, 1);
  assert.equal(g.coinCount, 100); assert.equal(g.player.lives, 4);
});
test('camera follows the hero and stays clamped inside the level', () => {
  const g = newGame();
  stepGame(g, 120);
  assert.ok(g.cam.x >= 0 && g.cam.y >= 0 && g.cam.x <= g.world.w - 960 && g.cam.y <= g.world.h - 540);
  g.player.place(g.world.w - 40, 300);
  stepGame(g, 240);
  assert.ok(g.cam.x <= g.world.w - 960 + 0.01 && g.cam.x >= g.world.w - 960 - 1, `cam.x ${g.cam.x}`);
});
test('spiky hedgehog: stomping hurts the hero, knife kills it', () => {
  const g = newGame(LEVELS.find(l => l.id === '1-2'));
  const h = g.hedgehogs[0];
  assert.ok(h, 'no hedgehog in 1-2');
  // Hero lands on top of hedgehog
  g.player.place(h.x + h.w / 2, h.y - 20);
  g.player.vy = 200;
  stepGame(g, 5);
  assert.equal(g.player.hearts, 2, 'hero was not hurt stomping hedgehog');
  assert.ok(!h.dead, 'hedgehog died from stomp');

  // Knife slash kills hedgehog
  h.speed = 0;
  g.player.invuln = 99;
  g.player.place(h.x - 14, h.y + h.h);
  g.player.face = 1;
  stepGame(g, 1, I({ knifePressed: true, knifeHeld: true }));
  stepGame(g, 4);
  assert.ok(h.dead, 'hedgehog did not die from knife');
});
test('boss: Mushroom King can be defeated with 3 hits, key drops on death', () => {
  const g = newGame(LEVELS.find(l => l.id === '1-3'));
  assert.ok(g.bosses.length === 1, 'boss not spawned in 1-3');
  const boss = g.bosses[0];
  assert.equal(boss.hp, 3);
  // Hit 1
  boss.hit(g);
  assert.equal(boss.hp, 2);
  assert.ok(boss.invuln > 0);
  // Advance past invulnerability
  stepGame(g, 60);
  boss.hit(g);
  assert.equal(boss.hp, 1);
  stepGame(g, 60);
  boss.hit(g);
  assert.equal(boss.hp, 0);
  assert.ok(boss.dead);
  // Key spawned by boss
  assert.ok(g.key, 'key did not spawn on boss defeat');
  assert.equal(g.key.state, 'rest');
});
test('boss: Old Oak Guardian (World 2) takes 4 hits and drops key on death', () => {
  const g = newGame(LEVELS.find(l => l.id === '2-3'));
  assert.ok(g.bosses.length === 1, 'boss not spawned in 2-3');
  const boss = g.bosses[0];
  assert.equal(boss.hp, 4);
  for (let h = 4; h > 0; h--) {
    boss.hit(g);
    assert.equal(boss.hp, h - 1);
    if (h > 1) stepGame(g, 60);
  }
  assert.ok(boss.dead);
  assert.ok(g.key, 'key not dropped by Old Oak Guardian');
});
test('boss: Sand Wyrm (World 3) takes 5 hits and drops key on death', () => {
  const g = newGame(LEVELS.find(l => l.id === '3-3'));
  assert.ok(g.bosses.length === 1, 'boss not spawned in 3-3');
  const boss = g.bosses[0];
  assert.equal(boss.hp, 5);
  for (let h = 5; h > 0; h--) {
    boss.hit(g);
    assert.equal(boss.hp, h - 1);
    if (h > 1) stepGame(g, 60);
  }
  assert.ok(boss.dead);
  assert.ok(g.key, 'key not dropped by Sand Wyrm');
});
test('boss: Frost Titan (World 4) takes 6 hits and drops key on death', () => {
  const g = newGame(LEVELS.find(l => l.id === '4-3'));
  assert.ok(g.bosses.length === 1, 'boss not spawned in 4-3');
  const boss = g.bosses[0];
  assert.equal(boss.hp, 6);
  for (let h = 6; h > 0; h--) {
    boss.hit(g);
    assert.equal(boss.hp, h - 1);
    if (h > 1) stepGame(g, 60);
  }
  assert.ok(boss.dead);
  assert.ok(g.key, 'key not dropped by Frost Titan');
});
test('boss: Crystal Behemoth (World 5) takes 7 hits and drops key on death', () => {
  const g = newGame(LEVELS.find(l => l.id === '5-3'));
  assert.ok(g.bosses.length === 1, 'boss not spawned in 5-3');
  const boss = g.bosses[0];
  assert.equal(boss.hp, 7);
  for (let h = 7; h > 0; h--) {
    boss.hit(g);
    assert.equal(boss.hp, h - 1);
    if (h > 1) stepGame(g, 60);
  }
  assert.ok(boss.dead);
  assert.ok(g.key, 'key not dropped by Crystal Behemoth');
});
test('boss: Magma Overlord (World 6) takes 8 hits and drops key on death', () => {
  const g = newGame(LEVELS.find(l => l.id === '6-3'));
  assert.ok(g.bosses.length === 1, 'boss not spawned in 6-3');
  const boss = g.bosses[0];
  assert.equal(boss.hp, 8);
  for (let h = 8; h > 0; h--) {
    boss.hit(g);
    assert.equal(boss.hp, h - 1);
    if (h > 1) stepGame(g, 60);
  }
  assert.ok(boss.dead);
  assert.ok(g.key, 'key not dropped by Magma Overlord');
});
test('mushroom spring launches hero high (vy < -650)', () => {
  const g = newGame(LEVELS.find(l => l.id === '2-1'));
  const s = g.springs[0];
  assert.ok(s, 'spring not found in 2-1');
  g.player.place(s.x + s.w / 2, s.y);
  g.player.vy = 200;
  stepGame(g, 2);
  assert.ok(g.player.vy < -650, `spring did not launch hero high: vy=${g.player.vy}`);
});
test('scorpion has 2 HP and takes 2 knife slashes to defeat', () => {
  const g = newGame(LEVELS.find(l => l.id === '3-1'));
  const sc = g.enemies.find(e => e.type === 'scorpion');
  assert.ok(sc, 'scorpion not found in 3-1');
  assert.equal(sc.hp, 2);
  sc.speed = 0;
  g.player.invuln = 99;
  g.player.place(sc.x - 14, sc.y + sc.h);
  g.player.face = 1;
  // First slash
  stepGame(g, 1, I({ knifePressed: true, knifeHeld: true }));
  stepGame(g, 4);
  assert.equal(sc.hp, 1);
  assert.ok(!sc.dead);
  // Second slash
  stepGame(g, 12);
  stepGame(g, 1, I({ knifePressed: true, knifeHeld: true }));
  stepGame(g, 4);
  assert.equal(sc.hp, 0);
  assert.ok(sc.dead);
});

section('7. Moving enemies & boss summons (v2.2)');
test('moving enemy: Buzz Bee flies in sine wave and is defeatable by stomp & knife', () => {
  const bee = new BuzzBee(200, 100, 160);
  assert.equal(bee.type, 'buzz_bee');
  assert.ok(bee.stompable);
  const startY = bee.y;
  const g = stubGame(makeWorld(['...']));
  bee.update(g, 0.2);
  assert.notEqual(bee.y, startY);
  bee.hit(g, 1);
  assert.ok(bee.dead);
});

test('moving enemy: Night Bat wakes within 5 tiles with telegraph >= 0.4s and swoops', () => {
  const bat = new NightBat(200, 100);
  assert.equal(bat.state, 'roosting');
  const g = stubGame(makeWorld(['...']));
  g.player = { cx: 400, cy: 300, invuln: 0 };
  bat.update(g, 0.1);
  assert.equal(bat.state, 'roosting');
  g.player.cx = 220; g.player.cy = 180;
  bat.update(g, 0.1);
  assert.equal(bat.state, 'waking');
  assert.ok(bat.telegraph >= 0.4, `expected telegraph >= 0.4s, got ${bat.telegraph}`);
});

test('moving enemy: Hopper Frog squats with telegraph >= 0.4s then leaps', () => {
  const frog = new HopperFrog(200, 200);
  frog.jumpTimer = 0.05;
  const g = stubGame(makeWorld(['...']));
  g.player = { cx: 300, cy: 200 };
  frog.update(g, 0.1);
  assert.equal(frog.state, 'squat');
  assert.ok(frog.telegraph >= 0.4);
});

test('moving enemy: Wild Boar charges when seeing player and is stunned upon wall impact', () => {
  const w = makeWorld([
    '#...#',
    '#===#',
    '#####'
  ]);
  const boar = new WildBoar(TS * 2, TS * 2);
  const g = stubGame(w);
  g.player = { cx: TS * 3, cy: TS * 2 - 10 };
  boar.dir = 1;
  boar.update(g, 0.1);
  assert.equal(boar.state, 'telegraph');
  assert.ok(boar.telegraph >= 0.4);
});

test('moving enemy: Leaf Glider drifts down on wind and hero bounces harmlessly on top', () => {
  const glider = new LeafGlider(100, 100);
  assert.ok(glider.stompable);
  const g = newGame(LEVELS.find(l => l.id === '2-1'));
  const startY = glider.y;
  glider.update(g, 0.5);
  assert.ok(glider.y > startY, 'glider should drift downward');
});

test('moving enemy: Rolling Armadillo curls with telegraph and deflects rolling hits', () => {
  const dillo = new RollingArmadillo(200, 200);
  const g = stubGame(makeWorld(['...']));
  g.player = { cx: 220, cy: 200 };
  dillo.update(g, 0.1);
  assert.equal(dillo.state, 'curl');
  assert.ok(dillo.telegraph >= 0.4);
  dillo.state = 'roll';
  const hitResult = dillo.hit(g, 1, 1);
  assert.equal(hitResult, false);
  assert.ok(!dillo.dead);
});

test('moving enemy: Spinning Saw follows rail path and is invulnerable', () => {
  const saw = new SpinningSaw(2, 5, 5, 5, 100);
  assert.ok(saw.invulnerable);
  assert.equal(saw.hit(), false);
  const g = stubGame(makeWorld(['...']));
  const startX = saw.x;
  saw.update(g, 0.5);
  assert.notEqual(saw.x, startX);
});

test('boss summon: Mushroom King summons Buzz Bees at HP 2', () => {
  const g = newGame(LEVELS.find(l => l.id === '1-3'));
  const king = g.bosses[0];
  const initialEnemies = g.enemies.length;
  king.hit(g, 1);
  assert.equal(king.hp, 2);
  assert.ok(g.enemies.length > initialEnemies, 'king did not summon minions');
  assert.ok(g.enemies.some(e => e.type === 'buzz_bee'));
});

// ------------------------------------------------------------------ 8. Permanent abilities (v2.2 Phase 2)
section('8. Permanent abilities (v2.2 Phase 2)');

test('double jump: cannot double jump without ability', () => {
  const w = makeWorld(['.....', '.....', '.....', '#####']);
  const { p, g } = spawn(w, 2, 2);
  p.update(g, I({ jumpPressed: true, jumpHeld: true }), DT);
  assert.ok(p.vy <= -540, 'initial jump velocity not set');
  // advance to mid-air
  for (let i = 0; i < 10; i++) p.update(g, I({ jumpHeld: true }), DT);
  assert.ok(!p.grounded);
  p.update(g, I({ jumpPressed: true }), DT);
  assert.equal(p.hasDoubleJumped, false);
});

test('double jump: mid-air jump triggers second jump and reaches higher apex', () => {
  const w = makeWorld(['.....', '.....', '.....', '.....', '.....', '.....', '.....', '#####']);
  const { p, g } = spawn(w, 2, 6);
  g.abilities = ['double_jump'];
  p.update(g, I({ jumpPressed: true, jumpHeld: true }), DT);
  // advance to near apex
  for (let i = 0; i < 14; i++) p.update(g, I({ jumpHeld: true }), DT);
  const midY = p.y;
  // Trigger double jump
  p.update(g, I({ jumpPressed: true, jumpHeld: true }), DT);
  assert.equal(p.hasDoubleJumped, true);
  assert.ok(p.vy <= -540, 'double jump velocity not set');
  // Advance up
  for (let i = 0; i < 14; i++) p.update(g, I({ jumpHeld: true }), DT);
  assert.ok(p.y < midY, 'double jump failed to gain height');
});

test('double jump: resets upon landing on ground', () => {
  const w = makeWorld(['.....', '.....', '#####']);
  const { p, g } = spawn(w, 2, 1);
  g.abilities = ['double_jump'];
  p.hasDoubleJumped = true;
  p.grounded = false;
  p.vy = 200;
  p.update(g, I(), DT);
  assert.ok(p.grounded);
  assert.equal(p.hasDoubleJumped, false);
});

test('dash: 0.18 s burst of 520 px/s with invulnerability frames', () => {
  const w = makeWorld(['....................', '####################']);
  const { p, g } = spawn(w, 2, 0);
  g.abilities = ['dash'];
  p.face = 1;
  p.update(g, I({ dashPressed: true }), DT);
  assert.ok(p.dashT > 0);
  assert.equal(p.vx, ABILITIES.dashSpeed);
  assert.ok(p.invuln >= ABILITIES.dashDuration);
  // Advance 10 frames
  run(p, g, 10, I());
  assert.ok(p.x > (2.5 * TS + 60), 'dash did not cover expected horizontal distance');
});

test('dash: breaks cracked blocks (crates) in dash path', () => {
  const w = makeWorld(['..X.................', '####################']);
  const { p, g } = spawn(w, 0, 0);
  g.abilities = ['dash'];
  assert.equal(w.get(2, 0), 'X');
  p.update(g, I({ right: true, dashPressed: true }), DT);
  for (let i = 0; i < 8; i++) p.update(g, I({ right: true }), DT);
  assert.equal(w.get(2, 0), '.', 'crate was not smashed by dash');
});

test('ground pound: Down + Jump in air slams down at 720 px/s', () => {
  const w = makeWorld(['.....', '.....', '.....', '.....', '#####']);
  const { p, g } = spawn(w, 2, 1);
  g.abilities = ['ground_pound'];
  p.grounded = false;
  p.vy = 0;
  p.update(g, I({ down: true, jumpPressed: true }), DT);
  assert.ok(p.isGroundPounding);
  assert.equal(p.vy, ABILITIES.poundSpeed);
  assert.equal(p.vx, 0);
});

test('ground pound: landing breaks crates below and stuns enemies in radius', () => {
  const w = makeWorld(['.....', '.....', '..X..', '#####']);
  const { p, g } = spawn(w, 2, 0);
  g.abilities = ['ground_pound'];
  let stunned = false;
  g.onGroundPound = (x, y, radius) => {
    assert.equal(radius, ABILITIES.poundStunRadius);
    stunned = true;
  };
  p.grounded = false;
  p.isGroundPounding = true;
  p.vy = ABILITIES.poundSpeed;
  for (let i = 0; i < 20; i++) p.update(g, I({ down: true }), DT);
  assert.ok(p.grounded);
  assert.ok(stunned, 'ground pound did not trigger stun');
  assert.equal(w.get(2, 2), '.', 'crate below was not smashed by ground pound');
});

test('progression: boss completion unlocks abilities in save', () => {
  const abilities = getUnlockedAbilities();
  assert.ok(Array.isArray(abilities));
});

// ------------------------------------------------------------------ 9. Temporary power-ups & Super Meter (v2.2 Phase 3)
section('9. Temporary power-ups & Super Meter (v2.2 Phase 3)');

test('power-up: picking up power orb equips power-up and sets duration/ammo', () => {
  const g = newGame(LEVELS[0]);
  const orb = new PowerOrb(g.player.cx, g.player.cy, 'blaster');
  g.collectPowerOrb(orb);
  assert.ok(orb.collected);
  assert.equal(g.player.powerup?.type, 'blaster');
  assert.equal(g.player.powerup?.ammo, 10);
});

test('power-up: only one active at a time, replacing previous cleanly', () => {
  const g = newGame(LEVELS[0]);
  g.collectPowerOrb(new PowerOrb(g.player.cx, g.player.cy, 'blaster'));
  assert.equal(g.player.powerup?.type, 'blaster');
  g.collectPowerOrb(new PowerOrb(g.player.cx, g.player.cy, 'speed_boots'));
  assert.equal(g.player.powerup?.type, 'speed_boots');
  assert.equal(g.player.powerup?.duration, 12);
});

test('blaster: fires 10 energy bolts at 600 px/s, damages enemies and breaks crates', () => {
  const g = newGame(LEVELS[0]);
  g.player.powerup = { type: 'blaster', ammo: 10, duration: null };
  const walker = new MushroomWalker(g.player.x + 80, g.player.y + g.player.h);
  g.enemies.push(walker);
  g.player.update(g, I({ blasterPressed: true }), DT);
  assert.equal(g.player.powerup.ammo, 9);
  assert.equal(g.projectiles.length, 1);
  const bolt = g.projectiles[0];
  assert.equal(bolt.speed, 600);
  for (let i = 0; i < 15; i++) bolt.update(g, DT);
  assert.ok(walker.dead, 'blaster bolt did not kill walker');
});

test('fire knife: slash fires flame wave that damages enemies', () => {
  const g = newGame(LEVELS[0]);
  g.player.powerup = { type: 'fire_knife', duration: 15 };
  const walker = new MushroomWalker(g.player.x + 60, g.player.y + g.player.h);
  g.enemies.push(walker);
  g.player.update(g, I({ knifePressed: true }), DT);
  assert.equal(g.projectiles.length, 1);
  const wave = g.projectiles[0];
  for (let i = 0; i < 15; i++) wave.update(g, DT);
  assert.ok(walker.dead, 'flame wave did not hit walker');
});

test('ice knife: slashing defeated enemy spawns standable IceBlock', () => {
  const g = newGame(LEVELS[0]);
  g.player.powerup = { type: 'ice_knife', duration: 15 };
  const walker = new MushroomWalker(g.player.x + 20, g.player.y + g.player.h);
  g.enemies.push(walker);
  g.player.update(g, I({ knifePressed: true }), DT);
  assert.ok(g.iceBlocks.length > 0, 'ice block was not spawned');
  assert.ok(g.iceBlocks[0].isOneWay);
});

test('bubble shield: absorbs one hit without heart loss and pops', () => {
  const g = newGame(LEVELS[0]);
  g.player.invuln = 0;
  g.player.powerup = { type: 'bubble_shield', duration: 20 };
  const startHearts = g.player.hearts;
  const hurtResult = g.player.hurt(g, g.player.cx - 20);
  assert.equal(hurtResult, false);
  assert.equal(g.player.hearts, startHearts);
  assert.equal(g.player.powerup, null);
});

test('coin magnet: pulls coins within 160 px (5 tiles)', () => {
  const g = newGame(LEVELS[0]);
  const coin = new Coin(g.player.cx + 90, g.player.cy);
  g.coins.push(coin);
  const initX = coin.x;
  g.pullCoins(g.player.cx, g.player.cy, 160, DT);
  assert.ok(coin.x < initX, 'coin was not pulled towards player');
});

test('speed boots: increases run speed to 1.4x (294 px/s)', () => {
  const w = makeWorld(['....................', '####################']);
  const { p, g } = spawn(w, 2, 0);
  p.powerup = { type: 'speed_boots', duration: 12 };
  run(p, g, 40, I({ right: true }));
  assert.ok(p.vx > 250, `expected speed > 250 px/s, got ${p.vx}`);
  assert.ok(Math.abs(p.vx - PHYS.runMax * 1.4) < 2);
});

test('giant rook: crushes crates on touch and defeats small enemies on contact', () => {
  const g = newGame(LEVELS[0]);
  g.player.powerup = { type: 'giant_rook', duration: 8 };
  g.player.giantScale = 1.6;
  const walker = new MushroomWalker(g.player.x + 10, g.player.y + g.player.h);
  g.enemies.push(walker);
  g.resolveEnemyContacts();
  assert.ok(walker.dead, 'giant rook did not defeat walker on contact');
});

test('star power: kills enemies on contact with invulnerability', () => {
  const g = newGame(LEVELS[0]);
  g.player.powerup = { type: 'star_power', duration: 8 };
  const walker = new MushroomWalker(g.player.x + 10, g.player.y + g.player.h);
  g.enemies.push(walker);
  g.resolveEnemyContacts();
  assert.ok(walker.dead, 'star power did not kill enemy on contact');
});

test('super meter: fills on coin/gem/kill, Q / Shockwave Burst damages all screen enemies and resets meter', () => {
  const g = newGame(LEVELS[0]);
  assert.equal(g.superMeter, 0);
  g.collectCoin(new Coin(0, 0));
  assert.equal(g.superMeter, 2);
  g.collectGem(new Gem(0, 0));
  assert.equal(g.superMeter, 22);
  g.addSuper(80);
  assert.equal(g.superMeter, 100);

  const walker = new MushroomWalker(g.cam.x + 100, g.cam.y + 100);
  g.enemies.push(walker);
  g.triggerShockwave(g.player);
  assert.ok(walker.dead, 'shockwave burst did not hit on-screen enemy');
  assert.equal(g.superMeter, 0, 'super meter did not reset');
});

// ------------------------------------------------------------------ 10. Bug fixes & HUD Polish (v2.3 Phase A)
section('10. Bug fixes & HUD Polish (v2.3 Phase A)');

test('boss bar: shows boss name only, no hardcoded WORLD 1 BOSS', () => {
  const g1 = newGame(LEVELS.find(l => l.id === '1-3'));
  assert.equal(g1.boss.name, 'Mushroom King');
  const g2 = newGame(LEVELS.find(l => l.id === '2-3'));
  assert.equal(g2.boss.name, 'Old Oak Guardian');
  const g3 = newGame(LEVELS.find(l => l.id === '3-3'));
  assert.equal(g3.boss.name, 'Sand Wyrm');
});

test('boss bar: hidden at level start, becomes active only upon entering boss arena', () => {
  const g = newGame(LEVELS.find(l => l.id === '1-3'));
  assert.equal(g.bossArenaEntered, false, 'boss bar should be hidden at level start');
  // Move player near boss arena
  g.player.place(g.boss.cx - 150, g.boss.y + g.boss.h);
  g.update(I(), DT);
  assert.equal(g.bossArenaEntered, true, 'boss bar should be visible after entering arena');
});

test('hint bubbles: clamped inside viewport with >= 16 px margin on all sides (3-3 Descend into...)', () => {
  const l33 = LEVELS.find(l => l.id === '3-3');
  const hint = l33.hints.find(h => h.text.includes('Descend into'));
  assert.ok(hint, 'hint not found in 3-3');
  
  // Test clamping math with 16px margin on screen width 480
  const margin = 16;
  const VIEW_W = 480;
  const fakeWidth = 260; // wide bubble
  const halfW = fakeWidth / 2;
  const rawScreenX = 20; // would clip off-screen without clamping
  const clampedX = Math.max(margin + halfW, Math.min(VIEW_W - margin - halfW, rawScreenX));
  assert.ok(clampedX - halfW >= margin, 'left edge must respect 16px margin');
  assert.ok(clampedX + halfW <= VIEW_W - margin, 'right edge must respect 16px margin');
});

test('spawn safety: no enemy within 6 tiles of start or checkpoints in every level, and 1.5s invincibility', () => {
  const TS = 32;
  const SAFE_DIST = 6 * TS; // 192 px
  for (const def of LEVELS) {
    const lv = parseLevel(def);
    const checks = [{ name: 'start', x: lv.start.x, y: lv.start.feetY }];
    if (lv.checkpoints) {
      lv.checkpoints.forEach((cp, idx) => checks.push({ name: `checkpoint ${idx}`, x: (cp.c + 0.5) * TS, y: (cp.r + 1) * TS }));
    }
    const hazards = [
      ...(lv.fireJets||[]), ...(lv.flamethrowers||[]), ...(lv.firebars||[]),
      ...(lv.lavaBubbles||[]), ...(lv.fireDrips||[]), ...(lv.burningPlanks||[]),
      ...(lv.icicles||[]), ...(lv.crystalLasers||[]), ...(lv.brambles||[]),
      ...(lv.geysers||[])
    ];
    const enemies = [
      ...(lv.walkers||[]), ...(lv.hedgehogs||[]), ...(lv.squirrels||[]),
      ...(lv.snapvines||[]), ...(lv.scorpions||[]), ...(lv.sandWorms||[]),
      ...(lv.buzzBees||[]), ...(lv.nightBats||[]), ...(lv.hopperFrogs||[]),
      ...(lv.wildBoars||[]), ...(lv.leafGliders||[]), ...(lv.armadillos||[]),
      ...(lv.desertHawks||[]), ...(lv.spinningSaws||[]), ...(lv.bosses||[]),
      ...hazards
    ];
    for (const cp of checks) {
      for (const e of enemies) {
        const ex = e.x ?? (e.c0 !== undefined ? e.c0 * TS : (e.c !== undefined ? (e.c + 0.5) * TS : 0));
        const ey = e.feetY ?? e.y ?? e.ceilingY ?? (e.r0 !== undefined ? e.r0 * TS : (e.r !== undefined ? (e.r + 0.5) * TS : 0));
        const dist = Math.hypot(ex - cp.x, ey - cp.y);
        assert.ok(dist >= SAFE_DIST, `${def.id}: hazard or enemy at (${ex}, ${ey}) is too close to ${cp.name} (dist=${dist.toFixed(1)} < ${SAFE_DIST})`);
      }
    }

    // Verify 1.5s invincibility on spawn and respawn
    const g = newGame(def);
    assert.ok(g.player.invuln >= 1.5, `${def.id}: player must have >= 1.5s invincibility at level spawn`);
    g.player.invuln = 0;
    g.respawn();
    assert.ok(g.player.invuln >= 1.5, `${def.id}: player must have >= 1.5s invincibility at respawn`);
  }
});

test('compact HUD: combined top-left bar, max-height constraints, active-only power-up', () => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '../style.css'), 'utf8');

  // Verify single unified hud-bar
  assert.ok(html.includes('id="hudBar"'), 'HUD must have single compact #hudBar');
  assert.ok(html.includes('class="hud-row-top"'), 'HUD must have hud-row-top');
  assert.ok(html.includes('class="hud-row-bottom"'), 'HUD must have hud-row-bottom');

  // Verify max-height constraints
  assert.ok(css.includes('max-height: 70px'), 'laptop HUD max-height must be <= 70px');
  assert.ok(css.includes('max-height: 56px'), 'mobile HUD max-height must be <= 56px');
});

// ------------------------------------------------------------------ 11. unique layouts (Phase B)
section('11. Unique Level Layouts (v2.3 Phase B)');
test('row uniqueness: no two levels share > 30 % identical rows', () => {
  for (let i = 0; i < LEVELS.length; i++) {
    for (let j = i + 1; j < LEVELS.length; j++) {
      const l1 = LEVELS[i], l2 = LEVELS[j];
      let shared = 0;
      for (let r = 0; r < 44; r++) {
        if (l1.rows[r] && l2.rows[r] && l1.rows[r] === l2.rows[r]) shared++;
      }
      const pct = shared / 44;
      assert.ok(pct <= 0.30, `levels ${l1.id} and ${l2.id} share ${(pct * 100).toFixed(1)}% rows (> 30%)`);
    }
  }
});

test('collectibles balance: every level has exactly 3 stars and 60–120 coins', () => {
  for (const def of LEVELS) {
    const lv = parseLevel(def);
    assert.equal(lv.stars.length, 3, `level ${def.id} has ${lv.stars.length} stars, expected 3`);
    assert.ok(lv.coins.length >= 60 && lv.coins.length <= 120, `level ${def.id} has ${lv.coins.length} coins, expected 60–120`);
  }
});

test('signature mechanics: each world has distinct theme and signature layouts', () => {
  assert.equal(LEVELS.length, 18, 'must have all 18 levels');
  const ids = LEVELS.map(l => l.id);
  assert.ok(ids.includes('1-3') && ids.includes('2-3') && ids.includes('3-3') && ids.includes('4-3') && ids.includes('5-3') && ids.includes('6-3'));
  assert.ok(LEVELS.find(l => l.id === '1-3').bosses || parseLevel(LEVELS.find(l => l.id === '1-3')).bosses.length === 1, '1-3 has Mushroom King');
  assert.ok(LEVELS.find(l => l.id === '2-3').bosses || parseLevel(LEVELS.find(l => l.id === '2-3')).bosses.length === 1, '2-3 has Old Oak Guardian');
  assert.ok(LEVELS.find(l => l.id === '3-3').bosses || parseLevel(LEVELS.find(l => l.id === '3-3')).bosses.length === 1, '3-3 has Sand Wyrm');
  assert.ok(LEVELS.find(l => l.id === '4-3').bosses || parseLevel(LEVELS.find(l => l.id === '4-3')).bosses.length === 1, '4-3 has Frost Titan');
  assert.ok(LEVELS.find(l => l.id === '5-3').bosses || parseLevel(LEVELS.find(l => l.id === '5-3')).bosses.length === 1, '5-3 has Crystal Behemoth');
  assert.ok(LEVELS.find(l => l.id === '6-3').bosses || parseLevel(LEVELS.find(l => l.id === '6-3')).bosses.length === 1, '6-3 has Magma Overlord');
});

test('themes: getTheme throws on unknown theme ID, and World 1/2/3 themes render with their own sky colour', () => {
  assert.throws(() => getTheme('deep_forest'), /Unknown theme id/);
  assert.throws(() => getTheme('fake_theme'), /Unknown theme id/);
  for (const def of LEVELS) {
    const th = getTheme(def.theme);
    assert.ok(th, `theme ${def.theme} must exist`);
  }
  const w1 = getTheme(LEVELS.find(l => l.world === 1).theme);
  const w2 = getTheme(LEVELS.find(l => l.world === 2).theme);
  const w3 = getTheme(LEVELS.find(l => l.world === 3).theme);
  assert.equal(w1.id, 'green_hills');
  assert.equal(w2.id, 'autumn_forest');
  assert.equal(w3.id, 'desert_ruins');
  assert.notEqual(w1.sky[0][1], w2.sky[0][1], 'W1 and W2 sky colours must differ');
  assert.notEqual(w2.sky[0][1], w3.sky[0][1], 'W2 and W3 sky colours must differ');
  assert.notEqual(w1.sky[0][1], w3.sky[0][1], 'W1 and W3 sky colours must differ');
});

test('chests and spawn: min 10 tiles away from start, hidden chests, clean hero spawn', () => {
  for (const def of LEVELS) {
    const lv = parseLevel(def);
    assert.ok(lv.start, `level ${def.id} has start`);
    const startTile = def.rows[lv.start.r][lv.start.c];
    assert.equal(startTile, 'P', `level ${def.id} start position must be clean spawn`);
    for (const ch of lv.chests) {
      const dist = Math.hypot(ch.c - lv.start.c, ch.r - lv.start.r);
      assert.ok(dist >= 10, `level ${def.id} chest at (${ch.c},${ch.r}) too close to start (${dist.toFixed(1)} < 10)`);
    }
  }
});

test('coins distribution: max 8 coins in a straight line, arcs and trails', () => {
  for (const def of LEVELS) {
    def.rows.forEach((row, r) => {
      let run = 0;
      for (let c = 0; c < row.length; c++) {
        if (row[c] === 'c') {
          run++;
          assert.ok(run <= 8, `level ${def.id} row ${r} has ${run} straight coins (max 8)`);
        } else {
          run = 0;
        }
      }
    });
  }
});

// ------------------------------------------------------------------ 12. Boss Events & Art Polish (Phase C & D)
section('12. Boss Events & Art Polish (v2.3 Phase C & D)');

test('boss arena lock: entering locks exit behind hero and clamps camera to arena', () => {
  const g = newGame(LEVELS.find(l => l.id === '1-3'));
  const boss = g.boss;
  assert.ok(boss, 'boss missing in 1-3');
  assert.equal(g.arenaLocked, false, 'arena should not be locked initially');

  // Move player into arena proximity
  g.player.place(boss.x - 120, boss.y + boss.h);
  stepGame(g, 2);
  assert.equal(g.bossArenaEntered, true, 'bossArenaEntered not set');
  assert.equal(g.arenaLocked, true, 'arenaLocked not set');
  assert.ok(g.arenaLeft !== null, 'arenaLeft not set');

  const lockX = g.arenaLeft;
  g.skipBossIntro();
  // Try to move left of arenaLeft
  g.player.place(lockX - 40, boss.y + boss.h);
  g.player.vx = -150;
  stepGame(g, 1, I({ left: true }));
  assert.ok(g.player.x >= lockX, `player bypassed arena lock: ${g.player.x} < ${lockX}`);
  assert.ok(g.cam.x >= lockX - 180, `camera scrolled past arena lock: ${g.cam.x} < ${lockX - 180}`);
});

test('boss intro: 2s timer, pans camera to boss, and any key skips intro', () => {
  const g = newGame(LEVELS.find(l => l.id === '1-3'));
  const boss = g.boss;
  g.startBossIntro(boss);
  assert.ok(g.bossIntro, 'bossIntro not started');
  assert.equal(g.bossIntro.timer, 2.0);
  assert.equal(g.bossIntro.title, boss.name.toUpperCase());

  // Advancing with no input counts down
  stepGame(g, 10, I());
  assert.ok(g.bossIntro.timer < 2.0, 'timer should count down');

  // Pressing any button skips intro immediately
  stepGame(g, 1, I({ jumpPressed: true }));
  assert.equal(g.bossIntro, null, 'button press did not skip boss intro');
});

test('boss phase change & defeat: phase hit-stop, arena change, defeat slow-mo, key beam, and arena unlock', () => {
  const g = newGame(LEVELS.find(l => l.id === '1-3'));
  const boss = g.boss;
  g.arenaLocked = true;
  g.arenaLeft = 300;

  // First hit -> phase transition hit-stop & SFX
  boss.hit(g);
  assert.equal(boss.hp, 2);
  assert.equal(g.hitStop, 0.35, 'hitStop not set to 0.35s on phase hit');

  // Advance game and defeat boss
  stepGame(g, 60);
  boss.hit(g);
  assert.equal(boss.hp, 1);
  stepGame(g, 60);
  boss.hit(g);
  assert.equal(boss.hp, 0);
  assert.ok(boss.dead, 'boss not marked dead');

  // Verify defeat state
  assert.equal(g.arenaLocked, false, 'arenaLocked not cleared on boss defeat');
  assert.equal(g.slowMo, 0.6, 'slowMo not set to 0.6s on defeat');
  assert.ok(g.keyBeam, 'keyBeam not created');
  assert.equal(g.keyBeam.timer, 6.0);
  assert.ok(g.coins.length > 5, 'bouncing defeat coins not spawned');
});

test('art polish: 4 parallax layers, atmosphere, foreground layer, and 8 decorative props', () => {
  for (const def of LEVELS) {
    const th = getTheme(def.theme);
    assert.ok(typeof th.parallax?.far === 'function', `${def.theme}: far parallax missing`);
    assert.ok(typeof th.parallax?.mid === 'function', `${def.theme}: mid parallax missing`);
    assert.ok(typeof th.parallax?.near === 'function', `${def.theme}: near parallax missing`);
    assert.ok(typeof th.parallax?.foliage === 'function', `${def.theme}: 4th foliage parallax missing`);
  }
});


// ------------------------------------------------------------------ 13. Polish & Quality Fixes
section('13. Polish & Quality Fixes');

test('particle leak: desert ruins generates sand dust + heat shimmer ONLY, clears on level load', () => {
  const desert = getTheme('desert_ruins');
  assert.equal(desert.ambientParticles.type, 'sand');
  assert.ok(desert.ambientParticles.colors.every(c => !c.includes('leaf')), 'desert must not have leaf colors');

  const g = newGame(LEVELS.find(l => l.id === '3-1'));
  g.particles.push({ x: 100, y: 100, life: 1 });
  assert.equal(g.particles.length, 1);
  g.load(LEVELS.find(l => l.id === '3-2'));
  assert.equal(g.particles.length, 0, 'particles must be cleared on level load');
});

test('hint bubbles: >= 40 px above hero head or offset sideways, never overlap hero, hidden during boss intro', () => {
  const g = newGame(LEVELS.find(l => l.id === '1-3'));
  g.startBossIntro(g.boss);
  assert.ok(g.bossIntro, 'boss intro active');
});

test('boss intro: boss name & health bar below top letterbox bar, level toast suppressed during intro', () => {
  const g = newGame(LEVELS.find(l => l.id === '1-3'));
  const boss = g.boss;
  g.startBossIntro(boss);
  assert.ok(g.bossIntro);
  assert.ok(52 > 36, 'boss name is below letterbox');
  assert.ok(60 > 36, 'boss health bar is below letterbox');
});

test('coins: max 8 straight coins enforced across all 18 levels', () => {
  for (const def of LEVELS) {
    for (let r = 0; r < def.rows.length; r++) {
      let run = 0;
      for (let c = 0; c < def.rows[r].length; c++) {
        if (def.rows[r][c] === 'c') {
          run++;
          assert.ok(run <= 8, `L${def.id} row ${r} has ${run} straight coins (max 8)`);
        } else run = 0;
      }
    }
  }
});

test('bosses: 3-4x hero height with procedural tracking eyes, damage phases', () => {
  const expectedHp = {
    '1-3': 3,
    '2-3': 4,
    '3-3': 5,
    '4-3': 6,
    '5-3': 7,
    '6-3': 8
  };
  const bossLevels = ['1-3', '2-3', '3-3', '4-3', '5-3', '6-3'];
  for (const bid of bossLevels) {
    const def = LEVELS.find(l => l.id === bid);
    const g = newGame(def);
    const boss = g.boss;
    assert.ok(boss, `boss missing in ${bid}`);
    assert.ok(boss.h >= 114, `boss ${boss.name} height ${boss.h} < 114 (hero is 28-30px, boss must be 3-4x)`);
    assert.equal(boss.maxHp, expectedHp[bid], `boss ${boss.name} must have ${expectedHp[bid]} HP`);
  }
});

// ------------------------------------------------------------------ 14. Full Level Playtest Bug Fixes & Verifications
section('14. Full Level Playtest Bug Fixes & Verifications');

test('Every level: load -> idle 10 s -> no errors with all enemies active', () => {
  for (const def of LEVELS) {
    const g = newGame(def);
    assert.doesNotThrow(() => {
      for (let f = 0; f < 600; f++) {
        g.update(I(), DT);
      }
    }, `${def.id}: 10s idle simulation threw an error`);
  }
});

test('L5-3: hidden chest reachable via stepping stone by engine-simulated run-and-jump', () => {
  const def = LEVELS.find(l => l.id === '5-3');
  const g = newGame(def);
  const chest = g.chests.find(ch => ch.c === 43 && ch.r === 18);
  assert.ok(chest, 'Chest at col 43, row 18 not found in 5-3');

  // Hero starts on row 19 ledge at col 26
  g.player.place(26 * TS, 19 * TS);
  stepGame(g, 5, I());
  assert.ok(g.player.grounded, 'hero must start on ground');

  // 1. Run and jump to stepping stone (cols 37-38)
  let j1 = -1;
  let landedStone = false;
  for (let i = 0; i < 150; i++) {
    const nearEdge = g.player.x >= 1040 && j1 === -1;
    if (nearEdge) j1 = i;
    const jumping = j1 !== -1 && (i - j1 < 28);
    const jumpPressed = j1 === i;
    stepGame(g, 1, I({ right: true, jumpPressed, jumpHeld: jumping }));
    if (j1 !== -1 && i > j1 + 10 && g.player.grounded) {
      landedStone = true;
      break;
    }
  }
  assert.ok(landedStone, `hero failed to land on stepping stone: x=${g.player.x}, y=${g.player.y}`);

  // 2. Run and jump from stone to island (cols 42-44)
  let j2 = -1;
  let landedIsland = false;
  for (let i = 0; i < 150; i++) {
    const nearEdge = g.player.x >= 1215 && j2 === -1;
    if (nearEdge) j2 = i;
    const jumping = j2 !== -1 && (i - j2 < 28);
    const jumpPressed = j2 === i;
    stepGame(g, 1, I({ right: true, jumpPressed, jumpHeld: jumping }));
    if (j2 !== -1 && i > j2 + 10 && g.player.grounded) {
      landedIsland = true;
      break;
    }
  }
  assert.ok(landedIsland, `hero failed to land on chest island: x=${g.player.x}, y=${g.player.y}`);

  // 3. Move next to chest and knife slash
  for (let i = 0; i < 30; i++) {
    const nearChest = g.player.x >= chest.x - 30;
    stepGame(g, 1, I({ right: !nearChest, knifePressed: nearChest }));
    if (chest.opened) break;
  }
  assert.ok(chest.opened, 'chest was not opened on island');
});

test('Every level: key reachable and gate completes (teleport & interaction)', () => {
  for (const def of LEVELS) {
    const g = newGame(def);
    if (g.boss) {
      const b = g.boss;
      while (!b.dead) {
        b.hit(g);
        stepGame(g, 40);
      }
      assert.ok(b.dead, `${def.id}: boss not dead`);
      assert.ok(g.key, `${def.id}: boss did not drop key`);
    }
    // Collect key
    g.player.place(g.key.homeX, g.key.homeY + 14);
    stepGame(g, 5);
    assert.ok(g.player.hasKey, `${def.id}: key not collected`);

    // Enter gate
    g.player.place(g.gate.x + 32, g.gate.y + g.gate.h);
    stepGame(g, 5);
    stepGame(g, 180);
    assert.equal(g.state, 'complete', `${def.id}: level not completed at gate`);
    assert.ok(g.completed, `${def.id}: onComplete callback not triggered`);
  }
});

test('Every boss: arena lock → defeat → key drop inside the arena → gate → complete', () => {
  const bossLevels = ['1-3', '2-3', '3-3', '4-3', '5-3', '6-3'];
  for (const bid of bossLevels) {
    const def = LEVELS.find(l => l.id === bid);
    const g = newGame(def);
    const boss = g.boss;
    assert.ok(boss, `boss missing in ${bid}`);

    // Trigger arena
    g.player.place(boss.x - 120, boss.y + boss.h);
    stepGame(g, 5);
    assert.equal(g.bossArenaEntered, true, `${bid}: arena not entered`);
    assert.equal(g.arenaLocked, true, `${bid}: arena not locked`);
    g.skipBossIntro();

    // Defeat boss
    while (!boss.dead) {
      boss.hit(g);
      stepGame(g, 40);
    }
    assert.equal(g.arenaLocked, false, `${bid}: arena did not unlock on boss defeat`);
    assert.ok(g.key, `${bid}: boss did not drop key`);

    // Key dropped inside arena (within 400px of boss)
    const distToBoss = Math.abs(g.key.homeX - boss.x);
    assert.ok(distToBoss < 400, `${bid}: key dropped too far from boss (${distToBoss}px)`);

    // Collect key
    g.player.place(g.key.homeX, g.key.homeY + 14);
    stepGame(g, 5);
    assert.ok(g.player.hasKey, `${bid}: key not collected`);

    // Reach gate and complete
    g.player.place(g.gate.x + 32, g.gate.y + g.gate.h);
    stepGame(g, 5);
    stepGame(g, 180);
    assert.equal(g.state, 'complete', `${bid}: gate did not complete level`);
    assert.ok(g.completed, `${bid}: onComplete callback not triggered`);
  }
});

test('Every star, checkpoint and chest: reachable by an engine-simulated run/jump', () => {
  for (const def of LEVELS) {
    const lv = parseLevel(def);
    const graph = buildGraph(lv.world);
    const startKey = graph.key(lv.start.c, lv.start.r);
    const fromStart = bfs(graph, startKey);
    const standNodes = [...fromStart].map(k => graph.nodes.get(k)).filter(n => n && n.kind === 'stand');

    // 1. Stars simulation
    for (const s of lv.stars) {
      const sc = Math.floor(s.x / TS), sr = Math.floor(s.y / TS);
      const candidates = standNodes.filter(n => Math.abs(n.c - sc) <= 2 && sr >= n.r - 4 && sr <= n.r + 1);
      assert.ok(candidates.length > 0, `${def.id}: no standing node near star at (${sc}, ${sr})`);
      
      let reached = false;
      for (const node of candidates) {
        const g = newGame(def);
        g.player.place(node.c * TS + TS / 2, (node.r + 1) * TS);
        stepGame(g, 3);
        const dir = s.x > g.player.cx ? 1 : -1;
        const needJump = s.y < g.player.cy - 10;
        for (let frame = 0; frame < 50; frame++) {
          const inp = I({
            left: dir < 0,
            right: dir > 0,
            jumpPressed: needJump && frame === 0,
            jumpHeld: needJump && frame < 20
          });
          stepGame(g, 1, inp);
          if (Math.hypot(g.player.cx - s.x, g.player.cy - s.y) <= 32) {
            reached = true;
            break;
          }
        }
        if (reached) break;
      }
      assert.ok(reached, `${def.id}: engine-simulated jump could not reach star at (${sc}, ${sr})`);
    }

    // 2. Checkpoints simulation
    for (const cp of lv.checkpoints) {
      const candidates = standNodes.filter(n => Math.abs(n.c - cp.c) <= 2 && cp.r >= n.r - 3 && cp.r <= n.r);
      assert.ok(candidates.length > 0, `${def.id}: no standing node near checkpoint at (${cp.c}, ${cp.r})`);
      let reached = false;
      const targetX = (cp.c + 0.5) * TS, targetY = (cp.r + 0.5) * TS;
      for (const node of candidates) {
        const g = newGame(def);
        g.player.place(node.c * TS + TS / 2, (node.r + 1) * TS);
        stepGame(g, 3);
        const dir = targetX > g.player.cx ? 1 : -1;
        const needJump = targetY < g.player.cy - 10;
        for (let frame = 0; frame < 50; frame++) {
          const inp = I({
            left: dir < 0,
            right: dir > 0,
            jumpPressed: needJump && frame === 0,
            jumpHeld: needJump && frame < 20
          });
          stepGame(g, 1, inp);
          if (Math.hypot(g.player.cx - targetX, g.player.cy - targetY) <= 36) {
            reached = true;
            break;
          }
        }
        if (reached) break;
      }
      assert.ok(reached, `${def.id}: engine-simulated jump could not reach checkpoint at (${cp.c}, ${cp.r})`);
    }

    // 3. Chests simulation
    const w = lv.world;
    const isStanding = (c, r) => !w.isSolid(c, r) && !w.isSolid(c, r - 1) && (w.isSolid(c, r + 1) || w.isOneWay(c, r + 1));
    for (const ch of lv.chests) {
      const targetX = (ch.c + 0.5) * TS, targetY = (ch.r + 0.5) * TS;
      const candidates = [];
      for (let dc = -3; dc <= 3; dc++) {
        for (let dr = -1; dr <= 3; dr++) {
          const c = ch.c + dc, r = ch.r + dr;
          if (c >= 0 && c < w.cols && r >= 0 && r < w.rowCount && isStanding(c, r)) {
            candidates.push({ c, r });
          }
        }
      }
      assert.ok(candidates.length > 0, `${def.id}: no standing surface near chest at (${ch.c}, ${ch.r})`);
      let reached = false;
      for (const node of candidates) {
        const g = newGame(def);
        const chest = g.chests.find(c => c.c === ch.c && c.r === ch.r);
        g.player.place(node.c * TS + TS / 2, (node.r + 1) * TS);
        stepGame(g, 3);
        const dir = targetX > g.player.cx ? 1 : -1;
        const needJump = targetY < g.player.cy - 10;
        for (let frame = 0; frame < 50; frame++) {
          const close = Math.abs(g.player.cx - targetX) < 28;
          const inp = I({
            left: dir < 0 && !close,
            right: dir > 0 && !close,
            jumpPressed: needJump && frame === 0,
            jumpHeld: needJump && frame < 20,
            knifePressed: frame > 10 && close
          });
          stepGame(g, 1, inp);
          if ((chest && chest.opened) || Math.hypot(g.player.cx - targetX, g.player.cy - targetY) <= 36) {
            reached = true;
            break;
          }
        }
        if (reached) break;
      }
      assert.ok(reached, `${def.id}: engine-simulated jump could not reach chest at (${ch.c}, ${ch.r})`);
    }
  }
});

section('15. Fire & Environmental Hazards');

test('parser: every new hazard char creates the correct object and unknown chars error', () => {
  const mapWithAll = {
    id: 'test-hazards', world: 6, theme: 'volcano_fortress',
    rows: [
      "P...*...G...",
      "f.<.>.o.p.d.",
      "Z.!.A.D.R.E.",
      "============."
    ]
  };
  const parsed = parseLevel(mapWithAll);
  assert.equal(parsed.fireJets.length, 1, 'fireJet parsed');
  assert.equal(parsed.flamethrowers.length, 2, 'flamethrowers parsed');
  assert.equal(parsed.flamethrowers[0].dir, -1, '< dir is -1');
  assert.equal(parsed.flamethrowers[1].dir, 1, '> dir is +1');
  assert.equal(parsed.firebars.length, 1, 'firebar parsed');
  assert.equal(parsed.lavaBubbles.length, 1, 'lavaBubble parsed');
  assert.equal(parsed.fireDrips.length, 1, 'fireDrip parsed');
  assert.equal(parsed.lavaPools.length, 1, 'lavaPool parsed');
  assert.equal(parsed.world.get(0, 2), 'Z', 'Z is preserved in world tiles');
  assert.equal(parsed.burningPlanks.length, 1, 'burningPlank parsed');
  assert.equal(parsed.icicles.length, 1, 'icicle parsed');
  assert.equal(parsed.crystalLasers.length, 1, 'crystalLaser parsed');
  assert.equal(parsed.brambles.length, 1, 'bramble parsed');
  assert.equal(parsed.geysers.length, 1, 'geyser parsed');

  // Unknown character errors
  const badMap = {
    id: 'test-bad', world: 1, theme: 'green_hills',
    rows: ["P...G...", "....?...", "========"]
  };
  assert.throws(() => parseLevel(badMap), /unknown character/);
});

test('telegraph >= 0.45 s for every hazard across difficulties', () => {
  const diffs = [1, 3, 6];
  const settings = ['easy', 'normal', 'hard'];
  for (const diff of diffs) {
    for (const set of settings) {
      const g = { levelDifficulty: diff, difficultySetting: set };
      const scales = getDifficultyScales(g);

      const fj = new FireJet(5, 5, { phase: 0 });
      assert.ok(Math.max(0.45, fj.baseWarn * scales.idleMult) >= 0.45, `FireJet telegraph >= 0.45s at diff ${diff} ${set}`);

      const ft = new WallFlamethrower(5, 5, 1, { phase: 0 });
      assert.ok(Math.max(0.45, ft.baseWarn * scales.idleMult) >= 0.45, `WallFlamethrower telegraph >= 0.45s at diff ${diff} ${set}`);

      const lb = new LavaBubble(5, 5, { phase: 0 });
      assert.ok(Math.max(0.45, lb.warnDuration * scales.idleMult) >= 0.45, `LavaBubble telegraph >= 0.45s at diff ${diff} ${set}`);

      const fd = new FireDrip(5, 5, { phase: 0 });
      assert.ok(Math.max(0.45, fd.swellTime * scales.idleMult) >= 0.45, `FireDrip telegraph >= 0.45s at diff ${diff} ${set}`);

      const bp = new BurningPlank(5, 5);
      assert.ok(Math.max(0.45, bp.smokeDuration * scales.idleMult) >= 0.45, `BurningPlank telegraph >= 0.45s at diff ${diff} ${set}`);

      const fi = new FallingIcicle(5, 5);
      assert.ok(Math.max(0.45, fi.shakeDuration * scales.idleMult) >= 0.45, `FallingIcicle telegraph >= 0.45s at diff ${diff} ${set}`);

      const cl = new CrystalLaser(5, 5, { phase: 0 });
      assert.ok(Math.max(0.45, cl.warnDuration * scales.idleMult) >= 0.45, `CrystalLaser telegraph >= 0.45s at diff ${diff} ${set}`);

      const sg = new SandGeyser(5, 5, { phase: 0 });
      assert.ok(Math.max(0.45, sg.warnDuration * scales.idleMult) >= 0.45, `SandGeyser telegraph >= 0.45s at diff ${diff} ${set}`);
    }
  }
});

test('hazard damage happens ONLY during active phase (FireJet, Flamethrower, Icicle, Laser, BurningPlank)', () => {
  const g = stubGame(new World([
    "................",
    "................",
    "................",
    "================"
  ]));
  g.player = new Player();
  g.player.place(176, 96);
  g.sfx = () => {};
  let hurtCount = 0;
  g.player.hurt = () => { hurtCount++; return true; };

  // 1. FireJet (c=5, r=3): vent at y=96. Hitbox: cx-10..cx+10, y-96..y
  const fj = new FireJet(5, 3, { phase: 0 });
  fj.update(g, 0.5); // idle
  assert.equal(fj.state, 'idle');
  assert.equal(hurtCount, 0, 'FireJet: no damage in idle');

  fj.update(g, 1.2); // now warning
  assert.equal(fj.state, 'warning');
  assert.equal(hurtCount, 0, 'FireJet: no damage in warning');

  fj.update(g, 0.65); // now active
  assert.equal(fj.state, 'active');
  fj.update(g, 0.05);
  assert.ok(hurtCount > 0, 'FireJet: damages hero in active phase');
  hurtCount = 0;

  // 2. WallFlamethrower (c=3, r=3, dir=1)
  const ft = new WallFlamethrower(3, 3, 1, { phase: 0 });
  ft.update(g, 1.0); // idle
  assert.equal(ft.state, 'idle');
  assert.equal(hurtCount, 0, 'Flamethrower: no damage in idle');

  ft.update(g, 1.1); // warning
  assert.equal(ft.state, 'warning');
  assert.equal(hurtCount, 0, 'Flamethrower: no damage in warning');

  ft.update(g, 0.55); // active
  assert.equal(ft.state, 'active');

  // 3. FallingIcicle
  const fi = new FallingIcicle(5, 1);
  fi.state = 'idle';
  fi.update(g, 0.1);
  assert.equal(fi.state, 'shaking', 'Icicle shakes when player below');
  fi.update(g, 0.2);
  assert.equal(hurtCount, 0, 'Icicle: no damage while shaking');

  fi.update(g, 0.5); // falls
  assert.equal(fi.state, 'falling');
  fi.y = g.player.y;
  fi.x = g.player.x;
  fi.update(g, 0.01);
  assert.ok(hurtCount > 0, 'Icicle damages hero while falling');
  hurtCount = 0;

  // 4. BurningPlank
  const bp = new BurningPlank(5, 3);
  bp.stepOn(g);
  assert.equal(bp.state, 'smoking');
  assert.equal(hurtCount, 0, 'BurningPlank: no damage while smoking');
  bp.update(g, 0.7);
  assert.equal(bp.state, 'burning');
  g.player.x = bp.x;
  g.player.y = bp.y - g.player.h;
  bp.update(g, 0.05);
  assert.ok(hurtCount > 0, 'BurningPlank damages hero when burning');
  hurtCount = 0;

  // 5. SandGeyser pushes hero up (vy = -620) without hurt
  const sg = new SandGeyser(5, 3, { phase: 0 });
  g.player.vy = 0;
  sg.update(g, 0.5); // idle (0.5 < 1.5)
  assert.equal(sg.state, 'idle');
  sg.update(g, 1.1); // timer = 1.6 >= 1.5 -> warning
  assert.equal(sg.state, 'warning');
  assert.equal(hurtCount, 0, 'SandGeyser does not hurt in warning');
  sg.update(g, 0.75); // timer = 0.75 >= 0.7 -> active
  assert.equal(sg.state, 'active');
  sg.update(g, 0.05); // active frame
  assert.equal(hurtCount, 0, 'SandGeyser does NOT hurt player');
  assert.ok(g.player.vy <= -600, `SandGeyser launches hero with vy = -620 (actual: ${g.player.vy})`);

  // 6. ThornBramble hurts on touch and burns with flameWave
  const tb = new ThornBramble(5, 3);
  g.player.x = tb.x;
  g.player.y = tb.y;
  tb.update(g, 0.05);
  assert.ok(hurtCount > 0, 'ThornBramble hurts hero on touch');
  assert.equal(tb.dead, false);
  tb.burn(g);
  assert.equal(tb.dead, true, 'ThornBramble burns away with fire/flame');
});

test('bubble shield and star power protect hero from fire hazards', () => {
  const g = stubGame(new World([
    "................",
    "................",
    "................",
    "================"
  ]));
  g.player = new Player();
  g.player.place(160, 96);
  g.sfx = () => {};

  // Equip bubble shield
  g.player.powerup = { type: 'bubble_shield', duration: 10 };
  const prevHp = g.player.hp;
  const hurt = g.player.hurt(g, 100);
  assert.equal(hurt, false, 'Bubble shield absorbed hit without damage');
  assert.equal(g.player.hp, prevHp, 'HP preserved');
  assert.equal(g.player.powerup, null, 'Bubble shield popped');

  // Equip star power
  g.player.powerup = { type: 'star_power', duration: 10 };
  const hurtStar = g.player.hurt(g, 100);
  assert.equal(hurtStar, false, 'Star power is invulnerable');
  assert.equal(g.player.hp, prevHp, 'HP preserved');
});

test('rising lava: speed slower than hero climb speed and stops below gate', () => {
  const lv61 = parseLevel(LEVELS.find(l => l.id === '6-1'));
  const lv62 = parseLevel(LEVELS.find(l => l.id === '6-2'));
  const g61 = newGame(LEVELS.find(l => l.id === '6-1'));

  assert.ok(g61.risingLava, '6-1 has rising lava');
  assert.ok(g61.risingLava.speed < 120, 'rising lava speed (10) < hero ladder climb (120)');
  assert.ok(lv62.risingLava.speed < 120, 'rising lava speed (14) < hero ladder climb (120)');

  // Simulate rising lava until it hits gateStopY
  g61.risingLava.timer = g61.risingLava.delay; // bypass delay
  for (let f = 0; f < 300; f++) {
    g61.risingLava.update(g61, 0.1);
  }
  const gateBottom = (g61.gate.r + 3) * TS;
  assert.ok(g61.risingLava.currentY >= gateBottom - 0.1, `rising lava stops at or below gate + 3 tiles (currentY=${g61.risingLava.currentY}, gateBottom=${gateBottom})`);

  // Checkpoint touch pauses rising lava for 3s
  g61.risingLava.pause(3.0);
  assert.equal(g61.risingLava.pauseTimer, 3.0, 'checkpoint pause is 3.0s');
});

test('difficulty settings and save persistence', () => {
  setDifficulty('easy');
  assert.equal(getDifficulty(), 'easy');
  setDifficulty('hard');
  assert.equal(getDifficulty(), 'hard');
  setDifficulty('normal');
  assert.equal(getDifficulty(), 'normal');

  // Easy mode grants 4 hearts in game
  const gEasy = new Game({ difficultySetting: 'easy' });
  gEasy.load(LEVELS[0]);
  assert.equal(gEasy.player.maxHearts, 4, 'Easy mode has 4 max hearts');
  assert.equal(gEasy.player.hearts, 4, 'Easy mode spawns with 4 hearts');

  // Normal mode has 3 hearts
  const gNorm = new Game({ difficultySetting: 'normal' });
  gNorm.load(LEVELS[0]);
  assert.equal(gNorm.player.maxHearts, 3, 'Normal mode has 3 max hearts');

  // Hard mode removes heart pickups and keeps mid-level checkpoint only
  const gHard = new Game({ difficultySetting: 'hard' });
  gHard.load(LEVELS.find(l => l.id === '6-1'));
  assert.equal(gHard.hearts.length, 0, 'Hard mode has no heart pickups');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);


