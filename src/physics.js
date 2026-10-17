/**
 * Gatebreaker v2 — Physics Engine
 * Axis-separated AABB tile collision, variable jump, coyote time, jump buffer,
 * corner correction, one-way platforms, and rope climbing.
 */

import {
  TS,
  HERO_W,
  HERO_H,
  RUN_SPEED,
  RUN_ACCEL,
  RUN_DECEL,
  JUMP_VEL,
  GRAVITY,
  FALL_GRAV_MULT,
  MAX_FALL,
  JUMP_CUT_MULT,
  COYOTE_TIME,
  JUMP_BUFFER,
  CORNER_CORRECTION,
  ROPE_CLIMB_SPEED,
  POGO_BOUNCE_VEL,
  STOMP_BOUNCE_VEL
} from './constants.js';

export function isSolidTile(tiles, tx, ty) {
  if (ty < 0 || ty >= tiles.length || tx < 0 || tx >= tiles[0].length) return true;
  return tiles[ty][tx] === '#';
}

export function isOneWayTile(tiles, tx, ty) {
  if (ty < 0 || ty >= tiles.length || tx < 0 || tx >= tiles[0].length) return false;
  return tiles[ty][tx] === '=';
}

export function isRopeTile(tiles, tx, ty) {
  if (ty < 0 || ty >= tiles.length || tx < 0 || tx >= tiles[0].length) return false;
  return tiles[ty][tx] === '|';
}

export function updateHeroPhysics(hero, input, tiles, dt) {
  // Update timers
  if (hero.coyoteTimer > 0) hero.coyoteTimer -= dt;
  if (hero.jumpBufferTimer > 0) hero.jumpBufferTimer -= dt;
  if (hero.dropThroughTimer > 0) hero.dropThroughTimer -= dt;
  if (hero.invulnTimer > 0) hero.invulnTimer -= dt;
  if (hero.knifeCooldown > 0) hero.knifeCooldown -= dt;
  if (hero.knifeActiveTimer > 0) hero.knifeActiveTimer -= dt;

  // Jump buffer input check
  if (input.jumpPressed) {
    hero.jumpBufferTimer = JUMP_BUFFER;
  }

  // 1. Rope Climbing Logic
  const heroCenterX = hero.x + hero.w / 2;
  const heroCenterY = hero.y + hero.h / 2;
  const tileCoordX = Math.floor(heroCenterX / TS);
  const tileCoordY = Math.floor(heroCenterY / TS);
  const touchingRope = isRopeTile(tiles, tileCoordX, tileCoordY);

  if (touchingRope) {
    // Grab rope on Up or Down
    if (!hero.onRope && (input.up || input.down)) {
      hero.onRope = true;
      hero.vx = 0;
      hero.vy = 0;
      hero.x = tileCoordX * TS + (TS - hero.w) / 2; // snap to rope center
    }
  } else {
    hero.onRope = false;
  }

  if (hero.onRope) {
    hero.coyoteTimer = 0;
    hero.grounded = false;

    // Vertical climb
    if (input.up) {
      hero.vy = -ROPE_CLIMB_SPEED;
    } else if (input.down) {
      hero.vy = ROPE_CLIMB_SPEED;
    } else {
      hero.vy = 0;
    }

    // Jump off rope
    if (hero.jumpBufferTimer > 0) {
      hero.jumpBufferTimer = 0;
      hero.onRope = false;
      hero.vy = JUMP_VEL;
      if (input.left) {
        hero.vx = -RUN_SPEED * 0.85;
        hero.facing = -1;
      } else if (input.right) {
        hero.vx = RUN_SPEED * 0.85;
        hero.facing = 1;
      } else {
        hero.vx = 0;
      }
      return;
    }

    // Move along rope
    hero.y += hero.vy * dt;
    // Check if hero climbed past rope ends
    const topTile = Math.floor(hero.y / TS);
    const bottomTile = Math.floor((hero.y + hero.h) / TS);
    if (!isRopeTile(tiles, tileCoordX, topTile) && !isRopeTile(tiles, tileCoordX, bottomTile)) {
      hero.onRope = false;
    }
    return;
  }

  // 2. Horizontal Run & Friction
  let moveDir = 0;
  if (input.left) moveDir -= 1;
  if (input.right) moveDir += 1;

  if (moveDir !== 0) {
    hero.facing = moveDir;
    // Accelerate toward target speed
    if (hero.vx * moveDir < 0) {
      // Quick turn around
      hero.vx += moveDir * RUN_DECEL * dt;
    } else {
      hero.vx += moveDir * RUN_ACCEL * dt;
    }
    // Clamp to max speed
    if (Math.abs(hero.vx) > RUN_SPEED) {
      hero.vx = moveDir * RUN_SPEED;
    }
  } else {
    // Decelerate / Friction
    if (Math.abs(hero.vx) <= RUN_DECEL * dt) {
      hero.vx = 0;
    } else {
      hero.vx -= Math.sign(hero.vx) * RUN_DECEL * dt;
    }
  }

  // 3. Drop-Through One-Way Platforms (Down + Jump)
  if (hero.grounded && input.down && hero.jumpBufferTimer > 0) {
    const feetTileY = Math.floor((hero.y + hero.h + 2) / TS);
    const leftTileX = Math.floor(hero.x / TS);
    const rightTileX = Math.floor((hero.x + hero.w - 1) / TS);
    if (isOneWayTile(tiles, leftTileX, feetTileY) || isOneWayTile(tiles, rightTileX, feetTileY)) {
      hero.dropThroughTimer = 0.20;
      hero.jumpBufferTimer = 0;
      hero.grounded = false;
      hero.y += 3; // Nudge below top edge
    }
  }

  // 4. Jump Initiation (Jump Buffer & Coyote Time)
  const canJump = hero.grounded || hero.coyoteTimer > 0;
  if (hero.jumpBufferTimer > 0 && canJump) {
    hero.vy = JUMP_VEL;
    hero.grounded = false;
    hero.coyoteTimer = 0;
    hero.jumpBufferTimer = 0;
    hero.isJumping = true;
  }

  // 5. Variable Jump Height (cut velocity on release)
  if (hero.isJumping && !input.jumpHeld && hero.vy < 0) {
    hero.vy *= JUMP_CUT_MULT;
    hero.isJumping = false;
  }

  // 6. Gravity Application
  const activeGravity = (hero.vy > 0) ? GRAVITY * FALL_GRAV_MULT : GRAVITY;
  hero.vy += activeGravity * dt;
  if (hero.vy > MAX_FALL) {
    hero.vy = MAX_FALL;
  }

  // 7. Axis-Separated Tile Collision Resolution
  const prevGrounded = hero.grounded;
  const prevY = hero.y;

  // Horizontal Movement & Collision
  hero.x += hero.vx * dt;
  resolveHorizontalCollisions(hero, tiles);

  // Vertical Movement & Collision
  hero.y += hero.vy * dt;
  hero.grounded = false;
  resolveVerticalCollisions(hero, tiles, prevY);

  // Coyote time trigger when leaving ground
  if (prevGrounded && !hero.grounded && hero.vy >= 0 && !hero.isJumping) {
    hero.coyoteTimer = COYOTE_TIME;
  }
}

function resolveHorizontalCollisions(hero, tiles) {
  const minX = Math.floor(hero.x / TS);
  const maxX = Math.floor((hero.x + hero.w - 0.001) / TS);
  const minY = Math.floor(hero.y / TS);
  const maxY = Math.floor((hero.y + hero.h - 0.001) / TS);

  for (let ty = minY; ty <= maxY; ty++) {
    for (let tx = minX; tx <= maxX; tx++) {
      if (isSolidTile(tiles, tx, ty)) {
        if (hero.vx > 0) {
          hero.x = tx * TS - hero.w;
          hero.vx = 0;
        } else if (hero.vx < 0) {
          hero.x = (tx + 1) * TS;
          hero.vx = 0;
        }
      }
    }
  }
}

function resolveVerticalCollisions(hero, tiles, prevY) {
  const minX = Math.floor(hero.x / TS);
  const maxX = Math.floor((hero.x + hero.w - 0.001) / TS);
  const minY = Math.floor(hero.y / TS);
  const maxY = Math.floor((hero.y + hero.h - 0.001) / TS);

  for (let ty = minY; ty <= maxY; ty++) {
    for (let tx = minX; tx <= maxX; tx++) {
      // Solid Wall (#)
      if (isSolidTile(tiles, tx, ty)) {
        if (hero.vy > 0) {
          // Landing on floor
          hero.y = ty * TS - hero.h;
          hero.vy = 0;
          hero.grounded = true;
          hero.isJumping = false;
        } else if (hero.vy < 0) {
          // Ceiling collision
          // Apply Corner Correction (nudge up to 6 px)
          const tileLeft = tx * TS;
          const tileRight = (tx + 1) * TS;
          const leftOverlap = (hero.x + hero.w) - tileLeft;
          const rightOverlap = tileRight - hero.x;

          if (leftOverlap <= CORNER_CORRECTION && !isSolidTile(tiles, tx - 1, ty)) {
            hero.x -= leftOverlap; // nudge left around corner
          } else if (rightOverlap <= CORNER_CORRECTION && !isSolidTile(tiles, tx + 1, ty)) {
            hero.x += rightOverlap; // nudge right around corner
          } else {
            hero.y = (ty + 1) * TS;
            hero.vy = 0;
          }
        }
      }

      // One-Way Platform (=)
      if (isOneWayTile(tiles, tx, ty) && hero.dropThroughTimer <= 0) {
        const platTop = ty * TS;
        const prevBottom = prevY + hero.h;
        const currentBottom = hero.y + hero.h;

        // Only land if hero was at or above platform and falling downward
        if (prevBottom <= platTop + 4 && currentBottom >= platTop && hero.vy >= 0) {
          hero.y = platTop - hero.h;
          hero.vy = 0;
          hero.grounded = true;
          hero.isJumping = false;
        }
      }
    }
  }
}

export function checkAABB(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}
