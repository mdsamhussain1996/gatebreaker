/**
 * Gatebreaker — game logic (DOM-free). Rendering/UI/audio hook in through callbacks.
 */
import { TS, VIEW_W, VIEW_H, COMBAT } from './constants.js';
import { aabb, moveY } from './physics.js';
import { Player } from './player.js';
import { MushroomWalker, SpikyHedgehog, MushroomKing } from './enemies.js';
import { Coin, Gem, Star, HeartPickup, Chest, Checkpoint, Spikes, Key, Gate } from './items.js';
import { parseLevel } from './level.js';
import { getTheme } from './themes.js';

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
    this.theme = getTheme(lv.theme);
    this.def = levelDef;

    this.coins = lv.coins.map(c => new Coin(c.x, c.y));
    this.gems = lv.gems.map(g => new Gem(g.x, g.y));
    this.stars = lv.stars.map(s => new Star(s.x, s.y, s.index));
    this.hearts = lv.hearts.map(h => new HeartPickup(h.x, h.y));
    this.chests = lv.chests.map(ch => new Chest(ch.c, ch.r));
    this.checkpoints = lv.checkpoints.map(cp => new Checkpoint(cp.c, cp.r));
    this.spikes = lv.spikes.map(sp => new Spikes(sp.c, sp.r));

    // Enemies & Bosses
    this.enemies = [
      ...lv.walkers.map(m => new MushroomWalker(m.x, m.feetY)),
      ...lv.hedgehogs.map(s => new SpikyHedgehog(s.x, s.feetY)),
      ...lv.bosses.map(b => new MushroomKing(b.x, b.feetY))
    ];

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
    if (!this.infiniteLives && this.player.lives <= 0) this.player.lives = 3;
    this.player.hasKey = false;
    this.player.place(lv.start.x, lv.start.feetY);
    this.cam = { x: 0, y: 0, fx: lv.start.x, fy: lv.start.feetY - 60 };
    this.snapCamera();
    this.state = 'playing';
    this.shake = 0;
  }

  restart() { this.load(this.def); }

  get boss() {
    return this.enemies.find(e => e.isBoss && !e.dead) || null;
  }

  get bosses() {
    return this.enemies.filter(e => e.isBoss);
  }

  get hedgehogs() {
    return this.enemies.filter(e => e instanceof SpikyHedgehog);
  }

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

    // Update enemies
    for (const e of this.enemies) e.update(this, dt);
    this.resolveEnemyContacts();

    // Pickups & Items
    for (const c of this.coins) {
      c.update(this, dt);
      if (c.pickable && aabb(p, c)) this.collectCoin(c);
    }
    for (const g of this.gems) {
      g.update(this, dt);
      if (g.pickable && aabb(p, g)) this.collectGem(g);
    }
    for (const s of this.stars) {
      s.update(this, dt);
      if (s.pickable && aabb(p, s)) this.collectStar(s);
    }
    for (const h of this.hearts) {
      h.update(this, dt);
      if (h.pickable && aabb(p, h)) this.collectHeart(h);
    }
    for (const cp of this.checkpoints) {
      cp.update(this, dt);
      if (!cp.active && aabb(p, cp)) cp.activate(this);
    }
    for (const sp of this.spikes) {
      if (aabb(p, sp)) {
        if (p.hurt(this, p.cx)) {
          p.bounce(-340);
        }
      }
    }
    for (const ch of this.chests) ch.update(this, dt);

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
    // Enemies & Bosses
    for (const e of this.enemies) {
      if (e.dead || p.slashHit.has(e) || !aabb(box, e)) continue;
      p.slashHit.add(e);
      this.sfx('knifeHit');
      e.hit(this, 1, p.face);
      if (p.slashDown) p.bounce(COMBAT.pogoV);
    }
    // Chests
    for (const ch of this.chests) {
      if (!ch.opened && aabb(box, ch)) {
        ch.open(this);
        if (p.slashDown) p.bounce(COMBAT.pogoV);
      }
    }
    // Crates
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
      const stomp = p.vy > 0 && p.prevBottom <= e.y + 12 && e.stompable;
      if (stomp) {
        e.hit(this, 1, 0);
        p.bounce(-430);
        this.sfx('stomp');
      } else if (p.hurt(this, e.x + e.w / 2)) {
        // hurt handled via player.hurt
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

  collectGem(g) {
    g.collected = true;
    this.coinCount += 5;
    this.sfx('gem');
    this.addScore(50, g.x + g.w / 2, g.y - 4, true);
    this.poof(g.x + g.w / 2, g.y + g.h / 2, '#c084fc');
  }

  collectStar(s) {
    s.collected = true;
    this.sfx('star');
    const collectedCount = this.stars.filter(st => st.collected).length;
    this.addScore(500, s.x + s.w / 2, s.y - 4, true);
    this.poof(s.x + s.w / 2, s.y + s.h / 2, '#fbbf24');
    this.toast(`Star collected! (${collectedCount}/3) ★`);
  }

  collectHeart(h) {
    if (this.player.hearts >= 3) return;
    h.collected = true;
    this.player.hearts = Math.min(3, this.player.hearts + 1);
    this.sfx('heart');
    this.poof(h.x + h.w / 2, h.y + h.h / 2, '#ef4444');
    this.toast('Heart restored! ♥');
  }

  updateKey() {
    const k = this.key, p = this.player;
    if (!k) return;
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
    if (!gt || gt.state !== 'closed' || !aabb(p, gt)) return;
    if (p.hasKey) {
      gt.state = 'opening';
      p.hasKey = false;
      if (this.key) {
        this.key.state = 'rest';
        this.key.x = -9999; this.key.y = -9999;
        this.key = null;
      }
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
    const starsEarned = this.stars.filter(s => s.collected).length;
    this.onComplete({
      levelId: this.def.id,
      world: this.def.world || 1,
      name: this.def.name,
      time: this.time,
      coins: this.coinCount,
      score: this.score,
      stars: starsEarned,
      target: this.level.targetTime,
      coinsTotal: this.level.coins.length
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
    if (p.hasKey && this.key) { this.key.returnHome(); p.hasKey = false; }
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

  // ---------------------------------------------------------------- bridges
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
    const lookX = Math.abs(p.vx) > 30 ? p.face * 46 : 0;
    const lookY = p.vy > 250 ? 50 : (p.vy < -250 ? -30 : 0);
    cam.fx += ((tx + lookX) - cam.fx) * (dt * 5);
    cam.fy += ((ty + lookY) - cam.fy) * (dt * 5);
    this.applyCamera();
  }

  applyCamera() {
    const p = this.player, cam = this.cam;
    const cx = cam.fx - VIEW_W / 2;
    const cy = cam.fy - VIEW_H / 2;
    const maxX = Math.max(0, this.world.w - VIEW_W);
    const maxY = Math.max(0, this.world.h - VIEW_H);
    cam.x = Math.max(0, Math.min(maxX, cx));
    cam.y = Math.max(0, Math.min(maxY, cy));
  }

  addScore(pts, x, y, floater = false) {
    this.score += pts;
    if (floater) this.texts.push({ text: `+${pts}`, x, y, life: 0.65 });
  }

  poof(x, y, color = '#fcd34d') {
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 40 + Math.random() * 120;
      this.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 0.35 + Math.random() * 0.25, size: 3 + Math.random() * 3,
        color, g: 150
      });
    }
  }
}

export function buildBridges(world) {
  const list = [];
  for (let r = 0; r < world.rowCount; r++) {
    let inBridge = false, c0 = 0;
    for (let c = 0; c <= world.cols; c++) {
      const isB = c < world.cols && world.get(c, r) === '~';
      if (isB && !inBridge) { inBridge = true; c0 = c; }
      else if (!isB && inBridge) {
        list.push({ row: r, c0, c1: c - 1, dip: 0, vel: 0, focusT: 0.5, wasOn: false });
        inBridge = false;
      }
    }
  }
  return list;
}

export function bridgeSag(bridge, heroX) {
  const x0 = bridge.c0 * TS, x1 = (bridge.c1 + 1) * TS;
  const t = Math.max(0, Math.min(1, (heroX - x0) / (x1 - x0)));
  return 4 * t * (1 - t) * bridge.dip;
}
