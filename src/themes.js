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
    [0.0, '#0c1527'],
    [0.45, '#1b2a4a'],
    [0.85, '#2e3a5a'],
    [1.0, '#433c52']
  ],
  parallax: {
    far(ctx, w, h) {
      // Distant mountain silhouettes (slate blue)
      ctx.fillStyle = '#18233c';
      ctx.beginPath();
      ctx.moveTo(0, h);
      const peaks = [
        [0, h - 140], [180, h - 280], [360, h - 190], [520, h - 330],
        [700, h - 210], [890, h - 310], [1050, h - 200], [1200, h - 290]
      ];
      peaks.forEach(([x, y]) => ctx.lineTo(x * (w / 1200), y));
      ctx.lineTo(w, h);
      ctx.fill();

      // Soft moon / dusk glow
      const grad = ctx.createRadialGradient(w * 0.75, h * 0.28, 10, w * 0.75, h * 0.28, 90);
      grad.addColorStop(0, 'rgba(255, 245, 210, 0.25)');
      grad.addColorStop(1, 'rgba(255, 245, 210, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(w * 0.75, h * 0.28, 90, 0, Math.PI * 2);
      ctx.fill();
    },
    mid(ctx, w, h) {
      // Mid-distance rounded mountain ridges (deeper blue-grey)
      ctx.fillStyle = '#21304f';
      ctx.beginPath();
      ctx.moveTo(0, h);
      const hills = [
        [0, h - 100], [220, h - 210], [440, h - 130], [660, h - 230],
        [880, h - 150], [1100, h - 220], [1200, h - 140]
      ];
      for (let i = 0; i < hills.length; i++) {
        const [x, y] = hills[i];
        ctx.lineTo(x * (w / 1200), y);
      }
      ctx.lineTo(w, h);
      ctx.fill();

      // Soft pine tree silhouettes on ridge tops
      ctx.fillStyle = '#1a2640';
      for (let x = 30; x < w; x += 65) {
        const treeH = 22 + (Math.sin(x) * 8);
        const groundY = h - 140 + Math.sin(x * 0.01) * 40;
        ctx.beginPath();
        ctx.moveTo(x, groundY);
        ctx.lineTo(x + 7, groundY + treeH);
        ctx.lineTo(x - 7, groundY + treeH);
        ctx.fill();
      }
    },
    near(ctx, w, h) {
      // Floating island backdrop silhouettes with soft dangling roots
      ctx.fillStyle = '#293a5e';
      const islands = [
        { x: 120, y: h - 260, w: 180, d: 70 },
        { x: 480, y: h - 340, w: 220, d: 85 },
        { x: 860, y: h - 290, w: 190, d: 75 }
      ];
      islands.forEach(isl => {
        const sx = isl.x * (w / 1200);
        ctx.beginPath();
        ctx.ellipse(sx + isl.w / 2, isl.y, isl.w / 2, 16, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(sx, isl.y);
        ctx.lineTo(sx + isl.w, isl.y);
        ctx.lineTo(sx + isl.w * 0.75, isl.y + isl.d);
        ctx.lineTo(sx + isl.w * 0.25, isl.y + isl.d);
        ctx.closePath();
        ctx.fill();
      });
    },
    foliage(ctx, w, h) {
      // Near foliage silhouettes, overhanging branches with soft leaves
      ctx.fillStyle = '#1c2842';
      for (let x = 40; x < w; x += 180) {
        ctx.beginPath();
        ctx.arc(x, h - 200, 48, 0, Math.PI * 2);
        ctx.arc(x + 28, h - 220, 36, 0, Math.PI * 2);
        ctx.arc(x - 24, h - 210, 32, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },
  clouds(ctx, t, camX, camY) {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.055)';
    const puffs = [
      { x: 160, y: 70, r: 42, s: 8 },
      { x: 420, y: 110, r: 55, s: 12 },
      { x: 780, y: 85, r: 48, s: 10 },
      { x: 1100, y: 130, r: 60, s: 7 }
    ];
    puffs.forEach(p => {
      const cx = ((p.x + t * p.s - camX * 0.08) % 1300 + 1300) % 1300 - 100;
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
      // Rich cartoon dungeon/island soil
      ctx.fillStyle = '#7a4d2e';
      ctx.fillRect(px, py, TS, TS);
      // Darker pebble flecks
      ctx.fillStyle = '#5b3720';
      ctx.beginPath();
      ctx.ellipse(px + 8 + (h % 12), py + 10 + ((h >> 4) % 12), 3.5, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
      if (h % 3 === 0) {
        ctx.beginPath();
        ctx.ellipse(px + 20, py + 22, 2.5, 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // Shaded bottom seam if open below
      if (neighbors.bottom !== '#') {
        ctx.fillStyle = '#4d2e1a';
        ctx.fillRect(px, py + TS - 5, TS, 5);
        // Small dangling root snippet
        if (h % 2 === 0) {
          ctx.strokeStyle = '#3d2414';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(px + (h % 20) + 6, py + TS);
          ctx.quadraticCurveTo(px + (h % 20) + 4, py + TS + 6, px + (h % 20) + 7, py + TS + 10);
          ctx.stroke();
        }
      }
    },
    cap(ctx, px, py, TS, h, capped, neighbors) {
      if (capped) {
        // Soil underneath
        ctx.fillStyle = '#7a4d2e';
        ctx.fillRect(px, py, TS, TS);
        const lx = neighbors.left === '=' ? 0 : 4;
        const rx = neighbors.right === '=' ? 0 : 4;
        // Grass top band
        ctx.fillStyle = '#4fb83a';
        ctx.fillRect(px - lx, py, TS + lx + rx, 12);
        // Grass highlight
        ctx.fillStyle = '#86dc57';
        ctx.fillRect(px - lx, py, TS + lx + rx, 3.5);
        // Grass overhang tufts
        ctx.fillStyle = '#3c9a2c';
        for (let i = 0; i < 4; i++) {
          const tx = px + i * 8 + ((h >> (i * 2)) & 3);
          ctx.beginPath();
          ctx.moveTo(tx, py + 11);
          ctx.lineTo(tx + 5, py + 11);
          ctx.lineTo(tx + 2.5, py + 17);
          ctx.fill();
        }
      } else {
        // Thin wooden platform plank
        ctx.fillStyle = '#b9803e';
        ctx.fillRect(px, py, TS, 10);
        ctx.fillStyle = '#d9a35a';
        ctx.fillRect(px, py, TS, 3);
        ctx.fillStyle = '#6e4620';
        ctx.fillRect(px, py + 9, TS, 2);
        ctx.fillStyle = '#5a3818';
        ctx.fillRect(px + 3, py + 4, 2, 2);
        ctx.fillRect(px + TS - 5, py + 4, 2, 2);
      }
    },
    bridge(ctx, px, py, TS, h, sag) {
      // Handled dynamically per bridge in game.js / render.js
    },
    ladder(ctx, px, py, TS, h) {
      // Sturdy wooden ladder
      ctx.fillStyle = '#8a5a2b';
      ctx.fillRect(px + 6, py, 4, TS);
      ctx.fillRect(px + TS - 10, py, 4, TS);
      ctx.fillStyle = '#c28a4a';
      ctx.fillRect(px + 6, py, 1.5, TS);
      ctx.fillRect(px + TS - 10, py, 1.5, TS);
      ctx.fillStyle = '#a06f38';
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(px + 8, py + 4 + i * 11, TS - 16, 3.5);
      }
    },
    rope(ctx, px, py, TS, h, isEnd) {
      // Natural braided rope
      ctx.strokeStyle = '#b98b4d';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(px + TS / 2, py);
      ctx.quadraticCurveTo(px + TS / 2 + ((h % 5) - 2), py + TS / 2, px + TS / 2, py + TS);
      ctx.stroke();
      ctx.strokeStyle = '#8a6330';
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(px + 13, py + 6 + i * 10);
        ctx.lineTo(px + 19, py + 9 + i * 10);
        ctx.stroke();
      }
      if (isEnd) {
        ctx.fillStyle = '#9a6f33';
        ctx.beginPath();
        ctx.arc(px + TS / 2, py + TS - 2, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },
  palette: {
    accent: '#4fb83a',
    particle: '#86dc57'
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
