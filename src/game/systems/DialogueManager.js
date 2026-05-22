import Phaser from 'phaser';
import synthAudio from '../utils/synthAudio';

const DIALOGUE_MANIFEST = {
  entry: [
    { bossAudio: '/voices/boss/boss-entry-1.mp3', bossSubtitle: "I am the storm that ends all things. You are nothing.", heroAudio: '/voices/hero/hero-entry-1.mp3', heroSubtitle: "Then let the storm begin." },
    { bossAudio: '/voices/boss/boss-entry-2.mp3', bossSubtitle: "Every ship that faced me became dust. You are next.", heroAudio: '/voices/hero/hero-entry-2.mp3', heroSubtitle: "Dust? I'm just getting started." },
    { bossAudio: '/voices/boss/boss-entry-3.mp3', bossSubtitle: "You have survived this far only because I allowed it.", heroAudio: '/voices/hero/hero-entry-3.mp3', heroSubtitle: "Then I'll make you regret that decision." }
  ],
  '75': [
    { bossAudio: '/voices/boss/boss-75-1.mp3', bossSubtitle: "A lucky shot means nothing.", heroAudio: '/voices/hero/hero-75-1.mp3', heroSubtitle: "Keep telling yourself that." },
    { bossAudio: '/voices/boss/boss-75-2.mp3', bossSubtitle: "You are merely delaying the inevitable.", heroAudio: '/voices/hero/hero-75-2.mp3', heroSubtitle: "The inevitable is you burning." },
    { bossAudio: '/voices/boss/boss-75-3.mp3', bossSubtitle: "Impressive. But you will tire before I do.", heroAudio: '/voices/hero/hero-75-3.mp3', heroSubtitle: "I never tire." }
  ],
  '50': [
    { bossAudio: '/voices/boss/boss-50-1.mp3', bossSubtitle: "Impossible. No one gets this far.", heroAudio: '/voices/hero/hero-50-1.mp3', heroSubtitle: "Get used to impossible." },
    { bossAudio: '/voices/boss/boss-50-2.mp3', bossSubtitle: "You are starting to annoy me.", heroAudio: '/voices/hero/hero-50-2.mp3', heroSubtitle: "Good. Stay annoyed." },
    { bossAudio: '/voices/boss/boss-50-3.mp3', bossSubtitle: "Fine. I will stop holding back.", heroAudio: '/voices/hero/hero-50-3.mp3', heroSubtitle: "Finally. Now we fight for real." }
  ],
  '25': [
    { bossAudio: '/voices/boss/boss-25-1.mp3', bossSubtitle: "This cannot be happening.", heroAudio: '/voices/hero/hero-25-1.mp3', heroSubtitle: "It is happening. Accept it." },
    { bossAudio: '/voices/boss/boss-25-2.mp3', bossSubtitle: "I will take you down with me!", heroAudio: '/voices/hero/hero-25-2.mp3', heroSubtitle: "You are going alone." },
    { bossAudio: '/voices/boss/boss-25-3.mp3', bossSubtitle: "You have no idea what you have unleashed.", heroAudio: '/voices/hero/hero-25-3.mp3', heroSubtitle: "I know exactly what I am doing." }
  ],
  death: [
    { bossAudio: '/voices/boss/boss-death-1.mp3', bossSubtitle: "This is not over. I will return.", heroAudio: '/voices/hero/hero-death-1.mp3', heroSubtitle: "I will be waiting." },
    { bossAudio: '/voices/boss/boss-death-2.mp3', bossSubtitle: "You won today. Enjoy it while it lasts.", heroAudio: '/voices/hero/hero-death-2.mp3', heroSubtitle: "I always do." },
    { bossAudio: '/voices/boss/boss-death-3.mp3', bossSubtitle: "Impossible... I was... unbeatable...", heroAudio: '/voices/hero/hero-death-3.mp3', heroSubtitle: "Not anymore." }
  ],
  // Enemy entry uses ONLY hero audio (no boss sprite on field yet)
  enemyEntry: [
    { heroAudio: '/voices/hero/hero-entry-1.mp3', heroSubtitle: "Come on then. Let's do this.", bossAudio: null, bossSubtitle: "Incoming enemy wave detected." },
    { heroAudio: '/voices/hero/hero-entry-2.mp3', heroSubtitle: "Another wave? I'm ready.", bossAudio: null, bossSubtitle: "Multiple hostiles inbound." },
    { heroAudio: '/voices/hero/hero-entry-3.mp3', heroSubtitle: "They just keep coming. Good.", bossAudio: null, bossSubtitle: "Hull breach risk increasing." }
  ]
};

// ─── NEW VOICE LINES MANIFESTS ────────────────────────────────────────────────
const HERO_BACKSTORY = [
  {
    audio: '/audio/hero1/hero back story/They destroyed everything I had. My fleet. My home. My people.mp3',
    subtitle: "They destroyed everything I had. My fleet. My home. My people."
  },
  {
    audio: '/audio/hero1/hero back story/I have been chasing them across the galaxy ever since..mp3',
    subtitle: "I have been chasing them across the galaxy ever since..."
  },
  {
    audio: '/audio/hero1/hero back story/This ends today. No mercy. No retreat.mp3',
    subtitle: "This ends today. No mercy. No retreat."
  }
];

const HERO_KILLS = [
  { audio: '/audio/hero1/hero kill/disapper.mp3', subtitle: "Disappear!" },
  { audio: '/audio/hero1/hero kill/done.mp3', subtitle: "Done." },
  { audio: '/audio/hero1/hero kill/next.mp3', subtitle: "Next!" },
  { audio: '/audio/hero1/hero kill/weaklings.mp3', subtitle: "Weaklings!" },
  { audio: '/audio/hero1/hero kill/who is next.mp3', subtitle: "Who is next?" }
];

const HERO_COMBAT_LINES = [
  { audio: '/audio/hero1/hero combant lines/Did you really think anyone could stop me.mp3', subtitle: "Did you really think anyone could stop me?" },
  { audio: '/audio/hero1/hero combant lines/Give me everything you have. Anything less is an insult..mp3', subtitle: "Give me everything you have. Anything less is an insult." },
  { audio: '/audio/hero1/hero combant lines/Is that all you\'ve got Come on..mp3', subtitle: "Is that all you've got? Come on!" },
  { audio: '/audio/hero1/hero combant lines/Keep coming. I\'ll keep destroying.mp3', subtitle: "Keep coming. I'll keep destroying." },
  { audio: '/audio/hero1/hero combant lines/This is your limit Don\'t make me laugh..mp3', subtitle: "This is your limit? Don't make me laugh." },
  { audio: '/audio/hero1/hero combant lines/You are already dead. You just don\'t know it yet.mp3', subtitle: "You are already dead. You just don't know it yet." }
];

const HERO_DYING = [
  { audio: '/audio/hero1/hero dying/I can\'t stop now... they need me..mp3', subtitle: "I can't stop now... they need me." },
  { audio: '/audio/hero1/hero dying/Not... like this.mp3', subtitle: "Not... like this..." },
  { audio: '/audio/hero1/hero dying/his isn\'t over... remember me.mp3', subtitle: "This isn't over... remember me." }
];

const ENEMY_RESPONSES = [
  { audio: '/audio/enemy/enemy response after their alley killed/Don\'t retreat! There is only one of him!.mp3', subtitle: "Don't retreat! There is only one of him!" },
  { audio: '/audio/enemy/enemy response after their alley killed/He\'s down! I\'ll avenge him!.mp3', subtitle: "He's down! I'll avenge him!" },
  { audio: '/audio/enemy/enemy response after their alley killed/I will be the one to finish you..mp3', subtitle: "I will be the one to finish you." },
  { audio: '/audio/enemy/enemy response after their alley killed/ay for that with your life.mp3', subtitle: "Pay for that with your life!" },
  { audio: '/audio/enemy/enemy response after their alley killed/ou... how dare you do that to my comrade...mp3', subtitle: "You... how dare you do that to my comrade..." },
  { audio: '/audio/enemy/enemy response after their alley killed/prepare yourself.mp3', subtitle: "Prepare yourself!" }
];

const ENEMY_TAUNTS = [
  { audio: '/audio/enemy/enemy taunt/Don\'t get cockyThis isn\'t over yet.mp3', subtitle: "Don't get cocky! This isn't over yet!" },
  { audio: '/audio/enemy/enemy taunt/I have seen pilots like you before. They all ended the same way..mp3', subtitle: "I have seen pilots like you before. They all ended the same way." },
  { audio: '/audio/enemy/enemy taunt/I will make you regret that confidence.mp3', subtitle: "I will make you regret that confidence!" },
  { audio: '/audio/enemy/enemy taunt/enemy taunt.mp3', subtitle: "Target acquired! Eliminate the intruder!" }
];

const REBIRTH_SUBTITLES = {
  'boss1': "You think you have won? The core reborns within me!",
  'boss 2': "Witness my ultimate form! Arise, Reborn Vanguard!",
  'hero3': "What... what is this energy? It's growing even larger!",
  'boss4': "Now, taste the true power of the void!",
  'hero5': "Just a bigger target. I'll take you down again!",
  'boss6': "Insolent insect! My Precision Laser will reduce you to ashes!",
  'hero7': "You'll have to aim better than that to catch me!",
  'boss8': "Hiding is futile! My Homing Missiles will chase you to the ends of the cosmos!",
  'hero9': "I've dodged worse than these. Try harder!",
  'boss10': "Can you strike what you cannot see? Fear the dark!",
  'hero11': "You can't hide from my targeting scanners, coward!",
  'boss12': "Feel the distortion! Portal Shots incoming!",
  'hero13': "Rifts won't save you from my plasma fire!",
  'boss14': "Your shields are failing, human! Yield to your demise!",
  'hero15': "My shields will hold, and so will my resolve!",
  'hero16': "You're getting desperate! I can feel your systems buckling!",
  'boss17': "This... this cannot be! The core is overheating!",
  'hero18': "This ends now! No mercy, no retreat!",
  'hero19': "Your empire falls today, galaxy-killer!",
  'boss20': "No! The core is critical... but I will not perish here!",
  'hero21': "Coward! Stand and face your judgment!",
  'boss22': "We will meet again, pilot... and next time, you will burn!"
};

// ─── HTML Subtitle Overlay ────────────────────────────────────────────────────
function ensureSubtitleDOM() {
  let overlay = document.getElementById('dialogue-overlay');
  if (overlay) return overlay;

  overlay = document.createElement('div');
  overlay.id = 'dialogue-overlay';
  overlay.style.cssText = `
    position: fixed;
    bottom: 0; left: 0; right: 0;
    display: none;
    flex-direction: column;
    align-items: center;
    padding-bottom: 48px;
    pointer-events: none;
    z-index: 999999;
    font-family: 'Inter', 'Segoe UI', sans-serif;
    user-select: none;
  `;

  overlay.innerHTML = `
    <div id="dialogue-speaker" style="
      font-size: 15px;
      font-weight: 900;
      letter-spacing: 4px;
      text-transform: uppercase;
      margin-bottom: 6px;
      text-shadow: 0 0 12px currentColor;
    "></div>
    <div id="dialogue-text" style="
      font-size: 26px;
      font-weight: 700;
      color: #ffffff;
      text-align: center;
      max-width: 900px;
      padding: 0 24px;
      line-height: 1.35;
      -webkit-text-stroke: 1.5px #000;
      paint-order: stroke fill;
      text-shadow:
        -2px -2px 0 #000,
         2px -2px 0 #000,
        -2px  2px 0 #000,
         2px  2px 0 #000,
         0 0 20px rgba(255,255,255,0.3);
    "></div>
  `;

  document.body.appendChild(overlay);
  return overlay;
}

function showSubtitle(speaker, text, isBossOrTheme) {
  const overlay = ensureSubtitleDOM();
  const speakerEl = document.getElementById('dialogue-speaker');
  const textEl = document.getElementById('dialogue-text');

  let color = '#22ddff';
  let glow  = '#0099ff';

  if (isBossOrTheme === true || isBossOrTheme === 'boss' || speaker === 'BOSS') {
    color = '#ff4422';
    glow  = '#ff0000';
  } else if (isBossOrTheme === 'red') {
    color = '#ff2222';
    glow  = '#aa0000';
    textEl.style.textShadow = `0 0 25px rgba(255,0,0,0.8), -2px -2px 0 #000, 2px -2px 0 #000`;
  } else if (isBossOrTheme === 'enemy' || isBossOrTheme === 'yellow' || speaker === 'ENEMY') {
    color = '#ffea00';
    glow  = '#ffaa00';
  } else if (isBossOrTheme === 'system' || isBossOrTheme === 'green' || speaker === 'SYSTEM') {
    color = '#39ff14';
    glow  = '#00ff55';
  }

  // Restore regular text shadow if not red
  if (isBossOrTheme !== 'red') {
    textEl.style.textShadow = `
      -2px -2px 0 #000,
       2px -2px 0 #000,
      -2px  2px 0 #000,
       2px  2px 0 #000,
       0 0 20px rgba(255,255,255,0.3)
    `;
  }

  speakerEl.textContent = speaker;
  speakerEl.style.color = color;
  speakerEl.style.textShadow = `0 0 16px ${glow}, 0 0 32px ${glow}`;

  textEl.textContent = text;

  overlay.style.display = 'flex';
}

function hideSubtitle() {
  const overlay = document.getElementById('dialogue-overlay');
  if (overlay) overlay.style.display = 'none';
}

// ─── DialogueManager ─────────────────────────────────────────────────────────
export default class DialogueManager {
  constructor(scene) {
    this.scene = scene;
    this.isActive = false;
    this.currentAudio = null;

    // Speaker animation states
    this.speakerTween = null;
    this.speakerGlow = null;
    this.glowTimer = null;
    this.animatedTarget = null;
    this.speakerOriginalY = null;
    this.speakerOriginalScaleX = null;
    this.speakerOriginalScaleY = null;

    // Track commentary times
    this.lastKillCommentTime = 0;
    this.lastCombatChatterTime = 0;

    // Serialized voice playback (prevents overlapping Audio elements)
    this.voiceQueue = [];
    this.isPlayingVoice = false;

    // Pre-create the DOM overlay so it's ready immediately
    ensureSubtitleDOM();
  }

  showCinematicBorders() {
    if (this.topBar || this.botBar) return;
    const BAR_HEIGHT = 110;
    const createLetterboxBar = (position) => {
      const bar = document.createElement('div');
      bar.style.cssText = `
        position: fixed; left: 0; right: 0; height: ${BAR_HEIGHT}px;
        background: #000000; z-index: 999997; pointer-events: none; transition: none;
      `;
      if (position === 'top') {
        bar.style.top = '0'; bar.style.transform = 'translateY(-100%)';
      } else {
        bar.style.bottom = '0'; bar.style.transform = 'translateY(100%)';
      }
      document.body.appendChild(bar);
      return bar;
    };
    this.topBar = createLetterboxBar('top');
    this.botBar = createLetterboxBar('bottom');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (this.topBar) {
          this.topBar.style.transition = 'transform 700ms cubic-bezier(0.22, 1, 0.36, 1)';
          this.topBar.style.transform = 'translateY(0)';
        }
        if (this.botBar) {
          this.botBar.style.transition = 'transform 700ms cubic-bezier(0.22, 1, 0.36, 1)';
          this.botBar.style.transform = 'translateY(0)';
        }
      });
    });
    const subtitleOverlay = document.getElementById('dialogue-overlay');
    if (subtitleOverlay) subtitleOverlay.style.paddingBottom = `${BAR_HEIGHT + 32}px`;
  }

  hideCinematicBorders(onDone) {
    if (!this.topBar && !this.botBar) {
      if (onDone) onDone();
      return;
    }
    const tb = this.topBar; const bb = this.botBar;
    this.topBar = null; this.botBar = null;
    if (tb) {
      tb.style.transition = 'transform 600ms cubic-bezier(0.64, 0, 0.78, 0)';
      tb.style.transform = 'translateY(-100%)';
    }
    if (bb) {
      bb.style.transition = 'transform 600ms cubic-bezier(0.64, 0, 0.78, 0)';
      bb.style.transform = 'translateY(100%)';
    }
    const subtitleOverlay = document.getElementById('dialogue-overlay');
    if (subtitleOverlay) subtitleOverlay.style.paddingBottom = '';
    setTimeout(() => {
      if (tb && tb.parentNode) tb.parentNode.removeChild(tb);
      if (bb && bb.parentNode) bb.parentNode.removeChild(bb);
      if (onDone) onDone();
    }, 650);
  }

  stopCurrentVoice() {
    if (this.currentAudio) {
      try {
        this.currentAudio.onended = null;
        this.currentAudio.onerror = null;
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch { void 0; }
      this.currentAudio = null;
    }
    this.isPlayingVoice = false;
  }

  isVoiceBusy() {
    return this.isPlayingVoice || this.voiceQueue.length > 0 ||
      (this.currentAudio && !this.currentAudio.paused && !this.currentAudio.ended);
  }

  clearVoiceQueue() {
    this.voiceQueue = [];
  }

  processVoiceQueue() {
    if (this.isPlayingVoice || this.voiceQueue.length === 0) return;
    const item = this.voiceQueue.shift();
    this._playVoiceCommentNow(item.audioUrl, item.speaker, item.text, item.options);
  }

  playExchange(phase, boss, player, onCompleteCallback) {
    if (this.isActive) {
      if (onCompleteCallback) onCompleteCallback();
      return;
    }

    if (!DIALOGUE_MANIFEST[phase]) {
      console.warn(`[DIALOGUE] No manifest for phase: ${phase}`);
      if (onCompleteCallback) onCompleteCallback();
      return;
    }

    this.isActive = true;
    this.clearVoiceQueue();
    this.stopCurrentVoice();

    const pairs = DIALOGUE_MANIFEST[phase];
    const selectedPair = pairs[Phaser.Math.Between(0, pairs.length - 1)];

    // Freeze combat and duck music
    this.scene.isCombatFrozen = true;
    synthAudio.duckBGM();

    const isBossDialogue = phase !== 'enemyEntry';
    if (isBossDialogue) {
      this.showCinematicBorders();
    }

    const cam = this.scene.cameras.main;
    const isEnemyEntry = (phase === 'enemyEntry');

    if (isEnemyEntry) {
      showSubtitle('SYSTEM', selectedPair.bossSubtitle, true);

      // Smoothly zoom in on the player
      cam.startFollow(player, true, 0.05, 0.05);
      cam.zoomTo(1.45, 1200, 'Sine.easeInOut', true, (_cam, progress) => {
        if (progress === 1) {
          this.scene.time.delayedCall(1200, () => {
            hideSubtitle();
            this.playHeroLine(selectedPair, onCompleteCallback);
          });
        }
      });
    } else {
      const followTarget = (boss && boss.active) ? boss : player;

      // Smoothly zoom in on the boss
      cam.startFollow(followTarget, true, 0.05, 0.05);
      cam.zoomTo(1.65, 1500, 'Sine.easeInOut', true, (_cam, progress) => {
        if (progress === 1) {
          this.scene.time.delayedCall(200, () => {
            this.playBossLine(selectedPair, boss, player, onCompleteCallback);
          });
        }
      });
    }
  }

  // ─── Active Speaker Floating/Pulsing Animation & Glowing Ring ───────────────────
  startSpeakerAnimation(target, isBossOrEnemy) {
    this.clearSpeakerAnimation();

    if (!target || !target.active) return;

    this.animatedTarget = target;
    this.speakerOriginalY = target.y;
    this.speakerOriginalScaleX = target.scaleX;
    this.speakerOriginalScaleY = target.scaleY;

    // 1. Premium Float and Pulse Breathing Tween
    this.speakerTween = this.scene.tweens.add({
      targets: target,
      y: target.y - 10,
      scaleX: target.scaleX * 1.05,
      scaleY: target.scaleY * 1.05,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // 2. Holographic Radio Signal Circular Wave Pulse (under the speaker)
    this.speakerGlow = this.scene.add.graphics();
    this.speakerGlow.setDepth(target.depth - 1);

    const color = isBossOrEnemy ? 0xffea00 : 0x00ccff;

    this.glowTimer = this.scene.time.addEvent({
      delay: 30,
      loop: true,
      callback: () => {
        if (!target || !target.active || !this.speakerGlow) return;
        this.speakerGlow.clear();

        const time = this.scene.time.now;
        const pulse = (time % 1000) / 1000; // 0 to 1 loop

        const radius = (target.displayWidth || 60) * 0.7;

        // Radiating pulse ring
        this.speakerGlow.lineStyle(3, color, 1 - pulse);
        this.speakerGlow.strokeCircle(target.x, target.y, radius + pulse * 50);

        // Soft secondary pulse
        this.speakerGlow.lineStyle(1.5, color, 0.4 * (1 - pulse));
        this.speakerGlow.strokeCircle(target.x, target.y, radius + pulse * 25);
      }
    });
  }

  clearSpeakerAnimation() {
    if (this.speakerTween) {
      this.speakerTween.stop();
      this.speakerTween = null;
    }

    if (this.glowTimer) {
      this.glowTimer.destroy();
      this.glowTimer = null;
    }

    if (this.speakerGlow) {
      this.speakerGlow.destroy();
      this.speakerGlow = null;
    }

    // Safely restore target coordinates
    if (this.animatedTarget && this.animatedTarget.active) {
      if (this.speakerOriginalY !== null) this.animatedTarget.y = this.speakerOriginalY;
      if (this.speakerOriginalScaleX !== null) this.animatedTarget.scaleX = this.speakerOriginalScaleX;
      if (this.speakerOriginalScaleY !== null) this.animatedTarget.scaleY = this.speakerOriginalScaleY;
    }

    this.animatedTarget = null;
    this.speakerOriginalY = null;
    this.speakerOriginalScaleX = null;
    this.speakerOriginalScaleY = null;
  }

  playBossLine(pair, boss, player, onCompleteCallback) {
    showSubtitle('BOSS', pair.bossSubtitle, true);
    
    // Add pulsing breathing animation to Boss
    this.startSpeakerAnimation(boss, true);

    if (!pair.bossAudio) {
      this.scene.time.delayedCall(2500, () => {
        hideSubtitle();
        this.transitionToHero(pair, player, onCompleteCallback);
      });
      return;
    }

    this.stopCurrentVoice();
    console.log(`[DIALOGUE] Loading boss audio: ${pair.bossAudio}`);
    const audio = new Audio(pair.bossAudio);
    this.currentAudio = audio;
    this.isPlayingVoice = true;

    const onFail = () => {
      this.isPlayingVoice = false;
      console.warn(`[DIALOGUE] Boss audio failed/missing: ${pair.bossAudio} — skipping`);
      this.scene.time.delayedCall(2500, () => {
        hideSubtitle();
        this.transitionToHero(pair, player, onCompleteCallback);
      });
    };

    audio.onerror = onFail;
    audio.onended = () => {
      this.isPlayingVoice = false;
      hideSubtitle();
      this.transitionToHero(pair, player, onCompleteCallback);
    };

    audio.play().catch(onFail);
  }

  transitionToHero(pair, player, onCompleteCallback) {
    // End Boss speaker animation
    this.clearSpeakerAnimation();

    const cam = this.scene.cameras.main;
    cam.startFollow(player, true, 0.05, 0.05);
    
    this.scene.time.delayedCall(800, () => {
      this.playHeroLine(pair, onCompleteCallback);
    });
  }

  playHeroLine(pair, onCompleteCallback) {
    showSubtitle('HERO', pair.heroSubtitle, false);
    
    // Add pulsing breathing animation to Hero
    this.startSpeakerAnimation(this.scene.player, false);

    if (!pair.heroAudio) {
      this.scene.time.delayedCall(2500, () => {
        hideSubtitle();
        this.endExchange(onCompleteCallback);
      });
      return;
    }

    this.stopCurrentVoice();
    console.log(`[DIALOGUE] Loading hero audio: ${pair.heroAudio}`);
    const audio = new Audio(pair.heroAudio);
    this.currentAudio = audio;
    this.isPlayingVoice = true;

    const onFail = () => {
      this.isPlayingVoice = false;
      console.warn(`[DIALOGUE] Hero audio failed/missing: ${pair.heroAudio} — skipping`);
      this.scene.time.delayedCall(2500, () => {
        hideSubtitle();
        this.endExchange(onCompleteCallback);
      });
    };

    audio.onerror = onFail;
    audio.onended = () => {
      this.isPlayingVoice = false;
      hideSubtitle();
      this.endExchange(onCompleteCallback);
    };

    audio.play().catch(onFail);
  }

  endExchange(onCompleteCallback) {
    hideSubtitle();
    this.clearSpeakerAnimation();
    this.hideCinematicBorders();

    if (this.currentAudio) {
      try { this.currentAudio.pause(); } catch { void 0; }
      this.currentAudio = null;
    }

    const cam = this.scene.cameras.main;
    const player = this.scene.player;

    // Smoothly zoom out
    cam.zoomTo(1.0, 900, 'Sine.easeInOut', true, (_cam, progress) => {
      if (progress === 1) {
        if (player) cam.startFollow(player, true, 0.08, 0.08);

        this.scene.time.delayedCall(400, () => {
          synthAudio.restoreBGM();
          this.isActive = false;
          this.scene.isCombatFrozen = false;
          if (onCompleteCallback) onCompleteCallback();
        });
      }
    });
  }

  stop() {
    this.stopCurrentVoice();
    this.clearVoiceQueue();
    this.clearSpeakerAnimation();
    this.hideCinematicBorders();
    hideSubtitle();
    this.isActive = false;
    if (this.scene) {
      this.scene.isCombatFrozen = false;
    }
    synthAudio.restoreBGM();
  }

  // ─── NEW UNIVERSAL VOICE COMMENT SYSTEM ──────────────────────────────────────
  playPhaserVoiceComment(audioKey, speaker, text, options = {}) {
    const baseKey = audioKey.replace('rebirth_', '');
    const fileName = baseKey + '.mp3';
    const audioUrl = 'audio/' + fileName;
    
    // Resolve subtitle text from the REBIRTH_SUBTITLES map, fallback to text
    const subtitleText = REBIRTH_SUBTITLES[baseKey] || text;
    
    this.playVoiceComment(audioUrl, speaker, subtitleText, options);
  }

  playVoiceComment(audioUrl, speaker, text, options = {}) {
    if (options.queue) {
      this.voiceQueue.push({ audioUrl, speaker, text, options: { ...options, queue: false } });
      this.processVoiceQueue();
      return null;
    }

    // Immediate line: cancel pending queue and replace current clip
    this.clearVoiceQueue();
    this.stopCurrentVoice();
    return this._playVoiceCommentNow(audioUrl, speaker, text, options);
  }

  _playVoiceCommentNow(audioUrl, speaker, text, options = {}) {
    this.stopCurrentVoice();

    if (options.freezeCombat) {
      this.scene.isCombatFrozen = true;
      if (options.cinematicBorders) {
        this.showCinematicBorders();
      }
    }
    if (options.duckBGM) {
      synthAudio.duckBGM();
    }

    const colorTheme = options.colorTheme || (speaker === 'HERO' ? 'hero' : (speaker === 'ENEMY' ? 'enemy' : 'system'));
    showSubtitle(speaker, text, colorTheme);

    if (options.target && options.target.active) {
      const isEnemyOrBoss = speaker === 'ENEMY' || speaker === 'BOSS';
      this.startSpeakerAnimation(options.target, isEnemyOrBoss);
    }

    const audio = new Audio(audioUrl);
    this.currentAudio = audio;
    this.isPlayingVoice = true;

    let cleanupTimer = null;

    const finishLine = () => {
      if (cleanupTimer) {
        clearTimeout(cleanupTimer);
        cleanupTimer = null;
      }
      this.clearSpeakerAnimation();
      hideSubtitle();
      if (options.cinematicBorders) {
        this.hideCinematicBorders();
      }

      if (this.currentAudio === audio) {
        this.currentAudio = null;
      }
      this.isPlayingVoice = false;

      if (options.freezeCombat) {
        this.scene.isCombatFrozen = false;
      }
      if (options.duckBGM) {
        synthAudio.restoreBGM();
      }

      const runNext = () => {
        if (options.onComplete) options.onComplete();
        this.processVoiceQueue();
      };

      const gap = options.gapAfter || 0;
      if (gap > 0 && this.scene) {
        this.scene.time.delayedCall(gap, runNext);
      } else {
        runNext();
      }
    };

    const onFail = (err) => {
      console.warn(`[DIALOGUE] Voice audio failed: ${audioUrl}`, err);
      cleanupTimer = setTimeout(finishLine, options.fallbackDuration || 2500);
    };

    audio.onerror = onFail;
    audio.onended = finishLine;

    if (options.duration) {
      cleanupTimer = setTimeout(() => {
        try { audio.pause(); } catch { void 0; }
        finishLine();
      }, options.duration);
    }

    audio.play().catch(onFail);
    return audio;
  }

  // ─── NEW BACKSTORY CINEMATIC MONOLOGUE ──────────────────────────────────────
  playBackstory(player, onComplete) {
    if (this.isActive) return;
    this.isActive = true;

    // Freeze player input and stop motion
    this.scene.isCombatFrozen = true;
    player.setVelocity(0, 0);

    // Hide HUD overlay
    const hud = document.getElementById('hud-root') || document.querySelector('.game-hud');
    if (hud) hud.style.opacity = '0';

    // ─── CINEMATIC LETTERBOX BARS ────────────────────────────────────────────
    this.showCinematicBorders();
    const removeLetterboxBars = (onDone) => {
      this.hideCinematicBorders(onDone);
    };
    // ─────────────────────────────────────────────────────────────────────────

    // Position hero off-screen
    player.x = this.scene.ARENA_SIZE / 2;
    player.y = this.scene.ARENA_SIZE / 2 + 180;
    player.setAlpha(0.2); // semi-invisible entering

    // Create an "Arcade Style Enemy Base" temporarily for the intro
    const enemyBaseX = this.scene.ARENA_SIZE / 2;
    const enemyBaseY = 250;
    
    const introGroup = this.scene.add.group();

    // Giant enemy boss sprite as the "Base"
    const enemyBase = this.scene.add.sprite(enemyBaseX, enemyBaseY - 50, 'bossTexture');
    enemyBase.setScale(2.5);
    enemyBase.setTint(0xff4422);
    introGroup.add(enemyBase);

    // Spawn some accompanying ships around it
    for (let i = 0; i < 6; i++) {
      const offset = (i - 2.5) * 120;
      const ship = this.scene.add.sprite(enemyBaseX + offset, enemyBaseY + 120 + Math.abs(offset)*0.5, 'hunterTexture');
      ship.setRotation(Math.PI); // facing down
      ship.setScale(1.2);
      introGroup.add(ship);
    }

    const cam = this.scene.cameras.main;
    cam.stopFollow();
    // Start camera looking at the enemy base
    cam.setScroll(enemyBaseX - cam.width / 2, enemyBaseY - cam.height / 2);
    cam.setZoom(0.85);

    // Start completely pitch black
    const blackOverlay = this.scene.add.graphics();
    blackOverlay.fillStyle(0x04040a, 1.0);
    blackOverlay.fillRect(-2000, -2000, this.scene.ARENA_SIZE + 4000, this.scene.ARENA_SIZE + 4000);
    blackOverlay.setDepth(999998);

    // Fade black mask down to starry background rapidly
    this.scene.tweens.add({
      targets: blackOverlay,
      alpha: 0.15,
      duration: 2500,
      ease: 'Quad.easeInOut'
    });

    // Slowly drift the enemy base down
    this.scene.tweens.add({
      targets: introGroup.getChildren(),
      y: '+=50',
      duration: 10000,
      ease: 'Sine.inOut'
    });

    // Camera pan from enemy base down to hero
    this.scene.tweens.add({
      targets: cam,
      scrollY: player.y - cam.height / 2,
      delay: 3500, // wait at the enemy base for 3.5s before panning
      duration: 6000,
      ease: 'Sine.easeInOut'
    });

    // Hero drifts forward
    this.scene.tweens.add({
      targets: player,
      y: this.scene.ARENA_SIZE / 2,
      alpha: 1.0,
      delay: 4500,
      duration: 6000,
      ease: 'Quad.easeOut'
    });

    // Slow cinematic camera zoom-in while panning
    this.scene.tweens.add({
      targets: cam,
      zoom: 1.15,
      duration: 10500,
      ease: 'Sine.easeInOut'
    });

    let currentLine = 0;

    const playNextLine = () => {
      if (currentLine >= HERO_BACKSTORY.length) {
        // ── Backstory complete: fade overlay then slide bars out ──
        this.scene.tweens.add({
          targets: blackOverlay,
          alpha: 0,
          duration: 1200,
          onComplete: () => {
            blackOverlay.destroy();
          }
        });

        // Flash and zoom camera to start gameplay
        cam.flash(800, 255, 255, 255);
        cam.startFollow(player, true, 0.08, 0.08);

        // Destroy temporary intro visuals
        introGroup.destroy(true);

        // Restore HUD
        if (hud) hud.style.opacity = '1';

        this.isActive = false;
        this.scene.isCombatFrozen = false;
        window.backstoryPlayed = true;

        // Slide bars out THEN fire the onComplete
        removeLetterboxBars(() => {
          if (onComplete) onComplete();
        });
        return;
      }

      const line = HERO_BACKSTORY[currentLine];
      currentLine++;

      this.playVoiceComment(line.audio, 'HERO', line.subtitle, {
        colorTheme: 'hero',
        target: player,
        onComplete: () => {
          this.scene.time.delayedCall(800, playNextLine);
        }
      });
    };

    // First line trigger (wait a bit longer so enemy is seen first)
    this.scene.time.delayedCall(2500, playNextLine);
  }

  // ─── NEW HERO KILL REACTIONS ────────────────────────────────────────────────
  playKillReaction() {
    if (this.isActive) return;
    if (this.isVoiceBusy()) return;

    // 25% chance to play on standard enemy kill
    if (Math.random() > 0.25) return;

    const now = this.scene.time.now;
    if (this.lastKillCommentTime && (now - this.lastKillCommentTime < 8000)) return;
    this.lastKillCommentTime = now;

    const roll = Phaser.Math.Between(0, HERO_KILLS.length - 1);
    const killComment = HERO_KILLS[roll];

    this.playVoiceComment(killComment.audio, 'HERO', killComment.subtitle, {
      colorTheme: 'hero',
      duration: 1800, // Non-blocking: automatically disappears after 1.8s
      interrupt: false
    });
  }

  // ─── NEW MID-COMBAT DIALOGUE CHATTER ─────────────────────────────────────────
  playCombatChatter(player, enemy, type = 'random') {
    if (this.isActive) return;
    if (this.isVoiceBusy()) return;

    const now = this.scene.time.now;
    if (this.lastCombatChatterTime && (now - this.lastCombatChatterTime < 18000)) return;
    this.lastCombatChatterTime = now;

    this.isActive = true;
    synthAudio.duckBGM();

    let speakerA, textA, audioA, targetA, themeA;
    let speakerB, textB, audioB, targetB, themeB;

    if (type === 'ally_killed') {
      // Enemy speaks first in outrage, Hero retorts
      const enemyRoll = Phaser.Math.Between(0, ENEMY_RESPONSES.length - 1);
      const enemyComment = ENEMY_RESPONSES[enemyRoll];
      speakerA = 'ENEMY';
      textA = enemyComment.subtitle;
      audioA = enemyComment.audio;
      targetA = enemy && enemy.active ? enemy : null;
      themeA = 'enemy';

      const heroRoll = Phaser.Math.Between(0, HERO_COMBAT_LINES.length - 1);
      const heroComment = HERO_COMBAT_LINES[heroRoll];
      speakerB = 'HERO';
      textB = heroComment.subtitle;
      audioB = heroComment.audio;
      targetB = player;
      themeB = 'hero';
    } else {
      // Enemy taunts, Hero retorts
      const enemyRoll = Phaser.Math.Between(0, ENEMY_TAUNTS.length - 1);
      const enemyComment = ENEMY_TAUNTS[enemyRoll];
      speakerA = 'ENEMY';
      textA = enemyComment.subtitle;
      audioA = enemyComment.audio;
      targetA = enemy && enemy.active ? enemy : null;
      themeA = 'enemy';

      const heroRoll = Phaser.Math.Between(0, HERO_COMBAT_LINES.length - 1);
      const heroComment = HERO_COMBAT_LINES[heroRoll];
      speakerB = 'HERO';
      textB = heroComment.subtitle;
      audioB = heroComment.audio;
      targetB = player;
      themeB = 'hero';
    }

    this.playVoiceComment(audioA, speakerA, textA, {
      colorTheme: themeA,
      target: targetA,
      queue: false,
      onComplete: () => {
        this.playVoiceComment(audioB, speakerB, textB, {
          colorTheme: themeB,
          target: targetB,
          queue: true,
          gapAfter: 0,
          onComplete: () => {
            this.isActive = false;
            synthAudio.restoreBGM();
          }
        });
      }
    });
  }

  // ─── NEW HERO DYING MONOLOGUE ───────────────────────────────────────────────
  playDyingMonologue(player, onComplete) {
    this.clearVoiceQueue();
    this.stopCurrentVoice();
    this.clearSpeakerAnimation();

    this.isActive = true;
    this.scene.isCombatFrozen = true;
    synthAudio.stopBGM();

    // Show letterbox cinematic borders
    this.showCinematicBorders();

    const roll = Phaser.Math.Between(0, HERO_DYING.length - 1);
    const line = HERO_DYING[roll];

    this.playVoiceComment(line.audio, 'HERO', line.subtitle, {
      colorTheme: 'red',
      target: player,
      onComplete: () => {
        this.isActive = false;
        hideSubtitle();
        this.hideCinematicBorders(() => {
          if (onComplete) onComplete();
        });
      }
    });
  }

  destroy() {
    hideSubtitle();
    this.clearSpeakerAnimation();
    if (this.currentAudio) {
      try { this.currentAudio.pause(); } catch { void 0; }
      this.currentAudio = null;
    }
    this.isActive = false;
  }
}
