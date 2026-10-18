/**
 * Gatebreaker — enemies and bosses.
 * World 1: Mushroom Walker, Spiky Hedgehog, and Boss Mushroom King.
 */
import { moveX, moveY, groundAtPoint } from './physics.js';
import { Key } from './items.js';
import { TS } from './constants.js';

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

/** Enemy projectile: thrown acorns, snapvine seeds, etc. */
export class Projectile {
  constructor(x, y, vx, vy, type = 'acorn') {
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.w = 12; this.h = 12;
    this.type = type;
    this.dead = false;
    this.life = 4.0;
  }
  update(g, dt) {
    if (this.dead) return;
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }
    if (this.type === 'acorn') this.vy += 800 * dt; // gravity arc
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Check hit hero
    const p = g.player;
    if (p.invuln <= 0 && Math.abs(p.cx - this.x) < 14 && Math.abs(p.cy - this.y) < 18) {
      if (p.hurt(g, this.x)) {
        this.dead = true;
        g.poof(this.x, this.y, '#f59e0b');
      }
    }
    // Check solid wall
    const c = Math.floor(this.x / TS), r = Math.floor(this.y / TS);
    if (g.world.isSolid(c, r)) {
      this.dead = true;
      g.poof(this.x, this.y, '#92400e');
    }
  }
}

/** World 2 Enemy: Acorn Thrower Squirrel (lobs acorns in an arc) */
export class AcornSquirrel {
  constructor(cx, feetY) {
    this.id = nextId++;
    this.type = 'squirrel';
    this.w = 26; this.h = 24;
    this.x = cx - this.w / 2;
    this.y = feetY - this.h;
    this.homeX = cx; this.homeY = feetY;
    this.vx = 0; this.vy = 0;
    this.dir = -1;
    this.speed = 20;
    this.hp = 1;
    this.dead = false;
    this.flash = 0;
    this.stompable = true;
    this.shootTimer = 1.8 + Math.random() * 0.8;
  }
  update(g, dt) {
    if (this.dead) return;
    this.flash = Math.max(0, this.flash - dt);
    const p = g.player;
    this.dir = p.cx > this.x ? 1 : -1;

    this.shootTimer -= dt;
    if (this.shootTimer <= 0) {
      this.shootTimer = 2.4;
      // Lob acorn towards hero
      const dx = p.cx - this.x;
      const vx = Math.max(-160, Math.min(160, dx * 1.2));
      const vy = -260;
      g.projectiles = g.projectiles || [];
      g.projectiles.push(new Projectile(this.x + this.w / 2, this.y + 4, vx, vy, 'acorn'));
      g.sfx('throw');
    }
  }
  hit(g, dmg = 1, fromDir = 0) {
    if (this.dead) return false;
    this.hp -= dmg;
    this.dead = true;
    g.sfx('enemyDie');
    g.poof(this.x + this.w / 2, this.y + this.h / 2, '#d97706');
    g.addScore(180, this.x + this.w / 2, this.y - 4);
    return true;
  }
}

/** World 2 Enemy: Snapvine Plant (telegraphs with glow, spits thorn seed) */
export class SnapvinePlant {
  constructor(cx, feetY) {
    this.id = nextId++;
    this.type = 'snapvine';
    this.w = 28; this.h = 28;
    this.x = cx - this.w / 2;
    this.y = feetY - this.h;
    this.hp = 1;
    this.dead = false;
    this.flash = 0;
    this.stompable = false; // Thorny head hurts stompers
    this.state = 'idle'; // idle | telegraph | shoot
    this.timer = 2.0 + Math.random();
  }
  update(g, dt) {
    if (this.dead) return;
    this.timer -= dt;
    if (this.state === 'idle') {
      if (this.timer <= 0) {
        this.state = 'telegraph';
        this.timer = 0.65; // Clear telegraph
      }
    } else if (this.state === 'telegraph') {
      this.flash = 0.1;
      if (this.timer <= 0) {
        this.state = 'idle';
        this.timer = 2.2;
        const dir = g.player.cx > this.x ? 1 : -1;
        g.projectiles = g.projectiles || [];
        g.projectiles.push(new Projectile(this.x + this.w / 2, this.y + 12, dir * 180, 0, 'seed'));
        g.sfx('spit');
      }
    }
  }
  hit(g, dmg = 1, fromDir = 0) {
    if (this.dead) return false;
    this.hp -= dmg;
    this.dead = true;
    g.sfx('enemyDie');
    g.poof(this.x + this.w / 2, this.y + this.h / 2, '#15803d');
    g.addScore(200, this.x + this.w / 2, this.y - 4);
    return true;
  }
}

/** World 2 Boss: Old Oak Guardian (Swings branches, hollow core weak spot) */
export class OldOakGuardian {
  constructor(cx, feetY) {
    this.id = nextId++;
    this.isBoss = true;
    this.type = 'oak_guardian';
    this.name = 'Old Oak Guardian';
    this.w = 64; this.h = 76;
    this.x = cx - this.w / 2;
    this.y = feetY - this.h;
    this.homeX = cx; this.homeY = feetY;
    this.hp = 3;
    this.maxHp = 3;
    this.dead = false;
    this.flash = 0;
    this.invuln = 0;
    this.state = 'idle'; // idle | swing_telegraph | swing | vulnerable | hurt
    this.timer = 1.4;
    this.vulnerable = false;
  }
  update(g, dt) {
    if (this.dead) return;
    this.flash = Math.max(0, this.flash - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.timer -= dt;

    if (this.state === 'idle') {
      this.vulnerable = false;
      if (this.timer <= 0) {
        this.state = 'swing_telegraph';
        this.timer = 0.7; // 0.7s telegraph
      }
    } else if (this.state === 'swing_telegraph') {
      this.flash = 0.08;
      if (this.timer <= 0) {
        this.state = 'vulnerable';
        this.timer = 1.6; // Core exposed!
        this.vulnerable = true;
        g.sfx('branchSwing');
        g.shake = 4;
      }
    } else if (this.state === 'vulnerable') {
      if (this.timer <= 0) {
        this.state = 'idle';
        this.timer = 1.2;
        this.vulnerable = false;
      }
    } else if (this.state === 'hurt') {
      if (this.timer <= 0) {
        this.state = 'idle';
        this.timer = 1.0;
      }
    }
  }
  hit(g, dmg = 1, fromDir = 0) {
    if (this.dead || this.invuln > 0) return false;
    this.hp -= dmg;
    this.flash = 0.4;
    this.invuln = 1.0;
    this.state = 'hurt';
    this.timer = 0.7;
    g.shake = 6;

    if (this.hp <= 0) {
      this.dead = true;
      g.sfx('bossDie');
      for (let i = 0; i < 25; i++) g.poof(this.x + Math.random() * this.w, this.y + Math.random() * this.h, '#ca8a04');
      g.addScore(1500, this.x + this.w / 2, this.y - 10);
      g.toast('Old Oak Guardian defeated! 🗝');

      const keyX = this.x + this.w / 2;
      const keyY = this.y + this.h / 2;
      const droppedKey = new Key(keyX, keyY);
      droppedKey.homeX = keyX; droppedKey.homeY = keyY; droppedKey.state = 'rest';
      g.key = droppedKey;
      return true;
    }
    g.sfx('knifeHit');
    return false;
  }
}

/** World 3 Enemy: Desert Scorpion (armored, 2 HP, tail strike) */
export class Scorpion {
  constructor(cx, feetY) {
    this.id = nextId++;
    this.type = 'scorpion';
    this.w = 30; this.h = 22;
    this.x = cx - this.w / 2;
    this.y = feetY - this.h;
    this.homeX = cx; this.homeY = feetY;
    this.vx = 0; this.vy = 0;
    this.dir = -1;
    this.speed = 34;
    this.hp = 2; // 2 HP per prompt!
    this.dead = false;
    this.flash = 0;
    this.stompable = false; // Spiky sting
  }
  update(g, dt) {
    if (this.dead) return;
    this.flash = Math.max(0, this.flash - dt);
    const w = g.world;
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
  hit(g, dmg = 1, fromDir = 0) {
    if (this.dead) return false;
    this.hp -= dmg;
    this.flash = 0.25;
    if (this.hp <= 0) {
      this.dead = true;
      g.sfx('enemyDie');
      g.poof(this.x + this.w / 2, this.y + this.h / 2, '#f59e0b');
      g.addScore(220, this.x + this.w / 2, this.y - 4);
      return true;
    }
    this.x += fromDir * 8;
    g.sfx('knifeHit');
    return false;
  }
}

/** World 3 Enemy: Sand Worm (pops from sand in an arc after ripples) */
export class SandWorm {
  constructor(cx, feetY) {
    this.id = nextId++;
    this.type = 'sand_worm';
    this.w = 26; this.h = 32;
    this.x = cx - this.w / 2;
    this.y = feetY; // Underground initially
    this.baseY = feetY;
    this.hp = 1;
    this.dead = false;
    this.flash = 0;
    this.stompable = true;
    this.state = 'underground'; // underground | ripples | leap
    this.timer = 1.5 + Math.random() * 1.5;
    this.vy = 0;
  }
  update(g, dt) {
    if (this.dead) return;
    this.timer -= dt;

    if (this.state === 'underground') {
      if (this.timer <= 0) {
        this.state = 'ripples';
        this.timer = 0.65; // Clear sand ripples telegraph
      }
    } else if (this.state === 'ripples') {
      // Sand ripple particles
      if (Math.random() < 0.3) g.poof(this.x + Math.random() * this.w, this.baseY - 2, '#d97706');
      if (this.timer <= 0) {
        this.state = 'leap';
        this.vy = -450;
        g.sfx('sandLeap');
      }
    } else if (this.state === 'leap') {
      this.vy += 1200 * dt;
      this.y += this.vy * dt;
      if (this.y >= this.baseY) {
        this.y = this.baseY;
        this.state = 'underground';
        this.timer = 2.4;
      }
    }
  }
  hit(g, dmg = 1, fromDir = 0) {
    if (this.dead) return false;
    this.hp -= dmg;
    this.dead = true;
    g.sfx('enemyDie');
    g.poof(this.x + this.w / 2, this.y + this.h / 2, '#f59e0b');
    g.addScore(250, this.x + this.w / 2, this.y - 4);
    return true;
  }
}

/** World 3 Boss: Sand Wyrm (dives in/out of sand arena; 3 HP) */
export class SandWyrm {
  constructor(cx, feetY) {
    this.id = nextId++;
    this.isBoss = true;
    this.type = 'sand_wyrm';
    this.name = 'Sand Wyrm';
    this.w = 58; this.h = 60;
    this.x = cx - this.w / 2;
    this.y = feetY - this.h;
    this.homeX = cx; this.homeY = feetY;
    this.hp = 3;
    this.maxHp = 3;
    this.dead = false;
    this.flash = 0;
    this.invuln = 0;
    this.state = 'idle'; // idle | telegraph | surge | hurt
    this.timer = 1.2;
    this.vy = 0;
  }
  update(g, dt) {
    if (this.dead) return;
    this.flash = Math.max(0, this.flash - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.timer -= dt;

    if (this.state === 'idle') {
      if (this.timer <= 0) {
        this.state = 'telegraph';
        this.timer = 0.65; // Sand tremors telegraph
      }
    } else if (this.state === 'telegraph') {
      this.flash = 0.1;
      if (this.timer <= 0) {
        this.state = 'surge';
        this.timer = 2.0;
        this.vy = -380;
        g.sfx('bossSurge');
        g.shake = 5;
      }
    } else if (this.state === 'surge') {
      this.vy = Math.min(this.vy + 700 * dt, 400);
      this.y += this.vy * dt;
      if (this.y > this.homeY - this.h) {
        this.y = this.homeY - this.h;
        this.state = 'idle';
        this.timer = 1.4;
      }
    } else if (this.state === 'hurt') {
      if (this.timer <= 0) {
        this.state = 'idle';
        this.timer = 1.0;
      }
    }
  }
  hit(g, dmg = 1, fromDir = 0) {
    if (this.dead || this.invuln > 0) return false;
    this.hp -= dmg;
    this.flash = 0.4;
    this.invuln = 1.0;
    this.state = 'hurt';
    this.timer = 0.7;
    g.shake = 6;

    if (this.hp <= 0) {
      this.dead = true;
      g.sfx('bossDie');
      for (let i = 0; i < 25; i++) g.poof(this.x + Math.random() * this.w, this.y + Math.random() * this.h, '#ea580c');
      g.addScore(2000, this.x + this.w / 2, this.y - 10);
      g.toast('Sand Wyrm defeated! 🗝');

      const keyX = this.x + this.w / 2;
      const keyY = this.y + this.h / 2;
      const droppedKey = new Key(keyX, keyY);
      droppedKey.homeX = keyX; droppedKey.homeY = keyY; droppedKey.state = 'rest';
      g.key = droppedKey;
      return true;
    }
    g.sfx('knifeHit');
    return false;
  }
}

