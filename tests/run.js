/**
 * Gatebreaker Test Suite (Plain Node.js, no dependencies)
 * Run: node tests/run.js
 */

const assert = require('assert');
const {
  TS,
  HERO_RADIUS,
  KNIFE_REACH,
  KNIFE_DAMAGE,
  SLIME_HP,
  SLIME_DAMAGE,
  LEVELS,
  parseLevel,
  isSolidTile,
  checkTileCollision,
  resolveEntityTileCollision,
  isPointInKnifeArc,
  createGameState,
  stepGame
} = require('../game.js');

let passedCount = 0;
let failedCount = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failedCount++;
  }
}

console.log('====================================================');
console.log('Gatebreaker Phase 1 Test Suite');
console.log('====================================================\n');

/* ---------------- 1. Level Map Parsing & Integrity ---------------- */
console.log('Section 1: Level Map Parsing & Integrity');

LEVELS.forEach((levelDef, idx) => {
  test(`Level ${idx + 1} (${levelDef.name}): Equal row lengths`, () => {
    const rows = levelDef.map;
    const w = rows[0].length;
    for (let r = 0; r < rows.length; r++) {
      assert.strictEqual(rows[r].length, w, `Row ${r} length mismatch: got ${rows[r].length}, expected ${w}`);
    }
  });

  test(`Level ${idx + 1} (${levelDef.name}): Outer borders are solid walls`, () => {
    const rows = levelDef.map;
    const h = rows.length;
    const w = rows[0].length;
    // Top and bottom borders must be '#'
    for (let x = 0; x < w; x++) {
      assert.strictEqual(rows[0][x], '#', `Top border at x=${x} is not wall`);
      assert.strictEqual(rows[h - 1][x], '#', `Bottom border at x=${x} is not wall`);
    }
    // Left and right borders must be '#' or 'G' (gate)
    for (let y = 0; y < h; y++) {
      assert.ok(rows[y][0] === '#', `Left border at y=${y} is not wall`);
      assert.ok(rows[y][w - 1] === '#' || rows[y][w - 1] === 'G', `Right border at y=${y} is neither wall nor gate`);
    }
  });

  test(`Level ${idx + 1} (${levelDef.name}): Exactly one Hero start (P) and one Gate (G)`, () => {
    let pCount = 0, gCount = 0;
    for (const row of levelDef.map) {
      for (const ch of row) {
        if (ch === 'P') pCount++;
        if (ch === 'G') gCount++;
      }
    }
    assert.strictEqual(pCount, 1, `Expected exactly 1 'P', found ${pCount}`);
    assert.strictEqual(gCount, 1, `Expected exactly 1 'G', found ${gCount}`);
  });

  test(`Level ${idx + 1} (${levelDef.name}): Exactly one key source ('K' or 'B')`, () => {
    let keySourceCount = 0;
    for (const row of levelDef.map) {
      for (const ch of row) {
        if (ch === 'K' || ch === 'B') keySourceCount++;
      }
    }
    assert.strictEqual(keySourceCount, 1, `Expected exactly 1 key source ('K' or 'B'), found ${keySourceCount}`);
  });
});

/* ---------------- 2. BFS Reachability Analysis ---------------- */
console.log('\nSection 2: BFS Reachability Analysis');

function bfsPathExists(mapLines, startChar, targetChar) {
  const h = mapLines.length;
  const w = mapLines[0].length;
  let start = null, target = null;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (mapLines[y][x] === startChar) start = { x, y };
      if (mapLines[y][x] === targetChar) target = { x, y };
    }
  }

  assert.ok(start, `Start character '${startChar}' not found`);
  assert.ok(target, `Target character '${targetChar}' not found`);

  const visited = Array.from({ length: h }, () => Array(w).fill(false));
  const queue = [start];
  visited[start.y][start.x] = true;

  const dirs = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];

  while (queue.length > 0) {
    const cur = queue.shift();
    if (cur.x === target.x && cur.y === target.y) {
      return true;
    }

    for (const d of dirs) {
      const nx = cur.x + d.x;
      const ny = cur.y + d.y;
      if (nx >= 0 && nx < w && ny >= 0 && ny < h && !visited[ny][nx]) {
        const ch = mapLines[ny][nx];
        // Walkable if not wall '#' or torch 't'
        if (ch !== '#' && ch !== 't') {
          visited[ny][nx] = true;
          queue.push({ x: nx, y: ny });
        }
      }
    }
  }
  return false;
}

test('BFS reachability: Hero Start (P) to Key (K)', () => {
  const reachable = bfsPathExists(LEVELS[0].map, 'P', 'K');
  assert.strictEqual(reachable, true, 'Hero cannot reach key via walkable path');
});

test('BFS reachability: Key (K) to Gate (G)', () => {
  const reachable = bfsPathExists(LEVELS[0].map, 'K', 'G');
  assert.strictEqual(reachable, true, 'Key cannot reach gate via walkable path');
});

/* ---------------- 3. Physics & Axis-Separated Tile Collision ---------------- */
console.log('\nSection 3: Physics & Axis-Separated Tile Collision');

test('Solid wall blocks point overlap', () => {
  const parsed = parseLevel(LEVELS[0]);
  // Top wall at x=10, y=0 is solid
  assert.strictEqual(isSolidTile(parsed.tiles, 10, 0), true);
  // Open floor at x=1, y=1 is not solid
  assert.strictEqual(isSolidTile(parsed.tiles, 1, 1), false);
});

test('High-speed displacement does NOT tunnel through wall', () => {
  const parsed = parseLevel(LEVELS[0]);
  const hero = { x: 2 * TS, y: 1.5 * TS, radius: HERO_RADIUS };
  // Push hero into left wall (x = 0) with a massive 500 px/s velocity step
  hero.x -= 200 * (1 / 60); // tries to move deep into wall
  resolveEntityTileCollision(hero, parsed.tiles);

  // Hero must be pushed outside the wall: min allowed x is TS + HERO_RADIUS = 32 + 11 = 43
  assert.ok(hero.x >= TS + HERO_RADIUS - 0.01, `Hero tunneled into left wall! x=${hero.x}`);
});

test('Axis separation allows entity to slide along walls', () => {
  const parsed = parseLevel(LEVELS[0]);
  // Place hero touching top wall (y = TS + HERO_RADIUS) and move diagonally up-right
  const hero = { x: 2 * TS, y: TS + HERO_RADIUS, radius: HERO_RADIUS };
  hero.x += 5;
  hero.y -= 5; // tries to move up into top wall
  resolveEntityTileCollision(hero, parsed.tiles);

  // Y should be clamped to top wall edge, while X advanced freely to slide
  assert.ok(hero.x > 2 * TS, `Hero did not slide horizontally! x=${hero.x}`);
  assert.ok(hero.y >= TS + HERO_RADIUS - 0.01, `Hero entered top wall! y=${hero.y}`);
});

/* ---------------- 4. Knife Combat & Arc Hit Detection ---------------- */
console.log('\nSection 4: Knife Combat & Arc Hit Detection');

test('Enemy directly in front of knife within reach is HIT', () => {
  const heroX = 100, heroY = 100;
  const aimAngle = 0; // facing right (+X)
  const enemyX = 135, enemyY = 100; // 35px away (within 11 + 34 + 12 = 57px reach)
  const enemyRadius = 12;

  const hit = isPointInKnifeArc(heroX, heroY, aimAngle, enemyX, enemyY, enemyRadius);
  assert.strictEqual(hit, true);
});

test('Enemy behind hero is NOT hit by knife swing', () => {
  const heroX = 100, heroY = 100;
  const aimAngle = 0; // facing right (+X)
  const enemyX = 70, enemyY = 100; // behind hero (-X)
  const enemyRadius = 12;

  const hit = isPointInKnifeArc(heroX, heroY, aimAngle, enemyX, enemyY, enemyRadius);
  assert.strictEqual(hit, false);
});

test('Enemy out of reach (>45px from hero surface) is NOT hit', () => {
  const heroX = 100, heroY = 100;
  const aimAngle = 0; // facing right
  const enemyX = 170, enemyY = 100; // 70px away
  const enemyRadius = 12;

  const hit = isPointInKnifeArc(heroX, heroY, aimAngle, enemyX, enemyY, enemyRadius);
  assert.strictEqual(hit, false);
});

/* ---------------- 5. Gameplay Mechanics & State Transitions ---------------- */
console.log('\nSection 5: Gameplay Mechanics & State Transitions');

test('Knife attack deals damage to slime and applies knockback', () => {
  const g = createGameState(0);
  const slime = g.slimes[0];
  // Teleport hero next to slime and aim at it
  g.hero.x = slime.x - 30;
  g.hero.y = slime.y;
  g.hero.aimAngle = 0;

  const initialHp = slime.hp;
  stepGame(g, { attack: true, moveX: 0, moveY: 0 }, 1 / 60);

  assert.strictEqual(slime.hp, initialHp - KNIFE_DAMAGE, `Expected HP ${initialHp - KNIFE_DAMAGE}, got ${slime.hp}`);
  assert.ok(slime.vx > 0, `Knockback was not applied to slime: vx=${slime.vx}`);
});

test('Two knife attacks kill a 50 HP slime and record kill stat', () => {
  const g = createGameState(0);
  const slime = g.slimes[0];
  g.hero.x = slime.x - 30;
  g.hero.y = slime.y;
  g.hero.aimAngle = 0;

  // First strike
  stepGame(g, { attack: true }, 1 / 60);
  assert.strictEqual(slime.hp, 16);

  // Fast forward past cooldown (0.35s)
  for (let i = 0; i < 22; i++) stepGame(g, { attack: false }, 1 / 60);

  // Second strike
  stepGame(g, { attack: true }, 1 / 60);
  assert.ok(slime.dead, 'Slime should be dead after taking 68 damage');
  assert.strictEqual(g.stats.slimesKilled, 1);
});

test('Collecting a coin increments coin count', () => {
  const g = createGameState(0);
  const coin = g.items.find(it => it.type === 'coin');
  assert.ok(coin, 'Coin item must exist');

  // Place hero directly on coin
  g.hero.x = coin.x;
  g.hero.y = coin.y;
  stepGame(g, {}, 1 / 60);

  assert.strictEqual(g.inventory.coins, 1, 'Coins count should be 1');
});

test('Collecting key unlocks gate when hero approaches gate', () => {
  const g = createGameState(0);
  const key = g.items.find(it => it.type === 'key');
  assert.ok(key, 'Key item must exist');

  // Pick up key
  g.hero.x = key.x;
  g.hero.y = key.y;
  stepGame(g, {}, 1 / 60);
  assert.strictEqual(g.inventory.hasKey, true, 'Hero should possess key');

  // Move to gate
  g.hero.x = g.gate.x;
  g.hero.y = g.gate.y;
  stepGame(g, {}, 1 / 60);
  assert.strictEqual(g.gateUnlocked, true, 'Gate should be unlocked');
  assert.strictEqual(g.levelComplete, true, 'Stepping through gate should complete level');
});

test('Touching locked gate without key does NOT unlock gate or finish level', () => {
  const g = createGameState(0);
  assert.strictEqual(g.inventory.hasKey, false);

  // Place hero at gate
  g.hero.x = g.gate.x;
  g.hero.y = g.gate.y;
  stepGame(g, {}, 1 / 60);

  assert.strictEqual(g.gateUnlocked, false, 'Gate should remain locked without key');
  assert.strictEqual(g.levelComplete, false, 'Level must not complete without key');
});

test('Slime deals touch damage to hero and triggers 0.7s invulnerability', () => {
  const g = createGameState(0);
  const slime = g.slimes[0];
  g.hero.x = slime.x;
  g.hero.y = slime.y;

  stepGame(g, {}, 1 / 60);
  assert.strictEqual(g.hero.hp, 100 - SLIME_DAMAGE);
  assert.ok(g.hero.invulnTimer > 0.6, `Invulnerability timer should be ~0.7s, got ${g.hero.invulnTimer}`);
});

console.log('\n====================================================');
console.log(`Test Results: ${passedCount} passed, ${failedCount} failed`);
console.log('====================================================\n');

if (failedCount > 0) {
  process.exit(1);
} else {
  console.log('All Phase 1 tests passed successfully! 🎉\n');
}
