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
  const x = px + 4;
  const y = py;

  ctx.save();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#0f172a';

  if (tid === 'green_hills') {
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#1b1a14';

    if (type === 0) {
      // 1. Hanging lantern on carved wooden gallows post with warm amber halo
      // Warm glow halo behind lantern
      const glowGrad = ctx.createRadialGradient(x + 19, y - 18, 2, x + 19, y - 18, 16);
      glowGrad.addColorStop(0, 'rgba(254, 240, 138, 0.45)');
      glowGrad.addColorStop(0.5, 'rgba(249, 115, 22, 0.20)');
      glowGrad.addColorStop(1, 'rgba(249, 115, 22, 0)');
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(x + 19, y - 18, 16, 0, Math.PI * 2);
      ctx.fill();

      // Timber post: upright + diagonal brace + arm
      ctx.fillStyle = '#451a03';
      ctx.fillRect(x + 7, y - 28, 4, 28);
      ctx.strokeRect(x + 7, y - 28, 4, 28);
      // Arm
      ctx.fillRect(x + 7, y - 28, 14, 4);
      ctx.strokeRect(x + 7, y - 28, 14, 4);
      // Angle brace
      ctx.beginPath();
      ctx.moveTo(x + 7, y - 21);
      ctx.lineTo(x + 14, y - 24);
      ctx.stroke();
      // Rim highlight on post
      ctx.fillStyle = '#92400e';
      ctx.fillRect(x + 7, y - 28, 1.5, 28);
      ctx.fillRect(x + 7, y - 28, 14, 1.2);

      // Hanging lantern
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + 19, y - 24);
      ctx.lineTo(x + 19, y - 21);
      ctx.stroke();
      // Lantern cap
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.moveTo(x + 15, y - 21);
      ctx.lineTo(x + 19, y - 24);
      ctx.lineTo(x + 23, y - 21);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Glowing glass
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(x + 16, y - 21, 6, 8);
      ctx.strokeRect(x + 16, y - 21, 6, 8);
      ctx.fillStyle = '#fb923c';
      ctx.fillRect(x + 18, y - 18, 2, 4);
      // Base
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(x + 15, y - 13, 8, 2.5);
      ctx.strokeRect(x + 15, y - 13, 8, 2.5);
    } else if (type === 1) {
      // 2. Wooden lookout tea pavilion / shelter (planked walls, sloped shingle roof, bench)
      // Sloped shingled roof overhang
      ctx.fillStyle = '#3f200e';
      ctx.beginPath();
      ctx.moveTo(x - 2, y - 22);
      ctx.lineTo(x + 13, y - 31);
      ctx.lineTo(x + 28, y - 22);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Shingle ridges & warm sun highlight
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + 1, y - 24);
      ctx.lineTo(x + 13, y - 31);
      ctx.lineTo(x + 25, y - 24);
      ctx.stroke();
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x - 2, y - 22);
      ctx.lineTo(x + 13, y - 31);
      ctx.stroke();

      // Back plank wall
      ctx.fillStyle = '#78350f';
      ctx.fillRect(x + 2, y - 22, 22, 22);
      ctx.strokeRect(x + 2, y - 22, 22, 22);
      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 7, y - 22); ctx.lineTo(x + 7, y);
      ctx.moveTo(x + 13, y - 22); ctx.lineTo(x + 13, y);
      ctx.moveTo(x + 19, y - 22); ctx.lineTo(x + 19, y);
      ctx.stroke();

      // Sturdy upright corner timber posts
      ctx.fillStyle = '#451a03';
      ctx.strokeStyle = '#1b1a14';
      ctx.lineWidth = 1.5;
      ctx.fillRect(x + 1, y - 23, 4, 23);
      ctx.strokeRect(x + 1, y - 23, 4, 23);
      ctx.fillRect(x + 21, y - 23, 4, 23);
      ctx.strokeRect(x + 21, y - 23, 4, 23);

      // Wooden bench inside
      ctx.fillStyle = '#b45309';
      ctx.fillRect(x + 5, y - 8, 16, 4);
      ctx.strokeRect(x + 5, y - 8, 16, 4);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(x + 5, y - 8, 16, 1);

      // Tiny moss patch on roof
      ctx.fillStyle = '#84cc16';
      ctx.beginPath();
      ctx.ellipse(x + 6, y - 25, 4, 2.5, -0.4, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === 2) {
      // 3. Giant jungle fern & leaf fronds with cel shading
      const frond = (fx, fy, angle, len, colBase, colShad, colHi) => {
        ctx.save();
        ctx.translate(fx, fy);
        ctx.rotate(angle);
        ctx.fillStyle = colShad;
        ctx.strokeStyle = '#1b1a14';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(-4, -len * 0.5, 0, -len);
        ctx.quadraticCurveTo(5, -len * 0.5, 0, 0);
        ctx.fill();
        ctx.stroke();
        // Base & highlight
        ctx.fillStyle = colBase;
        ctx.beginPath();
        ctx.moveTo(-1, 0);
        ctx.quadraticCurveTo(-3, -len * 0.5, 0, -len);
        ctx.quadraticCurveTo(1, -len * 0.5, -1, 0);
        ctx.fill();
        ctx.fillStyle = colHi;
        ctx.fillRect(-0.8, -len * 0.8, 1.6, len * 0.5);
        ctx.restore();
      };

      frond(x + 13, y, -0.65, 22, '#059669', '#064e3b', '#6ee7b7');
      frond(x + 13, y, 0.55, 20, '#10b981', '#064e3b', '#6ee7b7');
      frond(x + 13, y, -0.25, 26, '#059669', '#064e3b', '#a7f3d0');
      frond(x + 13, y, 0.15, 24, '#10b981', '#065f46', '#6ee7b7');

      // Center fiddlehead curl & base moss
      ctx.strokeStyle = '#047857';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x + 13, y - 8, 3, 0, Math.PI * 1.5);
      ctx.stroke();
      ctx.fillStyle = '#15803d';
      ctx.beginPath();
      ctx.ellipse(x + 13, y - 2, 7, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === 3) {
      // 4. Hollow mossy fallen log with tree rings & mushrooms
      // Main log trunk
      ctx.fillStyle = '#3b1d0e';
      ctx.strokeStyle = '#1b1a14';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x + 2, y - 10, 22, 10, [3, 2, 2, 3]);
      ctx.fill();
      ctx.stroke();

      // Wood bark highlight & groove
      ctx.fillStyle = '#78350f';
      ctx.fillRect(x + 4, y - 9, 17, 3);
      ctx.fillStyle = '#271207';
      ctx.fillRect(x + 6, y - 5, 12, 1.5);

      // Hollow log end (cut face on right)
      ctx.fillStyle = '#92400e';
      ctx.beginPath();
      ctx.ellipse(x + 22, y - 5, 3, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Hollow center cavity
      ctx.fillStyle = '#1b1a14';
      ctx.beginPath();
      ctx.ellipse(x + 22, y - 5, 1.6, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Thick bright moss cap draped over log
      ctx.fillStyle = '#65a30d';
      ctx.beginPath();
      ctx.roundRect(x + 5, y - 12, 14, 4, 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#bef264';
      ctx.fillRect(x + 6, y - 12, 12, 1.2);

      // Tiny red bracket mushroom
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(x + 8, y - 4, 2.5, Math.PI, 0);
      ctx.fill();
    } else if (type === 4) {
      // 5. Ancient inscribed stone marker / cairn with golden rune
      // Base river rocks
      ctx.fillStyle = '#475569';
      ctx.strokeStyle = '#1b1a14';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(x + 8, y - 4, 6, 4, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 18, y - 4, 5, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Main weathered standing monolith
      ctx.fillStyle = '#64748b';
      ctx.strokeStyle = '#1b1a14';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 8, y - 4);
      ctx.lineTo(x + 9, y - 24);
      ctx.quadraticCurveTo(x + 13, y - 27, x + 17, y - 24);
      ctx.lineTo(x + 18, y - 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Cel shading & sunset rim
      ctx.fillStyle = '#334155';
      ctx.fillRect(x + 14, y - 23, 3.5, 19);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(x + 9, y - 24, 2, 20);

      // Glowing carved ancient spiral rune
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(x + 13, y - 15, 3.5, 0, Math.PI * 1.6);
      ctx.stroke();
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(x + 12.5, y - 15.5, 1.5, 1.5);

      // Moss creeping up stone base
      ctx.fillStyle = '#84cc16';
      ctx.fillRect(x + 8, y - 6, 4, 3);
    } else if (type === 5) {
      // 6. Flowering jungle bush with rose-coral blossom clusters
      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 13, y);
      ctx.quadraticCurveTo(x + 11, y - 10, x + 7, y - 18);
      ctx.moveTo(x + 13, y - 8);
      ctx.quadraticCurveTo(x + 16, y - 14, x + 20, y - 20);
      ctx.stroke();

      // Lush foliage rosettes
      const drawLeafCluster = (lx, ly, rad) => {
        ctx.fillStyle = '#166534';
        ctx.strokeStyle = '#1b1a14';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(lx, ly, rad, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.arc(lx - 1, ly - 1, rad * 0.7, 0, Math.PI * 2);
        ctx.fill();
      };
      drawLeafCluster(x + 7, y - 18, 7);
      drawLeafCluster(x + 19, y - 20, 6);
      drawLeafCluster(x + 13, y - 12, 6.5);

      // Rose-coral flowers with dark ink outlines
      const drawFlower = (fx, fy) => {
        ctx.fillStyle = '#f43f5e';
        ctx.strokeStyle = '#1b1a14';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(fx - 2, fy, 2.2, 0, Math.PI * 2);
        ctx.arc(fx + 2, fy, 2.2, 0, Math.PI * 2);
        ctx.arc(fx, fy - 2, 2.2, 0, Math.PI * 2);
        ctx.arc(fx, fy + 2, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(fx - 1, fy - 1, 2, 2);
      };
      drawFlower(x + 6, y - 21);
      drawFlower(x + 10, y - 15);
      drawFlower(x + 18, y - 22);
      drawFlower(x + 21, y - 16);
    } else if (type === 6) {
      // 7. Cluster of giant woodland toadstools with cel-shaded scarlet caps
      // Stems
      ctx.fillStyle = '#dcd0a8';
      ctx.strokeStyle = '#1b1a14';
      ctx.lineWidth = 1.5;
      ctx.fillRect(x + 9, y - 15, 6, 15);
      ctx.strokeRect(x + 9, y - 15, 6, 15);
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(x + 9, y - 15, 3, 15);

      // Smaller companion stem
      ctx.fillStyle = '#dcd0a8';
      ctx.fillRect(x + 18, y - 10, 4, 10);
      ctx.strokeRect(x + 18, y - 10, 4, 10);
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(x + 18, y - 10, 2, 10);

      // Big cap
      ctx.fillStyle = '#991b1b';
      ctx.strokeStyle = '#1b1a14';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x + 12, y - 15, 11, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.arc(x + 11, y - 16, 9.5, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#f87171';
      ctx.fillRect(x + 4, y - 21, 5, 2);

      // White spots on big cap
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x + 8, y - 21, 2.5, 0, Math.PI * 2);
      ctx.arc(x + 15, y - 19, 2, 0, Math.PI * 2);
      ctx.arc(x + 12, y - 24, 2, 0, Math.PI * 2);
      ctx.fill();

      // Small cap
      ctx.fillStyle = '#dc2626';
      ctx.strokeStyle = '#1b1a14';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x + 20, y - 10, 6.5, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x + 19, y - 13, 1.6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // 8. Rustic timber bench with stone supports & rim highlight
      // Cobblestone legs
      ctx.fillStyle = '#475569';
      ctx.strokeStyle = '#1b1a14';
      ctx.lineWidth = 1.5;
      ctx.fillRect(x + 5, y - 7, 5, 7);
      ctx.strokeRect(x + 5, y - 7, 5, 7);
      ctx.fillRect(x + 17, y - 7, 5, 7);
      ctx.strokeRect(x + 17, y - 7, 5, 7);

      // Thick timber plank seat
      ctx.fillStyle = '#3b1d0e';
      ctx.strokeStyle = '#1b1a14';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x + 2, y - 12, 23, 6, 2);
      ctx.fill();
      ctx.stroke();

      // Wood cel shading
      ctx.fillStyle = '#78350f';
      ctx.fillRect(x + 3, y - 11, 20, 2);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(x + 3, y - 12, 20, 1.2);

      // Backrest posts & rail
      ctx.fillStyle = '#451a03';
      ctx.fillRect(x + 5, y - 20, 3, 9);
      ctx.fillRect(x + 19, y - 20, 3, 9);
      ctx.fillStyle = '#78350f';
      ctx.fillRect(x + 3, y - 21, 21, 4);
      ctx.strokeRect(x + 3, y - 21, 21, 4);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(x + 3, y - 21, 21, 1);
    }
  } else if (tid === 'autumn_forest') {
    if (type === 0) {
      // Autumn carved totem post (height 27px)
      ctx.fillStyle = '#451a03';
      ctx.fillRect(x + 8, y - 26, 8, 26);
      ctx.strokeRect(x + 8, y - 26, 8, 26);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(x + 5, y - 22, 14, 8);
      ctx.strokeRect(x + 5, y - 22, 14, 8);
      ctx.fillStyle = '#ea580c';
      ctx.fillRect(x + 9, y - 18, 6, 3);
    } else if (type === 1) {
      // Golden harvest pumpkin (height 24px)
      ctx.fillStyle = '#ea580c';
      ctx.beginPath();
      ctx.ellipse(x + 12, y - 11, 11, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#15803d';
      ctx.fillRect(x + 10, y - 25, 4, 6);
    } else if (type === 2) {
      // Ancient hollow birch stump with glowing shelf fungi (height 25px)
      ctx.fillStyle = '#78350f';
      ctx.fillRect(x + 4, y - 22, 16, 22);
      ctx.strokeRect(x + 4, y - 22, 16, 22);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(x + 14, y - 16, 7, 4);
      ctx.fillRect(x + 1, y - 9, 6, 3);
    } else if (type === 3) {
      // Amber forest lantern (height 26px)
      ctx.fillStyle = '#451a03';
      ctx.fillRect(x + 10, y - 26, 4, 26);
      ctx.strokeRect(x + 10, y - 26, 4, 26);
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(x + 12, y - 18, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (type === 4) {
      // Large autumnal bush with amber berries (height 24px)
      ctx.fillStyle = '#a16207';
      ctx.beginPath();
      ctx.arc(x + 12, y - 12, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#f97316';
      ctx.fillRect(x + 7, y - 16, 3, 3);
      ctx.fillRect(x + 14, y - 14, 3, 3);
    } else if (type === 5) {
      // Autumn road shrine (height 26px)
      ctx.fillStyle = '#57534e';
      ctx.fillRect(x + 6, y - 24, 12, 24);
      ctx.strokeRect(x + 6, y - 24, 12, 24);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(x + 8, y - 18, 8, 8);
    } else if (type === 6) {
      // Rustling maple leaf mound (height 24px)
      ctx.fillStyle = '#c2410c';
      ctx.beginPath();
      ctx.ellipse(x + 12, y - 9, 12, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#facc15';
      ctx.fillRect(x + 8, y - 18, 8, 5);
    } else {
      // Forest trail blaze banner (height 27px)
      ctx.fillStyle = '#451a03';
      ctx.fillRect(x + 10, y - 27, 4, 27);
      ctx.strokeRect(x + 10, y - 27, 4, 27);
      ctx.fillStyle = '#b91c1c';
      ctx.beginPath();
      ctx.moveTo(x + 14, y - 25);
      ctx.lineTo(x + 24, y - 19);
      ctx.lineTo(x + 14, y - 13);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  } else if (tid === 'desert_ruins') {
    if (type === 0) {
      // Large terracotta amphora urn (height 26px)
      ctx.fillStyle = '#c2410c';
      ctx.beginPath();
      ctx.roundRect(x + 5, y - 24, 14, 24, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ea580c';
      ctx.fillRect(x + 3, y - 20, 18, 3);
    } else if (type === 1) {
      // Giant saguaro desert cactus (height 28px)
      ctx.fillStyle = '#15803d';
      ctx.fillRect(x + 9, y - 28, 6, 28);
      ctx.strokeRect(x + 9, y - 28, 6, 28);
      ctx.fillRect(x + 3, y - 22, 6, 5);
      ctx.fillRect(x + 3, y - 22, 4, 10);
      ctx.fillRect(x + 15, y - 17, 6, 5);
      ctx.fillRect(x + 17, y - 17, 4, 9);
      ctx.fillStyle = '#f43f5e';
      ctx.fillRect(x + 10, y - 31, 4, 4);
    } else if (type === 2) {
      // Ancient hieroglyphic sandstone tablet (height 25px)
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(x + 5, y - 24, 14, 24);
      ctx.strokeRect(x + 5, y - 24, 14, 24);
      ctx.fillStyle = '#78350f';
      ctx.fillRect(x + 7, y - 20, 10, 2);
      ctx.fillRect(x + 7, y - 15, 10, 2);
      ctx.fillRect(x + 7, y - 10, 10, 2);
    } else if (type === 3) {
      // Desert stone sun-dial pillar (height 26px)
      ctx.fillStyle = '#d97706';
      ctx.fillRect(x + 8, y - 24, 8, 24);
      ctx.strokeRect(x + 8, y - 24, 8, 24);
      ctx.fillStyle = '#b45309';
      ctx.fillRect(x + 4, y - 27, 16, 5);
      ctx.strokeRect(x + 4, y - 27, 16, 5);
    } else if (type === 4) {
      // Sandstone pyramid obelisk (height 27px)
      ctx.fillStyle = '#b45309';
      ctx.beginPath();
      ctx.moveTo(x + 12, y - 27);
      ctx.lineTo(x + 22, y);
      ctx.lineTo(x + 2, y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (type === 5) {
      // Ancient desert skull fossil (height 24px)
      ctx.fillStyle = '#fef3c7';
      ctx.beginPath();
      ctx.arc(x + 12, y - 14, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#1c1917';
      ctx.fillRect(x + 8, y - 16, 3, 3);
      ctx.fillRect(x + 13, y - 16, 3, 3);
    } else if (type === 6) {
      // Weathered desert chest urn (height 24px)
      ctx.fillStyle = '#92400e';
      ctx.fillRect(x + 4, y - 22, 16, 22);
      ctx.strokeRect(x + 4, y - 22, 16, 22);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(x + 9, y - 14, 6, 4);
    } else {
      // Desert nomad flag beacon (height 28px)
      ctx.fillStyle = '#78350f';
      ctx.fillRect(x + 10, y - 28, 4, 28);
      ctx.strokeRect(x + 10, y - 28, 4, 28);
      ctx.fillStyle = '#ea580c';
      ctx.fillRect(x + 14, y - 26, 10, 8);
      ctx.strokeRect(x + 14, y - 26, 10, 8);
    }
  } else if (tid === 'frozen_peaks') {
    // Frost crystal spire, ice lanterns, frozen cairns (height >= 24px)
    if (type % 2 === 0) {
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(x + 12, y - 28);
      ctx.lineTo(x + 20, y);
      ctx.lineTo(x + 4, y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#e0f2fe';
      ctx.fillRect(x + 10, y - 22, 4, 12);
    } else {
      ctx.fillStyle = '#64748b';
      ctx.fillRect(x + 6, y - 24, 12, 24);
      ctx.strokeRect(x + 6, y - 24, 12, 24);
      ctx.fillStyle = '#bae6fd';
      ctx.fillRect(x + 4, y - 27, 16, 5);
      ctx.strokeRect(x + 4, y - 27, 16, 5);
    }
  } else if (tid === 'crystal_caves') {
    // Glowing crystal clusters (height >= 24px)
    ctx.fillStyle = type % 2 === 0 ? '#c084fc' : '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(x + 12, y - 27);
    ctx.lineTo(x + 21, y);
    ctx.lineTo(x + 3, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f5d0fe';
    ctx.fillRect(x + 10, y - 20, 4, 10);
  } else if (tid === 'volcano_fortress') {
    // Obsidian obelisk & magma braziers (height >= 24px)
    ctx.fillStyle = '#1e1b4b';
    ctx.fillRect(x + 6, y - 26, 12, 26);
    ctx.strokeRect(x + 6, y - 26, 12, 26);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(x + 8, y - 18, 8, 8);
  } else {
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(x + 12, y - 24);
    ctx.lineTo(x + 20, y);
    ctx.lineTo(x + 4, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawAncientOakBackground(ctx, world) {
  const hollowLeft = 19 * TS;
  const hollowRight = 27 * TS;
  const hollowWidth = hollowRight - hollowLeft;
  const topY = 8 * TS;
  const botY = 41 * TS;

  ctx.save();
  // 1. Dark hollow interior heartwood
  const grad = ctx.createLinearGradient(hollowLeft, 0, hollowRight, 0);
  grad.addColorStop(0, '#150904');
  grad.addColorStop(0.18, '#261108');
  grad.addColorStop(0.5, '#33170b');
  grad.addColorStop(0.82, '#261108');
  grad.addColorStop(1, '#150904');
  ctx.fillStyle = grad;
  ctx.fillRect(hollowLeft, topY, hollowWidth, botY - topY);

  // Subtle interior vertical heartwood grain
  ctx.strokeStyle = '#1a0b05';
  ctx.lineWidth = 2;
  for (let gx = hollowLeft + 12; gx < hollowRight; gx += 18) {
    ctx.beginPath();
    ctx.moveTo(gx, topY);
    for (let gy = topY; gy < botY; gy += 48) {
      ctx.quadraticCurveTo(gx + Math.sin(gy * 0.04) * 8, gy + 24, gx, gy + 48);
    }
    ctx.stroke();
  }

  // 2. Knot-hole windows (rows 15, 21, 27, 33, 38)
  const windowRows = [15, 21, 27, 33, 38];
  windowRows.forEach((r, idx) => {
    const cx = hollowLeft + hollowWidth * (idx % 2 === 0 ? 0.38 : 0.62);
    const cy = r * TS + 16;
    const rx = 24, ry = 34;

    // Outer bark ridge around knot
    ctx.fillStyle = '#100502';
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx + 12, ry + 12, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#3d1a0b';
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx + 6, ry + 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Inner window opening (golden sky + mountain silhouette)
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.clip();

    // Autumn sky inside window
    const skyGrad = ctx.createLinearGradient(0, cy - ry, 0, cy + ry);
    skyGrad.addColorStop(0, '#78350f');
    skyGrad.addColorStop(0.5, '#c2410c');
    skyGrad.addColorStop(1, '#fbbf24');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);

    // Distant mountain & pine silhouette through window
    ctx.fillStyle = '#3a1306';
    ctx.beginPath();
    ctx.moveTo(cx - rx, cy + ry);
    ctx.lineTo(cx - 6, cy + 6);
    ctx.lineTo(cx + 8, cy + 14);
    ctx.lineTo(cx + rx, cy + ry);
    ctx.fill();

    // Distant pine tree
    ctx.fillStyle = '#220802';
    ctx.fillRect(cx - 2, cy - 2, 4, 18);
    ctx.beginPath();
    ctx.moveTo(cx, cy - 10);
    ctx.lineTo(cx + 8, cy + 4);
    ctx.lineTo(cx - 8, cy + 4);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    // Concentric knot rings on bark
    ctx.strokeStyle = '#220b04';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx + 3, ry + 3, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Warm sunbeam streaming into hollow chamber
    ctx.fillStyle = 'rgba(254, 240, 138, 0.08)';
    ctx.beginPath();
    ctx.moveTo(cx - 12, cy);
    ctx.lineTo(cx + 12, cy);
    ctx.lineTo(cx + 140, cy + 150);
    ctx.lineTo(cx + 50, cy + 160);
    ctx.closePath();
    ctx.fill();
  });

  ctx.restore();
}

function drawAncientOakCrown(ctx, world) {
  ctx.save();
  const crownBaseY = 7 * TS;
  const leafColors = ['#451a03', '#78350f', '#9a3412', '#c2410c', '#d97706', '#ea580c', '#f59e0b', '#fbbf24'];

  // Arching branch boughs supporting the crown
  ctx.strokeStyle = '#321408';
  ctx.lineWidth = 22;
  ctx.beginPath();
  ctx.moveTo(19 * TS, 9 * TS);
  ctx.quadraticCurveTo(14 * TS, 8 * TS, 10 * TS, 7 * TS);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(27 * TS, 9 * TS);
  ctx.quadraticCurveTo(32 * TS, 8 * TS, 38 * TS, 7 * TS);
  ctx.stroke();

  // Multi-layered organic oak leaf canopy clusters
  for (let c = 8; c <= 40; c += 1.8) {
    const cx = c * TS;
    const curve = Math.sin((c - 8) / 32 * Math.PI) * 45;
    const cy = crownBaseY - 60 - curve;

    for (let i = 0; i < 5; i++) {
      const colIdx = (Math.floor(c * 3 + i * 2) % (leafColors.length - 2)) + 2;
      ctx.fillStyle = leafColors[colIdx];
      ctx.strokeStyle = '#230a04';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const lx = cx + (i - 2) * 16;
      const ly = cy + (i % 2 === 0 ? -12 : 8) + Math.cos(c * 2) * 8;
      ctx.arc(lx, ly, 22 + (i % 3) * 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = 'rgba(254, 240, 138, 0.22)';
      ctx.beginPath();
      ctx.arc(lx - 4, ly - 4, 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Hanging acorns with caps
  const acornCols = [12, 16, 20, 24, 28, 32, 36];
  acornCols.forEach(ac => {
    const ax = ac * TS + 16;
    const ay = crownBaseY - 20;

    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ax, ay - 14);
    ctx.lineTo(ax, ay);
    ctx.stroke();

    ctx.fillStyle = '#5c2c16';
    ctx.beginPath();
    ctx.arc(ax, ay, 7, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = '#1f0d05';
    ctx.stroke();

    ctx.fillStyle = '#b45309';
    ctx.beginPath();
    ctx.ellipse(ax, ay + 7, 6, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#451a03';
    ctx.fillRect(ax - 1, ay + 15, 2, 3);
  });

  ctx.restore();
}

export function bakeTerrain(world, theme = getTheme('green_hills')) {
  const cv = document.createElement('canvas');
  cv.width = world.w;
  cv.height = world.h;
  const x = cv.getContext('2d');
  const isAncientOak = world.levelId === '2-3' || world.name === 'Ancient Oak';

  if (isAncientOak) {
    drawAncientOakBackground(x, world);
  }

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

      if (isAncientOak && r < 41) {
        const isTrunk = (c >= 17 && c <= 20) || (c >= 26 && c <= 29);
        if (isTrunk) {
          x.fillStyle = '#2c1207';
          x.fillRect(px, py, TS, TS);
          x.fillStyle = (h % 2 === 0) ? '#3d1a0c' : '#451e0e';
          x.fillRect(px + 4, py, TS - 8, TS);
          x.strokeStyle = '#1b0903';
          x.lineWidth = 2;
          x.beginPath();
          x.moveTo(px + (h % 10) + 6, py);
          x.lineTo(px + (h % 10) + 8, py + TS);
          x.moveTo(px + (h % 10) + 18, py);
          x.lineTo(px + (h % 10) + 16, py + TS);
          x.stroke();
          if ((h % 4) === 0) {
            x.fillStyle = '#4d7c0f';
            x.beginPath();
            x.ellipse(px + 14, py + 16, 6, 4, 0.4, 0, Math.PI * 2);
            x.fill();
          }
          if (ch === '=') {
            x.fillStyle = '#854d24';
            x.fillRect(px, py, TS, 4);
          }
          continue;
        } else if (r > 7) {
          x.fillStyle = '#3a1809';
          x.beginPath();
          x.roundRect(px, py + 4, TS, TS - 6, [4, 4, 8, 8]);
          x.fill();
          x.fillStyle = '#5c2710';
          x.fillRect(px, py + 2, TS, 6);
          if (ch === '=') {
            x.fillStyle = '#d97706';
            x.fillRect(px, py, TS, 4);
            x.fillStyle = '#ea580c';
            for (let i = 0; i < 3; i++) {
              x.beginPath();
              x.arc(px + 6 + i * 10, py + 12, 4.5, 0, Math.PI * 2);
              x.fill();
            }
          }
          continue;
        }
      }

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

  if (isAncientOak) {
    drawAncientOakCrown(x, world);
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
      else if (e.isBoss) this.drawBoss(ctx, e, g.player);

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
        // Cel-shaded wooden crate with inked outline
        ctx.strokeStyle = '#1b1a14';
        ctx.lineWidth = 2.0;
        ctx.fillStyle = '#b45309'; // base
        ctx.beginPath();
        ctx.roundRect(x + 1, y + 1, TS - 2, TS - 2, 3);
        ctx.fill();
        ctx.stroke();

        // 3-tone shading: top-left rim highlight & bottom-right shadow
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(x + 2, y + 2, TS - 4, 2);
        ctx.fillRect(x + 2, y + 2, 2, TS - 4);
        ctx.fillStyle = '#78350f';
        ctx.fillRect(x + 2, y + TS - 4, TS - 4, 2);
        ctx.fillRect(x + TS - 4, y + 2, 2, TS - 4);

        // Cross braces with dark outline
        ctx.strokeStyle = '#451a03';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(x + 4, y + 4); ctx.lineTo(x + TS - 4, y + TS - 4);
        ctx.moveTo(x + TS - 4, y + 4); ctx.lineTo(x + 4, y + TS - 4);
        ctx.stroke();

        // Iron corner rivets
        ctx.fillStyle = '#334155';
        ctx.fillRect(x + 3, y + 3, 2, 2);
        ctx.fillRect(x + TS - 5, y + 3, 2, 2);
        ctx.fillRect(x + 3, y + TS - 5, 2, 2);
        ctx.fillRect(x + TS - 5, y + TS - 5, 2, 2);
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
    // Warm glow halo + small sparkle
    const glowCv = getCachedGlow('rgba(251, 191, 36, 0.55)', 16);
    if (glowCv) ctx.drawImage(glowCv, cx - 16, cy - 16);

    // Inked outline & 3-tone cel-shaded coin
    ctx.strokeStyle = '#1b1a14';
    ctx.lineWidth = 1.3;
    ctx.fillStyle = '#b45309'; // shadow
    ctx.beginPath(); ctx.ellipse(cx, cy, 7.5 * sx, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f59e0b'; // base
    ctx.beginPath(); ctx.ellipse(cx, cy, 6.5 * sx, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fef08a'; // highlight
    ctx.fillRect(cx - 1.2 * sx, cy - 3.5, 2.4 * sx, 7);

    // Rotating sparkle cross
    const spAlpha = Math.max(0, Math.sin(c.phase * 3));
    if (spAlpha > 0.45) {
      ctx.fillStyle = `rgba(255, 255, 255, ${spAlpha})`;
      ctx.fillRect(cx + 2 * sx, cy - 5, 1.5, 5);
      ctx.fillRect(cx + 2 * sx - 1.7, cy - 3.2, 5, 1.5);
    }
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
    // Warm glow halo + small rotating sparkle
    const glowCv = getCachedGlow('rgba(251, 191, 36, 0.7)', 28);
    if (glowCv) ctx.drawImage(glowCv, cx - 28, cy - 28);
    ctx.strokeStyle = '#1b1a14';
    ctx.lineWidth = 1.8;

    // Bow ring with cel shading
    ctx.fillStyle = '#b45309';
    ctx.beginPath(); ctx.arc(cx, cy - 6, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath(); ctx.arc(cx, cy - 6, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fef08a';
    ctx.beginPath(); ctx.arc(cx - 1, cy - 7, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1e293b';
    ctx.beginPath(); ctx.arc(cx, cy - 6, 2.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // Key stem with teeth
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(cx - 2, cy - 1, 4, 13);
    ctx.strokeRect(cx - 2, cy - 1, 4, 13);
    ctx.fillRect(cx + 2, cy + 5, 4.5, 2.5);
    ctx.strokeRect(cx + 2, cy + 5, 4.5, 2.5);
    ctx.fillRect(cx + 2, cy + 9, 3.5, 2.5);
    ctx.strokeRect(cx + 2, cy + 9, 3.5, 2.5);
    // Highlight rim
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(cx - 2, cy - 1, 1.5, 13);

    // Rotating sparkle cross
    const sp = Math.sin(this.t * 4);
    if (sp > 0.25) {
      ctx.fillStyle = `rgba(255, 255, 255, ${sp})`;
      ctx.fillRect(cx - 4, cy - 10, 1.5, 6);
      ctx.fillRect(cx - 6.2, cy - 7.7, 6, 1.5);
    }
  }

  drawGate(ctx, gt) {
    if (!gt) return;
    const x = gt.x, y = gt.y, w = gt.w, h = gt.h;
    // Hand-painted cartoon cave entrance with thick dark outline and chunky moss cap
    ctx.strokeStyle = '#1b1a14';
    ctx.lineWidth = 2.5;

    // Rocky mound body
    ctx.fillStyle = '#342b1f';
    ctx.beginPath();
    ctx.moveTo(x - 14, y + h); ctx.lineTo(x - 6, y + 26); ctx.lineTo(x + 16, y + 4);
    ctx.lineTo(x + w / 2, y - 12); ctx.lineTo(x + w - 14, y + 6); ctx.lineTo(x + w + 6, y + 28);
    ctx.lineTo(x + w + 14, y + h); ctx.closePath(); ctx.fill(); ctx.stroke();

    // Rock cel shading highlight & shadow
    ctx.fillStyle = '#4a3d2c';
    ctx.beginPath();
    ctx.moveTo(x + 10, y + 18); ctx.lineTo(x + w / 2, y - 10); ctx.lineTo(x + w / 2 + 6, y + 12); ctx.lineTo(x + 18, y + 34);
    ctx.fill();

    // Lush moss cap draped on gate top
    ctx.fillStyle = '#65a30d';
    ctx.beginPath();
    ctx.roundRect(x + w / 2 - 20, y - 14, 40, 8, [4, 4, 2, 2]);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#bef264';
    ctx.fillRect(x + w / 2 - 18, y - 14, 36, 2);

    // Cave opening
    const ox = x + 10, oy = y + 30, ow = w - 20, oh = h - 30;
    ctx.fillStyle = gt.state === 'closed' ? '#14110f' : '#ffe9a0';
    ctx.beginPath();
    ctx.moveTo(ox, oy + oh); ctx.lineTo(ox, oy + 12);
    ctx.quadraticCurveTo(ox + ow / 2, oy - 8, ox + ow, oy + 12);
    ctx.lineTo(ox + ow, oy + oh);
    ctx.fill();
    ctx.stroke();

    // Portcullis
    ctx.save();
    ctx.beginPath(); ctx.rect(ox, oy - 4, ow, oh + 4); ctx.clip();
    const lift = gt.lift * (oh + 6);
    ctx.fillStyle = '#78350f';
    ctx.strokeStyle = '#1b1a14';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) {
      const bx = ox + 3 + i * (ow - 8) / 4;
      ctx.fillRect(bx, oy - lift, 3, oh + 4);
      ctx.strokeRect(bx, oy - lift, 3, oh + 4);
    }
    for (let j = 0; j < 4; j++) {
      const by = oy + 8 + j * 9 - lift;
      ctx.fillRect(ox, by, ow, 3);
      ctx.strokeRect(ox, by, ow, 3);
    }
    ctx.restore();

    // Red banner flag atop gate
    const fx = x + w / 2, fy = y - 12;
    ctx.fillStyle = '#451a03'; ctx.fillRect(fx - 1.5, fy - 30, 3, 32);
    ctx.strokeStyle = '#1b1a14'; ctx.strokeRect(fx - 1.5, fy - 30, 3, 32);
    const wave = Math.sin(gt.t * (gt.state === 'closed' ? 3 : 8)) * 3.5;
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.moveTo(fx + 1.5, fy - 30);
    ctx.quadraticCurveTo(fx + 12, fy - 28 + wave, fx + 24, fy - 24 + wave * 0.5);
    ctx.quadraticCurveTo(fx + 12, fy - 20 - wave, fx + 1.5, fy - 18);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Flag highlight
    ctx.fillStyle = '#f87171';
    ctx.fillRect(fx + 2, fy - 29, 6, 2);
  }

  drawMushroom(ctx, e) {
    const cx = e.x + e.w / 2, by = e.y + e.h;
    const bob = Math.abs(Math.sin(e.walkPhase)) * 2;

    // Soft contact shadow (dark ellipse, 25% alpha)
    ctx.save();
    ctx.translate(cx, by);
    ctx.fillStyle = 'rgba(27, 26, 20, 0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 11, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(cx, by - bob);
    ctx.scale(e.dir < 0 ? 1 : -1, 1);
    ctx.strokeStyle = '#1b1a14';
    ctx.lineWidth = 2.0;

    // Stem with cel shading
    ctx.fillStyle = e.flash > 0 ? '#fff' : '#fef3c7';
    ctx.beginPath(); ctx.roundRect(-7, -14, 14, 14, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#dcd0a8';
    ctx.fillRect(-7, -14, 4, 14);

    // Feet
    ctx.fillStyle = '#451a03';
    const f = Math.sin(e.walkPhase) * 3;
    ctx.fillRect(-8 + f, -3, 6, 3); ctx.fillRect(2 - f, -3, 6, 3);

    // Cap with 3-tone cel shading & outline
    ctx.fillStyle = e.flash > 0 ? '#fff' : '#991b1b'; // shadow
    ctx.beginPath();
    ctx.moveTo(-14, -12);
    ctx.quadraticCurveTo(-14, -30, 0, -30);
    ctx.quadraticCurveTo(14, -30, 14, -12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = e.flash > 0 ? '#fff' : '#dc2626'; // base
    ctx.beginPath();
    ctx.moveTo(-12, -13);
    ctx.quadraticCurveTo(-12, -28, 0, -28);
    ctx.quadraticCurveTo(12, -28, 12, -13);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#f87171'; // highlight rim
    ctx.fillRect(-8, -26, 6, 2);

    // Cream spots
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(-6, -22, 2.6, 0, Math.PI * 2); ctx.arc(5, -24, 2.2, 0, Math.PI * 2); ctx.arc(8, -17, 1.8, 0, Math.PI * 2); ctx.fill();

    // Eyes
    ctx.fillStyle = '#1b1a14';
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

  drawDamageCracks(ctx, x, y, hp, maxHp = 3, color = '#fbbf24') {
    if (hp >= maxHp) return;
    ctx.save();
    ctx.strokeStyle = hp === 1 ? color : '#1e293b';
    ctx.lineWidth = hp === 1 ? 2.5 : 1.5;
    if (hp === 1) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
    }
    ctx.beginPath();
    // Primary crack
    ctx.moveTo(x - 14, y - 18);
    ctx.lineTo(x - 4, y - 4);
    ctx.lineTo(x + 4, y + 12);
    // Branch crack
    ctx.moveTo(x - 4, y - 4);
    ctx.lineTo(x + 14, y - 10);
    if (hp === 1) {
      // Secondary glowing fracture
      ctx.moveTo(x + 8, y + 6);
      ctx.lineTo(x + 20, y + 18);
      ctx.moveTo(x - 8, y + 6);
      ctx.lineTo(x - 18, y + 20);
    }
    ctx.stroke();
    ctx.restore();
  }

  drawMushroomKing(ctx, b, p) {
    const cx = b.x + b.w / 2, by = b.y + b.h;
    const t = this.t;
    const breath = Math.sin(t * 3.5) * 0.03;
    const isTelegraph = b.state === 'telegraph';
    const isJump = b.state === 'jump';

    ctx.save();
    ctx.translate(cx, by);
    ctx.scale(b.dir > 0 ? 1 : -1, b.squash * (1 + breath));

    // 1. Royal Velvet Cape (billowing in wind behind the king)
    ctx.save();
    const capeFlutter = Math.sin(t * 5) * 8;
    ctx.fillStyle = '#6b21a8';
    ctx.strokeStyle = '#3b0764';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-16, -90);
    ctx.quadraticCurveTo(-45 + capeFlutter * 0.5, -60, -52 + capeFlutter, -10);
    ctx.lineTo(-24, -10);
    ctx.lineTo(-12, -70);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Ermine Gold Trim
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(-52 + capeFlutter, -14, 28, 4);
    ctx.restore();

    // 2. King's Stalk / Robes (outlined, shaded)
    ctx.save();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#0f172a';
    ctx.fillStyle = b.flash > 0 ? '#ffffff' : (isTelegraph ? '#fed7aa' : '#fef3c7');
    ctx.beginPath();
    ctx.roundRect(-24, -80, 48, 80, 14);
    ctx.fill();
    ctx.stroke();
    // Shading on stalk
    ctx.fillStyle = '#e2d4a8';
    ctx.fillRect(-24, -50, 14, 48);

    // Royal Crimson Sash across chest
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.moveTo(-24, -68); ctx.lineTo(24, -40); ctx.lineTo(24, -28); ctx.lineTo(-24, -56);
    ctx.closePath();
    ctx.fill();
    // Golden Medallion
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(0, -50, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // 3. Golden Sceptre with glowing Ruby
    ctx.save();
    const sceptreAngle = isTelegraph ? -0.4 : 0.15;
    ctx.translate(28, -50);
    ctx.rotate(sceptreAngle);
    // Gold shaft
    ctx.fillStyle = '#eab308';
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 2;
    ctx.fillRect(-3, -38, 6, 68);
    ctx.strokeRect(-3, -38, 6, 68);
    // Ornate finial crown
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.moveTo(-10, -38); ctx.lineTo(10, -38); ctx.lineTo(0, -48);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Ruby Orb
    ctx.fillStyle = '#ef4444';
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = isTelegraph ? 14 : 6;
    ctx.beginPath();
    ctx.arc(0, -42, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();

    // 4. Colossal Spotted Cap (3–4x scale)
    ctx.save();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#0f172a';
    ctx.fillStyle = b.flash > 0 ? '#ffffff' : (isTelegraph ? '#ea580c' : '#dc2626');
    ctx.beginPath();
    ctx.moveTo(-44, -75);
    ctx.quadraticCurveTo(-48, -120, 0, -120);
    ctx.quadraticCurveTo(48, -120, 44, -75);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Cap underside rim shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.beginPath();
    ctx.ellipse(0, -76, 42, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ivory Spots with drop shadow
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-22, -98, 7, 0, Math.PI * 2);
    ctx.arc(18, -104, 6.5, 0, Math.PI * 2);
    ctx.arc(28, -88, 5.5, 0, Math.PI * 2);
    ctx.arc(-4, -84, 6, 0, Math.PI * 2);
    ctx.arc(-32, -85, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 5. Golden Royal Crown on top of cap
    ctx.save();
    ctx.fillStyle = '#fbbf24';
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-20, -118);
    ctx.lineTo(-16, -134);
    ctx.lineTo(-8, -124);
    ctx.lineTo(0, -138);
    ctx.lineTo(8, -124);
    ctx.lineTo(16, -134);
    ctx.lineTo(20, -118);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Crown jewels
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(-2, -128, 4, 4);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-12, -126, 3, 3);
    ctx.fillRect(9, -126, 3, 3);
    ctx.restore();

    // 6. Eyes that track the hero
    const targetX = p ? p.cx : b.x;
    const targetY = p ? p.cy : b.y;
    const eyeWorldX = cx;
    const eyeWorldY = by - 58;
    const dx = targetX - eyeWorldX;
    const dy = targetY - eyeWorldY;
    const dist = Math.hypot(dx, dy) || 1;
    const lookX = (dx / dist) * 3.5 * (b.dir > 0 ? 1 : -1);
    const lookY = (dy / dist) * 3.0;

    // Eye sockets
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.8;
    // Left eye
    ctx.beginPath();
    ctx.ellipse(-12, -58, 6, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Right eye
    ctx.beginPath();
    ctx.ellipse(12, -58, 6, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Tracking Pupils
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(-12 + lookX, -58 + lookY, 3, 0, Math.PI * 2);
    ctx.arc(12 + lookX, -58 + lookY, 3, 0, Math.PI * 2);
    ctx.fill();

    // Royal Mustache
    ctx.fillStyle = '#451a03';
    ctx.beginPath();
    ctx.moveTo(0, -48);
    ctx.quadraticCurveTo(-14, -44, -18, -48);
    ctx.quadraticCurveTo(-8, -40, 0, -46);
    ctx.quadraticCurveTo(8, -40, 18, -48);
    ctx.quadraticCurveTo(14, -44, 0, -48);
    ctx.fill();

    // 7. Damage Cracks per Phase
    this.drawDamageCracks(ctx, 0, -96, b.hp, b.maxHp, '#fef08a');

    ctx.restore();
  }

  drawOldOak(ctx, b, p) {
    const cx = b.x + b.w / 2, by = b.y + b.h;
    const t = this.t;
    const breath = Math.sin(t * 2.2) * 0.025;
    const isTelegraph = b.state === 'swing_telegraph';
    const isHurt = b.state === 'hurt';

    ctx.save();
    ctx.translate(cx, by);
    ctx.scale(b.dir > 0 ? 1 : -1, 1 + breath);

    // 1. Root feet gripping terrain
    ctx.fillStyle = '#291809';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-32, 0); ctx.lineTo(-44, 0); ctx.lineTo(-24, -16);
    ctx.moveTo(32, 0); ctx.lineTo(44, 0); ctx.lineTo(24, -16);
    ctx.stroke();

    // 2. Massive Ancient Oak Trunk Torso (3–4x hero height)
    ctx.fillStyle = b.flash > 0 ? '#ffffff' : (isHurt ? '#78350f' : '#451a03');
    ctx.beginPath();
    ctx.roundRect(-34, -110, 68, 110, 18);
    ctx.fill();
    ctx.stroke();

    // Bark woodgrain plates & contours
    ctx.fillStyle = '#5c2406';
    ctx.fillRect(-28, -95, 14, 75);
    ctx.fillRect(14, -85, 14, 65);
    ctx.strokeStyle = '#291809';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-16, -95); ctx.lineTo(-12, -40); ctx.lineTo(-16, -10);
    ctx.moveTo(16, -85); ctx.lineTo(12, -35); ctx.lineTo(16, -10);
    ctx.stroke();

    // 3. Powerful Gnarled Branch Arms
    const armLift = isTelegraph ? -25 : 0;
    ctx.fillStyle = '#78350f';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    // Left arm
    ctx.beginPath();
    ctx.moveTo(-34, -85);
    ctx.quadraticCurveTo(-55, -80 + armLift, -50, -45 + armLift);
    ctx.lineTo(-40, -45 + armLift);
    ctx.quadraticCurveTo(-44, -72 + armLift, -34, -75);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Right arm
    ctx.beginPath();
    ctx.moveTo(34, -85);
    ctx.quadraticCurveTo(55, -80 + armLift, 50, -45 + armLift);
    ctx.lineTo(40, -45 + armLift);
    ctx.quadraticCurveTo(44, -72 + armLift, 34, -75);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 4. Carved Bark Face & Furrowed Brow
    ctx.fillStyle = '#291809';
    ctx.beginPath();
    ctx.roundRect(-18, -98, 36, 12, 4);
    ctx.fill();

    // 5. Glowing Eyes that track the hero
    const targetX = p ? p.cx : b.x;
    const targetY = p ? p.cy : b.y;
    const eyeWorldX = cx;
    const eyeWorldY = by - 86;
    const dx = targetX - eyeWorldX;
    const dy = targetY - eyeWorldY;
    const dist = Math.hypot(dx, dy) || 1;
    const lookX = (dx / dist) * 3.2 * (b.dir > 0 ? 1 : -1);
    const lookY = (dy / dist) * 2.8;

    // Deep eye sockets
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-14, -90, 8, 8);
    ctx.fillRect(6, -90, 8, 8);
    // Glowing amber eyes
    ctx.fillStyle = '#fbbf24';
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(-10 + lookX, -86 + lookY, 3.2, 0, Math.PI * 2);
    ctx.arc(10 + lookX, -86 + lookY, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 6. Hollow Heartwood Core (Weak Spot)
    ctx.fillStyle = b.vulnerable ? '#facc15' : '#1c1917';
    ctx.beginPath();
    ctx.ellipse(0, -44, 14, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    if (b.vulnerable) {
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#facc15';
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // 7. Leafy Canopy Crown (autumn colors)
    ctx.fillStyle = '#ea580c';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, -118, 30, 0, Math.PI * 2);
    ctx.arc(-24, -108, 20, 0, Math.PI * 2);
    ctx.arc(24, -108, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Inner foliage golden highlights
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(-10, -122, 16, 0, Math.PI * 2);
    ctx.arc(12, -120, 14, 0, Math.PI * 2);
    ctx.fill();

    // 8. Dynamic Falling Autumn Leaves
    for (let i = 0; i < 4; i++) {
      const leafT = (t * 1.6 + i * 0.75) % 3.0;
      const lx = -36 + i * 24 + Math.sin(t * 3.5 + i) * 14;
      const ly = -118 + leafT * 44;
      ctx.fillStyle = i % 2 === 0 ? '#ea580c' : '#f59e0b';
      ctx.beginPath();
      ctx.ellipse(lx, ly, 5, 2.8, leafT * 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // 9. Damage Cracks per Phase
    this.drawDamageCracks(ctx, 0, -70, b.hp, b.maxHp, '#facc15');

    ctx.restore();
  }

  drawSandWyrm(ctx, b, p) {
    const cx = b.x + b.w / 2, by = b.y + b.h;
    const t = this.t;
    const breath = Math.sin(t * 3.0) * 0.03;
    const isTelegraph = b.state === 'telegraph';
    const isSurge = b.state === 'surge';

    ctx.save();
    ctx.translate(cx, by);
    ctx.scale(b.dir > 0 ? 1 : -1, 1 + breath);

    // 1. Sand dust swirl at the base
    ctx.fillStyle = 'rgba(245, 158, 11, 0.35)';
    ctx.beginPath();
    ctx.ellipse(0, -6, 42, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Segmented Armoured Body Plates (overlapping carapace)
    const segments = 5;
    for (let i = segments; i >= 1; i--) {
      const segY = -i * 18;
      const segW = 60 - i * 4;
      ctx.fillStyle = b.flash > 0 ? '#ffffff' : (i % 2 === 0 ? '#b45309' : '#d97706');
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(-segW / 2, segY, segW, 24, 8);
      ctx.fill();
      ctx.stroke();
      // Dorsal ridge spike
      ctx.fillStyle = '#78350f';
      ctx.beginPath();
      ctx.moveTo(-4, segY + 2); ctx.lineTo(0, segY - 6); ctx.lineTo(4, segY + 2);
      ctx.closePath();
      ctx.fill();
    }

    // 3. Colossal Horned Head Shell (3–4x hero height)
    ctx.fillStyle = b.flash > 0 ? '#ffffff' : (isTelegraph ? '#f59e0b' : '#b45309');
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(-34, -118, 68, 48, 16);
    ctx.fill();
    ctx.stroke();

    // Sweeping Obsidian Horns
    ctx.fillStyle = '#292524';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    // Left Horn
    ctx.beginPath();
    ctx.moveTo(-24, -114);
    ctx.quadraticCurveTo(-46, -138, -32, -148);
    ctx.quadraticCurveTo(-26, -132, -14, -116);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Right Horn
    ctx.beginPath();
    ctx.moveTo(24, -114);
    ctx.quadraticCurveTo(46, -138, 32, -148);
    ctx.quadraticCurveTo(26, -132, 14, -116);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 4. Snapping Mandibles
    const biteOffset = isTelegraph ? 8 : 0;
    ctx.fillStyle = '#fef08a';
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 2;
    // Left mandible
    ctx.beginPath();
    ctx.moveTo(-22 - biteOffset, -88);
    ctx.lineTo(-32 - biteOffset, -72);
    ctx.lineTo(-18, -78);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Right mandible
    ctx.beginPath();
    ctx.moveTo(22 + biteOffset, -88);
    ctx.lineTo(32 + biteOffset, -72);
    ctx.lineTo(18, -78);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 5. Tracking Emerald / Amber Eyes
    const targetX = p ? p.cx : b.x;
    const targetY = p ? p.cy : b.y;
    const eyeWorldX = cx;
    const eyeWorldY = by - 98;
    const dx = targetX - eyeWorldX;
    const dy = targetY - eyeWorldY;
    const dist = Math.hypot(dx, dy) || 1;
    const lookX = (dx / dist) * 3.0 * (b.dir > 0 ? 1 : -1);
    const lookY = (dy / dist) * 2.5;

    // Eye sockets
    ctx.fillStyle = '#1c1917';
    ctx.fillRect(-18, -102, 10, 8);
    ctx.fillRect(8, -102, 10, 8);

    // Glowing eyes
    ctx.fillStyle = '#10b981';
    ctx.shadowColor = '#10b981';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.ellipse(-13 + lookX, -98 + lookY, 4, 3, 0, 0, Math.PI * 2);
    ctx.ellipse(13 + lookX, -98 + lookY, 4, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Slit pupils
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-14 + lookX, -100 + lookY, 2, 4);
    ctx.fillRect(12 + lookX, -100 + lookY, 2, 4);

    // 6. Damage Cracks per Phase
    this.drawDamageCracks(ctx, 0, -90, b.hp, b.maxHp, '#fbbf24');

    ctx.restore();
  }

  drawFrostTitan(ctx, b, p) {
    const cx = b.x + b.w / 2, by = b.y + b.h;
    const t = this.t;
    const breath = Math.sin(t * 2.5) * 0.03;
    ctx.save();
    ctx.translate(cx, by);
    ctx.scale(b.dir > 0 ? 1 : -1, 1 + breath);

    // Colossal Glacier Torso (height 132px)
    ctx.fillStyle = b.flash > 0 ? '#ffffff' : '#0284c7';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(-36, -114, 72, 114, 16);
    ctx.fill();
    ctx.stroke();

    // Ice armor plates
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(-28, -98, 56, 30);
    ctx.fillStyle = '#e0f2fe';
    ctx.fillRect(-20, -92, 40, 10);

    // Crystalline Horns
    ctx.fillStyle = '#bae6fd';
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-24, -110); ctx.lineTo(-38, -138); ctx.lineTo(-16, -120);
    ctx.moveTo(24, -110); ctx.lineTo(38, -138); ctx.lineTo(16, -120);
    ctx.fill();
    ctx.stroke();

    // Glowing Blizzard Eyes
    const dx = (p ? p.cx : b.x) - cx;
    const dy = (p ? p.cy : b.y) - (by - 88);
    const dist = Math.hypot(dx, dy) || 1;
    const lx = (dx / dist) * 3 * (b.dir > 0 ? 1 : -1);
    const ly = (dy / dist) * 2.5;

    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(-14 + lx, -88 + ly, 4, 0, Math.PI * 2);
    ctx.arc(14 + lx, -88 + ly, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Damage Cracks per Phase
    this.drawDamageCracks(ctx, 0, -80, b.hp, b.maxHp, '#38bdf8');
    ctx.restore();
  }

  drawCrystalBehemoth(ctx, b, p) {
    const cx = b.x + b.w / 2, by = b.y + b.h;
    const t = this.t;
    const breath = Math.sin(t * 3.2) * 0.03;
    ctx.save();
    ctx.translate(cx, by);
    ctx.scale(b.dir > 0 ? 1 : -1, 1 + breath);

    // Faceted Crystal Carapace (height 126px)
    ctx.fillStyle = b.flash > 0 ? '#ffffff' : '#7e22ce';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(-36, -108, 72, 108, 16);
    ctx.fill();
    ctx.stroke();

    // Crystal Shards on back
    ctx.fillStyle = '#c084fc';
    ctx.beginPath();
    ctx.moveTo(-18, -108); ctx.lineTo(-24, -132); ctx.lineTo(-8, -112);
    ctx.moveTo(18, -108); ctx.lineTo(24, -132); ctx.lineTo(8, -112);
    ctx.moveTo(0, -108); ctx.lineTo(0, -138); ctx.lineTo(10, -112);
    ctx.fill();
    ctx.stroke();

    // Glowing Violet Tracking Eyes
    const dx = (p ? p.cx : b.x) - cx;
    const dy = (p ? p.cy : b.y) - (by - 82);
    const dist = Math.hypot(dx, dy) || 1;
    const lx = (dx / dist) * 3 * (b.dir > 0 ? 1 : -1);
    const ly = (dy / dist) * 2.5;

    ctx.fillStyle = '#f0abfc';
    ctx.shadowColor = '#d946ef';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(-12 + lx, -82 + ly, 4, 0, Math.PI * 2);
    ctx.arc(12 + lx, -82 + ly, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Damage Cracks per Phase
    this.drawDamageCracks(ctx, 0, -75, b.hp, b.maxHp, '#f0abfc');
    ctx.restore();
  }

  drawMagmaOverlord(ctx, b, p) {
    const cx = b.x + b.w / 2, by = b.y + b.h;
    const t = this.t;
    const breath = Math.sin(t * 3.5) * 0.03;
    ctx.save();
    ctx.translate(cx, by);
    ctx.scale(b.dir > 0 ? 1 : -1, 1 + breath);

    // Colossal Obsidian Demon Torso (height 134px)
    ctx.fillStyle = b.flash > 0 ? '#ffffff' : '#1e1b4b';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(-38, -116, 76, 116, 18);
    ctx.fill();
    ctx.stroke();

    // Burning Lava Veins
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#ea580c';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(-20, -100); ctx.lineTo(-10, -60); ctx.lineTo(-18, -20);
    ctx.moveTo(20, -100); ctx.lineTo(10, -60); ctx.lineTo(18, -20);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Curved Obsidian Horns
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(-24, -112); ctx.quadraticCurveTo(-48, -135, -34, -145); ctx.lineTo(-14, -118);
    ctx.moveTo(24, -112); ctx.quadraticCurveTo(48, -135, 34, -145); ctx.lineTo(14, -118);
    ctx.fill();

    // Fiery Eyes
    const dx = (p ? p.cx : b.x) - cx;
    const dy = (p ? p.cy : b.y) - (by - 90);
    const dist = Math.hypot(dx, dy) || 1;
    const lx = (dx / dist) * 3 * (b.dir > 0 ? 1 : -1);
    const ly = (dy / dist) * 2.5;

    ctx.fillStyle = '#fef08a';
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(-14 + lx, -90 + ly, 4, 0, Math.PI * 2);
    ctx.arc(14 + lx, -90 + ly, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Damage Cracks per Phase
    this.drawDamageCracks(ctx, 0, -80, b.hp, b.maxHp, '#f97316');
    ctx.restore();
  }

  drawBoss(ctx, b, p) {
    if (b.type === 'oak_guardian') {
      this.drawOldOak(ctx, b, p);
      return;
    }
    if (b.type === 'sand_wyrm') {
      this.drawSandWyrm(ctx, b, p);
      return;
    }
    if (b.type === 'frost_titan') {
      this.drawFrostTitan(ctx, b, p);
      return;
    }
    if (b.type === 'crystal_behemoth') {
      this.drawCrystalBehemoth(ctx, b, p);
      return;
    }
    if (b.type === 'magma_overlord') {
      this.drawMagmaOverlord(ctx, b, p);
      return;
    }
    this.drawMushroomKing(ctx, b, p);
  }

  drawBossHealthBar(ctx, boss) {
    const bw = 240, bh = 14;
    // Position comfortably below top letterbox bar (letterbox is y: 0..36)
    const bx = (VIEW_W - bw) / 2, by = 60;
    ctx.save();
    // Name (show boss name only, comfortably below letterbox bar)
    ctx.font = '700 13px Fredoka, sans-serif';
    ctx.fillStyle = '#fed7aa';
    ctx.textAlign = 'center';
    ctx.fillText(boss.name.toUpperCase(), VIEW_W / 2, by - 8);

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
    const gs = p.giantScale || 1;

    // Soft contact shadow under hero (dark ellipse, 25% alpha)
    ctx.save();
    ctx.translate(cx, feet);
    ctx.fillStyle = 'rgba(27, 26, 20, 0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 11 * gs, 4 * gs, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(cx, feet);
    const heroScale = 1.18; // 18% larger hero with 2px outline for cartoon clarity
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
    ctx.strokeStyle = '#1b1a14';
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
    // Hide completely during boss intro
    if (g.bossIntro) return;
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

    const camX = g.cam.x, camY = g.cam.y;
    const margin = 16;

    // Desired position: Above hero's head with >= 40 px gap
    // Hero head top is p.y. Bubble bottom is drawY + h, so drawY + h <= p.y - 40
    let drawX = p.cx;
    let drawY = p.y - 40 - h;

    // Check if placing above hero's head would violate the screen top margin
    const screenY = drawY - camY;
    if (screenY < margin) {
      // Offset sideways so bubble NEVER presses down onto hero
      drawY = p.y - 6;
      const heroScreenX = p.cx - camX;
      if (heroScreenX < VIEW_W / 2) {
        drawX = p.x + p.w + 24 + halfW;
      } else {
        drawX = p.x - 24 - halfW;
      }
    }

    // Clamp within screen boundaries
    let screenX = drawX - camX;
    let clampedScreenX = Math.max(margin + halfW, Math.min(VIEW_W - margin - halfW, screenX));
    let clampedScreenY = Math.max(margin, Math.min(VIEW_H - margin - h, drawY - camY));
    drawX = clampedScreenX + camX;
    drawY = clampedScreenY + camY;

    // Strict guarantee: Bubble must NEVER cover the hero!
    const bL = drawX - halfW, bR = drawX + halfW;
    const bT = drawY, bB = drawY + h;
    const overlapsHero = (bL < p.x + p.w + 8 && bR > p.x - 8 && bT < p.y + p.h + 4 && bB > p.y - 36);
    if (overlapsHero) {
      if (drawX >= p.cx) {
        drawX = Math.min(p.x + p.w + 20 + halfW, camX + VIEW_W - margin - halfW);
      } else {
        drawX = Math.max(p.x - 20 - halfW, camX + margin + halfW);
      }
    }

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

    // 1. Light shafts in green_hills & autumn_forest (fanning out from the sunset backlight)
    if (theme.id === 'green_hills' || theme.id === 'autumn_forest') {
      const pulse = 0.05 + Math.sin(this.t * 1.4) * 0.02; // subtle alpha pulse
      const col = theme.id === 'autumn_forest' ? `rgba(251, 191, 36, ${pulse})` : `rgba(254, 240, 138, ${pulse})`;
      ctx.fillStyle = col;
      const sx = VIEW_W * 0.24, sy = VIEW_H * 0.46; // sun origin
      const angles = [-0.68, -0.36, -0.05, 0.28, 0.58, 0.88];
      for (const ang of angles) {
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + Math.cos(ang - 0.07) * 780, sy + Math.sin(ang - 0.07) * 780);
        ctx.lineTo(sx + Math.cos(ang + 0.07) * 780, sy + Math.sin(ang + 0.07) * 780);
        ctx.closePath();
        ctx.fill();
      }
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

    // 3. Depth fog / horizontal haze band across playfield
    const depthFog = ctx.createLinearGradient(0, VIEW_H * 0.42, 0, VIEW_H * 0.78);
    depthFog.addColorStop(0, 'rgba(255, 255, 255, 0)');
    const fogColor = theme.id === 'desert_ruins' ? 'rgba(234, 179, 8, 0.07)' :
      (theme.id === 'autumn_forest' ? 'rgba(217, 119, 6, 0.07)' :
      (theme.id === 'green_hills' ? 'rgba(254, 243, 199, 0.06)' : 'rgba(203, 213, 225, 0.06)'));
    depthFog.addColorStop(0.5, fogColor);
    depthFog.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = depthFog;
    ctx.fillRect(0, VIEW_H * 0.42, VIEW_W, VIEW_H * 0.36);

    // 4. Screen-space warm color grade (orange tint near sun side, cool blue on far side)
    if (theme.id === 'green_hills' || theme.id === 'autumn_forest') {
      const grade = ctx.createLinearGradient(0, 0, VIEW_W, 0);
      grade.addColorStop(0, 'rgba(251, 146, 60, 0.08)');
      grade.addColorStop(0.45, 'rgba(245, 158, 11, 0.03)');
      grade.addColorStop(1, 'rgba(30, 58, 138, 0.07)');
      ctx.fillStyle = grade;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }

    // 5. Subtle screen-space vignette (dark edges at 16-18% alpha)
    const vigGrad = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.42, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.76);
    vigGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vigGrad.addColorStop(1, 'rgba(27, 26, 20, 0.18)');
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

    // Corner fern silhouettes for green_hills & autumn_forest (hand-painted platformer framing)
    if (theme.id === 'green_hills' || theme.id === 'autumn_forest') {
      ctx.save();
      ctx.fillStyle = '#1b1a14';
      ctx.globalAlpha = 0.52;

      // Bottom-left corner fern fronds
      const swayL = Math.sin(t * 1.3) * 3;
      ctx.beginPath();
      ctx.moveTo(-15, VIEW_H + 10);
      ctx.quadraticCurveTo(30, VIEW_H - 45 + swayL, 85, VIEW_H - 68 + swayL);
      ctx.quadraticCurveTo(55, VIEW_H - 25, 45, VIEW_H + 10);
      ctx.fill();
      // Little side leaflets
      for (let j = 0; j < 5; j++) {
        const lfX = 10 + j * 14;
        const lfY = VIEW_H - 12 - j * 10 + swayL * (j / 5);
        ctx.beginPath();
        ctx.ellipse(lfX, lfY, 9, 4, -0.6 + j * 0.1, 0, Math.PI * 2);
        ctx.fill();
      }

      // Bottom-right corner fern fronds
      const swayR = Math.sin(t * 1.5 + 1) * 3;
      ctx.beginPath();
      ctx.moveTo(VIEW_W + 15, VIEW_H + 10);
      ctx.quadraticCurveTo(VIEW_W - 35, VIEW_H - 40 + swayR, VIEW_W - 80, VIEW_H - 62 + swayR);
      ctx.quadraticCurveTo(VIEW_W - 50, VIEW_H - 20, VIEW_W - 40, VIEW_H + 10);
      ctx.fill();
      for (let j = 0; j < 5; j++) {
        const lfX = VIEW_W - 12 - j * 13;
        const lfY = VIEW_H - 10 - j * 9 + swayR * (j / 5);
        ctx.beginPath();
        ctx.ellipse(lfX, lfY, 8.5, 3.8, 0.6 - j * 0.1, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    for (let i = 0; i < 20; i++) {
      const seedX = (i * 137.5) % (VIEW_W + 120);
      const seedY = (i * 83.1) % (VIEW_H + 80);
      const x = ((seedX - fgX + t * (20 + (i % 5) * 6)) % (VIEW_W + 120) + (VIEW_W + 120)) % (VIEW_W + 120) - 60;
      const y = ((seedY - fgY + Math.sin(t * 2 + i) * 16) % (VIEW_H + 80) + (VIEW_H + 80)) % (VIEW_H + 80) - 40;
      const size = 6 + (i % 4) * 3;

      if (theme.id === 'autumn_forest') {
        // Tumbling autumn leaves (rich gold & amber ellipses)
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = i % 2 === 0 ? '#ea580c' : '#f59e0b';
        ctx.beginPath();
        ctx.ellipse(x, y, size, size * 0.5, (t + i) * 0.8, 0, Math.PI * 2);
        ctx.fill();
      } else if (theme.id === 'desert_ruins') {
        // Desert: sand dust grains + heat shimmer motes ONLY (NEVER leaves)
        if (i % 3 === 0) {
          ctx.globalAlpha = 0.20 + Math.sin(t * 4 + i) * 0.12;
          ctx.fillStyle = '#fef08a';
          ctx.beginPath();
          ctx.arc(x, y, 2.5, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.globalAlpha = 0.30;
          ctx.fillStyle = i % 2 === 0 ? '#f59e0b' : '#d97706';
          ctx.fillRect(x, y, 2.5, 2.5);
        }
      } else if (theme.id === 'frozen_peaks') {
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x, y, 2 + (i % 3), 0, Math.PI * 2);
        ctx.fill();
      } else if (theme.id === 'crystal_caves') {
        ctx.globalAlpha = 0.30;
        ctx.fillStyle = i % 2 === 0 ? '#c084fc' : '#38bdf8';
        ctx.fillRect(x, y, 3, 3);
      } else if (theme.id === 'volcano_fortress') {
        ctx.globalAlpha = 0.38;
        ctx.fillStyle = i % 2 === 0 ? '#f97316' : '#ef4444';
        ctx.fillRect(x, y - (t * 20 % 30), 2.5, 2.5);
      } else {
        // Green hills: soft floating golden pollen motes / fireflies near sun
        ctx.globalAlpha = 0.32 + Math.sin(t * 3 + i) * 0.15;
        ctx.fillStyle = i % 3 === 0 ? '#fef08a' : (i % 3 === 1 ? '#facc15' : '#bef264');
        ctx.beginPath();
        ctx.arc(x, y, 2 + (i % 2) * 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}
