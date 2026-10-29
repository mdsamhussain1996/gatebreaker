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

export function setVolumes(sfx, music) {
  if (typeof sfx === 'number') soundVolume = sfx;
  if (typeof music === 'number') musicVolume = music;
}

/** One synthesized blip: oscillator sweeping f0 -> f1 over dur seconds. */
function tone(type, f0, f1, dur, vol, delay = 0) {
  const t = actx.currentTime + delay;
  const osc = actx.createOscillator();
  const gain = actx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
  gain.gain.setValueAtTime(vol * soundVolume, t);
  gain.gain.exponentialRampToValueAtTime(0.01, t + dur);
  osc.connect(gain);
  gain.connect(actx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.01);
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
    } else if (type === 'coin') {
      tone('square', 988, 988, 0.07, 0.12);
      tone('square', 1319, 1319, 0.16, 0.12, 0.07);
    } else if (type === 'hurt') {
      tone('sawtooth', 330, 90, 0.28, 0.3);
    } else if (type === 'grab') {
      tone('triangle', 300, 420, 0.06, 0.18);
    } else if (type === 'drop') {
      tone('sine', 420, 200, 0.12, 0.18);
    } else if (type === 'creak') {
      tone('sawtooth', 120, 150, 0.14, 0.07);
      tone('sawtooth', 150, 100, 0.12, 0.05, 0.1);
    } else if (type === 'locked') {
      tone('square', 180, 150, 0.12, 0.2);
      tone('square', 150, 120, 0.16, 0.2, 0.12);
    } else if (type === 'levelClear') {
      [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.5].forEach((f, i) => tone('triangle', f, f, 0.22, 0.28, 0.55 + i * 0.13));
    } else if (type === 'gameOver') {
      [392, 330, 262, 196].forEach((f, i) => tone('triangle', f, f * 0.97, 0.3, 0.3, i * 0.22));
    } else if (type === 'buzz') {
      tone('sawtooth', 360, 420, 0.12, 0.12);
    } else if (type === 'batScreech') {
      tone('sine', 880, 540, 0.15, 0.20);
    } else if (type === 'frogCroak') {
      tone('square', 140, 95, 0.14, 0.22);
    } else if (type === 'boarScrape') {
      tone('sawtooth', 90, 60, 0.25, 0.25);
    } else if (type === 'boarCharge') {
      tone('triangle', 180, 260, 0.20, 0.30);
    } else if (type === 'boarCrash') {
      tone('sawtooth', 120, 40, 0.30, 0.40);
    } else if (type === 'hawkScreech') {
      tone('triangle', 1100, 650, 0.28, 0.25);
    } else if (type === 'sawWhirr') {
      tone('sawtooth', 280, 320, 0.10, 0.15);
    } else if (type === 'dash') {
      tone('sawtooth', 340, 180, 0.16, 0.28);
    } else if (type === 'doubleJump') {
      tone('triangle', 380, 720, 0.12, 0.22);
    } else if (type === 'groundPound') {
      tone('sine', 160, 42, 0.22, 0.38);
    } else if (type === 'freezeCrack') {
      tone('triangle', 880, 1320, 0.14, 0.25);
    } else if (type === 'shieldPop') {
      tone('sine', 480, 240, 0.12, 0.26);
    } else if (type === 'giantStomp') {
      tone('triangle', 110, 38, 0.25, 0.40);
    } else if (type === 'superBlast') {
      tone('sawtooth', 220, 680, 0.25, 0.40);
      tone('triangle', 120, 45, 0.35, 0.35, 0.08);
    } else if (type === 'blasterLaser') {
      tone('square', 880, 220, 0.09, 0.22);
    } else if (type === 'flameWave') {
      tone('sawtooth', 280, 140, 0.18, 0.25);
    } else if (type === 'powerup') {
      tone('triangle', 523.25, 659.25, 0.10, 0.24);
      tone('triangle', 659.25, 783.99, 0.10, 0.24, 0.08);
      tone('triangle', 783.99, 1046.5, 0.18, 0.28, 0.16);
    } else if (type === 'bossRoar') {
      tone('sawtooth', 95, 45, 0.55, 0.45);
      tone('square', 60, 30, 0.45, 0.35, 0.1);
    } else if (type === 'arenaLock') {
      tone('sawtooth', 140, 45, 0.25, 0.40);
      tone('triangle', 220, 80, 0.15, 0.30, 0.05);
    } else if (type === 'bossPhase') {
      tone('sawtooth', 160, 440, 0.30, 0.35);
      tone('triangle', 220, 580, 0.35, 0.40, 0.08);
    } else if (type === 'bossVictory') {
      [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98].forEach((f, i) => tone('triangle', f, f, 0.25, 0.32, i * 0.1));
    } else if (type === 'fireWarn') {
      tone('sawtooth', 320, 180, 0.08, 0.18);
      tone('square', 440, 220, 0.06, 0.15, 0.04);
    } else if (type === 'fireWhoosh') {
      tone('sawtooth', 140, 280, 0.22, 0.30);
      tone('triangle', 90, 180, 0.25, 0.25, 0.03);
    } else if (type === 'lavaBubble') {
      tone('sine', 180, 440, 0.12, 0.24);
      tone('sine', 440, 220, 0.08, 0.18, 0.08);
    } else if (type === 'drip') {
      tone('sine', 1200, 1900, 0.08, 0.22);
    } else if (type === 'icicleCrack') {
      tone('triangle', 1600, 700, 0.12, 0.28);
      tone('sawtooth', 800, 300, 0.10, 0.20, 0.05);
    } else if (type === 'laserCharge') {
      tone('sine', 340, 1150, 0.32, 0.25);
    } else if (type === 'laserFire') {
      tone('sawtooth', 950, 140, 0.14, 0.35);
      tone('square', 650, 90, 0.12, 0.25, 0.02);
    } else if (type === 'geyser') {
      tone('triangle', 150, 320, 0.25, 0.35);
      tone('sawtooth', 220, 110, 0.20, 0.25, 0.05);
    } else if (type === 'plankIgnite') {
      tone('square', 240, 120, 0.10, 0.20);
      tone('sawtooth', 360, 180, 0.08, 0.18, 0.04);
    }
  } catch (err) {
    // Audio synthesis failure should never crash the game
  }
}
