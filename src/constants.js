/**
 * Gatebreaker v2 — Physics and Gameplay Constants
 */

export const TS = 32;
export const VIEW_W = 960;
export const VIEW_H = 540;
export const ROOM_COLS = 30;
export const ROOM_ROWS = 17;

// Hero dimensions
export const HERO_W = 20;
export const HERO_H = 28;

// Run physics
export const RUN_SPEED = 200;       // max run speed (px/s)
export const RUN_ACCEL = 1800;      // acceleration (px/s²)
export const RUN_DECEL = 2200;      // deceleration / friction (px/s²)

// Jump physics
export const JUMP_VEL = -560;       // initial jump impulse (px/s)
export const GRAVITY = 1700;        // normal upward gravity (px/s²)
export const FALL_GRAV_MULT = 1.5;  // downward gravity multiplier (1700 * 1.5 = 2550 px/s²)
export const MAX_FALL = 650;        // terminal fall velocity (px/s)
export const JUMP_CUT_MULT = 0.45;  // variable jump release multiplier

// Jump assists
export const COYOTE_TIME = 0.10;    // coyote time (s)
export const JUMP_BUFFER = 0.12;    // jump buffer window (s)
export const CORNER_CORRECTION = 6; // ledge corner nudge (px)

// Ropes and climbing
export const ROPE_CLIMB_SPEED = 120;// rope climbing speed (px/s)
export const ROPE_GRAB_DIST = 16;   // distance to rope center to snap/grab (px)

// Combat
export const KNIFE_W = 30;          // knife slash hitbox width (px)
export const KNIFE_H = 22;          // knife slash hitbox height (px)
export const KNIFE_COOLDOWN = 0.25; // cooldown between swings (s)
export const KNIFE_DURATION = 0.14; // active slash duration (s)
export const KNIFE_DAMAGE = 1;      // base knife damage
export const POGO_BOUNCE_VEL = -460;// upward velocity after successful air down-slash pogo
export const STOMP_BOUNCE_VEL = -460;// upward velocity after jumping on an enemy head

// Enemy: Beetlebot
export const BEETLEBOT_SPEED = 60;  // patrol speed (px/s)
export const BEETLEBOT_W = 24;
export const BEETLEBOT_H = 18;

// Camera
export const CAM_DEADZONE_X = 60;   // horizontal deadzone before camera moves (px)
export const CAM_LOOKAHEAD = 40;    // horizontal camera lead in facing direction (px)
export const CAM_LERP = 8.0;        // camera smoothing factor
