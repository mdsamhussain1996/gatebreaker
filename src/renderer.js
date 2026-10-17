/**
 * Gatebreaker v2 — Procedural Canvas 2D Renderer
 * Jungle ruins style: Parallax waterfall backdrop, mossy stone platforms,
 * rope-bound wooden planks, hanging climbing ropes, Rook with teal scarf,
 * Beetlebot, wrapped gift crate, floating golden key, and Keyhole Gate.
 */

import { TS, VIEW_W, VIEW_H, KNIFE_W, KNIFE_H } from './constants.js';

export class GameRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.waterfallOffset = 0;
  }

  render(gameState, dt) {
    const ctx = this.ctx;
    this.waterfallOffset = (this.waterfallOffset + dt * 140) % 64;

    ctx.save();
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);

    // 1. Parallax Jungle Waterfall Background
    this.drawBackground(ctx, gameState);

    // 2. Camera Translation
    ctx.save();
    ctx.translate(-Math.round(gameState.camera.x), -Math.round(gameState.camera.y));

    // 3. World Tilemap (Solid stone, One-way planks, Ropes)
    this.drawTilemap(ctx, gameState);

    // 4. Gift Crates
    this.drawCrates(ctx, gameState);

    // 5. Keyhole Gate
    this.drawGate(ctx, gameState);

    // 6. Enemies (Beetlebots)
    this.drawEnemies(ctx, gameState);

    // 7. Floating Key
    this.drawKey(ctx, gameState);

    // 8. Hero (Rook)
    this.drawHero(ctx, gameState);

    // 9. Particles
    this.drawParticles(ctx, gameState);

    ctx.restore(); // restore camera

    // 10. Foreground canopy leaves
    this.drawForegroundVines(ctx);

    ctx.restore();
  }

  drawBackground(ctx, gameState) {
    // Sky gradient (warm jungle morning)
    const skyGrad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    skyGrad.addColorStop(0, '#6ee7b7'); // bright mint sky
    skyGrad.addColorStop(0.5, '#38bdf8'); // sky blue
    skyGrad.addColorStop(1, '#0284c7');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // Distant misty mountains & ruins (Parallax layer 1)
    ctx.fillStyle = '#0f766e';
    ctx.beginPath();
    ctx.moveTo(0, 320);
    ctx.lineTo(160, 240);
    ctx.lineTo(340, 310);
    ctx.lineTo(520, 220);
    ctx.lineTo(720, 300);
    ctx.lineTo(960, 230);
    ctx.lineTo(960, VIEW_H);
    ctx.lineTo(0, VIEW_H);
    ctx.closePath();
    ctx.fill();

    // Animated Jungle Waterfall
    ctx.fillStyle = 'rgba(224, 242, 254, 0.65)';
    ctx.fillRect(520, 220, 32, VIEW_H - 220);
    // Waterfall water ribbons
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    for (let wy = 220 + (this.waterfallOffset % 24); wy < VIEW_H; wy += 24) {
      ctx.fillRect(524, wy, 8, 12);
      ctx.fillRect(538, wy + 6, 8, 12);
    }
    // Waterfall spray mist
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.beginPath();
    ctx.arc(536, VIEW_H - 20, 48, 0, Math.PI * 2);
    ctx.fill();

    // Midground jungle silhouettes (Parallax layer 2)
    ctx.fillStyle = '#064e3b';
    ctx.beginPath();
    ctx.moveTo(0, 380);
    ctx.lineTo(200, 330);
    ctx.lineTo(400, 390);
    ctx.lineTo(620, 340);
    ctx.lineTo(840, 380);
    ctx.lineTo(960, 350);
    ctx.lineTo(960, VIEW_H);
    ctx.lineTo(0, VIEW_H);
    ctx.closePath();
    ctx.fill();
  }

  drawTilemap(ctx, gameState) {
    const tiles = gameState.tiles;
    const h = tiles.length;
    const w = tiles[0].length;

    for (let ty = 0; ty < h; ty++) {
      for (let tx = 0; tx < w; tx++) {
        const tile = tiles[ty][tx];
        const px = tx * TS;
        const py = ty * TS;

        if (tile === '#') {
          // Solid stone block with mossy grass top
          const isTopSolid = ty > 0 && tiles[ty - 1][tx] === '#';

          // Stone body
          ctx.fillStyle = '#334155';
          ctx.fillRect(px, py, TS, TS);
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(px, py + TS - 4, TS, 4);
          ctx.fillRect(px + TS - 4, py, 4, TS);

          // Stone brick inner lines
          ctx.strokeStyle = '#475569';
          ctx.lineWidth = 1;
          ctx.strokeRect(px + 1, py + 1, TS - 2, TS - 2);

          // Mossy grass on top exposed face
          if (!isTopSolid) {
            ctx.fillStyle = '#15803d'; // deep moss
            ctx.fillRect(px, py, TS, 8);
            ctx.fillStyle = '#22c55e'; // bright grass
            ctx.fillRect(px, py, TS, 5);

            // Hanging grass tufts
            ctx.fillStyle = '#22c55e';
            ctx.beginPath();
            ctx.moveTo(px + 4, py + 5);
            ctx.lineTo(px + 8, py + 10);
            ctx.lineTo(px + 12, py + 5);
            ctx.moveTo(px + 18, py + 5);
            ctx.lineTo(px + 22, py + 11);
            ctx.lineTo(px + 26, py + 5);
            ctx.fill();
          }
        } else if (tile === '=') {
          // Rope-bound wooden one-way plank
          ctx.fillStyle = '#b45309'; // warm wood
          ctx.fillRect(px, py, TS, 12);
          ctx.fillStyle = '#78350f'; // wood grain shadow
          ctx.fillRect(px, py + 10, TS, 2);

          // Rope wraps around ends
          ctx.fillStyle = '#fef08a';
          ctx.fillRect(px + 2, py - 1, 4, 14);
          ctx.fillRect(px + TS - 6, py - 1, 4, 14);
        } else if (tile === '|') {
          // Hanging climbing rope
          ctx.fillStyle = '#ca8a04';
          ctx.fillRect(px + 14, py, 4, TS);
          // Rope knot spirals
          ctx.fillStyle = '#fef08a';
          for (let ry = py; ry < py + TS; ry += 8) {
            ctx.fillRect(px + 13, ry, 6, 2);
          }
        }
      }
    }
  }

  drawCrates(ctx, gameState) {
    for (const crate of gameState.crates) {
      if (crate.opened) continue;
      const x = crate.x;
      const y = crate.y;

      // Wooden crate body
      ctx.fillStyle = '#92400e';
      ctx.fillRect(x, y, crate.w, crate.h);
      ctx.strokeStyle = '#b45309';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, crate.w - 2, crate.h - 2);

      // Gift ribbon wrapping
      ctx.fillStyle = '#06b6d4'; // teal gift ribbon
      ctx.fillRect(x + crate.w / 2 - 3, y, 6, crate.h);
      ctx.fillRect(x, y + crate.h / 2 - 3, crate.w, 6);

      // Gift bow on top
      ctx.fillStyle = '#22d3ee';
      ctx.beginPath();
      ctx.arc(x + crate.w / 2 - 5, y - 2, 4, 0, Math.PI * 2);
      ctx.arc(x + crate.w / 2 + 5, y - 2, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawGate(ctx, gameState) {
    const gate = gameState.gate;
    if (!gate) return;

    // Stone Archway
    ctx.fillStyle = '#475569';
    ctx.fillRect(gate.x, gate.y, gate.w, gate.h);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(gate.x + 4, gate.y + 8, gate.w - 8, gate.h - 8);

    // Glowing Teal Keyhole in center
    ctx.fillStyle = gate.unlocked ? '#38bdf8' : '#0ea5e9';
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = gate.unlocked ? 20 : 8;

    ctx.beginPath();
    ctx.arc(gate.x + gate.w / 2, gate.y + 20, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(gate.x + gate.w / 2 - 3, gate.y + 20);
    ctx.lineTo(gate.x + gate.w / 2 + 3, gate.y + 20);
    ctx.lineTo(gate.x + gate.w / 2 + 5, gate.y + 32);
    ctx.lineTo(gate.x + gate.w / 2 - 5, gate.y + 32);
    ctx.closePath();
    ctx.fill();

    ctx.shadowBlur = 0; // reset
  }

  drawEnemies(ctx, gameState) {
    for (const enemy of gameState.enemies) {
      if (enemy.dead) continue;
      const x = enemy.x;
      const y = enemy.y;

      ctx.save();
      ctx.translate(x + enemy.w / 2, y + enemy.h / 2);
      ctx.scale(enemy.dir, 1);

      // Beetlebot shell (emerald bronze)
      ctx.fillStyle = '#059669';
      ctx.beginPath();
      ctx.ellipse(0, 0, enemy.w / 2, enemy.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();

      // Wing casing line
      ctx.strokeStyle = '#047857';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-4, 0);
      ctx.lineTo(8, 0);
      ctx.stroke();

      // Little mechanical eye
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(6, -3, 3, 0, Math.PI * 2);
      ctx.fill();

      // Wind-up key on back
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(-enemy.w / 2 - 3, -2, 4, 4);
      ctx.beginPath();
      ctx.arc(-enemy.w / 2 - 4, 0, 4, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    }
  }

  drawKey(ctx, gameState) {
    const key = gameState.keyItem;
    if (!key) return;

    ctx.save();
    ctx.translate(key.x, key.y + Math.sin(key.bob) * 3);

    // Glowing aura
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 12;

    // Golden key body
    ctx.fillStyle = '#fbbf24';
    // Key bow
    ctx.beginPath();
    ctx.arc(8, 4, 6, 0, Math.PI * 2);
    ctx.fill();
    // Inner teal gem
    ctx.fillStyle = '#06b6d4';
    ctx.beginPath();
    ctx.arc(8, 4, 3, 0, Math.PI * 2);
    ctx.fill();

    // Key stem
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(7, 9, 3, 10);
    ctx.fillRect(10, 14, 4, 2);
    ctx.fillRect(10, 17, 3, 2);

    ctx.restore();
  }

  drawHero(ctx, gameState) {
    const hero = gameState.hero;

    // Invulnerability blink
    if (hero.invulnTimer > 0 && Math.floor(gameState.time * 20) % 2 === 0) {
      return;
    }

    ctx.save();
    ctx.translate(hero.x + hero.w / 2, hero.y + hero.h / 2);
    ctx.scale(hero.facing, 1);

    // Explorer Boots & Legs
    ctx.fillStyle = '#451a03';
    ctx.fillRect(-6, 8, 4, 6);
    ctx.fillRect(2, 8, 4, 6);

    // Explorer Tunic / Shirt
    ctx.fillStyle = '#fef3c7'; // cream explorer shirt
    ctx.fillRect(-7, -4, 14, 12);

    // Brown adventurer satchel across chest
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-6, -4);
    ctx.lineTo(5, 7);
    ctx.stroke();

    // Head / Face
    ctx.fillStyle = '#fed7aa'; // skin tone
    ctx.beginPath();
    ctx.arc(0, -8, 7, 0, Math.PI * 2);
    ctx.fill();

    // Explorer Cap
    ctx.fillStyle = '#d97706';
    ctx.beginPath();
    ctx.arc(0, -11, 7, Math.PI, 0);
    ctx.lineTo(8, -10);
    ctx.lineTo(-7, -10);
    ctx.closePath();
    ctx.fill();

    // Rook's signature Teal Scarf (flutters behind)
    const scarfFlutter = Math.sin(gameState.time * 15) * 3 - (hero.vx * hero.facing * 0.02);
    ctx.fillStyle = '#0d9488';
    ctx.beginPath();
    ctx.moveTo(-2, -3);
    ctx.lineTo(-12, scarfFlutter);
    ctx.lineTo(-14, scarfFlutter + 4);
    ctx.lineTo(-2, 1);
    ctx.closePath();
    ctx.fill();

    // Eye looking forward
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(3, -8, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Knife in Hand
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(6, 0, 8, 3);
    ctx.fillStyle = '#78350f';
    ctx.fillRect(4, -1, 3, 5);

    // Knife Slash Arc Effect
    if (hero.knifeActiveTimer > 0) {
      ctx.save();
      if (hero.isDownSlash) {
        // Downward arc
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 16, 16, 0, Math.PI);
        ctx.stroke();
      } else {
        // Forward arc
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(8, 0, 18, -Math.PI / 3, Math.PI / 3);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.restore();
  }

  drawParticles(ctx, gameState) {
    for (const p of gameState.particles) {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawForegroundVines(ctx) {
    // Hanging jungle canopy leaves around screen corners
    ctx.fillStyle = '#064e3b';
    ctx.beginPath();
    ctx.arc(40, -10, 60, 0, Math.PI * 2);
    ctx.arc(140, -20, 50, 0, Math.PI * 2);
    ctx.arc(VIEW_W - 50, -10, 60, 0, Math.PI * 2);
    ctx.fill();
  }
}
