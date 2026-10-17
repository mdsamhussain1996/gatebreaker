/**
 * Gatebreaker v2 — Level Data
 * Level 1: First Steps (Jungle Ruins Feel Prototype)
 */

import { TS, BEETLEBOT_SPEED, BEETLEBOT_W, BEETLEBOT_H } from './constants.js';
import { createHero } from './entities.js';

export const LEVEL_1_MAP = [
  '##############################',
  '#..........................G.#',
  '#...................##########',
  '#.......====........#........#',
  '#.......|...........#........#',
  '#.......|....C......#........#',
  '#.......|..#######..#........#',
  '#.......|..#.....#..#........#',
  '#...======.#.....#..#........#',
  '#...|......#.....#..#........#',
  '#...|......#######..#........#',
  '#...|...............#........#',
  '#...|...e...........#........#',
  '#..###############..#........#',
  '#...................#........#',
  '#P..................#........#',
  '##############################'
];

export function parseLevel(mapLines) {
  const h = mapLines.length;
  const w = mapLines[0].length;
  const tiles = [];
  const crates = [];
  const enemies = [];
  let gate = null;
  let heroSpawn = { x: 48, y: 440 };

  for (let ty = 0; ty < h; ty++) {
    const row = [];
    const line = mapLines[ty];
    for (let tx = 0; tx < w; tx++) {
      const ch = line[tx] || '#';
      const px = tx * TS;
      const py = ty * TS;

      if (ch === 'P') {
        heroSpawn = { x: px + 6, y: py + 4 };
        row.push('.');
      } else if (ch === 'G') {
        gate = { x: px, y: py, w: TS, h: TS, unlocked: false };
        row.push('.');
      } else if (ch === 'C') {
        crates.push({ x: px + 2, y: py + 4, w: 28, h: 28, contents: 'key', opened: false });
        row.push('.');
      } else if (ch === 'e') {
        enemies.push({
          x: px,
          y: py + 14,
          w: BEETLEBOT_W,
          h: BEETLEBOT_H,
          speed: BEETLEBOT_SPEED,
          dir: 1,
          hp: 1,
          dead: false
        });
        row.push('.');
      } else {
        row.push(ch); // '#', '=', '|', '.'
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
    heroSpawn,
    gate,
    crates,
    enemies
  };
}

export function createLevelState(mapLines = LEVEL_1_MAP) {
  const parsed = parseLevel(mapLines);
  return {
    tiles: parsed.tiles,
    pixelW: parsed.pixelW,
    pixelH: parsed.pixelH,
    hero: createHero(parsed.heroSpawn.x, parsed.heroSpawn.y),
    gate: parsed.gate,
    crates: parsed.crates,
    enemies: parsed.enemies,
    keyItem: null,
    particles: [],
    time: 0,
    camera: { x: 0, y: 0 },
    levelComplete: false,
    gameOver: false
  };
}
