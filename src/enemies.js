/**
 * Gatebreaker — Enemies and Bosses.
 * Base class `Enemy` handles shared physics, combat, flash, knockback,
 * off-screen sleep (> 1.5 screens), hit-stop on kills, and telegraph timers.
 */
import { moveX, moveY, groundAtPoint } from './physics.js';
import { Key } from './items.js';
import { TS } from './constants.js';

let nextId = 1;

/** Shared base class for all enemies */
export class Enemy {
  constructor(cx, feetY, w = 26, h = 24) {
    this.id = nextId++;
    this.w = w; this.h = h;
    this.x = cx - w / 2;
    this.y = feetY - h;
    this.homeX = cx; this.homeY = feetY;
    this.vx = 0; this.vy = 0;
    this.dir = -1;
    this.speed = 40;
    this.hp = 1;
    this.maxHp = 1;
    this.dead = false;
    this.flash = 0;
    this.knockbackX = 0;
    this.knockbackY = 0;
    this.stompable = true;
    this.telegraph = 0;     // announced >= 0.4s before attack hits
    this.sleep = false;
    this.isMovingEnemy = false;
    this.deathColor = '#ffffff';
  }

  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }

  isAsleep(g) {
    const camX = g.cam ? g.cam.x : (g.player ? g.player.x : this.homeX);
    const camY = g.cam ? g.cam.y : (g.player ? g.player.y : this.homeY);
    const dx = Math.abs((this.x + this.w / 2) - camX);
    const dy = Math.abs((this.y + this.h / 2) - camY);
    return dx > 1200 || dy > 800; // > 1.5 screens away
  }

  updateBase(g, dt) {
    this.flash = Math.max(0, this.flash - dt);
    this.telegraph = Math.max(0, this.telegraph - dt);

    if (Math.abs(this.knockbackX) > 0.5) {
      this.x += this.knockbackX * dt;
      this.knockbackX *= Math.pow(0.05, dt);
    } else {
      this.knockbackX = 0;
    }
    if (Math.abs(this.knockbackY) > 0.5) {
      this.y += this.knockbackY * dt;
      this.knockbackY += 700 * dt;
    } else {
      this.knockbackY = 0;
    }
  }

  hit(g, dmg = 1, fromDir = 0) {
    if (this.dead) return false;
    this.hp -= dmg;
    this.flash = 0.18;
    if (fromDir !== 0) {
      this.knockbackX = fromDir * 35;
      this.x += fromDir * 6;
    }
    if (this.hp <= 0) {
      this.die(g);
      return true;
    } else {
      g.sfx('knifeHit');
      return false;
    }
  }

  die(g) {
    this.dead = true;
    g.sfx('enemyDie');
    if (g) g.hitStop = 0.05; // 50 ms hit-stop on kills
    if (g && g.poof) g.poof(this.x + this.w / 2, this.y + this.h / 2, this.deathColor);
    if (g && g.addScore) g.addScore(100 * (this.maxHp || 1), this.x + this.w / 2, this.y - 4);
  }
}

// ============================================================================
// WORLD 1 EXISTING ENEMIES
// ============================================================================

export class MushroomWalker extends Enemy {
  constructor(cx, feetY) {
    super(cx, feetY, 26, 24);
    this.type = 'mushroom';
    this.speed = 46;
    this.walkPhase = Math.random() * 6;
    this.squash = 0;
    this.stompable = true;
    this.deathColor = '#f59e0b';
  }

  update(g, dt) {
    if (this.dead) return;
    this.updateBase(g, dt);
    const w = g.world;
    this.squash = Math.max(0, this.squash - dt);
    this.walkPhase += dt * 9;

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
}

export class SpikyHedgehog extends Enemy {
  constructor(cx, feetY) {
    super(cx, feetY, 28, 22);
    this.type = 'hedgehog';
    this.speed = 38;
    this.walkPhase = Math.random() * 6;
    this.stompable = false; // Spikes protect from stomping
    this.deathColor = '#a78bfa';
  }

  update(g, dt) {
    if (this.dead) return;
    this.updateBase(g, dt);
    const w = g.world;
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
}

// ============================================================================
// NEW MOVING ENEMIES (WORLDS 1–3)
// ============================================================================

/**
 * Buzz Bee (World 1)
 * Flies in a sine wave along a horizontal path (amplitude 1.5 tiles ~48 px).
 * Defeated by knife or stomp.
 */
export class BuzzBee extends Enemy {
  constructor(cx, cy, span = 160) {
    super(cx, cy + 11, 24, 22);
    this.type = 'buzz_bee';
    this.isMovingEnemy = true;
    this.speed = 68;
    this.span = span;
    this.minX = cx - span / 2;
    this.maxX = cx + span / 2;
    this.baseY = cy - this.h / 2;
    this.wavePhase = Math.random() * Math.PI * 2;
    this.wingPhase = 0;
    this.stompable = true;
    this.deathColor = '#facc15';
  }

  update(g, dt) {
    if (this.dead) return;
    this.updateBase(g, dt);
    this.wavePhase += dt * 3.2;
    this.wingPhase += dt * 36;

    // Horizontal patrol between boundaries
    this.x += this.dir * this.speed * dt;
    if (this.x <= this.minX) { this.x = this.minX; this.dir = 1; }
    else if (this.x + this.w >= this.maxX) { this.x = this.maxX - this.w; this.dir = -1; }

    // Sine wave vertical movement (amplitude ~1.5 tiles = 48 px)
    this.y = this.baseY + Math.sin(this.wavePhase) * 24;
  }
}

/**
 * Night Bat (World 1)
 * Hangs asleep under islands; wakes when hero within 5 tiles (160 px),
 * telegraphs with screech and glowing eyes (>= 0.45s), swoops in a U-curve, returns.
 * Defeated by knife or well-timed jump stomp.
 */
export class NightBat extends Enemy {
  constructor(cx, ceilingY) {
    super(cx, ceilingY + 20, 24, 20);
    this.type = 'night_bat';
    this.isMovingEnemy = true;
    this.stompable = true;
    this.state = 'roosting'; // roosting | waking | swoop | return
    this.roostX = cx - this.w / 2;
    this.roostY = ceilingY;
    this.x = this.roostX;
    this.y = this.roostY;
    this.targetX = 0;
    this.targetY = 0;
    this.swoopProgress = 0;
    this.wingPhase = 0;
    this.deathColor = '#c084fc';
  }

  update(g, dt) {
    if (this.dead) return;
    this.updateBase(g, dt);
    const p = g.player;

    if (this.state === 'roosting') {
      this.wingPhase = 0;
      // Wake up when hero is within 5 tiles (160 px)
      const dist = Math.hypot(p.cx - (this.x + this.w / 2), p.cy - (this.y + this.h / 2));
      if (dist < 160 && p.cy > this.y) {
        this.state = 'waking';
        this.telegraph = 0.5; // >= 0.4s telegraph
        this.targetX = p.cx;
        this.targetY = Math.min(p.cy + 10, this.roostY + 140);
        this.startX = this.x;
        this.dir = p.cx >= this.x ? 1 : -1;
        g.sfx('batScreech');
      }
    } else if (this.state === 'waking') {
      this.wingPhase += dt * 16;
      if (this.telegraph <= 0) {
        this.state = 'swoop';
        this.swoopProgress = 0;
      }
    } else if (this.state === 'swoop') {
      this.wingPhase += dt * 28;
      this.swoopProgress += dt * 1.35;
      const t = Math.min(1, this.swoopProgress);
      // U-curve swoop
      const endX = this.startX + this.dir * 180;
      this.x = (1 - t) * (1 - t) * this.startX + 2 * (1 - t) * t * this.targetX + t * t * endX;
      // Parabolic dip
      const dip = Math.sin(t * Math.PI) * (this.targetY - this.roostY);
      this.y = this.roostY + dip;

      if (t >= 1) {
        this.state = 'return';
      }
    } else if (this.state === 'return') {
      this.wingPhase += dt * 18;
      // Return slowly back to roosting spot
      const dx = this.roostX - this.x;
      const dy = this.roostY - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 4) {
        this.x = this.roostX;
        this.y = this.roostY;
        this.state = 'roosting';
      } else {
        this.x += (dx / dist) * 70 * dt;
        this.y += (dy / dist) * 70 * dt;
        this.dir = dx >= 0 ? 1 : -1;
      }
    }
  }
}

/**
 * Hopper Frog (World 1–2)
 * Jumps toward hero every 1.5s (squats first = 0.45s telegraph).
 * Stomp mid-air or knife.
 */
export class HopperFrog extends Enemy {
  constructor(cx, feetY) {
    super(cx, feetY, 26, 22);
    this.type = 'hopper_frog';
    this.isMovingEnemy = true;
    this.stompable = true;
    this.state = 'idle'; // idle | squat | jump
    this.jumpTimer = 1.2;
    this.deathColor = '#4ade80';
    this.squatAnim = 0;
  }

  update(g, dt) {
    if (this.dead) return;
    this.updateBase(g, dt);
    const w = g.world;
    const p = g.player;

    if (this.state === 'idle') {
      this.jumpTimer -= dt;
      this.dir = p.cx > this.x + this.w / 2 ? 1 : -1;
      if (this.jumpTimer <= 0) {
        this.state = 'squat';
        this.telegraph = 0.45; // 0.45s telegraph
        this.squatAnim = 1;
        g.sfx('frogCroak');
      }
    } else if (this.state === 'squat') {
      this.squatAnim = Math.min(1.4, this.squatAnim + dt * 2);
      if (this.telegraph <= 0) {
        this.state = 'jump';
        this.dir = p.cx > this.x + this.w / 2 ? 1 : -1;
        this.vx = this.dir * 140;
        this.vy = -380;
        this.squatAnim = 0;
      }
    } else if (this.state === 'jump') {
      this.vy = Math.min(this.vy + 1300 * dt, 640);
      moveX(w, this, this.vx * dt);
      const res = moveY(w, this, this.vy * dt);
      if (res.floor) {
        this.vy = 0;
        this.vx = 0;
        this.state = 'idle';
        this.jumpTimer = 1.35;
      }
    }
  }
}

/**
 * Wild Boar (World 2)
 * Paces slowly; on seeing hero within 7 tiles, it stops, scrapes ground for 0.6s
 * (dust + snort telegraph), then CHARGES fast (280 px/s) until it hits a wall.
 * Stunned for 1.5s on wall impact.
 * How to beat: Jump over, hit with knife or stomp while stunned.
 */
export class WildBoar extends Enemy {
  constructor(cx, feetY) {
    super(cx, feetY, 34, 26);
    this.type = 'wild_boar';
    this.isMovingEnemy = true;
    this.speed = 45;
    this.state = 'pace'; // pace | telegraph | charge | stunned
    this.stunTimer = 0;
    this.stompable = false; // Armored back while pacing/charging
    this.deathColor = '#b45309';
  }

  update(g, dt) {
    if (this.dead) return;
    this.updateBase(g, dt);
    const w = g.world;
    const p = g.player;

    if (this.state === 'pace') {
      this.stompable = false;
      this.vy = Math.min(this.vy + 1750 * dt, 680);
      const res = moveY(w, this, this.vy * dt);
      if (res.floor) this.vy = 0;

      if (res.floor || this.vy === 0) {
        const frontX = this.dir > 0 ? this.x + this.w + 4 : this.x - 4;
        if (!groundAtPoint(w, frontX, this.y + this.h)) this.dir *= -1;
      }
      this.vx = this.dir * this.speed;
      if (moveX(w, this, this.vx * dt)) this.dir *= -1;

      // Line of sight check for hero (within 7 tiles = 224 px in facing direction)
      const dx = p.cx - (this.x + this.w / 2);
      const dy = Math.abs(p.cy - (this.y + this.h / 2));
      const inFront = (this.dir > 0 && dx > 0 && dx < 224) || (this.dir < 0 && dx < 0 && dx > -224);
      if (inFront && dy < 48) {
        this.state = 'telegraph';
        this.telegraph = 0.6; // 0.6s scrape telegraph
        this.vx = 0;
        g.sfx('boarScrape');
      }
    } else if (this.state === 'telegraph') {
      if (this.telegraph <= 0) {
        this.state = 'charge';
        this.speed = 280;
        g.sfx('boarCharge');
      }
    } else if (this.state === 'charge') {
      this.vy = Math.min(this.vy + 1750 * dt, 680);
      moveY(w, this, this.vy * dt);
      this.vx = this.dir * this.speed;

      // Wall collision stops the charge and stuns the boar!
      if (moveX(w, this, this.vx * dt)) {
        this.state = 'stunned';
        this.stunTimer = 1.5;
        this.stompable = true; // Stompable while stunned!
        this.vx = -this.dir * 40;
        this.vy = -120;
        g.sfx('boarCrash');
        g.shake = 4;
      }
    } else if (this.state === 'stunned') {
      this.stompable = true;
      this.stunTimer -= dt;
      this.vy = Math.min(this.vy + 1750 * dt, 680);
      moveY(w, this, this.vy * dt);
      if (this.stunTimer <= 0) {
        this.state = 'pace';
        this.speed = 45;
        this.dir *= -1;
      }
    }
  }

  hit(g, dmg = 1, fromDir = 0) {
    if (this.dead) return false;
    // Frontal attacks while charging are deflected!
    if (this.state === 'charge' && fromDir === -this.dir) {
      if (g && g.sfx) g.sfx('knifeHit');
      if (g && g.poof) g.poof(this.x + this.w / 2, this.y + this.h / 2, '#d97706');
      return false;
    }
    return super.hit(g, dmg, fromDir);
  }
}

/**
 * Leaf Glider (World 2)
 * Drifts down diagonally on the autumn wind, sways like a falling leaf,
 * respawns at top perch. Harmless to touch from above (player can bounce on it!).
 * Defeated by knife slash.
 */
export class LeafGlider extends Enemy {
  constructor(cx, cy, rangeX = 220, rangeY = 280) {
    super(cx, cy + 18, 28, 18);
    this.type = 'leaf_glider';
    this.isMovingEnemy = true;
    this.stompable = true;
    this.rangeX = rangeX;
    this.rangeY = rangeY;
    this.spawnX = cx - this.w / 2;
    this.spawnY = cy;
    this.x = this.spawnX;
    this.y = this.spawnY;
    this.speedX = 55;
    this.speedY = 42;
    this.swayPhase = Math.random() * 6;
    this.respawnTimer = 0;
    this.deathColor = '#f97316';
  }

  update(g, dt) {
    if (this.dead) return;
    this.updateBase(g, dt);

    if (this.respawnTimer > 0) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.x = this.spawnX;
        this.y = this.spawnY;
      }
      return;
    }

    this.swayPhase += dt * 3.5;
    this.x += this.dir * this.speedX * dt + Math.cos(this.swayPhase) * 20 * dt;
    this.y += this.speedY * dt;

    // Check if reached range or hit solid floor
    if (this.y > this.spawnY + this.rangeY || Math.abs(this.x - this.spawnX) > this.rangeX) {
      this.respawnTimer = 2.0;
      this.x = -9999;
    }
  }
}

/**
 * Rolling Armadillo (World 3)
 * Paces; on spotting hero, shakes to curl up (0.45s telegraph),
 * then rolls fast (240 px/s) bouncing off walls.
 * Uncurls after 3 bounces or 3s with a recovery window.
 * How to beat: Jump over rolling ball; knife slash when uncurled.
 */
export class RollingArmadillo extends Enemy {
  constructor(cx, feetY) {
    super(cx, feetY, 28, 22);
    this.type = 'rolling_armadillo';
    this.isMovingEnemy = true;
    this.speed = 42;
    this.state = 'walk'; // walk | curl | roll | uncurl
    this.bounces = 0;
    this.rollTimer = 0;
    this.stompable = true;
    this.deathColor = '#ea580c';
    this.rollAngle = 0;
  }

  update(g, dt) {
    if (this.dead) return;
    this.updateBase(g, dt);
    const w = g.world;
    const p = g.player;

    if (this.state === 'walk') {
      this.stompable = true;
      this.vy = Math.min(this.vy + 1750 * dt, 680);
      const res = moveY(w, this, this.vy * dt);
      if (res.floor) this.vy = 0;

      if (res.floor || this.vy === 0) {
        const frontX = this.dir > 0 ? this.x + this.w + 3 : this.x - 3;
        if (!groundAtPoint(w, frontX, this.y + this.h)) this.dir *= -1;
      }
      this.vx = this.dir * this.speed;
      if (moveX(w, this, this.vx * dt)) this.dir *= -1;

      // Trigger curl when hero within 6 tiles (192 px)
      const dist = Math.hypot(p.cx - (this.x + this.w / 2), p.cy - (this.y + this.h / 2));
      if (dist < 192) {
        this.state = 'curl';
        this.telegraph = 0.45; // 0.45s telegraph
        this.vx = 0;
        this.dir = p.cx > this.x + this.w / 2 ? 1 : -1;
      }
    } else if (this.state === 'curl') {
      if (this.telegraph <= 0) {
        this.state = 'roll';
        this.rollTimer = 3.0;
        this.bounces = 0;
        this.stompable = false; // Armored while rolling!
      }
    } else if (this.state === 'roll') {
      this.stompable = false;
      this.rollTimer -= dt;
      this.rollAngle += this.dir * dt * 20;

      this.vy = Math.min(this.vy + 1750 * dt, 680);
      moveY(w, this, this.vy * dt);

      this.vx = this.dir * 240;
      if (moveX(w, this, this.vx * dt)) {
        this.dir *= -1;
        this.bounces++;
        g.shake = 2;
        g.sfx('knifeHit');
      }

      if (this.bounces >= 3 || this.rollTimer <= 0) {
        this.state = 'uncurl';
        this.telegraph = 0.7; // Vulnerable recovery window
        this.vx = 0;
        this.stompable = true;
      }
    } else if (this.state === 'uncurl') {
      this.stompable = true;
      if (this.telegraph <= 0) {
        this.state = 'walk';
      }
    }
  }

  hit(g, dmg = 1, fromDir = 0) {
    if (this.dead) return false;
    // Deflects attacks while rolling
    if (this.state === 'roll') {
      if (g && g.sfx) g.sfx('knifeHit');
      if (g && g.poof) g.poof(this.x + this.w / 2, this.y + this.h / 2, '#ea580c');
      return false;
    }
    return super.hit(g, dmg, fromDir);
  }
}

/**
 * Desert Hawk (World 3)
 * Circles high, locks on (shadow + screech telegraph 0.5s), dives at hero position,
 * swoops low, climbs back up. Dodge sideways, hit with knife/slash as it climbs back.
 */
export class DesertHawk extends Enemy {
  constructor(cx, skyY) {
    super(cx, skyY + 22, 30, 22);
    this.type = 'desert_hawk';
    this.isMovingEnemy = true;
    this.stompable = true;
    this.state = 'circle'; // circle | lock | dive | climb
    this.circleX = cx;
    this.skyY = skyY;
    this.angle = Math.random() * Math.PI * 2;
    this.targetX = 0;
    this.targetY = 0;
    this.diveSpeed = 340;
    this.wingPhase = 0;
    this.deathColor = '#f59e0b';
  }

  update(g, dt) {
    if (this.dead) return;
    this.updateBase(g, dt);
    const p = g.player;

    if (this.state === 'circle') {
      this.wingPhase += dt * 14;
      this.angle += dt * 1.6;
      this.x = this.circleX + Math.cos(this.angle) * 70 - this.w / 2;
      this.y = this.skyY + Math.sin(this.angle) * 16 - this.h / 2;
      this.dir = Math.sin(this.angle) >= 0 ? 1 : -1;

      // Lock on when hero is below and within horizontal range
      if (Math.abs(p.cx - (this.x + this.w / 2)) < 160 && p.cy > this.y + 40) {
        this.state = 'lock';
        this.telegraph = 0.5; // 0.5s telegraph
        this.targetX = p.cx;
        this.targetY = p.cy - 10;
        this.dir = p.cx > this.x ? 1 : -1;
        g.sfx('hawkScreech');
      }
    } else if (this.state === 'lock') {
      this.wingPhase += dt * 24;
      if (this.telegraph <= 0) {
        this.state = 'dive';
        const dx = this.targetX - (this.x + this.w / 2);
        const dy = this.targetY - (this.y + this.h / 2);
        const dist = Math.hypot(dx, dy) || 1;
        this.vx = (dx / dist) * this.diveSpeed;
        this.vy = (dy / dist) * this.diveSpeed;
      }
    } else if (this.state === 'dive') {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (this.y >= this.targetY || Math.hypot(this.targetX - this.x, this.targetY - this.y) < 20) {
        this.state = 'climb';
        this.vx = this.dir * 110;
        this.vy = -180;
      }
    } else if (this.state === 'climb') {
      this.wingPhase += dt * 20;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (this.y <= this.skyY) {
        this.state = 'circle';
        this.circleX = this.x + this.w / 2;
      }
    }
  }
}

/**
 * Spinning Saw (World 3+)
 * Follows a rail path (loop or back-and-forth) along visible track line.
 * Can't be killed — avoid!
 */
export class SpinningSaw extends Enemy {
  constructor(c0, r0, c1, r1, speed = 120) {
    const cx0 = (c0 + 0.5) * TS;
    const cy0 = (r0 + 0.5) * TS;
    const cx1 = (c1 + 0.5) * TS;
    const cy1 = (r1 + 0.5) * TS;
    super(cx0, cy0 + 12, 24, 24);
    this.type = 'spinning_saw';
    this.isMovingEnemy = true;
    this.p0 = { x: cx0, y: cy0 };
    this.p1 = { x: cx1, y: cy1 };
    this.speed = speed;
    this.progress = 0;
    this.forward = true;
    this.spinAngle = 0;
    this.stompable = false;
    this.invulnerable = true;
    this.deathColor = '#cbd5e1';
  }

  update(g, dt) {
    this.updateBase(g, dt);
    this.spinAngle += dt * 26;

    const dx = this.p1.x - this.p0.x;
    const dy = this.p1.y - this.p0.y;
    const length = Math.hypot(dx, dy) || 1;
    const step = (this.speed * dt) / length;

    if (this.forward) {
      this.progress += step;
      if (this.progress >= 1) { this.progress = 1; this.forward = false; }
    } else {
      this.progress -= step;
      if (this.progress <= 0) { this.progress = 0; this.forward = true; }
    }

    const cx = this.p0.x + dx * this.progress;
    const cy = this.p0.y + dy * this.progress;
    this.x = cx - this.w / 2;
    this.y = cy - this.h / 2;
  }

  hit() {
    return false; // Can't be killed
  }
}

// ============================================================================
// WORLD 2 & 3 EXISTING ENEMIES & BOSSES
// ============================================================================

export class Projectile {
  constructor(x, y, vx, vy, type = 'acorn') {
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.type = type;
    this.w = 12; this.h = 12;
    this.dead = false;
    this.life = 4.0;
  }

  update(g, dt) {
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }
    if (this.type === 'acorn') this.vy += 800 * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    const p = g.player;
    if (p.invuln <= 0 && Math.abs(p.cx - this.x) < 14 && Math.abs(p.cy - this.y) < 18) {
      if (p.hurt(g, this.x)) {
        this.dead = true;
        g.poof(this.x, this.y, '#f59e0b');
      }
    }
    const c = Math.floor(this.x / TS), r = Math.floor(this.y / TS);
    if (g.world.isSolid(c, r)) {
      this.dead = true;
      g.poof(this.x, this.y, '#92400e');
    }
  }
}

export class AcornSquirrel extends Enemy {
  constructor(cx, feetY) {
    super(cx, feetY, 26, 26);
    this.type = 'squirrel';
    this.shootTimer = 2.0;
    this.stompable = true;
    this.deathColor = '#92400e';
  }

  update(g, dt) {
    if (this.dead) return;
    this.updateBase(g, dt);
    const p = g.player;
    this.dir = p.cx > this.x + this.w / 2 ? 1 : -1;
    this.shootTimer -= dt;

    if (this.shootTimer <= 0.5 && this.telegraph <= 0) {
      this.telegraph = 0.5; // 0.5s shoot telegraph
    }

    if (this.shootTimer <= 0) {
      this.shootTimer = 2.6;
      const dx = p.cx - (this.x + this.w / 2);
      const vx = Math.max(-180, Math.min(180, dx * 1.5));
      const vy = -320;
      g.projectiles.push(new Projectile(this.x + this.w / 2, this.y + 4, vx, vy, 'acorn'));
      g.sfx('throw');
    }
  }
}

export class SnapvinePlant extends Enemy {
  constructor(cx, feetY) {
    super(cx, feetY, 28, 28);
    this.type = 'snapvine';
    this.shootTimer = 2.2;
    this.stompable = false;
    this.deathColor = '#15803d';
  }

  update(g, dt) {
    if (this.dead) return;
    this.updateBase(g, dt);
    const p = g.player;
    this.shootTimer -= dt;

    if (this.shootTimer <= 0.6 && this.telegraph <= 0) {
      this.telegraph = 0.6; // Amber glow telegraph
    }

    if (this.shootTimer <= 0) {
      this.shootTimer = 2.8;
      const dir = p.cx > this.x + this.w / 2 ? 1 : -1;
      g.projectiles.push(new Projectile(this.x + this.w / 2, this.y + 8, dir * 190, 0, 'seed'));
      g.sfx('spit');
    }
  }
}

export class Scorpion extends Enemy {
  constructor(cx, feetY) {
    super(cx, feetY, 30, 24);
    this.type = 'scorpion';
    this.speed = 36;
    this.hp = 2;
    this.maxHp = 2;
    this.stompable = false;
    this.deathColor = '#ea580c';
  }

  update(g, dt) {
    if (this.dead) return;
    this.updateBase(g, dt);
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
}

export class SandWorm extends Enemy {
  constructor(cx, feetY) {
    super(cx, feetY, 32, 40);
    this.type = 'sand_worm';
    this.state = 'underground';
    this.timer = 1.8;
    this.stompable = true;
    this.deathColor = '#f59e0b';
  }

  update(g, dt) {
    if (this.dead) return;
    this.updateBase(g, dt);
    this.timer -= dt;

    if (this.state === 'underground') {
      if (this.timer <= 0.6 && this.telegraph <= 0) {
        this.telegraph = 0.6; // Sand ripples
      }
      if (this.timer <= 0) {
        this.state = 'leaping';
        this.vy = -440;
        this.vx = (Math.random() > 0.5 ? 1 : -1) * 70;
        g.sfx('wormLeap');
      }
    } else if (this.state === 'leaping') {
      this.vy = Math.min(this.vy + 1100 * dt, 500);
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (this.y >= this.homeY - this.h) {
        this.y = this.homeY - this.h;
        this.state = 'underground';
        this.timer = 2.4;
      }
    }
  }
}

// ============================================================================
// BOSSES (WITH MOVING ENEMY SUMMON PHASES)
// ============================================================================

export class MushroomKing extends Enemy {
  constructor(cx, feetY) {
    super(cx, feetY, 54, 58);
    this.isBoss = true;
    this.type = 'mushroom_king';
    this.name = 'Mushroom King';
    this.hp = 3;
    this.maxHp = 3;
    this.invuln = 0;
    this.state = 'idle';
    this.timer = 1.2;
    this.stompable = true;
    this.squash = 1;
    this.shockwaves = [];
    this.hasSummoned = false;
    this.deathColor = '#f59e0b';
  }

  update(g, dt) {
    if (this.dead) return;
    this.updateBase(g, dt);
    const w = g.world;
    const p = g.player;
    this.invuln = Math.max(0, this.invuln - dt);
    this.timer -= dt;
    this.dir = p.cx > this.x + this.w / 2 ? 1 : -1;

    this.vy = Math.min(this.vy + 1600 * dt, 720);
    moveX(w, this, this.vx * dt);
    const res = moveY(w, this, this.vy * dt);

    if (res.floor && this.state === 'jump') {
      this.state = 'idle';
      this.timer = 1.6;
      this.squash = 1.6;
      g.shake = 8;
      g.sfx('bossStomp');

      this.shockwaves.push({ x: this.x - 10, y: this.y + this.h - 14, vx: -190, life: 1.2 });
      this.shockwaves.push({ x: this.x + this.w + 10, y: this.y + this.h - 14, vx: 190, life: 1.2 });
    }

    if (this.state === 'idle') {
      this.vx = 0;
      if (this.timer <= 0) {
        this.state = 'telegraph';
        this.timer = 0.65;
        this.squash = 0.6;
      }
    } else if (this.state === 'telegraph') {
      this.telegraph = 0.65;
      if (this.timer <= 0) {
        this.state = 'jump';
        this.vy = -540;
        this.vx = this.dir * 120;
        this.squash = 1.3;
      }
    }

    // Update shockwaves
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.life -= dt;
      sw.x += sw.vx * dt;
      if (sw.life <= 0) { this.shockwaves.splice(i, 1); continue; }
      if (p.invuln <= 0 && Math.abs(p.cx - sw.x) < 20 && Math.abs(p.cy - sw.y) < 22) {
        p.hurt(g, sw.x);
      }
    }
  }

  hit(g, dmg = 1, fromDir = 0) {
    if (this.dead || this.invuln > 0) return false;
    this.hp -= dmg;
    this.flash = 0.35;
    this.invuln = 0.8;
    this.squash = 0.7;
    g.shake = 5;

    // Moving enemy summon phase at HP <= 2
    if (this.hp <= 2 && !this.hasSummoned && g) {
      this.hasSummoned = true;
      g.toast('Mushroom King summons the hive!');
      g.enemies.push(new BuzzBee(this.x - 60, this.y - 80, 160));
      g.enemies.push(new BuzzBee(this.x + this.w + 60, this.y - 80, 160));
      g.poof(this.x - 60, this.y - 80, '#facc15');
      g.poof(this.x + this.w + 60, this.y - 80, '#facc15');
    }

    if (this.hp <= 0) {
      this.dead = true;
      g.sfx('bossDie');
      for (let i = 0; i < 20; i++) g.poof(this.x + Math.random() * this.w, this.y + Math.random() * this.h, '#f59e0b');
      g.addScore(1000, this.x + this.w / 2, this.y - 10);
      g.toast('Mushroom King defeated! 🗝');

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

export class OldOakGuardian extends Enemy {
  constructor(cx, feetY) {
    super(cx, feetY, 64, 76);
    this.isBoss = true;
    this.type = 'oak_guardian';
    this.name = 'Old Oak Guardian';
    this.hp = 3;
    this.maxHp = 3;
    this.invuln = 0;
    this.state = 'idle';
    this.timer = 1.4;
    this.vulnerable = false;
    this.hasSummoned = false;
    this.deathColor = '#ca8a04';
  }

  update(g, dt) {
    if (this.dead) return;
    this.updateBase(g, dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.timer -= dt;

    if (this.state === 'idle') {
      this.vulnerable = false;
      if (this.timer <= 0) {
        this.state = 'swing_telegraph';
        this.timer = 0.7; // 0.7s telegraph
      }
    } else if (this.state === 'swing_telegraph') {
      this.telegraph = 0.7;
      if (this.timer <= 0) {
        this.state = 'vulnerable';
        this.timer = 1.6;
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

    // Moving enemy summon phase at HP <= 2
    if (this.hp <= 2 && !this.hasSummoned && g) {
      this.hasSummoned = true;
      g.toast('The Ancient Oak calls upon the forest!');
      g.enemies.push(new LeafGlider(this.x - 80, this.y - 120, 200, 260));
      g.enemies.push(new LeafGlider(this.x + this.w + 80, this.y - 120, 200, 260));
    }

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

export class SandWyrm extends Enemy {
  constructor(cx, feetY) {
    super(cx, feetY, 58, 60);
    this.isBoss = true;
    this.type = 'sand_wyrm';
    this.name = 'Sand Wyrm';
    this.hp = 3;
    this.maxHp = 3;
    this.invuln = 0;
    this.state = 'idle';
    this.timer = 1.2;
    this.hasSummoned = false;
    this.deathColor = '#ea580c';
  }

  update(g, dt) {
    if (this.dead) return;
    this.updateBase(g, dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.timer -= dt;

    if (this.state === 'idle') {
      if (this.timer <= 0) {
        this.state = 'telegraph';
        this.timer = 0.65;
      }
    } else if (this.state === 'telegraph') {
      this.telegraph = 0.65;
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

    // Moving enemy summon phase at HP <= 2
    if (this.hp <= 2 && !this.hasSummoned && g) {
      this.hasSummoned = true;
      g.toast('The desert tremors with subterranean life!');
      g.enemies.push(new RollingArmadillo(this.x - 90, this.homeY));
      g.enemies.push(new DesertHawk(this.x + this.w / 2, this.y - 140));
    }

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
