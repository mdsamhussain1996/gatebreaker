/**
 * Gatebreaker v2 — Entities System
 * Rook (Hero), Beetlebot, Gift Crate, Floating Key, Keyhole Gate, and Particles.
 */

import {
  TS,
  HERO_W,
  HERO_H,
  KNIFE_W,
  KNIFE_H,
  KNIFE_COOLDOWN,
  KNIFE_DURATION,
  KNIFE_DAMAGE,
  POGO_BOUNCE_VEL,
  STOMP_BOUNCE_VEL,
  BEETLEBOT_SPEED,
  BEETLEBOT_W,
  BEETLEBOT_H
} from './constants.js';
import { checkAABB, isSolidTile, isOneWayTile } from './physics.js';
import { playSound } from './audio.js';

export function createHero(x, y) {
  return {
    x,
    y,
    w: HERO_W,
    h: HERO_H,
    vx: 0,
    vy: 0,
    facing: 1, // 1: right, -1: left
    grounded: false,
    onRope: false,
    isJumping: false,
    coyoteTimer: 0,
    jumpBufferTimer: 0,
    dropThroughTimer: 0,
    invulnTimer: 0,
    knifeCooldown: 0,
    knifeActiveTimer: 0,
    isDownSlash: false,
    hearts: 3,
    maxHearts: 3,
    lives: 3,
    hasKey: false,
    walkCycle: 0
  };
}

export function updateKnifeCombat(hero, input, gameState) {
  if (hero.knifeCooldown <= 0 && input.knifePressed) {
    hero.knifeCooldown = KNIFE_COOLDOWN;
    hero.knifeActiveTimer = KNIFE_DURATION;
    hero.isDownSlash = !hero.grounded && input.down;
    playSound('knifeSwish');

    // Create knife hitbox
    let knifeBox = null;
    if (hero.isDownSlash) {
      // Downward pogo slash beneath feet
      knifeBox = {
        x: hero.x - 2,
        y: hero.y + hero.h - 4,
        w: hero.w + 4,
        h: 24
      };
    } else {
      // Forward slash
      const kx = hero.facing === 1 ? hero.x + hero.w : hero.x - KNIFE_W;
      knifeBox = {
        x: kx,
        y: hero.y + 4,
        w: KNIFE_W,
        h: KNIFE_H
      };
    }

    // Check hit against Crates
    for (const crate of gameState.crates) {
      if (!crate.opened && checkAABB(knifeBox, crate)) {
        crate.opened = true;
        playSound('crateSmash');
        spawnWoodSplinters(gameState, crate.x + crate.w / 2, crate.y + crate.h / 2);

        // Spawn item inside
        if (crate.contents === 'key') {
          gameState.keyItem = {
            x: crate.x + 6,
            y: crate.y - 12,
            w: 18,
            h: 18,
            collected: false,
            bob: 0
          };
          playSound('keyCollect');
        }
      }
    }

    // Check hit against Enemies (Beetlebots)
    for (const enemy of gameState.enemies) {
      if (!enemy.dead && checkAABB(knifeBox, enemy)) {
        enemy.hp -= KNIFE_DAMAGE;
        playSound('knifeHit');
        spawnHitSparks(gameState, enemy.x + enemy.w / 2, enemy.y + enemy.h / 2);

        if (hero.isDownSlash) {
          // Pogo bounce!
          hero.vy = POGO_BOUNCE_VEL;
          playSound('pogo');
        }

        if (enemy.hp <= 0) {
          enemy.dead = true;
          playSound('enemyDie');
          spawnPoofStars(gameState, enemy.x + enemy.w / 2, enemy.y + enemy.h / 2);
        }
      }
    }
  }
}

export function updateBeetlebots(gameState, dt) {
  const tiles = gameState.tiles;
  for (const enemy of gameState.enemies) {
    if (enemy.dead) continue;

    // Move horizontally
    enemy.x += enemy.dir * enemy.speed * dt;

    // Check wall collision ahead
    const aheadX = enemy.dir === 1 ? enemy.x + enemy.w : enemy.x;
    const tileX = Math.floor(aheadX / TS);
    const tileY = Math.floor((enemy.y + enemy.h / 2) / TS);

    // Check ledge ahead (floor below leading foot)
    const footTileX = Math.floor(aheadX / TS);
    const footTileY = Math.floor((enemy.y + enemy.h + 2) / TS);
    const hasFloorAhead = isSolidTile(tiles, footTileX, footTileY) || isOneWayTile(tiles, footTileX, footTileY);

    if (isSolidTile(tiles, tileX, tileY) || !hasFloorAhead) {
      enemy.dir *= -1; // turn around
    }

    // Hero Stomp or Contact Damage
    const hero = gameState.hero;
    if (checkAABB(hero, enemy)) {
      const heroFeet = hero.y + hero.h;
      const enemyTop = enemy.y + 6;

      // Stomp check (hero falling and landing on head)
      if (hero.vy > 0 && heroFeet <= enemyTop + 10) {
        enemy.hp -= 1;
        hero.vy = STOMP_BOUNCE_VEL;
        playSound('stomp');
        spawnHitSparks(gameState, enemy.x + enemy.w / 2, enemy.y + 4);

        if (enemy.hp <= 0) {
          enemy.dead = true;
          playSound('enemyDie');
          spawnPoofStars(gameState, enemy.x + enemy.w / 2, enemy.y + enemy.h / 2);
        }
      } else if (hero.invulnTimer <= 0) {
        // Hero takes contact damage
        hero.hearts -= 1;
        hero.invulnTimer = 1.0;
        hero.vy = -320;
        hero.vx = (hero.x < enemy.x ? -1 : 1) * 160;
        playSound('enemyDie');
        if (hero.hearts <= 0) {
          gameState.gameOver = true;
        }
      }
    }
  }
}

export function updateKeyAndGate(gameState, dt) {
  const hero = gameState.hero;

  // Key pickup
  if (gameState.keyItem && !gameState.keyItem.collected) {
    gameState.keyItem.bob += dt * 4;
    if (checkAABB(hero, gameState.keyItem)) {
      gameState.keyItem.collected = true;
      hero.hasKey = true;
      playSound('keyCollect');
    }
  }

  // Floating key trail behind hero
  if (hero.hasKey && gameState.keyItem) {
    const targetX = hero.facing === 1 ? hero.x - 22 : hero.x + hero.w + 6;
    const targetY = hero.y + Math.sin(gameState.time * 5) * 4;
    gameState.keyItem.x += (targetX - gameState.keyItem.x) * (dt * 10);
    gameState.keyItem.y += (targetY - gameState.keyItem.y) * (dt * 10);
  }

  // Gate unlock
  const gate = gameState.gate;
  if (gate && checkAABB(hero, gate)) {
    if (hero.hasKey && !gate.unlocked) {
      gate.unlocked = true;
      playSound('gateUnlock');
      gameState.levelComplete = true;
    }
  }
}

// Particle generators
export function spawnWoodSplinters(gameState, x, y) {
  for (let i = 0; i < 8; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 60 + Math.random() * 100;
    gameState.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 60,
      color: '#b45309',
      size: 3 + Math.random() * 3,
      life: 0.35 + Math.random() * 0.2
    });
  }
}

export function spawnHitSparks(gameState, x, y) {
  for (let i = 0; i < 6; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 70 + Math.random() * 90;
    gameState.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color: '#fbbf24',
      size: 2 + Math.random() * 2,
      life: 0.25
    });
  }
}

export function spawnPoofStars(gameState, x, y) {
  for (let i = 0; i < 10; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 50 + Math.random() * 80;
    gameState.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 40,
      color: '#fef08a',
      size: 3 + Math.random() * 2,
      life: 0.4
    });
  }
}
