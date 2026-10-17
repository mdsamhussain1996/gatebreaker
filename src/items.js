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
