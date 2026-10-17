/**
 * Gatebreaker — level parsing: ASCII rows -> World + entity descriptors.
 * DOM-free. See src/levels.js for the complete legend.
 */
import { TS } from './constants.js';
import { World } from './physics.js';

const ENTITY_CHARS = new Set(['P', 'K', 'G', 'c', 'g', 's', 'h', 'C', '*', '^', 'm', 'S', 'B']);

export function parseLevel(def) {
  const rows = def.rows;
  const cols = rows[0].length;
  const clean = [];
  const out = {
    id: def.id,
    world: def.world || 1,
    theme: def.theme || 'green_hills',
    name: def.name,
    targetTime: def.targetTime,
    hints: (def.hints || []).map(h => ({ x: (h.c + 0.5) * TS, y: (h.r + 0.5) * TS, text: h.text })),
    start: null,
    key: null,
    gate: null,
    coins: [],
    gems: [],
    stars: [],
    hearts: [],
    chests: [],
    checkpoints: [],
    spikes: [],
    walkers: [],
    hedgehogs: [],
    bosses: [],
    errors: []
  };

  let starIndex = 0;

  rows.forEach((row, r) => {
    if (row.length !== cols) out.errors.push(`row ${r} has length ${row.length}, expected ${cols}`);
    let line = '';
    for (let c = 0; c < cols; c++) {
      const ch = row[c] || '.';
      if (ENTITY_CHARS.has(ch)) {
        const cx = (c + 0.5) * TS;
        const cy = (r + 0.5) * TS;
        const feetY = (r + 1) * TS;

        if (ch === 'P') out.start = { x: cx, feetY, c, r };
        else if (ch === 'K') out.key = { x: cx, y: cy, c, r };
        else if (ch === 'G') out.gate = { c, r };
        else if (ch === 'c') out.coins.push({ x: cx, y: cy });
        else if (ch === 'g') out.gems.push({ x: cx, y: cy });
        else if (ch === 's') out.stars.push({ x: cx, y: cy, index: starIndex++ });
        else if (ch === 'h') out.hearts.push({ x: cx, y: cy });
        else if (ch === 'C') out.chests.push({ c, r });
        else if (ch === '*') out.checkpoints.push({ c, r });
        else if (ch === '^') out.spikes.push({ c, r });
        else if (ch === 'm') out.walkers.push({ x: cx, feetY, c, r });
        else if (ch === 'S') out.hedgehogs.push({ x: cx, feetY, c, r });
        else if (ch === 'B') out.bosses.push({ type: 'mushroom_king', x: cx, feetY, c, r });

        line += '.';
      } else {
        line += ch;
      }
    }
    clean.push(line);
  });

  out.world = new World(clean);
  return out;
}
