/**
 * Gatebreaker — level parsing: ASCII rows -> World + entity descriptors.
 * DOM-free. See src/levels.js for the complete legend.
 */
import { TS } from './constants.js';
import { World } from './physics.js';

const ENTITY_CHARS = new Set([
  'P', 'K', 'G', 'c', 'g', 's', 'h', 'C', '*', '^',
  'm', 'S', 'B', 'T', 'M', 'L', 'b', 'q', 'v', 'O', 'y', 'w', 'Y',
  'z', 'N', 'F', 'W', 'l', 'a', 'k', 'I', 'Q',
  'J', 'U', 'V', 'j', 'u',
  'f', '<', '>', 'o', 'p', 'd', 'Z', '!', 'A', 'D', 'R', 'E'
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
    risingLava: def.risingLava || null,
    difficulty: def.difficulty || def.world || 1,
    hints: (def.hints || []).map(h => ({ x: (h.c + 0.5) * TS, y: (h.r + 0.5) * TS, text: h.text })),
    start: null,
    key: null,
    gate: null,
    coins: [],
    gems: [],
    stars: [],
    hearts: [],
    chests: [],
    powerOrbs: [],
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
    buzzBees: [],
    nightBats: [],
    hopperFrogs: [],
    wildBoars: [],
    leafGliders: [],
    armadillos: [],
    desertHawks: [],
    spinningSaws: [],
    bosses: [],
    fireJets: [],
    flamethrowers: [],
    firebars: [],
    lavaBubbles: [],
    fireDrips: [],
    lavaPools: [],
    burningPlanks: [],
    icicles: [],
    crystalLasers: [],
    brambles: [],
    geysers: [],
    errors: []
  };

  let starIndex = 0;

  rows.forEach((row, r) => {
    if (row.length !== cols) out.errors.push(`row ${r} has length ${row.length}, expected ${cols}`);
    let line = '';
    for (let c = 0; c < cols; c++) {
      const ch = row[c] || '.';
      if (!ENTITY_CHARS.has(ch) && !'.#=~H|XZ'.includes(ch)) {
        throw new Error(`unknown character '${ch}' at col ${c}, row ${r}`);
      }
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
        else if (ch === 'Q') out.powerOrbs.push({ x: cx, y: cy, c, r, type: 'blaster' });
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
        else if (ch === 'z') out.buzzBees.push({ x: cx, y: cy, c, r });
        else if (ch === 'N') out.nightBats.push({ x: cx, ceilingY: r * TS, c, r });
        else if (ch === 'F') out.hopperFrogs.push({ x: cx, feetY, c, r });
        else if (ch === 'W') out.wildBoars.push({ x: cx, feetY, c, r });
        else if (ch === 'l') out.leafGliders.push({ x: cx, y: cy, c, r });
        else if (ch === 'a') out.armadillos.push({ x: cx, feetY, c, r });
        else if (ch === 'k') out.desertHawks.push({ x: cx, skyY: r * TS, c, r });
        else if (ch === 'I') out.spinningSaws.push({ c0: c, r0: r, c1: c + 3, r1: r });
        else if (ch === 'B') out.bosses.push({ type: 'mushroom_king', x: cx, feetY, c, r });
        else if (ch === 'O') out.bosses.push({ type: 'oak_guardian', x: cx, feetY, c, r });
        else if (ch === 'Y') out.bosses.push({ type: 'sand_wyrm', x: cx, feetY, c, r });
        else if (ch === 'J') out.bosses.push({ type: 'frost_titan', x: cx, feetY, c, r });
        else if (ch === 'U') out.bosses.push({ type: 'crystal_behemoth', x: cx, feetY, c, r });
        else if (ch === 'V') out.bosses.push({ type: 'magma_overlord', x: cx, feetY, c, r });
        else if (ch === 'j') out.walkers.push({ x: cx, feetY, c, r, subtype: 'frost_walker' });
        else if (ch === 'u') out.walkers.push({ x: cx, feetY, c, r, subtype: 'crystal_crawler' });
        const isBossLvl = !!(def.id && def.id.endsWith('-3'));
        if (ch === 'f') out.fireJets.push({ c, r, x: cx, y: cy, bossArena: isBossLvl });
        else if (ch === '<') out.flamethrowers.push({ c, r, dir: -1, x: cx, y: cy, bossArena: isBossLvl });
        else if (ch === '>') out.flamethrowers.push({ c, r, dir: 1, x: cx, y: cy, bossArena: isBossLvl });
        else if (ch === 'o') out.firebars.push({ c, r, x: cx, y: cy });
        else if (ch === 'p') out.lavaBubbles.push({ c, r, x: cx, y: cy });
        else if (ch === 'd') out.fireDrips.push({ c, r, x: cx, y: cy, bossArena: isBossLvl });
        else if (ch === 'Z') {
          out.lavaPools.push({ c, r, x: c * TS, y: r * TS });
          line += 'Z';
          continue;
        }
        else if (ch === '!') out.burningPlanks.push({ c, r, x: cx, y: cy });
        else if (ch === 'A') out.icicles.push({ c, r, x: cx, y: cy });
        else if (ch === 'D') out.crystalLasers.push({ c, r, x: cx, y: cy, bossArena: isBossLvl });
        else if (ch === 'R') out.brambles.push({ c, r, x: cx, y: cy });
        else if (ch === 'E') out.geysers.push({ c, r, x: cx, y: cy });

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
      else if (ent.type === 'powerOrb') out.powerOrbs.push(ent);
      else if (ent.type === 'buzzBee') out.buzzBees.push(ent);
      else if (ent.type === 'nightBat') out.nightBats.push(ent);
      else if (ent.type === 'hopperFrog') out.hopperFrogs.push(ent);
      else if (ent.type === 'wildBoar') out.wildBoars.push(ent);
      else if (ent.type === 'leafGlider') out.leafGliders.push(ent);
      else if (ent.type === 'armadillo') out.armadillos.push(ent);
      else if (ent.type === 'desertHawk') out.desertHawks.push(ent);
      else if (ent.type === 'spinningSaw') out.spinningSaws.push(ent);
    });
  }

  out.world = new World(clean);
  out.world.levelId = def.id;
  out.world.name = def.name;
  return out;
}
