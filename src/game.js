/**
 * Gatebreaker — game logic (DOM-free). Rendering/UI/audio hook in through callbacks.
 */
import { TS, VIEW_W, VIEW_H, COMBAT } from './constants.js';
import { aabb, moveY } from './physics.js';
import { Player } from './player.js';
import {
  MushroomWalker, SpikyHedgehog, MushroomKing,
  AcornSquirrel, SnapvinePlant, OldOakGuardian,
  Scorpion, SandWorm, SandWyrm,
  BuzzBee, NightBat, HopperFrog, WildBoar,
  LeafGlider, RollingArmadillo, DesertHawk, SpinningSaw
} from './enemies.js';
import {
  Coin, Gem, Star, HeartPickup, Chest, Checkpoint, Spikes, Key, Gate,
  Spring, MovingPlank, CraneLift, CrumblingPlank,
  POWERUP_DEFS, PowerOrb, BlasterBolt, FlameWave, IceBlock
} from './items.js';
import { parseLevel } from './level.js';
import { getTheme } from './themes.js';
import { hasAbility } from './save.js';

export class Game {
  /**
   * @param {object} opts  sfx(name), toast(text), onComplete(stats), onGameOver(), onHud()
   */
  constructor(opts = {}) {
    this.sfx = opts.sfx || (() => {});
    this.toast = opts.toast || (() => {});
    this.onComplete = opts.onComplete || (() => {});
    this.onGameOver = opts.onGameOver || (() => {});
    this.abilities = opts.abilities || null;
    this.player = new Player();
    this.infiniteLives = false;
    this.state = 'idle';
    this.hitStop = 0;
    this.superMeter = 0;
    this.shockwave = null;
    this.afterimages = [];
    this.powerOrbs = [];
    this.iceBlocks = [];
    this.shakeEnabled = true;
  }

  load(levelDef) {
    const lv = parseLevel(levelDef);
    this.level = lv;
    this.world = lv.world;
    this.theme = getTheme(lv.theme);
    this.def = levelDef;
    this.hitStop = 0;

    this.coins = lv.coins.map(c => new Coin(c.x, c.y));
    this.gems = lv.gems.map(g => new Gem(g.x, g.y));
    this.stars = lv.stars.map(s => new Star(s.x, s.y, s.index));
    this.hearts = lv.hearts.map(h => new HeartPickup(h.x, h.y));
    this.chests = lv.chests.map(ch => new Chest(ch.c, ch.r));
    this.checkpoints = lv.checkpoints.map(cp => new Checkpoint(cp.c, cp.r));
    this.spikes = lv.spikes.map(sp => new Spikes(sp.c, sp.r));
    this.springs = lv.springs.map(s => new Spring(s.c, s.r));
    this.movingPlanks = lv.movingPlanks.map(m => new MovingPlank(m.c, m.r, m));
    this.lifts = lv.lifts.map(l => new CraneLift(l.c, l.r, l));
    this.crumblingPlanks = lv.crumblingPlanks.map(b => new CrumblingPlank(b.c, b.r));
    this.powerOrbs = (lv.powerOrbs || []).map(q => new PowerOrb(q.x, q.y, q.powerType || (q.type !== 'powerOrb' ? q.type : 'blaster')));
    this.projectiles = [];
    this.iceBlocks = [];
    this.afterimages = [];
    this.superMeter = 0;
    this.shockwave = null;

    // Enemies & Bosses
    this.enemies = [
      ...lv.walkers.map(m => new MushroomWalker(m.x, m.feetY)),
      ...lv.hedgehogs.map(s => new SpikyHedgehog(s.x, s.feetY)),
      ...lv.squirrels.map(q => new AcornSquirrel(q.x, q.feetY)),
      ...lv.snapvines.map(v => new SnapvinePlant(v.x, v.feetY)),
      ...lv.scorpions.map(y => new Scorpion(y.x, y.feetY)),
      ...lv.sandWorms.map(w => new SandWorm(w.x, w.feetY)),
      ...lv.buzzBees.map(z => new BuzzBee(z.x, z.y, z.span || 160)),
      ...lv.nightBats.map(n => new NightBat(n.x, n.ceilingY)),
      ...lv.hopperFrogs.map(f => new HopperFrog(f.x, f.feetY)),
      ...lv.wildBoars.map(b => new WildBoar(b.x, b.feetY)),
      ...lv.leafGliders.map(l => new LeafGlider(l.x, l.y, l.rangeX || 220, l.rangeY || 280)),
      ...lv.armadillos.map(a => new RollingArmadillo(a.x, a.feetY)),
      ...lv.desertHawks.map(k => new DesertHawk(k.x, k.skyY)),
      ...lv.spinningSaws.map(i => new SpinningSaw(i.c0, i.r0, i.c1, i.r1, i.speed || 120)),
      ...lv.bosses.map(b => {
        if (b.type === 'oak_guardian') return new OldOakGuardian(b.x, b.feetY);
        if (b.type === 'sand_wyrm') return new SandWyrm(b.x, b.feetY);
        return new MushroomKing(b.x, b.feetY);
      })
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

  hasAbility(name) {
    return (this.abilities && this.abilities.includes(name)) || hasAbility(name);
  }

  // ---------------------------------------------------------------- update
  update(input, dt) {
    if (this.state !== 'playing') {
      this.updateEffects(dt);
      return;
    }

    // 50ms hit-stop on kills
    if (this.hitStop > 0) {
      this.hitStop -= dt;
      this.updateEffects(dt);
      return;
    }

    this.time += dt;
    const p = this.player;

    p.update(this, input, dt);
    this.updateBridges(dt);

    // Update enemies with off-screen sleep (> 1.5 screens) & max 6 active moving enemies on screen rule
    let activeMovingCount = 0;
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.sleep = typeof e.isAsleep === 'function' ? e.isAsleep(this) : false;
      if (e.sleep) continue;
      if (e.isMovingEnemy) {
        if (activeMovingCount >= 6) continue;
        activeMovingCount++;
      }
      e.update(this, dt);
    }
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

    // Springs
    for (const sp of this.springs) {
      sp.update(this, dt);
      if (aabb(p, sp) && p.vy > 0 && (p.y + p.h) <= sp.y + 14) {
        sp.bounce(p, this);
      }
    }

    // Crumbling Planks
    for (const cp of this.crumblingPlanks) {
      cp.update(this, dt);
      if (cp.active && aabb(p, cp) && p.vy >= 0 && (p.y + p.h) <= cp.y + 10) {
        p.grounded = true;
        p.vy = 0;
        p.y = cp.y - p.h;
        cp.stepOn(this);
      }
    }

    // Moving Planks
    for (const mp of this.movingPlanks) {
      mp.update(this, dt);
      if (p.vy >= 0 && (p.y + p.h) >= mp.y && (p.y + p.h) <= mp.y + 14 && p.x + p.w > mp.x && p.x < mp.x + mp.w) {
        p.grounded = true;
        p.vy = 0;
        p.y = mp.y - p.h;
        p.x += mp.dx;
        p.y += mp.dy;
      }
    }

    // Crane Lifts
    for (const cl of this.lifts) {
      cl.update(this, dt);
      if (p.vy >= 0 && (p.y + p.h) >= cl.y && (p.y + p.h) <= cl.y + 14 && p.x + p.w > cl.x && p.x < cl.x + cl.w) {
        p.grounded = true;
        p.vy = 0;
        p.y = cl.y - p.h;
        p.y += cl.dy;
      }
    }

    // Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.update(this, dt);
      if (pr.dead) this.projectiles.splice(i, 1);
    }

    // Power Orbs
    for (const po of this.powerOrbs) {
      po.update(this, dt);
      if (po.pickable && aabb(p, po)) this.collectPowerOrb(po);
    }

    // Ice Blocks
    for (let i = this.iceBlocks.length - 1; i >= 0; i--) {
      const ib = this.iceBlocks[i];
      ib.update(this, dt);
      if (ib.dead) this.iceBlocks.splice(i, 1);
      else if (p.vy >= 0 && (p.y + p.h) >= ib.y && (p.y + p.h) <= ib.y + 14 && p.x + p.w > ib.x && p.x < ib.x + ib.w) {
        p.grounded = true;
        p.vy = 0;
        p.y = ib.y - p.h;
      }
    }

    // Afterimages
    for (let i = this.afterimages.length - 1; i >= 0; i--) {
      const a = this.afterimages[i];
      a.life -= dt;
      if (a.life <= 0) this.afterimages.splice(i, 1);
    }

    // Shockwave burst
    if (this.shockwave) {
      this.shockwave.life -= dt;
      this.shockwave.r += (this.shockwave.maxR - this.shockwave.r) * dt * 8;
      if (this.shockwave.life <= 0) this.shockwave = null;
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
    // Enemies & Bosses
    for (const e of this.enemies) {
      if (e.dead || p.slashHit.has(e) || !aabb(box, e)) continue;
      p.slashHit.add(e);
      this.sfx('knifeHit');
      const prevHp = e.hp;
      e.hit(this, 1, p.face);
      if (p.powerup?.type === 'ice_knife' && (e.dead || prevHp <= 1)) {
        this.iceBlocks.push(new IceBlock(e.x, e.y, e.w, e.h, 5));
        this.sfx('freezeCrack');
      }
      if (p.slashDown) p.bounce(COMBAT.pogoV);
    }
    // Deflect / destroy projectiles
    for (const pr of this.projectiles) {
      if (!pr.dead && aabb(box, pr)) {
        pr.dead = true;
        this.sfx('knifeHit');
        this.poof(pr.x, pr.y, '#f59e0b');
      }
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

      // Star Power: kills enemies on touch
      if (p.powerup?.type === 'star_power') {
        e.hit(this, 99, p.face);
        this.sfx('knifeHit');
        continue;
      }

      // Giant Rook: walks through / smashes small enemies on touch
      if (p.powerup?.type === 'giant_rook' && !e.isBoss) {
        e.hit(this, 3, p.face);
        this.sfx('stomp');
        continue;
      }

      // Special contact: Leaf Glider is harmless from above (hero bounces on it)
      if (e.type === 'leaf_glider') {
        if (p.vy >= 0 && p.prevBottom <= e.y + 14) {
          p.bounce(-390);
          this.sfx('pogo');
          continue;
        }
      }

      // Special contact: Wild Boar charge front deflects stomps unless stunned
      if (e.type === 'wild_boar') {
        if (e.state === 'stunned') {
          if (p.vy > 0 && p.prevBottom <= e.y + 14) {
            e.hit(this, 1, 0);
            p.bounce(-430);
            this.sfx('stomp');
            continue;
          }
        }
      }

      // Special contact: Rolling Armadillo while rolling deflects stomps
      if (e.type === 'rolling_armadillo' && e.state === 'roll') {
        p.hurt(this, e.x + e.w / 2);
        continue;
      }

      // Special contact: Spinning Saw is an indestructible obstacle
      if (e.type === 'spinning_saw') {
        p.hurt(this, e.x + e.w / 2);
        continue;
      }

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
    this.addSuper(2);
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
    this.addSuper(20);
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
    // On touch devices, shift camera view so hero is centered further up and right, clear of touch controls
    const isTouch = typeof document !== 'undefined' && document.body && document.body.classList.contains('touch-device');
    const touchOffsetX = isTouch ? -45 : 0;
    const touchOffsetY = isTouch ? 45 : 0;

    const cx = (cam.fx + touchOffsetX) - VIEW_W / 2;
    const cy = (cam.fy + touchOffsetY) - VIEW_H / 2;
    const maxX = Math.max(0, this.world.w - VIEW_W);
    const maxY = Math.max(0, this.world.h - VIEW_H);
    cam.x = Math.max(0, Math.min(maxX, cx));
    cam.y = Math.max(0, Math.min(maxY, cy));
  }

  addScore(pts, x, y, floater = false) {
    this.score += pts;
    if (pts >= 100) this.addSuper(15);
    if (floater) this.texts.push({ text: `+${pts}`, x, y, life: 0.65 });
  }

  addSuper(pts) {
    this.superMeter = Math.min(100, (this.superMeter || 0) + pts);
  }

  collectPowerOrb(po) {
    po.collected = true;
    const def = POWERUP_DEFS[po.type] || POWERUP_DEFS.blaster;
    this.player.powerup = {
      type: po.type,
      duration: def.duration,
      maxDuration: def.duration,
      ammo: def.ammo,
      maxAmmo: def.ammo,
      icon: def.icon,
      name: def.name,
      color: def.color
    };
    if (po.type === 'giant_rook') this.player.giantScale = 1.6;
    this.sfx('powerup');
    this.poof(po.x + po.w / 2, po.y + po.h / 2, def.color);
    this.toast(`Power-up: ${def.name}! ${def.icon}`);
  }

  fireBlaster(p) {
    const bx = p.face > 0 ? p.x + p.w + 4 : p.x - 4;
    this.projectiles.push(new BlasterBolt(bx, p.cy, p.face));
    this.sfx('blasterLaser');
    for (let i = 0; i < 4; i++) {
      this.particles.push({
        x: bx, y: p.cy,
        vx: p.face * (100 + Math.random() * 80),
        vy: (Math.random() - 0.5) * 60,
        life: 0.15, size: 3, color: '#38bdf8', g: 0
      });
    }
  }

  fireFlameWave(p) {
    const bx = p.face > 0 ? p.x + p.w + 4 : p.x - 4;
    this.projectiles.push(new FlameWave(bx, p.cy, p.face));
    this.sfx('flameWave');
  }

  triggerShockwave(p) {
    this.sfx('superBlast');
    this.shakeScreen(0.4);
    this.shockwave = { x: p.cx, y: p.cy, r: 20, maxR: VIEW_W * 0.9, life: 0.6, maxLife: 0.6 };
    const camX = this.cam.x, camY = this.cam.y;
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (e.x + e.w >= camX && e.x <= camX + VIEW_W && e.y + e.h >= camY && e.y <= camY + VIEW_H) {
        if (e.isBoss) {
          e.hit(this, 2, 0);
        } else {
          e.hit(this, 3, 0);
        }
        this.poof(e.cx, e.cy, '#eab308');
      }
    }
    this.superMeter = 0;
    this.toast('⚡ Shockwave Burst! ⚡');
  }

  groundPoundImpact(x, y, radius = 64) {
    const c0 = Math.floor((x - radius) / TS), c1 = Math.floor((x + radius) / TS);
    const r0 = Math.floor((y - 4) / TS), r1 = Math.floor((y + TS) / TS);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (this.world.get(c, r) === 'X') {
          this.breakCrate(c, r);
        }
      }
    }
    for (const e of this.enemies) {
      if (!e.dead && Math.hypot(e.cx - x, e.cy - y) <= radius) {
        if (typeof e.stun === 'function') e.stun(1.5);
        else if (e.state) { e.state = 'stunned'; e.stateTimer = 1.5; }
        this.poof(e.cx, e.cy - 10, '#fef08a');
      }
    }
    for (let dir of [-1, 1]) {
      for (let i = 0; i < 7; i++) {
        this.particles.push({
          x: x + dir * (8 + i * 4), y: y - 2,
          vx: dir * (120 + Math.random() * 160),
          vy: -40 - Math.random() * 80,
          life: 0.4 + Math.random() * 0.2,
          size: 3 + Math.random() * 3,
          color: '#e2e8f0', g: 300
        });
      }
    }
  }

  checkDashSmash(p) {
    const checkX = p.dashDir > 0 ? p.x + p.w : p.x - 8;
    const c0 = Math.floor(checkX / TS), c1 = Math.floor((checkX + 8 - 0.001) / TS);
    const r0 = Math.floor(p.y / TS), r1 = Math.floor((p.y + p.h - 0.001) / TS);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (this.world.get(c, r) === 'X') {
          this.breakCrate(c, r);
        }
      }
    }
  }

  checkGiantSmash(p) {
    const c0 = Math.floor(p.x / TS), c1 = Math.floor((p.x + p.w - 0.001) / TS);
    const r0 = Math.floor(p.y / TS), r1 = Math.floor((p.y + p.h - 0.001) / TS);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (this.world.get(c, r) === 'X') {
          this.breakCrate(c, r);
        }
      }
    }
  }

  pullCoins(x, y, radius = 160, dt) {
    for (const c of this.coins) {
      if (c.collected) continue;
      const d = Math.hypot(x - (c.x + c.w / 2), y - (c.y + c.h / 2));
      if (d <= radius && d > 2) {
        c.x += (x - (c.x + c.w / 2)) * dt * 5;
        c.y += (y - (c.y + c.h / 2)) * dt * 5;
      }
    }
    for (const g of this.gems) {
      if (g.collected) continue;
      const d = Math.hypot(x - (g.x + g.w / 2), y - (g.y + g.h / 2));
      if (d <= radius && d > 2) {
        g.x += (x - (g.x + g.w / 2)) * dt * 5;
        g.y += (y - (g.y + g.h / 2)) * dt * 5;
      }
    }
  }

  addAfterimage(p) {
    this.afterimages.push({
      x: p.x, y: p.y, w: p.w, h: p.h, face: p.face,
      sx: p.sx, sy: p.sy, giantScale: p.giantScale || 1,
      life: 0.22, maxLife: 0.22
    });
  }

  spawnPuffRing(x, y) {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      this.particles.push({
        x: x + Math.cos(a) * 6, y: y + Math.sin(a) * 3,
        vx: Math.cos(a) * 90, vy: Math.sin(a) * 40 + 10,
        life: 0.32, size: 4, color: '#f8fafc', g: 0
      });
    }
  }

  spawnDust(x, y) {
    for (let i = 0; i < 2; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 8, y,
        vx: (Math.random() - 0.5) * 40, vy: -15 - Math.random() * 30,
        life: 0.25, size: 3, color: '#fef08a', g: 40
      });
    }
  }

  shakeScreen(intensity) {
    if (this.shakeEnabled) {
      this.shake = Math.max(this.shake, intensity * 24);
    }
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
