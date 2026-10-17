/**
 * Gatebreaker — enemies and bosses.
 * World 1: Mushroom Walker, Spiky Hedgehog, and Boss Mushroom King.
 */
import { moveX, moveY, groundAtPoint } from './physics.js';
import { Key } from './items.js';

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

/** Spiky Hedgehog: has sharp spikes on top, CANNOT be stomped! Must knife slash. */
export class SpikyHedgehog {
  constructor(cx, feetY) {
    this.id = nextId++;
    this.type = 'hedgehog';
    this.w = 28; this.h = 22;
    this.x = cx - this.w / 2;
    this.y = feetY - this.h;
    this.homeX = cx; this.homeY = feetY;
    this.vx = 0; this.vy = 0;
    this.dir = -1;
    this.speed = 38;
    this.hp = 1;
    this.dead = false;
    this.flash = 0;
    this.walkPhase = Math.random() * 6;
    this.stompable = false; // Spikes protect from stomping!
  }

  update(g, dt) {
    if (this.dead) return;
    const w = g.world;
    this.flash = Math.max(0, this.flash - dt);
    this.walkPhase += dt * 7;

    this.vy = Math.min(this.vy + 1750 * dt, 680);
    const res = moveY(w, this, this.vy * dt);
    if (res.floor) this.vy = 0;

    if (res.floor || this.vy === 0) {
      const frontX = this.dir > 0 ? this.x + this.w + 3 : this.x - 3;
      if (!groundAtPoint(w, frontX, this.y + this.h)) this.dir *= -1;
    }
    this.vx = this.dir * this.speed;
    if (moveX(w, this, this.vx * dt)) this.dir *= -1;
  }

  hit(g, dmg, fromDir = 0) {
    if (this.dead) return false;
    this.hp -= dmg;
    this.flash = 0.2;
    if (this.hp <= 0) {
      this.dead = true;
      g.sfx('enemyDie');
      g.poof(this.x + this.w / 2, this.y + this.h / 2, '#a78bfa');
      g.addScore(150, this.x + this.w / 2, this.y - 4);
      return true;
    }
    this.x += fromDir * 8;
    return false;
  }
}

/**
 * World 1 Boss: Giant Mushroom King
 * 3 HP, stomps create shockwaves, spawns walkers, drops KEY on defeat!
 */
export class MushroomKing {
  constructor(cx, feetY) {
    this.id = nextId++;
    this.isBoss = true;
    this.type = 'mushroom_king';
    this.name = 'Mushroom King';
    this.w = 54; this.h = 58;
    this.x = cx - this.w / 2;
    this.y = feetY - this.h;
    this.homeX = cx; this.homeY = feetY;
    this.vx = 0; this.vy = 0;
    this.dir = -1;
    this.hp = 3;
    this.maxHp = 3;
    this.dead = false;
    this.flash = 0;
    this.invuln = 0;
    this.state = 'idle'; // idle | telegraph | jump | hurt
    this.timer = 1.2;
    this.stompable = true;
    this.squash = 1;
    this.shockwaves = [];
  }

  update(g, dt) {
    if (this.dead) return;
    const w = g.world;
    const p = g.player;
    this.flash = Math.max(0, this.flash - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.timer -= dt;

    // Face the player
    this.dir = p.cx > this.x + this.w / 2 ? 1 : -1;

    // Gravity
    this.vy = Math.min(this.vy + 1600 * dt, 720);
    moveX(w, this, this.vx * dt);
    const res = moveY(w, this, this.vy * dt);

    if (res.floor && this.vy >= 0) {
      if (this.state === 'jump') {
        // Slam down!
        this.state = 'idle';
        this.timer = 1.6;
        this.vx = 0;
        this.squash = 0.65;
        g.shake = 8;
        g.sfx('stomp');
        // Spawn shockwave along ground
        g.poof(this.x + 8, this.y + this.h, '#e2e8f0');
        g.poof(this.x + this.w - 8, this.y + this.h, '#e2e8f0');
        // Occasionally spawn a mini walker
        if (Math.random() < 0.6 && g.enemies.filter(e => !e.dead).length < 5) {
          const spawnX = this.x + (this.dir > 0 ? this.w + 14 : -14);
          const walker = new MushroomWalker(spawnX, this.y + this.h);
          g.enemies.push(walker);
        }
      }
      this.vy = 0;
    }

    if (this.state === 'idle') {
      this.vx = 0;
      this.squash = 1 + Math.sin(Date.now() * 0.006) * 0.06;
      if (this.timer <= 0) {
        this.state = 'telegraph';
        this.timer = 0.65; // Clear 0.65s telegraph
        this.squash = 0.72;
      }
    } else if (this.state === 'telegraph') {
      // Glow and crouch down
      this.flash = 0.05;
      if (this.timer <= 0) {
        // Launch jump towards player
        this.state = 'jump';
        this.vy = -510;
        this.vx = this.dir * 140;
        this.squash = 1.25;
        g.sfx('jump');
      }
    } else if (this.state === 'hurt') {
      this.vx *= 0.85;
      if (this.timer <= 0) {
        this.state = 'idle';
        this.timer = 1.0;
      }
    }
  }

  hit(g, dmg = 1, fromDir = 0) {
    if (this.dead || this.invuln > 0) return false;
    this.hp -= dmg;
    this.flash = 0.35;
    this.invuln = 1.0;
    this.state = 'hurt';
    this.timer = 0.7;
    this.vx = fromDir * 80;
    g.shake = 5;

    if (this.hp <= 0) {
      this.dead = true;
      g.sfx('bossDie');
      // Grand poof explosion
      for (let i = 0; i < 20; i++) {
        g.poof(this.x + Math.random() * this.w, this.y + Math.random() * this.h, '#f59e0b');
      }
      g.addScore(1000, this.x + this.w / 2, this.y - 10);
      g.toast('Mushroom King defeated! Grab the Key! 🗝');

      // Drop the level key!
      const keyX = this.x + this.w / 2;
      const keyY = this.y + this.h / 2 - 10;
      const droppedKey = new Key(keyX, keyY);
      droppedKey.homeX = keyX;
      droppedKey.homeY = keyY;
      droppedKey.state = 'rest';
      g.key = droppedKey;
      return true;
    }
    g.sfx('knifeHit');
    return false;
  }
}
