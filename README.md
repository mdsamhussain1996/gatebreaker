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

## 📜 Credits & License

Made by **Dr. Md Samshad Hussain Ansari**.

Distributed under the MIT License. See [LICENSE](LICENSE) for more details.
