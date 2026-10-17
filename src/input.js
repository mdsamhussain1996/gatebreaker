/**
 * Gatebreaker v2 — Input System (Keyboard + Virtual Touch Controls)
 */

import { initAudio } from './audio.js';

export class InputManager {
  constructor() {
    this.keys = new Set();
    this.prevJump = false;
    this.jumpPressed = false;   // edge-triggered
    this.jumpHeld = false;      // continuous
    this.downPressed = false;
    this.left = false;
    this.right = false;
    this.up = false;
    this.down = false;
    this.knifePressed = false;
    this.knifeHeld = false;
    this.prevKnife = false;
    this.pausePressed = false;

    // Touch button states
    this.touchLeft = false;
    this.touchRight = false;
    this.touchUp = false;
    this.touchDown = false;
    this.touchJump = false;
    this.touchKnife = false;
  }

  setup(canvas) {
    if (typeof window === 'undefined') return;

    window.addEventListener('keydown', e => {
      initAudio();
      const k = e.key.toLowerCase();
      this.keys.add(k);
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) {
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', e => {
      const k = e.key.toLowerCase();
      this.keys.delete(k);
    });

    this.setupTouchControls();
  }

  setupTouchControls() {
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isTouch) {
      document.body.classList.add('touch-device');
    }

    const bindTouch = (id, onStart, onEnd) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('touchstart', e => {
        initAudio();
        e.preventDefault();
        onStart();
      }, { passive: false });

      const handleEnd = e => {
        e.preventDefault();
        onEnd();
      };
      el.addEventListener('touchend', handleEnd, { passive: false });
      el.addEventListener('touchcancel', handleEnd, { passive: false });
    };

    bindTouch('btnTouchLeft', () => { this.touchLeft = true; }, () => { this.touchLeft = false; });
    bindTouch('btnTouchRight', () => { this.touchRight = true; }, () => { this.touchRight = false; });
    bindTouch('btnTouchUp', () => { this.touchUp = true; }, () => { this.touchUp = false; });
    bindTouch('btnTouchDown', () => { this.touchDown = true; }, () => { this.touchDown = false; });
    bindTouch('btnTouchJump', () => { this.touchJump = true; }, () => { this.touchJump = false; });
    bindTouch('btnTouchKnife', () => { this.touchKnife = true; }, () => { this.touchKnife = false; });
  }

  update() {
    const k = this.keys;

    this.left = k.has('a') || k.has('arrowleft') || this.touchLeft;
    this.right = k.has('d') || k.has('arrowright') || this.touchRight;
    this.up = k.has('w') || k.has('arrowup') || this.touchUp;
    this.down = k.has('s') || k.has('arrowdown') || this.touchDown;

    const currentJump = k.has(' ') || k.has('z') || k.has('k') || this.touchJump;
    this.jumpPressed = currentJump && !this.prevJump;
    this.jumpHeld = currentJump;
    this.prevJump = currentJump;

    const currentKnife = k.has('x') || k.has('j') || this.touchKnife;
    this.knifePressed = currentKnife && !this.prevKnife;
    this.knifeHeld = currentKnife;
    this.prevKnife = currentKnife;

    this.pausePressed = k.has('p') || k.has('escape');
    if (this.pausePressed) {
      k.delete('p');
      k.delete('escape');
    }
  }
}
