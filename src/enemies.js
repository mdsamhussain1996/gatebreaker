/**
 * Gatebreaker — enemies. Phase 1 ships the Mushroom Walker only.
 */
import { moveX, moveY, groundAtPoint } from './physics.js';

let nextId = 1;

export class MushroomWalker {
  constructor(cx, feetY) {
    this.id = nextId++;
    this.type = 'mushroom';
    this.w = 26; this.h = 24;
    this.x = cx - this.w / 2;
    this.y = feetY - this.h;
    this.homeX = cx; this.homeY = feetY;
    this.vx = 0; this.vy = 0;
    this.dir = -1;
    this.speed = 46;
    this.hp = 1;
    this.dead = false;
    this.flash = 0;
    this.walkPhase = Math.random() * 6;
    this.squash = 0;
    this.stompable = true;
  }

  update(g, dt) {
    if (this.dead) return;
    const w = g.world;
    this.flash = Math.max(0, this.flash - dt);
    this.squash = Math.max(0, this.squash - dt);
    this.walkPhase += dt * 9;

    this.vy = Math.min(this.vy + 1750 * dt, 680);
    const res = moveY(w, this, this.vy * dt);
    if (res.floor) this.vy = 0;

    if (res.floor || this.vy === 0) {
      // turn at ledges
      const frontX = this.dir > 0 ? this.x + this.w + 3 : this.x - 3;
      if (!groundAtPoint(w, frontX, this.y + this.h)) this.dir *= -1;
    }
    this.vx = this.dir * this.speed;
    if (moveX(w, this, this.vx * dt)) this.dir *= -1;
  }

  /** Returns true if this hit killed the enemy. */
  hit(g, dmg, fromDir = 0) {
    if (this.dead) return false;
    this.hp -= dmg;
    this.flash = 0.15;
    if (this.hp <= 0) {
      this.dead = true;
      g.sfx('enemyDie');
      g.poof(this.x + this.w / 2, this.y + this.h / 2);
      g.addScore(100, this.x + this.w / 2, this.y - 4);
      return true;
    }
    this.x += fromDir * 6;
    return false;
  }
}
