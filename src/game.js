/**
 * Gatebreaker — game logic (DOM-free). Rendering/UI/audio hook in through callbacks.
 */
import { TS, VIEW_W, VIEW_H, COMBAT } from './constants.js';
import { aabb, moveY } from './physics.js';
import { Player } from './player.js';
import { MushroomWalker } from './enemies.js';
import { Coin, Key, Gate } from './items.js';
import { parseLevel } from './level.js';

export class Game {
  /**
   * @param {object} opts  sfx(name), toast(text), onComplete(stats), onGameOver(), onHud()
   */
  constructor(opts = {}) {
    this.sfx = opts.sfx || (() => {});
    this.toast = opts.toast || (() => {});
    this.onComplete = opts.onComplete || (() => {});
    this.onGameOver = opts.onGameOver || (() => {});
    this.player = new Player();
    this.infiniteLives = false;
    this.state = 'idle';
  }

  load(levelDef) {
    const lv = parseLevel(levelDef);
    this.level = lv;
    this.world = lv.world;
    this.def = levelDef;
    this.coins = lv.coins.map(c => new Coin(c.x, c.y));
    this.enemies = lv.walkers.map(m => new MushroomWalker(m.x, m.feetY));
    this.key = lv.key ? new Key(lv.key.x, lv.key.y) : null;
    this.gate = lv.gate ? new Gate(lv.gate.c, lv.gate.r) : null;
    this.checkpoint = { x: lv.start.x, feetY: lv.start.feetY };
    this.particles = [];
    this.texts = [];
    this.bridges = buildBridges(this.world);
    this.coinCount = 0;
    this.score = 0;
    this.time = 0;
    this.player.hearts = 3;
    this.player.lives = 3;
    this.player.hasKey = false;
    this.player.place(lv.start.x, lv.start.feetY);
    this.cam = { x: 0, y: 0, fx: lv.start.x, fy: lv.start.feetY - 60 };
    this.snapCamera();
    this.state = 'playing';
    this.shake = 0;
  }

  restart() { this.load(this.def); }

  // ---------------------------------------------------------------- update
  update(input, dt) {
    if (this.state !== 'playing') {
      this.updateEffects(dt);
      return;
    }
    this.time += dt;
    const p = this.player;

    p.update(this, input, dt);
    this.updateBridges(dt);

    for (const e of this.enemies) e.update(this, dt);
    this.resolveEnemyContacts();

    for (const c of this.coins) {
      c.update(this, dt);
      if (c.pickable && aabb(p, c)) this.collectCoin(c);
    }

    if (this.key) {
      this.key.update(this, dt);
      this.updateKey();
    }
    if (this.gate) {
      this.gate.update(this, dt);
      this.updateGate();
    }

    this.updateEffects(dt);
    this.updateCamera(dt);
  }

  updateEffects(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const q = this.particles[i];
      q.life -= dt;
      if (q.life <= 0) { this.particles.splice(i, 1); continue; }
      q.vy += (q.g ?? 600) * dt;
      q.x += q.vx * dt; q.y += q.vy * dt;
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt; t.y -= 28 * dt;
      if (t.life <= 0) this.texts.splice(i, 1);
    }
    this.shake = Math.max(0, this.shake - dt * 30);
  }

  // ---------------------------------------------------------------- interactions
  resolveSlash(p, box) {
    // enemies
    for (const e of this.enemies) {
      if (e.dead || p.slashHit.has(e) || !aabb(box, e)) continue;
      p.slashHit.add(e);
      this.sfx('knifeHit');
      e.hit(this, 1, p.face);
      if (p.slashDown) p.bounce(COMBAT.pogoV);
    }
    // crates
    const c0 = Math.floor(box.x / TS), c1 = Math.floor((box.x + box.w - 0.001) / TS);
    const r0 = Math.floor(box.y / TS), r1 = Math.floor((box.y + box.h - 0.001) / TS);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (this.world.get(c, r) === 'X') {
          this.breakCrate(c, r);
          if (p.slashDown) p.bounce(COMBAT.pogoV);
        }
      }
    }
  }

  breakCrate(c, r) {
    this.world.set(c, r, '.');
    this.sfx('crateSmash');
    const cx = (c + 0.5) * TS, cy = (r + 0.5) * TS;
    for (let i = 0; i < 9; i++) {
      this.particles.push({
        x: cx + (Math.random() - 0.5) * 20, y: cy + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 220, vy: -80 - Math.random() * 200,
        life: 0.6 + Math.random() * 0.3, size: 3 + Math.random() * 3,
        color: Math.random() < 0.5 ? '#c98a4b' : '#8a5a2b', g: 900
      });
    }
    for (let i = 0; i < 3; i++) {
      const coin = new Coin(cx, cy - 6, true);
      coin.vx = (i - 1) * 90; coin.vy = -300 - Math.random() * 80;
      this.coins.push(coin);
    }
  }

  resolveEnemyContacts() {
    const p = this.player;
    for (const e of this.enemies) {
      if (e.dead || !aabb(p, e)) continue;
      const stomp = p.vy > 0 && p.prevBottom <= e.y + 10 && e.stompable;
      if (stomp) {
        e.hit(this, 1, 0);
        p.bounce(-430);
        this.sfx('stomp');
      } else if (p.hurt(this, e.x + e.w / 2)) {
        // hurt handled via callbacks
      }
    }
  }

  collectCoin(c) {
    c.collected = true;
    this.coinCount++;
    this.sfx('coin');
    this.addScore(10, c.x + c.w / 2, c.y - 4, true);
    if (this.coinCount % 100 === 0) {
      this.player.lives++;
      this.toast('100 coins — extra life!');
    }
  }

  updateKey() {
    const k = this.key, p = this.player;
    if (k.state === 'rest' && aabb(p, k)) {
      k.state = 'carried';
      p.hasKey = true;
      this.sfx('keyCollect');
      this.toast('Key found! Reach the gate →');
      this.poof(k.x + k.w / 2, k.y + k.h / 2, '#fcd34d');
    } else if (k.state === 'dropped' && k.immune <= 0 && aabb(p, k)) {
      k.state = 'carried';
      p.hasKey = true;
      this.sfx('keyCollect');
    }
  }

  dropKey() {
    const k = this.key;
    if (!k || k.state !== 'carried') return;
    k.state = 'dropped';
    k.timer = 5;
    k.immune = 0.7;
    k.vy = -260;
    k.vx = -this.player.face * 90;
    this.player.hasKey = false;
    this.toast('You dropped the key! Grab it within 5 s');
  }

  updateGate() {
    const gt = this.gate, p = this.player;
    if (gt.state !== 'closed' || !aabb(p, gt)) return;
    if (p.hasKey) {
      gt.state = 'opening';
      p.hasKey = false;
      this.key.state = 'rest';
      this.key.x = -9999; this.key.y = -9999;       // consumed by the gate
      this.key = null;
      this.sfx('gateUnlock');
      this.toast('The key turns…');
    } else if (gt.lockedMsgCd <= 0) {
      gt.lockedMsgCd = 2.5;
      this.toast('Locked — find the key!');
      this.sfx('locked');
    }
  }

  completeLevel() {
    if (this.state !== 'playing') return;
    this.state = 'complete';
    this.sfx('levelClear');
    this.onComplete({
      time: this.time, coins: this.coinCount, score: this.score,
      target: this.level.targetTime, coinsTotal: this.level.coins.length
    });
  }

  // ---------------------------------------------------------------- damage / lives
  onHeroHurt() {
    this.shake = 6;
    if (this.player.hasKey) this.dropKey();
    if (this.player.hearts <= 0) this.lifeLost();
  }

  playerFell() {
    const p = this.player;
    p.hearts--;
    this.sfx('hurt');
    if (p.hasKey) { this.key.returnHome(); p.hasKey = false; }
    else if (this.key && this.key.state === 'dropped') { /* handled by key */ }
    if (p.hearts <= 0) this.lifeLost();
    else this.respawn();
  }

  lifeLost() {
    const p = this.player;
    if (!this.infiniteLives) p.lives--;
    if (p.lives <= 0) {
      this.state = 'gameover';
      this.sfx('gameOver');
      this.onGameOver();
      return;
    }
    p.hearts = 3;
    this.toast('Lost a life — try again!');
    this.respawn();
  }

  respawn() {
    const p = this.player;
    const hearts = p.hearts, lives = p.lives, hasKey = p.hasKey;
    p.place(this.checkpoint.x, this.checkpoint.feetY);
    p.hearts = hearts; p.lives = lives; p.hasKey = hasKey;
    p.invuln = 1.6;
    this.snapCamera();
  }

  // ---------------------------------------------------------------- bridges (visual sag + bounce)
  updateBridges(dt) {
    const p = this.player;
    p.visDy = 0;
    for (const b of this.bridges) {
      const x0 = b.c0 * TS, x1 = (b.c1 + 1) * TS;
      const onThis = p.grounded && p.groundType === 'oneway' &&
        Math.abs((p.y + p.h) - b.row * TS) < 1.5 && p.cx > x0 && p.cx < x1;
      const t = onThis ? (p.cx - x0) / (x1 - x0) : 0.5;
      const target = onThis ? 7 : 0;
      if (onThis && !b.wasOn) { b.vel += 70; this.sfx('creak'); }
      b.wasOn = onThis;
      // damped spring toward target dip
      const k = 140, c = 9;
      b.vel += ((target - b.dip) * k - b.vel * c) * dt;
      b.dip += b.vel * dt;
      b.focusT = t;
      if (onThis) p.visDy = bridgeSag(b, p.cx);
    }
  }

  // ---------------------------------------------------------------- camera
  snapCamera() {
    const p = this.player;
    this.cam.fx = p.cx; this.cam.fy = p.cy;
    this.applyCamera();
  }

  updateCamera(dt) {
    const p = this.player, cam = this.cam;
    const dzx = 56, dzy = 36;
    let tx = cam.fx, ty = cam.fy;
    if (p.cx - cam.fx > dzx) tx = p.cx - dzx; else if (cam.fx - p.cx > dzx) tx = p.cx + dzx;
    if (p.cy - cam.fy > dzy) ty = p.cy - dzy; else if (cam.fy - p.cy > dzy) ty = p.cy + dzy;
    // look-ahead: facing direction when moving, vertical by velocity (look further down while falling)
    const lookX = Math.abs(p.vx) > 30 ? p.face * 46 : 0;
    const lookY = Math.max(-70, Math.min(110, p.vy * 0.2)) + (p.climbing ? p.vy * 0.25 : 0);
    tx += lookX; ty += lookY;
    const k = 1 - Math.exp(-5.5 * dt);
    cam.fx += (tx - cam.fx) * k;
    cam.fy += (ty - cam.fy) * k;
    this.applyCamera();
  }

  applyCamera() {
    const cam = this.cam, w = this.world;
    cam.x = Math.max(0, Math.min(w.w - VIEW_W, cam.fx - VIEW_W / 2));
    cam.y = Math.max(0, Math.min(w.h - VIEW_H, cam.fy - VIEW_H / 2));
    if (w.w <= VIEW_W) cam.x = (w.w - VIEW_W) / 2;
    if (w.h <= VIEW_H) cam.y = (w.h - VIEW_H) / 2;
  }

  // ---------------------------------------------------------------- effects
  poof(x, y, color = '#f5f5f4') {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      this.particles.push({
        x, y, vx: Math.cos(a) * (60 + Math.random() * 80), vy: Math.sin(a) * (60 + Math.random() * 80) - 40,
        life: 0.45 + Math.random() * 0.2, size: 3 + Math.random() * 3, color, g: 200
      });
    }
  }

  addScore(n, x, y, small = false) {
    this.score += n;
    this.texts.push({ x, y, text: small ? `+${n}` : `+${n}`, life: small ? 0.5 : 0.9, small });
  }
}

// ---- rope-bridge helpers ----
function buildBridges(world) {
  const runs = [];
  for (let r = 0; r < world.rowCount; r++) {
    let c = 0;
    while (c < world.cols) {
      if (world.get(c, r) === '~') {
        const c0 = c;
        while (world.get(c + 1, r) === '~') c++;
        runs.push({ row: r, c0, c1: c, dip: 0, vel: 0, wasOn: false, focusT: 0.5 });
      }
      c++;
    }
  }
  return runs;
}

export function bridgeSag(b, x) {
  const x0 = b.c0 * TS, x1 = (b.c1 + 1) * TS;
  const t = Math.max(0, Math.min(1, (x - x0) / (x1 - x0)));
  const base = Math.min(8, (b.c1 - b.c0 + 1) * 1.2);
  return (base + b.dip) * Math.sin(Math.PI * t);
}
