/**
 * SYNTH AUDIO // dynamic web audio api retro arcade synthesizer
 * Dynamically synthesizes vintage 8-bit / synthwave sound effects in-browser,
 * eliminating the need for external asset loading and guaranteeing instant playback.
 */

class SynthAudio {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.globalVolume = 0.3; // Default balanced volume
  }

  /**
   * Initializes the AudioContext upon user gesture to comply with browser autoplay policies.
   */
  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /**
   * Toggles global mute state.
   * @returns {boolean} New mute state
   */
  toggleMute() {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  /**
   * Safe check to ensure synth only plays if initialized and unmuted.
   */
  canPlay() {
    this.init();
    return this.ctx && !this.isMuted;
  }

  /**
   * Helper to create a master gain node and connect it to destination.
   */
  createGainNode(duration, customVolume = 1.0) {
    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(this.globalVolume * customVolume, this.ctx.currentTime);
    // Linear decay to zero at the end of the sound
    gainNode.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
    gainNode.connect(this.ctx.destination);
    return gainNode;
  }

  /**
   * Sound 1: LASER SHOT (Triangle Pitch Sweep)
   * Rapidly sweeps frequency downwards to simulate classic vector lasers.
   */
  playLaser() {
    if (!this.canPlay()) return;

    const duration = 0.15;
    const osc = this.ctx.createOscillator();
    const gainNode = this.createGainNode(duration, 0.8);

    // Retro triangle wave feels smooth but classic
    osc.type = 'triangle';
    
    // Pitch sweep: starting high (1200Hz) down to low (150Hz)
    osc.frequency.setValueAtTime(1200, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, this.ctx.currentTime + duration);

    osc.connect(gainNode);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  /**
   * Sound 1.5: BULLET HIT (Smooth Soft pop)
   * A short, low-frequency pure sine pop with a minimal click transient.
   * Completely avoids harsh frequencies to prevent auditory fatigue when spammed.
   */
  playHit() {
    if (!this.canPlay()) return;

    const duration = 0.04;
    const osc = this.ctx.createOscillator();
    // Very quiet (0.12 gain multiplier)
    const gainNode = this.createGainNode(duration, 0.12);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(700, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(180, this.ctx.currentTime + duration);

    // Minor, soft click transient for tactile feedback
    const clickDuration = 0.01;
    const bufferSize = this.ctx.sampleRate * clickDuration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(3000, this.ctx.currentTime);

    const clickGain = this.ctx.createGain();
    clickGain.gain.setValueAtTime(this.globalVolume * 0.05, this.ctx.currentTime);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + clickDuration);

    noise.connect(hp);
    hp.connect(clickGain);
    clickGain.connect(this.ctx.destination);

    osc.connect(gainNode);

    osc.start();
    noise.start();
    osc.stop(this.ctx.currentTime + duration);
    noise.stop(this.ctx.currentTime + clickDuration);
  }

  /**
   * Sound 1.7: SHIELD DEFLECTION (Smooth Metallic Ping)
   * High-tech harmonic sine bell with fast decay.
   * Eliminates the harsh white noise component to ensure multiple deflections sound pleasant.
   */
  playShieldDeflect() {
    if (!this.canPlay()) return;

    const duration = 0.1;
    // Quiet volume multiplier (0.12) for comfortable continuous deflections
    const gainNode = this.createGainNode(duration, 0.12);

    // Resonant sine waves acting as clean, bell-like metallic frequencies
    const freqs = [1400, 2000, 2600];
    const oscs = freqs.map(freq => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.65, this.ctx.currentTime + duration);
      return osc;
    });

    oscs.forEach(osc => {
      osc.connect(gainNode);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    });
  }

  /**
   * Sound 1.8: SHIELD BREAK (Smooth Crystalline Shattering)
   * A satisfying combination of descending synth sweep and high-frequency cascading chimes.
   */
  playShieldBreak() {
    if (!this.canPlay()) return;

    const duration = 0.55;
    const gainNode = this.createGainNode(duration, 0.35);

    // 1. Descending triangle wave sweep representing deactivation/collapse
    const sweepOsc = this.ctx.createOscillator();
    sweepOsc.type = 'triangle';
    sweepOsc.frequency.setValueAtTime(600, this.ctx.currentTime);
    sweepOsc.frequency.exponentialRampToValueAtTime(60, this.ctx.currentTime + duration);
    sweepOsc.connect(gainNode);
    sweepOsc.start();
    sweepOsc.stop(this.ctx.currentTime + duration);

    // 2. Cascading metallic crystalline shattering chime (sine waves)
    const chimeFreqs = [1200, 1600, 2000, 2400];
    chimeFreqs.forEach((freq, idx) => {
      const startTime = this.ctx.currentTime + idx * 0.05;
      const chimeDur = 0.25;

      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.45, startTime + chimeDur);

      oscGain.gain.setValueAtTime(this.globalVolume * 0.15, startTime);
      oscGain.gain.exponentialRampToValueAtTime(0.001, startTime + chimeDur);

      osc.connect(oscGain);
      oscGain.connect(this.ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + chimeDur);
    });

    // 3. Sub-bass thump for the explosion impact
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(100, this.ctx.currentTime);
    subOsc.frequency.linearRampToValueAtTime(25, this.ctx.currentTime + duration);

    subGain.gain.setValueAtTime(this.globalVolume * 0.4, this.ctx.currentTime);
    subGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

    subOsc.connect(subGain);
    subGain.connect(this.ctx.destination);

    subOsc.start();
    subOsc.stop(this.ctx.currentTime + duration);
  }


  /**
   * Sound 2: RETRO EXPLOSION (Synthesized White Noise + Lowpass Filter Envelope + Heavy Sub Sweep)
   * Dynamically builds a white noise buffer, filters it, and adds a deep sawtooth sweep.
   */
  playExplosion() {
    if (!this.canPlay()) return;

    const duration = 0.45;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    // Fill buffer with random white noise values
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noiseNode = this.ctx.createBufferSource();
    noiseNode.buffer = buffer;

    // Filter to shape the white noise into a heavy rumble explosion
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(700, this.ctx.currentTime);
    // Rapidly sweep lowpass frequency down to make it sound muffled/heavy
    filter.frequency.exponentialRampToValueAtTime(25, this.ctx.currentTime + duration);

    const gainNode = this.createGainNode(duration, 1.3);

    noiseNode.connect(filter);
    filter.connect(gainNode);

    noiseNode.start();
    noiseNode.stop(this.ctx.currentTime + duration);

    // Add deep sawtooth sweep for high impact retro bass rumble
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sawtooth';
    subOsc.frequency.setValueAtTime(150, this.ctx.currentTime);
    subOsc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + duration);

    subGain.gain.setValueAtTime(this.globalVolume * 0.95, this.ctx.currentTime);
    subGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

    subOsc.connect(subGain);
    subGain.connect(this.ctx.destination);
    
    subOsc.start();
    subOsc.stop(this.ctx.currentTime + duration);
  }

  /**
   * Sound 3: PLAYER DAMAGE (Vibrating Sawtooth Wave)
   * Short grating sound to represent shields taking damage.
   */
  playDamage() {
    if (!this.canPlay()) return;

    const duration = 0.2;
    const osc = this.ctx.createOscillator();
    const gainNode = this.createGainNode(duration, 1.0);

    // Buzzing sawtooth wave
    osc.type = 'sawtooth';

    // Grating low frequency sweep
    osc.frequency.setValueAtTime(180, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(40, this.ctx.currentTime + duration);

    osc.connect(gainNode);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  /**
   * Sound 4: POWERUP JINGLE (Arpeggio notes cascading upwards)
   * Triggers an ascending neon triad chime.
   */
  playPowerup() {
    if (!this.canPlay()) return;

    const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5 (C Major Arpeggio)
    const noteDuration = 0.08;

    notes.forEach((freq, idx) => {
      const startTime = this.ctx.currentTime + idx * 0.06;
      
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();
      
      osc.type = 'sine'; // Pure sine tone for elegant chime
      osc.frequency.setValueAtTime(freq, startTime);

      gainNode.gain.setValueAtTime(this.globalVolume * 0.7, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + noteDuration);
      
      osc.connect(gainNode);
      gainNode.connect(this.ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + noteDuration);
    });
  }

  /**
   * Sound 5: GAME OVER JINGLE (Descending minor chord block)
   * Dissonant minor tones shifting downwards.
   */
  playGameOver() {
    if (!this.canPlay()) return;

    const chords = [
      [196.00, 233.08, 293.66], // G minor chord (G3, Bb3, D4)
      [146.83, 174.61, 220.00]  // D minor chord (D3, F3, A3)
    ];

    chords.forEach((chord, chordIdx) => {
      const chordStart = this.ctx.currentTime + chordIdx * 0.45;
      const duration = 0.4;

      chord.forEach((freq) => {
        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, chordStart);

        gainNode.gain.setValueAtTime(this.globalVolume * 0.5, chordStart);
        gainNode.gain.exponentialRampToValueAtTime(0.001, chordStart + duration);

        osc.connect(gainNode);
        gainNode.connect(this.ctx.destination);

        osc.start(chordStart);
        osc.stop(chordStart + duration);
      });
    });
  }

  /**
   * Sound 6: GAME START INTRO CHIME
   * Energizing chord sweep to prepare the pilot.
   */
  playGameStart() {
    if (!this.canPlay()) return;

    const baseNotes = [130.81, 164.81, 196.00, 261.63, 329.63, 392.00, 523.25]; // C3, E3, G3, C4, E4, G4, C5
    
    baseNotes.forEach((freq, idx) => {
      const startTime = this.ctx.currentTime + idx * 0.05;
      const duration = 0.25;

      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, startTime + duration); // Rise in pitch

      gainNode.gain.setValueAtTime(this.globalVolume * 0.6, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gainNode);
      gainNode.connect(this.ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);
    });
  }

  /**
   * Sound 6.5: RETRO COIN DROP SOUND
   * Ascending classic square-wave dual-note chime.
   */
  playCoin() {
    if (!this.canPlay()) return;

    const note1Freq = 987.77; // B5
    const note2Freq = 1318.51; // E6
    const duration = 0.08;
    const t = this.ctx.currentTime;
    
    // Note 1
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'square';
    osc1.frequency.setValueAtTime(note1Freq, t);
    gain1.gain.setValueAtTime(this.globalVolume * 0.45, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc1.connect(gain1);
    gain1.connect(this.ctx.destination);
    osc1.start(t);
    osc1.stop(t + duration);

    // Note 2 (delayed slightly)
    const delay = 0.075;
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(note2Freq, t + delay);
    gain2.gain.setValueAtTime(this.globalVolume * 0.55, t + delay);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.16);
    osc2.connect(gain2);
    gain2.connect(this.ctx.destination);
    osc2.start(t + delay);
    osc2.stop(t + delay + 0.16);
  }

  /**
   * Sound 7: PICKUP COLLECT SOUND (different tone per type)
   * - HEAL: Rising smooth sine
   * - SHIELD: Metallic ping
   * - RAPID: High-energy buzz
   */
  playPickup(type) {
    if (!this.canPlay()) return;

    if (type === 'HEAL') {
      // Rising smooth sine arpeggio
      const notes = [392.00, 523.25, 659.25];
      notes.forEach((freq, idx) => {
        const startTime = this.ctx.currentTime + idx * 0.05;
        const duration = 0.12;
        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);
        gainNode.gain.setValueAtTime(this.globalVolume * 0.6, startTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        osc.connect(gainNode);
        gainNode.connect(this.ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration);
      });
    } else if (type === 'SHIELD') {
      // Metallic ping (high frequency with fast decay)
      const duration = 0.15;
      const osc = this.ctx.createOscillator();
      const gainNode = this.createGainNode(duration, 0.7);
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, this.ctx.currentTime + duration);
      osc.connect(gainNode);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } else if (type === 'RAPID') {
      // High-energy buzz
      const duration = 0.2;
      const osc = this.ctx.createOscillator();
      const gainNode = this.createGainNode(duration, 0.5);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(600, this.ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(1200, this.ctx.currentTime + duration);
      osc.connect(gainNode);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    }
  }

  /**
   * Sound 8: BLACK HOLE AMBIENT HUM (low rumbling)
   */
  playBlackHumor() {
    if (!this.canPlay()) return;

    const duration = 2.0;
    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(40, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(35, this.ctx.currentTime + duration);

    gainNode.gain.setValueAtTime(this.globalVolume * 0.15, this.ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    osc.connect(gainNode);
    gainNode.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  /**
   * Sound 9: BOOST ACTIVATION (ascending power chord)
   */
  playBoostActivate(type) {
    if (!this.canPlay()) return;

    if (type === 'TITAN') {
      // Heavy power chord
      const notes = [110, 220, 330];
      notes.forEach((freq, i) => {
        const st = this.ctx.currentTime + i * 0.1;
        const osc = this.ctx.createOscillator();
        const gn = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, st);
        gn.gain.setValueAtTime(this.globalVolume * 0.3, st);
        gn.gain.exponentialRampToValueAtTime(0.001, st + 0.3);
        osc.connect(gn);
        gn.connect(this.ctx.destination);
        osc.start(st);
        osc.stop(st + 0.3);
      });
    } else if (type === 'MULTI_SHOT') {
      // Rapid arpeggio
      const notes = [523, 659, 784, 1047];
      notes.forEach((freq, i) => {
        const st = this.ctx.currentTime + i * 0.04;
        const osc = this.ctx.createOscillator();
        const gn = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, st);
        gn.gain.setValueAtTime(this.globalVolume * 0.25, st);
        gn.gain.exponentialRampToValueAtTime(0.001, st + 0.08);
        osc.connect(gn);
        gn.connect(this.ctx.destination);
        osc.start(st);
        osc.stop(st + 0.08);
      });
    } else if (type === 'PHASE_DASH') {
      // Whoosh effect
      const duration = 0.4;
      const osc = this.ctx.createOscillator();
      const gn = this.createGainNode(duration, 0.4);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(200, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1800, this.ctx.currentTime + duration);
      osc.connect(gn);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } else if (type === 'VOID_STORM') {
      // Deep rumble
      const duration = 0.6;
      const osc = this.ctx.createOscillator();
      const gn = this.createGainNode(duration, 0.35);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(60, this.ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(30, this.ctx.currentTime + duration);
      osc.connect(gn);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    }
  }

  /**
   * Sound 10: BOOST EXPIRATION WARNING (descending beep)
   */
  playBoostExpire() {
    if (!this.canPlay()) return;

    const notes = [600, 400, 200];
    notes.forEach((freq, i) => {
      const st = this.ctx.currentTime + i * 0.12;
      const osc = this.ctx.createOscillator();
      const gn = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, st);
      gn.gain.setValueAtTime(this.globalVolume * 0.3, st);
      gn.gain.exponentialRampToValueAtTime(0.001, st + 0.1);
      osc.connect(gn);
      gn.connect(this.ctx.destination);
      osc.start(st);
      osc.stop(st + 0.1);
    });
  }

  /**
   * Sound 11: LIGHTNING SPARK (High frequency electrical crackle)
   */
  playLightningSpark() {
    if (!this.canPlay()) return;

    const duration = 0.08;
    const osc = this.ctx.createOscillator();
    const gainNode = this.createGainNode(duration, 0.15);

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1500, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(300, this.ctx.currentTime + duration);

    // Add noise transient for electrical crackle
    const clickDuration = 0.04;
    const bufferSize = this.ctx.sampleRate * clickDuration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(2000, this.ctx.currentTime);

    const clickGain = this.ctx.createGain();
    clickGain.gain.setValueAtTime(this.globalVolume * 0.1, this.ctx.currentTime);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + clickDuration);

    noise.connect(hp);
    hp.connect(clickGain);
    clickGain.connect(this.ctx.destination);

    osc.connect(gainNode);

    osc.start();
    noise.start();
    osc.stop(this.ctx.currentTime + duration);
    noise.stop(this.ctx.currentTime + clickDuration);
  }

  /**
   * Sound 12: BLACK HOLE HUM (Low-frequency grav-well spinning rumble)
   */
  playBlackHoleHum() {
    if (!this.canPlay()) return;

    const duration = 1.2;
    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(90, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(45, this.ctx.currentTime + duration);

    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(120, this.ctx.currentTime);
    lp.frequency.exponentialRampToValueAtTime(60, this.ctx.currentTime + duration);

    gainNode.gain.setValueAtTime(this.globalVolume * 0.35, this.ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    osc.connect(lp);
    lp.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  /**
   * Sound 13: AEGIS BOUNCE (Resonant chime bounce)
   */
  playAegisBounce() {
    if (!this.canPlay()) return;

    const duration = 0.12;
    const gainNode = this.createGainNode(duration, 0.14);

    const freqs = [1600, 2200];
    freqs.forEach(freq => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.5, this.ctx.currentTime + duration);
      osc.connect(gainNode);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    });
  }

  startBGM(isBoss = false) {
    this.init();
    if (!this.canPlay()) return;
    this.stopBGM();

    // Use the custom uploaded music tracks
    const trackUrl = isBoss 
      ? "/assets/boss_music.mp3" 
      : "/assets/arcade_music2.mp3";

    try {
      this.bgmAudio = new Audio(trackUrl);
      this.bgmAudio.loop = true;
      // Set to 60% volume as requested
      this.bgmAudio.volume = this.globalVolume * 0.6;
      this.bgmAudio.playbackRate = 1.0;

      const playPromise = this.bgmAudio.play();
      if (playPromise !== undefined) {
        playPromise.catch(err => {
          console.warn("BGM autoplay postponed until user interaction:", err);
        });
      }
    } catch (e) {
      console.error("Failed to load BGM stream:", e);
    }
  }

  duckBGM() {
    if (this.bgmAudio) {
      this._originalVolume = this.bgmAudio.volume;
      this._originalRate = this.bgmAudio.playbackRate;
      this.bgmAudio.volume = this.globalVolume * 0.15; // lower volume drastically
      this.bgmAudio.playbackRate = 0.8; // slow down music
    }
  }

  restoreBGM() {
    if (this.bgmAudio) {
      if (this._originalVolume !== undefined) {
        this.bgmAudio.volume = this._originalVolume;
        this.bgmAudio.playbackRate = this._originalRate;
      } else {
        this.bgmAudio.volume = this.globalVolume * 0.6;
        this.bgmAudio.playbackRate = 1.0;
      }
    }
  }

  stopBGM() {
    if (this.bgmAudio) {
      try {
        this.bgmAudio.pause();
        this.bgmAudio.currentTime = 0;
      } catch {
        void 0;
      }
      this.bgmAudio = null;
    }
  }
}

// Singleton audio manager
const synthAudio = new SynthAudio();
export default synthAudio;
