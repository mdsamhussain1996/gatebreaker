/**
 * Gatebreaker — level parsing: ASCII rows -> World + entity descriptors.
 * DOM-free. See src/levels.js for the legend.
 */
import { TS } from './constants.js';
import { World } from './physics.js';

const ENTITY_CHARS = new Set(['P', 'K', 'G', 'c', 'm']);

export function parseLevel(def) {
  const rows = def.rows;
  const cols = rows[0].length;
  const clean = [];
  const out = {
    id: def.id, name: def.name, targetTime: def.targetTime,
    hints: (def.hints || []).map(h => ({ x: (h.c + 0.5) * TS, y: (h.r + 0.5) * TS, text: h.text })),
    start: null, key: null, gate: null, coins: [], walkers: [], errors: []
  };

  rows.forEach((row, r) => {
    if (row.length !== cols) out.errors.push(`row ${r} has length ${row.length}, expected ${cols}`);
    let line = '';
    for (let c = 0; c < cols; c++) {
      const ch = row[c] || '.';
      if (ENTITY_CHARS.has(ch)) {
        const cx = (c + 0.5) * TS;
        if (ch === 'P') out.start = { x: cx, feetY: (r + 1) * TS, c, r };
        if (ch === 'K') out.key = { x: cx, y: (r + 0.5) * TS, c, r };
        if (ch === 'G') out.gate = { c, r };
        if (ch === 'c') out.coins.push({ x: cx, y: (r + 0.5) * TS });
        if (ch === 'm') out.walkers.push({ x: cx, feetY: (r + 1) * TS, c, r });
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
