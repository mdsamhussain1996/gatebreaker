# Gatebreaker 🗝️⚔️

A top-down arcade action-adventure game built with vanilla JavaScript and HTML5 Canvas 2D. Explore dark dungeon levels, battle monsters, find hidden keys, and breach the exit gate!

Live Site: **[https://mdsamhussain1996.github.io/gatebreaker/](https://mdsamhussain1996.github.io/gatebreaker/)**

---

## 🎮 Game Overview

A hooded adventurer explores a labyrinth of dungeon levels seen from above. Fight enemies with a knife, scavenge weapons, collect items (coins, hearts, ammo, bombs), find the golden **KEY**, and reach the locked **GATE** to open it and advance to the next level.

All visual art is procedurally rendered in code using Canvas 2D, and all sound effects and ambient themes are synthesized dynamically using the Web Audio API.

---

## 🕹️ Controls

### Desktop / Laptop:
- **Move:** `WASD` or Arrow keys (8 directions, normalized diagonal speed)
- **Aim:** Mouse cursor (faces cursor position) or movement direction
- **Attack:** Left Click, `Space`, or `J`
- **Switch Weapon:** `Q`, `1` (Knife), `2` (Gun) or Mouse Wheel
- **Bomb:** `E` or Right Click
- **Pause:** `P` or `Esc`

### Mobile / Tablet:
- **Move:** Floating virtual joystick on the left half of the screen
- **Attack:** Large action button on the bottom-right
- **Multi-Touch:** Full multi-touch support for simultaneous movement and combat
- **Auto-Aim:** Automatic target acquisition for ranged weapons on touch devices

---

## 🚀 How to Run Locally

Since Gatebreaker is built with zero external dependencies and zero build tools:

1. Clone the repository:
   ```bash
   git clone https://github.com/mdsamhussain1996/gatebreaker.git
   cd gatebreaker
   ```

2. Start any local static file server:
   ```bash
   # Python 3
   python3 -m http.server 8080

   # Or using npx serve
   npx serve .
   ```

3. Open your browser and navigate to `http://localhost:8080/`.

---

## 🧪 Running the Tests

Gatebreaker includes a comprehensive automated test suite in Node.js (no dependencies required):

```bash
node tests/run.js
```

---

## 🔥 Environmental Hazards & Map Legend

Gatebreaker features dynamic environmental hazards across all worlds, fully telegraphed for fair gameplay:

| Character | Hazard | Behavior |
|---|---|---|
| `f` | **Fire Jet** | Floor vent; 0.6s warning glow & smoke, then 3-tile vertical flame column (1.0s). |
| `<` | **Wall Flamethrower (Left)** | Mounted nozzle; 0.5s warning sparks, shoots 4-tile flame left (1.2s). |
| `>` | **Wall Flamethrower (Right)** | Mounted nozzle; 0.5s warning sparks, shoots 4-tile flame right (1.2s). |
| `o` | **Rotating Firebar** | Pivot block with 5 orbiting fireballs (80px radius); alternate spin directions. |
| `p` | **Lava Bubble** | Placed on lava; bubbles 0.5s, then leaps straight up 4 tiles in a sine arc. |
| `d` | **Fire Drip** | Ceiling drop; swells for 0.8s, falls with gravity, splashes harmless embers. |
| `Z` | **Lava Pool** | Deadly molten surface tile with heat shimmer; touching triggers respawn. |
| `!` | **Burning Plank** | One-way plank; step on it to trigger 0.6s smoke → 0.8s fire → crumbles for 4s. |
| `A` | **Falling Icicle** | Ceiling icicle (World 4); shakes 0.6s when hero walks below, falls & shatters. |
| `D` | **Crystal Laser** | Wall emitter (World 5); 0.8s aiming laser guide, followed by 0.5s piercing beam. |
| `R` | **Thorn Bramble** | Spiky ground bush (Worlds 1–2); hurts on touch, can be burned away by Fire Knife. |
| `E` | **Sand Geyser** | Traversal vent (World 3); bubbles 0.7s, blasts sand launching hero high (`vy = -620`). |

### Level Options (`src/levels.js`)
- `"difficulty": 1..6` — scales hazard cycle times and firebar rotation speeds.
- `"risingLava": { "startRow": 44, "speed": 10, "delay": 4 }` — bottom lava rises up during vertical climbs (stops 3 tiles below gate row, pauses 3s at checkpoints).

---

## 📜 Credits & License

Made by **Dr. Md Samshad Hussain Ansari**.

Distributed under the MIT License. See [LICENSE](LICENSE) for more details.
