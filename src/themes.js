/**
 * Gatebreaker — theme definitions for all 6 environments.
 *
 * Each theme defines:
 *   id, world, name, lightLevel
 *   sky: [[stop, color], ...]
 *   parallax: { far(ctx, w, h), mid(ctx, w, h), near(ctx, w, h) }
 *   clouds: drawClouds(ctx, t, camX, camY)
 *   terrain: {
 *     soil(ctx, px, py, TS, h, neighbors),
 *     cap(ctx, px, py, TS, h, capped, neighbors),
 *     bridge(ctx, px, py, TS, h, sag),
 *     ladder(ctx, px, py, TS, h),
 *     rope(ctx, px, py, TS, h, isEnd)
 *   }
 *   decorations: { ... }
 *   palette: { hudAccent, particleColor, ... }
 *   ambientParticles: { type, count, colors }
 *   music: { key, mode, tempo, bass, lead, pad }
 */

import { TS } from './constants.js';

const hash = (c, r) => (((c * 73856093) ^ (r * 19349663)) >>> 0);

// ===================================================================
// WORLD 1: GREEN HILLS
// Night-dusk sky, bright green grass island tops, warm chunky soil,
// wooden rope bridges, pine ladders, fiber ropes, fireflies.
// ===================================================================
export const THEME_GREEN_HILLS = {
  id: 'green_hills',
  world: 1,
  name: 'Green Hills',
  lightLevel: 1.0,
  sky: [
    [0.0, '#131e33'],  // deep moody blue-grey
    [0.32, '#213a52'], // dusty twilight teal-grey
    [0.58, '#54465b'], // muted slate lavender
    [0.80, '#9e5033'], // warm sunset terracotta
    [0.94, '#e08328'], // radiant golden orange
    [1.0, '#fbbf24']   // glowing amber peach horizon
  ],
  parallax: {
    far(ctx, w, h) {
      // 1. Sun backlight glow low on the left/center
      const sunX = w * 0.24, sunY = h * 0.46;
      const sunGlow = ctx.createRadialGradient(sunX, sunY, 12, sunX, sunY, 260);
      sunGlow.addColorStop(0, 'rgba(255, 252, 230, 0.95)');
      sunGlow.addColorStop(0.2, 'rgba(254, 215, 120, 0.65)');
      sunGlow.addColorStop(0.5, 'rgba(249, 115, 22, 0.35)');
      sunGlow.addColorStop(0.8, 'rgba(234, 88, 12, 0.12)');
      sunGlow.addColorStop(1, 'rgba(234, 88, 12, 0)');
      ctx.fillStyle = sunGlow;
      ctx.beginPath();
      ctx.arc(sunX, sunY, 260, 0, Math.PI * 2);
      ctx.fill();

      // Soft light shafts fanning out from the sun
      ctx.save();
      ctx.fillStyle = 'rgba(254, 240, 138, 0.06)';
      const shafts = [
        [-0.22, 0.26], [0.06, 0.35], [0.34, 0.38], [0.60, 0.44], [0.86, 0.48]
      ];
      for (const [angle, width] of shafts) {
        ctx.beginPath();
        ctx.moveTo(sunX, sunY);
        const x1 = sunX + Math.cos(angle) * 850, y1 = sunY + Math.sin(angle) * 850;
        const x2 = sunX + Math.cos(angle + width) * 850, y2 = sunY + Math.sin(angle + width) * 850;
        ctx.lineTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      // 2. Ridge 1 (Far mountain ridge - muted dusky blue with soft atmospheric haze)
      ctx.fillStyle = '#22334a';
      ctx.beginPath();
      ctx.moveTo(0, h);
      const farPeaks = [
        [0, h - 160], [140, h - 250], [290, h - 190], [460, h - 310],
        [640, h - 210], [820, h - 290], [1020, h - 200], [1200, h - 280], [1400, h - 210]
      ];
      farPeaks.forEach(([x, y]) => ctx.lineTo(x * (w / 1400), y));
      ctx.lineTo(w, h);
      ctx.fill();

      // 3. Ridge 2 (Front mountain ridge - slightly darker slate, soft haze)
      ctx.fillStyle = '#1b293d';
      ctx.beginPath();
      ctx.moveTo(0, h);
      const midPeaks = [
        [0, h - 110], [180, h - 190], [380, h - 140], [580, h - 230],
        [780, h - 160], [980, h - 220], [1180, h - 150], [1400, h - 200]
      ];
      midPeaks.forEach(([x, y]) => ctx.lineTo(x * (w / 1400), y));
      ctx.lineTo(w, h);
      ctx.fill();

      // Soft atmospheric haze band over distant mountains
      const haze = ctx.createLinearGradient(0, h - 260, 0, h);
      haze.addColorStop(0, 'rgba(226, 232, 240, 0)');
      haze.addColorStop(0.7, 'rgba(254, 215, 170, 0.12)');
      haze.addColorStop(1, 'rgba(251, 146, 60, 0.22)');
      ctx.fillStyle = haze;
      ctx.fillRect(0, h - 260, w, 260);
    },
    mid(ctx, w, h) {
      // Far trees: tall straight trunk silhouettes in muted blue-green
      ctx.fillStyle = '#1c3444';
      const trunkXs = [40, 110, 190, 290, 360, 480, 560, 680, 770, 890, 980, 1100, 1210, 1320];
      for (const tx of trunkXs) {
        const x = tx * (w / 1400);
        const tw = 14 + (tx % 7);
        ctx.fillRect(x - tw / 2, 0, tw, h);
        // Tree crown mass at top
        ctx.beginPath();
        ctx.arc(x, 40 + (tx % 50), 38, 0, Math.PI * 2);
        ctx.fill();
      }

      // Fog bands (white 10-15% alpha gradients) drifting between trunks
      const fog1 = ctx.createLinearGradient(0, h * 0.4, 0, h * 0.7);
      fog1.addColorStop(0, 'rgba(255, 255, 255, 0)');
      fog1.addColorStop(0.5, 'rgba(255, 245, 230, 0.14)');
      fog1.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = fog1;
      ctx.fillRect(0, h * 0.4, w, h * 0.3);

      const fog2 = ctx.createLinearGradient(0, h * 0.65, 0, h);
      fog2.addColorStop(0, 'rgba(255, 255, 255, 0)');
      fog2.addColorStop(0.6, 'rgba(254, 215, 170, 0.16)');
      fog2.addColorStop(1, 'rgba(251, 146, 60, 0.10)');
      ctx.fillStyle = fog2;
      ctx.fillRect(0, h * 0.65, w, h * 0.35);
    },
    near(ctx, w, h) {
      // Mid trees: organic darker trunks with bark strokes, vines, leaf clusters
      ctx.save();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#1b1a14';
      const midTrunks = [80, 240, 440, 620, 840, 1050, 1260];
      for (let i = 0; i < midTrunks.length; i++) {
        const x = midTrunks[i] * (w / 1400);
        const tw = 22 + (i % 3) * 6;
        // Base trunk
        ctx.fillStyle = '#2f271d';
        ctx.fillRect(x - tw / 2, 0, tw, h);
        // Bark shadow
        ctx.fillStyle = '#1c1610';
        ctx.fillRect(x + tw * 0.15, 0, tw * 0.35, h);
        // Warm sunset rim light on left edge
        ctx.fillStyle = 'rgba(251, 191, 36, 0.35)';
        ctx.fillRect(x - tw / 2, 0, 3, h);
        // Outlines
        ctx.beginPath();
        ctx.moveTo(x - tw / 2, 0); ctx.lineTo(x - tw / 2, h);
        ctx.moveTo(x + tw / 2, 0); ctx.lineTo(x + tw / 2, h);
        ctx.stroke();

        // Bark grooves
        ctx.strokeStyle = '#1b1a14';
        ctx.lineWidth = 1.5;
        for (let by = 40; by < h; by += 55) {
          ctx.beginPath();
          ctx.moveTo(x - tw * 0.2, by);
          ctx.quadraticCurveTo(x - tw * 0.1, by + 18, x - tw * 0.3, by + 35);
          ctx.stroke();
        }

        // Leaf clusters at top
        const crownY = 60 + (i % 4) * 20;
        ctx.fillStyle = '#1b381a'; // shadow
        ctx.beginPath();
        ctx.arc(x - 18, crownY + 8, 32, 0, Math.PI * 2);
        ctx.arc(x + 22, crownY + 12, 34, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#2d5e24'; // base
        ctx.beginPath();
        ctx.arc(x - 12, crownY - 4, 30, 0, Math.PI * 2);
        ctx.arc(x + 16, crownY - 2, 32, 0, Math.PI * 2);
        ctx.arc(x, crownY - 14, 26, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#65a30d'; // cel highlight
        ctx.beginPath();
        ctx.arc(x - 16, crownY - 8, 16, 0, Math.PI * 2);
        ctx.arc(x + 10, crownY - 10, 18, 0, Math.PI * 2);
        ctx.fill();

        // Hanging vines dangling down
        ctx.strokeStyle = '#1e3818';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(x - tw / 2 - 6, crownY + 30);
        ctx.quadraticCurveTo(x - tw / 2 - 14, crownY + 110, x - tw / 2 - 8, crownY + 170);
        ctx.stroke();
        // Tiny leaves on vine
        ctx.fillStyle = '#4ade80';
        for (let vy = crownY + 50; vy < crownY + 160; vy += 26) {
          ctx.beginPath();
          ctx.ellipse(x - tw / 2 - 12, vy, 5, 2.5, 0.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    },
    foliage(ctx, w, h) {
      // Foreground branches and dense leafy crown canopy framing the upper screen edge
      ctx.save();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#1b1a14';

      // Left giant ancient tree trunk
      const lw = 48;
      ctx.fillStyle = '#261f16';
      ctx.fillRect(-8, 0, lw, h);
      ctx.fillStyle = '#17130e';
      ctx.fillRect(lw - 14, 0, 14, h);
      ctx.fillStyle = 'rgba(251, 191, 36, 0.35)';
      ctx.fillRect(0, 0, 4, h);
      ctx.strokeRect(-8, 0, lw, h);

      // Right framing trunk
      const rw = 44;
      ctx.fillStyle = '#261f16';
      ctx.fillRect(w - rw + 6, 0, rw, h);
      ctx.fillStyle = '#17130e';
      ctx.fillRect(w - rw + 6, 0, 12, h);
      ctx.strokeRect(w - rw + 6, 0, rw, h);

      // Overhanging leafy crown canopy across the top edge
      for (let x = 30; x < w + 60; x += 90) {
        const leafY = 16 + (Math.sin(x * 0.02) * 14);
        ctx.fillStyle = '#16331a'; // dark shadow
        ctx.beginPath();
        ctx.arc(x, leafY + 10, 44, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#245220'; // base green
        ctx.beginPath();
        ctx.arc(x + 10, leafY, 40, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#558a18'; // warm highlight
        ctx.beginPath();
        ctx.arc(x + 4, leafY - 8, 22, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  },
  clouds(ctx, t, camX, camY) {
    ctx.save();
    // Warm sun rays & subtle ambient drifting mist
    ctx.fillStyle = 'rgba(254, 240, 138, 0.04)';
    const puffs = [
      { x: 180, y: 120, r: 52, s: 6 },
      { x: 490, y: 160, r: 68, s: 9 },
      { x: 880, y: 130, r: 58, s: 7 },
      { x: 1220, y: 170, r: 72, s: 5 }
    ];
    puffs.forEach(p => {
      const cx = ((p.x + t * p.s - camX * 0.08) % 1400 + 1400) % 1400 - 100;
      const cy = p.y - camY * 0.03;
      ctx.beginPath();
      ctx.arc(cx, cy, p.r, 0, Math.PI * 2);
      ctx.arc(cx + p.r * 0.6, cy - p.r * 0.2, p.r * 0.7, 0, Math.PI * 2);
      ctx.arc(cx - p.r * 0.5, cy + p.r * 0.1, p.r * 0.6, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  },
  terrain: {
    soil(ctx, px, py, TS, h, neighbors) {
      // 3-tone cel shaded earthy rock (#342b1f base, #221b13 shadow, #4a3d2c highlight)
      ctx.save();
      const ox = (h % 3) - 1;

      // Rock body fill
      ctx.fillStyle = '#342b1f';
      ctx.fillRect(px, py, TS, TS);

      // Cel-shaded geometric rock facets
      ctx.fillStyle = (h % 2 === 0) ? '#3e3426' : '#2b2319';
      ctx.beginPath();
      ctx.moveTo(px + 4, py + 4);
      ctx.lineTo(px + TS - 6, py + 8);
      ctx.lineTo(px + TS - 12, py + TS - 6);
      ctx.lineTo(px + 8, py + TS - 10);
      ctx.closePath();
      ctx.fill();

      // Pebble flecks
      ctx.fillStyle = '#1c150e';
      ctx.beginPath();
      ctx.ellipse(px + 10 + (h % 10), py + 12 + ((h >> 3) % 10), 3.5, 2.5, 0.3, 0, Math.PI * 2);
      ctx.fill();

      // Hand-inked dark outline on exposed edges
      ctx.strokeStyle = '#1b1a14';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';

      // Left edge
      if (neighbors.left !== '#') {
        ctx.beginPath();
        ctx.moveTo(px + ox, py);
        ctx.lineTo(px + ox, py + TS);
        ctx.stroke();
        // Warm sunset rim light on left-facing edge
        ctx.fillStyle = 'rgba(251, 191, 36, 0.40)';
        ctx.fillRect(px, py, 2.5, TS);

        // Creeping ivy vine climbing up left cliff face
        if (h % 2 === 0) {
          ctx.strokeStyle = '#2d1c10';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(px, py + TS);
          ctx.quadraticCurveTo(px + 6, py + TS * 0.5, px + 2, py);
          ctx.stroke();

          ctx.fillStyle = '#22c55e';
          ctx.beginPath();
          ctx.ellipse(px + 6, py + 12, 4.5, 3, 0.5, 0, Math.PI * 2);
          ctx.ellipse(px + 5, py + 22, 4, 2.5, -0.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Right edge
      if (neighbors.right !== '#') {
        ctx.strokeStyle = '#1b1a14';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(px + TS - ox, py);
        ctx.lineTo(px + TS - ox, py + TS);
        ctx.stroke();
        // Cooler dark shadow on right side
        ctx.fillStyle = 'rgba(15, 23, 42, 0.35)';
        ctx.fillRect(px + TS - 3, py, 3, TS);

        // Small leaf cluster on right cliff
        if (h % 3 === 0) {
          ctx.fillStyle = '#15803d';
          ctx.beginPath();
          ctx.ellipse(px + TS - 5, py + 16, 4, 3, -0.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Bottom edge (Underside of ledge)
      if (neighbors.bottom !== '#') {
        ctx.strokeStyle = '#1b1a14';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(px, py + TS);
        ctx.lineTo(px + TS, py + TS);
        ctx.stroke();

        // Deep underside shadow
        ctx.fillStyle = '#17120c';
        ctx.fillRect(px, py + TS - 6, TS, 6);

        // Hanging curved roots dangling 10-38px below
        const rootH = 12 + (h % 24);
        ctx.strokeStyle = '#3d2614';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        const rx = px + (h % 16) + 7;
        ctx.moveTo(rx, py + TS);
        ctx.quadraticCurveTo(rx + ((h % 9) - 4), py + TS + rootH * 0.5, rx + ((h % 7) - 3), py + TS + rootH);
        ctx.stroke();

        // Tiny sprout leaf on some dangling roots
        if (h % 2 === 0) {
          ctx.fillStyle = '#4ade80';
          ctx.beginPath();
          ctx.ellipse(rx + ((h % 7) - 3) + 3, py + TS + rootH - 2, 3.5, 2, 0.3, 0, Math.PI * 2);
          ctx.fill();
        }

        // Secondary small root
        if (h % 3 === 0) {
          ctx.strokeStyle = '#2d1c10';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          const rx2 = px + ((h >> 4) % 18) + 6;
          ctx.moveTo(rx2, py + TS);
          ctx.quadraticCurveTo(rx2 + 4, py + TS + 10, rx2 + 2, py + TS + 18);
          ctx.stroke();
        }
      }

      ctx.restore();
    },
    cap(ctx, px, py, TS, h, capped, neighbors) {
      ctx.save();
      if (capped) {
        // --- SOLID ISLAND TOP WITH THICK CHUNKY MOSSY CAP ---
        // 1. Rock/soil underneath
        ctx.fillStyle = '#342b1f';
        ctx.fillRect(px, py, TS, TS);

        // Ledge overhangs on exposed left/right ends
        const hasLeftNeighbor = neighbors.left === '=';
        const hasRightNeighbor = neighbors.right === '=';
        const lx = hasLeftNeighbor ? 0 : 5;
        const rx = hasRightNeighbor ? 0 : 5;
        const capW = TS + lx + rx;
        const capX = px - lx;

        // 2. Hanging moss drips down front of rock
        ctx.fillStyle = '#365314'; // dark moss shadow
        for (let i = 0; i < 3; i++) {
          const dripX = px + 4 + i * 10 + ((h >> (i * 2)) % 4);
          const dripH = 4 + ((h >> (i * 3)) % 7);
          ctx.beginPath();
          ctx.moveTo(dripX, py + 12);
          ctx.lineTo(dripX + 6, py + 12);
          ctx.lineTo(dripX + 3, py + 12 + dripH);
          ctx.closePath();
          ctx.fill();
        }

        // 3. Thick Moss Cap Body (11px) with 3-tone cel shading
        ctx.fillStyle = '#365314'; // deep moss shadow
        ctx.fillRect(capX, py + 4, capW, 8);

        ctx.fillStyle = '#65a30d'; // base vibrant yellow-green moss
        ctx.fillRect(capX, py + 1, capW, 7);

        ctx.fillStyle = '#bef264'; // top edge bright sunlit highlight rim
        ctx.fillRect(capX, py, capW, 2.5);

        // Hand-inked dark outline along moss contour
        ctx.strokeStyle = '#1b1a14';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(capX, py, capW, 11);

        // 4. Stone Slabs on long ledges
        const isStoneLedge = ((px / TS) % 5) < 3;
        if (isStoneLedge) {
          // Flat carved grey stone slab
          ctx.fillStyle = '#334155'; // stone shadow
          ctx.fillRect(px + 1, py + 3, TS - 2, 6);
          ctx.fillStyle = '#64748b'; // stone base
          ctx.fillRect(px + 1, py + 1, TS - 2, 4);
          ctx.fillStyle = '#94a3b8'; // stone top highlight
          ctx.fillRect(px + 1, py, TS - 2, 1.5);
          // Dark outline & slab seam
          ctx.strokeStyle = '#1b1a14';
          ctx.lineWidth = 2;
          ctx.strokeRect(px + 1, py, TS - 2, 7);
          ctx.beginPath();
          ctx.moveTo(px + TS / 2, py + 1);
          ctx.lineTo(px + TS / 2, py + 7);
          ctx.stroke();
        } else {
          // Organic vegetation details scattered deterministically
          if (h % 3 === 0) {
            // Smooth rounded grey river stone with highlight
            ctx.fillStyle = '#1b1a14';
            ctx.beginPath();
            ctx.ellipse(px + 14, py - 2, 6.5, 4.5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#64748b';
            ctx.beginPath();
            ctx.ellipse(px + 14, py - 2, 5.5, 3.5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#cbd5e1';
            ctx.beginPath();
            ctx.arc(px + 12, py - 3.5, 1.5, 0, Math.PI * 2);
            ctx.fill();
          } else if (h % 3 === 1) {
            // Vibrant flowering wildflower cluster (pink/red petals)
            ctx.fillStyle = '#f43f5e';
            ctx.beginPath();
            ctx.arc(px + 10, py - 4, 3, 0, Math.PI * 2);
            ctx.arc(px + 16, py - 6, 3.5, 0, Math.PI * 2);
            ctx.arc(px + 22, py - 3, 2.8, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fef08a'; // yellow pistil
            ctx.beginPath();
            ctx.arc(px + 16, py - 6, 1.2, 0, Math.PI * 2);
            ctx.fill();
          } else {
            // Little fern frond / grass tuft
            ctx.strokeStyle = '#22c55e';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(px + 16, py);
            ctx.lineTo(px + 12, py - 6);
            ctx.moveTo(px + 16, py);
            ctx.lineTo(px + 16, py - 8);
            ctx.moveTo(px + 16, py);
            ctx.lineTo(px + 20, py - 5);
            ctx.stroke();
          }
        }
      } else {
        // --- FLOATING ONE-WAY WOODEN PLATFORM (=) ---
        // Thick hand-inked lashed timber log/plank
        const pw = TS;
        const ph = 10;
        ctx.strokeStyle = '#1b1a14';
        ctx.lineWidth = 2.5;

        // Cast drop shadow underneath
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.fillRect(px, py + ph, pw, 3.5);

        // Log body 3-tone cel shading
        ctx.fillStyle = '#553013'; // deep bark shadow
        ctx.fillRect(px, py + 4, pw, 6);
        ctx.fillStyle = '#8d5326'; // rich wood base
        ctx.fillRect(px, py + 1.5, pw, 4);
        ctx.fillStyle = '#b37035'; // top warm highlight
        ctx.fillRect(px, py, pw, 2);

        // Hand-inked border
        ctx.strokeRect(px, py, pw, ph);

        // Rope bindings lashed around each end of log
        ctx.fillStyle = '#d97706';
        ctx.fillRect(px + 3, py - 1, 3.5, ph + 2);
        ctx.fillRect(px + pw - 6.5, py - 1, 3.5, ph + 2);
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 3, py - 1, 3.5, ph + 2);
        ctx.strokeRect(px + pw - 6.5, py - 1, 3.5, ph + 2);
      }
      ctx.restore();
    },
    bridge(ctx, px, py, TS, h, sag) {
      // Handled dynamically per bridge in game.js / render.js
    },
    ladder(ctx, px, py, TS, h) {
      ctx.save();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#1b1a14';

      // Rough wooden side poles
      const poleW = 5;
      const lx = px + 6, rx = px + TS - 11;

      // Left pole
      ctx.fillStyle = '#78350f';
      ctx.fillRect(lx, py, poleW, TS);
      ctx.fillStyle = '#b45309';
      ctx.fillRect(lx, py, 1.5, TS);
      ctx.strokeRect(lx, py, poleW, TS);

      // Right pole
      ctx.fillStyle = '#78350f';
      ctx.fillRect(rx, py, poleW, TS);
      ctx.fillStyle = '#b45309';
      ctx.fillRect(rx, py, 1.5, TS);
      ctx.strokeRect(rx, py, poleW, TS);

      // Tied rungs
      for (let i = 0; i < 3; i++) {
        const ry = py + 5 + i * 10;
        ctx.fillStyle = '#92400e';
        ctx.fillRect(lx + 2, ry, rx - lx + 1, 4);
        ctx.fillStyle = '#d97706';
        ctx.fillRect(lx + 2, ry, rx - lx + 1, 1.5);
        ctx.strokeRect(lx + 2, ry, rx - lx + 1, 4);

        // Rope knots at joints
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(lx - 1, ry - 1, 4, 6);
        ctx.fillRect(rx + 2, ry - 1, 4, 6);
      }
      ctx.restore();
    },
    rope(ctx, px, py, TS, h, isEnd) {
      ctx.save();
      const cx = px + TS / 2;
      // Dark outline for rope
      ctx.strokeStyle = '#1b1a14';
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.moveTo(cx, py);
      ctx.lineTo(cx, py + TS);
      ctx.stroke();

      // Braided rope body
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx, py);
      ctx.lineTo(cx, py + TS);
      ctx.stroke();

      // Diagonal rope braids
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 1.2;
      for (let y = py + 3; y < py + TS; y += 7) {
        ctx.beginPath();
        ctx.moveTo(cx - 2, y);
        ctx.lineTo(cx + 2, y + 3);
        ctx.stroke();
      }

      if (isEnd) {
        ctx.fillStyle = '#1b1a14';
        ctx.beginPath();
        ctx.arc(cx, py + TS - 2, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#b45309';
        ctx.beginPath();
        ctx.arc(cx, py + TS - 2, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  },
  palette: {
    accent: '#65a30d',
    particle: '#bef264'
  },
  ambientParticles: {
    type: 'firefly',
    count: 35,
    colors: ['#c4f060', '#ffea78', '#a8e650']
  },
  music: {
    key: 'C',
    mode: 'major',
    tempo: 116,
    scale: [261.63, 293.66, 329.63, 392.00, 440.00, 523.25]
  }
};

// ===================================================================
// WORLD 2: AUTUMN FOREST
// Warm golden-orange dusk, giant redwood trees, leaf litter cap,
// redwood ladders, lanterns, falling leaves.
// ===================================================================
export const THEME_AUTUMN_FOREST = {
  id: 'autumn_forest',
  world: 2,
  name: 'Autumn Forest',
  lightLevel: 1.0,
  sky: [
    [0.0, '#1c151e'],
    [0.4, '#38222a'],
    [0.8, '#623530'],
    [1.0, '#8c4e36']
  ],
  parallax: {
    far(ctx, w, h) {
      ctx.fillStyle = '#2b1c28';
      ctx.beginPath();
      ctx.moveTo(0, h);
      const peaks = [[0, h - 160], [240, h - 290], [520, h - 230], [820, h - 310], [1200, h - 200]];
      peaks.forEach(([x, y]) => ctx.lineTo(x * (w / 1200), y));
      ctx.lineTo(w, h);
      ctx.fill();
    },
    mid(ctx, w, h) {
      ctx.fillStyle = '#422830';
      ctx.beginPath();
      ctx.moveTo(0, h);
      const ridges = [[0, h - 120], [300, h - 220], [680, h - 180], [1000, h - 240], [1200, h - 150]];
      ridges.forEach(([x, y]) => ctx.lineTo(x * (w / 1200), y));
      ctx.lineTo(w, h);
      ctx.fill();
      // Giant autumnal tree canopies
      ctx.fillStyle = '#5c312a';
      for (let x = 60; x < w; x += 110) {
        ctx.beginPath();
        ctx.arc(x, h - 200, 38, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    near(ctx, w, h) {
      ctx.fillStyle = '#523032';
      for (let x = 80; x < w; x += 220) {
        ctx.fillRect(x, h - 300, 26, 300); // tree trunks
      }
    },
    foliage(ctx, w, h) {
      // Near redwood trunks & layered canopy silhouettes
      ctx.fillStyle = '#3a1f22';
      for (let x = 50; x < w; x += 190) {
        ctx.fillRect(x, h - 340, 28, 340);
        ctx.fillRect(x - 30, h - 280, 50, 10);
        ctx.beginPath();
        ctx.arc(x + 12, h - 300, 42, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },
  clouds(ctx, t, camX, camY) {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 200, 150, 0.06)';
    ctx.beginPath();
    ctx.arc(300 - camX * 0.05, 90, 60, 0, Math.PI * 2);
    ctx.arc(800 - camX * 0.05, 120, 75, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },
  terrain: {
    soil(ctx, px, py, TS, h, neighbors) {
      ctx.fillStyle = '#5e3424';
      ctx.fillRect(px, py, TS, TS);
      ctx.fillStyle = '#452216';
      ctx.beginPath();
      ctx.ellipse(px + 10, py + 12, 3, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      if (neighbors.bottom !== '#') {
        ctx.fillStyle = '#32160d';
        ctx.fillRect(px, py + TS - 5, TS, 5);
      }
    },
    cap(ctx, px, py, TS, h, capped, neighbors) {
      if (capped) {
        ctx.fillStyle = '#5e3424';
        ctx.fillRect(px, py, TS, TS);
        const lx = neighbors.left === '=' ? 0 : 4, rx = neighbors.right === '=' ? 0 : 4;
        ctx.fillStyle = '#c85e26'; // amber orange leaf cap
        ctx.fillRect(px - lx, py, TS + lx + rx, 12);
        ctx.fillStyle = '#f08938';
        ctx.fillRect(px - lx, py, TS + lx + rx, 3.5);
        ctx.fillStyle = '#9b3e15';
        for (let i = 0; i < 4; i++) {
          const tx = px + i * 8 + ((h >> i) & 3);
          ctx.beginPath();
          ctx.arc(tx + 2.5, py + 13, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        ctx.fillStyle = '#8f4422';
        ctx.fillRect(px, py, TS, 10);
        ctx.fillStyle = '#bd6233';
        ctx.fillRect(px, py, TS, 3);
      }
    },
    bridge(ctx, px, py, TS, h) {},
    ladder(ctx, px, py, TS, h) {
      ctx.fillStyle = '#6e3820';
      ctx.fillRect(px + 6, py, 4, TS);
      ctx.fillRect(px + TS - 10, py, 4, TS);
      ctx.fillStyle = '#a85b30';
      for (let i = 0; i < 3; i++) ctx.fillRect(px + 8, py + 4 + i * 11, TS - 16, 3.5);
    },
    rope(ctx, px, py, TS, h, isEnd) {
      ctx.strokeStyle = '#a66e40';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(px + TS / 2, py);
      ctx.lineTo(px + TS / 2, py + TS);
      ctx.stroke();
    }
  },
  palette: { accent: '#e06a28', particle: '#f28e38' },
  ambientParticles: {
    type: 'leaf',
    count: 45,
    colors: ['#e2632b', '#f59638', '#b84420', '#fad15c']
  },
  music: {
    key: 'D',
    mode: 'dorian',
    tempo: 108,
    scale: [293.66, 329.63, 349.23, 392.00, 440.00, 523.25]
  }
};

// ===================================================================
// WORLD 3: SANDY DESERT RUINS
// Golden sunset, dunes, sandstone blocks, cracked sandstone planks,
// heat shimmer and blowing sand.
// ===================================================================
export const THEME_DESERT_RUINS = {
  id: 'desert_ruins',
  world: 3,
  name: 'Desert Ruins',
  lightLevel: 1.0,
  sky: [
    [0.0, '#241228'],
    [0.4, '#542036'],
    [0.75, '#9e4638'],
    [1.0, '#d98246']
  ],
  parallax: {
    far(ctx, w, h) {
      ctx.fillStyle = '#481e30';
      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.lineTo(0, h - 180);
      ctx.quadraticCurveTo(w * 0.35, h - 280, w * 0.7, h - 200);
      ctx.quadraticCurveTo(w * 0.85, h - 170, w, h - 230);
      ctx.lineTo(w, h);
      ctx.fill();
    },
    mid(ctx, w, h) {
      ctx.fillStyle = '#7a3434';
      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.lineTo(0, h - 130);
      ctx.quadraticCurveTo(w * 0.25, h - 200, w * 0.55, h - 140);
      ctx.quadraticCurveTo(w * 0.8, h - 100, w, h - 160);
      ctx.lineTo(w, h);
      ctx.fill();
    },
    near(ctx, w, h) {
      ctx.fillStyle = '#a4523c';
      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.lineTo(0, h - 90);
      ctx.quadraticCurveTo(w * 0.4, h - 150, w, h - 100);
      ctx.lineTo(w, h);
      ctx.fill();
    },
    foliage(ctx, w, h) {
      // Ruined sandstone pillars & distant archways
      ctx.fillStyle = '#8c3e2e';
      for (let x = 80; x < w; x += 240) {
        ctx.fillRect(x, h - 230, 20, 230);
        ctx.fillRect(x - 8, h - 240, 36, 10);
        ctx.beginPath();
        ctx.arc(x + 45, h - 190, 30, Math.PI, 0);
        ctx.fill();
      }
    }
  },
  clouds(ctx, t, camX, camY) {},
  terrain: {
    soil(ctx, px, py, TS, h) {
      ctx.fillStyle = '#a6703d'; // sandstone block
      ctx.fillRect(px, py, TS, TS);
      ctx.fillStyle = '#8c592a';
      ctx.fillRect(px, py + TS - 2, TS, 2);
      ctx.fillRect(px + TS - 2, py, 2, TS);
      if (h % 3 === 0) {
        ctx.fillStyle = '#c7925a';
        ctx.fillRect(px + 4, py + 4, TS - 8, 2);
      }
    },
    cap(ctx, px, py, TS, h, capped, neighbors) {
      if (capped) {
        ctx.fillStyle = '#a6703d';
        ctx.fillRect(px, py, TS, TS);
        const lx = neighbors.left === '=' ? 0 : 3, rx = neighbors.right === '=' ? 0 : 3;
        ctx.fillStyle = '#e5b36e'; // warm dune sand
        ctx.fillRect(px - lx, py, TS + lx + rx, 10);
        ctx.fillStyle = '#fce09b';
        ctx.fillRect(px - lx, py, TS + lx + rx, 3);
      } else {
        ctx.fillStyle = '#c78f4f';
        ctx.fillRect(px, py, TS, 10);
      }
    },
    bridge(ctx, px, py, TS, h) {},
    ladder(ctx, px, py, TS, h) {
      ctx.fillStyle = '#9c6634';
      ctx.fillRect(px + 6, py, 4, TS);
      ctx.fillRect(px + TS - 10, py, 4, TS);
      for (let i = 0; i < 3; i++) ctx.fillRect(px + 8, py + 4 + i * 11, TS - 16, 3);
    },
    rope(ctx, px, py, TS, h, isEnd) {
      ctx.strokeStyle = '#c49a5b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(px + TS / 2, py);
      ctx.lineTo(px + TS / 2, py + TS);
      ctx.stroke();
    }
  },
  palette: { accent: '#f2a641', particle: '#edd085' },
  ambientParticles: {
    type: 'sand',
    count: 50,
    colors: ['#e8be74', '#f5d693', '#c99650']
  },
  music: {
    key: 'E',
    mode: 'phrygian',
    tempo: 104,
    scale: [329.63, 349.23, 392.00, 440.00, 493.88, 523.25]
  }
};

// ===================================================================
// WORLD 4: FROZEN PEAKS
// Deep twilight with aurora, snow-capped blue rocks, icicles, snowfall.
// ===================================================================
export const THEME_FROZEN_PEAKS = {
  id: 'frozen_peaks',
  world: 4,
  name: 'Frozen Peaks',
  lightLevel: 1.0,
  sky: [
    [0.0, '#0a1020'],
    [0.5, '#12203b'],
    [0.85, '#1e3857'],
    [1.0, '#2e5572']
  ],
  parallax: {
    far(ctx, w, h) {
      // Aurora borealis wave
      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, 'rgba(40, 220, 180, 0)');
      grad.addColorStop(0.3, 'rgba(60, 240, 190, 0.22)');
      grad.addColorStop(0.7, 'rgba(120, 160, 255, 0.18)');
      grad.addColorStop(1, 'rgba(50, 220, 180, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, h * 0.1);
      ctx.bezierCurveTo(w * 0.3, h * 0.25, w * 0.6, h * 0.05, w, h * 0.2);
      ctx.lineTo(w, h * 0.45);
      ctx.bezierCurveTo(w * 0.6, h * 0.3, w * 0.3, h * 0.45, 0, h * 0.35);
      ctx.fill();

      // Sharp snowy peaks
      ctx.fillStyle = '#162b48';
      ctx.beginPath();
      ctx.moveTo(0, h);
      const peaks = [[0, h - 180], [200, h - 340], [420, h - 220], [680, h - 370], [950, h - 240], [1200, h - 320]];
      peaks.forEach(([x, y]) => ctx.lineTo(x * (w / 1200), y));
      ctx.lineTo(w, h);
      ctx.fill();
    },
    mid(ctx, w, h) {
      ctx.fillStyle = '#223e63';
      ctx.beginPath();
      ctx.moveTo(0, h);
      const hills = [[0, h - 120], [260, h - 230], [540, h - 160], [860, h - 250], [1200, h - 170]];
      hills.forEach(([x, y]) => ctx.lineTo(x * (w / 1200), y));
      ctx.lineTo(w, h);
      ctx.fill();
    },
    near(ctx, w, h) {
      ctx.fillStyle = '#2d507d';
      for (let x = 40; x < w; x += 180) {
        ctx.beginPath();
        ctx.moveTo(x, h);
        ctx.lineTo(x + 20, h - 140);
        ctx.lineTo(x + 40, h);
        ctx.fill();
      }
    },
    foliage(ctx, w, h) {
      // Near snow-dusted pine tree silhouettes
      ctx.fillStyle = '#1c314f';
      for (let x = 60; x < w; x += 190) {
        ctx.beginPath();
        ctx.moveTo(x, h - 220);
        ctx.lineTo(x + 24, h - 140);
        ctx.lineTo(x - 24, h - 140);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x, h - 160);
        ctx.lineTo(x + 32, h - 80);
        ctx.lineTo(x - 32, h - 80);
        ctx.fill();
      }
    }
  },
  clouds(ctx, t, camX, camY) {},
  terrain: {
    soil(ctx, px, py, TS, h) {
      ctx.fillStyle = '#39516d'; // cool slate blue rock
      ctx.fillRect(px, py, TS, TS);
      ctx.fillStyle = '#273a50';
      ctx.fillRect(px, py + TS - 3, TS, 3);
      if (h % 2 === 0) {
        ctx.fillStyle = '#5c7899';
        ctx.fillRect(px + 6, py + 8, 4, 3);
      }
    },
    cap(ctx, px, py, TS, h, capped, neighbors) {
      if (capped) {
        ctx.fillStyle = '#39516d';
        ctx.fillRect(px, py, TS, TS);
        const lx = neighbors.left === '=' ? 0 : 3, rx = neighbors.right === '=' ? 0 : 3;
        ctx.fillStyle = '#eaf5ff'; // fresh white snow
        ctx.fillRect(px - lx, py, TS + lx + rx, 12);
        ctx.fillStyle = '#c7e2f7';
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(px + 5 + i * 11, py + 12, 4, 0, Math.PI);
          ctx.fill();
        }
      } else {
        ctx.fillStyle = '#6f93b5';
        ctx.fillRect(px, py, TS, 10);
      }
    },
    bridge(ctx, px, py, TS, h) {},
    ladder(ctx, px, py, TS, h) {
      ctx.fillStyle = '#4c6885';
      ctx.fillRect(px + 6, py, 4, TS);
      ctx.fillRect(px + TS - 10, py, 4, TS);
      ctx.fillStyle = '#dbe9f5';
      for (let i = 0; i < 3; i++) ctx.fillRect(px + 8, py + 4 + i * 11, TS - 16, 3);
    },
    rope(ctx, px, py, TS, h, isEnd) {
      ctx.strokeStyle = '#93b6d4';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(px + TS / 2, py);
      ctx.lineTo(px + TS / 2, py + TS);
      ctx.stroke();
    }
  },
  palette: { accent: '#6cd0f0', particle: '#ffffff' },
  ambientParticles: {
    type: 'snow',
    count: 65,
    colors: ['#ffffff', '#e2f4ff', '#bde5ff']
  },
  music: {
    key: 'A',
    mode: 'aeolian',
    tempo: 100,
    scale: [220.00, 246.94, 261.63, 293.66, 329.63, 349.23, 392.00]
  }
};

// ===================================================================
// WORLD 5: CRYSTAL CAVES
// Dark underground cave, glowing purple/teal crystals, scaffold ladders,
// light around hero, sparkling crystal dust.
// ===================================================================
export const THEME_CRYSTAL_CAVES = {
  id: 'crystal_caves',
  world: 5,
  name: 'Crystal Caves',
  lightLevel: 0.42, // darkness layer with hero illumination
  sky: [
    [0.0, '#07050e'],
    [0.5, '#0f0a1d'],
    [1.0, '#19112e']
  ],
  parallax: {
    far(ctx, w, h) {
      // Stalactites and cave roof
      ctx.fillStyle = '#110b20';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      for (let x = 0; x <= w; x += 60) {
        ctx.lineTo(x, 40 + (Math.sin(x) * 30));
        ctx.lineTo(x + 30, 100 + (Math.sin(x * 2) * 50));
      }
      ctx.lineTo(w, 0);
      ctx.fill();
    },
    mid(ctx, w, h) {
      // Background crystal clusters that gently glow
      ctx.fillStyle = 'rgba(168, 85, 247, 0.15)';
      for (let x = 80; x < w; x += 180) {
        ctx.beginPath();
        ctx.moveTo(x, h - 80);
        ctx.lineTo(x + 12, h - 160);
        ctx.lineTo(x + 24, h - 80);
        ctx.fill();
      }
    },
    near(ctx, w, h) {
      ctx.fillStyle = '#26173a';
      for (let x = 60; x < w; x += 160) {
        ctx.beginPath();
        ctx.moveTo(x, h);
        ctx.lineTo(x + 15, h - 110);
        ctx.lineTo(x + 30, h);
        ctx.fill();
      }
    },
    foliage(ctx, w, h) {
      // Near luminescent crystal spires
      ctx.fillStyle = '#341a52';
      for (let x = 80; x < w; x += 210) {
        ctx.beginPath();
        ctx.moveTo(x, h - 210);
        ctx.lineTo(x + 18, h - 60);
        ctx.lineTo(x - 18, h - 60);
        ctx.fill();
      }
    }
  },
  clouds(ctx, t, camX, camY) {},
  terrain: {
    soil(ctx, px, py, TS, h) {
      ctx.fillStyle = '#2e2440'; // deep purple cavern stone
      ctx.fillRect(px, py, TS, TS);
      ctx.fillStyle = '#1c152a';
      ctx.fillRect(px, py + TS - 3, TS, 3);
      if (h % 3 === 0) {
        ctx.fillStyle = '#a855f7'; // tiny glowing crystal shard
        ctx.fillRect(px + 10, py + 14, 3, 4);
      }
    },
    cap(ctx, px, py, TS, h, capped, neighbors) {
      if (capped) {
        ctx.fillStyle = '#2e2440';
        ctx.fillRect(px, py, TS, TS);
        const lx = neighbors.left === '=' ? 0 : 3, rx = neighbors.right === '=' ? 0 : 3;
        ctx.fillStyle = '#9333ea'; // glowing purple crystal moss
        ctx.fillRect(px - lx, py, TS + lx + rx, 10);
        ctx.fillStyle = '#c084fc';
        ctx.fillRect(px - lx, py, TS + lx + rx, 3);
      } else {
        ctx.fillStyle = '#4c356e';
        ctx.fillRect(px, py, TS, 10);
      }
    },
    bridge(ctx, px, py, TS, h) {},
    ladder(ctx, px, py, TS, h) {
      ctx.fillStyle = '#4a3b61';
      ctx.fillRect(px + 6, py, 4, TS);
      ctx.fillRect(px + TS - 10, py, 4, TS);
      ctx.fillStyle = '#8168a3';
      for (let i = 0; i < 3; i++) ctx.fillRect(px + 8, py + 4 + i * 11, TS - 16, 3);
    },
    rope(ctx, px, py, TS, h, isEnd) {
      ctx.strokeStyle = '#7c5a9e';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(px + TS / 2, py);
      ctx.lineTo(px + TS / 2, py + TS);
      ctx.stroke();
    }
  },
  palette: { accent: '#c084fc', particle: '#e879f9' },
  ambientParticles: {
    type: 'crystal',
    count: 40,
    colors: ['#c084fc', '#e879f9', '#38bdf8', '#818cf8']
  },
  music: {
    key: 'F#',
    mode: 'minor',
    tempo: 94,
    scale: [185.00, 207.65, 220.00, 246.94, 277.18, 293.66]
  }
};

// ===================================================================
// WORLD 6: VOLCANO SKY FORTRESS
// Red-orange burning sky, lava sea glow, black volcanic basalt,
// iron chains and ladders, rising embers.
// ===================================================================
export const THEME_VOLCANO_FORTRESS = {
  id: 'volcano_fortress',
  world: 6,
  name: 'Volcano Sky Fortress',
  lightLevel: 1.0,
  sky: [
    [0.0, '#150608'],
    [0.4, '#360c10'],
    [0.75, '#6b1812'],
    [1.0, '#b83818']
  ],
  parallax: {
    far(ctx, w, h) {
      // Lava glow at horizon
      ctx.fillStyle = '#3a0f12';
      ctx.beginPath();
      ctx.moveTo(0, h);
      const peaks = [[0, h - 160], [260, h - 310], [580, h - 210], [860, h - 330], [1200, h - 190]];
      peaks.forEach(([x, y]) => ctx.lineTo(x * (w / 1200), y));
      ctx.lineTo(w, h);
      ctx.fill();
    },
    mid(ctx, w, h) {
      ctx.fillStyle = '#561614';
      ctx.beginPath();
      ctx.moveTo(0, h);
      const ridges = [[0, h - 110], [320, h - 210], [700, h - 150], [1050, h - 230], [1200, h - 130]];
      ridges.forEach(([x, y]) => ctx.lineTo(x * (w / 1200), y));
      ctx.lineTo(w, h);
      ctx.fill();
    },
    near(ctx, w, h) {
      ctx.fillStyle = '#22080a';
      // Fortress battlements in the distance
      for (let x = 60; x < w; x += 140) {
        ctx.fillRect(x, h - 160, 48, 160);
      }
    },
    foliage(ctx, w, h) {
      // Jagged volcanic basalt pillars & fortress spikes
      ctx.fillStyle = '#1c0709';
      for (let x = 50; x < w; x += 200) {
        ctx.beginPath();
        ctx.moveTo(x, h - 230);
        ctx.lineTo(x + 16, h - 70);
        ctx.lineTo(x - 16, h - 70);
        ctx.fill();
      }
    }
  },
  clouds(ctx, t, camX, camY) {
    // Smoky haze
    ctx.save();
    ctx.fillStyle = 'rgba(255, 80, 20, 0.08)';
    ctx.beginPath();
    ctx.arc(400 - camX * 0.04, 100, 80, 0, Math.PI * 2);
    ctx.arc(900 - camX * 0.04, 130, 95, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },
  terrain: {
    soil(ctx, px, py, TS, h) {
      ctx.fillStyle = '#2b1b1c'; // black volcanic rock
      ctx.fillRect(px, py, TS, TS);
      ctx.fillStyle = '#170c0d';
      ctx.fillRect(px, py + TS - 3, TS, 3);
      if (h % 3 === 0) {
        ctx.fillStyle = '#e64a19'; // tiny magma crack
        ctx.fillRect(px + 8, py + 12, 5, 2);
      }
    },
    cap(ctx, px, py, TS, h, capped, neighbors) {
      if (capped) {
        ctx.fillStyle = '#2b1b1c';
        ctx.fillRect(px, py, TS, TS);
        const lx = neighbors.left === '=' ? 0 : 3, rx = neighbors.right === '=' ? 0 : 3;
        ctx.fillStyle = '#542622'; // scorched iron / obsidian cap
        ctx.fillRect(px - lx, py, TS + lx + rx, 10);
        ctx.fillStyle = '#d84315';
        ctx.fillRect(px - lx, py, TS + lx + rx, 2.5);
      } else {
        ctx.fillStyle = '#422420';
        ctx.fillRect(px, py, TS, 10);
      }
    },
    bridge(ctx, px, py, TS, h) {},
    ladder(ctx, px, py, TS, h) {
      ctx.fillStyle = '#3a2726';
      ctx.fillRect(px + 6, py, 4, TS);
      ctx.fillRect(px + TS - 10, py, 4, TS);
      ctx.fillStyle = '#8a4b3d';
      for (let i = 0; i < 3; i++) ctx.fillRect(px + 8, py + 4 + i * 11, TS - 16, 3);
    },
    rope(ctx, px, py, TS, h, isEnd) {
      // Iron chain
      ctx.strokeStyle = '#6e514f';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(px + TS / 2, py);
      ctx.lineTo(px + TS / 2, py + TS);
      ctx.stroke();
    }
  },
  palette: { accent: '#ff5722', particle: '#ff9800' },
  ambientParticles: {
    type: 'ember',
    count: 55,
    colors: ['#ffab40', '#ff5722', '#ffeb3b', '#d84315']
  },
  music: {
    key: 'C',
    mode: 'minor',
    tempo: 126,
    scale: [130.81, 146.83, 155.56, 174.61, 196.00, 207.65]
  }
};

export const THEMES = {
  green_hills: THEME_GREEN_HILLS,
  autumn_forest: THEME_AUTUMN_FOREST,
  desert_ruins: THEME_DESERT_RUINS,
  frozen_peaks: THEME_FROZEN_PEAKS,
  crystal_caves: THEME_CRYSTAL_CAVES,
  volcano_fortress: THEME_VOLCANO_FORTRESS
};

export function getTheme(themeId) {
  if (!THEMES[themeId]) {
    throw new Error(`Unknown theme id "${themeId}". Valid themes: ${Object.keys(THEMES).join(', ')}`);
  }
  return THEMES[themeId];
}
