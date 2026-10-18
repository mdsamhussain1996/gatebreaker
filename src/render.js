/**
 * Gatebreaker — Canvas 2D renderer.
 * Static terrain and 3-layer parallax backgrounds are baked to offscreen canvases.
 * The theme system defines all materials and parallax painters.
 */
import { TS, VIEW_W, VIEW_H } from './constants.js';
import { bridgeSag } from './game.js';
import { getTheme } from './themes.js';

const hash = (c, r) => (((c * 73856093) ^ (r * 19349663)) >>> 0);

/**
 * Bake the static world tiles into an offscreen canvas.
 * Uses the theme's procedural tile painters with ZERO hardcoded theme checks.
 */
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
    this.theme = null;
    this.reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.t = 0;
    this.ambientParticles = [];
  }

  setLevel(world, theme = getTheme('green_hills')) {
    this.theme = theme;
    this.terrain = bakeTerrain(world, theme);

    // Bake 3 parallax layers (wrap width 1400 px, height 540 px)
    const pw = 1400, ph = VIEW_H;
    this.parallaxFar = bakeParallax(theme.parallax.far, pw, ph);
    this.parallaxMid = bakeParallax(theme.parallax.mid, pw, ph);
    this.parallaxNear = bakeParallax(theme.parallax.near, pw, ph);

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

    // 4. Collectibles
    for (const c of g.coins) if (!c.collected) this.drawCoin(ctx, c);
    for (const gm of g.gems) if (!gm.collected) this.drawGem(ctx, gm);
    for (const st of g.stars) if (!st.collected) this.drawStar(ctx, st);
    for (const ht of g.hearts) if (!ht.collected) this.drawHeart(ctx, ht);

    // 5. Enemies & Bosses
    for (const e of g.enemies) {
      if (e.dead) continue;
      if (e.type === 'mushroom') this.drawMushroom(ctx, e);
      else if (e.type === 'hedgehog') this.drawHedgehog(ctx, e);
      else if (e.type === 'squirrel') this.drawSquirrel(ctx, e);
      else if (e.type === 'snapvine') this.drawSnapvine(ctx, e);
      else if (e.type === 'scorpion') this.drawScorpion(ctx, e);
      else if (e.type === 'sand_worm') this.drawSandWorm(ctx, e);
      else if (e.isBoss) this.drawBoss(ctx, e);
    }

    // 6. Key, Hero & Particles
    if (g.key) this.drawKey(ctx, g.key);
    this.drawHero(ctx, g.player);
    this.drawParticles(ctx, g);
    this.drawHints(ctx, g);

    ctx.restore();

    // 7. Ambient particles (screen space)
    this.drawAmbient(ctx, dt, theme);

    // 8. Screen space overlays: Gate edge arrow & Boss health bar
    this.drawGateArrow(ctx, g, camX, camY);
    if (g.boss) this.drawBossHealthBar(ctx, g.boss);
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

    // Layer 1: Far Parallax (scroll factor 0.10)
    if (this.parallaxFar) {
      const offFar = -((camX * 0.10) % pw);
      ctx.drawImage(this.parallaxFar, offFar, 0);
      if (offFar + pw < VIEW_W) ctx.drawImage(this.parallaxFar, offFar + pw, 0);
      if (offFar > 0) ctx.drawImage(this.parallaxFar, offFar - pw, 0);
    }

    // Layer 2: Mid Parallax (scroll factor 0.30)
    if (this.parallaxMid) {
      const offMid = -((camX * 0.30) % pw);
      ctx.drawImage(this.parallaxMid, offMid, 0);
      if (offMid + pw < VIEW_W) ctx.drawImage(this.parallaxMid, offMid + pw, 0);
      if (offMid > 0) ctx.drawImage(this.parallaxMid, offMid - pw, 0);
    }

    // Layer 3: Near Parallax (scroll factor 0.60)
    if (this.parallaxNear) {
      const offNear = -((camX * 0.60) % pw);
      ctx.drawImage(this.parallaxNear, offNear, 0);
      if (offNear + pw < VIEW_W) ctx.drawImage(this.parallaxNear, offNear + pw, 0);
      if (offNear > 0) ctx.drawImage(this.parallaxNear, offNear - pw, 0);
    }

    // Layer 4: Procedural Clouds / Atmosphere
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
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
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
    ctx.fillStyle = '#e8a817';
    ctx.beginPath(); ctx.ellipse(cx, cy, 7 * sx, 7.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd84a';
    ctx.beginPath(); ctx.ellipse(cx - 0.5, cy - 0.5, 5 * sx, 5.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff3a8';
    ctx.fillRect(cx - 1.2 * sx, cy - 3, 2.4 * sx, 6);
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
    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 18);
    glow.addColorStop(0, 'rgba(251, 191, 36, 0.6)');
    glow.addColorStop(1, 'rgba(251, 191, 36, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill();

    // 5-point star
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
      const r = 9;
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fffbeb';
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
    const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, 26);
    glow.addColorStop(0, 'rgba(255,224,102,0.55)');
    glow.addColorStop(1, 'rgba(255,224,102,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(cx, cy, 26, 0, Math.PI * 2); ctx.fill();
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
    // Name
    ctx.font = '700 13px Fredoka, sans-serif';
    ctx.fillStyle = '#fed7aa';
    ctx.textAlign = 'center';
    ctx.fillText(`${boss.name.toUpperCase()} (WORLD 1 BOSS)`, VIEW_W / 2, by - 6);

    // Background bar
    ctx.fillStyle = '#1c1917';
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 2.5;
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
    ctx.restore();
  }

  drawHero(ctx, p) {
    if (p.invuln > 0 && Math.floor(this.t * 16) % 2 === 0 && p.hurtT <= 0 && p.invuln < 1.35) return;
    const cx = p.cx, feet = p.y + p.h + p.visDy;
    ctx.save();
    ctx.translate(cx, feet);
    ctx.scale(p.sx, p.sy);
    ctx.scale(p.face, 1);

    const run = p.grounded ? Math.sin(p.runPhase) : 0;
    const climbing = p.climbing;
    const legSwing = climbing ? Math.sin(p.climbPhase) * 5 : run * 6;

    // Scarf trail
    const trail = climbing ? 0 : Math.max(-26, Math.min(26, -p.vx * 0.12));
    const lift = p.grounded ? 0 : Math.max(-10, Math.min(12, p.vy * 0.02));
    ctx.strokeStyle = '#14b8a6';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-1, -29);
    ctx.quadraticCurveTo(-10 + trail * 0.5 * p.face, -26 + lift, -14 + trail * p.face, -24 + lift + Math.sin(this.t * 14) * 1.5);
    ctx.stroke();

    // Legs
    ctx.fillStyle = '#2f3b52';
    ctx.fillRect(-6 + legSwing * 0.5, -10, 5, 10);
    ctx.fillRect(1 - legSwing * 0.5, -10, 5, 10);
    ctx.fillStyle = '#6b4a2a';
    ctx.fillRect(-7 + legSwing * 0.5, -3, 7, 3);
    ctx.fillRect(0 - legSwing * 0.5, -3, 7, 3);

    // Satchel
    ctx.fillStyle = '#a0662f';
    ctx.fillRect(-11, -22, 6, 9);

    // Body
    ctx.fillStyle = '#f2e6c4';
    ctx.strokeStyle = '#26324a';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.roundRect(-8, -26, 16, 17, 5);
    ctx.fill();
    ctx.stroke();

    // Scarf neck band
    ctx.fillStyle = '#14b8a6';
    ctx.fillRect(-8, -29, 16, 5);

    // Head
    ctx.fillStyle = '#f5cfa4';
    ctx.beginPath();
    ctx.arc(0, -33, 8.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Hair
    ctx.fillStyle = '#4a2f22';
    ctx.beginPath();
    ctx.arc(0, -35, 8.8, Math.PI * 1.02, Math.PI * 1.98);
    ctx.fill();
    ctx.fillRect(-9, -36, 4, 6);

    // Eye
    if (p.blinkT > 0 || p.blinkT < -0.1) {
      ctx.fillStyle = '#1b1b2a';
      ctx.fillRect(3, -35, 2.6, 4);
    } else {
      ctx.fillRect(2.5, -33, 3.5, 1);
    }

    // Knife slash
    if (p.slashT > 0) {
      const a = 1 - p.slashT / 0.14;
      ctx.restore();
      ctx.save();
      ctx.translate(p.cx, p.y + p.h * 0.5);
      ctx.strokeStyle = `rgba(255,255,255,${0.9 - a * 0.7})`;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      if (p.slashDown) ctx.arc(0, 4, 20, Math.PI * 0.15, Math.PI * 0.85);
      else if (p.face > 0) ctx.arc(-4, 0, 26, -0.9 + a * 0.5, 0.9 - a * 0.1);
      else ctx.arc(4, 0, 26, Math.PI - 0.9 + a * 0.1, Math.PI + 0.9 - a * 0.5);
      ctx.stroke();
      ctx.restore();
      return;
    }
    ctx.restore();
  }

  drawParticles(ctx, g) {
    for (const q of g.particles) {
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
    const p = g.player;
    ctx.font = '600 13px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    for (const h of g.level.hints) {
      const d = Math.hypot(p.cx - h.x, p.cy - h.y);
      if (d > 150) continue;
      const a = Math.min(1, (150 - d) / 60);
      const w = ctx.measureText(h.text).width + 20;
      ctx.globalAlpha = a;
      ctx.fillStyle = '#fff6dc'; ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(h.x - w / 2, h.y - 62, w, 26, 9); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#4a2f22'; ctx.fillText(h.text, h.x, h.y - 44);
    }
    ctx.globalAlpha = 1;
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
}
