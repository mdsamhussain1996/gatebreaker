/**
 * Gatebreaker — Canvas 2D renderer.
 * Static terrain and 3-layer parallax backgrounds are baked to offscreen canvases.
 * The theme system defines all materials and parallax painters.
 */
import { TS, VIEW_W, VIEW_H } from './constants.js';
import { bridgeSag } from './game.js';
import { getTheme } from './themes.js';
import { POWERUP_DEFS, BlasterBolt, FlameWave } from './items.js';

const hash = (c, r) => (((c * 73856093) ^ (r * 19349663)) >>> 0);

// Cached radial glow canvases for fast zero-allocation glow rendering
const glowCanvases = new Map();
function getCachedGlow(color, radius) {
  const key = `${color}_${radius}`;
  let cv = glowCanvases.get(key);
  if (!cv && typeof document !== 'undefined') {
    cv = document.createElement('canvas');
    const d = radius * 2;
    cv.width = d;
    cv.height = d;
    const gctx = cv.getContext('2d');
    const grad = gctx.createRadialGradient(radius, radius, 1, radius, radius, radius);
    grad.addColorStop(0, color);
    grad.addColorStop(1, 'transparent');
    gctx.fillStyle = grad;
    gctx.beginPath();
    gctx.arc(radius, radius, radius, 0, Math.PI * 2);
    gctx.fill();
    glowCanvases.set(key, cv);
  }
  return cv;
}

/**
 * Bake the static world tiles into an offscreen canvas.
 * Uses the theme's procedural tile painters with ZERO hardcoded theme checks.
 */
function drawBakedProp(ctx, theme, px, py, h) {
  const type = h % 8;
  const tid = theme.id;
  const x = px + 8;
  const y = py;

  ctx.save();
  if (tid === 'green_hills') {
    if (type === 0) {
      ctx.fillStyle = '#64748b'; ctx.fillRect(x, y - 10, 8, 10);
      ctx.fillStyle = '#fef08a'; ctx.fillRect(x + 2, y - 8, 4, 4);
      ctx.fillStyle = '#475569'; ctx.fillRect(x - 2, y - 12, 12, 3);
    } else if (type === 1) {
      ctx.fillStyle = '#22c55e'; ctx.fillRect(x + 2, y - 8, 2, 8); ctx.fillRect(x + 6, y - 6, 2, 6);
      ctx.fillStyle = '#ec4899'; ctx.fillRect(x + 1, y - 10, 4, 4);
      ctx.fillStyle = '#eab308'; ctx.fillRect(x + 5, y - 8, 4, 4);
    } else if (type === 2) {
      ctx.fillStyle = '#78350f'; ctx.fillRect(x + 3, y - 14, 3, 14);
      ctx.fillStyle = '#92400e'; ctx.fillRect(x, y - 13, 11, 5);
      ctx.fillStyle = '#fef3c7'; ctx.fillRect(x + 2, y - 11, 7, 1);
    } else if (type === 3) {
      ctx.fillStyle = '#b45309'; ctx.beginPath(); ctx.arc(x + 5, y - 4, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#d97706'; ctx.fillRect(x + 2, y - 9, 6, 2);
    } else if (type === 4) {
      ctx.fillStyle = '#78350f'; ctx.fillRect(x + 4, y - 12, 2, 12);
      ctx.fillStyle = '#16a34a'; ctx.beginPath(); ctx.arc(x + 5, y - 12, 6, 0, Math.PI * 2); ctx.fill();
    } else if (type === 5) {
      ctx.fillStyle = '#854d0e'; ctx.fillRect(x, y - 10, 10, 10);
      ctx.fillStyle = '#475569'; ctx.fillRect(x, y - 8, 10, 1.5); ctx.fillRect(x, y - 3, 10, 1.5);
    } else if (type === 6) {
      ctx.fillStyle = '#f8fafc'; ctx.fillRect(x + 2, y - 6, 2, 6); ctx.fillRect(x + 6, y - 4, 2, 4);
      ctx.fillStyle = '#ef4444';
      ctx.beginPath(); ctx.arc(x + 3, y - 6, 4, Math.PI, 0); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 7, y - 4, 3, Math.PI, 0); ctx.fill();
    } else {
      ctx.fillStyle = '#475569'; ctx.beginPath(); ctx.arc(x + 5, y - 3, 6, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#4ade80'; ctx.fillRect(x + 2, y - 7, 5, 2);
    }
  } else if (tid === 'autumn_forest') {
    if (type === 0) {
      ctx.fillStyle = '#451a03'; ctx.fillRect(x + 3, y - 16, 2, 16);
      ctx.fillStyle = '#f59e0b'; ctx.fillRect(x + 1, y - 14, 6, 6);
      ctx.fillStyle = '#292524'; ctx.fillRect(x, y - 15, 8, 2);
    } else if (type === 1) {
      ctx.fillStyle = '#78350f'; ctx.fillRect(x, y - 8, 10, 8);
      ctx.fillStyle = '#292524'; ctx.fillRect(x + 2, y - 8, 6, 3);
      ctx.fillStyle = '#65a30d'; ctx.fillRect(x - 1, y - 4, 3, 3);
    } else if (type === 2) {
      ctx.fillStyle = '#92400e'; ctx.fillRect(x + 1, y - 12, 8, 12);
      ctx.fillStyle = '#fef08a'; ctx.fillRect(x + 3, y - 10, 2, 2); ctx.fillRect(x + 6, y - 10, 2, 2);
    } else if (type === 3) {
      ctx.fillStyle = '#fcd34d'; ctx.fillRect(x + 2, y - 5, 2, 5); ctx.fillRect(x + 7, y - 7, 2, 7);
      ctx.fillStyle = '#ea580c';
      ctx.beginPath(); ctx.arc(x + 3, y - 5, 4, Math.PI, 0); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 8, y - 7, 4.5, Math.PI, 0); ctx.fill();
    } else if (type === 4) {
      ctx.fillStyle = '#a16207';
      ctx.beginPath(); ctx.arc(x + 3, y - 3, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 8, y - 3, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#451a03'; ctx.fillRect(x + 2, y - 6, 2, 2); ctx.fillRect(x + 7, y - 6, 2, 2);
    } else if (type === 5) {
      ctx.fillStyle = '#57534e'; ctx.fillRect(x + 1, y - 11, 7, 11);
      ctx.fillStyle = '#f59e0b'; ctx.fillRect(x + 2, y - 8, 3, 3);
    } else if (type === 6) {
      ctx.fillStyle = '#ea580c'; ctx.beginPath(); ctx.ellipse(x + 5, y - 3, 7, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#facc15'; ctx.fillRect(x + 3, y - 5, 4, 3);
      ctx.strokeStyle = '#451a03'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x + 1, y - 2); ctx.lineTo(x + 9, y - 7); ctx.stroke();
    } else {
      ctx.fillStyle = '#451a03'; ctx.fillRect(x + 1, y - 16, 2, 16);
      ctx.fillStyle = '#b91c1c'; ctx.beginPath();
      ctx.moveTo(x + 3, y - 15); ctx.lineTo(x + 11, y - 12); ctx.lineTo(x + 3, y - 9);
      ctx.closePath(); ctx.fill();
    }
  } else if (tid === 'desert_ruins') {
    if (type === 0) {
      ctx.fillStyle = '#c2410c'; ctx.beginPath(); ctx.arc(x + 5, y - 5, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ea580c'; ctx.fillRect(x + 3, y - 11, 4, 3);
    } else if (type === 1) {
      ctx.fillStyle = '#15803d'; ctx.fillRect(x + 3, y - 12, 4, 12);
      ctx.fillRect(x + 1, y - 9, 3, 3); ctx.fillRect(x + 6, y - 7, 3, 3);
      ctx.fillStyle = '#f43f5e'; ctx.fillRect(x + 4, y - 14, 2, 2);
    } else if (type === 2) {
      ctx.fillStyle = '#f8fafc'; ctx.fillRect(x + 2, y - 6, 6, 6);
      ctx.fillStyle = '#0f172a'; ctx.fillRect(x + 3, y - 4, 1.5, 2); ctx.fillRect(x + 6, y - 4, 1.5, 2);
      ctx.strokeStyle = '#cbd5e1'; ctx.beginPath(); ctx.moveTo(x + 2, y - 6); ctx.lineTo(x - 1, y - 10); ctx.stroke();
    } else if (type === 3) {
      ctx.fillStyle = '#d97706'; ctx.fillRect(x, y - 8, 10, 8);
      ctx.fillStyle = '#b45309'; ctx.fillRect(x - 1, y - 10, 12, 3);
    } else if (type === 4) {
      ctx.fillStyle = '#b45309'; ctx.beginPath();
      ctx.moveTo(x + 1, y); ctx.lineTo(x + 3, y - 13); ctx.lineTo(x + 6, y - 13); ctx.lineTo(x + 8, y);
      ctx.closePath(); ctx.fill();
    } else if (type === 5) {
      ctx.fillStyle = '#78350f'; ctx.fillRect(x + 2, y - 16, 2, 16);
      ctx.fillStyle = '#fed7aa'; ctx.fillRect(x + 4, y - 15, 7, 8);
    } else if (type === 6) {
      ctx.fillStyle = '#92400e'; ctx.fillRect(x + 1, y - 9, 8, 9);
      ctx.fillStyle = '#fef08a'; ctx.fillRect(x + 3, y - 7, 4, 1.5); ctx.fillRect(x + 3, y - 4, 4, 1.5);
    } else {
      ctx.fillStyle = '#c2410c'; ctx.fillRect(x + 2, y - 7, 7, 7);
      ctx.fillStyle = '#451a03'; ctx.fillRect(x + 4, y - 6, 1, 4);
    }
  } else {
    ctx.fillStyle = '#38bdf8'; ctx.beginPath();
    ctx.moveTo(x + 5, y - 12); ctx.lineTo(x + 9, y); ctx.lineTo(x + 1, y);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

export function bakeTerrain(world, theme = getTheme('green_hills')) {
  const cv = document.createElement('canvas');
  cv.width = world.w;
  cv.height = world.h;
  const x = cv.getContext('2d');

  for (let r = 0; r < world.rowCount; r++) {
    for (let c = 0; c < world.cols; c++) {
      const ch = world.get(c, r);
      if (ch === '.' || ch === 'X' || ch === '~') continue; // crates and bridges are dynamic

      const px = c * TS, py = r * TS;
      const h = hash(c, r);
      const neighbors = {
        top: world.get(c, r - 1),
        bottom: world.get(c, r + 1),
        left: world.get(c - 1, r),
        right: world.get(c + 1, r)
      };

      if (ch === '#') {
        theme.terrain.soil(x, px, py, TS, h, neighbors);
      } else if (ch === '=') {
        const capped = neighbors.bottom === '#';
        theme.terrain.cap(x, px, py, TS, h, capped, neighbors);
      } else if (ch === 'H') {
        theme.terrain.ladder(x, px, py, TS, h);
      } else if (ch === '|') {
        const isEnd = neighbors.bottom !== '|';
        theme.terrain.rope(x, px, py, TS, h, isEnd);
      }

      // Terrain highlights, shadows, rim lights & hanging roots
      if (ch === '#' || ch === '=') {
        const isTop = neighbors.top === '.' || neighbors.top === ' ';
        const isBottom = neighbors.bottom === '.' || neighbors.bottom === ' ';
        const isLeft = neighbors.left === '.' || neighbors.left === ' ';
        const isRight = neighbors.right === '.' || neighbors.right === ' ';

        // Top highlight
        if (isTop) {
          x.fillStyle = 'rgba(255, 255, 255, 0.22)';
          x.fillRect(px, py, TS, 2);
          // Seeded decorative props on ground
          if (ch === '=' && (h % 5) === 0) {
            drawBakedProp(x, theme, px, py, h);
          }
        }
        // Bottom shadow & hanging roots/vines
        if (isBottom) {
          x.fillStyle = 'rgba(0, 0, 0, 0.35)';
          x.fillRect(px, py + TS - 3, TS, 3);
          if ((h % 3) === 0) {
            const rootH = 5 + (h % 12);
            x.strokeStyle = theme.id === 'autumn_forest' ? '#451a03' : (theme.id === 'desert_ruins' ? '#78350f' : '#1e293b');
            x.lineWidth = 1.5;
            x.beginPath();
            x.moveTo(px + (h % 18) + 6, py + TS);
            x.lineTo(px + (h % 18) + 4, py + TS + rootH);
            x.stroke();
          }
        }
        // Side rim lights
        if (isLeft) {
          x.fillStyle = 'rgba(255, 255, 255, 0.14)';
          x.fillRect(px, py, 2, TS);
        }
        if (isRight) {
          x.fillStyle = 'rgba(0, 0, 0, 0.22)';
          x.fillRect(px + TS - 2, py, 2, TS);
        }
      }
    }
  }
  return cv;
}

/** Pre-render a parallax layer into an offscreen canvas */
function bakeParallax(painter, w, h) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d');
  painter(ctx, w, h);
  return cv;
}

export class Renderer {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.terrain = null;
    this.parallaxFar = null;
    this.parallaxMid = null;
    this.parallaxNear = null;
    this.parallaxFoliage = null;
    this.theme = null;
    this.reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.t = 0;
    this.ambientParticles = [];
  }

  setLevel(world, theme = getTheme('green_hills')) {
    this.theme = theme;
    this.terrain = bakeTerrain(world, theme);

    // Bake 4 parallax layers (wrap width 1400 px, height 540 px)
    const pw = 1400, ph = VIEW_H;
    this.parallaxFar = bakeParallax(theme.parallax.far, pw, ph);
    this.parallaxMid = bakeParallax(theme.parallax.mid, pw, ph);
    this.parallaxNear = bakeParallax(theme.parallax.near, pw, ph);
    if (typeof theme.parallax?.foliage === 'function') {
      this.parallaxFoliage = bakeParallax(theme.parallax.foliage, pw, ph);
    } else {
      this.parallaxFoliage = null;
    }

    // Initialize ambient particles
    this.ambientParticles = [];
    const cfg = theme.ambientParticles;
    if (cfg && cfg.count > 0) {
      for (let i = 0; i < cfg.count; i++) {
        this.ambientParticles.push({
          x: Math.random() * VIEW_W,
          y: Math.random() * VIEW_H,
          vx: (Math.random() - 0.5) * 20,
          vy: cfg.type === 'snow' ? 40 + Math.random() * 40 : (cfg.type === 'ember' ? -30 - Math.random() * 40 : (Math.random() - 0.5) * 15),
          size: 2 + Math.random() * 2.5,
          color: cfg.colors[i % cfg.colors.length],
          phase: Math.random() * Math.PI * 2
        });
      }
    }
  }

  draw(g, dt) {
    const ctx = this.ctx;
    const theme = g.theme || this.theme || getTheme('green_hills');
    this.t += dt;
    const camX = Math.round(g.cam.x + (g.shake ? (Math.random() - 0.5) * g.shake : 0));
    const camY = Math.round(g.cam.y + (g.shake ? (Math.random() - 0.5) * g.shake : 0));

    // 1. Sky & Parallax
    this.drawSky(ctx, camX, camY, g.world, theme);

    ctx.save();
    ctx.translate(-camX, -camY);

    // 2. Static baked terrain (clipped to visible viewport)
    const sx = Math.max(0, camX), sy = Math.max(0, camY);
    const sw = Math.min(VIEW_W, g.world.w - sx), sh = Math.min(VIEW_H, g.world.h - sy);
    if (sw > 0 && sh > 0 && this.terrain) {
      ctx.drawImage(this.terrain, sx, sy, sw, sh, sx, sy, sw, sh);
    }

    // 3. World Entities & Props
    this.drawSpikes(ctx, g);
    this.drawCheckpoints(ctx, g);
    this.drawChests(ctx, g);
    this.drawGate(ctx, g.gate);
    this.drawCrates(ctx, g, camX, camY);
    for (const b of g.bridges) this.drawBridge(ctx, b);

    // Interactive mechanics
    for (const sp of (g.springs || [])) this.drawSpring(ctx, sp);
    for (const cp of (g.crumblingPlanks || [])) this.drawCrumblingPlank(ctx, cp);
    for (const mp of (g.movingPlanks || [])) this.drawMovingPlank(ctx, mp);
    for (const cl of (g.lifts || [])) this.drawCraneLift(ctx, cl);
    for (const pr of (g.projectiles || [])) this.drawProjectile(ctx, pr);

    // 4. Collectibles (culled to visible viewport + 32px padding)
    const minX = camX - 48, maxX = camX + VIEW_W + 48;
    const minY = camY - 48, maxY = camY + VIEW_H + 48;
    for (const c of g.coins) if (!c.collected && c.x >= minX && c.x <= maxX && c.y >= minY && c.y <= maxY) this.drawCoin(ctx, c);
    for (const gm of g.gems) if (!gm.collected && gm.x >= minX && gm.x <= maxX && gm.y >= minY && gm.y <= maxY) this.drawGem(ctx, gm);
    for (const st of g.stars) if (!st.collected && st.x >= minX && st.x <= maxX && st.y >= minY && st.y <= maxY) this.drawStar(ctx, st);
    for (const ht of g.hearts) if (!ht.collected && ht.x >= minX && ht.x <= maxX && ht.y >= minY && ht.y <= maxY) this.drawHeart(ctx, ht);

    // 5. Enemies & Bosses (culled to visible viewport)
    for (const e of g.enemies) {
      if (e.dead) continue;
      const ew = e.w || 32, eh = e.h || 32;
      if (e.x + ew < minX || e.x > maxX || e.y + eh < minY || e.y > maxY) continue;

      if (e.type === 'mushroom') this.drawMushroom(ctx, e);
      else if (e.type === 'hedgehog') this.drawHedgehog(ctx, e);
      else if (e.type === 'squirrel') this.drawSquirrel(ctx, e);
      else if (e.type === 'snapvine') this.drawSnapvine(ctx, e);
      else if (e.type === 'scorpion') this.drawScorpion(ctx, e);
      else if (e.type === 'sand_worm') this.drawSandWorm(ctx, e);
      else if (e.type === 'buzz_bee') this.drawBuzzBee(ctx, e);
      else if (e.type === 'night_bat') this.drawNightBat(ctx, e);
      else if (e.type === 'hopper_frog') this.drawHopperFrog(ctx, e);
      else if (e.type === 'wild_boar') this.drawWildBoar(ctx, e);
      else if (e.type === 'leaf_glider') this.drawLeafGlider(ctx, e);
      else if (e.type === 'rolling_armadillo') this.drawRollingArmadillo(ctx, e);
      else if (e.type === 'desert_hawk') this.drawDesertHawk(ctx, e);
      else if (e.type === 'spinning_saw') this.drawSpinningSaw(ctx, e);
      else if (e.isBoss) this.drawBoss(ctx, e);

      if (e.telegraph > 0 && e.type !== 'desert_hawk') {
        this.drawTelegraphIndicator(ctx, e);
      }
    }

    // 5.5 Power Orbs, Projectiles, Ice Blocks & Afterimages
    this.drawIceBlocks(ctx, g);
    this.drawPowerOrbs(ctx, g);
    this.drawProjectiles(ctx, g);
    this.drawAfterimages(ctx, g);

    // 6. Key, Hero & Particles
    if (g.key) this.drawKey(ctx, g.key);
    this.drawHero(ctx, g.player);
    this.drawParticles(ctx, g);
    this.drawShockwave(ctx, g);
    this.drawHints(ctx, g);

    // Closed arena barrier
    if (g.arenaLocked && g.arenaLeft !== null) this.drawArenaBarrier(ctx, g);
    // Dropped key golden beam of light
    if (g.keyBeam) this.drawKeyBeam(ctx, g.keyBeam);

    ctx.restore();

    // 7. Ambient particles (screen space)
    this.drawAmbient(ctx, dt, theme);

    // 7.5 Atmosphere & Foreground
    this.drawAtmosphere(ctx, theme, camX, camY);
    this.drawForeground(ctx, camX, camY, theme);

    // 8. Screen space overlays: Gate edge arrow & Boss health bar
    this.drawGateArrow(ctx, g, camX, camY);
    if (g.boss && g.bossArenaEntered) this.drawBossHealthBar(ctx, g.boss);
    if (g.bossIntro) this.drawBossIntro(ctx, g.bossIntro);
  }

  // ------------------------------------------------------------ background
  drawSky(ctx, camX, camY, world, theme) {
    // Sky gradient
    const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    for (const [stop, color] of theme.sky) {
      grad.addColorStop(stop, color);
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    const pw = 1400;

    // Layer 1: Far Parallax (scroll factor 0.08)
    if (this.parallaxFar) {
      const offFar = -((camX * 0.08) % pw);
      ctx.drawImage(this.parallaxFar, offFar, 0);
      if (offFar + pw < VIEW_W) ctx.drawImage(this.parallaxFar, offFar + pw, 0);
      if (offFar > 0) ctx.drawImage(this.parallaxFar, offFar - pw, 0);
    }

    // Layer 2: Mid Parallax (scroll factor 0.28)
    if (this.parallaxMid) {
      const offMid = -((camX * 0.28) % pw);
      ctx.drawImage(this.parallaxMid, offMid, 0);
      if (offMid + pw < VIEW_W) ctx.drawImage(this.parallaxMid, offMid + pw, 0);
      if (offMid > 0) ctx.drawImage(this.parallaxMid, offMid - pw, 0);
    }

    // Layer 3: Near Parallax (scroll factor 0.55)
    if (this.parallaxNear) {
      const offNear = -((camX * 0.55) % pw);
      ctx.drawImage(this.parallaxNear, offNear, 0);
      if (offNear + pw < VIEW_W) ctx.drawImage(this.parallaxNear, offNear + pw, 0);
      if (offNear > 0) ctx.drawImage(this.parallaxNear, offNear - pw, 0);
    }

    // Layer 4: Near Foliage / Canopy (scroll factor 0.75)
    if (this.parallaxFoliage) {
      const offFol = -((camX * 0.75) % pw);
      ctx.drawImage(this.parallaxFoliage, offFol, 0);
      if (offFol + pw < VIEW_W) ctx.drawImage(this.parallaxFoliage, offFol + pw, 0);
      if (offFol > 0) ctx.drawImage(this.parallaxFoliage, offFol - pw, 0);
    }

    // Procedural Clouds / Atmosphere
    if (theme.clouds) {
      theme.clouds(ctx, this.t, camX, camY);
    }
  }

  drawAmbient(ctx, dt, theme) {
    if (!this.ambientParticles.length) return;
    const cfg = theme.ambientParticles;
    ctx.save();
    for (const p of this.ambientParticles) {
      p.phase += dt * 3;
      p.x += p.vx * dt + Math.sin(p.phase) * 0.5;
      p.y += p.vy * dt;
      if (p.x < -10) p.x = VIEW_W + 10;
      if (p.x > VIEW_W + 10) p.x = -10;
      if (p.y < -10) p.y = VIEW_H + 10;
      if (p.y > VIEW_H + 10) p.y = -10;

      const alpha = 0.4 + Math.sin(p.phase) * 0.3;
      ctx.globalAlpha = Math.max(0.1, Math.min(0.9, alpha));
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.restore();
  }

  // ------------------------------------------------------------ world props
  drawCrates(ctx, g, camX, camY) {
    const w = g.world;
    const c0 = Math.max(0, Math.floor(camX / TS)), c1 = Math.min(w.cols - 1, Math.floor((camX + VIEW_W) / TS));
    const r0 = Math.max(0, Math.floor(camY / TS)), r1 = Math.min(w.rowCount - 1, Math.floor((camY + VIEW_H) / TS));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (w.get(c, r) !== 'X') continue;
        const x = c * TS, y = r * TS;
        ctx.fillStyle = '#c98a4b';
        ctx.fillRect(x + 1, y + 1, TS - 2, TS - 2);
        ctx.strokeStyle = '#7a4a1e';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 2, y + 2, TS - 4, TS - 4);
        ctx.beginPath();
        ctx.moveTo(x + 3, y + 3); ctx.lineTo(x + TS - 3, y + TS - 3);
        ctx.moveTo(x + TS - 3, y + 3); ctx.lineTo(x + 3, y + TS - 3);
        ctx.stroke();
      }
    }
  }

  drawBridge(ctx, b) {
    const x0 = b.c0 * TS, x1 = (b.c1 + 1) * TS, y = b.row * TS;
    const sag = xx => bridgeSag(b, xx);

    // Rails
    ctx.strokeStyle = '#a4743a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let xx = x0; xx <= x1; xx += 8) {
      const yy = y - 24 + sag(xx) * 0.55;
      if (xx === x0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
    }
    ctx.stroke();

    ctx.lineWidth = 1.5;
    for (let xx = x0 + 16; xx < x1; xx += 32) {
      ctx.beginPath();
      ctx.moveTo(xx, y - 24 + sag(xx) * 0.55);
      ctx.lineTo(xx, y + sag(xx));
      ctx.stroke();
    }

    // Posts
    ctx.fillStyle = '#6e4620';
    ctx.fillRect(x0 - 3, y - 30, 6, 40);
    ctx.fillRect(x1 - 3, y - 30, 6, 40);

    // Planks follow the sag curve
    for (let xx = x0; xx < x1; xx += 8) {
      const yy = y + sag(xx + 4);
      ctx.fillStyle = ((xx - x0) / 8) % 2 ? '#b9803e' : '#a56f33';
      ctx.fillRect(xx, yy, 7.5, 7);
      ctx.fillStyle = 'rgba(255,230,170,0.35)';
      ctx.fillRect(xx, yy, 7.5, 2);
    }
  }

  drawCheckpoints(ctx, g) {
    for (const cp of g.checkpoints) {
      const x = cp.x, y = cp.y;
      // Post
      ctx.fillStyle = '#7a4e2d';
      ctx.fillRect(x + 10, y + 6, 4, 26);
      // Banner / Sign
      const spinAngle = Math.sin(cp.spin * 10) * 0.4;
      ctx.save();
      ctx.translate(x + 12, y + 10);
      ctx.rotate(spinAngle);
      ctx.fillStyle = cp.active ? '#22c55e' : '#94a3b8';
      ctx.fillRect(0, -6, 14, 12);
      ctx.fillStyle = cp.active ? '#86efac' : '#cbd5e1';
      ctx.fillRect(2, -4, 10, 8);
      // Glowing orb on top
      ctx.fillStyle = cp.active ? '#4ade80' : '#64748b';
      ctx.beginPath();
      ctx.arc(0, -7, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  drawChests(ctx, g) {
    for (const ch of g.chests) {
      const x = ch.x, y = ch.y;
      if (!ch.opened) {
        const glowCv = getCachedGlow('rgba(250, 204, 21, 0.35)', 20);
        if (glowCv) ctx.drawImage(glowCv, x + ch.w / 2 - 20, y + ch.h / 2 - 20);
      }
      ctx.fillStyle = '#854d0e';
      ctx.fillRect(x, y + 6, ch.w, ch.h - 6);
      // Gold bands
      ctx.fillStyle = '#facc15';
      ctx.fillRect(x + 4, y + 6, 3, ch.h - 6);
      ctx.fillRect(x + ch.w - 7, y + 6, 3, ch.h - 6);
      // Lid
      if (ch.opened) {
        ctx.fillStyle = '#a16207';
        ctx.fillRect(x, y - 4, ch.w, 8);
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(x + 3, y + 4, ch.w - 6, 3);
      } else {
        ctx.fillStyle = '#a16207';
        ctx.fillRect(x, y, ch.w, 7);
        // Keyhole
        ctx.fillStyle = '#facc15';
        ctx.fillRect(x + ch.w / 2 - 2, y + 8, 4, 5);
      }
    }
  }

  drawSpikes(ctx, g) {
    for (const sp of g.spikes) {
      const x = sp.x, y = sp.y;
      ctx.fillStyle = '#94a3b8';
      for (let i = 0; i < 4; i++) {
        const sx = x + i * 8;
        ctx.beginPath();
        ctx.moveTo(sx, y + sp.h);
        ctx.lineTo(sx + 4, y);
        ctx.lineTo(sx + 8, y + sp.h);
        ctx.fill();
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(sx + 3, y + 3, 2, sp.h - 3);
        ctx.fillStyle = '#94a3b8';
      }
    }
  }

  drawCoin(ctx, c) {
    const bob = c.pop ? 0 : Math.sin(c.phase) * 2;
    const sx = Math.abs(Math.cos(c.phase * 0.9)) * 0.7 + 0.3;
    const cx = c.x + c.w / 2, cy = c.y + c.h / 2 + bob;
    const glowCv = getCachedGlow('rgba(250, 204, 21, 0.45)', 14);
    if (glowCv) ctx.drawImage(glowCv, cx - 14, cy - 14);
    ctx.fillStyle = '#b45309';
    ctx.beginPath(); ctx.ellipse(cx, cy, 7.5 * sx, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#facc15';
    ctx.beginPath(); ctx.ellipse(cx, cy, 6.5 * sx, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(cx - 1.2 * sx, cy - 3.5, 2.4 * sx, 7);
    // Specular shine sweep line
    const sweep = Math.sin(c.phase * 2) * 4;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.fillRect(cx - 2 * sx + sweep * 0.4, cy - 4, 1.5 * sx, 8);
  }

  drawGem(ctx, g) {
    const bob = Math.sin(g.phase) * 2.5;
    const cx = g.x + g.w / 2, cy = g.y + g.h / 2 + bob;
    ctx.save();
    ctx.translate(cx, cy);
    // Diamond shape
    ctx.fillStyle = '#9333ea';
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(7, 0);
    ctx.lineTo(0, 8);
    ctx.lineTo(-7, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#c084fc';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(5, 0);
    ctx.lineTo(0, 6);
    ctx.lineTo(-5, 0);
    ctx.fill();
    ctx.fillStyle = '#f3e8ff';
    ctx.fillRect(-1.5, -4, 3, 3);
    ctx.restore();
  }

  drawStar(ctx, s) {
    const bob = Math.sin(s.phase) * 3;
    const cx = s.x + s.w / 2, cy = s.y + s.h / 2 + bob;
    ctx.save();
    ctx.translate(cx, cy);
    const glowCv = getCachedGlow('rgba(251, 191, 36, 0.75)', 20);
    if (glowCv) ctx.drawImage(glowCv, -20, -20);

    // 4-point rotating sparkle rays
    const rot = this.t * 1.5;
    ctx.save();
    ctx.rotate(rot);
    ctx.fillStyle = 'rgba(254, 240, 138, 0.55)';
    ctx.fillRect(-1.5, -16, 3, 32);
    ctx.fillRect(-16, -1.5, 32, 3);
    ctx.restore();

    // 5-point star
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
      const r = 9.5;
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
      const r = 7.5;
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawHeart(ctx, h) {
    const bob = Math.sin(h.phase) * 2;
    const cx = h.x + h.w / 2, cy = h.y + h.h / 2 + bob;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(0, 3);
    ctx.bezierCurveTo(-5, -4, -9, 1, 0, 8);
    ctx.bezierCurveTo(9, 1, 5, -4, 0, 3);
    ctx.fill();
    ctx.restore();
  }

  drawKey(ctx, k) {
    const cx = k.x + k.w / 2, cy = k.y + k.h / 2;
    const glowCv = getCachedGlow('rgba(255, 224, 102, 0.6)', 26);
    if (glowCv) ctx.drawImage(glowCv, cx - 26, cy - 26);
    ctx.fillStyle = '#ffd84a';
    ctx.strokeStyle = '#8a5a00';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy - 6, 5.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#33435f';
    ctx.beginPath(); ctx.arc(cx, cy - 6, 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd84a';
    ctx.fillRect(cx - 1.8, cy - 1, 3.6, 13);
    ctx.fillRect(cx + 1.8, cy + 5, 4, 2.5);
    ctx.fillRect(cx + 1.8, cy + 9, 3, 2.5);
    ctx.strokeRect(cx - 1.8, cy - 1, 3.6, 13);
  }

  drawGate(ctx, gt) {
    if (!gt) return;
    const x = gt.x, y = gt.y, w = gt.w, h = gt.h;
    // Rocky mound
    ctx.fillStyle = '#6b6258';
    ctx.beginPath();
    ctx.moveTo(x - 14, y + h); ctx.lineTo(x - 6, y + 26); ctx.lineTo(x + 16, y + 4);
    ctx.lineTo(x + w / 2, y - 12); ctx.lineTo(x + w - 14, y + 6); ctx.lineTo(x + w + 6, y + 28);
    ctx.lineTo(x + w + 14, y + h); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#857a6d';
    ctx.beginPath();
    ctx.moveTo(x + 10, y + 18); ctx.lineTo(x + w / 2, y - 10); ctx.lineTo(x + w / 2 + 6, y + 12); ctx.lineTo(x + 18, y + 34);
    ctx.fill();
    ctx.fillStyle = '#4fb83a';
    ctx.beginPath(); ctx.ellipse(x + w / 2, y - 10, 16, 5, 0, 0, Math.PI * 2); ctx.fill();

    // Cave opening
    const ox = x + 10, oy = y + 30, ow = w - 20, oh = h - 30;
    ctx.fillStyle = gt.state === 'closed' ? '#14110f' : '#ffe9a0';
    ctx.beginPath();
    ctx.moveTo(ox, oy + oh); ctx.lineTo(ox, oy + 12);
    ctx.quadraticCurveTo(ox + ow / 2, oy - 8, ox + ow, oy + 12);
    ctx.lineTo(ox + ow, oy + oh);
    ctx.fill();

    // Portcullis
    ctx.save();
    ctx.beginPath(); ctx.rect(ox, oy - 4, ow, oh + 4); ctx.clip();
    const lift = gt.lift * (oh + 6);
    ctx.fillStyle = '#9a6a35';
    for (let i = 0; i < 5; i++) ctx.fillRect(ox + 3 + i * (ow - 8) / 4, oy - lift, 3, oh + 4);
    for (let j = 0; j < 4; j++) ctx.fillRect(ox, oy + 8 + j * 9 - lift, ow, 3);
    ctx.restore();

    // Red flag
    const fx = x + w / 2, fy = y - 12;
    ctx.fillStyle = '#5a3818'; ctx.fillRect(fx - 1, fy - 30, 2.5, 32);
    const wave = Math.sin(gt.t * (gt.state === 'closed' ? 3 : 8)) * 3;
    ctx.fillStyle = '#e63946';
    ctx.beginPath();
    ctx.moveTo(fx + 1.5, fy - 30);
    ctx.quadraticCurveTo(fx + 12, fy - 28 + wave, fx + 22, fy - 24 + wave * 0.5);
    ctx.quadraticCurveTo(fx + 12, fy - 20 - wave, fx + 1.5, fy - 18);
    ctx.fill();
  }

  drawMushroom(ctx, e) {
    const cx = e.x + e.w / 2, by = e.y + e.h;
    const bob = Math.abs(Math.sin(e.walkPhase)) * 2;
    ctx.save();
    ctx.translate(cx, by - bob);
    ctx.scale(e.dir < 0 ? 1 : -1, 1);
    ctx.fillStyle = e.flash > 0 ? '#fff' : '#f3e3c3';
    ctx.beginPath(); ctx.roundRect(-7, -14, 14, 14, 4); ctx.fill();
    ctx.fillStyle = '#6b4a2a';
    const f = Math.sin(e.walkPhase) * 3;
    ctx.fillRect(-8 + f, -3, 6, 3); ctx.fillRect(2 - f, -3, 6, 3);
    ctx.fillStyle = e.flash > 0 ? '#fff' : '#d83a3a';
    ctx.beginPath();
    ctx.moveTo(-14, -12);
    ctx.quadraticCurveTo(-14, -30, 0, -30);
    ctx.quadraticCurveTo(14, -30, 14, -12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-6, -22, 2.6, 0, Math.PI * 2); ctx.arc(5, -24, 2.2, 0, Math.PI * 2); ctx.arc(8, -17, 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2b1a14';
    ctx.fillRect(-5, -11, 3, 4); ctx.fillRect(2, -11, 3, 4);
    ctx.restore();
  }

  drawHedgehog(ctx, e) {
    const cx = e.x + e.w / 2, by = e.y + e.h;
    const bob = Math.abs(Math.sin(e.walkPhase)) * 1.5;
    ctx.save();
    ctx.translate(cx, by - bob);
    ctx.scale(e.dir < 0 ? 1 : -1, 1);

    // Body
    ctx.fillStyle = e.flash > 0 ? '#fff' : '#78350f';
    ctx.beginPath();
    ctx.roundRect(-12, -16, 24, 16, 6);
    ctx.fill();

    // Prominent sharp spikes on top
    ctx.fillStyle = '#451a03';
    for (let i = -10; i <= 10; i += 5) {
      ctx.beginPath();
      ctx.moveTo(i - 2, -16);
      ctx.lineTo(i, -24);
      ctx.lineTo(i + 2, -16);
      ctx.fill();
    }

    // Snout & face
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(-9, -8, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-11, -10, 2, 2); // eye
    ctx.fillRect(-13, -8, 2, 2);  // nose tip

    // Feet
    ctx.fillStyle = '#451a03';
    ctx.fillRect(-8, -3, 4, 3);
    ctx.fillRect(4, -3, 4, 3);
    ctx.restore();
  }

  drawBoss(ctx, b) {
    const cx = b.x + b.w / 2, by = b.y + b.h;
    ctx.save();
    ctx.translate(cx, by);
    ctx.scale(b.dir > 0 ? 1 : -1, b.squash);

    // Stalk / Body
    ctx.fillStyle = b.flash > 0 ? '#fff' : (b.state === 'telegraph' ? '#fed7aa' : '#fde68a');
    ctx.beginPath();
    ctx.roundRect(-18, -30, 36, 30, 8);
    ctx.fill();

    // Giant cap
    ctx.fillStyle = b.flash > 0 ? '#fff' : (b.state === 'telegraph' ? '#ea580c' : '#dc2626');
    ctx.beginPath();
    ctx.moveTo(-32, -26);
    ctx.quadraticCurveTo(-34, -62, 0, -62);
    ctx.quadraticCurveTo(34, -62, 32, -26);
    ctx.closePath();
    ctx.fill();

    // Cap spots
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-14, -46, 5, 0, Math.PI * 2);
    ctx.arc(12, -50, 4.5, 0, Math.PI * 2);
    ctx.arc(18, -38, 3.5, 0, Math.PI * 2);
    ctx.arc(-2, -34, 4, 0, Math.PI * 2);
    ctx.fill();

    // Golden Crown
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.moveTo(-16, -60);
    ctx.lineTo(-12, -74);
    ctx.lineTo(-6, -64);
    ctx.lineTo(0, -78);
    ctx.lineTo(6, -64);
    ctx.lineTo(12, -74);
    ctx.lineTo(16, -60);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#d97706';
    ctx.fillRect(-14, -60, 28, 3);

    // Eyes
    ctx.fillStyle = '#1c1917';
    ctx.fillRect(-10, -22, 5, 7);
    ctx.fillRect(5, -22, 5, 7);
    ctx.restore();
  }

  drawSpring(ctx, s) {
    ctx.save();
    ctx.translate(s.x + s.w / 2, s.y + s.h);
    ctx.scale(1, s.squash);
    // Stem
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(-6, -10, 12, 10);
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(-6, -6, 12, 2);
    // Cap
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(0, -10, 13, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#6ee7b7';
    ctx.beginPath();
    ctx.arc(-5, -13, 2.5, 0, Math.PI * 2);
    ctx.arc(4, -14, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawMovingPlank(ctx, mp) {
    ctx.save();
    ctx.translate(mp.x, mp.y);
    // Plank body
    ctx.fillStyle = '#78350f';
    ctx.fillRect(0, 0, mp.w, mp.h);
    ctx.fillStyle = '#92400e';
    ctx.fillRect(2, 2, mp.w - 4, mp.h - 4);
    // Top cap
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(0, 0, mp.w, 3);
    // End brackets
    ctx.fillStyle = '#475569';
    ctx.fillRect(0, 0, 4, mp.h);
    ctx.fillRect(mp.w - 4, 0, 4, mp.h);
    ctx.restore();
  }

  drawCraneLift(ctx, cl) {
    ctx.save();
    ctx.translate(cl.x, cl.y);
    // Chains rising up
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(4, 0); ctx.lineTo(4, -300);
    ctx.moveTo(cl.w - 4, 0); ctx.lineTo(cl.w - 4, -300);
    ctx.stroke();
    // Platform
    ctx.fillStyle = '#451a03';
    ctx.fillRect(0, 0, cl.w, cl.h);
    ctx.fillStyle = '#78350f';
    ctx.fillRect(2, 2, cl.w - 4, cl.h - 4);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(0, 0, cl.w, 3);
    ctx.restore();
  }

  drawCrumblingPlank(ctx, cp) {
    if (!cp.active) return;
    ctx.save();
    ctx.translate(cp.x + cp.shake, cp.y);
    ctx.fillStyle = '#d97706';
    ctx.fillRect(0, 0, cp.w, cp.h);
    ctx.fillStyle = '#b45309';
    ctx.fillRect(1, 1, cp.w - 2, cp.h - 2);
    if (cp.stepped) {
      // Crack lines
      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(8, 0); ctx.lineTo(12, 6); ctx.lineTo(16, 2); ctx.lineTo(22, 10);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawProjectile(ctx, pr) {
    if (pr.dead) return;
    ctx.save();
    ctx.translate(pr.x, pr.y);
    if (pr.type === 'acorn') {
      ctx.fillStyle = '#92400e';
      ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#451a03';
      ctx.fillRect(-6, -6, 12, 4);
    } else {
      ctx.fillStyle = '#eab308';
      ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#15803d';
      ctx.fillRect(-2, -6, 4, 4);
    }
    ctx.restore();
  }

  drawSquirrel(ctx, e) {
    const cx = e.x + e.w / 2, by = e.y + e.h;
    ctx.save();
    ctx.translate(cx, by);
    ctx.scale(e.dir < 0 ? 1 : -1, 1);
    // Tail
    ctx.fillStyle = '#ea580c';
    ctx.beginPath();
    ctx.arc(10, -14, 10, 0, Math.PI * 2);
    ctx.fill();
    // Body
    ctx.fillStyle = e.flash > 0 ? '#fff' : '#c2410c';
    ctx.beginPath();
    ctx.roundRect(-8, -18, 16, 18, 5);
    ctx.fill();
    // Belly
    ctx.fillStyle = '#fed7aa';
    ctx.beginPath();
    ctx.arc(-2, -8, 6, 0, Math.PI * 2);
    ctx.fill();
    // Head & Ear
    ctx.fillStyle = '#c2410c';
    ctx.beginPath();
    ctx.arc(-4, -18, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-4, -25, 3, 5); // ear
    // Eye
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-7, -20, 2, 3);
    ctx.restore();
  }

  drawSnapvine(ctx, e) {
    const cx = e.x + e.w / 2, by = e.y + e.h;
    ctx.save();
    ctx.translate(cx, by);
    // Stem
    ctx.strokeStyle = '#15803d';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.quadraticCurveTo(-6, -10, 0, -20);
    ctx.stroke();
    // Head / Mouth
    ctx.fillStyle = e.flash > 0 ? '#facc15' : (e.state === 'telegraph' ? '#f59e0b' : '#166534');
    ctx.beginPath();
    ctx.arc(0, -20, 10, 0, Math.PI * 2);
    ctx.fill();
    // Teeth
    ctx.fillStyle = '#fff';
    ctx.fillRect(-6, -22, 3, 4);
    ctx.fillRect(2, -22, 3, 4);
    ctx.restore();
  }

  drawScorpion(ctx, e) {
    const cx = e.x + e.w / 2, by = e.y + e.h;
    ctx.save();
    ctx.translate(cx, by);
    ctx.scale(e.dir < 0 ? 1 : -1, 1);
    // Body
    ctx.fillStyle = e.flash > 0 ? '#fff' : '#b45309';
    ctx.beginPath();
    ctx.roundRect(-12, -12, 22, 12, 4);
    ctx.fill();
    // Tail with curved stinger
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(8, -8);
    ctx.quadraticCurveTo(16, -20, 6, -22);
    ctx.stroke();
    // Red stinger tip
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.arc(4, -22, 3, 0, Math.PI * 2);
    ctx.fill();
    // Pincers
    ctx.fillStyle = '#92400e';
    ctx.fillRect(-15, -8, 5, 4);
    // Eye
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-10, -10, 2, 2);
    ctx.restore();
  }

  drawSandWorm(ctx, e) {
    if (e.dead) return;
    const cx = e.x + e.w / 2;
    ctx.save();
    if (e.state === 'underground' || e.state === 'ripples') {
      // Sand ripple mound
      ctx.fillStyle = '#d97706';
      ctx.beginPath();
      ctx.ellipse(cx, e.baseY, 14, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.translate(cx, e.y);
      ctx.fillStyle = e.flash > 0 ? '#fff' : '#ea580c';
      // Segmented worm body
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(0, i * 7, 10 - i, 0, Math.PI * 2);
        ctx.fill();
      }
      // Teeth / Mandibles
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(-6, -4, 3, 4);
      ctx.fillRect(3, -4, 3, 4);
    }
    ctx.restore();
  }

  drawOldOak(ctx, b) {
    const cx = b.x + b.w / 2, by = b.y + b.h;
    ctx.save();
    ctx.translate(cx, by);
    ctx.scale(b.dir > 0 ? 1 : -1, 1);
    // Tree trunk body
    ctx.fillStyle = b.flash > 0 ? '#fff' : '#451a03';
    ctx.beginPath();
    ctx.roundRect(-26, -70, 52, 70, 10);
    ctx.fill();
    // Branch arms
    ctx.fillStyle = '#78350f';
    ctx.fillRect(-34, -55, 14, 8);
    ctx.fillRect(20, -55, 14, 8);
    // Foliage top
    ctx.fillStyle = '#ea580c';
    ctx.beginPath();
    ctx.arc(0, -74, 22, 0, Math.PI * 2);
    ctx.arc(-16, -65, 14, 0, Math.PI * 2);
    ctx.arc(16, -65, 14, 0, Math.PI * 2);
    ctx.fill();
    // Hollow core in trunk (weak spot)
    ctx.fillStyle = b.vulnerable ? '#facc15' : '#1c1917';
    ctx.beginPath();
    ctx.ellipse(0, -32, 10, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    if (b.vulnerable) {
      // Glowing core aura
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
    // Eyes
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(-12, -48, 5, 5);
    ctx.fillRect(7, -48, 5, 5);
    ctx.restore();
  }

  drawSandWyrm(ctx, b) {
    const cx = b.x + b.w / 2, by = b.y + b.h;
    ctx.save();
    ctx.translate(cx, by);
    // Giant worm head
    ctx.fillStyle = b.flash > 0 ? '#fff' : (b.state === 'telegraph' ? '#f59e0b' : '#b45309');
    ctx.beginPath();
    ctx.roundRect(-24, -56, 48, 56, 12);
    ctx.fill();
    // Armor plates
    ctx.fillStyle = '#78350f';
    ctx.fillRect(-20, -45, 40, 5);
    ctx.fillRect(-18, -30, 36, 5);
    // Horns
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.moveTo(-18, -54); ctx.lineTo(-24, -68); ctx.lineTo(-12, -54);
    ctx.moveTo(18, -54); ctx.lineTo(24, -68); ctx.lineTo(12, -54);
    ctx.fill();
    // Eyes
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(-12, -38, 6, 6);
    ctx.fillRect(6, -38, 6, 6);
    ctx.restore();
  }

  drawBoss(ctx, b) {
    if (b.type === 'oak_guardian') {
      this.drawOldOak(ctx, b);
      return;
    }
    if (b.type === 'sand_wyrm') {
      this.drawSandWyrm(ctx, b);
      return;
    }
    const cx = b.x + b.w / 2, by = b.y + b.h;
    ctx.save();
    ctx.translate(cx, by);
    ctx.scale(b.dir > 0 ? 1 : -1, b.squash);

    // Stalk / Body
    ctx.fillStyle = b.flash > 0 ? '#fff' : (b.state === 'telegraph' ? '#fed7aa' : '#fde68a');
    ctx.beginPath();
    ctx.roundRect(-18, -30, 36, 30, 8);
    ctx.fill();

    // Giant cap
    ctx.fillStyle = b.flash > 0 ? '#fff' : (b.state === 'telegraph' ? '#ea580c' : '#dc2626');
    ctx.beginPath();
    ctx.moveTo(-32, -26);
    ctx.quadraticCurveTo(-34, -62, 0, -62);
    ctx.quadraticCurveTo(34, -62, 32, -26);
    ctx.closePath();
    ctx.fill();

    // Cap spots
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-14, -46, 5, 0, Math.PI * 2);
    ctx.arc(12, -50, 4.5, 0, Math.PI * 2);
    ctx.arc(18, -38, 3.5, 0, Math.PI * 2);
    ctx.arc(-2, -34, 4, 0, Math.PI * 2);
    ctx.fill();

    // Golden Crown
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.moveTo(-16, -60);
    ctx.lineTo(-12, -74);
    ctx.lineTo(-6, -64);
    ctx.lineTo(0, -78);
    ctx.lineTo(6, -64);
    ctx.lineTo(12, -74);
    ctx.lineTo(16, -60);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#d97706';
    ctx.fillRect(-14, -60, 28, 3);

    // Eyes
    ctx.fillStyle = '#1c1917';
    ctx.fillRect(-10, -22, 5, 7);
    ctx.fillRect(5, -22, 5, 7);
    ctx.restore();
  }

  drawBossHealthBar(ctx, boss) {
    const bw = 240, bh = 14;
    const bx = (VIEW_W - bw) / 2, by = 48;
    ctx.save();
    // Name (show boss name only)
    ctx.font = '700 13px Fredoka, sans-serif';
    ctx.fillStyle = '#fed7aa';
    ctx.textAlign = 'center';
    ctx.fillText(boss.name.toUpperCase(), VIEW_W / 2, by - 6);

    // Background bar
    ctx.fillStyle = '#1c1917';
    ctx.strokeStyle = boss.hp === 1 ? '#ef4444' : '#78350f';
    ctx.lineWidth = 2.5;
    if (boss.hp === 1) {
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 8 + Math.sin(this.t * 10) * 4;
    }
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 6);
    ctx.fill();
    ctx.stroke();

    // Health Fill
    const pct = Math.max(0, boss.hp / boss.maxHp);
    ctx.fillStyle = boss.hp > 1 ? '#ef4444' : '#dc2626';
    ctx.beginPath();
    ctx.roundRect(bx + 2, by + 2, (bw - 4) * pct, bh - 4, 4);
    ctx.fill();

    // Phase notches
    if (boss.maxHp > 1) {
      for (let i = 1; i < boss.maxHp; i++) {
        const nx = bx + (bw * (i / boss.maxHp));
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(nx - 1.5, by + 1, 3, bh - 2);
      }
    }
    ctx.restore();
  }

  drawHero(ctx, p) {
    if (p.invuln > 0 && Math.floor(this.t * 16) % 2 === 0 && p.hurtT <= 0) return;
    const cx = p.cx, feet = p.y + p.h + p.visDy;
    ctx.save();
    ctx.translate(cx, feet);
    const gs = p.giantScale || 1;
    const heroScale = 1.15; // 15% larger hero for cartoon feel
    ctx.scale(heroScale * p.sx * gs, heroScale * p.sy * gs);
    ctx.scale(p.face, 1);

    // Power-up active glow outline
    if (p.powerup) {
      const pt = p.powerup.type;
      if (pt === 'star_power') {
        ctx.shadowColor = `hsl(${(this.t * 360) % 360}, 100%, 65%)`;
        ctx.shadowBlur = 14;
      } else if (pt === 'fire_knife') {
        ctx.shadowColor = '#f97316'; ctx.shadowBlur = 10;
      } else if (pt === 'ice_knife') {
        ctx.shadowColor = '#38bdf8'; ctx.shadowBlur = 10;
      } else if (pt === 'speed_boots') {
        ctx.shadowColor = '#facc15'; ctx.shadowBlur = 8;
      } else if (pt === 'bubble_shield') {
        ctx.shadowColor = '#60a5fa'; ctx.shadowBlur = 10;
      } else if (pt === 'giant_rook') {
        ctx.shadowColor = '#a855f7'; ctx.shadowBlur = 14;
      } else if (pt === 'blaster') {
        ctx.shadowColor = '#22d3ee'; ctx.shadowBlur = 8;
      }
    }

    const run = p.grounded ? Math.sin(p.runPhase) : 0;
    const climbing = p.climbing;
    const legSwing = climbing ? Math.sin(p.climbPhase) * 5 : run * 6;
    const idleBob = (p.grounded && Math.abs(p.vx) < 5) ? Math.sin(this.t * 4) * 0.6 : 0;

    // Scarf trail with physics
    const trail = climbing ? 0 : Math.max(-28, Math.min(28, -p.vx * 0.14));
    const lift = p.grounded ? 0 : Math.max(-12, Math.min(14, p.vy * 0.025));
    ctx.strokeStyle = '#0d9488';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-1, -29 + idleBob);
    ctx.quadraticCurveTo(-10 + trail * 0.5 * p.face, -26 + lift + idleBob, -15 + trail * p.face, -23 + lift + Math.sin(this.t * 14) * 2.5);
    ctx.stroke();

    // Legs
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-6 + legSwing * 0.5, -10, 5, 10);
    ctx.fillRect(1 - legSwing * 0.5, -10, 5, 10);
    ctx.fillStyle = '#451a03';
    ctx.fillRect(-7 + legSwing * 0.5, -3, 7, 3);
    ctx.fillRect(0 - legSwing * 0.5, -3, 7, 3);

    // Satchel
    ctx.fillStyle = '#92400e';
    ctx.fillRect(-11, -22 + idleBob, 6, 9);

    // Speed boots tiny wing
    if (p.powerup?.type === 'speed_boots') {
      ctx.save();
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.moveTo(-7, -4);
      ctx.lineTo(-14, -10);
      ctx.lineTo(-8, -8);
      ctx.fill();
      ctx.restore();
    }

    // Body with shading
    ctx.fillStyle = '#fef3c7';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.roundRect(-8, -26 + idleBob, 16, 17, 5);
    ctx.fill();
    ctx.stroke();
    // Shading on clothing
    ctx.fillStyle = '#dcd0a8';
    ctx.fillRect(-8, -21 + idleBob, 6, 11);

    // Scarf neck band
    ctx.fillStyle = '#0d9488';
    ctx.fillRect(-8, -29 + idleBob, 16, 5);

    // Head
    ctx.fillStyle = '#fed7aa';
    ctx.beginPath();
    ctx.arc(0, -33 + idleBob, 8.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Hair
    ctx.fillStyle = '#451a03';
    ctx.beginPath();
    ctx.arc(0, -35 + idleBob, 8.8, Math.PI * 1.02, Math.PI * 1.98);
    ctx.fill();
    ctx.fillRect(-9, -36 + idleBob, 4, 6);

    // Eye & blink
    if (p.blinkT > 0 || p.blinkT < -0.1) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(3, -35 + idleBob, 2.6, 4);
    } else {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(2.5, -33 + idleBob, 3.5, 1);
    }

    // Knife slash
    if (p.slashT > 0) {
      const a = 1 - p.slashT / 0.14;
      ctx.restore();
      ctx.save();
      ctx.translate(p.cx, p.y + p.h * 0.5);
      if (p.powerup?.type === 'fire_knife') {
        ctx.strokeStyle = `rgba(249, 115, 22, ${0.95 - a * 0.7})`;
        ctx.lineWidth = 6;
      } else if (p.powerup?.type === 'ice_knife') {
        ctx.strokeStyle = `rgba(56, 189, 248, ${0.95 - a * 0.7})`;
        ctx.lineWidth = 5;
      } else {
        ctx.strokeStyle = `rgba(255,255,255,${0.9 - a * 0.7})`;
        ctx.lineWidth = 4;
      }
      ctx.lineCap = 'round';
      ctx.beginPath();
      if (p.slashDown) ctx.arc(0, 4, 20, Math.PI * 0.15, Math.PI * 0.85);
      else if (p.face > 0) ctx.arc(-4, 0, 26, -0.9 + a * 0.5, 0.9 - a * 0.1);
      else ctx.arc(4, 0, 26, Math.PI - 0.9 + a * 0.1, Math.PI + 0.9 - a * 0.5);
      ctx.stroke();
      ctx.restore();
    }

    // Bubble Shield
    if (p.powerup?.type === 'bubble_shield') {
      ctx.save();
      ctx.fillStyle = 'rgba(96, 165, 250, 0.25)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, -19, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.beginPath();
      ctx.arc(-8, -26, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  drawParticles(ctx, g) {
    const minX = g.cam ? g.cam.x - 30 : -30;
    const maxX = g.cam ? g.cam.x + VIEW_W + 30 : VIEW_W + 30;
    const minY = g.cam ? g.cam.y - 30 : -30;
    const maxY = g.cam ? g.cam.y + VIEW_H + 30 : VIEW_H + 30;
    for (const q of g.particles) {
      if (q.x < minX || q.x > maxX || q.y < minY || q.y > maxY) continue;
      ctx.globalAlpha = Math.max(0, Math.min(1, q.life * 2));
      ctx.fillStyle = q.color;
      ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
    }
    ctx.globalAlpha = 1;
    ctx.font = '700 14px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    for (const t of g.texts) {
      ctx.globalAlpha = Math.max(0, Math.min(1, t.life * 2.5));
      ctx.fillStyle = '#26324a'; ctx.fillText(t.text, t.x + 1, t.y + 1);
      ctx.fillStyle = t.small ? '#ffe27a' : '#fff'; ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  drawHints(ctx, g) {
    if (!g.level.hints || !g.level.hints.length) return;
    const p = g.player;
    let nearest = null;
    let minDist = Infinity;
    for (const h of g.level.hints) {
      const d = Math.hypot(p.cx - h.x, p.cy - h.y);
      if (d < minDist) {
        minDist = d;
        nearest = h;
      }
    }
    if (!nearest || minDist > 140) return;

    const a = Math.min(1, Math.max(0, (140 - minDist) / 45));
    ctx.font = '600 13px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    const textWidth = ctx.measureText(nearest.text).width;
    const w = textWidth + 24;
    const h = 28;
    const halfW = w / 2;

    // Nearest hint screen position
    const camX = g.cam.x, camY = g.cam.y;
    const rawScreenX = nearest.x - camX;
    const rawScreenY = (nearest.y - 74) - camY;

    // Clamp bubble within view with 16 px margin
    const margin = 16;
    const clampedScreenX = Math.max(margin + halfW, Math.min(VIEW_W - margin - halfW, rawScreenX));
    const clampedScreenY = Math.max(margin, Math.min(VIEW_H - margin - h, rawScreenY));

    // Convert back to world coordinates since ctx is translated by -camX, -camY
    const drawX = clampedScreenX + camX;
    const drawY = clampedScreenY + camY;

    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = '#fff6dc';
    ctx.strokeStyle = '#8a5a2b';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
    ctx.beginPath();
    ctx.roundRect(drawX - halfW, drawY, w, h, 10);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.stroke();

    ctx.fillStyle = '#4a2f22';
    ctx.fillText(nearest.text, drawX, drawY + 18);
    ctx.restore();
  }

  drawGateArrow(ctx, g, camX, camY) {
    if (!g.player.hasKey || !g.gate) return;
    const gx = g.gate.x + g.gate.w / 2 - camX, gy = g.gate.y + g.gate.h / 2 - camY;
    if (gx > 24 && gx < VIEW_W - 24 && gy > 24 && gy < VIEW_H - 24) return;
    const ang = Math.atan2(gy - VIEW_H / 2, gx - VIEW_W / 2);
    const ex = Math.max(34, Math.min(VIEW_W - 34, VIEW_W / 2 + Math.cos(ang) * 600));
    const ey = Math.max(70, Math.min(VIEW_H - 34, VIEW_H / 2 + Math.sin(ang) * 600));
    ctx.save();
    ctx.translate(ex, ey); ctx.rotate(ang);
    ctx.fillStyle = '#e63946'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-10, -12); ctx.lineTo(-4, 0); ctx.lineTo(-10, 12); ctx.closePath();
    ctx.stroke(); ctx.fill();
    ctx.restore();
  }

  drawAfterimages(ctx, g) {
    if (!g.afterimages || !g.afterimages.length) return;
    for (const a of g.afterimages) {
      const alpha = Math.max(0, a.life / a.maxLife) * 0.45;
      ctx.save();
      ctx.translate(a.x + a.w / 2, a.y + a.h);
      const gs = a.giantScale || 1;
      ctx.scale((a.sx || 1) * gs, (a.sy || 1) * gs);
      ctx.scale(a.face || 1, 1);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.roundRect(-8, -26, 16, 26, 6);
      ctx.arc(0, -33, 8.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  drawPowerOrbs(ctx, g) {
    if (!g.powerOrbs || !g.powerOrbs.length) return;
    for (const po of g.powerOrbs) {
      if (po.collected) continue;
      const cy = po.baseY + Math.sin(po.phase) * 5;
      const cx = po.x + po.w / 2;
      const def = POWERUP_DEFS[po.type] || POWERUP_DEFS.blaster;
      ctx.save();
      const glowCv = getCachedGlow(def.color, 22);
      if (glowCv) ctx.drawImage(glowCv, cx - 22, cy - 22);

      ctx.fillStyle = def.color;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.font = '14px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(def.icon, cx, cy + 1);
      ctx.restore();
    }
  }

  drawProjectiles(ctx, g) {
    if (!g.projectiles || !g.projectiles.length) return;
    for (const pr of g.projectiles) {
      if (pr.dead) continue;
      ctx.save();
      if (pr instanceof BlasterBolt) {
        ctx.fillStyle = '#38bdf8';
        ctx.shadowColor = '#0284c7';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.roundRect(pr.x, pr.y, pr.w, pr.h, 4);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(pr.x + (pr.dir > 0 ? 4 : 0), pr.y + 2, pr.w - 4, pr.h - 4, 2);
        ctx.fill();
      } else if (pr instanceof FlameWave) {
        const alpha = Math.max(0.2, 1 - Math.abs(pr.x - pr.startX) / pr.maxDist);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#f97316';
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(pr.x + pr.w / 2, pr.y + pr.h / 2, pr.w / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(pr.x + pr.w / 2, pr.y + pr.h / 2, pr.w / 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  drawIceBlocks(ctx, g) {
    if (!g.iceBlocks || !g.iceBlocks.length) return;
    for (const ib of g.iceBlocks) {
      if (ib.dead) continue;
      ctx.save();
      const shake = ib.timer < 1.2 ? (Math.random() - 0.5) * 3 : 0;
      ctx.fillStyle = 'rgba(186, 230, 253, 0.85)';
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(ib.x + shake, ib.y + shake, ib.w, ib.h, 6);
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(ib.x + 6 + shake, ib.y + 6 + shake);
      ctx.lineTo(ib.x + ib.w - 8 + shake, ib.y + 10 + shake);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawShockwave(ctx, g) {
    if (!g.shockwave) return;
    const sw = g.shockwave;
    const alpha = Math.max(0, sw.life / sw.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 6 * alpha;
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  drawTelegraphIndicator(ctx, e) {
    const cx = e.x + e.w / 2, cy = e.y - 12;
    ctx.save();
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', cx, cy);
    ctx.restore();
  }

  drawBuzzBee(ctx, e) {
    const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(e.dir > 0 ? 1 : -1, 1);

    // Flash / Body
    ctx.fillStyle = e.flash > 0 ? '#ffffff' : '#facc15';
    ctx.beginPath();
    ctx.ellipse(0, 0, 11, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Black stripes
    if (e.flash <= 0) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-3, -7, 3, 14);
      ctx.fillRect(3, -7, 3, 14);
    }

    // Wings flapping
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    const flap = Math.sin(e.wingPhase || 0) * 8;
    ctx.beginPath();
    ctx.ellipse(-2, -8 + flap * 0.3, 7, Math.max(2, Math.abs(flap)), -0.2, 0, Math.PI * 2);
    ctx.fill();

    // Stinger
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(-11, 0); ctx.lineTo(-14, -2); ctx.lineTo(-14, 2); ctx.closePath();
    ctx.fill();

    // Eye
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(6, -3, 3, 3);
    ctx.restore();
  }

  drawNightBat(ctx, e) {
    const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(e.dir > 0 ? 1 : -1, 1);

    if (e.state === 'roosting') {
      // Roosting upside down under ceiling
      ctx.fillStyle = e.flash > 0 ? '#ffffff' : '#334155';
      ctx.beginPath();
      ctx.roundRect(-7, -9, 14, 18, 4);
      ctx.fill();
      // Glowing eyes
      ctx.fillStyle = '#facc15';
      ctx.fillRect(-4, 2, 2, 2);
      ctx.fillRect(2, 2, 2, 2);
    } else {
      // Flying / swooping with spread scalloped wings
      ctx.fillStyle = e.flash > 0 ? '#ffffff' : '#1e1b4b';
      // Body
      ctx.beginPath();
      ctx.ellipse(0, 0, 6, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Scalloped wings
      ctx.fillStyle = e.flash > 0 ? '#ffffff' : '#312e81';
      const wingFlap = Math.sin(e.wingPhase || 0) * 6;
      ctx.beginPath();
      ctx.moveTo(-5, -2);
      ctx.quadraticCurveTo(-14, -10 + wingFlap, -18, -2 + wingFlap);
      ctx.quadraticCurveTo(-12, 4, -4, 2);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(5, -2);
      ctx.quadraticCurveTo(14, -10 + wingFlap, 18, -2 + wingFlap);
      ctx.quadraticCurveTo(12, 4, 4, 2);
      ctx.fill();

      // Glowing eyes
      ctx.fillStyle = e.telegraph > 0 ? '#ef4444' : '#facc15';
      ctx.fillRect(2, -3, 2, 2);
    }
    ctx.restore();
  }

  drawHopperFrog(ctx, e) {
    const cx = e.x + e.w / 2, by = e.y + e.h;
    ctx.save();
    ctx.translate(cx, by);
    ctx.scale(e.dir > 0 ? 1 : -1, 1);

    const squish = e.state === 'squat' ? 0.7 : e.state === 'jump' ? 1.2 : 1.0;
    // Body
    ctx.fillStyle = e.flash > 0 ? '#ffffff' : '#16a34a';
    ctx.beginPath();
    ctx.ellipse(0, -10 * squish, 12, 9 * squish, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cream belly
    if (e.flash <= 0) {
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.ellipse(2, -8 * squish, 7, 5 * squish, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Folded hind legs
    ctx.fillStyle = e.flash > 0 ? '#ffffff' : '#15803d';
    ctx.beginPath();
    ctx.arc(-8, -5, 5, 0, Math.PI * 2);
    ctx.fill();

    // Eyes on top of head
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(4, -16 * squish, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(5, -17 * squish, 2, 3);

    ctx.restore();
  }

  drawWildBoar(ctx, e) {
    const cx = e.x + e.w / 2, by = e.y + e.h;
    ctx.save();
    ctx.translate(cx, by);
    ctx.scale(e.dir > 0 ? 1 : -1, 1);

    // Stunned wobbling
    if (e.state === 'stunned') {
      ctx.rotate(Math.sin(Date.now() * 0.02) * 0.08);
    }

    // Stout brown body
    ctx.fillStyle = e.flash > 0 ? '#ffffff' : '#78350f';
    ctx.beginPath();
    ctx.roundRect(-16, -22, 32, 20, 6);
    ctx.fill();

    // Dark bristly spine mane
    if (e.flash <= 0) {
      ctx.fillStyle = '#451a03';
      ctx.fillRect(-12, -26, 20, 5);
    }

    // Snout
    ctx.fillStyle = '#92400e';
    ctx.fillRect(10, -16, 7, 10);

    // White ivory tusks
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(13, -10); ctx.lineTo(17, -18); ctx.lineTo(15, -10);
    ctx.fill();

    // Glowing eyes (red during charge or scrape telegraph)
    ctx.fillStyle = (e.state === 'charge' || e.state === 'telegraph') ? '#ef4444' : '#0f172a';
    ctx.fillRect(7, -18, 3, 3);

    // Dizzy stars circling above head while stunned
    if (e.state === 'stunned') {
      const t = Date.now() * 0.005;
      ctx.fillStyle = '#facc15';
      ctx.fillText('★', Math.cos(t) * 12, -32 + Math.sin(t) * 4);
      ctx.fillText('★', Math.cos(t + Math.PI) * 12, -32 + Math.sin(t + Math.PI) * 4);
    }

    ctx.restore();
  }

  drawLeafGlider(ctx, e) {
    const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.sin(e.swayPhase || 0) * 0.25);

    // Autumn maple leaf body
    ctx.fillStyle = e.flash > 0 ? '#ffffff' : '#f97316';
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.quadraticCurveTo(14, -6, 12, 4);
    ctx.quadraticCurveTo(4, 10, 0, 10);
    ctx.quadraticCurveTo(-4, 10, -12, 4);
    ctx.quadraticCurveTo(-14, -6, 0, -10);
    ctx.fill();

    // Leaf veins
    if (e.flash <= 0) {
      ctx.strokeStyle = '#c2410c';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -8); ctx.lineTo(0, 8);
      ctx.moveTo(0, -2); ctx.lineTo(8, 2);
      ctx.moveTo(0, -2); ctx.lineTo(-8, 2);
      ctx.stroke();
    }

    // Little moth antennae
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -8); ctx.lineTo(4, -13);
    ctx.moveTo(0, -8); ctx.lineTo(-4, -13);
    ctx.stroke();

    ctx.restore();
  }

  drawRollingArmadillo(ctx, e) {
    const cx = e.x + e.w / 2, by = e.y + e.h;
    ctx.save();
    ctx.translate(cx, by);

    if (e.state === 'roll') {
      // Spinning armored ball
      ctx.translate(0, -11);
      ctx.rotate(e.rollAngle || 0);
      ctx.fillStyle = e.flash > 0 ? '#ffffff' : '#ea580c';
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();

      // Interlocking armored plates
      ctx.strokeStyle = '#7c2d12';
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2;
        ctx.beginPath();
        ctx.arc(0, 0, 10, a, a + 0.9);
        ctx.stroke();
      }
    } else {
      ctx.scale(e.dir > 0 ? 1 : -1, 1);
      // Banded terracotta shell
      ctx.fillStyle = e.flash > 0 ? '#ffffff' : '#c2410c';
      ctx.beginPath();
      ctx.roundRect(-13, -18, 24, 16, 5);
      ctx.fill();

      // Band lines
      if (e.flash <= 0) {
        ctx.strokeStyle = '#7c2d12';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-4, -18); ctx.lineTo(-4, -4);
        ctx.moveTo(3, -18); ctx.lineTo(3, -4);
        ctx.stroke();
      }

      // Pointed snout & eye
      ctx.fillStyle = '#ea580c';
      ctx.fillRect(8, -12, 6, 6);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(8, -14, 2, 2);
    }

    ctx.restore();
  }

  drawDesertHawk(ctx, e) {
    const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    ctx.save();

    // Projected ground shadow during dive telegraph
    if (e.state === 'lock' || e.state === 'dive') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.ellipse(e.targetX, e.targetY + 8, 14, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.translate(cx, cy);
    ctx.scale(e.dir > 0 ? 1 : -1, 1);

    // Golden-brown desert raptor with spread wings
    ctx.fillStyle = e.flash > 0 ? '#ffffff' : '#b45309';
    // Body
    ctx.beginPath();
    ctx.ellipse(0, 0, 6, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Spread wings
    const flap = Math.sin(e.wingPhase || 0) * 8;
    ctx.beginPath();
    ctx.moveTo(-4, -3);
    ctx.quadraticCurveTo(-12, -14 + flap, -20, -4 + flap);
    ctx.quadraticCurveTo(-14, 2, -4, 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(4, -3);
    ctx.quadraticCurveTo(12, -14 + flap, 20, -4 + flap);
    ctx.quadraticCurveTo(14, 2, 4, 2);
    ctx.fill();

    // White breast feathers
    if (e.flash <= 0) {
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(-2, -4, 4, 7);
    }

    // Hooked yellow beak
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.moveTo(5, -4); ctx.lineTo(10, -2); ctx.lineTo(5, 0); ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  drawSpinningSaw(ctx, e) {
    ctx.save();
    // 1. Draw brass mounting rail track between p0 and p1
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(e.p0.x, e.p0.y);
    ctx.lineTo(e.p1.x, e.p1.y);
    ctx.stroke();

    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(e.p0.x, e.p0.y);
    ctx.lineTo(e.p1.x, e.p1.y);
    ctx.stroke();

    // 2. Draw spinning circular saw blade
    const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    ctx.translate(cx, cy);
    ctx.rotate(e.spinAngle || 0);

    // Steel disc
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();

    // Sharp serrated teeth (8 teeth)
    ctx.fillStyle = '#cbd5e1';
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 9, Math.sin(a) * 9);
      ctx.lineTo(Math.cos(a + 0.25) * 13, Math.sin(a + 0.25) * 13);
      ctx.lineTo(Math.cos(a + 0.38) * 8, Math.sin(a + 0.38) * 8);
      ctx.closePath();
      ctx.fill();
    }

    // Center brass bolt
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // ------------------------------------------------------------ Phase C / D helpers
  drawArenaBarrier(ctx, g) {
    const x = g.arenaLeft;
    const y0 = Math.max(0, g.cam.y - 40);
    const y1 = Math.min(g.world.h, g.cam.y + VIEW_H + 40);
    ctx.save();
    // Stone frame
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(x - 8, y0, 16, y1 - y0);
    // Iron vertical bars
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    for (let barX = x - 5; barX <= x + 5; barX += 5) {
      ctx.moveTo(barX, y0);
      ctx.lineTo(barX, y1);
    }
    // Crossbars
    for (let barY = Math.floor(y0 / 28) * 28; barY <= y1; barY += 28) {
      ctx.moveTo(x - 8, barY);
      ctx.lineTo(x + 8, barY);
    }
    ctx.stroke();
    // Ominous barrier warning light
    ctx.fillStyle = '#ef4444';
    const runePulse = 0.5 + Math.sin(this.t * 6) * 0.4;
    ctx.globalAlpha = runePulse;
    for (let rY = Math.floor(y0 / 48) * 48 + 12; rY <= y1; rY += 48) {
      ctx.fillRect(x - 3, rY, 6, 6);
    }
    ctx.restore();
  }

  drawKeyBeam(ctx, kb) {
    const x = kb.x, y = kb.y;
    ctx.save();
    const pulse = 0.35 + Math.sin(this.t * 8) * 0.15;
    const grad = ctx.createLinearGradient(x - 24, 0, x + 24, 0);
    grad.addColorStop(0, 'rgba(250, 204, 21, 0)');
    grad.addColorStop(0.5, `rgba(254, 240, 138, ${pulse})`);
    grad.addColorStop(1, 'rgba(250, 204, 21, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x - 24, 0, 48, y);

    // Bright inner core
    const coreGrad = ctx.createLinearGradient(x - 6, 0, x + 6, 0);
    coreGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
    coreGrad.addColorStop(0.5, `rgba(255, 255, 255, ${pulse * 1.5})`);
    coreGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = coreGrad;
    ctx.fillRect(x - 6, 0, 12, y);

    // Ground impact halo
    ctx.strokeStyle = `rgba(250, 204, 21, ${pulse * 1.2})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, y + 4, 20, 6, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  drawBossIntro(ctx, intro) {
    ctx.save();
    // Cinematic letterbox bars
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, VIEW_W, 36);
    ctx.fillRect(0, VIEW_H - 36, VIEW_W, 36);

    // Gold accent trim lines
    ctx.fillStyle = '#d97706';
    ctx.fillRect(0, 34, VIEW_W, 2);
    ctx.fillRect(0, VIEW_H - 36, VIEW_W, 2);

    const progress = 1 - (intro.timer / intro.maxTimer);
    const alpha = Math.min(1, progress * 4);
    ctx.globalAlpha = alpha;

    const bannerY = VIEW_H * 0.32;
    // Dark frosted backdrop card
    const bgGrad = ctx.createLinearGradient(0, bannerY - 32, 0, bannerY + 48);
    bgGrad.addColorStop(0, 'rgba(15, 23, 42, 0)');
    bgGrad.addColorStop(0.3, 'rgba(15, 23, 42, 0.88)');
    bgGrad.addColorStop(0.7, 'rgba(15, 23, 42, 0.88)');
    bgGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, bannerY - 32, VIEW_W, 80);

    // Subtitle badge
    ctx.font = '700 12px Fredoka, sans-serif';
    ctx.fillStyle = '#fbbf24';
    ctx.textAlign = 'center';
    ctx.fillText(intro.subtitle, VIEW_W / 2, bannerY - 10);

    // Boss Name
    ctx.font = '900 28px Fredoka, sans-serif';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(intro.title, VIEW_W / 2, bannerY + 22);

    // Skip prompt with gentle pulsing opacity
    const skipPulse = 0.5 + Math.sin(this.t * 7) * 0.4;
    ctx.font = '600 11px Fredoka, sans-serif';
    ctx.shadowBlur = 0;
    ctx.fillStyle = `rgba(203, 213, 225, ${skipPulse})`;
    ctx.fillText('[ PRESS ANY BUTTON TO SKIP ]', VIEW_W / 2, VIEW_H - 14);
    ctx.restore();
  }

  drawAtmosphere(ctx, theme, camX, camY) {
    ctx.save();
    // 1. Light shafts in forest & autumn forest
    if (theme.id === 'green_hills' || theme.id === 'autumn_forest') {
      const col = theme.id === 'autumn_forest' ? 'rgba(251, 191, 36, 0.05)' : 'rgba(254, 240, 138, 0.04)';
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(100, 0); ctx.lineTo(240, 0); ctx.lineTo(80, VIEW_H); ctx.lineTo(-60, VIEW_H); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(420, 0); ctx.lineTo(580, 0); ctx.lineTo(430, VIEW_H); ctx.lineTo(270, VIEW_H); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(760, 0); ctx.lineTo(920, 0); ctx.lineTo(800, VIEW_H); ctx.lineTo(640, VIEW_H); ctx.fill();
    }

    // 2. Heat haze and sun disc in desert
    if (theme.id === 'desert_ruins') {
      const sunGrad = ctx.createRadialGradient(VIEW_W * 0.78, 85, 8, VIEW_W * 0.78, 85, 80);
      sunGrad.addColorStop(0, 'rgba(254, 240, 138, 0.35)');
      sunGrad.addColorStop(0.4, 'rgba(249, 115, 22, 0.15)');
      sunGrad.addColorStop(1, 'rgba(249, 115, 22, 0)');
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(VIEW_W * 0.78, 85, 80, 0, Math.PI * 2);
      ctx.fill();

      // Heat shimmer wave
      ctx.fillStyle = 'rgba(251, 146, 60, 0.035)';
      const wave = Math.sin(this.t * 3) * 6;
      ctx.fillRect(0, VIEW_H - 110 + wave, VIEW_W, 55);
    }

    // 3. Fog bands at bottom of screen
    const fogGrad = ctx.createLinearGradient(0, VIEW_H - 50, 0, VIEW_H);
    fogGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
    const fogCol = theme.id === 'desert_ruins' ? 'rgba(234, 179, 8, 0.08)' : (theme.id === 'autumn_forest' ? 'rgba(180, 83, 9, 0.07)' : 'rgba(203, 213, 225, 0.07)');
    fogGrad.addColorStop(1, fogCol);
    ctx.fillStyle = fogGrad;
    ctx.fillRect(0, VIEW_H - 50, VIEW_W, 50);

    // 4. Subtle vignette at screen edges
    const vigGrad = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.45, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.75);
    vigGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vigGrad.addColorStop(1, 'rgba(0, 0, 0, 0.25)');
    ctx.fillStyle = vigGrad;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.restore();
  }

  drawForeground(ctx, camX, camY, theme) {
    const t = this.t;
    const speed = 1.2;
    const fgX = camX * speed;
    const fgY = camY * 0.35;
    ctx.save();
    ctx.globalAlpha = 0.22;
    const color = theme.id === 'autumn_forest' ? '#ea580c' : (theme.id === 'desert_ruins' ? '#f59e0b' : '#86efac');
    ctx.fillStyle = color;

    for (let i = 0; i < 18; i++) {
      const seedX = (i * 137.5) % (VIEW_W + 120);
      const seedY = (i * 83.1) % (VIEW_H + 80);
      const x = ((seedX - fgX + t * (20 + (i % 5) * 6)) % (VIEW_W + 120) + (VIEW_W + 120)) % (VIEW_W + 120) - 60;
      const y = ((seedY - fgY + Math.sin(t * 2 + i) * 16) % (VIEW_H + 80) + (VIEW_H + 80)) % (VIEW_H + 80) - 40;
      const size = 6 + (i % 4) * 3;

      ctx.beginPath();
      ctx.ellipse(x, y, size, size * 0.5, (t + i) * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
