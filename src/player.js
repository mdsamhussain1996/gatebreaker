/**
 * Gatebreaker — hero "Rook". DOM-free; all side effects go through the `g` (Game) object.
 */
import { TS, HERO, PHYS, COMBAT, ABILITIES } from './constants.js';
import { moveX, moveY, probeGround, overlapsLava } from './physics.js';

const approach = (v, target, delta) =>
  v < target ? Math.min(v + delta, target) : Math.max(v - delta, target);

export class Player {
  constructor() {
    this.w = HERO.w;
    this.h = HERO.h;
    this.hearts = 3;
    this.maxHearts = 3;
    this.lives = 3;
    this.hasKey = false;
    this.onFire = 0;
    this.place(0, 0);
  }

  /** Put the hero standing with feet at (cx, feetY). */
  place(cx, feetY) {
    this.x = cx - this.w / 2;
    this.y = feetY - this.h;
    this.vx = 0; this.vy = 0;
    this.face = 1;
    this.grounded = false;
    this.groundType = null;
    this.coyote = 0;
    this.jumpBuf = 0;
    this.jumpCuttable = false;
    this.hasDoubleJumped = false;
    this.dashT = 0;
    this.dashCd = 0;
    this.dashDir = 1;
    this.isGroundPounding = false;
    this.powerup = null;
    this.blasterCd = 0;
    this.giantScale = 1;
    this.dropT = 0;
    this.grabCd = 0;
    this.climbing = false;
    this.climbCol = 0; this.climbTop = 0; this.climbKind = '|';
    this.knifeCd = 0;
    this.slashT = 0;
    this.slashDown = false;
    this.slashHit = new Set();
    this.hurtT = 0;
    this.invuln = 0;
    this.prevBottom = this.y + this.h;
    // visuals
    this.sx = 1; this.sy = 1;
    this.runPhase = 0;
    this.blinkT = 2;
    this.visDy = 0;       // visual offset (rope-bridge sag)
    this.climbPhase = 0;
  }

  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }

  update(g, input, dt) {
    const w = g.world;
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.knifeCd = Math.max(0, this.knifeCd - dt);
    this.slashT = Math.max(0, this.slashT - dt);
    this.dropT = Math.max(0, this.dropT - dt);
    this.grabCd = Math.max(0, this.grabCd - dt);
    this.dashCd = Math.max(0, this.dashCd - dt);
    this.blasterCd = Math.max(0, this.blasterCd - dt);
    this.onFire = Math.max(0, this.onFire - dt);
    this.prevBottom = this.y + this.h;

    // Powerup durations and behaviors
    if (this.powerup && typeof this.powerup.duration === 'number') {
      this.powerup.duration -= dt;
      if (this.powerup.duration <= 0) {
        this.powerup = null;
        this.giantScale = 1;
      }
    }
    if (this.powerup?.type === 'blaster' && input.blasterPressed && this.blasterCd <= 0) {
      this.blasterCd = 0.20;
      this.powerup.ammo--;
      if (g.fireBlaster) g.fireBlaster(this);
      if (this.powerup.ammo <= 0) this.powerup = null;
    }
    if (this.powerup?.type === 'coin_magnet' && g.pullCoins) {
      g.pullCoins(this.cx, this.cy, 160, dt);
    }
    if (this.powerup?.type === 'star_power') {
      this.invuln = Math.max(this.invuln, 0.1);
    }

    // Super meter shockwave trigger
    if (input.superPressed && g.superMeter >= 100) {
      if (g.triggerShockwave) g.triggerShockwave(this);
    }

    if (this.climbing) this.updateClimb(g, input, dt);
    else this.updateMove(g, input, dt);

    this.updateKnife(g, input);
    this.updateVisuals(dt);

    if (this.y > w.h + 80 || overlapsLava(w, this.x + 4, this.y + 4, this.w - 8, this.h - 8)) {
      g.playerFell();
    }
  }

  updateMove(g, input, dt) {
    const w = g.world;
    const dirX = (input.right ? 1 : 0) - (input.left ? 1 : 0);

    // --- dash ability trigger ---
    if (input.dashPressed && this.dashCd <= 0 && this.dashT <= 0 && !this.climbing && (g.hasAbility ? g.hasAbility('dash') : false)) {
      this.dashT = ABILITIES.dashDuration;
      this.dashCd = ABILITIES.dashCooldown;
      this.dashDir = (input.right ? 1 : (input.left ? -1 : this.face));
      this.face = this.dashDir;
      this.invuln = Math.max(this.invuln, ABILITIES.dashDuration);
      if (g.sfx) g.sfx('dash');
    }

    // --- horizontal movement ---
    if (this.dashT > 0) {
      this.dashT -= dt;
      this.vx = this.dashDir * ABILITIES.dashSpeed;
      this.vy = 0;
      if (g.addAfterimage) g.addAfterimage(this);
      if (g.checkDashSmash) g.checkDashSmash(this);
    } else if (this.hurtT <= 0) {
      const maxSpeed = this.powerup?.type === 'speed_boots' ? PHYS.runMax * 1.4 : PHYS.runMax;
      if (dirX !== 0) {
        this.face = dirX;
        const speedingUp = this.vx === 0 || Math.sign(this.vx) === dirX;
        this.vx = approach(this.vx, dirX * maxSpeed, (speedingUp ? PHYS.accel : PHYS.decel) * dt);
      } else {
        this.vx = approach(this.vx, 0, PHYS.decel * dt);
      }
      if (((this.powerup?.type === 'speed_boots' && Math.abs(this.vx) > 60) || (Math.abs(this.vx) > 120)) && this.grounded && Math.random() < 0.28) {
        if (g.spawnDust) g.spawnDust(this.cx - this.face * 6, this.y + this.h);
      }
    }

    if (this.powerup?.type === 'giant_rook' && g.checkGiantSmash) {
      g.checkGiantSmash(this);
    }

    // --- ground state, coyote, buffer ---
    const gt = probeGround(w, this, this.dropT > 0);
    this.grounded = gt !== null && this.vy >= 0;
    this.groundType = this.grounded ? gt : null;
    if (this.grounded) {
      this.coyote = PHYS.coyote;
      this.hasDoubleJumped = false;
    } else {
      this.coyote = Math.max(0, this.coyote - dt);
    }
    if (input.jumpPressed) this.jumpBuf = PHYS.buffer; else this.jumpBuf = Math.max(0, this.jumpBuf - dt);

    // --- drop through one-way platforms: Down + Jump ---
    if (this.grounded && this.groundType === 'oneway' && input.down && input.jumpPressed) {
      this.dropT = 0.25;
      this.jumpBuf = 0;
      this.grounded = false;
      this.coyote = 0;
      g.sfx('drop');
    }

    // --- grab ladders / ropes ---
    if (this.grabCd <= 0 && (input.up || input.down) && this.tryGrab(g, input)) {
      this.updateClimb(g, input, dt);
      return;
    }

    // --- ground pound ability trigger: Down + Jump in air ---
    if (!this.grounded && !this.climbing && !this.isGroundPounding && input.down && input.jumpPressed && (g.hasAbility ? g.hasAbility('ground_pound') : false)) {
      this.isGroundPounding = true;
      this.jumpBuf = 0;
      this.vx = 0;
      this.vy = ABILITIES.poundSpeed;
      this.dropT = 0;
    }

    // --- double jump ability trigger ---
    if (!this.grounded && !this.climbing && !this.isGroundPounding && this.coyote <= 0 && input.jumpPressed && !this.hasDoubleJumped && (g.hasAbility ? g.hasAbility('double_jump') : false)) {
      this.vy = PHYS.jumpV;
      this.hasDoubleJumped = true;
      this.jumpCuttable = true;
      this.jumpBuf = 0;
      this.sx = 0.78; this.sy = 1.24;
      if (g.sfx) g.sfx('doubleJump');
      if (g.spawnPuffRing) g.spawnPuffRing(this.cx, this.y + this.h);
    }

    // --- normal jump ---
    if (this.jumpBuf > 0 && this.coyote > 0 && !this.isGroundPounding) {
      this.vy = PHYS.jumpV;
      this.jumpBuf = 0;
      this.coyote = 0;
      this.grounded = false;
      this.jumpCuttable = true;
      this.sx = 0.78; this.sy = 1.24;
      g.sfx('jump');
    }
    if (this.jumpCuttable && !input.jumpHeld && this.vy < PHYS.jumpCut) this.vy = PHYS.jumpCut;
    if (this.vy >= 0) this.jumpCuttable = false;

    // --- gravity (fall gravity x1.5, exact integration for constant acceleration) ---
    if (this.dashT > 0) {
      this.vy = 0;
    } else if (this.isGroundPounding) {
      this.vx = 0;
      this.vy = ABILITIES.poundSpeed;
    } else {
      const grav = this.vy > 0 ? PHYS.gravity * PHYS.fallMult : PHYS.gravity;
      const vyNew = Math.min(this.vy + grav * dt, PHYS.maxFall);
      const dy = (this.vy + vyNew) / 2 * dt;
      const impactVy = this.vy;
      this.vy = vyNew;

      if (moveX(w, this, this.vx * dt)) this.vx = 0;
      const res = moveY(w, this, dy, { drop: this.dropT > 0, corner: PHYS.corner });
      if (res.floor) {
        if (this.isGroundPounding) {
          this.isGroundPounding = false;
          if (g.sfx) g.sfx('groundPound');
          if (g.shakeScreen) g.shakeScreen(0.25);
          if (g.groundPoundImpact) g.groundPoundImpact(this.cx, this.y + this.h, ABILITIES.poundStunRadius);
          this.sx = 1.35; this.sy = 0.65;
        } else if (!this.grounded && impactVy > 220) {
          this.sx = 1.28; this.sy = 0.76;
          g.sfx('land');
          if (g.spawnDust) {
            g.spawnDust(this.cx - 8, this.y + this.h);
            g.spawnDust(this.cx + 8, this.y + this.h);
          }
        }
        this.vy = 0;
        this.grounded = true;
        this.jumpCuttable = false;
        this.groundType = probeGround(w, this, false) || 'solid';
      }
      if (res.ceil && this.vy < 0) this.vy = 0;
      return;
    }

    // Move when dashing or ground pounding
    if (moveX(w, this, this.vx * dt)) this.vx = 0;
    const res = moveY(w, this, this.vy * dt, { drop: this.dropT > 0, corner: PHYS.corner });
    if (res.floor) {
      if (this.isGroundPounding) {
        this.isGroundPounding = false;
        if (g.sfx) g.sfx('groundPound');
        if (g.shakeScreen) g.shakeScreen(0.25);
        if (g.groundPoundImpact) g.groundPoundImpact(this.cx, this.y + this.h, ABILITIES.poundStunRadius);
        this.sx = 1.35; this.sy = 0.65;
      }
      this.vy = 0;
      this.grounded = true;
      this.jumpCuttable = false;
      this.groundType = probeGround(w, this, false) || 'solid';
    }
    if (res.ceil && this.vy < 0) this.vy = 0;
  }

  tryGrab(g, input) {
    const w = g.world;
    const col = Math.floor(this.cx / TS);
    const r0 = Math.floor((this.y + 4) / TS), r1 = Math.floor((this.y + this.h - 1) / TS);
    let found = false;
    for (let r = r0; r <= r1; r++) if (w.isClimb(col, r)) { found = true; break; }
    if (!found && input.down && this.grounded) {
      // standing on the top of a ladder: climb down
      const rb = Math.floor((this.y + this.h + 1) / TS);
      if (w.get(col, rb) === 'H') found = true;
    }
    if (!found) return false;

    // find the contiguous climbable span in this column
    let rr = Math.floor((this.y + this.h * 0.5) / TS);
    if (!w.isClimb(col, rr)) rr = r0 <= r1 && w.isClimb(col, r1) ? r1 : (w.isClimb(col, r0) ? r0 : Math.floor((this.y + this.h + 1) / TS));
    let top = rr;
    while (w.isClimb(col, top - 1)) top--;
    this.climbCol = col;
    this.climbTop = top * TS;
    this.climbKind = w.get(col, top);
    this.climbing = true;
    this.x = col * TS + (TS - this.w) / 2;
    this.vx = 0; this.vy = 0;
    this.grounded = false;
    this.jumpCuttable = false;
    g.sfx('grab');
    return true;
  }

  updateClimb(g, input, dt) {
    const w = g.world;
    const dirY = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    this.vx = 0;
    this.vy = dirY * PHYS.climb;

    if (input.jumpPressed) {                      // jump off sideways
      const dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      this.climbing = false;
      this.grabCd = 0.25;
      if (dx !== 0) { this.face = dx; this.vx = dx * PHYS.runMax * 0.95; this.vy = PHYS.jumpV * 0.85; }
      else this.vy = dirY < 0 ? PHYS.jumpV * 0.7 : 0;
      this.jumpCuttable = false;
      this.sx = 0.82; this.sy = 1.18;
      g.sfx('jump');
      return;
    }

    const res = moveY(w, this, this.vy * dt, { ignoreLadderTop: true });
    if (dirY !== 0) this.climbPhase += dt * 9;

    if (res.floor && dirY > 0) {                  // reached ground at the bottom
      this.climbing = false;
      this.grounded = true;
      this.vy = 0;
      return;
    }
    // top of the climbable span
    if (this.y + this.h <= this.climbTop) {
      this.y = this.climbTop - this.h;
      if (this.climbKind === 'H') {               // ladder: step onto the top surface
        this.climbing = false;
        this.grounded = true;
        this.vy = 0;
        this.grabCd = 0.15;
        return;
      }
      this.vy = 0;                                // rope: hang at the top
      return;
    }
    // fell off the bottom end of a rope
    if (dirY > 0) {
      let any = false;
      const r0 = Math.floor((this.y + 2) / TS), r1 = Math.floor((this.y + this.h - 0.5) / TS);
      for (let r = r0; r <= r1; r++) if (w.isClimb(this.climbCol, r)) { any = true; break; }
      if (!any) {
        this.climbing = false;
        this.grabCd = 0.2;
        this.vy = 0;
      }
    }
  }

  updateKnife(g, input) {
    if (input.knifePressed && this.knifeCd <= 0 && this.hurtT <= 0) {
      this.knifeCd = COMBAT.slashCooldown;
      this.slashT = COMBAT.slashTime;
      this.slashDown = !this.grounded && !this.climbing && input.down;
      this.slashHit = new Set();
      g.sfx('knifeSwish');
      if (this.powerup?.type === 'fire_knife' && g.fireFlameWave) {
        g.fireFlameWave(this);
      }
    }
    if (this.slashT > 0) g.resolveSlash(this, this.slashBox());
  }

  slashBox() {
    if (this.slashDown) {
      return { x: this.cx - 11, y: this.y + this.h - 8, w: COMBAT.slashH, h: COMBAT.slashW };
    }
    const bx = this.face > 0 ? this.x + this.w - 4 : this.x - COMBAT.slashW + 4;
    return { x: bx, y: this.cy - COMBAT.slashH / 2, w: COMBAT.slashW, h: COMBAT.slashH };
  }

  /** Bounce off an enemy / crate with a down-slash or a stomp. */
  bounce(vy) {
    this.vy = vy;
    this.grounded = false;
    this.climbing = false;
    this.jumpCuttable = false;
    this.hasDoubleJumped = false;
    this.isGroundPounding = false;
    this.sx = 0.8; this.sy = 1.22;
  }

  hurt(g, srcX) {
    if (this.invuln > 0) return false;
    if (this.powerup?.type === 'bubble_shield') {
      this.powerup = null;
      if (g.sfx) g.sfx('shieldPop');
      if (g.poof) g.poof(this.cx, this.cy, '#60a5fa');
      this.bounce(-320);
      this.invuln = 0.6;
      return false;
    }
    this.hearts--;
    this.invuln = COMBAT.invuln;
    this.hurtT = 0.28;
    this.climbing = false;
    this.grabCd = 0.3;
    this.vx = (this.cx >= srcX ? 1 : -1) * 170;
    this.vy = -290;
    this.grounded = false;
    this.sx = 1.2; this.sy = 0.85;
    g.sfx('hurt');
    g.onHeroHurt();
    return true;
  }

  updateVisuals(dt) {
    this.sx += (1 - this.sx) * Math.min(1, dt * 14);
    this.sy += (1 - this.sy) * Math.min(1, dt * 14);
    if (this.grounded && Math.abs(this.vx) > 20) this.runPhase += dt * (6 + Math.abs(this.vx) / 25);
    else if (this.grounded) this.runPhase = 0;
    this.blinkT -= dt;
    if (this.blinkT < -0.12) this.blinkT = 1.8 + Math.random() * 2.5;
  }
}
