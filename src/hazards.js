/**
 * Gatebreaker — Environmental Hazards System.
 * Plain deterministic classes with update(g, dt) and draw(ctx, camX, camY).
 * All timings scale with level and global difficulty while keeping minimum telegraph >= 0.45s.
 */
import { TS, VIEW_W, VIEW_H } from './constants.js';
import { aabb } from './physics.js';

// Pre-rendered 8 frames of 20x96 animated flame
let flameCanvas = null;
const FLAME_W = 20;
const FLAME_H = 96;
const FLAME_FRAMES = 8;

export function getFlameFrames() {
  if (flameCanvas || typeof document === 'undefined') return flameCanvas;
  try {
    flameCanvas = document.createElement('canvas');
    flameCanvas.width = FLAME_W * FLAME_FRAMES;
    flameCanvas.height = FLAME_H;
    const ctx = flameCanvas.getContext('2d');

    for (let f = 0; f < FLAME_FRAMES; f++) {
      const ox = f * FLAME_W;
      const phase = (f / FLAME_FRAMES) * Math.PI * 2;
      ctx.save();
      ctx.translate(ox, 0);

      // Outer Red flame column
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.moveTo(3, FLAME_H);
      for (let y = FLAME_H; y >= 0; y -= 8) {
        const t = (FLAME_H - y) / FLAME_H;
        const wave = Math.sin(phase + y * 0.1) * 3 * (1 - t * 0.5);
        const w = (FLAME_W * 0.48) * (1 - t * 0.75) + wave;
        ctx.lineTo(FLAME_W / 2 - w, y);
      }
      ctx.lineTo(FLAME_W / 2, 0);
      for (let y = 0; y <= FLAME_H; y += 8) {
        const t = (FLAME_H - y) / FLAME_H;
        const wave = Math.cos(phase + y * 0.12) * 3 * (1 - t * 0.5);
        const w = (FLAME_W * 0.48) * (1 - t * 0.75) + wave;
        ctx.lineTo(FLAME_W / 2 + w, y);
      }
      ctx.closePath();
      ctx.fill();

      // Middle Orange layer
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.moveTo(5, FLAME_H);
      for (let y = FLAME_H; y >= 8; y -= 8) {
        const t = (FLAME_H - y) / FLAME_H;
        const wave = Math.sin(phase + 1.2 + y * 0.11) * 2.5 * (1 - t * 0.6);
        const w = (FLAME_W * 0.36) * (1 - t * 0.8) + wave;
        ctx.lineTo(FLAME_W / 2 - w, y);
      }
      ctx.lineTo(FLAME_W / 2, 6);
      for (let y = 8; y <= FLAME_H; y += 8) {
        const t = (FLAME_H - y) / FLAME_H;
        const wave = Math.cos(phase + 1.2 + y * 0.13) * 2.5 * (1 - t * 0.6);
        const w = (FLAME_W * 0.36) * (1 - t * 0.8) + wave;
        ctx.lineTo(FLAME_W / 2 + w, y);
      }
      ctx.closePath();
      ctx.fill();

      // Bright Yellow layer
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.moveTo(7, FLAME_H);
      for (let y = FLAME_H; y >= 20; y -= 8) {
        const t = (FLAME_H - y) / FLAME_H;
        const wave = Math.sin(phase + 2.4 + y * 0.14) * 1.8;
        const w = (FLAME_W * 0.24) * (1 - t * 0.85) + wave;
        ctx.lineTo(FLAME_W / 2 - w, y);
      }
      ctx.lineTo(FLAME_W / 2, 16);
      for (let y = 20; y <= FLAME_H; y += 8) {
        const t = (FLAME_H - y) / FLAME_H;
        const wave = Math.cos(phase + 2.4 + y * 0.15) * 1.8;
        const w = (FLAME_W * 0.24) * (1 - t * 0.85) + wave;
        ctx.lineTo(FLAME_W / 2 + w, y);
      }
      ctx.closePath();
      ctx.fill();

      // Inner White core
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(8, FLAME_H);
      ctx.lineTo(FLAME_W / 2 - 3, FLAME_H * 0.45);
      ctx.lineTo(FLAME_W / 2, FLAME_H * 0.3);
      ctx.lineTo(FLAME_W / 2 + 3, FLAME_H * 0.45);
      ctx.lineTo(12, FLAME_H);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }
  } catch (_) {}
  return flameCanvas;
}

// Particle pool (max 200 particles)
export class HazardParticlePool {
  constructor(max = 200) {
    this.max = max;
    this.particles = new Array(max).fill(null).map(() => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      size: 2,
      color: '#f97316',
      alpha: 1,
      life: 0,
      maxLife: 1
    }));
  }

  spawn(x, y, vx, vy, size, color, maxLife) {
    let p = this.particles.find(part => !part.active);
    if (!p) {
      // Find oldest particle
      let oldest = this.particles[0];
      for (let i = 1; i < this.particles.length; i++) {
        if (this.particles[i].life > oldest.life) oldest = this.particles[i];
      }
      p = oldest;
    }
    p.active = true;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.size = size;
    p.color = color;
    p.alpha = 1;
    p.life = 0;
    p.maxLife = maxLife;
    return p;
  }

  update(dt) {
    for (const p of this.particles) {
      if (!p.active) continue;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha = 1 - (p.life / p.maxLife);
    }
  }

  draw(ctx) {
    for (const p of this.particles) {
      if (!p.active) continue;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  clear() {
    for (const p of this.particles) p.active = false;
  }
}

export const hazardParticles = new HazardParticlePool(200);

/** Helper to scale idle and telegraph times by level and global difficulty */
export function getDifficultyScales(g) {
  const levelDiff = Math.max(1, Math.min(6, (g && g.def && g.def.difficulty) || (g && g.def && g.def.world) || 1));
  const diffScale = 1 - 0.06 * (levelDiff - 1);
  const globalSetting = (g && g.difficultySetting) || 'normal';
  const globalMult = globalSetting === 'easy' ? 1.25 : (globalSetting === 'hard' ? 0.8333 : 1.0);
  return {
    levelDiff,
    idleMult: Math.max(0.5, diffScale * globalMult),
    speedMult: globalSetting === 'easy' ? 0.75 : (globalSetting === 'hard' ? 1.2 : 1.0),
    globalSetting
  };
}

/** 1. Fire Jet 'f': Floor vent shooting flame column UP */
export class FireJet {
  constructor(c, r, opts = {}) {
    this.type = 'fire_jet';
    this.c = c;
    this.r = r;
    this.x = c * TS;
    this.y = r * TS;
    this.cx = (c + 0.5) * TS;
    this.cy = (r + 0.5) * TS;
    this.phase = opts.phase !== undefined ? opts.phase : (c * 0.3) % 3.2;

    this.baseIdle = 1.6;
    this.baseWarn = 0.6;
    this.baseActive = 1.0;

    this.timer = this.phase;
    this.state = 'idle'; // idle | warning | active
    this.telegraph = 0;
    this.frameT = 0;
    this.frame = 0;
    this.glowRadius = 64;
    this.soundPlayed = false;
    this.bossInactive = !!opts.bossArena; // starts inactive in boss arena until phase 2
  }

  getHitbox() {
    return {
      x: this.c * TS + 6,
      y: (this.r - 2) * TS,
      w: 20,
      h: 96
    };
  }

  update(g, dt) {
    if (this.bossInactive) return;
    const scales = getDifficultyScales(g);
    const idleTime = Math.max(0.7, this.baseIdle * scales.idleMult);
    const warnTime = Math.max(0.45, this.baseWarn * scales.idleMult);
    const activeTime = this.baseActive;

    this.timer += dt;
    this.frameT += dt;
    if (this.frameT >= 0.08) {
      this.frameT = 0;
      this.frame = (this.frame + 1) % FLAME_FRAMES;
    }

    if (this.state === 'idle') {
      this.telegraph = 0;
      if (this.timer >= idleTime) {
        this.timer = 0;
        this.state = 'warning';
        this.soundPlayed = false;
      }
    } else if (this.state === 'warning') {
      this.telegraph = Math.max(0, warnTime - this.timer);
      if (!this.soundPlayed) {
        this.soundPlayed = true;
        if (g && g.sfx) g.sfx('fireWarn', this.cx, this.cy);
      }
      // Emit warning smoke and sparks
      if (Math.random() < 0.25) {
        hazardParticles.spawn(
          this.cx + (Math.random() - 0.5) * 12,
          this.y + 2,
          (Math.random() - 0.5) * 15,
          -25 - Math.random() * 30,
          2 + Math.random() * 2,
          Math.random() < 0.5 ? '#f97316' : '#94a3b8',
          0.4 + Math.random() * 0.3
        );
      }
      if (this.timer >= warnTime) {
        this.timer = 0;
        this.state = 'active';
        this.soundPlayed = false;
        if (g && g.sfx) g.sfx('fireWhoosh', this.cx, this.cy);
      }
    } else if (this.state === 'active') {
      this.telegraph = 0;
      // Rising embers
      if (Math.random() < 0.5) {
        hazardParticles.spawn(
          this.cx + (Math.random() - 0.5) * 16,
          this.y - Math.random() * 80,
          (Math.random() - 0.5) * 20,
          -60 - Math.random() * 50,
          1.5 + Math.random() * 2,
          Math.random() < 0.6 ? '#fef08a' : '#f97316',
          0.35 + Math.random() * 0.25
        );
      }
      // Damage hero ONLY during active
      const p = g.player;
      if (p && aabb(p, this.getHitbox())) {
        if (p.hurt(g, this.cx)) {
          p.onFire = 0.5;
        }
      }

      if (this.timer >= activeTime) {
        this.timer = 0;
        this.state = 'idle';
      }
    }
  }

  draw(ctx, camX, camY) {
    const vx = this.x;
    const vy = this.y;

    // 1. Draw metal vent grate on top of floor
    ctx.save();
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(vx + 2, vy + 24, 28, 8);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(vx + 2, vy + 24, 28, 8);

    // Grate slits
    ctx.fillStyle = '#334155';
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(vx + 5 + i * 6, vy + 26, 3, 4);
    }

    if (this.state === 'warning') {
      // Glowing orange warning beneath the grate + small shake
      const shakeX = (Math.random() - 0.5) * 1.5;
      ctx.fillStyle = '#ea580c';
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(vx + 5 + i * 6 + shakeX, vy + 26, 3, 4);
      }
      // Vent glow
      const glow = ctx.createRadialGradient(this.cx, vy + 26, 2, this.cx, vy + 26, 22);
      glow.addColorStop(0, 'rgba(249, 115, 22, 0.6)');
      glow.addColorStop(1, 'rgba(249, 115, 22, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(vx - 8, vy + 10, 48, 24);
    } else if (this.state === 'active') {
      // Pre-rendered or procedural flame column 3 tiles tall
      const hb = this.getHitbox();
      const frames = getFlameFrames();
      if (frames) {
        ctx.drawImage(
          frames,
          this.frame * FLAME_W, 0, FLAME_W, FLAME_H,
          hb.x, hb.y, hb.w, hb.h
        );
      } else {
        // Fallback procedural flame
        ctx.fillStyle = '#f97316';
        ctx.fillRect(hb.x, hb.y, hb.w, hb.h);
      }

      // Warm radial glow on nearby terrain
      const glow = ctx.createRadialGradient(this.cx, this.y - 40, 6, this.cx, this.y - 40, 56);
      glow.addColorStop(0, 'rgba(254, 240, 138, 0.45)');
      glow.addColorStop(0.5, 'rgba(249, 115, 22, 0.25)');
      glow.addColorStop(1, 'rgba(249, 115, 22, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(this.cx, this.y - 40, 56, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

/** 2. Wall Flamethrower '<', '>': Mounted in wall, horizontal flame 4 tiles */
export class WallFlamethrower {
  constructor(c, r, dir = 1, opts = {}) {
    this.type = 'wall_flamethrower';
    this.c = c;
    this.r = r;
    this.dir = dir; // -1 for left (<), +1 for right (>)
    this.x = c * TS;
    this.y = r * TS;
    this.cx = (c + 0.5) * TS;
    this.cy = (r + 0.5) * TS;
    this.phase = opts.phase !== undefined ? opts.phase : ((r * 0.35 + c * 0.15) % 3.7);

    this.baseIdle = 2.0;
    this.baseWarn = 0.5;
    this.baseActive = 1.2;

    this.timer = this.phase;
    this.state = 'idle';
    this.telegraph = 0;
    this.frameT = 0;
    this.frame = 0;
    this.soundPlayed = false;
    this.bossInactive = !!opts.bossArena;
  }

  getHitbox() {
    const flameLen = 128; // 4 tiles
    const flameH = 18;
    const fy = this.r * TS + 7;
    if (this.dir > 0) {
      return { x: (this.c + 1) * TS, y: fy, w: flameLen, h: flameH };
    } else {
      return { x: this.c * TS - flameLen, y: fy, w: flameLen, h: flameH };
    }
  }

  update(g, dt) {
    if (this.bossInactive) return;
    const scales = getDifficultyScales(g);
    const idleTime = Math.max(0.8, this.baseIdle * scales.idleMult);
    const warnTime = Math.max(0.45, this.baseWarn * scales.idleMult);
    const activeTime = this.baseActive;

    this.timer += dt;
    this.frameT += dt;
    if (this.frameT >= 0.08) {
      this.frameT = 0;
      this.frame = (this.frame + 1) % FLAME_FRAMES;
    }

    if (this.state === 'idle') {
      this.telegraph = 0;
      if (this.timer >= idleTime) {
        this.timer = 0;
        this.state = 'warning';
        this.soundPlayed = false;
      }
    } else if (this.state === 'warning') {
      this.telegraph = Math.max(0, warnTime - this.timer);
      if (!this.soundPlayed) {
        this.soundPlayed = true;
        if (g && g.sfx) g.sfx('fireWarn', this.cx, this.cy);
      }
      // Nozzle sparks
      const nozzleX = this.dir > 0 ? (this.c + 1) * TS : this.c * TS;
      if (Math.random() < 0.3) {
        hazardParticles.spawn(
          nozzleX,
          this.cy + (Math.random() - 0.5) * 8,
          this.dir * (20 + Math.random() * 30),
          (Math.random() - 0.5) * 15,
          1.5 + Math.random() * 1.5,
          '#fbbf24',
          0.3
        );
      }
      if (this.timer >= warnTime) {
        this.timer = 0;
        this.state = 'active';
        this.soundPlayed = false;
        if (g && g.sfx) g.sfx('fireWhoosh', this.cx, this.cy);
      }
    } else if (this.state === 'active') {
      this.telegraph = 0;
      const nozzleX = this.dir > 0 ? (this.c + 1) * TS : this.c * TS;
      if (Math.random() < 0.5) {
        hazardParticles.spawn(
          nozzleX + this.dir * Math.random() * 90,
          this.cy + (Math.random() - 0.5) * 12,
          this.dir * (80 + Math.random() * 50),
          (Math.random() - 0.5) * 20,
          1.5 + Math.random() * 2,
          Math.random() < 0.6 ? '#fef08a' : '#f97316',
          0.25 + Math.random() * 0.2
        );
      }
      const p = g.player;
      if (p && aabb(p, this.getHitbox())) {
        if (p.hurt(g, this.cx)) {
          p.onFire = 0.5;
        }
      }
      if (this.timer >= activeTime) {
        this.timer = 0;
        this.state = 'idle';
      }
    }
  }

  draw(ctx, camX, camY) {
    const vx = this.x;
    const vy = this.y;

    ctx.save();
    // Metal nozzle mounted in wall
    ctx.fillStyle = '#334155';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.5;

    if (this.dir > 0) {
      ctx.fillRect(vx + 20, vy + 8, 12, 16);
      ctx.strokeRect(vx + 20, vy + 8, 12, 16);
      ctx.fillStyle = '#64748b';
      ctx.beginPath();
      ctx.moveTo(vx + 32, vy + 10);
      ctx.lineTo(vx + 36, vy + 8);
      ctx.lineTo(vx + 36, vy + 24);
      ctx.lineTo(vx + 32, vy + 22);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillRect(vx, vy + 8, 12, 16);
      ctx.strokeRect(vx, vy + 8, 12, 16);
      ctx.fillStyle = '#64748b';
      ctx.beginPath();
      ctx.moveTo(vx, vy + 10);
      ctx.lineTo(vx - 4, vy + 8);
      ctx.lineTo(vx - 4, vy + 24);
      ctx.lineTo(vx, vy + 22);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    if (this.state === 'warning') {
      const nozzleX = this.dir > 0 ? vx + 34 : vx - 2;
      const glow = ctx.createRadialGradient(nozzleX, vy + 16, 1, nozzleX, vy + 16, 16);
      glow.addColorStop(0, 'rgba(249, 115, 22, 0.7)');
      glow.addColorStop(1, 'rgba(249, 115, 22, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(nozzleX, vy + 16, 16, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.state === 'active') {
      const hb = this.getHitbox();
      // Rotate 90 deg or draw horizontal flame
      ctx.save();
      ctx.translate(this.dir > 0 ? hb.x : hb.x + hb.w, hb.y + hb.h / 2);
      if (this.dir < 0) ctx.scale(-1, 1);

      // Layered horizontal flame stream
      const grad = ctx.createLinearGradient(0, 0, 128, 0);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.2, '#fde047');
      grad.addColorStop(0.6, '#f97316');
      grad.addColorStop(1, 'rgba(220, 38, 38, 0)');
      ctx.fillStyle = grad;

      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.quadraticCurveTo(64, -12 + Math.sin(this.frame) * 4, 128, 0);
      ctx.quadraticCurveTo(64, 12 + Math.cos(this.frame) * 4, 0, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }
}

/** 3. Rotating Firebar 'o': Pivot block + 5 orbiting fireballs */
export class RotatingFirebar {
  constructor(c, r, opts = {}) {
    this.type = 'rotating_firebar';
    this.c = c;
    this.r = r;
    this.cx = (c + 0.5) * TS;
    this.cy = (r + 0.5) * TS;
    this.dir = c % 2 !== 0 ? -1 : 1;
    this.angle = opts.startAngle || 0;
    this.ballRadius = 7;
    this.ballCount = 5;
    this.spacing = 16;
    this.frost = !!opts.frost || opts.theme === 'frost_mountain';
  }

  getFireballPositions() {
    const balls = [];
    for (let i = 1; i <= this.ballCount; i++) {
      const dist = i * this.spacing;
      const bx = this.cx + Math.cos(this.angle) * dist;
      const by = this.cy + Math.sin(this.angle) * dist;
      balls.push({ x: bx, y: by, r: this.ballRadius });
    }
    return balls;
  }

  update(g, dt) {
    const scales = getDifficultyScales(g);
    const baseDegPerSec = 90 + 8 * (scales.levelDiff - 1);
    const degPerSec = baseDegPerSec * scales.speedMult;
    const radPerSec = (degPerSec * Math.PI) / 180;
    this.angle += this.dir * radPerSec * dt;

    // Fireball contact check
    const p = g.player;
    if (!p) return;
    const balls = this.getFireballPositions();
    for (const b of balls) {
      const box = { x: b.x - b.r, y: b.y - b.r, w: b.r * 2, h: b.r * 2 };
      if (aabb(p, box)) {
        if (p.hurt(g, b.x)) {
          if (!this.frost) p.onFire = 0.5;
        }
        break;
      }
    }
  }

  draw(ctx, camX, camY) {
    ctx.save();
    // 1. Pivot block
    ctx.fillStyle = this.frost ? '#0369a1' : '#451a03';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.5;
    ctx.fillRect(this.cx - 10, this.cy - 10, 20, 20);
    ctx.strokeRect(this.cx - 10, this.cy - 10, 20, 20);

    // Pivot ring
    ctx.fillStyle = this.frost ? '#38bdf8' : '#f59e0b';
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, 5, 0, Math.PI * 2);
    ctx.fill();

    // 2. Chain of 5 fireballs
    const balls = this.getFireballPositions();
    for (let i = 0; i < balls.length; i++) {
      const b = balls[i];
      // Fireball glow
      const glow = ctx.createRadialGradient(b.x, b.y, 1, b.x, b.y, 14);
      if (this.frost) {
        glow.addColorStop(0, '#ffffff');
        glow.addColorStop(0.4, '#38bdf8');
        glow.addColorStop(0.8, '#0284c7');
        glow.addColorStop(1, 'rgba(2, 132, 199, 0)');
      } else {
        glow.addColorStop(0, '#ffffff');
        glow.addColorStop(0.35, '#fde047');
        glow.addColorStop(0.7, '#ea580c');
        glow.addColorStop(1, 'rgba(220, 38, 38, 0)');
      }
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 14, 0, Math.PI * 2);
      ctx.fill();

      // Core
      ctx.fillStyle = this.frost ? '#e0f2fe' : '#ffffff';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r - 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

/** 4. Lava Bubble 'p': Jumps straight up 4 tiles out of lava pool */
export class LavaBubble {
  constructor(c, r, opts = {}) {
    this.type = 'lava_bubble';
    this.c = c;
    this.r = r;
    this.baseX = (c + 0.5) * TS;
    this.baseY = (r + 1) * TS;
    this.x = this.baseX - 10;
    this.y = this.baseY - 10;
    this.w = 20;
    this.h = 20;

    this.jumpHeight = 128; // 4 tiles
    this.period = 2.5;
    this.warnDuration = 0.5;
    this.jumpDuration = 1.0;
    this.timer = (opts.phase !== undefined ? opts.phase : (c * 0.45) % 2.5);
    this.state = 'idle'; // idle | warning | jumping
    this.telegraph = 0;
    this.soundPlayed = false;
  }

  getHitbox() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }

  update(g, dt) {
    const scales = getDifficultyScales(g);
    const idleTime = Math.max(0.6, (this.period - this.warnDuration - this.jumpDuration) * scales.idleMult);
    const warnTime = Math.max(0.45, this.warnDuration * scales.idleMult);
    const jumpTime = this.jumpDuration;

    this.timer += dt;

    if (this.state === 'idle') {
      this.telegraph = 0;
      this.y = this.baseY;
      if (this.timer >= idleTime) {
        this.timer = 0;
        this.state = 'warning';
        this.soundPlayed = false;
      }
    } else if (this.state === 'warning') {
      this.telegraph = Math.max(0, warnTime - this.timer);
      if (!this.soundPlayed) {
        this.soundPlayed = true;
        if (g && g.sfx) g.sfx('lavaBubble', this.baseX, this.baseY);
      }
      // Lava surface bubbling
      if (Math.random() < 0.4) {
        hazardParticles.spawn(
          this.baseX + (Math.random() - 0.5) * 16,
          this.baseY - 2,
          (Math.random() - 0.5) * 10,
          -10 - Math.random() * 20,
          2 + Math.random() * 2,
          '#f97316',
          0.3
        );
      }
      if (this.timer >= warnTime) {
        this.timer = 0;
        this.state = 'jumping';
        // Launch splash
        for (let i = 0; i < 4; i++) {
          hazardParticles.spawn(
            this.baseX,
            this.baseY,
            (Math.random() - 0.5) * 40,
            -30 - Math.random() * 40,
            2,
            '#ef4444',
            0.3
          );
        }
      }
    } else if (this.state === 'jumping') {
      this.telegraph = 0;
      const t = this.timer / jumpTime; // 0 to 1
      const arc = Math.sin(t * Math.PI);
      const curY = this.baseY - this.jumpHeight * arc;
      this.y = curY - 10;

      // Hurt player if touching bubble
      const p = g.player;
      if (p && aabb(p, this.getHitbox())) {
        if (p.hurt(g, this.baseX)) {
          p.onFire = 0.5;
        }
      }

      if (this.timer >= jumpTime) {
        this.timer = 0;
        this.state = 'idle';
        this.y = this.baseY;
      }
    }
  }

  draw(ctx, camX, camY) {
    if (this.state === 'idle') return;

    ctx.save();
    if (this.state === 'warning') {
      // Animated bubble dome on surface
      const progress = this.timer / 0.5;
      const r = 4 + progress * 6;
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.arc(this.baseX, this.baseY - 2, r, Math.PI, 0);
      ctx.fill();
    } else if (this.state === 'jumping') {
      // Stretched droplet arc
      const t = this.timer / this.jumpDuration;
      const vySign = t < 0.5 ? -1 : 1;
      const scaleY = 1.35;
      const scaleX = 0.75;

      ctx.translate(this.baseX, this.y + 10);
      ctx.scale(scaleX, scaleY * (vySign < 0 ? 1 : -1));

      const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, 10);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.3, '#fde047');
      grad.addColorStop(0.7, '#f97316');
      grad.addColorStop(1, '#dc2626');
      ctx.fillStyle = grad;

      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI);
      ctx.lineTo(0, -12);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}

/** 5. Fire Drip 'd': Ceiling drop swells, falls with gravity, splashes harmless embers */
export class FireDrip {
  constructor(c, r, opts = {}) {
    this.type = 'fire_drip';
    this.c = c;
    this.r = r;
    this.cx = (c + 0.5) * TS;
    this.ceilingY = (r + 1) * TS;
    this.x = this.cx - 5;
    this.y = this.ceilingY;
    this.vy = 0;
    this.w = 10;
    this.h = 10;

    this.swellTime = 0.8;
    this.period = 2.2;
    this.timer = opts.phase !== undefined ? opts.phase : ((c * 0.4 + r * 0.2) % 2.2);
    this.state = 'swelling'; // swelling | falling | splashing
    this.telegraph = 0;
    this.splashT = 0;
    this.bossInactive = !!opts.bossArena;
  }

  getHitbox() {
    return { x: this.cx - 5, y: this.y - 5, w: 10, h: 10 };
  }

  update(g, dt) {
    if (this.bossInactive) return;
    const scales = getDifficultyScales(g);
    const swellDuration = Math.max(0.45, this.swellTime * scales.idleMult);

    if (this.state === 'swelling') {
      this.timer += dt;
      this.y = this.ceilingY;
      this.vy = 0;
      this.telegraph = Math.max(0, swellDuration - this.timer);

      if (this.timer >= swellDuration) {
        this.timer = 0;
        this.state = 'falling';
        this.telegraph = 0;
        if (g && g.sfx) g.sfx('drip', this.cx, this.ceilingY);
      }
    } else if (this.state === 'falling') {
      this.telegraph = 0;
      this.vy += 850 * dt;
      this.y += this.vy * dt;

      // Hurt player if contact while falling
      const p = g.player;
      if (p && aabb(p, this.getHitbox())) {
        if (p.hurt(g, this.cx)) {
          p.onFire = 0.5;
        }
      }

      // Check solid floor collision
      const checkR = Math.floor((this.y + 4) / TS);
      const checkC = Math.floor(this.cx / TS);
      if (g.world && (g.world.isSolid(checkC, checkR) || this.y > g.world.h)) {
        this.state = 'splashing';
        this.splashT = 0.4;
        // Harmless ember splash
        for (let i = 0; i < 4; i++) {
          hazardParticles.spawn(
            this.cx,
            checkR * TS,
            (Math.random() - 0.5) * 50,
            -20 - Math.random() * 30,
            1.5,
            '#f97316',
            0.4
          );
        }
      }
    } else if (this.state === 'splashing') {
      this.splashT -= dt;
      if (this.splashT <= 0) {
        this.state = 'swelling';
        this.timer = 0;
        this.y = this.ceilingY;
      }
    }
  }

  draw(ctx, camX, camY) {
    ctx.save();
    if (this.state === 'swelling') {
      const progress = Math.min(1, this.timer / this.swellTime);
      const r = 2 + progress * 4.5;
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.arc(this.cx, this.ceilingY + r - 1, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(this.cx, this.ceilingY + r - 1, r * 0.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.state === 'falling') {
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.arc(this.cx, this.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(this.cx, this.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

/** 7. Burning Plank '!': One-way plank that catches fire after you step on it */
export class BurningPlank {
  constructor(c, r) {
    this.type = 'burning_plank';
    this.c = c;
    this.r = r;
    this.x = c * TS;
    this.y = r * TS;
    this.w = TS;
    this.h = 10;
    this.cx = (c + 0.5) * TS;
    this.cy = (r + 0.5) * TS;

    this.state = 'idle'; // idle | smoking | burning | crumbled
    this.timer = 0;
    this.smokeDuration = 0.6;
    this.burnDuration = 0.8;
    this.regrowDuration = 4.0;
  }

  get active() {
    return this.state !== 'crumbled';
  }

  stepOn(g) {
    if (this.state === 'idle') {
      this.state = 'smoking';
      this.timer = 0;
      if (g && g.sfx) g.sfx('plankIgnite', this.cx, this.cy);
    }
  }

  update(g, dt) {
    if (this.state === 'idle') return;

    this.timer += dt;

    if (this.state === 'smoking') {
      // Emit warning smoke
      if (Math.random() < 0.4) {
        hazardParticles.spawn(
          this.x + Math.random() * this.w,
          this.y + 2,
          (Math.random() - 0.5) * 15,
          -25 - Math.random() * 20,
          2 + Math.random() * 2,
          '#64748b',
          0.4
        );
      }
      if (this.timer >= this.smokeDuration) {
        this.timer = 0;
        this.state = 'burning';
        if (g && g.sfx) g.sfx('fireWhoosh', this.cx, this.cy);
      }
    } else if (this.state === 'burning') {
      // Flames on plank
      if (Math.random() < 0.5) {
        hazardParticles.spawn(
          this.x + Math.random() * this.w,
          this.y,
          (Math.random() - 0.5) * 15,
          -35 - Math.random() * 30,
          2,
          Math.random() < 0.6 ? '#f97316' : '#fef08a',
          0.3
        );
      }

      // Hurts player if standing on it
      const p = g.player;
      if (p && aabb(p, { x: this.x, y: this.y - 2, w: this.w, h: 14 })) {
        if (p.hurt(g, this.cx)) {
          p.onFire = 0.5;
        }
      }

      if (this.timer >= this.burnDuration) {
        this.timer = 0;
        this.state = 'crumbled';
        // Ash poof
        for (let i = 0; i < 6; i++) {
          hazardParticles.spawn(
            this.x + Math.random() * this.w,
            this.y + 4,
            (Math.random() - 0.5) * 30,
            -10 - Math.random() * 25,
            2,
            '#334155',
            0.4
          );
        }
      }
    } else if (this.state === 'crumbled') {
      if (this.timer >= this.regrowDuration) {
        this.timer = 0;
        this.state = 'idle';
      }
    }
  }

  draw(ctx, camX, camY) {
    if (this.state === 'crumbled') return;

    ctx.save();
    const px = this.x;
    const py = this.y;

    if (this.state === 'idle') {
      ctx.fillStyle = '#78350f';
      ctx.fillRect(px, py, this.w, 8);
      ctx.strokeStyle = '#291404';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(px, py, this.w, 8);
      // Wood plank grain
      ctx.strokeStyle = '#92400e';
      ctx.beginPath();
      ctx.moveTo(px + 4, py + 4);
      ctx.lineTo(px + this.w - 4, py + 4);
      ctx.stroke();
    } else if (this.state === 'smoking') {
      // Darkened smoldering plank
      ctx.fillStyle = '#451a03';
      ctx.fillRect(px, py, this.w, 8);
      ctx.strokeStyle = '#ea580c';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(px, py, this.w, 8);
    } else if (this.state === 'burning') {
      // Engulfed in fire
      ctx.fillStyle = '#ea580c';
      ctx.fillRect(px, py, this.w, 8);
      ctx.fillStyle = '#fde047';
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(px + 4 + i * 7, py - 4, 4, 6);
      }
    }
    ctx.restore();
  }
}

/** 8. Rising Lava (level option for 6-1, 6-2) */
export class RisingLava {
  constructor(opts = {}) {
    this.startRow = opts.startRow || 44;
    this.speed = opts.speed || 10; // px/s
    this.delay = opts.delay || 4; // seconds before rising starts
    this.currentY = this.startRow * TS;
    this.active = true;
    this.timer = 0;
    this.pauseTimer = 0;
    this.gateStopY = 0; // set on level load
  }

  pause(duration = 3.0) {
    this.pauseTimer = Math.max(this.pauseTimer, duration);
  }

  update(g, dt) {
    if (!this.active) return;
    if (!this.initialized && g.world) {
      this.initialized = true;
      if (this.currentY > g.world.h) {
        this.currentY = g.world.h;
      }
    }
    this.timer += dt;

    if (this.pauseTimer > 0) {
      this.pauseTimer -= dt;
      return;
    }

    if (this.timer < this.delay) return;

    // Stop 3 tiles below gate row
    if (g.gate && !this.gateStopY) {
      this.gateStopY = (g.gate.r + 3) * TS;
    }

    if (this.gateStopY && this.currentY <= this.gateStopY) {
      this.currentY = this.gateStopY;
      return;
    }

    this.currentY -= this.speed * dt;

    // Check deadly contact with hero
    const p = g.player;
    if (p && (p.y + p.h) >= this.currentY) {
      g.playerFell();
    }
  }

  draw(ctx, camX, camY, worldW, worldH) {
    const ly = Math.round(this.currentY);
    if (ly > camY + VIEW_H + 50) return;

    ctx.save();
    // Lava body
    const grad = ctx.createLinearGradient(0, ly, 0, ly + VIEW_H);
    grad.addColorStop(0, '#f97316');
    grad.addColorStop(0.3, '#dc2626');
    grad.addColorStop(1, '#7f1d1d');
    ctx.fillStyle = grad;
    ctx.fillRect(0, ly, worldW, worldH - ly + 100);

    // Glowing surface line with animated sine wave
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    const t = performance.now() * 0.003;
    ctx.moveTo(0, ly);
    for (let x = 0; x <= worldW; x += 16) {
      ctx.lineTo(x, ly + Math.sin(t + x * 0.05) * 3);
    }
    ctx.stroke();

    ctx.restore();
  }
}

/** 9. Falling Icicle 'A' (World 4): Hangs from ceiling, shakes, falls, shatters */
export class FallingIcicle {
  constructor(c, r) {
    this.type = 'falling_icicle';
    this.c = c;
    this.r = r;
    this.cx = (c + 0.5) * TS;
    this.originY = r * TS;
    this.x = this.cx - 8;
    this.y = this.originY;
    this.w = 16;
    this.h = 28;
    this.vy = 0;

    this.state = 'idle'; // idle | shaking | falling | regrowing
    this.timer = 0;
    this.shakeDuration = 0.6;
    this.regrowDuration = 5.0;
    this.soundPlayed = false;
  }

  getHitbox() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }

  update(g, dt) {
    const scales = getDifficultyScales(g);
    const shakeTime = Math.max(0.45, this.shakeDuration * scales.idleMult);

    if (this.state === 'idle') {
      const p = g.player;
      // Trigger when hero is directly below (+- 1 tile = 48px)
      if (p && Math.abs(p.cx - this.cx) <= 48 && p.y > this.originY) {
        this.state = 'shaking';
        this.timer = 0;
        this.soundPlayed = false;
      }
    } else if (this.state === 'shaking') {
      this.timer += dt;
      if (!this.soundPlayed) {
        this.soundPlayed = true;
        if (g && g.sfx) g.sfx('icicleCrack', this.cx, this.originY);
      }
      if (this.timer >= shakeTime) {
        this.timer = 0;
        this.state = 'falling';
        this.vy = 0;
      }
    } else if (this.state === 'falling') {
      this.vy += 920 * dt;
      this.y += this.vy * dt;

      // Hurts hero on contact
      const p = g.player;
      if (p && aabb(p, this.getHitbox())) {
        p.hurt(g, this.cx);
      }

      // Shatter on ground contact
      const groundR = Math.floor((this.y + this.h) / TS);
      const groundC = Math.floor(this.cx / TS);
      if (g.world && (g.world.isSolid(groundC, groundR) || this.y > g.world.h)) {
        this.state = 'regrowing';
        this.timer = 0;
        if (g && g.sfx) g.sfx('freezeCrack', this.cx, this.y);
        // Ice shard burst
        for (let i = 0; i < 6; i++) {
          hazardParticles.spawn(
            this.cx,
            groundR * TS,
            (Math.random() - 0.5) * 60,
            -20 - Math.random() * 40,
            2 + Math.random() * 2,
            '#93c5fd',
            0.4
          );
        }
      }
    } else if (this.state === 'regrowing') {
      this.timer += dt;
      if (this.timer >= this.regrowDuration) {
        this.timer = 0;
        this.state = 'idle';
        this.y = this.originY;
        this.vy = 0;
      }
    }
  }

  draw(ctx, camX, camY) {
    if (this.state === 'regrowing') return;

    ctx.save();
    let dx = 0;
    if (this.state === 'shaking') {
      dx = (Math.random() - 0.5) * 3;
    }

    const ix = this.cx + dx;
    const iy = this.y;

    // Pointed crystalline icicle
    const grad = ctx.createLinearGradient(ix - 8, iy, ix + 8, iy + this.h);
    grad.addColorStop(0, '#dbeafe');
    grad.addColorStop(0.5, '#60a5fa');
    grad.addColorStop(1, '#1d4ed8');
    ctx.fillStyle = grad;
    ctx.strokeStyle = '#1e3a8a';
    ctx.lineWidth = 1.2;

    ctx.beginPath();
    ctx.moveTo(ix - 7, iy);
    ctx.lineTo(ix + 7, iy);
    ctx.lineTo(ix, iy + this.h);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }
}

/** 10. Crystal Laser 'D' (World 5): Thin aiming guide for 0.8s, then 0.5s beam */
export class CrystalLaser {
  constructor(c, r, opts = {}) {
    this.type = 'crystal_laser';
    this.c = c;
    this.r = r;
    this.x = c * TS;
    this.y = r * TS;
    this.cx = (c + 0.5) * TS;
    this.cy = (r + 0.5) * TS;
    this.dir = opts.dir || (c < 24 ? 1 : -1); // 1 = right, -1 = left

    this.period = 3.0;
    this.warnDuration = 0.8;
    this.activeDuration = 0.5;
    this.timer = opts.phase !== undefined ? opts.phase : ((c * 0.35 + r * 0.2) % 3.0);
    this.state = 'idle';
    this.telegraph = 0;
    this.soundPlayed = false;
    this.beamEnd = this.cx;
    this.bossInactive = !!opts.bossArena;
  }

  computeBeam(g) {
    let checkC = this.c + (this.dir > 0 ? 1 : -1);
    while (checkC >= 0 && checkC < g.world.cols) {
      if (g.world.isSolid(checkC, this.r)) {
        return this.dir > 0 ? checkC * TS : (checkC + 1) * TS;
      }
      checkC += this.dir > 0 ? 1 : -1;
    }
    return this.dir > 0 ? g.world.w : 0;
  }

  getHitbox() {
    const x0 = Math.min(this.cx, this.beamEnd);
    const x1 = Math.max(this.cx, this.beamEnd);
    return { x: x0, y: this.cy - 6, w: x1 - x0, h: 12 };
  }

  update(g, dt) {
    if (this.bossInactive) return;
    const scales = getDifficultyScales(g);
    const idleTime = Math.max(0.8, (this.period - this.warnDuration - this.activeDuration) * scales.idleMult);
    const warnTime = Math.max(0.45, this.warnDuration * scales.idleMult);
    const activeTime = this.activeDuration;

    this.timer += dt;
    this.beamEnd = this.computeBeam(g);

    if (this.state === 'idle') {
      this.telegraph = 0;
      if (this.timer >= idleTime) {
        this.timer = 0;
        this.state = 'warning';
        this.soundPlayed = false;
      }
    } else if (this.state === 'warning') {
      this.telegraph = Math.max(0, warnTime - this.timer);
      if (!this.soundPlayed) {
        this.soundPlayed = true;
        if (g && g.sfx) g.sfx('laserCharge', this.cx, this.cy);
      }
      if (this.timer >= warnTime) {
        this.timer = 0;
        this.state = 'active';
        this.soundPlayed = false;
        if (g && g.sfx) g.sfx('laserFire', this.cx, this.cy);
      }
    } else if (this.state === 'active') {
      this.telegraph = 0;
      const p = g.player;
      if (p && aabb(p, this.getHitbox())) {
        p.hurt(g, this.cx);
      }
      if (this.timer >= activeTime) {
        this.timer = 0;
        this.state = 'idle';
      }
    }
  }

  draw(ctx, camX, camY) {
    ctx.save();
    // Crystal emitter housing
    ctx.fillStyle = '#6366f1';
    ctx.fillRect(this.cx - 8, this.cy - 8, 16, 16);
    ctx.strokeStyle = '#312e81';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(this.cx - 8, this.cy - 8, 16, 16);

    // Glowing prism
    ctx.fillStyle = '#c084fc';
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, 5, 0, Math.PI * 2);
    ctx.fill();

    if (this.state === 'warning') {
      // Thin aiming line
      ctx.strokeStyle = 'rgba(232, 121, 249, 0.45)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(this.cx, this.cy);
      ctx.lineTo(this.beamEnd, this.cy);
      ctx.stroke();
    } else if (this.state === 'active') {
      // Full bright laser beam
      ctx.strokeStyle = 'rgba(192, 132, 252, 0.5)';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(this.cx, this.cy);
      ctx.lineTo(this.beamEnd, this.cy);
      ctx.stroke();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(this.cx, this.cy);
      ctx.lineTo(this.beamEnd, this.cy);
      ctx.stroke();
    }
    ctx.restore();
  }
}

/** 11. Thorn Bramble 'R' (Worlds 1-2): Static thorny bush, hurts on touch, destroyed by fire knife */
export class ThornBramble {
  constructor(c, r) {
    this.type = 'thorn_bramble';
    this.c = c;
    this.r = r;
    this.x = c * TS;
    this.y = r * TS;
    this.w = TS;
    this.h = TS;
    this.cx = (c + 0.5) * TS;
    this.cy = (r + 0.5) * TS;
    this.destroyed = false;
    this.dead = false;
  }

  getHitbox() {
    return { x: this.x + 2, y: this.y + 8, w: this.w - 4, h: this.h - 8 };
  }

  burn(g) {
    this.destroyWithFire(g);
  }

  destroyWithFire(g) {
    if (this.destroyed) return;
    this.destroyed = true;
    this.dead = true;
    if (g && g.sfx) g.sfx('fireWhoosh', this.cx, this.cy);
    for (let i = 0; i < 8; i++) {
      hazardParticles.spawn(
        this.cx + (Math.random() - 0.5) * 20,
        this.cy + (Math.random() - 0.5) * 16,
        (Math.random() - 0.5) * 40,
        -20 - Math.random() * 40,
        2 + Math.random() * 2,
        Math.random() < 0.6 ? '#f97316' : '#fef08a',
        0.4
      );
    }
  }

  update(g, dt) {
    if (this.destroyed) return;
    const p = g.player;
    if (p && aabb(p, this.getHitbox())) {
      p.hurt(g, this.cx);
    }
  }

  draw(ctx, camX, camY) {
    if (this.destroyed) return;

    ctx.save();
    const bx = this.x;
    const by = this.y;

    // Spiky bramble bush
    ctx.fillStyle = '#14532d';
    ctx.beginPath();
    ctx.arc(bx + 16, by + 20, 11, 0, Math.PI * 2);
    ctx.fill();

    // Sharp thorns
    ctx.fillStyle = '#7f1d1d';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.2;

    const thorns = [
      [bx + 6, by + 12, bx + 10, by + 18, bx + 4, by + 19],
      [bx + 26, by + 12, bx + 28, by + 19, bx + 22, by + 18],
      [bx + 16, by + 7, bx + 12, by + 14, bx + 20, by + 14]
    ];
    for (const [x1, y1, x2, y2, x3, y3] of thorns) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x3, y3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }
}

/** 12. Sand Geyser 'E' (World 3): Bubbles 0.7s, blasts sand 3 tiles up for 0.8s, launches hero */
export class SandGeyser {
  constructor(c, r, opts = {}) {
    this.type = 'sand_geyser';
    this.c = c;
    this.r = r;
    this.x = c * TS;
    this.y = r * TS;
    this.cx = (c + 0.5) * TS;
    this.cy = (r + 0.5) * TS;

    this.baseIdle = 1.5;
    this.baseWarn = 0.7;
    this.warnDuration = 0.7;
    this.baseActive = 0.8;

    this.timer = opts.phase !== undefined ? opts.phase : ((c * 0.4) % 3.0);
    this.state = 'idle'; // idle | warning | active
    this.telegraph = 0;
    this.soundPlayed = false;
  }

  getHitbox() {
    return {
      x: this.c * TS + 4,
      y: (this.r - 2) * TS,
      w: 24,
      h: 96
    };
  }

  update(g, dt) {
    const scales = getDifficultyScales(g);
    const idleTime = Math.max(0.7, this.baseIdle * scales.idleMult);
    const warnTime = Math.max(0.45, this.baseWarn * scales.idleMult);
    const activeTime = this.baseActive;

    this.timer += dt;

    if (this.state === 'idle') {
      this.telegraph = 0;
      if (this.timer >= idleTime) {
        this.timer = 0;
        this.state = 'warning';
        this.soundPlayed = false;
      }
    } else if (this.state === 'warning') {
      this.telegraph = Math.max(0, warnTime - this.timer);
      if (!this.soundPlayed) {
        this.soundPlayed = true;
        if (g && g.sfx) g.sfx('geyser', this.cx, this.cy);
      }
      // Sand bubbling particles
      if (Math.random() < 0.4) {
        hazardParticles.spawn(
          this.cx + (Math.random() - 0.5) * 16,
          this.y + 24,
          (Math.random() - 0.5) * 15,
          -15 - Math.random() * 20,
          2 + Math.random() * 1.5,
          '#d97706',
          0.35
        );
      }
      if (this.timer >= warnTime) {
        this.timer = 0;
        this.state = 'active';
      }
    } else if (this.state === 'active') {
      this.telegraph = 0;
      // High-pressure sand blast
      if (Math.random() < 0.6) {
        hazardParticles.spawn(
          this.cx + (Math.random() - 0.5) * 18,
          this.y + 20,
          (Math.random() - 0.5) * 20,
          -150 - Math.random() * 80,
          2 + Math.random() * 2,
          Math.random() < 0.5 ? '#f59e0b' : '#d97706',
          0.4
        );
      }

      // LAUNCHES HERO (vy = -620) instead of hurting!
      const p = g.player;
      if (p && aabb(p, this.getHitbox())) {
        p.vy = -620;
        p.grounded = false;
        p.climbing = false;
        p.isGroundPounding = false;
      }

      if (this.timer >= activeTime) {
        this.timer = 0;
        this.state = 'idle';
      }
    }
  }

  draw(ctx, camX, camY) {
    const vx = this.x;
    const vy = this.y;

    ctx.save();
    // Sand vent opening
    ctx.fillStyle = '#78350f';
    ctx.fillRect(vx + 4, vy + 24, 24, 8);
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(vx + 4, vy + 24, 24, 8);

    if (this.state === 'warning') {
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(this.cx, vy + 24, 6, Math.PI, 0);
      ctx.fill();
    } else if (this.state === 'active') {
      const hb = this.getHitbox();
      const grad = ctx.createLinearGradient(0, hb.y + hb.h, 0, hb.y);
      grad.addColorStop(0, '#d97706');
      grad.addColorStop(0.4, '#f59e0b');
      grad.addColorStop(1, 'rgba(254, 240, 138, 0.2)');
      ctx.fillStyle = grad;

      ctx.beginPath();
      ctx.moveTo(hb.x, hb.y + hb.h);
      ctx.lineTo(hb.x + 3, hb.y);
      ctx.lineTo(hb.x + hb.w - 3, hb.y);
      ctx.lineTo(hb.x + hb.w, hb.y + hb.h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}
