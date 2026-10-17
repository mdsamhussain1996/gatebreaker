import fs from 'fs';
import { TS } from '../src/constants.js';
import { parseLevel } from '../src/level.js';
import { World } from '../src/physics.js';
import { THEMES, getTheme } from '../src/themes.js';

// Movement graph builder as in tests/run.js
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
  const maxRise = 2;
  for (const n of nodes.values()) {
    const { c, r } = n;
    if (n.kind === 'stand') {
      for (const d of [-1, 1]) link(key(c, r), key(c + d, r));
      for (const d of [-1, 1]) {
        const cc = c + d;
        if (free(cc, r) && free(cc, r - 1) && !nodes.has(key(cc, r))) {
          for (let rr = r + 1; rr < world.rowCount; rr++) {
            if (!free(cc, rr)) break;
            if (nodes.get(key(cc, rr))?.kind === 'stand') { link(key(c, r), key(cc, rr)); break; }
          }
        }
      }
      for (let dr = -maxRise; dr <= 14; dr++) {
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
      for (let dx = -2; dx <= 2; dx++) for (let dr = -3; dr <= 0; dr++) link(key(c, r), key(c + dx, r + dr));
      link(key(c, r), key(c, r + 1));
    } else {
      link(key(c, r), key(c, r - 1)); link(key(c, r), key(c, r + 1));
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
    for (const m of n.edges) {
      const k = graph.key(m.c, m.r);
      if (!seen.has(k)) { seen.add(k); q.push(m); }
    }
  }
  return seen;
}

export function validateLevel(def) {
  const lv = parseLevel(def);
  console.log(`\nValidating Level ${def.id}: "${def.name}"`);
  console.log(`  Coins: ${lv.coins.length}, Stars: ${lv.stars.length}, Gems: ${lv.gems.length}`);
  console.log(`  Walkers: ${lv.walkers.length}, Hedgehogs: ${lv.hedgehogs.length}, Bosses: ${lv.bosses.length}`);
  console.log(`  Checkpoints: ${lv.checkpoints.length}, Chests: ${lv.chests.length}, Spikes: ${lv.spikes.length}`);

  if (lv.errors.length) console.error('  ERRORS in parse:', lv.errors);

  const graph = buildGraph(lv.world);
  const startKey = graph.key(lv.start.c, lv.start.r);
  const fromStart = bfs(graph, startKey);
  console.log(`  Reachable nodes from start: ${fromStart.size} / ${graph.nodes.size}`);

  const keyTarget = lv.key ? lv.key : lv.bosses[0];
  const keyNodes = [...fromStart].map(k => graph.nodes.get(k)).filter(n =>
    n && n.kind === 'stand' && Math.abs(n.c - keyTarget.c) <= 1 && keyTarget.r >= n.r - 3 && keyTarget.r <= n.r);
  
  if (keyNodes.length === 0) {
    console.error(`  FAIL: Key/Boss at ${keyTarget.c},${keyTarget.r} is UNREACHABLE!`);
  } else {
    console.log(`  OK: Key/Boss reachable from start (found ${keyNodes.length} standing access nodes)`);
  }

  if (keyNodes.length > 0) {
    const fromKey = bfs(graph, graph.key(keyNodes[0].c, keyNodes[0].r));
    const gateOk = [...fromKey].some(k => {
      const n = graph.nodes.get(k);
      return n && n.kind === 'stand' && n.r === lv.gate.r && n.c >= lv.gate.c - 1 && n.c <= lv.gate.c + 2;
    });
    if (!gateOk) console.error(`  FAIL: Gate at ${lv.gate.c},${lv.gate.r} UNREACHABLE from key!`);
    else console.log(`  OK: Gate reachable from key`);
  }

  const standNodes = [...fromStart].map(k => graph.nodes.get(k)).filter(n => n && n.kind === 'stand');
  let unreachCoins = 0;
  for (const coin of lv.coins) {
    const cc = Math.floor(coin.x / TS), cr = Math.floor(coin.y / TS);
    const ok = standNodes.some(n => Math.abs(n.c - cc) <= 2 && cr >= n.r - 4 && cr <= n.r + 1);
    if (!ok) {
      unreachCoins++;
      console.warn(`    Unreachable coin at ${cc},${cr}`);
    }
  }
  if (unreachCoins === 0) console.log(`  OK: All ${lv.coins.length} coins reachable!`);
  else console.error(`  FAIL: ${unreachCoins} coins unreachable!`);

  let unreachStars = 0;
  for (const s of lv.stars) {
    const sc = Math.floor(s.x / TS), sr = Math.floor(s.y / TS);
    const ok = standNodes.some(n => Math.abs(n.c - sc) <= 2 && sr >= n.r - 4 && sr <= n.r + 1);
    if (!ok) {
      unreachStars++;
      console.warn(`    Unreachable star at ${sc},${sr}`);
    }
  }
  if (unreachStars === 0) console.log(`  OK: All ${lv.stars.length} stars reachable!`);
  else console.error(`  FAIL: ${unreachStars} stars unreachable!`);

  let unreachCp = 0;
  for (const cp of lv.checkpoints) {
    const ok = standNodes.some(n => Math.abs(n.c - cp.c) <= 2 && cp.r >= n.r - 3 && cp.r <= n.r);
    if (!ok) {
      unreachCp++;
      console.warn(`    Unreachable checkpoint at ${cp.c},${cp.r}`);
    }
  }
  if (unreachCp === 0) console.log(`  OK: All ${lv.checkpoints.length} checkpoints reachable!`);
  else console.error(`  FAIL: ${unreachCp} checkpoints unreachable!`);

  return { lv, graph };
}
