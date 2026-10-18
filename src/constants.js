/**
 * Gatebreaker — shared constants (all pixel values are internal 960x540 units).
 */
export const TS = 32;            // tile size
export const VIEW_W = 960;
export const VIEW_H = 540;
export const DT = 1 / 60;        // fixed simulation timestep

export const HERO = { w: 22, h: 38 };

export const PHYS = {
  runMax: 210,
  accel: 1800,
  decel: 2400,
  jumpV: -580,
  gravity: 1750,
  fallMult: 1.5,
  maxFall: 680,
  jumpCut: -330,     // variable jump: releasing the button caps upward speed at this
  coyote: 0.1,
  buffer: 0.12,
  corner: 6,         // corner-correction distance in px
  climb: 120
};

export const COMBAT = {
  slashW: 30,
  slashH: 22,
  slashCooldown: 0.25,
  slashTime: 0.14,
  pogoV: -470,
  stompV: -430,
  invuln: 1.4
};

/** Derived, analytic jump numbers (used by tests & level design). */
export const JUMP = {
  heightPx: (PHYS.jumpV * PHYS.jumpV) / (2 * PHYS.gravity),                       // ≈ 96 px
  heightTiles: (PHYS.jumpV * PHYS.jumpV) / (2 * PHYS.gravity) / TS                // ≈ 3.0 tiles
};

export const ABILITIES = {
  dashSpeed: 520,      // 520 px/s
  dashDuration: 0.18,  // 0.18 s burst
  dashCooldown: 0.60,  // 0.6 s cooldown
  poundSpeed: 720,     // 720 px/s slam
  poundStunRadius: 64  // 2 tiles (64 px)
};

