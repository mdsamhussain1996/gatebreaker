/**
 * Gatebreaker — input: keyboard + multi-touch pointer buttons.
 * Presses are latched so the fixed-timestep sim never misses (or double-counts) a tap.
 */
import { initAudio } from './audio.js';

const KEY_MAP = {
  left: ['arrowleft', 'a'],
  right: ['arrowright', 'd'],
  up: ['arrowup', 'w'],
  down: ['arrowdown', 's'],
  jump: [' ', 'z', 'k'],
  knife: ['x', 'j']
};

export class InputManager {
  constructor() {
    this.keys = new Set();
    this.touch = { left: false, right: false, up: false, down: false, jump: false, knife: false };
    this.latchJump = false;
    this.latchKnife = false;
    this.latchPause = false;
    // polled state
    this.left = this.right = this.up = this.down = false;
    this.jumpHeld = this.jumpPressed = false;
    this.knifeHeld = this.knifePressed = false;
    this.pausePressed = false;
    this.onPause = null;
  }

  setup() {
    if (typeof window === 'undefined') return;

    window.addEventListener('keydown', e => {
      initAudio();
      const k = e.key.toLowerCase();
      if (e.repeat) { if (Object.values(KEY_MAP).some(a => a.includes(k))) e.preventDefault(); return; }
      if (KEY_MAP.jump.includes(k)) this.latchJump = true;
      if (KEY_MAP.knife.includes(k)) this.latchKnife = true;
      if (k === 'p' || k === 'escape') { this.latchPause = true; if (this.onPause) this.onPause(); }
      this.keys.add(k);
      if (Object.values(KEY_MAP).some(a => a.includes(k))) e.preventDefault();
    });
    window.addEventListener('keyup', e => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => { this.keys.clear(); for (const k in this.touch) this.touch[k] = false; });

    // Touch / pointer buttons: <button data-act="jump">
    document.querySelectorAll('[data-act]').forEach(el => {
      const act = el.dataset.act;
      const down = e => {
        e.preventDefault();
        initAudio();
        try { el.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
        this.touch[act] = true;
        el.classList.add('pressed');
        if (act === 'jump') this.latchJump = true;
        if (act === 'knife') this.latchKnife = true;
      };
      const up = e => {
        e.preventDefault();
        this.touch[act] = false;
        el.classList.remove('pressed');
      };
      el.addEventListener('pointerdown', down);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('lostpointercapture', up);
      el.addEventListener('contextmenu', e => e.preventDefault());
    });

    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) document.body.classList.add('touch-device');
  }

  held(name) {
    return this.touch[name] || KEY_MAP[name].some(k => this.keys.has(k));
  }

  /** Call once per simulation step. */
  poll() {
    this.left = this.held('left');
    this.right = this.held('right');
    this.up = this.held('up');
    this.down = this.held('down');
    this.jumpPressed = this.latchJump;
    this.knifePressed = this.latchKnife;
    this.jumpHeld = this.held('jump') || this.jumpPressed;
    this.knifeHeld = this.held('knife') || this.knifePressed;
    this.latchJump = false;
    this.latchKnife = false;
  }

  /** Test helper: set a synthetic state. */
  static synthetic(state = {}) {
    return Object.assign({
      left: false, right: false, up: false, down: false,
      jumpHeld: false, jumpPressed: false, knifeHeld: false, knifePressed: false
    }, state);
  }
}
