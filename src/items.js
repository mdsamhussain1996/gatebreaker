/**
 * Gatebreaker — interactive items and pickups:
 * coins, gems, stars, hearts, chests, checkpoints, hazards, key, exit gate.
 */
import { TS } from './constants.js';
import { moveY, moveX } from './physics.js';

export class Coin {
  constructor(cx, cy, popped = false) {
    this.w = 14; this.h = 14;
    this.x = cx - this.w / 2;
    this.y = cy - this.h / 2;
    this.baseY = this.y;
    this.vx = 0; this.vy = 0;
    this.pop = popped;          // ballistic until it lands
    this.popT = popped ? 0.35 : 0;
    this.collected = false;
    this.phase = Math.random() * 6;
  }
  update(g, dt) {
    this.phase += dt * 5;
    if (!this.pop) return;
    this.popT = Math.max(0, this.popT - dt);
    this.vy = Math.min(this.vy + 1500 * dt, 600);
    moveX(g.world, this, this.vx * dt);
    const res = moveY(g.world, this, this.vy * dt);
    if (res.floor) {
      this.vy = 0; this.vx = 0; this.pop = false; this.baseY = this.y;
    }
  }
  get pickable() { return !this.collected && this.popT <= 0; }
}

export class Gem {
  constructor(cx, cy) {
    this.w = 16; this.h = 16;
    this.x = cx - this.w / 2;
    this.y = cy - this.h / 2;
    this.baseY = this.y;
    this.collected = false;
    this.phase = Math.random() * 6;
  }
  update(g, dt) {
    this.phase += dt * 4;
  }
  get pickable() { return !this.collected; }
}

export class Star {
  constructor(cx, cy, index = 0) {
    this.w = 20; this.h = 20;
    this.x = cx - this.w / 2;
    this.y = cy - this.h / 2;
    this.baseY = this.y;
    this.index = index;
    this.collected = false;
    this.phase = Math.random() * 6;
  }
  update(g, dt) {
    this.phase += dt * 3.5;
  }
  get pickable() { return !this.collected; }
}

export class HeartPickup {
  constructor(cx, cy) {
    this.w = 16; this.h = 16;
    this.x = cx - this.w / 2;
    this.y = cy - this.h / 2;
    this.baseY = this.y;
    this.collected = false;
    this.phase = Math.random() * 6;
  }
  update(g, dt) {
    this.phase += dt * 4;
  }
  get pickable() { return !this.collected; }
}

export class Chest {
  constructor(c, r) {
    this.c = c; this.r = r;
    this.w = 24; this.h = 20;
    this.x = (c + 0.5) * TS - this.w / 2;
    this.y = (r + 1) * TS - this.h;
    this.opened = false;
    this.openT = 0;
  }
  open(g) {
    if (this.opened) return;
    this.opened = true;
    this.openT = 0.5;
    g.sfx('chestOpen');
    const cx = this.x + this.w / 2, cy = this.y + 4;
    // Pop out a gem + 3 coins
    const gem = new Gem(cx, cy);
    g.gems.push(gem);
    for (let i = 0; i < 3; i++) {
      const c = new Coin(cx, cy, true);
      c.vx = (i - 1) * 80;
      c.vy = -280 - Math.random() * 60;
      g.coins.push(c);
    }
    g.poof(cx, cy, '#fcd34d');
    g.toast('Treasure chest opened!');
  }
  update(g, dt) {
    if (this.openT > 0) this.openT = Math.max(0, this.openT - dt);
  }
}

export class Checkpoint {
  constructor(c, r) {
    this.c = c; this.r = r;
    this.w = 24; this.h = 32;
    this.x = (c + 0.5) * TS - this.w / 2;
    this.y = (r + 1) * TS - this.h;
    this.active = false;
    this.spin = 0;
  }
  activate(g) {
    if (this.active) return;
    this.active = true;
    this.spin = 1.0;
    g.checkpoint = { x: (this.c + 0.5) * TS, feetY: (this.r + 1) * TS };
    g.sfx('checkpoint');
    g.poof(this.x + this.w / 2, this.y + 12, '#48bb78');
    g.toast('Checkpoint saved!');
  }
  update(g, dt) {
    if (this.spin > 0) this.spin = Math.max(0, this.spin - dt * 2.5);
  }
}

export class Spikes {
  constructor(c, r) {
    this.c = c; this.r = r;
    this.w = TS; this.h = 14;
    this.x = c * TS;
    this.y = (r + 1) * TS - this.h;
  }
}

export class Key {
  constructor(cx, cy) {
    this.w = 16; this.h = 24;
    this.homeX = cx; this.homeY = cy;
    this.x = cx - this.w / 2; this.y = cy - this.h / 2;
    this.state = 'rest';      // rest | carried | dropped
    this.vy = 0; this.vx = 0;
    this.timer = 0;           // drop timer (returns home after 5 s)
    this.immune = 0;          // can't be re-grabbed right after being dropped
    this.t = 0;
  }
  returnHome() {
    this.state = 'rest';
    this.x = this.homeX - this.w / 2; this.y = this.homeY - this.h / 2;
    this.vx = this.vy = 0;
  }
  update(g, dt) {
    this.t += dt;
    const p = g.player;
    if (this.state === 'rest') {
      this.y = this.homeY - this.h / 2 + Math.sin(this.t * 2.4) * 4;
    } else if (this.state === 'carried') {
      const tx = p.cx - p.face * 22 - this.w / 2;
      const ty = p.y - 10 + Math.sin(this.t * 5) * 3;
      const k = 1 - Math.exp(-10 * dt);
      this.x += (tx - this.x) * k;
      this.y += (ty - this.y) * k;
    } else if (this.state === 'dropped') {
      this.timer -= dt;
      this.immune = Math.max(0, this.immune - dt);
      this.vy = Math.min(this.vy + 1200 * dt, 560);
      moveX(g.world, this, this.vx * dt);
      const res = moveY(g.world, this, this.vy * dt);
      if (res.floor) { this.vy = -150 * 0; this.vx *= 0.6; }
      if (this.y > g.world.h + 60 || this.timer <= 0) {
        g.poof(this.x + this.w / 2, this.y + this.h / 2, '#fcd34d');
        this.returnHome();
        g.toast('The key returned to its spot');
      }
    }
  }
}

/** Exit gate: rocky cave with a portcullis and a red flag. Box is 2x3 tiles. */
export class Gate {
  constructor(col, bottomRow) {
    this.w = TS * 2; this.h = TS * 3;
    this.x = col * TS;
    this.y = (bottomRow + 1) * TS - this.h;
    this.state = 'closed';    // closed | opening | open
    this.lift = 0;            // 0..1 portcullis raised
    this.t = 0;
    this.lockedMsgCd = 0;
  }
  update(g, dt) {
    this.t += dt;
    this.lockedMsgCd = Math.max(0, this.lockedMsgCd - dt);
    if (this.state === 'opening') {
      this.lift = Math.min(1, this.lift + dt / 1.0);
      if (this.lift >= 1) { this.state = 'open'; this.openT = 0; }
    } else if (this.state === 'open') {
      this.openT += dt;
      if (this.openT > 0.9 && !this.done) { this.done = true; g.completeLevel(); }
    }
  }
}

/** Mushroom Spring: launches the hero high when landed on! */
export class Spring {
  constructor(c, r) {
    this.c = c; this.r = r;
    this.w = 26; this.h = 16;
    this.x = (c + 0.5) * TS - this.w / 2;
    this.y = (r + 1) * TS - this.h;
    this.squash = 1.0;
  }
  bounce(p, g) {
    this.squash = 0.45;
    p.vy = -690;
    p.grounded = false;
    p.jumpBuffer = 0;
    g.sfx('spring');
    for (let i = 0; i < 6; i++) {
      g.poof(this.x + Math.random() * this.w, this.y + 2, '#34d399');
    }
  }
  update(g, dt) {
    if (this.squash < 1.0) {
      this.squash = Math.min(1.0, this.squash + dt * 4.5);
    }
  }
}

/** Moving Plank: floating platform that travels horizontally or vertically */
export class MovingPlank {
  constructor(c, r, opts = {}) {
    this.w = opts.w || 48;
    this.h = opts.h || 12;
    this.baseX = opts.x ?? (c * TS);
    this.baseY = opts.y ?? ((r + 0.5) * TS);
    this.x = this.baseX;
    this.y = this.baseY;
    this.rangeX = opts.rangeX ?? 64;
    this.rangeY = opts.rangeY ?? 0;
    this.speed = opts.speed ?? 1.8;
    this.t = opts.phase ?? 0;
    this.dx = 0;
    this.dy = 0;
    this.isOneWay = true;
  }
  update(g, dt) {
    this.t += dt * this.speed;
    const prevX = this.x, prevY = this.y;
    this.x = this.baseX + Math.sin(this.t) * this.rangeX;
    this.y = this.baseY + Math.sin(this.t) * this.rangeY;
    this.dx = this.x - prevX;
    this.dy = this.y - prevY;
  }
}

/** Crane Lift: wooden platform suspended by heavy chains */
export class CraneLift {
  constructor(c, r, opts = {}) {
    this.w = opts.w || 44;
    this.h = opts.h || 12;
    this.baseX = opts.x ?? ((c + 0.5) * TS - this.w / 2);
    this.baseY = opts.y ?? (r * TS);
    this.x = this.baseX;
    this.y = this.baseY;
    this.rangeY = opts.rangeY ?? 96;
    this.speed = opts.speed ?? 1.3;
    this.t = opts.phase ?? 0;
    this.dx = 0;
    this.dy = 0;
    this.isOneWay = true;
  }
  update(g, dt) {
    this.t += dt * this.speed;
    const prevY = this.y;
    this.y = this.baseY + ((Math.sin(this.t) + 1) / 2) * this.rangeY;
    this.dy = this.y - prevY;
    this.dx = 0;
  }
}

/** Crumbling Plank: sandstone or fragile wood that shakes and drops when stepped on */
export class CrumblingPlank {
  constructor(c, r) {
    this.c = c; this.r = r;
    this.w = TS; this.h = 10;
    this.x = c * TS;
    this.y = r * TS;
    this.active = true;
    this.stepped = false;
    this.timer = 0.7;
    this.respawnTimer = 0;
    this.shake = 0;
  }
  stepOn(g) {
    if (!this.stepped && this.active) {
      this.stepped = true;
      this.timer = 0.7;
      g.sfx('crumble');
    }
  }
  update(g, dt) {
    if (this.stepped && this.active) {
      this.timer -= dt;
      this.shake = Math.sin(Date.now() * 0.05) * 2;
      if (this.timer <= 0) {
        this.active = false;
        this.respawnTimer = 3.2;
        g.poof(this.x + this.w / 2, this.y + 4, '#d97706');
        g.sfx('crumbleFall');
      }
    } else if (!this.active) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.active = true;
        this.stepped = false;
        this.timer = 0.7;
        this.shake = 0;
        g.poof(this.x + this.w / 2, this.y + 4, '#fbbf24');
      }
    }
  }
}

export const POWERUP_DEFS = {
  blaster: { name: 'Blaster', duration: null, ammo: 10, icon: '🔫', color: '#38bdf8' },
  fire_knife: { name: 'Fire Knife', duration: 15, ammo: null, icon: '🔥', color: '#f97316' },
  ice_knife: { name: 'Ice Knife', duration: 15, ammo: null, icon: '❄️', color: '#38bdf8' },
  bubble_shield: { name: 'Bubble Shield', duration: 20, ammo: null, icon: '🫧', color: '#60a5fa' },
  coin_magnet: { name: 'Coin Magnet', duration: 20, ammo: null, icon: '🧲', color: '#eab308' },
  speed_boots: { name: 'Speed Boots', duration: 12, ammo: null, icon: '👟', color: '#10b981' },
  giant_rook: { name: 'Giant Rook', duration: 8, ammo: null, icon: '👑', color: '#a855f7' },
  star_power: { name: 'Star Power', duration: 8, ammo: null, icon: '⭐', color: '#fbbf24' }
};

export class PowerOrb {
  constructor(cx, cy, type = 'blaster') {
    this.w = 22; this.h = 22;
    this.x = cx - this.w / 2;
    this.y = cy - this.h / 2;
    this.baseY = this.y;
    this.type = type;
    this.collected = false;
    this.phase = Math.random() * 6;
  }
  update(g, dt) {
    this.phase += dt * 4;
  }
  get pickable() { return !this.collected; }
}

export class BlasterBolt {
  constructor(x, y, dir = 1) {
    this.w = 16; this.h = 8;
    this.x = dir > 0 ? x : x - this.w;
    this.y = y - this.h / 2;
    this.dir = dir;
    this.speed = 600;
    this.life = 1.4;
    this.dead = false;
  }
  update(g, dt) {
    if (this.dead) return;
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }
    const dx = this.dir * this.speed * dt;
    this.x += dx;
    const col = Math.floor((this.dir > 0 ? this.x + this.w : this.x) / TS);
    const row = Math.floor((this.y + this.h / 2) / TS);
    if (g.world && g.world.isSolid(col, row)) {
      if (g.world.get(col, row) === 'X') {
        g.breakCrate(col, row);
      }
      this.dead = true;
      if (g.poof) g.poof(this.x + this.w / 2, this.y + this.h / 2, '#38bdf8');
      return;
    }
    for (const e of (g.enemies || [])) {
      if (e.dead || e.isInvulnerable) continue;
      if (this.x < e.x + e.w && this.x + this.w > e.x && this.y < e.y + e.h && this.y + this.h > e.y) {
        this.dead = true;
        e.hit(g, 1, this.dir);
        if (g.poof) g.poof(this.x + this.w / 2, this.y + this.h / 2, '#38bdf8');
        return;
      }
    }
    for (const b of (g.bosses || [])) {
      if (b.dead) continue;
      if (this.x < b.x + b.w && this.x + this.w > b.x && this.y < b.y + b.h && this.y + this.h > b.y) {
        this.dead = true;
        b.hit(g, 1, this.dir);
        if (g.poof) g.poof(this.x + this.w / 2, this.y + this.h / 2, '#38bdf8');
        return;
      }
    }
  }
}

export class FlameWave {
  constructor(x, y, dir = 1) {
    this.w = 26; this.h = 24;
    this.startX = x;
    this.x = dir > 0 ? x : x - this.w;
    this.y = y - this.h / 2;
    this.dir = dir;
    this.speed = 360;
    this.maxDist = 96; // 3 tiles
    this.dead = false;
    this.hitEntities = new Set();
  }
  update(g, dt) {
    if (this.dead) return;
    const dx = this.dir * this.speed * dt;
    this.x += dx;
    if (Math.abs(this.x - this.startX) >= this.maxDist) {
      this.dead = true;
      return;
    }
    const col = Math.floor((this.dir > 0 ? this.x + this.w : this.x) / TS);
    const row = Math.floor((this.y + this.h / 2) / TS);
    if (g.world && g.world.get(col, row) === 'X') {
      g.breakCrate(col, row);
    }
    for (const e of (g.enemies || [])) {
      if (e.dead || this.hitEntities.has(e)) continue;
      if (this.x < e.x + e.w && this.x + this.w > e.x && this.y < e.y + e.h && this.y + this.h > e.y) {
        this.hitEntities.add(e);
        e.hit(g, 1, this.dir);
        if (g.poof) g.poof(e.cx, e.cy, '#f97316');
      }
    }
    for (const b of (g.bosses || [])) {
      if (b.dead || this.hitEntities.has(b)) continue;
      if (this.x < b.x + b.w && this.x + this.w > b.x && this.y < b.y + b.h && this.y + this.h > b.y) {
        this.hitEntities.add(b);
        b.hit(g, 1, this.dir);
        if (g.poof) g.poof(b.cx, b.cy, '#f97316');
      }
    }
  }
}

export class IceBlock {
  constructor(x, y, w = 32, h = 32, duration = 5) {
    this.x = x;
    this.y = y;
    this.w = Math.max(w, 24);
    this.h = Math.max(h, 24);
    this.timer = duration;
    this.maxTimer = duration;
    this.dead = false;
    this.isOneWay = true;
    this.dx = 0;
    this.dy = 0;
  }
  update(g, dt) {
    this.timer -= dt;
    if (this.timer <= 0) {
      this.dead = true;
      if (g.sfx) g.sfx('freezeCrack');
      if (g.poof) g.poof(this.x + this.w / 2, this.y + this.h / 2, '#93c5fd');
    }
  }
}

