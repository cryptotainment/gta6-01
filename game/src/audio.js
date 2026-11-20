// SOLMAR — Vice Coast. Sound, synthesised and nothing else: no audio files, no
// network. Engine hum by speed, two-tone sirens, gunshots, pickup chimes and
// mission stings, all from WebAudio oscillators and filtered noise.

export function createAudio() {
  const audio = {
    ctx: null,
    muted: false,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    sirenTimer: 0,
    ensure() {
      if (this.ctx) return true;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        this.ctx = new AC();
        // Engine: a low sawtooth whose pitch follows the speed.
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineOsc.frequency.value = 55;
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0;
        const engineFilter = this.ctx.createBiquadFilter();
        engineFilter.type = 'lowpass';
        engineFilter.frequency.value = 320;
        this.engineOsc.connect(engineFilter);
        engineFilter.connect(this.engineGain);
        this.engineGain.connect(this.ctx.destination);
        this.engineOsc.start();
        // Siren: two tones that trade places.
        this.sirenOsc = this.ctx.createOscillator();
        this.sirenOsc.type = 'sine';
        this.sirenOsc.frequency.value = 720;
        this.sirenGain = this.ctx.createGain();
        this.sirenGain.gain.value = 0;
        this.sirenOsc.connect(this.sirenGain);
        this.sirenGain.connect(this.ctx.destination);
        this.sirenOsc.start();
      } catch {
        this.ctx = null;
        return false;
      }
      return true;
    },
    resume() {
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },
    setMuted(muted) {
      this.muted = muted;
      if (this.ctx) {
        this.engineGain.gain.value = 0;
        this.sirenGain.gain.value = 0;
      }
    },
    // The engine hum follows the player's speed; the siren follows the heat.
    update(speed, wanted, driving) {
      if (!this.ctx || this.muted) return;
      const target = driving ? 0.035 + Math.min(0.05, Math.abs(speed) / 9000) : 0;
      this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
      this.engineOsc.frequency.setTargetAtTime(55 + Math.abs(speed) * 0.22, this.ctx.currentTime, 0.1);
      const sirenTarget = wanted > 0 ? 0.028 : 0;
      this.sirenGain.gain.setTargetAtTime(sirenTarget, this.ctx.currentTime, 0.3);
      this.sirenTimer += 1 / 60;
      if (this.sirenTimer > 0.45) {
        this.sirenTimer = 0;
        this.sirenOsc.frequency.value = this.sirenOsc.frequency.value > 800 ? 700 : 950;
      }
    },
    blip(freq, dur, type, vol) {
      if (!this.ctx || this.muted) return;
      try {
        const osc = this.ctx.createOscillator();
        osc.type = type || 'sine';
        osc.frequency.value = freq;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(vol || 0.12, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + dur);
      } catch { /* sound is decoration; never break the game */ }
    },
    noise(dur, vol, cutoff) {
      if (!this.ctx || this.muted) return;
      try {
        const len = Math.floor(this.ctx.sampleRate * dur);
        const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = cutoff || 1200;
        const gain = this.ctx.createGain();
        gain.gain.value = vol || 0.2;
        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        source.start();
      } catch { /* sound is decoration */ }
    },
    gunshot() { this.noise(0.14, 0.28, 900); this.blip(140, 0.08, 'square', 0.1); },
    punch() { this.noise(0.08, 0.16, 500); },
    thud() { this.noise(0.12, 0.2, 300); },
    coin() { this.blip(880, 0.1, 'sine', 0.12); setTimeout(() => this.blip(1318, 0.14, 'sine', 0.1), 70); },
    buy() { this.blip(660, 0.1, 'sine', 0.12); setTimeout(() => this.blip(990, 0.16, 'sine', 0.1), 80); },
    objective() { this.blip(523, 0.12, 'triangle', 0.14); setTimeout(() => this.blip(784, 0.18, 'triangle', 0.12), 100); },
    carDoor() { this.noise(0.09, 0.14, 400); },
    stunt() { this.blip(392, 0.1, 'sine', 0.12); setTimeout(() => this.blip(523, 0.1, 'sine', 0.12), 90); setTimeout(() => this.blip(659, 0.16, 'sine', 0.12), 180); },
    sirenBurst() { this.blip(950, 0.16, 'sine', 0.1); setTimeout(() => this.blip(700, 0.2, 'sine', 0.1), 160); },
    sting() { [523, 659, 784].forEach((f, i) => setTimeout(() => this.blip(f, 0.18, 'triangle', 0.13), i * 110)); },
    missionComplete() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.blip(f, 0.22, 'triangle', 0.14), i * 120)); },
    fail() { [392, 330, 262].forEach((f, i) => setTimeout(() => this.blip(f, 0.22, 'sawtooth', 0.07), i * 130)); },
    busted() { [330, 262, 196].forEach((f, i) => setTimeout(() => this.blip(f, 0.3, 'sawtooth', 0.08), i * 160)); },
  };
  return audio;
}
