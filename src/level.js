/**
 * Gatebreaker — level parsing: ASCII rows -> World + entity descriptors.
 * DOM-free. See src/levels.js for the complete legend.
 */
import { TS } from './constants.js';
import { World } from './physics.js';

const ENTITY_CHARS = new Set([
  'P', 'K', 'G', 'c', 'g', 's', 'h', 'C', '*', '^',
  'm', 'S', 'B', 'T', 'M', 'L', 'b', 'q', 'v', 'O', 'y', 'w', 'Y'
]);

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
    springs: [],
    movingPlanks: [],
    lifts: [],
    crumblingPlanks: [],
    walkers: [],
    hedgehogs: [],
    squirrels: [],
    snapvines: [],
    scorpions: [],
    sandWorms: [],
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
        else if (ch === 'T') out.springs.push({ c, r });
        else if (ch === 'M') out.movingPlanks.push({ c, r });
        else if (ch === 'L') out.lifts.push({ c, r });
        else if (ch === 'b') out.crumblingPlanks.push({ c, r });
        else if (ch === 'm') out.walkers.push({ x: cx, feetY, c, r });
        else if (ch === 'S') out.hedgehogs.push({ x: cx, feetY, c, r });
        else if (ch === 'q') out.squirrels.push({ x: cx, feetY, c, r });
        else if (ch === 'v') out.snapvines.push({ x: cx, feetY, c, r });
        else if (ch === 'y') out.scorpions.push({ x: cx, feetY, c, r });
        else if (ch === 'w') out.sandWorms.push({ x: cx, feetY, c, r });
        else if (ch === 'B') out.bosses.push({ type: 'mushroom_king', x: cx, feetY, c, r });
        else if (ch === 'O') out.bosses.push({ type: 'oak_guardian', x: cx, feetY, c, r });
        else if (ch === 'Y') out.bosses.push({ type: 'sand_wyrm', x: cx, feetY, c, r });

        line += '.';
      } else {
        line += ch;
      }
    }
    clean.push(line);
  });

  if (Array.isArray(def.entities)) {
    def.entities.forEach(ent => {
      if (ent.type === 'movingPlank') out.movingPlanks.push(ent);
      else if (ent.type === 'lift') out.lifts.push(ent);
    });
  }

  out.world = new World(clean);
  return out;
}
