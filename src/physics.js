/**
 * Gatebreaker — tile world + axis-separated AABB collision.
 * No DOM access: importable from Node tests.
 *
 * Tile classes
 *   solid      '#' soil, 'X' crate           -> blocks from all sides
 *   one-way    '=' cap/plank, '~' bridge,    -> blocks only when falling onto it from above
 *              top tile of an 'H' ladder
 *   climbable  'H' ladder, '|' rope
 */
import { TS } from './constants.js';

export class World {
  constructor(rows) {
    this.rowCount = rows.length;
    this.cols = rows[0].length;
    this.tiles = rows.map(r => r.split(''));
    this.w = this.cols * TS;
    this.h = this.rowCount * TS;
  }
  get(c, r) {
    if (c < 0 || c >= this.cols) return '#';          // side walls of the world
    if (r < 0 || r >= this.rowCount) return '.';      // open sky above, open pit below
    return this.tiles[r][c];
  }
  set(c, r, ch) {
    if (c >= 0 && c < this.cols && r >= 0 && r < this.rowCount) this.tiles[r][c] = ch;
  }
  isSolid(c, r) { const t = this.get(c, r); return t === '#' || t === 'X'; }
  isOneWay(c, r) {
    const t = this.get(c, r);
    return t === '=' || t === '~' || (t === 'H' && this.get(c, r - 1) !== 'H');
  }
  isClimb(c, r) { const t = this.get(c, r); return t === 'H' || t === '|'; }
}

export function overlapsSolid(world, x, y, w, h) {
  const c0 = Math.floor(x / TS), c1 = Math.floor((x + w - 0.001) / TS);
  const r0 = Math.floor(y / TS), r1 = Math.floor((y + h - 0.001) / TS);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (world.isSolid(c, r)) return true;
  return false;
}

/** Move horizontally against solid tiles. Returns true if blocked. */
export function moveX(world, e, dx) {
  let remaining = dx;
  while (remaining !== 0) {
    const step = Math.abs(remaining) > 8 ? Math.sign(remaining) * 8 : remaining;
    remaining -= step;
    const prevL = e.x, prevR = e.x + e.w;
    e.x += step;
    const c0 = Math.floor(e.x / TS), c1 = Math.floor((e.x + e.w - 0.001) / TS);
    const r0 = Math.floor(e.y / TS), r1 = Math.floor((e.y + e.h - 0.001) / TS);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (!world.isSolid(c, r)) continue;
        if (step > 0 && c * TS >= prevR - 0.01) { e.x = c * TS - e.w; return true; }
        if (step < 0 && (c + 1) * TS <= prevL + 0.01) { e.x = (c + 1) * TS; return true; }
      }
    }
  }
  return false;
}

/**
 * Move vertically. opts:
 *   drop            ignore one-way platforms (drop-through)
 *   ignoreOneWay    ignore all one-way platforms
 *   ignoreLadderTop ladder tops don't block (used while climbing)
 *   corner          corner correction when bonking a ceiling edge
 * Returns { floor, ceil }.
 */
export function moveY(world, e, dy, opts = {}) {
  const res = { floor: false, ceil: false };
  let remaining = dy;
  while (remaining !== 0) {
    const step = Math.abs(remaining) > 8 ? Math.sign(remaining) * 8 : remaining;
    remaining -= step;
    const prevT = e.y, prevB = e.y + e.h;
    e.y += step;
    const c0 = Math.floor(e.x / TS), c1 = Math.floor((e.x + e.w - 0.001) / TS);
    const r0 = Math.floor(e.y / TS), r1 = Math.floor((e.y + e.h - 0.001) / TS);

    if (step > 0) {
      let best = Infinity;
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          if (r * TS < prevB - 0.01) continue;                     // tile top must be at/below previous feet
          let blocks = world.isSolid(c, r);
          if (!blocks && !opts.drop && !opts.ignoreOneWay && world.isOneWay(c, r)) {
            blocks = !(opts.ignoreLadderTop && world.get(c, r) === 'H');
          }
          if (blocks) best = Math.min(best, r * TS - e.h);
        }
      }
      if (best !== Infinity) { e.y = best; res.floor = true; return res; }
    } else if (step < 0) {
      let best = -Infinity;
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          if (!world.isSolid(c, r)) continue;
          if ((r + 1) * TS > prevT + 0.01) continue;
          best = Math.max(best, (r + 1) * TS);
        }
      }
      if (best !== -Infinity) {
        if (opts.corner) {
          // Corner correction: slide sideways around a ceiling corner if we only clip it slightly.
          for (let n = 1; n <= opts.corner; n++) {
            for (const dir of [1, -1]) {
              if (!overlapsSolid(world, e.x + dir * n, e.y, e.w, e.h)) {
                e.x += dir * n;
                best = -Infinity;
                break;
              }
            }
            if (best === -Infinity) break;
          }
        }
        if (best !== -Infinity) { e.y = best; res.ceil = true; return res; }
      }
    }
  }
  return res;
}

/**
 * What is directly under the feet? Returns 'solid' | 'oneway' | null.
 * ignoreOneWay: pretend one-way tiles are air. ignoreLadderTop: ladder tops are air.
 */
export function probeGround(world, e, ignoreOneWay = false, ignoreLadderTop = false) {
  const feet = e.y + e.h;
  const row = Math.floor((feet + 1) / TS);
  const c0 = Math.floor((e.x + 0.5) / TS), c1 = Math.floor((e.x + e.w - 0.5) / TS);
  let result = null;
  for (let c = c0; c <= c1; c++) {
    if (row * TS < feet - 1.0) continue;
    if (world.isSolid(c, row)) return 'solid';
    if (!ignoreOneWay && world.isOneWay(c, row)) {
      if (ignoreLadderTop && world.get(c, row) === 'H') continue;
      result = 'oneway';
    }
  }
  return result;
}

/** Is there standable ground under a single x position (used by patrolling enemies)? */
export function groundAtPoint(world, px, feetY) {
  const c = Math.floor(px / TS), r = Math.floor((feetY + 2) / TS);
  return world.isSolid(c, r) || world.isOneWay(c, r);
}

export function aabb(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
