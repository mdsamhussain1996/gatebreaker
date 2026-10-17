/**
 * Gatebreaker — Canvas 2D renderer (Phase 1: clear shapes; Phase 2 replaces with the full art pass).
 * Static terrain is baked once per level into an offscreen canvas.
 */
import { TS, VIEW_W, VIEW_H } from './constants.js';
import { bridgeSag } from './game.js';

const hash = (c, r) => (((c * 73856093) ^ (r * 19349663)) >>> 0);

export function bakeTerrain(world) {
  const cv = document.createElement('canvas');
  cv.width = world.w; cv.height = world.h;
  const x = cv.getContext('2d');
  for (let r = 0; r < world.rowCount; r++) {
    for (let c = 0; c < world.cols; c++) {
      const ch = world.get(c, r);
      const px = c * TS, py = r * TS;
      const h = hash(c, r);
      if (ch === '#') {
        x.fillStyle = '#7a4d2e';
        x.fillRect(px, py, TS, TS);
        x.fillStyle = '#5b3720';
        x.beginPath(); x.ellipse(px + 8 + (h % 12), py + 10 + ((h >> 4) % 12), 3.5, 2.5, 0, 0, 7); x.fill();
        if (h % 3 === 0) { x.beginPath(); x.ellipse(px + 20, py + 22, 2.5, 2, 0, 0, 7); x.fill(); }
        if (world.get(c, r + 1) !== '#') {
          x.fillStyle = '#4d2e1a';
          x.fillRect(px, py + TS - 6, TS, 6);
        }
      } else if (ch === '=') {
        const capped = world.get(c, r + 1) === '#';
        if (capped) {
          x.fillStyle = '#7a4d2e'; x.fillRect(px, py, TS, TS);
          const lx = world.get(c - 1, r) === '=' ? 0 : 4, rx = world.get(c + 1, r) === '=' ? 0 : 4;
          x.fillStyle = '#4fb83a';
          x.fillRect(px - lx, py, TS + lx + rx, 12);
          x.fillStyle = '#86dc57';
          x.fillRect(px - lx, py, TS + lx + rx, 4);
          x.fillStyle = '#3c9a2c';
          for (let i = 0; i < 4; i++) {            // grass tufts hanging over the soil
            const tx = px + i * 8 + ((h >> (i * 2)) & 3);
            x.beginPath(); x.moveTo(tx, py + 11); x.lineTo(tx + 5, py + 11); x.lineTo(tx + 2.5, py + 17); x.fill();
          }
        } else {                                  // thin wooden plank
          x.fillStyle = '#b9803e'; x.fillRect(px, py, TS, 10);
          x.fillStyle = '#d9a35a'; x.fillRect(px, py, TS, 3);
          x.fillStyle = '#6e4620'; x.fillRect(px, py + 9, TS, 2);
          x.fillStyle = '#5a3818'; x.fillRect(px + 3, py + 4, 2, 2); x.fillRect(px + TS - 5, py + 4, 2, 2);
        }
      } else if (ch === 'H') {
        x.fillStyle = '#8a5a2b';
        x.fillRect(px + 6, py, 4, TS); x.fillRect(px + TS - 10, py, 4, TS);
        x.fillStyle = '#c28a4a';
        x.fillRect(px + 6, py, 1.5, TS); x.fillRect(px + TS - 10, py, 1.5, TS);
        x.fillStyle = '#a06f38';
        for (let i = 0; i < 3; i++) x.fillRect(px + 8, py + 4 + i * 11, TS - 16, 3.5);
      } else if (ch === '|') {
        x.strokeStyle = '#b98b4d'; x.lineWidth = 3;
        x.beginPath();
        x.moveTo(px + TS / 2, py);
        x.quadraticCurveTo(px + TS / 2 + ((h % 5) - 2), py + TS / 2, px + TS / 2, py + TS);
        x.stroke();
        x.strokeStyle = '#8a6330'; x.lineWidth = 1;
        for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(px + 13, py + 6 + i * 10); x.lineTo(px + 19, py + 9 + i * 10); x.stroke(); }
        if (world.get(c, r + 1) !== '|') {        // knot at the end
          x.fillStyle = '#9a6f33'; x.beginPath(); x.arc(px + TS / 2, py + TS - 2, 5, 0, 7); x.fill();
        }
      }
    }
  }
  return cv;
}

export class Renderer {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.terrain = null;
    this.reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.t = 0;
  }

  setLevel(world) {
    this.terrain = bakeTerrain(world);
  }

  draw(g, dt) {
    const ctx = this.ctx;
    this.t += dt;
    const camX = Math.round(g.cam.x + (g.shake ? (Math.random() - 0.5) * g.shake : 0));
    const camY = Math.round(g.cam.y + (g.shake ? (Math.random() - 0.5) * g.shake : 0));

    this.drawSky(ctx, camX, camY, g.world);

    ctx.save();
    ctx.translate(-camX, -camY);

    // baked terrain (only the visible slice)
    const sx = Math.max(0, camX), sy = Math.max(0, camY);
    const sw = Math.min(VIEW_W, g.world.w - sx), sh = Math.min(VIEW_H, g.world.h - sy);
    if (sw > 0 && sh > 0) ctx.drawImage(this.terrain, sx, sy, sw, sh, sx, sy, sw, sh);

    this.drawHints(ctx, g);
    this.drawGate(ctx, g.gate);
    this.drawCrates(ctx, g, camX, camY);
    for (const b of g.bridges) this.drawBridge(ctx, b);
    for (const c of g.coins) if (!c.collected) this.drawCoin(ctx, c);
    for (const e of g.enemies) if (!e.dead) this.drawMushroom(ctx, e);
    if (g.key) this.drawKey(ctx, g.key);
    this.drawHero(ctx, g.player);
    this.drawParticles(ctx, g);
    ctx.restore();

    this.drawGateArrow(ctx, g, camX, camY);
  }

  // ------------------------------------------------------------ background
  drawSky(ctx, camX, camY, world) {
    const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    grad.addColorStop(0, '#1b2740');
    grad.addColorStop(0.6, '#33435f');
    grad.addColorStop(1, '#4a5a74');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    const prog = world.h > VIEW_H ? camY / (world.h - VIEW_H) : 0;   // 0 top .. 1 bottom
    // distant mountains (parallax)
    ctx.fillStyle = '#26324a';
    ctx.beginPath(); ctx.moveTo(0, VIEW_H);
    const off1 = -(camX * 0.12) % 480;
    for (let k = -1; k < 4; k++) {
      const bx = off1 + k * 480, base = 330 + prog * 90;
      ctx.lineTo(bx, base + 60); ctx.lineTo(bx + 130, base - 40); ctx.lineTo(bx + 240, base + 30);
      ctx.lineTo(bx + 330, base - 70); ctx.lineTo(bx + 480, base + 60);
    }
    ctx.lineTo(VIEW_W + 480, VIEW_H); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2d3b57';
    ctx.beginPath(); ctx.moveTo(0, VIEW_H);
    const off2 = -(camX * 0.22) % 360;
    for (let k = -1; k < 5; k++) {
      const bx = off2 + k * 360, base = 400 + prog * 70;
      ctx.lineTo(bx, base + 50); ctx.lineTo(bx + 100, base - 20); ctx.lineTo(bx + 200, base + 40);
      ctx.lineTo(bx + 290, base - 40); ctx.lineTo(bx + 360, base + 50);
    }
    ctx.lineTo(VIEW_W + 360, VIEW_H); ctx.closePath(); ctx.fill();

    // soft layered clouds (parallax + slow drift)
    const drift = this.reduced ? 0 : this.t * 6;
    for (let i = 0; i < 9; i++) {
      const par = 0.3 + (i % 3) * 0.12;
      const wx = ((i * 331) % 1400) - camX * par + drift * (0.4 + (i % 3) * 0.2);
      const x = ((wx % 1400) + 1400) % 1400 - 220;
      const y = ((i * 137) % 380) - camY * par * 0.5 + 40;
      const a = 0.07 + (i % 3) * 0.035;
      ctx.fillStyle = `rgba(190,205,230,${a})`;
      const s = 0.8 + (i % 4) * 0.25;
      ctx.beginPath();
      ctx.ellipse(x, y, 90 * s, 22 * s, 0, 0, 7);
      ctx.ellipse(x + 60 * s, y - 14 * s, 60 * s, 22 * s, 0, 0, 7);
      ctx.ellipse(x - 55 * s, y - 8 * s, 50 * s, 18 * s, 0, 0, 7);
      ctx.fill();
    }
  }

  // ------------------------------------------------------------ world objects
  drawCrates(ctx, g, camX, camY) {
    const w = g.world;
    const c0 = Math.max(0, Math.floor(camX / TS)), c1 = Math.min(w.cols - 1, Math.floor((camX + VIEW_W) / TS));
    const r0 = Math.max(0, Math.floor(camY / TS)), r1 = Math.min(w.rowCount - 1, Math.floor((camY + VIEW_H) / TS));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      if (w.get(c, r) !== 'X') continue;
      const x = c * TS, y = r * TS;
      ctx.fillStyle = '#c98a4b'; ctx.fillRect(x + 1, y + 1, TS - 2, TS - 2);
      ctx.strokeStyle = '#7a4a1e'; ctx.lineWidth = 2;
      ctx.strokeRect(x + 2, y + 2, TS - 4, TS - 4);
      ctx.beginPath(); ctx.moveTo(x + 3, y + 3); ctx.lineTo(x + TS - 3, y + TS - 3);
      ctx.moveTo(x + TS - 3, y + 3); ctx.lineTo(x + 3, y + TS - 3); ctx.stroke();
    }
  }

  drawBridge(ctx, b) {
    const x0 = b.c0 * TS, x1 = (b.c1 + 1) * TS, y = b.row * TS;
    const sag = xx => bridgeSag(b, xx);
    // rails
    ctx.strokeStyle = '#a4743a'; ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let xx = x0; xx <= x1; xx += 8) {
      const yy = y - 24 + sag(xx) * 0.55;
      if (xx === x0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
    }
    ctx.stroke();
    ctx.lineWidth = 1.5;
    for (let xx = x0 + 16; xx < x1; xx += 32) {
      ctx.beginPath(); ctx.moveTo(xx, y - 24 + sag(xx) * 0.55); ctx.lineTo(xx, y + sag(xx)); ctx.stroke();
    }
    // posts
    ctx.fillStyle = '#6e4620';
    ctx.fillRect(x0 - 3, y - 30, 6, 40); ctx.fillRect(x1 - 3, y - 30, 6, 40);
    // planks follow the curve
    for (let xx = x0; xx < x1; xx += 8) {
      const yy = y + sag(xx + 4);
      ctx.fillStyle = ((xx - x0) / 8) % 2 ? '#b9803e' : '#a56f33';
      ctx.fillRect(xx, yy, 7.5, 7);
      ctx.fillStyle = 'rgba(255,230,170,0.35)'; ctx.fillRect(xx, yy, 7.5, 2);
    }
  }

  drawCoin(ctx, c) {
    const bob = c.pop ? 0 : Math.sin(c.phase) * 2;
    const sx = Math.abs(Math.cos(c.phase * 0.9)) * 0.7 + 0.3;
    const cx = c.x + c.w / 2, cy = c.y + c.h / 2 + bob;
    ctx.fillStyle = '#e8a817';
    ctx.beginPath(); ctx.ellipse(cx, cy, 7 * sx, 7.5, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffd84a';
    ctx.beginPath(); ctx.ellipse(cx - 0.5, cy - 0.5, 5 * sx, 5.5, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff3a8';
    ctx.fillRect(cx - 1.2 * sx, cy - 3, 2.4 * sx, 6);
  }

  drawKey(ctx, k) {
    const cx = k.x + k.w / 2, cy = k.y + k.h / 2;
    const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, 26);
    glow.addColorStop(0, 'rgba(255,224,102,0.55)'); glow.addColorStop(1, 'rgba(255,224,102,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, 26, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffd84a'; ctx.strokeStyle = '#8a5a00'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy - 6, 5.5, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#33435f'; ctx.beginPath(); ctx.arc(cx, cy - 6, 2, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffd84a';
    ctx.fillRect(cx - 1.8, cy - 1, 3.6, 13); ctx.fillRect(cx + 1.8, cy + 5, 4, 2.5); ctx.fillRect(cx + 1.8, cy + 9, 3, 2.5);
    ctx.strokeRect(cx - 1.8, cy - 1, 3.6, 13);
  }

  drawGate(ctx, gt) {
    if (!gt) return;
    const x = gt.x, y = gt.y, w = gt.w, h = gt.h;
    // rocky mound
    ctx.fillStyle = '#6b6258';
    ctx.beginPath();
    ctx.moveTo(x - 14, y + h); ctx.lineTo(x - 6, y + 26); ctx.lineTo(x + 16, y + 4);
    ctx.lineTo(x + w / 2, y - 12); ctx.lineTo(x + w - 14, y + 6); ctx.lineTo(x + w + 6, y + 28);
    ctx.lineTo(x + w + 14, y + h); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#857a6d';
    ctx.beginPath(); ctx.moveTo(x + 10, y + 18); ctx.lineTo(x + w / 2, y - 10); ctx.lineTo(x + w / 2 + 6, y + 12); ctx.lineTo(x + 18, y + 34); ctx.fill();
    ctx.fillStyle = '#4fb83a';
    ctx.beginPath(); ctx.ellipse(x + w / 2, y - 10, 16, 5, 0, 0, 7); ctx.fill();
    // cave opening
    const ox = x + 10, oy = y + 30, ow = w - 20, oh = h - 30;
    ctx.fillStyle = gt.state === 'closed' ? '#14110f' : '#ffe9a0';
    ctx.beginPath(); ctx.moveTo(ox, oy + oh); ctx.lineTo(ox, oy + 12); ctx.quadraticCurveTo(ox + ow / 2, oy - 8, ox + ow, oy + 12); ctx.lineTo(ox + ow, oy + oh); ctx.fill();
    // portcullis (rises when open)
    ctx.save();
    ctx.beginPath(); ctx.rect(ox, oy - 4, ow, oh + 4); ctx.clip();
    const lift = gt.lift * (oh + 6);
    ctx.fillStyle = '#9a6a35';
    for (let i = 0; i < 5; i++) ctx.fillRect(ox + 3 + i * (ow - 8) / 4, oy - lift, 3, oh + 4);
    for (let j = 0; j < 4; j++) ctx.fillRect(ox, oy + 8 + j * 9 - lift, ow, 3);
    ctx.restore();
    // flag
    const fx = x + w / 2, fy = y - 12;
    ctx.fillStyle = '#5a3818'; ctx.fillRect(fx - 1, fy - 30, 2.5, 32);
    const wave = Math.sin(gt.t * (gt.state === 'closed' ? 3 : 8)) * 3;
    ctx.fillStyle = '#e63946';
    ctx.beginPath(); ctx.moveTo(fx + 1.5, fy - 30); ctx.quadraticCurveTo(fx + 12, fy - 28 + wave, fx + 22, fy - 24 + wave * 0.5);
    ctx.quadraticCurveTo(fx + 12, fy - 20 - wave, fx + 1.5, fy - 18); ctx.fill();
  }

  drawMushroom(ctx, e) {
    const cx = e.x + e.w / 2, by = e.y + e.h;
    const bob = Math.abs(Math.sin(e.walkPhase)) * 2;
    ctx.save();
    ctx.translate(cx, by - bob);
    ctx.scale(e.dir < 0 ? 1 : -1, 1);
    // stalk
    ctx.fillStyle = e.flash > 0 ? '#fff' : '#f3e3c3';
    ctx.beginPath(); ctx.roundRect(-7, -14, 14, 14, 4); ctx.fill();
    // feet
    ctx.fillStyle = '#6b4a2a';
    const f = Math.sin(e.walkPhase) * 3;
    ctx.fillRect(-8 + f, -3, 6, 3); ctx.fillRect(2 - f, -3, 6, 3);
    // cap
    ctx.fillStyle = e.flash > 0 ? '#fff' : '#d83a3a';
    ctx.beginPath(); ctx.moveTo(-14, -12); ctx.quadraticCurveTo(-14, -30, 0, -30); ctx.quadraticCurveTo(14, -30, 14, -12); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-6, -22, 2.6, 0, 7); ctx.arc(5, -24, 2.2, 0, 7); ctx.arc(8, -17, 1.8, 0, 7); ctx.fill();
    // angry eyes
    ctx.fillStyle = '#2b1a14';
    ctx.fillRect(-5, -11, 3, 4); ctx.fillRect(2, -11, 3, 4);
    ctx.restore();
  }

  drawHero(ctx, p) {
    if (p.invuln > 0 && Math.floor(this.t * 16) % 2 === 0 && p.hurtT <= 0 && p.invuln < 1.35) return; // blink
    const cx = p.cx, feet = p.y + p.h + p.visDy;
    ctx.save();
    ctx.translate(cx, feet);
    ctx.scale(p.sx, p.sy);
    ctx.scale(p.face, 1);
    // soft shadow
    const run = p.grounded ? Math.sin(p.runPhase) : 0;
    const climbing = p.climbing;
    const legSwing = climbing ? Math.sin(p.climbPhase) * 5 : run * 6;

    // scarf trail
    const trail = climbing ? 0 : Math.max(-26, Math.min(26, -p.vx * 0.12));
    const lift = p.grounded ? 0 : Math.max(-10, Math.min(12, p.vy * 0.02));
    ctx.strokeStyle = '#14b8a6'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-1, -29);
    ctx.quadraticCurveTo(-10 + trail * 0.5 * p.face, -26 + lift, -14 + trail * p.face, -24 + lift + Math.sin(this.t * 14) * 1.5);
    ctx.stroke();

    // legs
    ctx.fillStyle = '#2f3b52';
    ctx.fillRect(-6 + legSwing * 0.5, -10, 5, 10);
    ctx.fillRect(1 - legSwing * 0.5, -10, 5, 10);
    ctx.fillStyle = '#6b4a2a';
    ctx.fillRect(-7 + legSwing * 0.5, -3, 7, 3); ctx.fillRect(0 - legSwing * 0.5, -3, 7, 3);

    // satchel
    ctx.fillStyle = '#a0662f'; ctx.fillRect(-11, -22, 6, 9);
    // body
    ctx.fillStyle = '#f2e6c4'; ctx.strokeStyle = '#26324a'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.roundRect(-8, -26, 16, 17, 5); ctx.fill(); ctx.stroke();
    // scarf band
    ctx.fillStyle = '#14b8a6'; ctx.fillRect(-8, -29, 16, 5);
    // head
    ctx.fillStyle = '#f5cfa4';
    ctx.beginPath(); ctx.arc(0, -33, 8.5, 0, 7); ctx.fill(); ctx.stroke();
    // hair
    ctx.fillStyle = '#4a2f22';
    ctx.beginPath(); ctx.arc(0, -35, 8.8, Math.PI * 1.02, Math.PI * 1.98); ctx.fill();
    ctx.fillRect(-9, -36, 4, 6);
    // eye (blink)
    if (p.blinkT > 0 || p.blinkT < -0.1) {
      ctx.fillStyle = '#1b1b2a'; ctx.fillRect(3, -35, 2.6, 4);
    } else { ctx.fillRect(2.5, -33, 3.5, 1); }

    // knife slash
    if (p.slashT > 0) {
      const a = 1 - p.slashT / 0.14;
      ctx.restore();
      ctx.save();
      ctx.translate(p.cx, p.y + p.h * 0.5);
      ctx.strokeStyle = `rgba(255,255,255,${0.9 - a * 0.7})`;
      ctx.lineWidth = 4; ctx.lineCap = 'round';
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

  /** Edge arrow pointing at the gate while carrying the key. */
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
