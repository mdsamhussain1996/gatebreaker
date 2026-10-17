/**
 * Gatebreaker v2 — Web Audio Procedural Sound Synthesizer
 */

let actx = null;
let soundVolume = 0.8;
let musicVolume = 0.5;

export function initAudio() {
  if (!actx && typeof window !== 'undefined') {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      actx = new AudioContextClass();
    }
  }
  if (actx && actx.state === 'suspended') {
    actx.resume().catch(() => {});
  }
}

export function playSound(type) {
  if (!actx || actx.state !== 'running') return;
  const t = actx.currentTime;

  try {
    if (type === 'jump') {
      const osc = actx.createOscillator();
      const gain = actx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, t);
      osc.frequency.exponentialRampToValueAtTime(540, t + 0.12);
      gain.gain.setValueAtTime(0.22 * soundVolume, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);
      osc.connect(gain);
      gain.connect(actx.destination);
      osc.start(t);
      osc.stop(t + 0.13);
    } else if (type === 'land') {
      const osc = actx.createOscillator();
      const gain = actx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, t);
      osc.frequency.exponentialRampToValueAtTime(45, t + 0.08);
      gain.gain.setValueAtTime(0.25 * soundVolume, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
      osc.connect(gain);
      gain.connect(actx.destination);
      osc.start(t);
      osc.stop(t + 0.09);
    } else if (type === 'knifeSwish') {
      const osc = actx.createOscillator();
      const gain = actx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(480, t);
      osc.frequency.exponentialRampToValueAtTime(160, t + 0.10);
      gain.gain.setValueAtTime(0.25 * soundVolume, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.10);
      osc.connect(gain);
      gain.connect(actx.destination);
      osc.start(t);
      osc.stop(t + 0.11);
    } else if (type === 'knifeHit') {
      const osc = actx.createOscillator();
      const gain = actx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, t);
      osc.frequency.exponentialRampToValueAtTime(110, t + 0.09);
      gain.gain.setValueAtTime(0.4 * soundVolume, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.09);
      osc.connect(gain);
      gain.connect(actx.destination);
      osc.start(t);
      osc.stop(t + 0.10);
    } else if (type === 'pogo' || type === 'stomp') {
      const osc = actx.createOscillator();
      const gain = actx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, t);
      osc.frequency.exponentialRampToValueAtTime(680, t + 0.12);
      gain.gain.setValueAtTime(0.3 * soundVolume, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);
      osc.connect(gain);
      gain.connect(actx.destination);
      osc.start(t);
      osc.stop(t + 0.13);
    } else if (type === 'crateSmash') {
      // Wood crack / splinter
      const osc = actx.createOscillator();
      const gain = actx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, t);
      osc.frequency.exponentialRampToValueAtTime(40, t + 0.18);
      gain.gain.setValueAtTime(0.35 * soundVolume, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.18);
      osc.connect(gain);
      gain.connect(actx.destination);
      osc.start(t);
      osc.stop(t + 0.19);
    } else if (type === 'keyCollect') {
      const notes = [659.25, 783.99, 1046.5]; // E5, G5, C6
      notes.forEach((freq, i) => {
        const osc = actx.createOscillator();
        const gain = actx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t + i * 0.06);
        gain.gain.setValueAtTime(0.28 * soundVolume, t + i * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.01, t + i * 0.06 + 0.18);
        osc.connect(gain);
        gain.connect(actx.destination);
        osc.start(t + i * 0.06);
        osc.stop(t + i * 0.06 + 0.19);
      });
    } else if (type === 'gateUnlock') {
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5]; // C major fanfare
      notes.forEach((freq, i) => {
        const osc = actx.createOscillator();
        const gain = actx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t + i * 0.08);
        gain.gain.setValueAtTime(0.3 * soundVolume, t + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.01, t + i * 0.08 + 0.32);
        osc.connect(gain);
        gain.connect(actx.destination);
        osc.start(t + i * 0.08);
        osc.stop(t + i * 0.08 + 0.33);
      });
    } else if (type === 'enemyDie') {
      const osc = actx.createOscillator();
      const gain = actx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(260, t);
      osc.frequency.exponentialRampToValueAtTime(60, t + 0.15);
      gain.gain.setValueAtTime(0.25 * soundVolume, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
      osc.connect(gain);
      gain.connect(actx.destination);
      osc.start(t);
      osc.stop(t + 0.16);
    }
  } catch (err) {
    // Audio synthesis failure should never crash the game
  }
}
