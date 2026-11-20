// Sound for Solmar, synthesised in code with WebAudio — no audio files.
// Engine hum by speed, a two-tone siren when the heat is on, gunshots,
// pickup chimes and a mission sting. The noise buffer is the only place in
// the game that uses Math.random, and it only shapes sound, never game state.

export function makeAudio() {
  const audio = {
    ctx: null,
    master: null,
    muted: false,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    noiseBuf: null,
    // Lazily create the AudioContext on the first user gesture (browsers
    // refuse to start audio before one).
    ensure() {
      if (audio.ctx) return;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        audio.ctx = new AC();
        audio.master = audio.ctx.createGain();
        audio.master.gain.value = 0.5;
        audio.master.connect(audio.ctx.destination);
        // One second of white noise, reused by every gunshot.
        const len = audio.ctx.sampleRate;
        audio.noiseBuf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
        const data = audio.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
        // Engine: a low sawtooth whose pitch follows the speed.
        audio.engineOsc = audio.ctx.createOscillator();
        audio.engineOsc.type = 'sawtooth';
        audio.engineOsc.frequency.value = 50;
        audio.engineGain = audio.ctx.createGain();
        audio.engineGain.gain.value = 0;
        audio.engineOsc.connect(audio.engineGain);
        audio.engineGain.connect(audio.master);
        audio.engineOsc.start();
        // Siren: a square wave that alternates between two tones.
        audio.sirenOsc = audio.ctx.createOscillator();
        audio.sirenOsc.type = 'square';
        audio.sirenOsc.frequency.value = 700;
        audio.sirenGain = audio.ctx.createGain();
        audio.sirenGain.gain.value = 0;
        audio.sirenOsc.connect(audio.sirenGain);
        audio.sirenGain.connect(audio.master);
        audio.sirenOsc.start();
        audio.sirenPhase = 0;
      } catch (e) {
        audio.ctx = null;
      }
    },
    setMuted(m) {
      audio.muted = m;
      if (audio.master) audio.master.gain.value = m ? 0 : 0.5;
    },
    // Per-frame: engine pitch by speed, siren on when wanted > 0.
    update(game, dt) {
      if (!audio.ctx || audio.muted) return;
      const p = game.player;
      const speed = p.onFoot ? Math.abs(p.speed || 0) : Math.abs(p.car ? p.car.speed : 0);
      if (audio.engineOsc) {
        audio.engineOsc.frequency.value = 45 + Math.min(1, speed / 450) * 130;
        audio.engineGain.gain.value = p.onFoot ? 0 : 0.05 + Math.min(1, speed / 450) * 0.05;
      }
      if (audio.sirenOsc) {
        if (game.wanted > 0 && game.police.length > 0) {
          audio.sirenPhase = (audio.sirenPhase || 0) + dt;
          const hi = Math.floor(audio.sirenPhase * 2.4) % 2 === 0;
          audio.sirenOsc.frequency.value = hi ? 880 : 660;
          audio.sirenGain.gain.value = 0.035;
        } else {
          audio.sirenGain.gain.value = 0;
        }
      }
    },
    blip(freq, dur, type, vol) {
      if (!audio.ctx || audio.muted) return;
      const osc = audio.ctx.createOscillator();
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      const gain = audio.ctx.createGain();
      gain.gain.setValueAtTime(vol || 0.2, audio.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(audio.master);
      osc.start();
      osc.stop(audio.ctx.currentTime + dur);
    },
    shot() {
      if (!audio.ctx || audio.muted) return;
      audio.ensure();
      if (!audio.ctx) return;
      const src = audio.ctx.createBufferSource();
      src.buffer = audio.noiseBuf;
      const gain = audio.ctx.createGain();
      gain.gain.setValueAtTime(0.5, audio.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.ctx.currentTime + 0.12);
      const filter = audio.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 900;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(audio.master);
      src.start();
      src.stop(audio.ctx.currentTime + 0.14);
    },
    pickup() {
      audio.ensure();
      audio.blip(880, 0.12, 'sine', 0.22);
      setTimeout(() => audio.blip(1318, 0.16, 'sine', 0.2), 90);
    },
    sting() {
      audio.ensure();
      const notes = [523, 659, 784, 1046];
      notes.forEach((n, i) => setTimeout(() => audio.blip(n, 0.22, 'triangle', 0.22), i * 110));
    },
    siren() {
      // A short two-tone whoop when the wanted level rises.
      audio.ensure();
      if (!audio.ctx) return;
      audio.blip(880, 0.18, 'square', 0.12);
      setTimeout(() => audio.blip(660, 0.18, 'square', 0.12), 180);
    },
  };
  return audio;
}
