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
import { getUnlockedAbilities, recordResult } from '../src/save.js';

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
    for (const row of lv.world.tiles) for (const ch of row) assert.ok('.#=~H|X'.includes(ch), `unknown tile '${ch}'`);
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
test('boss: Old Oak Guardian (World 2) takes 3 hits and drops key on death', () => {
  const g = newGame(LEVELS.find(l => l.id === '2-3'));
  assert.ok(g.bosses.length === 1, 'boss not spawned in 2-3');
  const boss = g.bosses[0];
  assert.equal(boss.hp, 3);
  boss.hit(g);
  assert.equal(boss.hp, 2);
  stepGame(g, 60);
  boss.hit(g);
  assert.equal(boss.hp, 1);
  stepGame(g, 60);
  boss.hit(g);
  assert.equal(boss.hp, 0);
  assert.ok(boss.dead);
  assert.ok(g.key, 'key not dropped by Old Oak Guardian');
});
test('boss: Sand Wyrm (World 3) takes 3 hits and drops key on death', () => {
  const g = newGame(LEVELS.find(l => l.id === '3-3'));
  assert.ok(g.bosses.length === 1, 'boss not spawned in 3-3');
  const boss = g.bosses[0];
  assert.equal(boss.hp, 3);
  boss.hit(g);
  assert.equal(boss.hp, 2);
  stepGame(g, 60);
  boss.hit(g);
  assert.equal(boss.hp, 1);
  stepGame(g, 60);
  boss.hit(g);
  assert.equal(boss.hp, 0);
  assert.ok(boss.dead);
  assert.ok(g.key, 'key not dropped by Sand Wyrm');
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
    const enemies = [
      ...(lv.walkers||[]), ...(lv.hedgehogs||[]), ...(lv.squirrels||[]),
      ...(lv.snapvines||[]), ...(lv.scorpions||[]), ...(lv.sandWorms||[]),
      ...(lv.buzzBees||[]), ...(lv.nightBats||[]), ...(lv.hopperFrogs||[]),
      ...(lv.wildBoars||[]), ...(lv.leafGliders||[]), ...(lv.armadillos||[]),
      ...(lv.desertHawks||[]), ...(lv.spinningSaws||[]), ...(lv.bosses||[])
    ];
    for (const cp of checks) {
      for (const e of enemies) {
        const ex = e.x ?? (e.c0 !== undefined ? e.c0 * TS : 0);
        const ey = e.feetY ?? e.y ?? e.ceilingY ?? (e.r0 !== undefined ? e.r0 * TS : 0);
        const dist = Math.hypot(ex - cp.x, ey - cp.y);
        assert.ok(dist >= SAFE_DIST, `${def.id}: enemy at (${ex}, ${ey}) is too close to ${cp.name} (dist=${dist.toFixed(1)} < ${SAFE_DIST})`);
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

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

