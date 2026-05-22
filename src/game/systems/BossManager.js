import Phaser from 'phaser';
import { DEPTH } from './BoostManager';
import synthAudio from '../utils/synthAudio';

export default class BossManager {
  constructor(scene) {
    this.scene = scene;
    this.boss = null;
    this.bossOutline = null;
    this.bossName = '';
    this.maxHp = 100;
    this.hp = 100;
    this.bullets = null;
    this.phase = 1;
    this.attackTimer = 0;
    this.spawnTimer = 0;
    this.dodgeCooldown = 0;
    this.targetingGraphics = null;

    // Intro properties
    this.isIntroActive = false;
    this.introTimer = 0;
    this.introBanner = null;
    this.introText = null;
    this.introSubtext = null;

    // Barrier properties
    this.isShielded = false;
    this.helperDrones = [];
    this.shieldGraphics = null;

    // Charge properties
    this.chargeState = 'idle'; // 'idle' | 'warning' | 'charging' | 'cooldown'
    this.chargeTimer = 0;
    this.chargeWarningLine = null;

    // Weak phase properties
    this.isWeakPhase = false;
    this.weakPhaseTimer = 0;

    // Cinematic properties
    this.topLetterbox = null;
    this.bottomLetterbox = null;

    // Dialogue flags
    this.played75 = false;
    this.played50 = false;
    this.played25 = false;
    this.isDying = false;

    // Master AI and Unique Attacks properties
    this.dodgeTimeRemaining = 0;
    this.dodgeVector = new Phaser.Math.Vector2(0, 0);
    this.strafeDirection = 1;
    this.strafeTimer = 0;
    this.rifts = [];
    this.sweepBeam = null;
    this.mirages = [];
    this.isRebirthing = false;
    this.isEscaping = false;
    this.playedDialogueKeys = new Set();
    this.darkOverlay = null;
    this.rebirthSafetyTimer = null;
    this.bossBulletOverlap = null;
    this.playerBossOverlap = null;
    this.mirageColliders = [];
    this.bossMoveVelX = 0;
    this.bossMoveVelY = 0;
  }

  teardownActiveBoss() {
    const { scene } = this;
    this.clearRebirthSafetyTimer();
    this.isIntroActive = false;
    this.isRebirthing = false;
    this.isEscaping = false;
    this.isDying = false;
    this.bossMoveVelX = 0;
    this.bossMoveVelY = 0;

    if (this.bossBulletOverlap) {
      this.bossBulletOverlap.destroy();
      this.bossBulletOverlap = null;
    }
    if (this.playerBossOverlap) {
      this.playerBossOverlap.destroy();
      this.playerBossOverlap = null;
    }

    this.mirageColliders.forEach((c) => { if (c) c.destroy(); });
    this.mirageColliders = [];

    this.cleanBullets();
    this.cleanAuxiliaryGraphics();

    if (this.boss) {
      this.boss.destroy();
      this.boss = null;
    }

    if (scene) {
      scene.isBossIntroActive = false;
    }
  }

  getPhaseIndex() {
    if (this.phase === 'reborn') return 4;
    return typeof this.phase === 'number' ? this.phase : 1;
  }

  fadeOutDarkOverlay(onComplete) {
    const { scene } = this;
    if (!this.darkOverlay) {
      if (onComplete) onComplete();
      return;
    }
    const overlay = this.darkOverlay;
    scene.tweens.add({
      targets: overlay,
      alpha: 0,
      duration: 1100,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        if (overlay && overlay.active) overlay.destroy();
        if (this.darkOverlay === overlay) this.darkOverlay = null;
        if (onComplete) onComplete();
      }
    });
  }

  clearRebirthSafetyTimer() {
    if (this.rebirthSafetyTimer) {
      this.rebirthSafetyTimer.remove(false);
      this.rebirthSafetyTimer = null;
    }
  }

  resumeRebornCombat() {
    const { scene } = this;
    this.clearRebirthSafetyTimer();
    
    if (scene.dialogueManager) {
      scene.dialogueManager.hideCinematicBorders();
    }

    this.phase = 'reborn';
    this.maxHp = 2500;
    this.hp = this.maxHp;
    this.isDying = false;
    this.isEscaping = false;
    this.isRebirthing = false;
    this.attackTimer = 0;
    this.played75 = false;
    this.played50 = false;
    this.played25 = false;
    this.playedDialogueKeys = new Set();
    scene.isCombatFrozen = false;
    scene.isBossIntroActive = false;

    if (this.boss && this.boss.active) {
      this.boss.setAlpha(1);
      this.boss.setScale(2);
      if (this.boss.body) {
        this.boss.body.enable = true;
        this.boss.body.setSize(this.boss.width * 0.8, this.boss.height * 0.8);
      }
    }

    if (this.bossOutline) {
      this.bossOutline.setTexture('rebornBossTexture');
      this.bossOutline.setVisible(true);
      this.bossOutline.setAlpha(1);
    }

    if (this.healthBarBg) this.healthBarBg.setVisible(true);
    if (this.healthBarFill) this.healthBarFill.setVisible(true);

    const player = scene.player;
    if (player && player.active) {
      scene.cameras.main.zoomTo(1.0, 700, 'Cubic.easeOut', true);
      scene.cameras.main.stopFollow();
      scene.cameras.main.pan(player.x, player.y, 700, 'Cubic.easeInOut', true, (camera, progress) => {
        if (progress === 1 && player.active) {
          camera.startFollow(player, true, 0.08, 0.08);
        }
      });
    }

    scene.effectsManager.showFloatingText(
      this.boss ? this.boss.x : scene.ARENA_SIZE / 2,
      this.boss ? this.boss.y - 110 : scene.ARENA_SIZE / 2,
      'REBORN — ENGAGE!',
      '#ff00ff',
      '18px'
    );
    scene.cameras.main.flash(250, 157, 0, 255, 0.25);
    scene.dispatchMetricsToReact();
  }

  create() {
    this.bullets = this.scene.physics.add.group();
    // Add collision between boss bullets and player
    this.scene.physics.add.overlap(
      this.scene.player,
      this.bullets,
      this.handlePlayerBulletCollision,
      null,
      this
    );

    // Add collision between player bullets and boss bullets (destroyable bullets)
    this.scene.physics.add.overlap(
      this.scene.bullets,
      this.bullets,
      this.handleBulletCollision,
      null,
      this
    );
  }

  get bossHpPercent() {
    if (!this.boss) return 0;
    return Math.max(0, Math.round((this.hp / this.maxHp) * 100));
  }

  spawnBoss(wave) {
    const { scene } = this;
    this.teardownActiveBoss();

    const px = scene.player ? scene.player.x : scene.cameras.main.scrollX + scene.cameras.main.width / 2;
    const py = scene.player ? scene.player.y : scene.cameras.main.scrollY + scene.cameras.main.height / 2;

    this.phase = 1;
    this.bossName = wave === 5 ? 'GIGAX V1' : wave === 10 ? 'VOID OMEGA' : 'ZERO POINT';
    
    // Substantially increased HP to make it a true mass villain
    this.maxHp = 600 + wave * 150; 
    this.hp = this.maxHp;
    this.isShielded = false;
    this.shieldHp = 0;
    this.maxShieldHp = 0;
    this.helperDrones = [];
    this.chargeState = 'idle';
    this.chargeTimer = 0;
    this.played75 = false;
    this.played50 = false;
    this.played25 = false;
    this.isDying = false;
    this.isRebirthing = false;

    // Shake camera dramatically on warning detection
    scene.cameras.main.shake(1500, 0.02);
    synthAudio.playBoostActivate('VOID_STORM'); // Intense rumble sound

    // Start repeating siren alarm
    for (let i = 1; i <= 3; i++) {
      scene.time.delayedCall(i * 600, () => {
        if (this.isIntroActive) {
          synthAudio.playDamage(); // High-pitched siren sound
          scene.cameras.main.flash(150, 255, 0, 85, 0.15);
        }
      });
    }

    // Set intro active states
    scene.isBossIntroActive = true;
    this.isIntroActive = true;
    this.introTimer = 3500; // 3.5 seconds cinematic intro

    const width = scene.cameras.main.width;
    const height = scene.cameras.main.height;
    const scx = width / 2;
    const scy = height / 2;

    const arenaSize = scene.ARENA_SIZE || 2500;
    const spawnX = Phaser.Math.Clamp(px, 300, arenaSize - 300);
    const spawnY = Phaser.Math.Clamp(py - 250, 300, arenaSize - 300);

    // Create Boss physics sprite (invisible & disabled at first) so we can focus on it
    this.boss = scene.physics.add.sprite(spawnX, spawnY, 'bossTexture');
    this.boss.setCollideWorldBounds(true);
    this.boss.setDepth(DEPTH.ENEMY);
    this.boss.setScale(0); // Scales up during entry
    this.boss.setAlpha(0);
    this.boss.setImmovable(true);
    this.boss.body.enable = false; // Disabled until intro finishes

    // Create black cinematic letterbox borders sliding in via DOM
    const BAR_HEIGHT = 110;
    this.topLetterboxDom = document.createElement('div');
    this.bottomLetterboxDom = document.createElement('div');
    
    const styleBar = (bar, pos) => {
      bar.style.cssText = `
        position: fixed;
        left: 0;
        right: 0;
        height: ${BAR_HEIGHT}px;
        background: #000000;
        z-index: 999997;
        pointer-events: none;
        transition: transform 800ms cubic-bezier(0.22, 1, 0.36, 1);
      `;
      if (pos === 'top') {
        bar.style.top = '0';
        bar.style.transform = 'translateY(-100%)';
      } else {
        bar.style.bottom = '0';
        bar.style.transform = 'translateY(100%)';
      }
      document.body.appendChild(bar);
    };
    
    styleBar(this.topLetterboxDom, 'top');
    styleBar(this.bottomLetterboxDom, 'bottom');

    // Slide bars IN
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (this.topLetterboxDom) this.topLetterboxDom.style.transform = 'translateY(0)';
        if (this.bottomLetterboxDom) this.bottomLetterboxDom.style.transform = 'translateY(0)';
      });
    });

    // Stop player camera follow and focus on the boss with a closer zoom
    scene.cameras.main.stopFollow();
    scene.cameras.main.zoomTo(1.7, 1200, 'Cubic.easeInOut', true);
    scene.cameras.main.pan(this.boss.x, this.boss.y, 1200, 'Cubic.easeInOut', true);

    // Create cyber HUD name banner (sliding in screen-relative)
    this.introBanner = scene.add.rectangle(-width / 2, scy, width + 100, 110, 0x06060c, 0.88)
      .setScrollFactor(0)
      .setDepth(DEPTH.UI_OVERLAY - 2);
    this.introBanner.setStrokeStyle(3, 0xff0055, 1);
    
    this.introText = scene.add.text(-width / 2, scy - 22, 'WARNING: COLOSSAL HOSTILE INBOUND', {
      fontFamily: 'var(--font-brand)',
      fontSize: '20px',
      fill: '#ff0055',
      align: 'center',
      fontStyle: 'bold'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH.UI_OVERLAY - 1);

    // Pulse intro warning text
    scene.tweens.add({
      targets: this.introText,
      alpha: { from: 1, to: 0.3 },
      duration: 300,
      yoyo: true,
      repeat: -1
    });

    this.introSubtext = scene.add.text(-width / 2, scy + 20, `[ ${this.bossName} ]`, {
      fontFamily: 'var(--font-retro)',
      fontSize: '26px',
      fill: '#ffea00', // Neon gold highlight name
      align: 'center',
      fontStyle: 'bold',
      letterSpacing: '3px'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH.UI_OVERLAY - 1);

    // Bounce slide-in name card from off screen left to screen center
    scene.tweens.add({
      targets: [this.introBanner, this.introText, this.introSubtext],
      x: scx,
      duration: 850,
      ease: 'Back.easeOut'
    });

    // Smooth warp entry tween from a portal
    this.createRebirthPortal(spawnX, spawnY, () => {
      scene.tweens.add({
        targets: this.boss,
        scale: 2.0,
        alpha: 1.0,
        duration: 1500,
        ease: 'Back.easeOut',
        onComplete: () => {
          if (!this.boss || !this.boss.active) return;
          // Energy expansion shockwave ring
          const ring = scene.add.circle(this.boss.x, this.boss.y, 10, 0x9d00ff, 0.4).setDepth(DEPTH.ENEMY - 2);
          ring.setStrokeStyle(4, 0xff00ff, 1);
          scene.tweens.add({
            targets: ring,
            radius: 300,
            alpha: 0,
            duration: 650,
            ease: 'Cubic.easeOut',
            onComplete: () => ring.destroy()
          });
          synthAudio.playExplosion();
        }
      });
    });
    
    // Create Boss red outline silhouette
    this.bossOutline = scene.add.sprite(this.boss.x, this.boss.y, 'bossTexture');
    this.bossOutline.setScale(0);
    this.bossOutline.setTint(0xff0000);
    this.bossOutline.setDepth(DEPTH.ENEMY - 1);
    this.bossOutline.setVisible(false);

    // Health Bar setup
    if (this.healthBarBg) this.healthBarBg.destroy();
    if (this.healthBarFill) this.healthBarFill.destroy();

    this.healthBarBg = scene.add.rectangle(0, 0, 120, 11, 0x000000, 0.85).setDepth(DEPTH.UI_OVERLAY).setVisible(false);
    this.healthBarBg.setStrokeStyle(1.5, 0xffffff);
    this.healthBarFill = scene.add.rectangle(0, 0, 120, 11, 0xff0055, 1).setDepth(DEPTH.UI_OVERLAY).setOrigin(0, 0.5).setVisible(false);
    
    // Collision with player bullets (one collider per boss instance)
    this.bossBulletOverlap = scene.physics.add.overlap(
      this.boss,
      scene.bullets,
      this.handleBossBulletCollision,
      null,
      this
    );

    // Collision with player ship (contact damage and knockback)
    this.playerBossOverlap = scene.physics.add.overlap(
      scene.player,
      this.boss,
      this.handlePlayerBossCollision,
      null,
      this
    );
    
    this.attackTimer = 0;
    this.spawnTimer = 0;
    scene.dispatchMetricsToReact();
  }

  update(time, delta) {
    const { scene } = this;
    const player = scene.player;

    if (!player || !player.active) return;

    // Intro cutscene updates
    if (this.isIntroActive) {
      this.introTimer -= delta;
      scene.cameras.main.shake(50, 0.003); // Slight warning vibration
      
      if (this.introTimer <= 0) {
        this.isIntroActive = false;
        scene.isBossIntroActive = false;

        // Zoom camera back out and pan back to player
        scene.cameras.main.zoomTo(1.0, 1000, 'Cubic.easeOut', true);
        scene.cameras.main.pan(player.x, player.y, 1000, 'Cubic.easeInOut', true, (camera, progress) => {
          if (progress === 1) {
            camera.startFollow(player, true, 0.08, 0.08);
          }
        });

        // Slide banner elements off screen to the right and destroy them
        if (this.introBanner && this.introText && this.introSubtext) {
          const banner = this.introBanner;
          const txt = this.introText;
          const subtxt = this.introSubtext;
          const w = scene.cameras.main.width;
          
          scene.tweens.add({
            targets: [banner, txt, subtxt],
            x: w * 1.5,
            duration: 600,
            ease: 'Cubic.easeIn',
            onComplete: () => {
              banner.destroy();
              txt.destroy();
              subtxt.destroy();
            }
          });
          
          this.introBanner = null;
          this.introText = null;
          this.introSubtext = null;
        }

        // Enable physics and setup circles
        this.boss.body.enable = true;
        this.boss.body.setCircle(40, 0, 0);
        this.bossOutline.setVisible(true);

        // Unhide HUD and start combat once dialogue finishes
        const finalizeEntry = () => {
          if (this.topLetterboxDom && this.bottomLetterboxDom) {
            this.topLetterboxDom.style.transition = 'transform 600ms cubic-bezier(0.64, 0, 0.78, 0)';
            this.bottomLetterboxDom.style.transition = 'transform 600ms cubic-bezier(0.64, 0, 0.78, 0)';
            this.topLetterboxDom.style.transform = 'translateY(-100%)';
            this.bottomLetterboxDom.style.transform = 'translateY(100%)';
            
            const tb = this.topLetterboxDom;
            const bb = this.bottomLetterboxDom;
            setTimeout(() => {
              if (tb && tb.parentNode) tb.parentNode.removeChild(tb);
              if (bb && bb.parentNode) bb.parentNode.removeChild(bb);
            }, 650);
            
            this.topLetterboxDom = null;
            this.bottomLetterboxDom = null;
          }

          this.healthBarBg.setVisible(true);
          this.healthBarFill.setVisible(true);
          scene.effectsManager.showFloatingText(this.boss.x, this.boss.y - 100, 'ENGAGE TARGET', '#ff0055', '20px');
          scene.cameras.main.flash(300, 0, 240, 255, 0.35);
          scene.dispatchMetricsToReact();
        };

        // Trigger entry dialogue with lifted subtitle
        if (scene.dialogueManager) {
          const subtitleOverlay = document.getElementById('dialogue-overlay');
          if (subtitleOverlay) subtitleOverlay.style.paddingBottom = '142px'; // Lift above letterbox
          
          scene.dialogueManager.playExchange('entry', this.boss, player, () => {
            if (subtitleOverlay) subtitleOverlay.style.paddingBottom = '';
            finalizeEntry();
          });
        } else {
          finalizeEntry();
        }
      }
      return;
    }

    if (scene.isCombatFrozen) {
      // Keep syncing outline and targeting graphics even when frozen
      if (this.bossOutline && this.boss && this.boss.active) {
        this.bossOutline.setPosition(this.boss.x, this.boss.y);
        this.bossOutline.setRotation(this.boss.rotation);
      }
      if (this.boss && this.boss.active && this.boss.body) {
         this.boss.setVelocity(0, 0);
      }
      return;
    }

    if (!this.boss || !this.boss.active) {
      this.cleanAuxiliaryGraphics();
      return;
    }

    this.updateUniqueAttacks(time, delta);

    // Sync boss red/yellow outline positioning
    if (this.bossOutline) {
      this.bossOutline.setPosition(this.boss.x, this.boss.y);
      this.bossOutline.setRotation(this.boss.rotation);
      this.bossOutline.setScale(this.boss.scaleX * 1.08);
      this.bossOutline.setVisible(this.boss.visible);
      this.bossOutline.setAlpha(this.boss.alpha);
      this.bossOutline.setTint(this.isWeakPhase ? 0xffea00 : 0xff0000);
    }

    // Draw colossal target HUD brackets around the Boss
    if (!this.targetingGraphics) {
      this.targetingGraphics = scene.add.graphics().setDepth(DEPTH.ENEMY + 6);
    }
    this.targetingGraphics.clear();
    
    if (this.boss && this.boss.active) {
      const size = 95 * this.boss.scaleX;
      const len = size * 0.3;
      const bracketColor = this.isWeakPhase ? 0xffea00 : 0xff0000;
      this.targetingGraphics.lineStyle(2.5, bracketColor, 0.9);
      
      // Top-Left
      this.targetingGraphics.beginPath();
      this.targetingGraphics.moveTo(this.boss.x - size, this.boss.y - size + len);
      this.targetingGraphics.lineTo(this.boss.x - size, this.boss.y - size);
      this.targetingGraphics.lineTo(this.boss.x - size + len, this.boss.y - size);
      this.targetingGraphics.strokePath();

      // Top-Right
      this.targetingGraphics.beginPath();
      this.targetingGraphics.moveTo(this.boss.x + size, this.boss.y - size + len);
      this.targetingGraphics.lineTo(this.boss.x + size, this.boss.y - size);
      this.targetingGraphics.lineTo(this.boss.x + size - len, this.boss.y - size);
      this.targetingGraphics.strokePath();

      // Bottom-Left
      this.targetingGraphics.beginPath();
      this.targetingGraphics.moveTo(this.boss.x - size, this.boss.y + size - len);
      this.targetingGraphics.lineTo(this.boss.x - size, this.boss.y + size);
      this.targetingGraphics.lineTo(this.boss.x - size + len, this.boss.y + size);
      this.targetingGraphics.strokePath();

      // Bottom-Right
      this.targetingGraphics.beginPath();
      this.targetingGraphics.moveTo(this.boss.x + size, this.boss.y + size - len);
      this.targetingGraphics.lineTo(this.boss.x + size, this.boss.y + size);
      this.targetingGraphics.lineTo(this.boss.x + size - len, this.boss.y + size);
      this.targetingGraphics.strokePath();
    }

    // WEAK PHASE OVERRIDE
    if (this.isWeakPhase) {
      this.weakPhaseTimer -= delta;
      this.boss.setVelocity(0, 0); // locked in place!
      this.boss.setRotation(this.boss.rotation + 0.012); // slow disabled spin

      if (this.weakPhaseTimer <= 0) {
        this.isWeakPhase = false;
        if (this.bossOutline) {
          this.bossOutline.setTint(0xff0000);
          this.bossOutline.setAlpha(1.0);
        }
        scene.effectsManager.showFloatingText(this.boss.x, this.boss.y - 100, 'CORE STABILIZED', '#ff0055', '14px');
      }

      this.updateHealthBarPosition();
      return; // Skip movement, charge dash, attacks!
    }

    // Shield protection check & link mechanics
    if (this.isShielded) {
      this.helperDrones = this.helperDrones.filter(drone => drone && drone.active);
      if (this.helperDrones.length === 0) {
        this.isShielded = false;
        this.isWeakPhase = true;
        this.weakPhaseTimer = 5000; // 5 seconds of weakness!
        if (this.boss && this.boss.active && this.boss.body) {
          this.boss.body.setCircle(40, 0, 0); // Resize body back to normal (radius 80 scaled)
        }
        scene.effectsManager.showFloatingText(this.boss.x, this.boss.y - 120, 'CRITICAL CORE EXPOSED', '#ffea00', '18px');
        scene.effectsManager.showFloatingText(this.boss.x, this.boss.y - 95, '2.0X DAMAGE INCOMING', '#ffea00', '11px');
        synthAudio.playPickup('HEAL');
        if (this.shieldGraphics) {
          this.shieldGraphics.clear();
        }
      } else {
        if (!this.shieldGraphics) {
          this.shieldGraphics = scene.add.graphics().setDepth(DEPTH.ENEMY + 2);
        }
        this.shieldGraphics.clear();

        const shieldRadius = 65 * this.boss.scaleX; // visual radius matches body collision size (130 pixels)
        
        // Dynamic shield HP color-shift
        const shieldHpPercent = (this.shieldHp && this.maxShieldHp) ? Math.max(0, this.shieldHp / this.maxShieldHp) : 1.0;
        let shieldColor = 0x39ff14; // default Green
        if (shieldHpPercent < 0.35) {
          shieldColor = 0xff3333; // Red
        } else if (shieldHpPercent < 0.70) {
          shieldColor = 0xffaa00; // Orange/Yellow
        }

        const shieldAlpha = (0.28 + Math.sin(time * 0.012) * 0.12) * (0.4 + shieldHpPercent * 0.6);
        this.shieldGraphics.lineStyle(4.5, shieldColor, shieldAlpha * 1.5);
        this.shieldGraphics.strokeCircle(this.boss.x, this.boss.y, shieldRadius);
        this.shieldGraphics.fillStyle(shieldColor, shieldAlpha * 0.22);
        this.shieldGraphics.fillCircle(this.boss.x, this.boss.y, shieldRadius);

        // Render laser power lines linking to protective drones (now chasing player)
        this.shieldGraphics.lineStyle(1.8, 0x39ff14, 0.5 + Math.sin(time * 0.02) * 0.2);
        this.helperDrones.forEach((drone) => {
          // DO NOT override position/velocity here, let standard updateDrone handle it!
          this.shieldGraphics.beginPath();
          this.shieldGraphics.moveTo(this.boss.x, this.boss.y);
          this.shieldGraphics.lineTo(drone.x, drone.y);
          this.shieldGraphics.strokePath();

          // Drones fire small helper lasers towards the player
          const nextFire = drone.getData('nextFire') || 0;
          if (time > nextFire) {
            drone.setData('nextFire', time + 2000 + Math.random() * 1200);
            
            const targetAngle = Phaser.Math.Angle.Between(drone.x, drone.y, player.x, player.y);
            synthAudio.playLaser();
            const b = this.bullets.create(drone.x, drone.y, 'bossBulletTexture');
            b.setDepth(DEPTH.BULLET);
            b.setRotation(targetAngle);
            b.setScale(0.85);
            b.setBlendMode(Phaser.BlendModes.ADD);
            b.setVelocity(Math.cos(targetAngle) * 250, Math.sin(targetAngle) * 250);
            b.setData('damage', 8);

            const trail = scene.add.particles(0, 0, 'bossBulletTexture', {
              speed: 0,
              scale: { start: 0.6, end: 0.1 },
              alpha: { start: 0.4, end: 0 },
              lifespan: 140,
              frequency: 24,
              blendMode: 'ADD',
              follow: b
            });
            trail.setDepth(DEPTH.BULLET - 1);
            b.setData('trail', trail);
          }
        });
      }
    } else {
      if (this.shieldGraphics) {
        this.shieldGraphics.clear();
      }
    }

    // Ramping charge dash attack logic
    if (this.chargeState === 'idle' && !this.isShielded) {
      this.chargeTimer += delta;
      if (this.chargeTimer > 8500) { // Every 8.5 seconds
        this.chargeTimer = 0;
        this.chargeState = 'warning';
        this.chargeTimer = 1200; // 1.2s warning charge lines

        const threatLines = [
          'PREPARE FOR CRASH PROTOCOL',
          'COLLISION ANNIHILATION DETECTED',
          'DESTROYING ORGANIC VESSEL',
          'TARGET LOCKED FOR IMPACT'
        ];
        const msg = threatLines[Math.floor(Math.random() * threatLines.length)];
        scene.effectsManager.showFloatingText(this.boss.x, this.boss.y - 110, msg, '#ff0055', '14px');
        synthAudio.playBoostActivate('TITAN');
      }
    } else if (this.chargeState === 'warning') {
      this.chargeTimer -= delta;

      const playerAngle = Phaser.Math.Angle.Between(this.boss.x, this.boss.y, player.x, player.y);
      this.boss.setRotation(playerAngle + Math.PI / 2);

      if (!this.chargeWarningLine) {
        this.chargeWarningLine = scene.add.graphics().setDepth(DEPTH.UI_OVERLAY);
      }
      this.chargeWarningLine.clear();
      this.chargeWarningLine.lineStyle(2.5, 0xff0000, 0.6 + Math.sin(time * 0.055) * 0.3);
      this.chargeWarningLine.beginPath();
      this.chargeWarningLine.moveTo(this.boss.x, this.boss.y);
      this.chargeWarningLine.lineTo(
        this.boss.x + Math.cos(playerAngle) * 900,
        this.boss.y + Math.sin(playerAngle) * 900
      );
      this.chargeWarningLine.strokePath();

      if (this.chargeTimer <= 0) {
        if (this.chargeWarningLine) {
          this.chargeWarningLine.destroy();
          this.chargeWarningLine = null;
        }

        this.chargeState = 'charging';
        this.chargeTimer = 950; // 950ms dash speed

        const targetAngle = Phaser.Math.Angle.Between(this.boss.x, this.boss.y, player.x, player.y);
        const dashSpeed = 900; // Rapid rocket charge
        this.boss.setVelocity(Math.cos(targetAngle) * dashSpeed, Math.sin(targetAngle) * dashSpeed);
        
        scene.cameras.main.flash(120, 255, 0, 0, 0.25);
        synthAudio.playBoostActivate('VOID_STORM');
      }
    } else if (this.chargeState === 'charging') {
      this.chargeTimer -= delta;

      // Red motion ghost shadow trails
      if (Math.random() < 0.45) {
        const shadow = scene.add.sprite(this.boss.x, this.boss.y, 'bossTexture');
        shadow.setRotation(this.boss.rotation);
        shadow.setScale(this.boss.scaleX);
        shadow.setTint(0xff0055);
        shadow.setAlpha(0.4);
        scene.tweens.add({
          targets: shadow,
          alpha: 0,
          duration: 250,
          onComplete: () => shadow.destroy()
        });
      }

      // Spit hazard bullets backwards during charge
      if (Math.random() < 0.3) {
        const angleBack = this.boss.rotation + Math.PI / 2 + (Math.random() - 0.5) * 0.4;
        const b = this.bullets.create(
          this.boss.x - Math.cos(angleBack) * 30,
          this.boss.y - Math.sin(angleBack) * 30,
          'bossBulletTexture'
        );
        b.setDepth(DEPTH.BULLET);
        b.setRotation(angleBack);
        b.setBlendMode(Phaser.BlendModes.ADD);
        b.setVelocity(Math.cos(angleBack) * 160, Math.sin(angleBack) * 160);
        b.setData('damage', 12);
      }

      if (this.chargeTimer <= 0) {
        this.chargeState = 'cooldown';
        this.chargeTimer = 2200; // 2.2 seconds recovery
        this.boss.setVelocity(0, 0);
      }
    } else if (this.chargeState === 'cooldown') {
      this.chargeTimer -= delta;
      if (this.chargeTimer <= 0) {
        this.chargeState = 'idle';
        this.chargeTimer = 0;
      }
    }

    // Face the player (only if not mid-charge)
    const dist = Phaser.Math.Distance.Between(this.boss.x, this.boss.y, player.x, player.y);
    const angle = Phaser.Math.Angle.Between(this.boss.x, this.boss.y, player.x, player.y);
    
    // Check if boss is currently in a Quantum Shift
    if (this.dodgeTimeRemaining > 0) {
      this.dodgeTimeRemaining -= delta;
      this.boss.setVelocity(this.dodgeVector.x, this.dodgeVector.y);
      
      // Spawn trail phantoms
      if (Math.random() < 0.65) {
        const shadow = scene.add.sprite(this.boss.x, this.boss.y, 'bossTexture');
        shadow.setRotation(this.boss.rotation);
        shadow.setScale(this.boss.scaleX);
        shadow.setTint(0x9d00ff);
        shadow.setAlpha(0.55);
        scene.tweens.add({
          targets: shadow,
          scale: 0.1,
          alpha: 0,
          duration: 220,
          onComplete: () => shadow.destroy()
        });
      }
      
      // Face direction of dodge
      const dodgeAngle = Math.atan2(this.dodgeVector.y, this.dodgeVector.x);
      this.boss.setRotation(dodgeAngle + Math.PI / 2);
    } else if (this.chargeState !== 'charging' && this.chargeState !== 'warning' && (!this.sweepBeam || this.sweepBeam.state !== 'firing')) {
      const targetRot = angle + Math.PI / 2;
      const rotSpeed = this.phase === 'reborn' ? 0.045 : 0.065;
      this.boss.rotation = Phaser.Math.Angle.RotateTo(this.boss.rotation, targetRot, rotSpeed);

      // Advanced Steering Movement
      this.strafeTimer += delta;
      if (this.strafeTimer > 3000) {
        this.strafeTimer = 0;
        this.strafeDirection *= -1; // Alternate strafing
      }

      // Initialize composite steering forces
      let steerX = 0;
      let steerY = 0;

      // 1. Goal force (Kiting vs Aggression)
      const playerToBossAngle = Phaser.Math.Angle.Between(player.x, player.y, this.boss.x, this.boss.y);
      const angleDiff = Math.abs(Phaser.Math.Angle.Wrap(player.rotation - playerToBossAngle - Math.PI / 2));
      const isTargeted = angleDiff < 0.22; // Targeted inside a ~12 degree window

      let speed = 220 + (this.getPhaseIndex() * 20); // slightly faster in later phases
      if (isTargeted) {
        speed *= 1.45; // 45% speed boost when targeted
        if (Math.random() < 0.05) {
          this.strafeDirection *= -1; // Rapid strafe switches to throw off predicted fire
        }
      }

      if (scene.health / 100 < 0.35) {
        // Player low health: Execution Aggression!
        steerX += Math.cos(angle) * 1.5;
        steerY += Math.sin(angle) * 1.5;
        speed = 340 * (isTargeted ? 1.45 : 1.0); // Hunter speed!
      } else {
        // Normal state: optimal kiting range (260 - 450)
        if (dist > 450) {
          steerX += Math.cos(angle) * 1.0;
          steerY += Math.sin(angle) * 1.0;
        } else if (dist < 260) {
          steerX -= Math.cos(angle) * 1.3;
          steerY -= Math.sin(angle) * 1.3;
        }
      }

      // 2. Orbital Strafing force
      const strafeAngle = angle + (Math.PI / 2) * this.strafeDirection;
      steerX += Math.cos(strafeAngle) * 0.8;
      steerY += Math.sin(strafeAngle) * 0.8;

      // 3. Black Hole avoidance force
      const blackHoles = scene.blackHoleManager ? scene.blackHoleManager.blackHoles : [];
      for (const bh of blackHoles) {
        const bhDist = Phaser.Math.Distance.Between(this.boss.x, this.boss.y, bh.x, bh.y);
        const dangerZone = bh.gravityRadius + 120;
        if (bhDist < dangerZone) {
          const escapeAngle = Phaser.Math.Angle.Between(bh.x, bh.y, this.boss.x, this.boss.y);
          const pushStrength = (1 - (bhDist / dangerZone)) * 2.5; // strong push
          steerX += Math.cos(escapeAngle) * pushStrength;
          steerY += Math.sin(escapeAngle) * pushStrength;
        }
      }

      // 4. Arena Bounds containment force
      const borderThreshold = 220;
      const arenaSize = scene.ARENA_SIZE || 2000;
      if (this.boss.x < borderThreshold) steerX += 1.8;
      if (this.boss.x > arenaSize - borderThreshold) steerX -= 1.8;
      if (this.boss.y < borderThreshold) steerY += 1.8;
      if (this.boss.y > arenaSize - borderThreshold) steerY -= 1.8;

      // Normalize steering vector and apply smoothed velocity
      const length = Math.sqrt(steerX * steerX + steerY * steerY);
      let targetVelX = 0;
      let targetVelY = 0;
      if (length > 0) {
        targetVelX = (steerX / length) * speed;
        targetVelY = (steerY / length) * speed;
      }
      const velLerp = this.phase === 'reborn' ? 0.07 : 0.11;
      this.bossMoveVelX = Phaser.Math.Linear(this.bossMoveVelX, targetVelX, velLerp);
      this.bossMoveVelY = Phaser.Math.Linear(this.bossMoveVelY, targetVelY, velLerp);
      this.boss.setVelocity(this.bossMoveVelX, this.bossMoveVelY);
    }

    // Reduce dodge cooldown
    if (this.dodgeCooldown > 0) this.dodgeCooldown -= delta;

    // Check for nearby player bullets to trigger Quantum Shift
    if (this.dodgeCooldown <= 0 && scene.bullets && this.chargeState !== 'charging' && this.dodgeTimeRemaining <= 0) {
      const bossX = this.boss.x;
      const bossY = this.boss.y;
      
      // Scan for bullets within 220px
      const incomingBullet = scene.bullets.getChildren().find(b => {
        if (!b.active || !b.body) return false;
        const distToB = Phaser.Math.Distance.Between(bossX, bossY, b.x, b.y);
        if (distToB > 220) return false;
        
        // Dot product to check if bullet is moving toward the boss
        const dx = bossX - b.x;
        const dy = bossY - b.y;
        const dot = b.body.velocity.x * dx + b.body.velocity.y * dy;
        return dot > 0;
      });

      if (incomingBullet) {
        // Phase-scaled cooldowns: Phase 1: 2.5s, Phase 2: 1.8s, Phase 3: 1.1s, Phase 4: 0.7s
        const cds = [2500, 1800, 1100, 700];
        this.dodgeCooldown = cds[Math.min(this.getPhaseIndex() - 1, 3)];
        
        // Calculate perpendicular dodge angle
        const bulletAngle = Math.atan2(incomingBullet.body.velocity.y, incomingBullet.body.velocity.x);
        
        // Choose perpendicular direction away from arena borders or other threats
        const option1 = bulletAngle + Math.PI / 2;
        const option2 = bulletAngle - Math.PI / 2;
        
        let chosenAngle = option1;
        // Choose angle that points closer to the center of the arena
        const arenaSize = scene.ARENA_SIZE || 2000;
        const cx = arenaSize / 2;
        const cy = arenaSize / 2;
        
        const dist1 = Phaser.Math.Distance.Between(bossX + Math.cos(option1) * 150, bossY + Math.sin(option1) * 150, cx, cy);
        const dist2 = Phaser.Math.Distance.Between(bossX + Math.cos(option2) * 150, bossY + Math.sin(option2) * 150, cx, cy);
        
        if (dist2 < dist1) {
          chosenAngle = option2;
        }

        // Apply Quantum Shift Dash
        this.dodgeTimeRemaining = 120; // 120ms dash
        this.dodgeVector.setTo(Math.cos(chosenAngle) * 1600, Math.sin(chosenAngle) * 1600);
        this.boss.setVelocity(this.dodgeVector.x, this.dodgeVector.y);
        
        // Visual flash & Floating Text
        scene.effectsManager.showFloatingText(bossX, bossY - 80, 'QUANTUM SHIFT', '#9d00ff', '12px');
        scene.cameras.main.flash(100, 157, 0, 255, 0.2);
        synthAudio.playBoostActivate('VOID_STORM');
        
        // Create initial warping shadows
        for (let i = 0; i < 4; i++) {
          scene.time.delayedCall(i * 30, () => {
            if (!this.boss || !this.boss.active) return;
            const shadow = scene.add.sprite(this.boss.x, this.boss.y, 'bossTexture');
            shadow.setRotation(this.boss.rotation);
            shadow.setScale(this.boss.scaleX);
            shadow.setTint(0xff00ff);
            shadow.setAlpha(0.45);
            scene.tweens.add({
              targets: shadow,
              alpha: 0,
              scale: 0.8,
              duration: 250,
              onComplete: () => shadow.destroy()
            });
          });
        }

        // Phase 3 & 4 PERFECT DODGE COUNTER ATTACK
        if (this.getPhaseIndex() >= 3) {
          scene.time.delayedCall(120, () => {
            if (!this.boss || !this.boss.active) return;
            this.firePerfectCounter();
          });
        }
      }
    }

    // Update Health Bar Position
    this.updateHealthBarPosition();

    // Dialogue Triggers
    const hpPct = this.hp / this.maxHp;
    if (hpPct <= 0.75 && !this.played75) {
      this.played75 = true;
      if (scene.dialogueManager) scene.dialogueManager.playExchange('75', this.boss, player);
    } else if (hpPct <= 0.50 && !this.played50) {
      this.played50 = true;
      if (scene.dialogueManager) scene.dialogueManager.playExchange('50', this.boss, player);
    } else if (hpPct <= 0.25 && !this.played25) {
      this.played25 = true;
      if (scene.dialogueManager) scene.dialogueManager.playExchange('25', this.boss, player);
    }

    // Phase Transitions
    if (this.hp <= this.maxHp * 0.5 && this.phase === 1) {
      this.phase = 2;
      scene.effectsManager.showFloatingText(
        this.boss.x, this.boss.y - 60,
        'PHASE 2 - SHIELD PROTOCOL ACTIVATED',
        '#ffea00',
        '13px'
      );
      scene.cameras.main.flash(200, 255, 0, 85, 0.45);
      synthAudio.playBoostActivate('TITAN');
      this.activateTransitionShield();
    }

    if (this.hp <= this.maxHp * 0.25 && this.phase === 2) {
      this.phase = 3;
      scene.effectsManager.showFloatingText(
        this.boss.x, this.boss.y - 60,
        'PHASE 3 - RE-INFORCED BARRIERS & OVERDRIVE',
        '#ff0055',
        '13px'
      );
      scene.cameras.main.shake(600, 0.02);
      this.boss.setTint(0xff5555); // Red highlight
      if (this.bossOutline) this.bossOutline.setTint(0xffaa00);
      synthAudio.playBoostActivate('VOID_STORM');
      this.activateTransitionShield();
    }

    if (this.hp <= this.maxHp * 0.10 && this.phase === 3) {
      this.phase = 4;
      scene.effectsManager.showFloatingText(
        this.boss.x, this.boss.y - 60,
        'CRITICAL: DESPERATION SYSTEM SURGE',
        '#ff00ff',
        '15px'
      );
      scene.cameras.main.flash(300, 255, 0, 255, 0.5);
      this.boss.setTint(0xff00ff); // Purple desperate glow
      if (this.bossOutline) this.bossOutline.setTint(0xff00ff);
      synthAudio.playBoostActivate('VOID_STORM');
      this.spawnMirages();
    }

    // Gravity field pulling player (Phases 2+)
    if (this.getPhaseIndex() >= 2) {
      if (dist < 400 && dist > 30) {
        const pullFactor = (1 - dist / 400) * 110 * (delta / 1000) * (this.getPhaseIndex() === 3 ? 1.35 : 1.0);
        player.body.velocity.x -= Math.cos(angle) * pullFactor * 40;
        player.body.velocity.y -= Math.sin(angle) * pullFactor * 40;

        if (Math.random() < 0.15) {
          const sparkAngle = Math.random() * Math.PI * 2;
          const spark = scene.add.circle(
            this.boss.x + Math.cos(sparkAngle) * dist,
            this.boss.y + Math.sin(sparkAngle) * dist,
            2, 0xff00ff, 0.7
          ).setDepth(DEPTH.ENEMY_TRAIL);
          
          scene.tweens.add({
            targets: spark,
            x: this.boss.x,
            y: this.boss.y,
            alpha: 0,
            duration: 500,
            onComplete: () => spark.destroy()
          });
        }
      }
    }

    // Attacks (only if not charging, warning, sweeping beam, or in weak phase)
    if (this.chargeState !== 'warning' && this.chargeState !== 'charging' && (!this.sweepBeam || this.sweepBeam.state !== 'firing')) {
      this.attackTimer += delta;

      if (this.phase === 1) {
        if (this.attackTimer > 1200) {
          this.attackTimer = 0;
          if (Math.random() < 0.75) {
            this.fireRadialPattern(12);
          } else {
            this.fireHomingRocket();
          }
        }
      } else if (this.phase === 2) {
        if (this.attackTimer > 1800) {
          this.attackTimer = 0;
          const rng = Math.random();
          if (rng < 0.45 && this.rifts.length === 0) {
            this.fireGravityWell();
          } else if (rng < 0.75) {
            this.fireSpiralPattern(16);
          } else {
            this.fireHomingRocket();
          }
        }
      } else if (this.phase === 3) {
        if (this.attackTimer > 2000) {
          this.attackTimer = 0;
          const rng = Math.random();
          if (rng < 0.45 && !this.sweepBeam) {
            this.fireSweepBeam();
          } else if (rng < 0.75 && this.rifts.length === 0) {
            this.fireGravityWell();
          } else {
            this.fireSniperLaser(player);
          }
        }
      } else if (this.phase === 4) {
        // Respawn Mirage Clones if they are all shattered
        if (this.mirages.length === 0 && !this.isWeakPhase) {
          this.spawnMirages();
        }

        if (this.attackTimer > 2200) {
          this.attackTimer = 0;
          const rng = Math.random();
          if (rng < 0.4 && !this.sweepBeam) {
            this.fireSweepBeam();
          } else if (rng < 0.7 && this.rifts.length === 0) {
            this.fireGravityWell();
          } else {
            this.fireSpiralPattern(22);
          }
        }
      } else if (this.phase === 'reborn') {
        if (this.attackTimer > 2400) {
          this.attackTimer = 0;
          this.executeRebornAttack(player);
        }
      }
    }

    // Strict Boundary Clamping and Dynamic Camera Zoom
    if (this.boss && this.boss.active && !this.isDying && !this.isIntroActive) {
      const arenaSize = scene.ARENA_SIZE || 2500;
      if (this.boss.x < 120) { this.boss.x = 120; this.boss.body.velocity.x = 0; }
      if (this.boss.x > arenaSize - 120) { this.boss.x = arenaSize - 120; this.boss.body.velocity.x = 0; }
      if (this.boss.y < 120) { this.boss.y = 120; this.boss.body.velocity.y = 0; }
      if (this.boss.y > arenaSize - 120) { this.boss.y = arenaSize - 120; this.boss.body.velocity.y = 0; }

      const dist = Phaser.Math.Distance.Between(this.boss.x, this.boss.y, player.x, player.y);
      const targetZoom = Phaser.Math.Clamp(1.0 - (dist - 200) / 1000, 0.78, 1.0);
      const zoomLerp = this.phase === 'reborn' ? 0.025 : 0.04;
      scene.cameras.main.zoom = Phaser.Math.Linear(scene.cameras.main.zoom, targetZoom, zoomLerp);
    }

    // Update homing missiles
    if (this.bullets && this.bullets.children) {
      this.bullets.getChildren().forEach(b => {
        if (b.active && b.getData('isHoming')) {
          const target = b.getData('target');
          if (target && target.active) {
            const targetAngle = Phaser.Math.Angle.Between(b.x, b.y, target.x, target.y);
            let currentAngle = b.rotation;
            let newAngle = Phaser.Math.Angle.RotateTo(currentAngle, targetAngle, 0.03);
            b.setRotation(newAngle);
            b.setVelocity(Math.cos(newAngle) * 300, Math.sin(newAngle) * 300);
          }
        }
      });
    }
  }

  executeRebornAttack(player) {
    if (!player || !player.active) return;
    const dist = Phaser.Math.Distance.Between(this.boss.x, this.boss.y, player.x, player.y);
    const speed = player.body.velocity.length();
    
    let availableAttacks = [];
    
    if (dist < 600) availableAttacks.push('laser');
    if (speed > 250) availableAttacks.push('missiles');
    availableAttacks.push('invisibility'); 
    if (dist > 800) availableAttacks.push('portal');
    
    availableAttacks = availableAttacks.filter(a => a !== this.lastRebornAttack);
    
    if (availableAttacks.length === 0) {
      const all = ['laser', 'missiles', 'invisibility', 'portal'];
      availableAttacks = all.filter(a => a !== this.lastRebornAttack);
    }
    
    const chosen = availableAttacks[Math.floor(Math.random() * availableAttacks.length)];
    this.lastRebornAttack = chosen;
    
    if (chosen === 'laser') this.fireRebornPrecisionLaser(player);
    else if (chosen === 'missiles') this.fireRebornHomingMissiles(player);
    else if (chosen === 'invisibility') this.executeRebornInvisibilityStrike(player);
    else if (chosen === 'portal') this.executeRebornPortalShot(player);
  }

  fireRebornPrecisionLaser(player) {
    this.chargeState = 'charging';
    synthAudio.playLaser(); 
    
    // Add high-quality pre-attack charge effect
    const preAttack = this.scene.add.sprite(this.boss.x, this.boss.y, 'preAttackAnim');
    preAttack.play('pre_attack_charge');
    preAttack.setDepth(DEPTH.EFFECTS || 10);
    preAttack.setScale(0);
    preAttack.setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({
      targets: preAttack,
      scale: 1.5,
      alpha: { start: 1, end: 0 },
      angle: 360,
      duration: 1500,
      ease: 'Cubic.easeOut',
      onUpdate: () => {
        if (this.boss && this.boss.active) {
          preAttack.setPosition(this.boss.x, this.boss.y);
        }
      },
      onComplete: () => {
        if (preAttack && preAttack.active) preAttack.destroy();
      }
    });

    let lineGraphics = this.scene.add.graphics();
    lineGraphics.setDepth(DEPTH.EFFECTS);
    
    const updateLine = this.scene.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        if (!this.boss || !this.boss.active || !player || !player.active) {
           updateLine.remove();
           lineGraphics.destroy();
           return;
        }
        lineGraphics.clear();
        lineGraphics.lineStyle(2, 0xff0000, 0.7);
        lineGraphics.beginPath();
        lineGraphics.moveTo(this.boss.x, this.boss.y);
        lineGraphics.lineTo(player.x, player.y);
        lineGraphics.strokePath();
      }
    });

    this.scene.time.delayedCall(1500, () => {
      updateLine.remove();
      lineGraphics.destroy();
      this.chargeState = 'idle';
      
      if (!this.boss || !this.boss.active || !player || !player.active) return;
      
      synthAudio.playLaser();
      const angle = Phaser.Math.Angle.Between(this.boss.x, this.boss.y, player.x, player.y);
      const b = this.bullets.create(this.boss.x, this.boss.y, 'bossBulletTexture');
      b.setDepth(DEPTH.BULLET);
      b.setRotation(angle);
      b.setBlendMode(Phaser.BlendModes.ADD);
      b.setScale(1.5);
      b.setVelocity(Math.cos(angle) * 800, Math.sin(angle) * 800);
      b.setData('damage', 35);
    });
  }

  fireRebornHomingMissiles(player) {
    const spawnMissile = (i) => {
      if (!this.boss || !this.boss.active || !player || !player.active) return;
      synthAudio.playLaser();
      const offsetAngle = (i === 0 ? -1 : 1) * 0.5;
      const angle = Phaser.Math.Angle.Between(this.boss.x, this.boss.y, player.x, player.y) + offsetAngle;

      const b = this.bullets.create(this.boss.x, this.boss.y, 'bossBulletTexture');
      b.setTint(0xff8800);
      b.setDepth(DEPTH.BULLET);
      b.setRotation(angle);
      b.setBlendMode(Phaser.BlendModes.ADD);
      b.setScale(1.2);
      b.setVelocity(Math.cos(angle) * 300, Math.sin(angle) * 300);
      b.setData('damage', 25);
      b.setData('hp', 20); // destructible
      b.setData('isHoming', true);
      b.setData('target', player);
      
      const trail = this.scene.add.particles(0, 0, 'bossBulletTexture', {
        speed: 0,
        scale: { start: 0.8, end: 0.1 },
        alpha: { start: 0.6, end: 0 },
        tint: 0xff8800,
        lifespan: 300,
        blendMode: 'ADD',
        follow: b
      });
      trail.setDepth(DEPTH.BULLET - 1);
      b.setData('trail', trail);
    };

    spawnMissile(0);
    this.scene.time.delayedCall(280, () => spawnMissile(1));
  }

  executeRebornInvisibilityStrike(player) {
    this.chargeState = 'charging';
    this.bossMoveVelX = 0;
    this.bossMoveVelY = 0;
    this.boss.setVelocity(0, 0);
    this.scene.tweens.add({
      targets: this.boss,
      alpha: 0.12,
      scale: this.boss.scaleX * 0.92,
      duration: 700,
      ease: 'Sine.easeIn',
      onComplete: () => {
        if (!this.boss || !this.boss.active || !player || !player.active) return;

        const angle = Math.random() * Math.PI * 2;
        const dist = 300 + Math.random() * 200;
        let nx = player.x + Math.cos(angle) * dist;
        let ny = player.y + Math.sin(angle) * dist;

        const arenaSize = this.scene.ARENA_SIZE || 2500;
        nx = Phaser.Math.Clamp(nx, 200, arenaSize - 200);
        ny = Phaser.Math.Clamp(ny, 200, arenaSize - 200);

        this.scene.tweens.add({
          targets: this.boss,
          x: nx,
          y: ny,
          duration: 450,
          ease: 'Cubic.easeInOut',
          onComplete: () => {
            this.scene.tweens.add({
              targets: this.boss,
              alpha: 1,
              scale: 2,
              duration: 420,
              ease: 'Sine.easeOut',
              onComplete: () => {
                this.chargeState = 'idle';
                if (!this.boss || !this.boss.active || !player || !player.active) return;

                synthAudio.playLaser();
                const shotAngle = Phaser.Math.Angle.Between(this.boss.x, this.boss.y, player.x, player.y);
                const b = this.bullets.create(this.boss.x, this.boss.y, 'bossBulletTexture');
                b.setTint(0xff00ff);
                b.setDepth(DEPTH.BULLET);
                b.setRotation(shotAngle);
                b.setBlendMode(Phaser.BlendModes.ADD);
                b.setScale(1.5);
                b.setVelocity(Math.cos(shotAngle) * 600, Math.sin(shotAngle) * 600);
                b.setData('damage', 30);
              },
            });
          },
        });
      },
    });
  }

  executeRebornPortalShot(player) {
    if (!this.boss || !this.boss.active) return;
    this.boss.setVelocity(0, 0);
    this.boss.body.enable = false;

    // 1. Open portal at current boss location
    this.createRebirthPortal(this.boss.x, this.boss.y, () => {
      if (!this.boss || !this.boss.active) return;
      
      // Boss disappears into portal
      this.scene.tweens.add({
        targets: this.boss,
        scale: 0,
        angle: '+=360',
        alpha: 0,
        duration: 400,
        ease: 'Sine.easeIn',
        onComplete: () => {
          if (!player || !player.active || !this.boss || !this.boss.active) return;
          
          // Calculate spawn position immediately behind/near the player
          const angle = Phaser.Math.Angle.Between(this.boss.x, this.boss.y, player.x, player.y);
          const px = player.x + Math.cos(angle) * 200;
          const py = player.y + Math.sin(angle) * 200;
          
          this.boss.setPosition(px, py);
          
          // 2. Open portal at new location
          this.createRebirthPortal(px, py, () => {
            if (!this.boss || !this.boss.active) return;
            
            // Boss reappears from portal
            this.scene.tweens.add({
              targets: this.boss,
              scale: 1.5,
              angle: '+=360',
              alpha: 1,
              duration: 400,
              ease: 'Sine.easeOut',
              onComplete: () => {
                if (!this.boss || !this.boss.active) return;
                this.boss.body.enable = true;
                
                // 3. Fast anime-style ring attack
                this.fireRadialPattern(16);
                
                // Add camera shake for impact
                this.scene.cameras.main.shake(300, 0.015);
              }
            });
          });
        }
      });
    });
  }

  activateTransitionShield() {
    this.isShielded = true;
    const wave = this.scene.wave;
    this.shieldHp = 220 + wave * 15;
    this.maxShieldHp = this.shieldHp;

    if (this.boss && this.boss.active && this.boss.body) {
      this.boss.body.setCircle(65, -25, -25); // Resize body to match active shield bounds (radius 130 scaled)
    }
    this.spawnHelperDrones(4);
    synthAudio.playPickup('SHIELD');
  }

  fireRadialPattern(count) {
    synthAudio.playLaser();
    for (let i = 0; i < count; i++) {
      const bulletAngle = (i / count) * Math.PI * 2;
      const b = this.bullets.create(
        this.boss.x + Math.cos(bulletAngle) * 40,
        this.boss.y + Math.sin(bulletAngle) * 40,
        'bossBulletTexture'
      );
      b.setDepth(DEPTH.BULLET);
      b.setRotation(bulletAngle);
      b.setBlendMode(Phaser.BlendModes.ADD);
      b.setVelocity(Math.cos(bulletAngle) * 200, Math.sin(bulletAngle) * 200);
      b.setData('damage', 12);

      const trail = this.scene.add.particles(0, 0, 'bossBulletTexture', {
        speed: 0,
        scale: { start: 0.8, end: 0.1 },
        alpha: { start: 0.4, end: 0 },
        lifespan: 160,
        frequency: 24,
        blendMode: 'ADD',
        follow: b
      });
      trail.setDepth(DEPTH.BULLET - 1);
      b.setData('trail', trail);
    }
  }

  fireSpiralPattern(count) {
    synthAudio.playLaser();
    const offset = Math.random() * Math.PI;
    for (let i = 0; i < count; i++) {
      const bulletAngle = (i / count) * Math.PI * 2 + offset;
      const b = this.bullets.create(
        this.boss.x + Math.cos(bulletAngle) * 40,
        this.boss.y + Math.sin(bulletAngle) * 40,
        'bossBulletTexture'
      );
      b.setDepth(DEPTH.BULLET);
      b.setRotation(bulletAngle);
      b.setBlendMode(Phaser.BlendModes.ADD);
      b.setVelocity(Math.cos(bulletAngle) * 240, Math.sin(bulletAngle) * 240);
      b.setData('damage', 15);

      const trail = this.scene.add.particles(0, 0, 'bossBulletTexture', {
        speed: 0,
        scale: { start: 0.8, end: 0.1 },
        alpha: { start: 0.4, end: 0 },
        lifespan: 160,
        frequency: 24,
        blendMode: 'ADD',
        follow: b
      });
      trail.setDepth(DEPTH.BULLET - 1);
      b.setData('trail', trail);
    }
  }

  fireHomingRocket() {
    synthAudio.playDamage();
    const { scene } = this;
    const b = this.bullets.create(this.boss.x, this.boss.y, 'homingRocketTexture');
    b.setDepth(DEPTH.BULLET);
    b.setScale(1.2);
    b.setData('type', 'homing');
    b.setData('hp', 2);
    b.setData('damage', 25);
    
    const angle = Phaser.Math.Angle.Between(this.boss.x, this.boss.y, scene.player.x, scene.player.y);
    b.setVelocity(Math.cos(angle) * 120, Math.sin(angle) * 120);

    const trail = scene.add.particles(0, 0, 'bomberTrailTexture', {
      speed: { min: 2, max: 6 },
      scale: { start: 0.6, end: 0 },
      alpha: { start: 0.5, end: 0 },
      lifespan: 300,
      frequency: 40,
      quantity: 1,
      blendMode: 'ADD',
      follow: b
    });
    trail.setDepth(DEPTH.ENEMY_TRAIL);
    b.setData('trail', trail);
  }

  fireBulletSpam() {
    const maxShots = 18;
    const { scene } = this;
    
    scene.effectsManager.showFloatingText(this.boss.x, this.boss.y - 85, 'WARNING: BULLET SPAM', '#ffea00', '12px');
    
    const timerEvent = scene.time.addEvent({
      delay: 80,
      callback: () => {
        if (!this.boss || !this.boss.active || this.isWeakPhase) {
          timerEvent.destroy();
          return;
        }
        
        // Target player with slight spread
        const angle = Phaser.Math.Angle.Between(this.boss.x, this.boss.y, scene.player.x, scene.player.y) 
                      + Phaser.Math.FloatBetween(-0.15, 0.15);
        
        synthAudio.playLaser();
        
        const b = this.bullets.create(
          this.boss.x + Math.cos(angle) * 42,
          this.boss.y + Math.sin(angle) * 42,
          'bossBulletTexture'
        );
        b.setDepth(DEPTH.BULLET);
        b.setRotation(angle);
        b.setBlendMode(Phaser.BlendModes.ADD);
        b.setScale(0.9);
        b.setVelocity(Math.cos(angle) * 350, Math.sin(angle) * 350);
        b.setData('damage', 5); // 5 damage per bullet makes it fair but intense!

        const trail = scene.add.particles(0, 0, 'bossBulletTexture', {
          speed: 0,
          scale: { start: 0.65, end: 0.1 },
          alpha: { start: 0.45, end: 0 },
          lifespan: 140,
          frequency: 24,
          blendMode: 'ADD',
          follow: b
        });
        trail.setDepth(DEPTH.BULLET - 1);
        b.setData('trail', trail);
      },
      repeat: maxShots - 1
    });
  }

  spawnHelperDrones(count) {
    const { scene } = this;
    this.helperDrones = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const spawnX = this.boss.x + Math.cos(angle) * 165;
      const spawnY = this.boss.y + Math.sin(angle) * 165;
      
      const drone = scene.enemyManager.spawnEnemy('drone', spawnX, spawnY);
      if (drone) {
        drone.setData('hp', 6); // Helper drones are a bit tankier
        drone.setData('isHelperDrone', true);
        drone.setData('orbitIndex', i);
        this.helperDrones.push(drone);
        
        scene.tweens.add({
          targets: drone,
          scale: { from: 0.1, to: 1.5 },
          duration: 350
        });
      }
    }
  }

  handleBossBulletCollision(boss, bullet) {
    if (this.scene.isCombatFrozen) return;
    if (!bullet.active) return;
    
    // Vaporize bullets if shield barrier is online
    if (this.isShielded) {
      const dmg = bullet.getData('damage') || 1;
      this.shieldHp = Math.max(0, this.shieldHp - dmg);

      const trail = bullet.getData('trail');
      if (trail) trail.destroy();
      
      // Visual green shield ripple at deflection point
      this.scene.effectsManager.shieldDeflect(bullet.x, bullet.y);
      bullet.destroy();
      
      // Play deflection audio
      synthAudio.playShieldDeflect();

      // Check if shield was destroyed
      if (this.shieldHp <= 0) {
        this.isShielded = false;
        this.isWeakPhase = true;
        this.weakPhaseTimer = 5000; // 5 seconds of weakness!
        if (this.boss && this.boss.active && this.boss.body) {
          this.boss.body.setCircle(40, 0, 0); // Resize body back to normal
        }
        
        // Blow up helper drones
        this.helperDrones.forEach(drone => {
          if (drone && drone.active) {
            this.scene.enemyManager.destroyEnemy(drone);
          }
        });
        this.helperDrones = [];

        this.scene.effectsManager.showFloatingText(this.boss.x, this.boss.y - 120, 'BARRIER SHATTERED', '#00f0ff', '18px');
        this.scene.effectsManager.showFloatingText(this.boss.x, this.boss.y - 95, 'CRITICAL CORE EXPOSED', '#ffea00', '14px');
        
        // Big shockwave explosion
        this.scene.effectsManager.enemyDeath(this.boss.x, this.boss.y, 0x00f0ff);
        synthAudio.playShieldBreak();
        if (this.shieldGraphics) {
          this.shieldGraphics.clear();
        }
      } else {
        // Floating health display for shield (throttled)
        const lastShieldAlert = this.lastShieldAlert || 0;
        if (this.scene.time.now > lastShieldAlert + 300) {
          this.lastShieldAlert = this.scene.time.now;
          this.scene.effectsManager.showFloatingText(
            this.boss.x, this.boss.y - 70,
            `SHIELD HP: ${Math.round(this.shieldHp)}`, "#39ff14", "11px"
          );
        }
      }
      return;
    }

    let dmg = bullet.getData('damage') || 1;
    if (this.isWeakPhase) {
      dmg *= 2;
      this.scene.effectsManager.showFloatingText(bullet.x, bullet.y, "CRIT x2", "#ffea00", "11px");
    }
    const trail = bullet.getData('trail');
    if (trail) trail.destroy();
    
    const bx = bullet.x;
    const by = bullet.y;
    bullet.destroy();

    this.hp -= dmg;
    this.scene.effectsManager.bulletHit(bx, by, this.isWeakPhase ? 0xffea00 : 0xff0055);
    this.scene.effectsManager.hitFlash(boss);
    synthAudio.playHit();
    this.scene.dispatchMetricsToReact();

    // ─── REBORN PHASE: Health-Based Dialogue & Escape Sequence ───────────────
    if (this.phase === 'reborn' && !this.isEscaping) {
      const hpPct = this.hp / this.maxHp;

      // --- 5% Escape Trigger ---
      if (hpPct <= 0.05) {
        this.startEscapeSequence();
        return;
      }

      // --- Health threshold dialogues: 75%, 50%, 25% ---
      if (hpPct <= 0.75 && !this.played75) {
        this.played75 = true;
        this.triggerMidFightDialogue([
          { key: 'hero7', speaker: 'HERO' },
          { key: 'boss8', speaker: 'BOSS' },
          { key: 'hero9', speaker: 'HERO' }
        ]);
      } else if (hpPct <= 0.50 && !this.played50) {
        this.played50 = true;
        this.triggerMidFightDialogue([
          { key: 'boss10', speaker: 'BOSS' },
          { key: 'hero11', speaker: 'HERO' },
          { key: 'boss12', speaker: 'BOSS' },
          { key: 'hero13', speaker: 'HERO' }
        ]);
      } else if (hpPct <= 0.25 && !this.played25) {
        this.played25 = true;
        this.triggerMidFightDialogue([
          { key: 'boss14', speaker: 'BOSS' },
          { key: 'hero15', speaker: 'HERO' },
          { key: 'hero16', speaker: 'HERO' },
          { key: 'boss17', speaker: 'BOSS' },
          { key: 'hero18', speaker: 'HERO' }
        ]);
      }
    }

    if (this.hp <= 0 && !this.isDying && !this.isRebirthing) {
      if (this.scene.wave === 5 && this.phase !== 'reborn') {
        this.startRebirthSequence();
        return;
      }
      this.isDying = true;
      this.boss.body.enable = false;
      this.boss.setVelocity(0, 0);
      this.boss.setAlpha(1.0); // FIX: Ensure boss is fully visible on death
      
      this.scene.cameras.main.zoomTo(1.0, 1500, 'Cubic.easeOut', true);
      
      // Clear out bullets and drones to make the death cinematic clean
      if (this.shieldGraphics) this.shieldGraphics.clear();
      if (this.chargeWarningLine) this.chargeWarningLine.destroy();
      
      if (this.scene.dialogueManager) {
        this.scene.dialogueManager.playExchange('death', this.boss, this.scene.player, () => {
          this.destroyBoss();
        });
      } else {
        this.destroyBoss();
      }
    }
  }

  handleBulletCollision(playerBullet, bossBullet) {
    if (this.scene.isCombatFrozen) return;
    if (!playerBullet.active || !bossBullet.active) return;

    // Destroy player bullet
    const playerBulletTrail = playerBullet.getData('trail');
    if (playerBulletTrail) playerBulletTrail.destroy();
    playerBullet.destroy();

    // Check if boss bullet is homing rocket with hp
    const hp = bossBullet.getData('hp');
    if (hp !== undefined) {
      const newHp = hp - 1;
      bossBullet.setData('hp', newHp);
      if (newHp <= 0) {
        const bossBulletTrail = bossBullet.getData('trail');
        if (bossBulletTrail) bossBulletTrail.destroy();
        this.scene.effectsManager.enemyDeath(bossBullet.x, bossBullet.y, 0x9d00ff);
        synthAudio.playExplosion();
        bossBullet.destroy();
      } else {
        // Flash rocket red on hit
        bossBullet.setTint(0xff3333);
        this.scene.time.delayedCall(80, () => {
          if (bossBullet.active) bossBullet.clearTint();
        });
      }
    } else {
      // Standard boss bullet: destroy immediately
      const bossBulletTrail = bossBullet.getData('trail');
      if (bossBulletTrail) bossBulletTrail.destroy();
      
      // Small purple spark cancellation effects
      this.scene.effectsManager.bulletCancel(bossBullet.x, bossBullet.y);
      synthAudio.playHit(); // play tick audio
      bossBullet.destroy();
    }
  }

  handlePlayerBulletCollision(player, bullet) {
    if (this.scene.isCombatFrozen) return;
    if (!bullet.active || this.scene.health <= 0) return;
    if (this.scene.postDamageInvulnTimeRemaining > 0) return;
    if (this.scene.isInvulnerable) {
      const trail = bullet.getData('trail');
      if (trail) trail.destroy();
      bullet.destroy();
      return;
    }

    if (this.scene.isShielded) {
      const trail = bullet.getData('trail');
      if (trail) trail.destroy();
      bullet.destroy();
      return;
    }

    const damage = bullet.getData('damage') || 10;
    const trail = bullet.getData('trail');
    if (trail) trail.destroy();
    bullet.destroy();

    this.scene.health = Math.max(0, this.scene.health - damage);
    this.scene.lastDamageTime = this.scene.time.now;
    this.scene.postDamageInvulnTimeRemaining = 600; // 600ms invuln!
    this.scene.effectsManager.playerDamage();
    synthAudio.playDamage();
    this.scene.dispatchMetricsToReact();

    if (this.scene.health <= 0) {
      this.scene.handleGameOver();
    }
  }

  handlePlayerBossCollision(player, boss) {
    if (this.scene.isCombatFrozen) return;
    if (!boss.active || this.scene.health <= 0 || this.scene.isBossIntroActive) return;
    if (this.scene.postDamageInvulnTimeRemaining > 0) return;
    if (this.scene.isInvulnerable) return;

    if (this.isShielded) {
      // Repel player if boss is shielded, but don't damage if player deflector shield is active
      this.scene.effectsManager.screenPulse(0x00f0ff, 0.2);

      // Ship Shield Crush: If player has collectible shield, is invulnerable, or dashing, damage the boss shield!
      if (this.scene.isShielded || this.scene.isInvulnerable || this.scene.dashTimeRemaining > 0) {
        this.shieldHp = Math.max(0, this.shieldHp - 90);
        this.scene.effectsManager.showFloatingText(
          this.boss.x, this.boss.y - 95,
          "SHIELD CRUSH -90", "#00f0ff", "14px"
        );
        synthAudio.playExplosion();
        
        // Push the player back strongly to make it feel like a heavy impact clash
        const clashAngle = Phaser.Math.Angle.Between(boss.x, boss.y, player.x, player.y);
        player.x += Math.cos(clashAngle) * 60;
        player.y += Math.sin(clashAngle) * 60;
        if (player.body) {
          player.body.setVelocity(Math.cos(clashAngle) * 450, Math.sin(clashAngle) * 450);
        }
        
        // Check if shield was destroyed
        if (this.shieldHp <= 0) {
          this.isShielded = false;
          this.isWeakPhase = true;
          this.weakPhaseTimer = 5000;
          if (this.boss && this.boss.active && this.boss.body) {
            this.boss.body.setCircle(40, 0, 0);
          }
          this.helperDrones.forEach(drone => {
            if (drone && drone.active) {
              this.scene.enemyManager.destroyEnemy(drone);
            }
          });
          this.helperDrones = [];
          this.scene.effectsManager.showFloatingText(this.boss.x, this.boss.y - 120, 'BARRIER SHATTERED', '#00f0ff', '18px');
          this.scene.effectsManager.enemyDeath(this.boss.x, this.boss.y, 0x00f0ff);
        }
        
        // Trigger screen shake
        this.scene.cameras.main.shake(200, 0.015);
      }
      return;
    }

    // Contact damage (35 during charging, 15 normal)
    const isCharging = this.chargeState === 'charging';
    const dmg = isCharging ? 35 : 15;

    this.scene.health = Math.max(0, this.scene.health - dmg);
    this.scene.lastDamageTime = this.scene.time.now;
    this.scene.postDamageInvulnTimeRemaining = 600; // 600ms invuln!
    this.scene.effectsManager.playerDamage();
    synthAudio.playDamage();
    this.scene.dispatchMetricsToReact();

    // Knockback player away from boss
    const angle = Phaser.Math.Angle.Between(boss.x, boss.y, player.x, player.y);
    player.x += Math.cos(angle) * 45;
    player.y += Math.sin(angle) * 45;
    if (player.body) {
      player.body.setVelocity(Math.cos(angle) * 350, Math.sin(angle) * 350);
    }

    if (this.scene.health <= 0) {
      this.scene.handleGameOver();
    }
  }

  startRebirthSequence() {
    this.isRebirthing = true;
    this.hp = Math.max(1, this.hp); // Keep health bar visible during cinematic
    this.boss.body.enable = false;
    this.boss.setVelocity(0, 0);
    this.boss.setAlpha(1.0); // FIX: Ensure boss is fully visible for rebirth
    this.scene.isCombatFrozen = true;
    this.clearRebirthSafetyTimer();

    // Clear bullets
    this.bullets.clear(true, true);
    if (this.shieldGraphics) this.shieldGraphics.clear();
    if (this.chargeWarningLine) this.chargeWarningLine.destroy();
    if (this.sweepBeam) {
      if (this.sweepBeam.graphics) this.sweepBeam.graphics.destroy();
      this.sweepBeam = null;
    }

    const scene = this.scene;
    const cam = scene.cameras.main;
    const dm = scene.dialogueManager;
    
    if (dm) {
      dm.showCinematicBorders();
    }

    // Failsafe: never leave the fight stuck on a black/dim overlay
    this.rebirthSafetyTimer = scene.time.delayedCall(45000, () => {
      if (!this.isRebirthing) return;
      this.fadeOutDarkOverlay();
      this.resumeRebornCombat();
    });

    if (this.darkOverlay) { this.darkOverlay.destroy(); this.darkOverlay = null; }
    this.darkOverlay = scene.add.rectangle(
      cam.scrollX + cam.width / 2, cam.scrollY + cam.height / 2,
      cam.width * 2, cam.height * 2, 0x000000, 0
    );
    this.darkOverlay.setScrollFactor(0);
    this.darkOverlay.setDepth(DEPTH.UI_OVERLAY + 15);
    
    scene.tweens.add({
      targets: this.darkOverlay,
      alpha: 0.55,
      duration: 1400,
      ease: 'Sine.easeInOut',
    });
    
    cam.shake(1800, 0.004);
    synthAudio.playBoostActivate('REBIRTH_ENERGY');

    // Glow pulsing before transformation starts
    scene.tweens.add({
      targets: this.boss,
      scale: 1.15,
      alpha: 0.85,
      yoyo: true,
      repeat: 4,
      duration: 280,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        if (!dm) {
          this.resumeRebornCombat();
          return;
        }

        // PHASE 1: Transformation Cinematic - Files 2, 3, 4, 5, 6
        
        // 1. Portal opens DURING Line 2
        this.createRebirthPortal(this.boss.x, this.boss.y, null);
        
        dm.playPhaserVoiceComment('rebirth_boss 2', 'BOSS', '', {
          colorTheme: 'boss',
          target: this.boss,
          onComplete: () => {
            
            // 2. Boss enters portal (shrinking & spinning) DURING Line 3
            scene.tweens.add({
              targets: this.boss,
              scale: 0,
              angle: '+=360',
              alpha: 0,
              duration: 2500, // Slow and stretched
              ease: 'Sine.easeIn'
            });

            dm.playPhaserVoiceComment('rebirth_hero3', 'HERO', '', {
              colorTheme: 'hero',
              target: scene.player,
              onComplete: () => {
                
                // When Line 3 completes, pan camera to the new spawn location
                const spawnX = scene.ARENA_SIZE / 2;
                const spawnY = scene.player ? scene.player.y - 300 : scene.ARENA_SIZE / 2 - 150;
                
                cam.pan(spawnX, spawnY, 1500, 'Sine.easeInOut', true, (camera, progress) => {
                  if (progress === 1) {
                    
                    // 3. New portal opens DURING Line 4 at the new location
                    this.createRebirthPortal(spawnX, spawnY, null);

                    dm.playPhaserVoiceComment('rebirth_boss4', 'BOSS', '', {
                      colorTheme: 'boss',
                      target: this.boss,
                      onComplete: () => {
                        
                        // Setup reborn boss (initial tiny state)
                        this.boss.setTexture('rebornBossTexture');
                        this.boss.setPosition(spawnX, spawnY);
                        this.boss.setAngle(0);
                        this.boss.setScale(0.15);
                        this.boss.setAlpha(0.4);

                        // 4. Reborn boss emerges (scales up & fades in) DURING Line 5 & 6
                        scene.tweens.add({
                          targets: this.boss,
                          scale: 2.0,
                          alpha: 1.0,
                          duration: 4500, // Stretched slowly across lines 5 and 6
                          ease: 'Quad.easeOut'
                        });

                        dm.playPhaserVoiceComment('rebirth_hero5', 'HERO', '', {
                          colorTheme: 'hero',
                          target: scene.player,
                          onComplete: () => {
                            
                            // 5. Final reborn boss dialogue Line 6 plays while fully emerging
                            dm.playPhaserVoiceComment('rebirth_boss6', 'BOSS', '', {
                              colorTheme: 'boss',
                              target: this.boss,
                              onComplete: () => {
                                // Transformation completes
                                this.fadeOutDarkOverlay();
                                this.resumeRebornCombat();
                              }
                            });
                          }
                        });
                      }
                    });
                  }
                });
              }
            });
          }
        });
      }
    });
  }

  createRebirthPortal(x, y, onOpen) {
    const scene = this.scene;
    if (!scene || !scene.sys || !scene.sys.isActive()) return;

    const portal = scene.add.graphics();
    portal.setDepth(DEPTH.ENEMY - 1);
    portal.setPosition(x, y);

    // ADD PORTAL SPRITE
    const portalSprite = scene.add.sprite(x, y, 'portalAnim');
    portalSprite.play('portal_swirl');
    portalSprite.setDepth(DEPTH.ENEMY - 1);
    portalSprite.setScale(0);
    portalSprite.setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({
      targets: portalSprite,
      angle: 360,
      duration: 3000,
      loop: -1
    });

    let radius = 0;
    let angle = 0;
    let closed = false;

    const cleanupPortal = () => {
      if (closed) return;
      closed = true;
      if (portalUpdate) portalUpdate.remove(false);
      if (portal && portal.active) portal.destroy();
      if (portalSprite && portalSprite.active) portalSprite.destroy();
    };

    const portalUpdate = scene.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        if (!portal.active || closed) return;
        portal.clear();
        portal.lineStyle(4, 0x800080, 1);
        portal.beginPath();
        portal.arc(0, 0, radius, 0, Math.PI * 2);
        portal.strokePath();

        for (let i = 0; i < 5; i++) {
          portal.lineStyle(2, 0xff00ff, 0.5);
          portal.beginPath();
          portal.arc(0, 0, radius * (0.2 * i), angle + (i * 0.5), angle + Math.PI + (i * 0.5));
          portal.strokePath();
        }
        angle += 0.1;
      }
    });

    scene.tweens.add({
      targets: { r: 0 },
      r: 150,
      duration: 1400,
      ease: 'Cubic.easeOut',
      onUpdate: (tween) => { 
        radius = tween.getValue(); 
        if (portalSprite && portalSprite.active) {
          portalSprite.setScale(radius / 250);
          portalSprite.setAlpha(0.6 + (Math.sin(radius) * 0.4));
        }
      },
      onComplete: () => {
        if (!scene.sys.isActive()) {
          cleanupPortal();
          return;
        }
        if (onOpen) onOpen();

        scene.time.delayedCall(2000, () => {
          if (!scene.sys.isActive()) {
            cleanupPortal();
            return;
          }
          scene.tweens.add({
            targets: { r: 150 },
            r: 0,
            duration: 700,
            ease: 'Cubic.easeIn',
            onUpdate: (tween) => { 
              radius = tween.getValue(); 
              if (portalSprite && portalSprite.active) {
                portalSprite.setScale(radius / 250);
              }
            },
            onComplete: () => {
              cleanupPortal();
              if (!scene.sys.isActive()) return;

              const shock = scene.add.graphics();
              shock.setPosition(x, y);
              shock.setDepth(DEPTH.ENEMY + 1);
              let sRadius = 0;
              let sAlpha = 1;

              scene.tweens.add({
                targets: { r: 0, a: 1 },
                r: 400,
                a: 0,
                duration: 800,
                ease: 'Cubic.easeOut',
                onUpdate: (tw) => {
                  sRadius = tw.targets[0].r;
                  sAlpha = tw.targets[0].a;
                  shock.clear();
                  shock.lineStyle(8, 0xff00ff, sAlpha);
                  shock.beginPath();
                  shock.arc(0, 0, sRadius, 0, Math.PI * 2);
                  shock.strokePath();
                },
                onComplete: () => {
                  if (shock.active) shock.destroy();
                }
              });
            }
          });
        });
      }
    });
  }

  triggerMidFightDialogue(chain) {
    if (this.scene.isCombatFrozen) return;
    this.scene.isCombatFrozen = true;

    // Zero out velocities
    if (this.boss && this.boss.body) {
      this.boss.setVelocity(0, 0);
    }
    if (this.scene.player && this.scene.player.body) {
      this.scene.player.setVelocity(0, 0);
    }

    if (this.scene.dialogueManager) {
      this.scene.dialogueManager.showCinematicBorders();
    }

    this.playDialogueChain(chain, () => {
      this.scene.isCombatFrozen = false;
      if (this.scene.dialogueManager) {
        this.scene.dialogueManager.hideCinematicBorders();
      }
    });
  }

  playDialogueChain(chain, onComplete) {
    const dm = this.scene.dialogueManager;
    if (!dm) {
      if (onComplete) onComplete();
      return;
    }

    let currentIndex = 0;

    const playNext = () => {
      if (currentIndex >= chain.length) {
        if (onComplete) onComplete();
        return;
      }

      const line = chain[currentIndex];
      currentIndex++;

      const fileKey = 'rebirth_' + line.key;
      const theme = line.speaker === 'HERO' ? 'hero' : 'boss';
      const target = line.speaker === 'HERO' ? this.scene.player : this.boss;

      dm.playPhaserVoiceComment(fileKey, line.speaker, '', {
        colorTheme: theme,
        target: target,
        onComplete: playNext
      });
    };

    playNext();
  }

  startEscapeSequence() {
    this.isEscaping = true;
    this.boss.body.enable = false;
    this.boss.setVelocity(0, 0);
    this.boss.setAlpha(1.0); // FIX: Reset alpha before escaping
    this.scene.isCombatFrozen = true;
    if (this.scene.player && this.scene.player.body) {
      this.scene.player.setVelocity(0, 0);
    }

    // Clear bullets
    this.bullets.clear(true, true);
    if (this.shieldGraphics) this.shieldGraphics.clear();
    if (this.chargeWarningLine) this.chargeWarningLine.destroy();
    if (this.sweepBeam) {
      if (this.sweepBeam.graphics) this.sweepBeam.graphics.destroy();
      this.sweepBeam = null;
    }

    const scene = this.scene;
    const cam = scene.cameras.main;
    const dm = scene.dialogueManager;

    if (this.darkOverlay) { this.darkOverlay.destroy(); this.darkOverlay = null; }
    this.darkOverlay = scene.add.rectangle(
      cam.scrollX + cam.width / 2, cam.scrollY + cam.height / 2,
      cam.width * 2, cam.height * 2, 0x000000, 0
    );
    this.darkOverlay.setScrollFactor(0);
    this.darkOverlay.setDepth(DEPTH.UI_OVERLAY + 15);
    
    scene.tweens.add({
      targets: this.darkOverlay,
      alpha: 0.6,
      duration: 1000
    });
    
    cam.shake(2000, 0.005);

    if (!dm) {
      this.completeEscapeSequence();
      return;
    }

    // Phase 3: Boss Escape dialogue chain - Files 19, 20, 21, 22
    const escapeChain = [
      { key: 'hero19', speaker: 'HERO' },
      { key: 'boss20', speaker: 'BOSS' },
      { key: 'hero21', speaker: 'HERO' }
    ];

    this.playDialogueChain(escapeChain, () => {
      this.createRebirthPortal(this.boss.x, this.boss.y, () => {
        // Line 22: final line as boss shrinks and rotates away
        dm.playPhaserVoiceComment('rebirth_boss22', 'BOSS', '', {
          colorTheme: 'boss',
          target: this.boss,
          onComplete: () => {
            this.completeEscapeSequence();
          }
        });

        scene.tweens.add({
          targets: this.boss,
          scale: 0,
          angle: 360,
          alpha: 0,
          duration: 2000,
          ease: 'Sine.easeInOut'
        });
      });
    });
  }

  completeEscapeSequence() {
    const scene = this.scene;
    
    if (this.boss && this.boss.active) {
      this.boss.destroy();
      this.boss = null;
    }

    this.cleanAuxiliaryGraphics();
    this.cleanBullets();
    if (this.healthBarBg) { this.healthBarBg.destroy(); this.healthBarBg = null; }
    if (this.healthBarFill) { this.healthBarFill.destroy(); this.healthBarFill = null; }

    scene.time.delayedCall(2000, () => {
      this.fadeOutDarkOverlay();

      scene.effectsManager.showFloatingText(scene.ARENA_SIZE/2, scene.ARENA_SIZE/2, "BOSS ESCAPED", "#ff00ff", "32px");
      
      scene.time.delayedCall(3000, () => {
         scene.isCombatFrozen = false;
         scene.isBossIntroActive = false;
         this.isEscaping = false;

         scene.cameras.main.zoomTo(1.0, 1000, 'Cubic.easeOut');
         scene.physics.pause();
         
         synthAudio.stopBGM();
         synthAudio.playPowerup();
         
         const victoryEvent = new CustomEvent('game-victory-event', {
           detail: {
             score: scene.score,
             wave: scene.wave,
             enemiesDestroyed: scene.enemiesDestroyed
           }
         });
         window.dispatchEvent(victoryEvent);
      });
    });
  }

  destroyBoss() {
    const { scene } = this;
    if (scene.dialogueManager) {
      scene.dialogueManager.stop();
    }
    const bx = this.boss.x;
    const by = this.boss.y;

    // Immediately disable boss mechanics to avoid lingering hits or behavior
    this.boss.body.enable = false;
    this.boss.setVelocity(0, 0);

    // Clean up outlines and auxiliary graphics immediately to fix lingering outline bug
    this.cleanAuxiliaryGraphics();

    // Trigger chain explosions
    for (let i = 0; i < 6; i++) {
      scene.time.delayedCall(i * 120, () => {
        const rx = bx + Phaser.Math.Between(-45, 45);
        const ry = by + Phaser.Math.Between(-45, 45);
        scene.effectsManager.enemyDeath(rx, ry, 0x9d00ff);
        synthAudio.playExplosion();
      });
    }

    scene.time.delayedCall(800, () => {
      if (!this.boss) return; // Safety check in case of game restart
      
      // Main death flash
      scene.cameras.main.flash(200, 255, 255, 255, 0.5);
      
      // Spawn multiple green container gems
      for (let j = 0; j < 3; j++) {
        const rx = bx + Phaser.Math.Between(-30, 30);
        const ry = by + Phaser.Math.Between(-30, 30);
        scene.collectibleManager.tryDropFromEnemy(rx, ry, scene.wave);
      }

      this.boss.destroy();
      this.boss = null;

      if (this.healthBarBg) this.healthBarBg.destroy();
      if (this.healthBarFill) this.healthBarFill.destroy();

      scene.effectsManager.showFloatingText(bx, by, 'BOSS DEFEATED', '#39ff14', '16px');

      scene.isCombatFrozen = false;
      scene.isBossIntroActive = false;
      this.isDying = false;
      if (this.bossBulletOverlap) {
        this.bossBulletOverlap.destroy();
        this.bossBulletOverlap = null;
      }
      if (this.playerBossOverlap) {
        this.playerBossOverlap.destroy();
        this.playerBossOverlap = null;
      }
      
      // Reset camera zoom back to normal
      scene.cameras.main.zoomTo(1.0, 1000, 'Cubic.easeOut');
      
      // PAUSE game physics for victory screen
      scene.physics.pause();
      
      // Play victory chime fanfare
      synthAudio.stopBGM();
      synthAudio.playPowerup();
      
      // Trigger React victory overlay
      const victoryEvent = new CustomEvent('game-victory-event', {
        detail: {
          score: scene.score,
          wave: scene.wave,
          enemiesDestroyed: scene.enemiesDestroyed
        }
      });
      window.dispatchEvent(victoryEvent);
    });
  }

  updateHealthBarPosition() {
    if (this.healthBarBg && this.healthBarFill && this.boss && this.boss.active) {
      this.healthBarBg.x = this.boss.x;
      this.healthBarBg.y = this.boss.y - 140;
      this.healthBarFill.x = this.boss.x - 60; // Offset origin 0 width half
      this.healthBarFill.y = this.boss.y - 140;
      this.healthBarFill.scaleX = Math.max(0, this.hp / this.maxHp);
    }
  }

  fireSniperLaser(player) {
    const { scene } = this;
    if (!this.boss || !this.boss.active) return;
    
    synthAudio.playDamage(); // warn sound

    // Create targeting telemetry warning line
    const warningLine = scene.add.graphics().setDepth(DEPTH.UI_OVERLAY);
    let warningTimer = 0;
    
    const followEvent = scene.time.addEvent({
      delay: 16,
      callback: () => {
        if (!this.boss || !this.boss.active || !player || !player.active || warningTimer > 500) {
          followEvent.destroy();
          warningLine.destroy();
          return;
        }
        warningTimer += 16;
        warningLine.clear();
        warningLine.lineStyle(1.5, 0xff0055, 0.4 + Math.sin(warningTimer * 0.05) * 0.35);
        warningLine.beginPath();
        warningLine.moveTo(this.boss.x, this.boss.y);
        warningLine.lineTo(player.x, player.y);
        warningLine.strokePath();
      },
      loop: true
    });

    scene.time.delayedCall(500, () => {
      if (!this.boss || !this.boss.active || !player || !player.active) return;
      
      const angle = Phaser.Math.Angle.Between(this.boss.x, this.boss.y, player.x, player.y);
      synthAudio.playLaser();
      
      const b = this.bullets.create(this.boss.x, this.boss.y, 'bossBulletTexture');
      b.setDepth(DEPTH.BULLET);
      b.setRotation(angle);
      b.setBlendMode(Phaser.BlendModes.ADD);
      b.setScale(2.2); // Massive piercing blast
      b.setTint(0xff0033);
      b.setVelocity(Math.cos(angle) * 880, Math.sin(angle) * 880);
      b.setData('damage', 30);

      const trail = scene.add.particles(0, 0, 'bossBulletTexture', {
        speed: 0,
        scale: { start: 2.2, end: 0.1 },
        alpha: { start: 0.8, end: 0 },
        lifespan: 180,
        frequency: 10,
        blendMode: 'ADD',
        follow: b
      });
      trail.setDepth(DEPTH.BULLET - 1);
      b.setData('trail', trail);
    });
  }

  cleanBullets() {
    if (this.bullets && this.bullets.active && this.bullets.children) {
      this.bullets.getChildren().forEach(b => {
        const trail = b.getData('trail');
        if (trail) trail.destroy();
      });
      this.bullets.clear(true, true);
    }
  }

  cleanAuxiliaryGraphics() {
    if (this.bossOutline) {
      this.bossOutline.destroy();
      this.bossOutline = null;
    }
    if (this.targetingGraphics) {
      this.targetingGraphics.destroy();
      this.targetingGraphics = null;
    }
    if (this.shieldGraphics) {
      this.shieldGraphics.destroy();
      this.shieldGraphics = null;
    }
    if (this.chargeWarningLine) {
      this.chargeWarningLine.destroy();
      this.chargeWarningLine = null;
    }
    if (this.introBanner) {
      this.introBanner.destroy();
      this.introBanner = null;
    }
    if (this.introText) {
      this.introText.destroy();
      this.introText = null;
    }
    if (this.introSubtext) {
      this.introSubtext.destroy();
      this.introSubtext = null;
    }
    if (this.topLetterbox) {
      this.topLetterbox.destroy();
      this.topLetterbox = null;
    }
    if (this.bottomLetterbox) {
      this.bottomLetterbox.destroy();
      this.bottomLetterbox = null;
    }
    if (this.helperDrones && this.helperDrones.length > 0) {
      this.helperDrones.forEach(d => {
        if (d && d.active) {
          this.scene.enemyManager.destroyEnemy(d);
        }
      });
      this.helperDrones = [];
    }
    if (this.mirages && this.mirages.length > 0) {
      this.mirages.forEach(m => {
        if (m && m.active) m.destroy();
      });
      this.mirages = [];
    }
    if (this.rifts && this.rifts.length > 0) {
      this.rifts.forEach(r => {
        if (r && r.graphics) r.graphics.destroy();
      });
      this.rifts = [];
    }
    if (this.sweepBeam) {
      if (this.sweepBeam.graphics) this.sweepBeam.graphics.destroy();
      this.sweepBeam = null;
    }
    if (this.darkOverlay) {
      this.darkOverlay.destroy();
      this.darkOverlay = null;
    }
  }

  firePerfectCounter() {
    const { scene } = this;
    if (!this.boss || !this.boss.active) return;
    
    scene.effectsManager.showFloatingText(this.boss.x, this.boss.y - 110, 'COUNTER-ATTACK!', '#ffea00', '13px');
    synthAudio.playLaser();
    
    // Shoot 3 high-velocity plasma bullets directly at the player
    const angle = Phaser.Math.Angle.Between(this.boss.x, this.boss.y, scene.player.x, scene.player.y);
    const spreads = [-0.1, 0, 0.1];
    
    spreads.forEach(spread => {
      const bulletAngle = angle + spread;
      const b = this.bullets.create(
        this.boss.x + Math.cos(bulletAngle) * 45,
        this.boss.y + Math.sin(bulletAngle) * 45,
        'bossBulletTexture'
      );
      b.setDepth(DEPTH.BULLET);
      b.setRotation(bulletAngle);
      b.setBlendMode(Phaser.BlendModes.ADD);
      b.setScale(1.25);
      b.setTint(0xffea00); // Yellow gold counters
      b.setVelocity(Math.cos(bulletAngle) * 620, Math.sin(bulletAngle) * 620);
      b.setData('damage', 14);

      const trail = scene.add.particles(0, 0, 'bossBulletTexture', {
        speed: 0,
        scale: { start: 1.1, end: 0.1 },
        alpha: { start: 0.65, end: 0 },
        lifespan: 160,
        frequency: 20,
        blendMode: 'ADD',
        follow: b
      });
      trail.setDepth(DEPTH.BULLET - 1);
      b.setData('trail', trail);
    });
  }

  fireGravityWell() {
    const { scene } = this;
    if (!this.boss || !this.boss.active) return;

    scene.effectsManager.showFloatingText(this.boss.x, this.boss.y - 95, 'SINGULARITY RIFT', '#bf00ff', '12px');
    synthAudio.playBoostActivate('TITAN');

    // Spawn near the player
    const rx = scene.player.x + Phaser.Math.Between(-150, 150);
    const ry = scene.player.y + Phaser.Math.Between(-150, 150);

    const graphics = scene.add.graphics().setDepth(DEPTH.ENEMY - 1);
    
    const rift = {
      x: rx,
      y: ry,
      timer: 3500, // lasts 3.5 seconds
      graphics: graphics,
      pulsePhase: 0,
      nextBulletTime: 0
    };

    // Spawn simple shockwave ring at creation
    const ring = scene.add.circle(rx, ry, 10, 0x9d00ff, 0.3).setDepth(DEPTH.ENEMY - 2);
    ring.setStrokeStyle(3, 0xff00ff, 1);
    scene.tweens.add({
      targets: ring,
      radius: 120,
      alpha: 0,
      duration: 500,
      onComplete: () => ring.destroy()
    });

    this.rifts.push(rift);
  }

  fireSweepBeam() {
    const { scene } = this;
    if (!this.boss || !this.boss.active || this.sweepBeam) return;

    scene.effectsManager.showFloatingText(this.boss.x, this.boss.y - 95, 'CHARGING OBLITERATION BEAM', '#ff0033', '12px');
    synthAudio.playDamage(); // Warning sound

    // Add high-quality pre-attack charge effect
    const preAttack = this.scene.add.sprite(this.boss.x, this.boss.y, 'preAttackAnim');
    preAttack.play('pre_attack_charge');
    preAttack.setDepth(DEPTH.EFFECTS || 10);
    preAttack.setScale(0);
    preAttack.setBlendMode(Phaser.BlendModes.ADD);
    preAttack.setTint(0xff0033);
    this.scene.tweens.add({
      targets: preAttack,
      scale: 2.0,
      alpha: { start: 1, end: 0 },
      angle: 360,
      duration: 1000,
      ease: 'Cubic.easeOut',
      onUpdate: () => {
        if (this.boss && this.boss.active) {
          preAttack.setPosition(this.boss.x, this.boss.y);
        }
      },
      onComplete: () => {
        if (preAttack && preAttack.active) preAttack.destroy();
      }
    });

    const warningLine = scene.add.graphics().setDepth(DEPTH.UI_OVERLAY);
    const startAngle = Phaser.Math.Angle.Between(this.boss.x, this.boss.y, scene.player.x, scene.player.y);

    this.sweepBeam = {
      beamAngle: startAngle,
      timer: 1000, // 1s charging warned tracking
      graphics: warningLine,
      state: 'charging'
    };
  }

  spawnMirages() {
    const { scene } = this;
    if (!this.boss || !this.boss.active) return;

    scene.effectsManager.showFloatingText(this.boss.x, this.boss.y - 95, 'MIRAGE PROTOCOL ACTIVATED', '#ff00ff', '12px');
    scene.cameras.main.flash(200, 255, 0, 255, 0.3);
    synthAudio.playBoostActivate('VOID_STORM');

    // Remove existing mirages and their overlap colliders
    this.mirageColliders.forEach((c) => { if (c) c.destroy(); });
    this.mirageColliders = [];
    this.mirages.forEach(m => {
      if (m && m.active) m.destroy();
    });
    this.mirages = [];

    // Spawn 2 mirages on the flanks
    for (let i = 0; i < 2; i++) {
      const angle = this.boss.rotation + Math.PI / 2 + (i === 0 ? Math.PI / 4 : -Math.PI / 4);
      const spawnX = this.boss.x + Math.cos(angle) * 160;
      const spawnY = this.boss.y + Math.sin(angle) * 160;

      const mirage = scene.physics.add.sprite(spawnX, spawnY, 'bossTexture');
      mirage.setDepth(DEPTH.ENEMY - 1);
      mirage.setScale(this.boss.scaleX * 0.9);
      mirage.setTint(0xff00ff);
      mirage.setAlpha(0.65);
      mirage.setData('offsetIndex', i);
      mirage.setData('nextFire', scene.time.now + 1000);

      const mirageCollider = scene.physics.add.overlap(
        mirage,
        scene.bullets,
        (m, pBullet) => {
          if (scene.isCombatFrozen) return;
          if (!pBullet.active) return;

          scene.effectsManager.enemyDeath(m.x, m.y, 0xff00ff);
          synthAudio.playExplosion();

          const pTrail = pBullet.getData('trail');
          if (pTrail) pTrail.destroy();
          pBullet.destroy();

          scene.effectsManager.showFloatingText(m.x, m.y, 'MIRAGE SHATTERED', '#ff00ff', '10px');

          const col = m.getData('bulletOverlap');
          if (col) col.destroy();
          const idx = this.mirageColliders.indexOf(col);
          if (idx >= 0) this.mirageColliders.splice(idx, 1);
          m.destroy();
        },
        null,
        this
      );
      mirage.setData('bulletOverlap', mirageCollider);
      this.mirageColliders.push(mirageCollider);

      this.mirages.push(mirage);
    }
  }

  updateUniqueAttacks(time, delta) {
    const { scene } = this;
    const player = scene.player;
    if (!player || !player.active || scene.isCombatFrozen) return;

    // 1. UPDATE RIFTS
    this.rifts = this.rifts.filter(rift => {
      rift.timer -= delta;
      if (rift.timer <= 0) {
        rift.graphics.destroy();
        return false;
      }

      rift.pulsePhase += delta * 0.005;
      const graphics = rift.graphics;
      graphics.clear();

      // Draw gravity indicator ring
      const ringAlpha = 0.2 + Math.sin(rift.pulsePhase) * 0.1;
      graphics.lineStyle(2, 0xbf00ff, ringAlpha);
      graphics.strokeCircle(rift.x, rift.y, 140);

      // Draw event horizon (vortex core)
      const coreRadius = 20 + Math.sin(rift.pulsePhase * 2) * 4;
      graphics.fillStyle(0x0a001a, 0.85);
      graphics.fillCircle(rift.x, rift.y, coreRadius);
      graphics.lineStyle(3, 0x00ffff, 0.8);
      graphics.strokeCircle(rift.x, rift.y, coreRadius);

      // Apply pull to player
      const dist = Phaser.Math.Distance.Between(rift.x, rift.y, player.x, player.y);
      if (dist < 180 && dist > 15) {
        const pullFactor = (1 - dist / 180) * 160 * (delta / 1000);
        const pullAngle = Phaser.Math.Angle.Between(player.x, player.y, rift.x, rift.y);
        player.body.velocity.x += Math.cos(pullAngle) * pullFactor * 40;
        player.body.velocity.y += Math.sin(pullAngle) * pullFactor * 40;
      }

      // Spit slow bullets outwards in a spiral
      if (time > rift.nextBulletTime) {
        rift.nextBulletTime = time + 650;
        synthAudio.playLaser();
        
        const bulletAngle = rift.pulsePhase;
        const speeds = [120, 160];
        
        speeds.forEach(spd => {
          const b = this.bullets.create(rift.x, rift.y, 'bossBulletTexture');
          b.setDepth(DEPTH.BULLET);
          b.setRotation(bulletAngle);
          b.setBlendMode(Phaser.BlendModes.ADD);
          b.setScale(0.8);
          b.setVelocity(Math.cos(bulletAngle) * spd, Math.sin(bulletAngle) * spd);
          b.setData('damage', 8);

          const trail = scene.add.particles(0, 0, 'bossBulletTexture', {
            speed: 0,
            scale: { start: 0.6, end: 0.1 },
            alpha: { start: 0.35, end: 0 },
            lifespan: 140,
            frequency: 30,
            blendMode: 'ADD',
            follow: b
          });
          trail.setDepth(DEPTH.BULLET - 1);
          b.setData('trail', trail);
        });
      }

      return true;
    });

    // 2. UPDATE SWEEP BEAM
    if (this.sweepBeam) {
      const beam = this.sweepBeam;
      beam.timer -= delta;
      
      if (beam.timer <= 0) {
        if (beam.state === 'charging') {
          // Transition to Firing!
          beam.state = 'firing';
          beam.timer = 1800; // fires for 1.8 seconds
          synthAudio.playBoostActivate('VOID_STORM');
          scene.cameras.main.shake(1200, 0.015);
        } else {
          // Finished!
          beam.graphics.destroy();
          this.sweepBeam = null;
        }
      }

      if (this.sweepBeam) {
        const graphics = beam.graphics;
        graphics.clear();

        if (beam.state === 'charging') {
          // Follow player slowly
          const currentAngle = Phaser.Math.Angle.Between(this.boss.x, this.boss.y, player.x, player.y);
          beam.beamAngle = Phaser.Math.Angle.RotateTo(beam.beamAngle, currentAngle, 0.04);

          // Draw thin red tracking line
          graphics.lineStyle(2, 0xff0000, 0.5 + Math.sin(time * 0.05) * 0.4);
          graphics.beginPath();
          graphics.moveTo(this.boss.x, this.boss.y);
          graphics.lineTo(this.boss.x + Math.cos(beam.beamAngle) * 1200, this.boss.y + Math.sin(beam.beamAngle) * 1200);
          graphics.strokePath();

          // Spark at charging source
          graphics.fillStyle(0xff0055, 0.8);
          graphics.fillCircle(this.boss.x, this.boss.y, 25 + Math.sin(time * 0.04) * 8);
        } else if (beam.state === 'firing') {
          // Sweep in an arc
          const targetAngle = Phaser.Math.Angle.Between(this.boss.x, this.boss.y, player.x, player.y);
          beam.beamAngle = Phaser.Math.Angle.RotateTo(beam.beamAngle, targetAngle, 0.015);

          const endX = this.boss.x + Math.cos(beam.beamAngle) * 1200;
          const endY = this.boss.y + Math.sin(beam.beamAngle) * 1200;

          // Draw giant sweeping beam (nested colored layers for premium look)
          graphics.lineStyle(40, 0xff0055, 0.35); // outer pink layer
          graphics.beginPath();
          graphics.moveTo(this.boss.x, this.boss.y);
          graphics.lineTo(endX, endY);
          graphics.strokePath();

          graphics.lineStyle(22, 0xff00ff, 0.65); // middle purple layer
          graphics.beginPath();
          graphics.moveTo(this.boss.x, this.boss.y);
          graphics.lineTo(endX, endY);
          graphics.strokePath();

          graphics.lineStyle(8, 0xffffff, 0.95); // white hot core
          graphics.beginPath();
          graphics.moveTo(this.boss.x, this.boss.y);
          graphics.lineTo(endX, endY);
          graphics.strokePath();

          // Sparks
          if (Math.random() < 0.4) {
            const hitSpark = scene.add.circle(endX, endY, 5, 0xff00ff, 0.7);
            scene.tweens.add({
              targets: hitSpark,
              radius: 40,
              alpha: 0,
              duration: 250,
              onComplete: () => hitSpark.destroy()
            });
          }

          // Damage check using Line-to-Circle intersection!
          const playerCircle = new Phaser.Geom.Circle(player.x, player.y, 16);
          const beamLine = new Phaser.Geom.Line(this.boss.x, this.boss.y, endX, endY);
          
          if (Phaser.Geom.Intersects.LineToCircle(beamLine, playerCircle)) {
            // Apply continuous damage
            if (scene.postDamageInvulnTimeRemaining <= 0 && !scene.isInvulnerable && !scene.isShielded) {
              scene.health = Math.max(0, scene.health - 22 * (delta / 1000)); // ~22 damage per second
              scene.lastDamageTime = scene.time.now;
              scene.effectsManager.playerDamage();
              synthAudio.playDamage();
              scene.dispatchMetricsToReact();
              
              if (scene.health <= 0) {
                scene.handleGameOver();
              }
            }
          }
        }
      }
    }

    // 3. UPDATE MIRAGES
    this.mirages = this.mirages.filter(mirage => {
      if (!mirage.active) return false;

      // Update mirage movement to mirror boss offset
      const offsetIndex = mirage.getData('offsetIndex');
      const offsetAngle = this.boss.rotation + Math.PI / 2 + (offsetIndex === 0 ? Math.PI / 4 : -Math.PI / 4);
      const targetX = this.boss.x + Math.cos(offsetAngle) * 160;
      const targetY = this.boss.y + Math.sin(offsetAngle) * 160;

      // Smooth follow target coordinates
      mirage.x = Phaser.Math.Linear(mirage.x, targetX, 0.08);
      mirage.y = Phaser.Math.Linear(mirage.y, targetY, 0.08);
      mirage.setRotation(this.boss.rotation);

      // Firing sync
      const nextFire = mirage.getData('nextFire') || 0;
      if (time > nextFire) {
        mirage.setData('nextFire', time + 1400 + Math.random() * 800);
        synthAudio.playLaser();

        const angle = Phaser.Math.Angle.Between(mirage.x, mirage.y, player.x, player.y);
        const b = this.bullets.create(mirage.x, mirage.y, 'bossBulletTexture');
        b.setDepth(DEPTH.BULLET);
        b.setRotation(angle);
        b.setBlendMode(Phaser.BlendModes.ADD);
        b.setScale(0.85);
        b.setTint(0xff00ff);
        b.setVelocity(Math.cos(angle) * 280, Math.sin(angle) * 280);
        b.setData('damage', 6);

        const trail = scene.add.particles(0, 0, 'bossBulletTexture', {
          speed: 0,
          scale: { start: 0.6, end: 0.1 },
          alpha: { start: 0.4, end: 0 },
          lifespan: 140,
          frequency: 30,
          blendMode: 'ADD',
          follow: b
        });
        trail.setDepth(DEPTH.BULLET - 1);
        b.setData('trail', trail);
      }

      return true;
    });
  }

  destroy() {
    this.teardownActiveBoss();
    if (this.bullets) {
      try {
        if (this.bullets.children) {
          this.bullets.clear(true, true);
        }
        this.bullets.destroy();
      } catch (e) {
        // Safe catch for Phaser shutdown sequence destruction race condition
      }
      this.bullets = null;
    }
    if (this.healthBarBg) { this.healthBarBg.destroy(); this.healthBarBg = null; }
    if (this.healthBarFill) { this.healthBarFill.destroy(); this.healthBarFill = null; }
  }
}
