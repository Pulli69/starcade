import Phaser from 'phaser';
import synthAudio from '../utils/synthAudio';
import SpaceBackground from '../systems/SpaceBackground';
import BlackHoleManager from '../systems/BlackHoleManager';
import EnemyManager from '../systems/EnemyManager';
import CollectibleManager from '../systems/CollectibleManager';
import EffectsManager from '../systems/EffectsManager';
import BoostManager, { DEPTH } from '../systems/BoostManager';
import BossManager from '../systems/BossManager';
import DialogueManager from '../systems/DialogueManager';

/**
 * ArcadeSurvival - Main Game Scene
 *
 * Coordinates all modular systems:
 * - SpaceBackground: Animated space environment
 * - BlackHoleManager: Gravity physics + projectile bending
 * - EnemyManager: Wasp + Hunter enemy AI
 * - CollectibleManager: Powerup spawn + magnetic pickup
 * - EffectsManager: Particles, shake, floating text
 * - BoostManager: Titan, Multi-Shot, Phase Dash, Void Storm
 *
 * Core gameplay loop:
 *   Move → Shoot → Kill enemies → Collect boosts → Survive waves
 *
 * Difficulty scales every 30 seconds with increasing chaos.
 * Rendering depth is managed via DEPTH constants.
 */

/** Last fully playable sector; Wave 10 boss / upgrades are gated behind coming-soon screen. */
export const MAX_PLAYABLE_WAVE = 9;

export default class ArcadeSurvival extends Phaser.Scene {
  constructor() {
    super('ArcadeSurvival');

    this.score = 0;
    this.health = 100;
    this.maxHealth = 100;
    this.wave = 1;
    this.enemiesDestroyed = 0;

    this.isShielded = false;
    this.shieldTime = 0;
    this.isRapidFire = false;
    this.rapidFireTime = 0;

    this.nextFireTime = 0;
    this.enemySpawnTimer = null;
    this.baseSpawnRate = 2000;

    this.ARENA_SIZE = 2500;

    // Difficulty scaling
    this.gameTime = 0;
    this.difficultyLevel = 1;
  }

  init(data) {
    this.score = 0;
    this.health = 100;
    this.maxHealth = 100;
    this.wave = data?.wave || 1;
    this.enemiesDestroyed = 0;
    this.isShielded = false;
    this.isRapidFire = false;
    this.shieldTime = 0;
    this.rapidFireTime = 0;
    this.nextFireTime = 0;
    this.isCombatFrozen = false;
    this.gameTime = 0;
    this.difficultyLevel = 1;

    // Boss & Combo States
    this.isBossWave = false;
    this.isBossIntroActive = false;
    this.comboCount = 0;
    this.comboTimer = null;
    this.comboDecayTime = 3500;
    this.isOverdrive = false;
    this.hitStopTimeRemaining = 0;
    this.isGameOver = false;
    this.bossLevelGateShown = false;
    this.lastDamageTime = 0;
    this.lotusRotation = 0;
    this.gravitySingularities = [];
  }

  preload() {
    this.createGlowingTextures();
    this.load.image('playerShipRaw', 'assets/player_ship.png');
    this.load.image('enemyDroneRaw', 'assets/enemy_drone.png');
    this.load.image('enemyHunterRaw', 'assets/enemy_hunter.png');
    this.load.image('enemyBomberRaw', 'assets/enemy_bomber.png');
    this.load.image('enemyShieldRaw', 'assets/enemy_shield.png');
    this.load.image('enemyBossRaw', 'assets/enemy_boss.png');
    this.load.image('enemyRebornBossRaw', 'assets/reborn_boss.png');
    this.load.image('gemRaw', 'assets/gem.png');
    this.load.image('portalEffect', 'assets/portal_effect.png');
    this.load.spritesheet('portalAnim', 'assets/portal_spritesheet.png', { frameWidth: 128, frameHeight: 128 });
    this.load.spritesheet('preAttackAnim', 'assets/pre_attack_spritesheet.png', { frameWidth: 128, frameHeight: 128 });

    // Gracefully handle audio loading failures so they don't crash the scene
    this.load.on('loaderror', (file) => {
      console.warn('[PRELOAD] Failed to load:', file.key, file.src);
    });
  }

  create() {
    this.physics.world.setBounds(0, 0, this.ARENA_SIZE, this.ARENA_SIZE);

    // ---- SYSTEMS ----
    this.spaceBackground = new SpaceBackground(this);
    this.blackHoleManager = new BlackHoleManager(this);
    this.enemyManager = new EnemyManager(this);
    this.collectibleManager = new CollectibleManager(this);
    this.effectsManager = new EffectsManager(this);
    this.boostManager = new BoostManager(this);
    this.dialogueManager = new DialogueManager(this);

    this.spaceBackground.create();
    this.blackHoleManager.create();
    this.effectsManager.create();
    this.boostManager.create();

    // ---- PROCESS SPRITE TRANSPARENCIES ----
    this.processChromaKey('playerShipRaw', 'playerShipTexture', { maxWidth: 72 });
    this.processChromaKey('enemyDroneRaw', 'droneTexture', { maxWidth: 48 });
    this.processChromaKey('enemyHunterRaw', 'hunterTexture', { maxWidth: 72 });
    this.processChromaKey('enemyBomberRaw', 'bomberTexture', { maxWidth: 72 });
    this.processChromaKey('enemyShieldRaw', 'shieldTexture', { maxWidth: 60 });
    this.processChromaKey('enemyBossRaw', 'bossTexture', { maxWidth: 160 });
    this.processChromaKey('enemyRebornBossRaw', 'rebornBossTexture', { maxWidth: 160 });
    this.processChromaKey('gemRaw', 'gemTexture', { maxWidth: 48 });
    this.createSniperTexture();

    // ---- ANIMATIONS ----
    if (!this.anims.exists('portal_swirl')) {
      this.anims.create({
        key: 'portal_swirl',
        frames: this.anims.generateFrameNumbers('portalAnim', { start: 0, end: 3 }),
        frameRate: 15,
        repeat: -1
      });
    }
    if (!this.anims.exists('pre_attack_charge')) {
      this.anims.create({
        key: 'pre_attack_charge',
        frames: this.anims.generateFrameNumbers('preAttackAnim', { start: 0, end: 5 }),
        frameRate: 15,
        repeat: -1
      });
    }

    // ---- ARENA BOUNDARY ----
    this.boundaryLine = this.add.graphics();
    this.boundaryLine.lineStyle(6, 0x9d00ff, 0.95);
    this.boundaryLine.strokeRect(0, 0, this.ARENA_SIZE, this.ARENA_SIZE);

    // ---- GROUPS ----
    this.bullets = this.physics.add.group();
    this.enemies = this.physics.add.group();
    this.powerups = this.physics.add.group();
    this.unbrokenGems = this.physics.add.group();
    this.bomberRockets = this.physics.add.group();
    this.enemiesBullets = this.physics.add.group();
    this.debrisGroup = this.physics.add.group();
    this.interactiveAsteroids = this.physics.add.group();

    // ---- PLAYER SHIP ----
    this.player = this.physics.add.sprite(
      this.ARENA_SIZE / 2,
      this.ARENA_SIZE / 2,
      'playerShipTexture'
    );
    this.player.setDepth(DEPTH.PLAYER);
    this.player.setCollideWorldBounds(true);
    this.player.setDamping(true);
    this.player.setDrag(0.10);
    this.player.setMaxVelocity(300);

    // Apply selected ship color theme
    const chosenColor = localStorage.getItem('ship_color') || 'pink';
    const colorMap = {
      pink: 0xff007f,
      cyan: 0x00f0ff,
      yellow: 0xffea00,
      green: 0x39ff14,
      purple: 0x9d00ff
    };
    this.shipTint = colorMap[chosenColor] || 0xff007f;
    this.player.setTint(this.shipTint);

    // Add a bright glowing aura to make the ship stand out against the dark background
    // Using a Graphics object ensures it works across all devices, even without WebGL FX support
    this.playerAuraGlow = this.add.graphics();
    this.playerAuraGlow.setDepth(DEPTH.PLAYER - 1);
    this.playerAuraGlow.setBlendMode(Phaser.BlendModes.ADD);

    // Engine exhaust trail
    this.engineTrail = this.add.particles(0, 0, 'engineTrailTexture', {
      speed: { min: 10, max: 30 },
      angle: { min: 160, max: 200 },
      scale: { start: 0.6, end: 0 },
      alpha: { start: 0.6, end: 0 },
      lifespan: { min: 200, max: 400 },
      frequency: 40,
      quantity: 1,
      blendMode: 'ADD',
      follow: this.player,
      particleTint: this.shipTint
    });
    this.engineTrail.setDepth(DEPTH.PLAYER_TRAIL);

    // Shield visual ring
    this.playerShieldRing = this.add.graphics().setDepth(DEPTH.PLAYER_SHIELD);

    // Dynamic player locator reticle to maintain visual focus in combat
    this.playerLocatorReticle = this.add.graphics();
    this.playerLocatorReticle.setDepth(DEPTH.PLAYER - 1);

    // ---- INPUT ----
    this.keys = this.input.keyboard.addKeys('W,A,S,D,SPACE,K,L');
    this.input.mouse.disableContextMenu();
    this.input.on('pointerdown', () => {
      // Focus is automatically managed by the browser when the canvas is clicked
    });

    // ---- TOUCH / VIRTUAL JOYSTICK ----
    // Only activate on touch-capable devices; desktop is completely unaffected.
    this.isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    // Virtual joystick state — left half = movement, right half = aim + fire
    this.vjLeft  = { active: false, id: null, startX: 0, startY: 0, dx: 0, dy: 0 };
    this.vjRight = { active: false, id: null, startX: 0, startY: 0, dx: 0, dy: 0, firing: false };
    // Graphics layer drawn in camera-fixed (UI) space so it never scrolls
    this.vjGraphics = this.add.graphics().setDepth(99999).setScrollFactor(0);

    if (this.isTouchDevice) {
      // Capture raw browser touch events on the canvas element itself.
      const canvas = this.sys.game.canvas;

      const onTouchStart = (e) => {
        e.preventDefault();
        const W = this.scale.width;
        Array.from(e.changedTouches).forEach(t => {
          const cx = t.clientX * (W / canvas.getBoundingClientRect().width);
          const cy = t.clientY * (this.scale.height / canvas.getBoundingClientRect().height);
          if (cx < W / 2) {
            // Left side — movement joystick
            if (!this.vjLeft.active) {
              this.vjLeft = { active: true, id: t.identifier, startX: cx, startY: cy, dx: 0, dy: 0 };
            }
          } else {
            // Right side — aim + auto-fire
            if (!this.vjRight.active) {
              this.vjRight = { active: true, id: t.identifier, startX: cx, startY: cy, dx: 0, dy: 0, firing: true };
            }
          }
        });
      };

      const onTouchMove = (e) => {
        e.preventDefault();
        const W = this.scale.width;
        const rect = canvas.getBoundingClientRect();
        Array.from(e.changedTouches).forEach(t => {
          const cx = t.clientX * (W / rect.width);
          const cy = t.clientY * (this.scale.height / rect.height);
          if (this.vjLeft.active && t.identifier === this.vjLeft.id) {
            const raw_dx = cx - this.vjLeft.startX;
            const raw_dy = cy - this.vjLeft.startY;
            const len = Math.sqrt(raw_dx * raw_dx + raw_dy * raw_dy);
            const maxR = 60;
            if (len > maxR) {
              this.vjLeft.dx = (raw_dx / len) * maxR;
              this.vjLeft.dy = (raw_dy / len) * maxR;
            } else {
              this.vjLeft.dx = raw_dx;
              this.vjLeft.dy = raw_dy;
            }
          }
          if (this.vjRight.active && t.identifier === this.vjRight.id) {
            this.vjRight.dx = cx - this.vjRight.startX;
            this.vjRight.dy = cy - this.vjRight.startY;
          }
        });
      };

      const onTouchEnd = (e) => {
        e.preventDefault();
        Array.from(e.changedTouches).forEach(t => {
          if (this.vjLeft.active && t.identifier === this.vjLeft.id) {
            this.vjLeft = { active: false, id: null, startX: 0, startY: 0, dx: 0, dy: 0 };
          }
          if (this.vjRight.active && t.identifier === this.vjRight.id) {
            this.vjRight = { active: false, id: null, startX: 0, startY: 0, dx: 0, dy: 0, firing: false };
          }
        });
      };

      canvas.addEventListener('touchstart', onTouchStart, { passive: false });
      canvas.addEventListener('touchmove',  onTouchMove,  { passive: false });
      canvas.addEventListener('touchend',   onTouchEnd,   { passive: false });
      canvas.addEventListener('touchcancel',onTouchEnd,   { passive: false });

      // Clean up when scene shuts down
      this.events.once('shutdown', () => {
        canvas.removeEventListener('touchstart', onTouchStart);
        canvas.removeEventListener('touchmove',  onTouchMove);
        canvas.removeEventListener('touchend',   onTouchEnd);
        canvas.removeEventListener('touchcancel',onTouchEnd);
      });
    }

    // Cooldown trackers for defensive actions
    this.dashCooldown = 0;
    this.dashTimeRemaining = 0;
    this.isInvulnerable = false;
    this.deflectorCooldown = 0;
    
    // Post-damage invulnerability and repair trackers
    this.postDamageInvulnTimeRemaining = 0;
    this.lastDamageTime = 0;

    // ---- CAMERA ----
    this.cameras.main.setBounds(0, 0, this.ARENA_SIZE, this.ARENA_SIZE);
    // Instant camera follow (lerp 1) locks the player perfectly in the center of the screen to eliminate aim drift
    this.cameras.main.startFollow(this.player, true, 1, 1);
    this.cameras.main.setBackgroundColor('#04040a');

    // ---- PHYSICS ----
    this.physics.add.overlap(
      this.bullets, this.enemies,
      this.handleBulletEnemyCollision, null, this
    );
    this.physics.add.overlap(
      this.player, this.enemies,
      this.handlePlayerEnemyCollision, null, this
    );
    this.physics.add.overlap(
      this.player, this.powerups,
      this.handlePlayerPowerupCollision, null, this
    );
    this.physics.add.overlap(
      this.bullets, this.unbrokenGems,
      this.handleBulletGemCollision, null, this
    );
    this.physics.add.overlap(
      this.bullets, this.bomberRockets,
      this.handleBulletRocketCollision, null, this
    );
    this.physics.add.overlap(
      this.player, this.bomberRockets,
      this.handlePlayerRocketCollision, null, this
    );
    this.physics.add.overlap(
      this.player, this.enemiesBullets,
      this.handlePlayerSniperBulletCollision, null, this
    );
    // Task 5: player bullets can shoot down enemy bullets
    this.physics.add.overlap(
      this.bullets, this.enemiesBullets,
      this.handleBulletVsBulletCollision, null, this
    );

    // Debris physical collider
    this.physics.add.collider(this.player, this.debrisGroup);
    
    // Interactive Asteroids colliders/overlaps
    this.physics.add.collider(
      this.player, this.interactiveAsteroids,
      this.handlePlayerAsteroidCollision, null, this
    );
    this.physics.add.overlap(
      this.bullets, this.interactiveAsteroids,
      this.handleBulletAsteroidCollision, null, this
    );


    // ---- POST-GROUP SETUP ----
    this.collectibleManager.create();
    this.bossManager = new BossManager(this);
    this.bossManager.create();

    this.gravitySingularities = [];
    this.physics.add.collider(this.interactiveAsteroids, this.interactiveAsteroids);
    this.spawnInitialAsteroids();
    this.asteroidSpawnTimer = this.time.addEvent({
      delay: 13000,
      callback: this.spawnInteractiveAsteroid,
      callbackScope: this,
      loop: true
    });

    // ---- BACKSTORY INTRO STATE GUARD ----
    const backstoryPlayed = !!window.backstoryPlayed;

    if (!backstoryPlayed && this.wave === 1) {
      this.dialogueManager.playBackstory(this.player, () => {
        this.startEnemySpawner();
        synthAudio.startBGM(false);
        this.effectsManager.showWaveAnnouncement(this.wave);
      });
    } else {
      if (this.wave % 5 === 0) {
        this.triggerBossWave();
      } else {
        this.startEnemySpawner();
        synthAudio.startBGM(false);
      }
    }

    this.dispatchMetricsToReact();

    // ---- RESTART LISTENER ----
    const handleRestartEvent = () => {
      if (this.dialogueManager) this.dialogueManager.stop();
      if (this.bossManager) this.bossManager.teardownActiveBoss();
      this.tweens.killAll();
      this.time.removeAllEvents();
      this.isGameOver = false;
      this.bossLevelGateShown = false;
      this.isCombatFrozen = false;
      this.physics.resume();
      this.scene.restart();
    };
    window.addEventListener('game-restart', handleRestartEvent);

    const handleResumeEvent = () => {
      this.isCombatFrozen = false;
      this.isBossIntroActive = false;
      if (this.bossManager) {
        this.bossManager.isEscaping = false;
        this.bossManager.isRebirthing = false;
        this.bossManager.isDying = false;
        this.bossManager.clearRebirthSafetyTimer();
        if (this.bossManager.darkOverlay) {
          this.bossManager.darkOverlay.destroy();
          this.bossManager.darkOverlay = null;
        }
      }
      this.physics.resume();
      this.isBossWave = false;
      this.wave += 1;
      this.enemiesDestroyed = (this.wave - 1) * 10;
      synthAudio.startBGM(false);
      this.effectsManager.showWaveAnnouncement(this.wave);
      this.startEnemySpawner();
      this.dispatchMetricsToReact();
    };
    window.addEventListener('game-resume-next-wave', handleResumeEvent);

    this.events.once('shutdown', () => {
      window.removeEventListener('game-restart', handleRestartEvent);
      window.removeEventListener('game-resume-next-wave', handleResumeEvent);
      if (this.asteroidSpawnTimer) this.asteroidSpawnTimer.destroy();
      if (this.bossManager) this.bossManager.destroy();
      try {
        if (this.bomberRockets && this.bomberRockets.active && this.bomberRockets.children) {
          this.bomberRockets.getChildren().forEach(b => {
            const trail = b.getData('trail');
            if (trail) trail.destroy();
          });
          this.bomberRockets.destroy(true);
        }
      } catch (e) {
        // Safe catch for destruction sequence
      }
      try {
        if (this.enemiesBullets && this.enemiesBullets.active) {
          this.enemiesBullets.destroy(true);
        }
      } catch (e) {
        // Safe catch for destruction sequence
      }
      synthAudio.stopBGM();
    });
  }

  update(time, delta) {
    if (this.health <= 0) {
      if (this.playerLocatorReticle) this.playerLocatorReticle.clear();
      if (this.playerAuraGlow) this.playerAuraGlow.clear();
      return;
    }

    if (this.boundaryLine) {
      this.boundaryLine.setVisible(!this.isCombatFrozen);
    }

    this.updatePlayerLocator(time);

    // Post-damage invulnerability frames blinking effect
    if (this.postDamageInvulnTimeRemaining > 0) {
      this.postDamageInvulnTimeRemaining -= delta;
      this.player.setAlpha(0.25 + Math.sin(time * 0.05) * 0.25); // flashing alpha
      if (this.postDamageInvulnTimeRemaining <= 0) {
        this.player.setAlpha(1.0);
      }
    }

    // Passive Nano-repair regen (2.5 HP/sec after 4.5s of no damage)
    if (time - this.lastDamageTime > 4500 && this.health < this.maxHealth) {
      const healAmt = 2.5 * (delta / 1000);
      this.health = Math.min(this.maxHealth, this.health + healAmt);
      
      this.regenTextTimer = (this.regenTextTimer || 0) + delta;
      if (this.regenTextTimer > 1500) {
        this.regenTextTimer = 0;
        this.effectsManager.showFloatingText(
          this.player.x, this.player.y - 45,
          "REPAIRING", "#39ff14", "10px"
        );
        // Repair Surge kinetic shockwave
        this.triggerRepairSurge(this.player.x, this.player.y);
      }
    }

    // Developer Cheat Keys for Debugging Level Progression
    if (Phaser.Input.Keyboard.JustDown(this.keys.K)) {
      if (this.enemies) {
        this.enemies.getChildren().forEach(enemy => {
          if (enemy.active) {
            this.enemyManager.destroyEnemy(enemy);
            this.enemiesDestroyed += 1;
          }
        });
        this.enemies.clear(true, true);
        this.checkWaveProgress();
      }
      if (this.isBossWave && this.bossManager && this.bossManager.boss && this.bossManager.boss.active) {
        this.bossManager.hp = Math.max(0, this.bossManager.hp - 100);
        this.bossManager.scene.effectsManager.hitFlash(this.bossManager.boss);
        if (this.bossManager.hp <= 0) {
          if (this.wave === 5 && this.bossManager.phase !== 'reborn' && !this.bossManager.isRebirthing) {
            this.bossManager.startRebirthSequence();
          } else if (!this.bossManager.isRebirthing && !this.bossManager.isEscaping) {
            this.bossManager.destroyBoss();
          }
        } else {
          this.dispatchMetricsToReact();
        }
      }
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.L)) {
      const nextWave = this.wave + 1;
      if (nextWave > MAX_PLAYABLE_WAVE) {
        this.triggerBossLevelComingSoon();
        return;
      }
      this.wave = nextWave;
      this.enemiesDestroyed = (this.wave - 1) * 10;

      if (this.wave % 5 === 0) {
        this.triggerBossWave();
      } else {
        this.effectsManager.showWaveAnnouncement(this.wave);
        if (this.dialogueManager) {
          this.dialogueManager.playExchange('enemyEntry', this.player, this.player, () => {
            this.startEnemySpawner();
          });
        } else {
          this.startEnemySpawner();
        }
      }
      this.dispatchMetricsToReact();
    }

    // Reduce defensive cooldowns
    if (this.dashCooldown > 0) this.dashCooldown -= delta;
    if (this.dashTimeRemaining > 0) {
      this.dashTimeRemaining -= delta;
      if (this.dashTimeRemaining <= 0) {
        this.isInvulnerable = false;
        this.player.setAlpha(1.0);
      } else {
        // Shadow trails for Dash visual effect
        if (Math.random() < 0.4) {
          const shadow = this.add.sprite(this.player.x, this.player.y, 'playerShipTexture');
          shadow.setRotation(this.player.rotation);
          shadow.setScale(this.player.scaleX);
          shadow.setTint(this.shipTint || 0x00f0ff);
          shadow.setAlpha(0.45);
          this.tweens.add({
            targets: shadow,
            alpha: 0,
            duration: 200,
            onComplete: () => shadow.destroy()
          });
        }
      }
    }
    if (this.deflectorCooldown > 0) this.deflectorCooldown -= delta;

    // SPACEBAR DASH: Brief high-speed invulnerable glide
    if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE) && this.dashCooldown <= 0 && !this.isBossIntroActive && !this.isCombatFrozen) {
      this.dashCooldown = 1500; // 1.5s cooldown
      this.dashTimeRemaining = 220; // 220ms duration
      this.isInvulnerable = true;
      this.player.setAlpha(0.65);
      
      let dx = 0;
      let dy = 0;
      if (this.keys.W.isDown) dy = -1;
      if (this.keys.S.isDown) dy = 1;
      if (this.keys.A.isDown) dx = -1;
      if (this.keys.D.isDown) dx = 1;
      
      let dashAngle;
      if (dx === 0 && dy === 0) {
        dashAngle = this.player.getData('fireAngle') || 0;
      } else {
        dashAngle = Math.atan2(dy, dx);
      }
      
      const dashSpeed = 680;
      this.player.setVelocity(Math.cos(dashAngle) * dashSpeed, Math.sin(dashAngle) * dashSpeed);
      this.cameras.main.flash(80, 0, 240, 255, 0.12);
      this.effectsManager.enemyDeath(this.player.x, this.player.y, 0x00f0ff);
      synthAudio.playBoostActivate('HYPER');
      this.dispatchMetricsToReact();
    }

    // RIGHT-CLICK GRAVITY DEFLECTOR: Clear nearby projectiles & knockback enemies
    const activePointer = this.input.activePointer;
    if (activePointer.rightButtonDown() && this.deflectorCooldown <= 0 && !this.isBossIntroActive && !this.isCombatFrozen) {
      this.deflectorCooldown = 5000; // 5.0s cooldown
      
      const deflectorRing = this.add.circle(this.player.x, this.player.y, 16, 0x00ffff, 0.18);
      deflectorRing.setStrokeStyle(3, 0x00ffff, 0.85);
      deflectorRing.setDepth(DEPTH.PLAYER_SHIELD);
      
      this.tweens.add({
        targets: deflectorRing,
        radius: 170,
        alpha: 0,
        duration: 450,
        ease: 'Cubic.easeOut',
        onComplete: () => deflectorRing.destroy()
      });

      synthAudio.playBoostActivate('VOID_STORM');
      this.cameras.main.shake(120, 0.005);

      const pushRadius = 170;

      // 1. Repel enemies and stun briefly
      if (this.enemies) {
        this.enemies.getChildren().forEach(enemy => {
          if (!enemy.active) return;
          const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
          if (dist < pushRadius) {
            const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, enemy.x, enemy.y);
            enemy.setVelocity(Math.cos(angle) * 480, Math.sin(angle) * 480);
            this.effectsManager.hitFlash(enemy);
            
            const nextAction = enemy.getData('nextAction') || 0;
            enemy.setData('nextAction', nextAction + 1500);
          }
        });
      }

      // 2. Vaporize enemy standard bullets
      if (this.enemiesBullets && this.enemiesBullets.active) {
        this.enemiesBullets.getChildren().forEach(bullet => {
          if (!bullet.active) return;
          const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, bullet.x, bullet.y);
          if (dist < pushRadius) {
            const trail = bullet.getData('trail');
            if (trail) trail.destroy();
            bullet.destroy();
            this.effectsManager.enemyDeath(bullet.x, bullet.y, 0x00ffff);
          }
        });
      }

      // 3. Vaporize enemy bomber rockets
      if (this.bomberRockets && this.bomberRockets.active) {
        this.bomberRockets.getChildren().forEach(rocket => {
          if (!rocket.active) return;
          const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, rocket.x, rocket.y);
          if (dist < pushRadius) {
            const trail = rocket.getData('trail');
            if (trail) trail.destroy();
            rocket.destroy();
            this.effectsManager.enemyDeath(rocket.x, rocket.y, 0x00ffff);
          }
        });
      }

      // 4. Deflect boss bullets
      if (this.isBossWave && this.bossManager && this.bossManager.bullets && this.bossManager.bullets.active) {
        this.bossManager.bullets.getChildren().forEach(bullet => {
          if (!bullet.active) return;
          const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, bullet.x, bullet.y);
          if (dist < pushRadius) {
            const trail = bullet.getData('trail');
            if (trail) trail.destroy();
            bullet.destroy();
            this.effectsManager.enemyDeath(bullet.x, bullet.y, 0x00ffff);
          }
        });
      }

      this.dispatchMetricsToReact();
    }

    // Throttled UI updates
    this.uiTimer = (this.uiTimer || 0) + delta;
    if (this.uiTimer > 150) {
      this.uiTimer = 0;
      this.dispatchMetricsToReact();
    }

    // Hit stop micro-freeze (must not unpause during cinematics, boss rebirth, or game over)
    if (this.hitStopTimeRemaining > 0) {
      this.hitStopTimeRemaining -= delta;
      this.physics.world.pause();
    } else if (!this.isCombatFrozen && !this.isGameOver && this.health > 0) {
      this.physics.world.resume();
    }

    // ---- SYSTEMS ----
    this.spaceBackground.update(time, delta);
    this.blackHoleManager.update(time, delta);
    this.enemyManager.update(time, delta);
    this.collectibleManager.update(time, delta);
    this.effectsManager.update();
    this.boostManager.update(time, delta);
    if (this.bossManager) {
      this.bossManager.update(time, delta);
    }

    // Wrap interactive asteroids
    if (this.interactiveAsteroids) {
      this.interactiveAsteroids.getChildren().forEach((ast) => {
        if (!ast.active) return;
        if (ast.x < -40) ast.x = this.ARENA_SIZE + 40;
        if (ast.x > this.ARENA_SIZE + 40) ast.x = -40;
        if (ast.y < -40) ast.y = this.ARENA_SIZE + 40;
        if (ast.y > this.ARENA_SIZE + 40) ast.y = -40;
        const rotSpeed = ast.getData('rotSpeed') || 0;
        ast.angle += rotSpeed * (delta / 16.666);
      });
    }

    // Update gravity singularities
    this.updateGravitySingularities(time, delta);

    // Homing rocket steering logic
    if (this.bomberRockets) {
      this.bomberRockets.getChildren().forEach(rocket => {
        if (!rocket.active) return;
        if (this.player && this.player.active) {
          const angle = Phaser.Math.Angle.Between(rocket.x, rocket.y, this.player.x, this.player.y);
          const nextRot = Phaser.Math.Angle.RotateTo(rocket.rotation, angle, 0.045);
          rocket.setRotation(nextRot);
          rocket.setVelocity(Math.cos(nextRot) * 160, Math.sin(nextRot) * 160);
        }
      });
    }

    // Homing enemy sniper bullets steering logic
    if (this.enemiesBullets) {
      this.enemiesBullets.getChildren().forEach(b => {
        if (!b.active) return;
        if (!b.getData('isHoming')) return;
        if (this.player && this.player.active) {
          const angle = Phaser.Math.Angle.Between(b.x, b.y, this.player.x, this.player.y);
          const nextRot = Phaser.Math.Angle.RotateTo(b.rotation, angle, 0.035);
          b.setRotation(nextRot);
          b.setVelocity(Math.cos(nextRot) * 750, Math.sin(nextRot) * 750);
        }
      });
    }

    // Homing and helix player bullets movement logic
    if (this.bullets) {
      this.bullets.getChildren().forEach(b => {
        if (!b.active) return;
        
        if (b.getData('isHelix')) {
          const angle = b.getData('helixAngle') || 0;
          let phase = b.getData('helixPhase') || 0;
          const freq = b.getData('helixFreq') || 0.15;
          const amp = b.getData('helixAmp') || 140;
          const side = b.getData('helixSide') || 1;
          const speed = b.getData('helixSpeed') || 520;
          
          phase += delta * freq * 0.1;
          b.setData('helixPhase', phase);
          
          const fx = Math.cos(angle) * speed;
          const fy = Math.sin(angle) * speed;
          const px = Math.cos(angle + Math.PI / 2);
          const py = Math.sin(angle + Math.PI / 2);
          const osc = Math.sin(phase) * amp * side;
          
          b.setVelocity(fx + px * osc, fy + py * osc);
          b.setRotation(Math.atan2(b.body.velocity.y, b.body.velocity.x));
        } else {
          const target = b.getData('homingTarget');
          if (target && target.active) {
            const angle = Phaser.Math.Angle.Between(b.x, b.y, target.x, target.y);
            const nextRot = Phaser.Math.Angle.RotateTo(b.rotation, angle, 0.1);
            b.setRotation(nextRot);
            b.setVelocity(Math.cos(nextRot) * 550, Math.sin(nextRot) * 550);
          }
        }
      });
    }

    if (!this.isBossWave) {
      // Track game time for difficulty scaling
      this.gameTime += delta;

      // ---- DIFFICULTY SCALING (every 30s) ----
      const newDifficulty = Math.floor(this.gameTime / 30000) + 1;
      if (newDifficulty !== this.difficultyLevel) {
        this.difficultyLevel = newDifficulty;
        this.onDifficultyIncrease();
      }
    }

    // ---- PLAYER MOVEMENT ----
    if (this.isCombatFrozen) {
      this.player.setVelocity(0, 0);
    } else {
      const speed = 250;
      let vx = 0;
      let vy = 0;

      // Desktop: WASD keyboard
      if (this.keys.W.isDown) vy = -speed;
      if (this.keys.S.isDown) vy = speed;
      if (this.keys.A.isDown) vx = -speed;
      if (this.keys.D.isDown) vx = speed;

      // Mobile: left virtual joystick overrides keyboard if active
      if (this.isTouchDevice && this.vjLeft.active) {
        const maxR = 60;
        const ratio = Math.min(Math.sqrt(this.vjLeft.dx ** 2 + this.vjLeft.dy ** 2) / maxR, 1);
        vx = (this.vjLeft.dx / maxR) * speed * ratio;
        vy = (this.vjLeft.dy / maxR) * speed * ratio;
      }

      if (vx !== 0 && vy !== 0) {
        vx *= 0.7071;
        vy *= 0.7071;
      }

      if (vx !== 0 || vy !== 0) {
        this.player.setVelocity(vx, vy);
      } else {
        this.player.setVelocity(
          this.player.body.velocity.x * 0.85,
          this.player.body.velocity.y * 0.85
        );
      }
    }

    // ---- SHIP ROTATION & AIMING ----
    if (!this.isCombatFrozen) {
      let fireAngle;

      if (this.isTouchDevice && this.vjRight.active &&
          (this.vjRight.dx !== 0 || this.vjRight.dy !== 0)) {
        // Mobile: derive angle from right joystick delta
        fireAngle = Math.atan2(this.vjRight.dy, this.vjRight.dx);
      } else {
        // Desktop: mouse pointer world position
        const pointer = this.input.activePointer;
        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        fireAngle = Phaser.Math.Angle.Between(
          this.player.x, this.player.y,
          worldPoint.x, worldPoint.y
        );
      }

      // The ship sprite texture points UP (north). Phaser's 0-angle means RIGHT.
      // So we add PI/2 to the VISUAL rotation only, keeping fireAngle pure.
      this.player.setRotation(fireAngle + Math.PI / 2);

      // Store the true firing angle so shootBullet() can use it directly.
      this.player.setData('fireAngle', fireAngle);
    } else {
      // In dialogue, gently return to standard upward rotation (or keep last rotation)
      // For visual polish, let's keep last rotation or just set it visually
    }

    // ---- WEAPONS ----
    const pointer = this.input.activePointer;
    // Desktop fires on mouse hold; mobile fires when right joystick is active
    const shouldFire = this.isTouchDevice
      ? (this.vjRight.active && this.vjRight.firing)
      : pointer.isDown;

    if (shouldFire && time > this.nextFireTime && !this.isCombatFrozen) {
      this.shootBullet(pointer, time);
    }

    // ---- DRAW VIRTUAL JOYSTICKS (touch only) ----
    if (this.vjGraphics) this.vjGraphics.clear();
    if (this.isTouchDevice && this.vjGraphics) {
      const g = this.vjGraphics;
      const drawJoystick = (startX, startY, dx, dy) => {
        const maxR = 60;
        const clampedLen = Math.min(Math.sqrt(dx * dx + dy * dy), maxR);
        const angle = Math.atan2(dy, dx);
        const knobX = startX + Math.cos(angle) * clampedLen;
        const knobY = startY + Math.sin(angle) * clampedLen;
        // Outer ring
        g.lineStyle(2, 0xffffff, 0.18);
        g.strokeCircle(startX, startY, maxR);
        // Inner knob
        g.fillStyle(0xffffff, 0.28);
        g.fillCircle(knobX, knobY, 20);
        g.lineStyle(2, 0x00f0ff, 0.55);
        g.strokeCircle(knobX, knobY, 20);
      };
      if (this.vjLeft.active) {
        drawJoystick(this.vjLeft.startX, this.vjLeft.startY, this.vjLeft.dx, this.vjLeft.dy);
      }
      if (this.vjRight.active) {
        drawJoystick(this.vjRight.startX, this.vjRight.startY, this.vjRight.dx, this.vjRight.dy);
        // Crosshair on right knob to hint "this is aim"
        const maxR = 60;
        const len = Math.min(Math.sqrt(this.vjRight.dx ** 2 + this.vjRight.dy ** 2), maxR);
        const a = Math.atan2(this.vjRight.dy, this.vjRight.dx);
        const kx = this.vjRight.startX + Math.cos(a) * len;
        const ky = this.vjRight.startY + Math.sin(a) * len;
        g.lineStyle(1.5, 0xff007f, 0.7);
        g.beginPath(); g.moveTo(kx - 10, ky); g.lineTo(kx + 10, ky); g.strokePath();
        g.beginPath(); g.moveTo(kx, ky - 10); g.lineTo(kx, ky + 10); g.strokePath();
      }
    }

    // ---- ENGINE TRAIL ADAPTATION ----
    // Emit more particles when moving faster, and even more during rapid fire
    const playerSpeed = Math.sqrt(
      this.player.body ? (this.player.body.velocity.x ** 2 + this.player.body.velocity.y ** 2) : 0
    );
    let trailFrequency = Phaser.Math.Clamp(40 - playerSpeed * 0.08, 12, 40);
    if (this.isRapidFire) {
      trailFrequency = Math.max(5, trailFrequency * 0.5);
    }
    const isBoostActive = this.boostManager && this.boostManager.isBoostActive;
    if (isBoostActive) {
      trailFrequency = Math.max(4, trailFrequency * 0.3);
      this.engineTrail.setParticleScale({ start: 1.4, end: 0 });
      this.engineTrail.setParticleSpeed({ min: 45, max: 120 });
    } else if (playerSpeed > 100) {
      // Main character speed boost flare
      trailFrequency = Math.max(6, trailFrequency * 0.6);
      this.engineTrail.setParticleScale({ start: 1.0, end: 0 });
      this.engineTrail.setParticleSpeed({ min: 25, max: 60 });
    } else {
      this.engineTrail.setParticleScale({ start: 0.6, end: 0 });
      this.engineTrail.setParticleSpeed({ min: 10, max: 30 });
    }
    this.engineTrail.setFrequency(trailFrequency);

    // Update player aura glow
    if (this.playerAuraGlow && this.player.active) {
      this.playerAuraGlow.clear();
      const auraAlpha = 0.35 + Math.sin(time / 150) * 0.15;
      this.playerAuraGlow.fillStyle(this.shipTint, auraAlpha);
      this.playerAuraGlow.fillCircle(this.player.x, this.player.y, 28);
      // Bright white inner core for extra contrast
      this.playerAuraGlow.fillStyle(0xffffff, auraAlpha * 0.6);
      this.playerAuraGlow.fillCircle(this.player.x, this.player.y, 14);
    }

    // ---- SHIELD ----
    if (this.isShielded) {
      this.shieldTime -= delta;
      this.playerShieldRing.clear();
      const shieldAlpha = Math.abs(Math.sin(time / 100)) * 0.45 + 0.35;
      
      // Outer rotating hexagon shield aura (Main Character exclusive)
      const numSides = 6;
      const shieldRad = 35;
      const rot = (time / 1000) * 1.2;
      this.playerShieldRing.lineStyle(2.5, 0x00f0ff, shieldAlpha);
      this.playerShieldRing.beginPath();
      for (let i = 0; i <= numSides; i++) {
        const angle = (i / numSides) * Math.PI * 2 + rot;
        const sx = this.player.x + Math.cos(angle) * shieldRad;
        const sy = this.player.y + Math.sin(angle) * shieldRad;
        if (i === 0) this.playerShieldRing.moveTo(sx, sy);
        else this.playerShieldRing.lineTo(sx, sy);
      }
      this.playerShieldRing.closePath();
      this.playerShieldRing.strokePath();

      // Outer pulsing corner points on the shield
      this.playerShieldRing.lineStyle(1.5, 0x00f0ff, shieldAlpha * 0.7);
      for (let i = 0; i < numSides; i++) {
        const angle = (i / numSides) * Math.PI * 2 + rot;
        const sx = this.player.x + Math.cos(angle) * (shieldRad + 4);
        const sy = this.player.y + Math.sin(angle) * (shieldRad + 4);
        this.playerShieldRing.strokeCircle(sx, sy, 2);
      }

      if (this.shieldTime <= 0) {
        this.isShielded = false;
        this.playerShieldRing.clear();
        this.dispatchMetricsToReact();
      }
    }

    // ---- RAPID FIRE ----
    if (this.isRapidFire) {
      this.rapidFireTime -= delta;
      
      // Cycle through neon tints dynamically
      const rfColors = [0x00f0ff, 0x39ff14, 0xff007f, 0xff6600];
      const cycleIndex = Math.floor(time / 150) % rfColors.length;
      this.player.setTint(rfColors[cycleIndex]);
      
      // Stronger engine trail glow during rapid fire
      this.engineTrail.setParticleTint(rfColors[cycleIndex]);
      
      if (this.rapidFireTime <= 0) {
        this.isRapidFire = false;
        this.player.clearTint();
        this.engineTrail.setParticleTint(0x00f0ff); // Reset to default cyan
        this.dispatchMetricsToReact();
      }
    }

    // ---- CLEAN BOUNDARY BULLETS ----
    const groupsToClean = [
      this.bullets,
      this.enemiesBullets,
      this.bomberRockets
    ];
    if (this.bossManager && this.bossManager.bullets) {
      groupsToClean.push(this.bossManager.bullets);
    }

    groupsToClean.forEach(group => {
      if (!group || !group.getChildren) return;
      group.getChildren().forEach((bullet) => {
        if (!bullet.active) return;
        if (bullet.x < -80 || bullet.x > this.ARENA_SIZE + 80 ||
            bullet.y < -80 || bullet.y > this.ARENA_SIZE + 80) {
          const trail = bullet.getData('trail');
          if (trail) trail.destroy();
          bullet.destroy();
        }
      });
    });
  }

  /* ==================================================================
     DIFFICULTY SCALING
     ================================================================== */

  onDifficultyIncrease() {
    // Announce
    if (this.effectsManager) {
      this.effectsManager.showFloatingText(
        this.ARENA_SIZE / 2, this.ARENA_SIZE / 2,
        `INTENSITY ${this.difficultyLevel}`,
        '#ff6600', '16px'
      );
    }

    // Increase spawn rate
    this.baseSpawnRate = Math.max(500, this.baseSpawnRate - 150);
    this.startEnemySpawner();
  }

  /* ==================================================================
     WEAPONS
     ================================================================== */

  shootBullet(pointer, time) {
    if (this.health <= 0 || this.isBossIntroActive) return;

    let fireCooldown = this.isRapidFire ? 85 : 220;
    if (this.isOverdrive) {
      fireCooldown = Math.max(50, Math.floor(fireCooldown / 2.2));
    }
    this.nextFireTime = time + fireCooldown;

    // Use the stored pure firing angle — exactly toward the cursor, no offset needed.
    const angle = this.player.getData('fireAngle') || 0;

    // Spawn bullet from the nose tip of the ship (30px forward along firing angle — matches new 72px hero ship)
    const offset = 30;
    const startX = this.player.x + Math.cos(angle) * offset;
    const startY = this.player.y + Math.sin(angle) * offset;

    let firedSynergy = false;

    if (this.isRapidFire && this.isShielded) {
      this.firePlasmaLightning(startX, startY, angle, time);
      firedSynergy = true;
    } else if (this.isRapidFire && this.boostManager.activeBoost === 'TITAN') {
      this.fireSupernovaBlast(startX, startY, angle, time);
      firedSynergy = true;
    } else if (this.isRapidFire && this.boostManager.activeBoost === 'MULTI_SHOT') {
      this.fireLotusBlossom(startX, startY, angle, time);
      firedSynergy = true;
    } else if (this.isRapidFire && this.boostManager.activeBoost === 'VOID_STORM') {
      this.fireGravitySingularity(startX, startY, angle, time);
      firedSynergy = true;
    } else if (this.isShielded && this.boostManager.activeBoost === 'MULTI_SHOT') {
      this.fireAegisShards(startX, startY, angle, time);
      firedSynergy = true;
    }

    if (firedSynergy) {
      const spawnBossHomingSpheres = this.isBossWave && this.bossManager && this.bossManager.boss && this.bossManager.boss.active;
      if (spawnBossHomingSpheres) {
        const boss = this.bossManager.boss;
        let mods = this.boostManager.getBulletModifiers();
        mods.damage = (mods.damage || 1.0) * (this.isBossWave ? 1.6 : 1.0);
        mods.scale = (mods.scale || 1.0) * (this.isBossWave ? 1.25 : 1.0);
        for (let i = -1; i <= 1; i += 2) {
          const spawnAngle = angle + (i * Math.PI / 2);
          const b = this.bullets.create(
            startX + Math.cos(spawnAngle) * 25,
            startY + Math.sin(spawnAngle) * 25,
            'laserPlayerTexture'
          );
          b.setDepth(DEPTH.BULLET);
          b.setRotation(angle);
          b.setScale((mods.scale || 1) * 1.5);
          b.setTint(0x39ff14);
          b.setData('damage', (mods.damage || 1) * 1.8);
          b.setData('homingTarget', boss);

          const trail = this.add.particles(0, 0, 'laserPlayerTexture', {
            speed: 0,
            scale: { start: 1.4, end: 0.1 },
            alpha: { start: 0.7, end: 0 },
            lifespan: 160,
            frequency: 12,
            blendMode: 'ADD',
            follow: b
          });
          trail.setDepth(DEPTH.BULLET - 1);
          b.setData('trail', trail);
        }
      }
      return;
    }

    synthAudio.playLaser();

    // Get boost bullet modifiers
    let mods = this.boostManager.getBulletModifiers();
    // During boss waves, add extra homing spheres as a bonus — do NOT override the player's aim/pattern
    const spawnBossHomingSpheres = this.isBossWave && this.bossManager && this.bossManager.boss && this.bossManager.boss.active;
    mods.damage = (mods.damage || 1.0) * (this.isBossWave ? 1.6 : 1.0);
    mods.scale = (mods.scale || 1.0) * (this.isBossWave ? 1.25 : 1.0);
    if (this.isOverdrive) {
      mods.scale = (mods.scale || 1.0) * 1.35;
      mods.damage = (mods.damage || 1.0) * 1.5;
      if (!mods.tint) mods.tint = 0xffea00;
    }

    // Recoil: nudge player back opposite to shot direction
    const recoilForce = 3.5;
    this.player.x -= Math.cos(angle) * recoilForce;
    this.player.y -= Math.sin(angle) * recoilForce;

    // Muzzle Flash Effect (Aligned with the tip rocket)
    this.effectsManager.muzzleFlash(
      startX,
      startY,
      angle,
      mods.tint || 0x00f0ff
    );

    if (mods.pattern === 'orbit') {
      // VOID STORM: orbiting bullets that fire outward
      for (let i = 0; i < 4; i++) {
        const orbitAngle = angle + (i / 4) * Math.PI * 2;
        const b = this.bullets.create(
          startX + Math.cos(orbitAngle) * 20,
          startY + Math.sin(orbitAngle) * 20,
          'laserPlayerTexture'
        );
        b.setDepth(DEPTH.BULLET);
        b.setRotation(orbitAngle);
        b.setBlendMode(Phaser.BlendModes.ADD);
        b.setScale(mods.scale);
        if (mods.tint) b.setTint(mods.tint);
        const vel = 350;
        b.setVelocity(
          Math.cos(orbitAngle) * vel,
          Math.sin(orbitAngle) * vel
        );
        b.setData('damage', mods.damage || 1);

        // Particle trail
        const trail = this.add.particles(0, 0, 'laserPlayerTexture', {
          speed: 0,
          scale: { start: 0.95, end: 0.1 },
          alpha: { start: 0.5, end: 0 },
          lifespan: 120,
          frequency: 18,
          blendMode: 'ADD',
          follow: b
        });
        trail.setDepth(DEPTH.BULLET - 1);
        b.setData('trail', trail);
      }
    } else if (mods.pattern === 'multi') {
      // MULTI-SHOT: triple + arc spread
      const spreads = [-0.25, -0.12, 0, 0.12, 0.25];
      spreads.forEach((sa) => {
        const b = this.bullets.create(
          startX, startY, 'laserPlayerTexture'
        );
        b.setDepth(DEPTH.BULLET);
        b.setRotation(angle + sa);
        b.setBlendMode(Phaser.BlendModes.ADD);
        b.setScale(mods.scale);
        if (mods.tint) b.setTint(mods.tint);
        const vel = 450;
        b.setVelocity(
          Math.cos(angle + sa) * vel,
          Math.sin(angle + sa) * vel
        );
        b.setData('damage', mods.damage || 1);

        // Particle trail
        const trail = this.add.particles(0, 0, 'laserPlayerTexture', {
          speed: 0,
          scale: { start: 0.95, end: 0.1 },
          alpha: { start: 0.5, end: 0 },
          lifespan: 120,
          frequency: 18,
          blendMode: 'ADD',
          follow: b
        });
        trail.setDepth(DEPTH.BULLET - 1);
        b.setData('trail', trail);
      });
    } else if (mods.pattern === 'twin') {
      // TWIN-SHOT: Fire from player and twin drones
      const spawnPoints = [{ x: startX, y: startY }];
      if (this.boostManager.twinShipLeft) {
        spawnPoints.push({ x: this.boostManager.twinShipLeft.x, y: this.boostManager.twinShipLeft.y });
        spawnPoints.push({ x: this.boostManager.twinShipRight.x, y: this.boostManager.twinShipRight.y });
      }

      spawnPoints.forEach((pt) => {
        const b = this.bullets.create(pt.x, pt.y, 'laserPlayerTexture');
        b.setDepth(DEPTH.BULLET);
        b.setRotation(angle);
        b.setBlendMode(Phaser.BlendModes.ADD);
        b.setScale(mods.scale);
        if (mods.tint) b.setTint(mods.tint);
        const vel = 500 * mods.velocity;
        b.setVelocity(Math.cos(angle) * vel, Math.sin(angle) * vel);
        b.setData('damage', (mods.damage || 1) * 1.5);

        const trail = this.add.particles(0, 0, 'laserPlayerTexture', {
          speed: 0,
          scale: { start: 0.95, end: 0.1 },
          alpha: { start: 0.5, end: 0 },
          lifespan: 120,
          frequency: 18,
          blendMode: 'ADD',
          follow: b
        });
        trail.setDepth(DEPTH.BULLET - 1);
        b.setData('trail', trail);
      });
    } else if (this.isRapidFire) {
      // Rapid fire triple shot
      const spreads = [-0.14, 0, 0.14];
      spreads.forEach((sa) => {
        const b = this.bullets.create(
          startX, startY, 'laserPlayerTexture'
        );
        b.setDepth(DEPTH.BULLET);
        b.setRotation(angle + sa);
        b.setBlendMode(Phaser.BlendModes.ADD);
        b.setScale(mods.scale);
        if (mods.tint) b.setTint(mods.tint);
        const vel = 650 * mods.velocity;
        b.setVelocity(
          Math.cos(angle + sa) * vel,
          Math.sin(angle + sa) * vel
        );
        b.setData('damage', mods.damage || 1);

        // Particle trail
        const trail = this.add.particles(0, 0, 'laserPlayerTexture', {
          speed: 0,
          scale: { start: 0.95, end: 0.1 },
          alpha: { start: 0.5, end: 0 },
          lifespan: 120,
          frequency: 18,
          blendMode: 'ADD',
          follow: b
        });
        trail.setDepth(DEPTH.BULLET - 1);
        b.setData('trail', trail);
      });
    } else {
      // Single shot
      const b = this.bullets.create(
        startX, startY, 'laserPlayerTexture'
      );
      b.setDepth(DEPTH.BULLET);
      b.setRotation(angle);
      b.setBlendMode(Phaser.BlendModes.ADD);
      b.setScale(mods.scale);
      if (mods.tint) b.setTint(mods.tint);
      const vel = 500 * mods.velocity;
      b.setVelocity(
        Math.cos(angle) * vel,
        Math.sin(angle) * vel
      );
      b.setData('damage', mods.damage || 1);

      // Particle trail
      const trail = this.add.particles(0, 0, 'laserPlayerTexture', {
        speed: 0,
        scale: { start: 0.95, end: 0.1 },
        alpha: { start: 0.5, end: 0 },
        lifespan: 120,
        frequency: 18,
        blendMode: 'ADD',
        follow: b
      });
      trail.setDepth(DEPTH.BULLET - 1);
      b.setData('trail', trail);
    }

    // Boss Homing Bonus: spawn 2 acid-green tracking spheres alongside the normal shot
    if (spawnBossHomingSpheres) {
      const boss = this.bossManager.boss;
      for (let i = -1; i <= 1; i += 2) {
        const spawnAngle = angle + (i * Math.PI / 2);
        const b = this.bullets.create(
          startX + Math.cos(spawnAngle) * 25,
          startY + Math.sin(spawnAngle) * 25,
          'laserPlayerTexture'
        );
        b.setDepth(DEPTH.BULLET);
        b.setRotation(angle);
        b.setScale((mods.scale || 1) * 1.5);
        b.setTint(0x39ff14);
        b.setData('damage', (mods.damage || 1) * 1.8);
        b.setData('homingTarget', boss);

        const trail = this.add.particles(0, 0, 'laserPlayerTexture', {
          speed: 0,
          scale: { start: 1.4, end: 0.1 },
          alpha: { start: 0.7, end: 0 },
          lifespan: 160,
          frequency: 12,
          blendMode: 'ADD',
          follow: b
        });
        trail.setDepth(DEPTH.BULLET - 1);
        b.setData('trail', trail);
      }
    }
  }

  /* ==================================================================
     COLLISIONS
     ================================================================== */

  handleBulletEnemyCollision(bullet, enemy) {
    if (this.isCombatFrozen) return;
    if (!bullet.active || !enemy.active) return;

    // Shield protector active shield block check
    if (enemy.getData('type') === 'shield' && enemy.getData('shieldActive')) {
      const dist = Phaser.Math.Distance.Between(bullet.x, bullet.y, enemy.x, enemy.y);
      if (dist < 32) {
        const trail = bullet.getData('trail');
        if (trail) trail.destroy();
        bullet.destroy();
        this.effectsManager.hitFlash(enemy);
        synthAudio.playShieldDeflect();
        return;
      }
    }

    const bulletDamage = bullet.getData('damage') || 1;
    const trail = bullet.getData('trail');
    
    const bx = bullet.x;
    const by = bullet.y;

    if (bullet.getData('isPlasmaLightning')) {
      this.triggerLightningChain(bx, by, enemy);
    } else if (bullet.getData('isSupernova')) {
      this.triggerSupernovaSplash(bx, by);
    } else if (bullet.getData('isGravitySingularity')) {
      this.triggerGravitySingularityVortex(bx, by);
    } else if (bullet.getData('isAegisShard')) {
      if (trail) trail.destroy();
      this.spawnWreckageDebris(bullet.x, bullet.y, 0x00f0ff);
      bullet.destroy();
    } else {
      if (trail) trail.destroy();
      bullet.destroy();
    }

    let hp = enemy.getData('hp') - bulletDamage;
    enemy.setData('hp', hp);

    const enemyColor = enemy.getData('color') || 0xffffff;
    this.effectsManager.bulletHit(bx, by, enemyColor);
    this.effectsManager.hitFlash(enemy);
    synthAudio.playHit();

    // Hit stop micro-freeze: 30ms on regular hit, 60ms on kill
    this.hitStopTimeRemaining = hp <= 0 ? 60 : 30;

    if (hp <= 0) {
      const enemyColor = enemy.getData('color') || 0xff00ff;
      const points = enemy.getData('points') || 10;

      this.effectsManager.enemyDeath(enemy.x, enemy.y, enemyColor);
      this.spawnWreckageDebris(enemy.x, enemy.y, enemyColor);

      synthAudio.playExplosion();

      // Combo scoring multiplier
      const multiplier = 1 + Math.min(2.0, Math.floor(this.comboCount / 5) * 0.2);
      const finalPoints = Math.round(points * multiplier);
      this.score += finalPoints;
      this.enemiesDestroyed += 1;

      this.effectsManager.showFloatingText(
        enemy.x, enemy.y, `+${finalPoints}`, '#ffea00', '12px'
      );

      // Increment combo count
      this.comboCount += 1;
      if (this.comboTimer) this.comboTimer.destroy();
      this.comboTimer = this.time.delayedCall(this.comboDecayTime, () => {
        this.decayCombo();
      });

      // Trigger Overdrive
      if (this.comboCount >= 20 && !this.isOverdrive) {
        this.triggerOverdrive();
      }

      // Try to drop a collectible
      this.collectibleManager.tryDropFromEnemy(enemy.x, enemy.y, this.wave);

      // Siphon Lifesteal: 15% chance to recover +2 HP on kill
      if (Math.random() < 0.15 && this.health < this.maxHealth) {
        this.health = Math.min(this.maxHealth, this.health + 2);
        this.effectsManager.showFloatingText(enemy.x, enemy.y - 20, "SIPHON +2", "#39ff14", "11px");
        this.triggerRepairSurge(this.player.x, this.player.y);
      }

      this.enemyManager.destroyEnemy(enemy);

      // Trigger immersive combat audio responses
      if (enemy.getData('type') !== 'boss') {
        if (Math.random() < 0.10) {
          this.dialogueManager.playCombatChatter(this.player, enemy, 'ally_killed');
        } else {
          this.dialogueManager.playKillReaction(this.player);
        }
      }

      this.checkWaveProgress();
      this.dispatchMetricsToReact();
    }
  }

  handlePlayerEnemyCollision(player, enemy) {
    if (this.isCombatFrozen) return;
    if (this.health <= 0 || !enemy.active || this.isBossIntroActive) return;
    if (this.postDamageInvulnTimeRemaining > 0) return;
    if (this.isInvulnerable) return; // Dash invulnerability

    // Phase Dash: phase through enemies
    if (this.boostManager.activeBoost === 'PHASE_DASH') {
      return;
    }

    if (this.isShielded) {
      const angle = Phaser.Math.Angle.Between(player.x, player.y, enemy.x, enemy.y);
      enemy.setVelocity(Math.cos(angle) * 350, Math.sin(angle) * 350);
      return;
    }

    const damage = enemy.getData('damage') || 10;
    const isCharging = enemy.getData('isCharging') || false;
    const finalDamage = isCharging ? damage * 1.5 : damage;

    this.health = Math.max(0, this.health - finalDamage);
    this.lastDamageTime = this.time.now;
    this.postDamageInvulnTimeRemaining = 600; // 600ms of invulnerability frames!

    this.effectsManager.playerDamage();
    synthAudio.playDamage();

    const bounceAngle = Phaser.Math.Angle.Between(player.x, player.y, enemy.x, enemy.y);
    enemy.x += Math.cos(bounceAngle) * 50;
    enemy.y += Math.sin(bounceAngle) * 50;

    this.dispatchMetricsToReact();

    if (this.health <= 0) {
      this.handleGameOver();
    }
  }

  handlePlayerPowerupCollision(player, gem) {
    if (this.isCombatFrozen) return;
    if (!gem.active) return;
    this.collectibleManager.handlePickup(player, gem);
  }

  handleBulletGemCollision(bullet, gem) {
    if (this.isCombatFrozen) return;
    if (!bullet.active || !gem.active) return;
    const trail = bullet.getData('trail');
    if (trail) trail.destroy();
    bullet.destroy();
    this.collectibleManager.breakGem(gem);
  }

  /* ==================================================================
     ENEMY SPAWNER
     ================================================================== */

  startEnemySpawner() {
    if (this.enemySpawnTimer) this.enemySpawnTimer.destroy();

    const delay = Math.max(500, this.baseSpawnRate - this.wave * 150);
    this.enemySpawnTimer = this.time.addEvent({
      delay,
      callback: this.spawnEnemy,
      callbackScope: this,
      loop: true,
    });
  }

  spawnEnemy() {
    if (this.health <= 0 || this.isBossWave) return;

    const cam = this.cameras.main;
    const padding = 100;

    let x, y;
    const edge = Phaser.Math.Between(0, 3);

    if (edge === 0) {
      x = Phaser.Math.Between(cam.worldView.left - padding, cam.worldView.right + padding);
      y = cam.worldView.top - padding;
    } else if (edge === 1) {
      x = Phaser.Math.Between(cam.worldView.left - padding, cam.worldView.right + padding);
      y = cam.worldView.bottom + padding;
    } else if (edge === 2) {
      x = cam.worldView.left - padding;
      y = Phaser.Math.Between(cam.worldView.top - padding, cam.worldView.bottom + padding);
    } else {
      x = cam.worldView.right + padding;
      y = Phaser.Math.Between(cam.worldView.top - padding, cam.worldView.bottom + padding);
    }

    x = Phaser.Math.Clamp(x, 80, this.ARENA_SIZE - 80);
    y = Phaser.Math.Clamp(y, 80, this.ARENA_SIZE - 80);

    // Keep away from black holes
    for (const bh of this.blackHoleManager.blackHoles) {
      const dist = Phaser.Math.Distance.Between(x, y, bh.x, bh.y);
      if (dist < bh.coreRadius * 4) {
        x = Math.min(this.ARENA_SIZE - 80, x + 200);
        y = Math.min(this.ARENA_SIZE - 80, y + 200);
      }
    }

    // Weighted enemy selection based on wave level
    const roll = Math.random();
    if (this.wave >= 6 && roll < 0.20) {
      this.enemyManager.spawnEnemy('bomber', x, y);
    } else if (this.wave >= 4 && roll < 0.40) {
      this.enemyManager.spawnEnemy('sniper', x, y);
    } else if (this.wave >= 3 && roll < 0.55) {
      this.enemyManager.spawnEnemy('shield', x, y);
    } else if (this.wave >= 2 && roll < 0.70) {
      this.enemyManager.spawnEnemy('hunter', x, y);
    } else {
      this.enemyManager.spawnEnemy('drone', x, y);
    }

    // Higher difficulty: occasionally spawn extra enemies
    if (this.difficultyLevel >= 2 && Math.random() < 0.2) {
      this.time.delayedCall(300, () => {
        if (!this.isBossWave) {
          this.enemyManager.spawnEnemy('drone', x + 50, y + 50);
        }
      });
    }
  }

  checkWaveProgress() {
    if (this.isBossWave) return; // Wait for boss defeat
    if (this.bossLevelGateShown) return;

    if (this.enemiesDestroyed > 0 && this.enemiesDestroyed % 10 === 0) {
      const nextWave = this.wave + 1;

      if (nextWave > MAX_PLAYABLE_WAVE) {
        this.triggerBossLevelComingSoon();
        return;
      }

      this.wave = nextWave;

      if (this.wave % 5 === 0) {
        this.triggerBossWave();
      } else {
        this.effectsManager.showWaveAnnouncement(this.wave);
        if (this.dialogueManager) {
          const activeEnemy = this.enemies.getFirstAlive();
          this.dialogueManager.playCombatChatter(this.player, activeEnemy, 'random');
          this.startEnemySpawner();
        } else {
          this.startEnemySpawner();
        }
      }
    }
  }

  triggerBossLevelComingSoon() {
    if (this.bossLevelGateShown || this.isGameOver) return;
    this.bossLevelGateShown = true;

    if (this.enemySpawnTimer) this.enemySpawnTimer.destroy();
    if (this.dialogueManager) this.dialogueManager.stop();
    this.isCombatFrozen = true;
    this.isBossWave = false;

    if (this.player && this.player.active) {
      this.player.setVelocity(0, 0);
    }

    this.physics.pause();
    synthAudio.stopBGM();

    const px = this.player?.x ?? this.ARENA_SIZE / 2;
    const py = this.player?.y ?? this.ARENA_SIZE / 2;
    this.effectsManager.showFloatingText(px, py - 80, 'SECTOR 10 LOCKED', '#ffea00', '20px');
    this.effectsManager.showFloatingText(px, py - 55, 'STAY TUNED', '#9d00ff', '14px');
    this.dispatchMetricsToReact();

    this.time.delayedCall(1400, () => {
      window.dispatchEvent(
        new CustomEvent('game-boss-coming-soon-event', {
          detail: {
            score: this.score,
            wave: MAX_PLAYABLE_WAVE,
            enemiesDestroyed: this.enemiesDestroyed,
          },
        })
      );
    });
  }

  triggerBossWave() {
    if (this.wave > MAX_PLAYABLE_WAVE) {
      this.triggerBossLevelComingSoon();
      return;
    }

    this.isBossWave = true;
    if (this.enemySpawnTimer) this.enemySpawnTimer.destroy();

    // Clean up normal enemies
    this.enemies.getChildren().forEach((e) => {
      this.enemyManager.destroyEnemy(e);
    });
    this.enemies.clear(true, true);

    if (this.bossManager) {
      this.bossManager.teardownActiveBoss();
    }

    this.bossManager.spawnBoss(this.wave);
    synthAudio.startBGM(true); // Intense boss BGM
  }

  decayCombo() {
    this.comboCount = 0;
    this.isOverdrive = false;
    this.dispatchMetricsToReact();
  }

  triggerOverdrive() {
    this.isOverdrive = true;
    this.effectsManager.showFloatingText(
      this.player.x, this.player.y - 65,
      'OVERDRIVE!',
      '#ffea00',
      '14px'
    );
    this.cameras.main.flash(200, 255, 234, 0, 0.4);
    this.effectsManager.screenPulse(0xffea00, 0.25);

    this.time.delayedCall(6000, () => {
      this.isOverdrive = false;
      this.comboCount = 0;
      this.dispatchMetricsToReact();
    });
  }

  handleBulletRocketCollision(bullet, rocket) {
    if (this.isCombatFrozen) return;
    if (!bullet.active || !rocket.active) return;
    const bulletTrail = bullet.getData('trail');
    if (bulletTrail) bulletTrail.destroy();
    bullet.destroy();

    const hp = rocket.getData('hp') - 1;
    rocket.setData('hp', hp);
    this.effectsManager.hitFlash(rocket);

    this.hitStopTimeRemaining = hp <= 0 ? 50 : 20;

    if (hp <= 0) {
      const trail = rocket.getData('trail');
      if (trail) trail.destroy();
      this.effectsManager.enemyDeath(rocket.x, rocket.y, 0xff5500);
      this.spawnWreckageDebris(rocket.x, rocket.y, 0xff5500);
      synthAudio.playExplosion();
      rocket.destroy();
    }
  }

  handleBulletVsBulletCollision(playerBullet, enemyBullet) {
    if (this.isCombatFrozen) return;
    if (!playerBullet.active || !enemyBullet.active) return;

    const px = playerBullet.x;
    const py = playerBullet.y;

    const pTrail = playerBullet.getData('trail');
    if (pTrail) pTrail.destroy();
    playerBullet.destroy();

    const eTrail = enemyBullet.getData('trail');
    if (eTrail) eTrail.destroy();
    enemyBullet.destroy();

    // Mini spark flash at interception point
    this.effectsManager.bulletHit(px, py, 0xffea00);
    this.hitStopTimeRemaining = 20;
  }

  handlePlayerRocketCollision(player, rocket) {
    if (this.isCombatFrozen) return;
    if (this.health <= 0 || !rocket.active) return;
    if (this.postDamageInvulnTimeRemaining > 0) return;
    if (this.isInvulnerable) {
      const trail = rocket.getData('trail');
      if (trail) trail.destroy();
      rocket.destroy();
      return;
    }

    const trail = rocket.getData('trail');
    if (trail) trail.destroy();
    this.spawnWreckageDebris(rocket.x, rocket.y, 0xff5500);
    rocket.destroy();

    if (this.isShielded) {
      this.effectsManager.screenPulse(0x00f0ff, 0.25);
      return;
    }

    this.hitStopTimeRemaining = 75;

    const damage = rocket.getData('damage') || 18;
    this.health = Math.max(0, this.health - damage);
    this.lastDamageTime = this.time.now;
    this.postDamageInvulnTimeRemaining = 600; // 600ms invuln!
    this.effectsManager.playerDamage();
    synthAudio.playDamage();
    this.dispatchMetricsToReact();

    if (this.health <= 0) {
      this.handleGameOver();
    }
  }

  handlePlayerSniperBulletCollision(player, bullet) {
    if (this.isCombatFrozen) return;
    if (this.health <= 0 || !bullet.active) return;
    if (this.postDamageInvulnTimeRemaining > 0) return;
    if (this.isInvulnerable) {
      const trail = bullet.getData('trail');
      if (trail) trail.destroy();
      bullet.destroy();
      return;
    }
    const trail = bullet.getData('trail');
    if (trail) trail.destroy();
    bullet.destroy();

    if (this.isShielded) {
      this.effectsManager.screenPulse(0x00f0ff, 0.2);
      return;
    }

    this.hitStopTimeRemaining = 75;

    const damage = bullet.getData('damage') || 20;
    this.health = Math.max(0, this.health - damage);
    this.lastDamageTime = this.time.now;
    this.postDamageInvulnTimeRemaining = 600; // 600ms invuln!
    this.effectsManager.playerDamage();
    synthAudio.playDamage();
    this.dispatchMetricsToReact();

    if (this.health <= 0) {
      this.handleGameOver();
    }
  }

  /* ==================================================================
     GAME OVER
     ================================================================== */

  handleGameOver() {
    if (this.isGameOver) return; // Prevent firing multiple times
    this.isGameOver = true;

    if (this.dialogueManager) {
      this.dialogueManager.stop();
    }

    // Freeze inputs and pause physics to stop all enemies and bullets,
    // but keep updating visuals and effects for the death sequence
    this.isCombatFrozen = true;
    this.player.setVelocity(0, 0);
    this.physics.world.pause();

    // Fade out HUD overlay for clean cinematic letterbox look
    const hud = document.getElementById('hud-root') || document.querySelector('.game-hud');
    if (hud) {
      hud.style.transition = 'opacity 500ms ease';
      hud.style.opacity = '0';
    }

    // 1. Slow camera zoom-in on the dying hero's ship
    this.cameras.main.zoomTo(1.25, 3500, 'Quad.easeOut');

    // 2. Slow spin and drift to simulate ship losing control
    const driftAngle = this.player.rotation;
    const driftX = Math.cos(driftAngle) * 50;
    const driftY = Math.sin(driftAngle) * 50;

    this.tweens.add({
      targets: this.player,
      rotation: this.player.rotation + (Math.random() > 0.5 ? 3.0 : -3.0),
      x: this.player.x + driftX,
      y: this.player.y + driftY,
      duration: 3800,
      ease: 'Quad.easeOut'
    });

    // 3. Tint the ship red and slowly dim it to look damaged/burning
    this.tweens.add({
      targets: this.player,
      tint: 0xff3333,
      alpha: 0.25,
      duration: 3800,
      ease: 'Linear'
    });

    // 4. Periodically spawn sparks and component explosions/smoke on the ship
    const dismantleTimer = this.time.addEvent({
      delay: 180,
      callback: () => {
        if (!this.player || !this.player.active) return;
        const rx = this.player.x + Phaser.Math.Between(-16, 16);
        const ry = this.player.y + Phaser.Math.Between(-16, 16);

        // Spawn hit sparks
        this.effectsManager.bulletHit(rx, ry, 0xff5500);

        // Add subtle screen shake
        this.cameras.main.shake(80, 0.004);

        // Play occasional low-volume pop/explosion sound
        if (Math.random() > 0.35) {
          synthAudio.playHit();
        }
      },
      repeat: 20
    });

    // Trigger dying monologue
    this.dialogueManager.playDyingMonologue(this.player, () => {
      // Clear the dismantling timer
      dismantleTimer.destroy();

      // Monologue finished! Complete the death sequences
      this.physics.world.resume();
      this.player.setVisible(false);
      this.player.active = false;
      if (this.engineTrail) this.engineTrail.stop();

      // Giant final ship explosion
      this.effectsManager.enemyDeath(this.player.x, this.player.y, 0x00f0ff);
      synthAudio.stopBGM();
      synthAudio.playExplosion();

      // Reset camera zoom
      this.cameras.main.setZoom(1);

      // Restore HUD visibility for future runs
      if (hud) hud.style.opacity = '1';

      const gameOverEvent = new CustomEvent('game-over-event', {
        detail: {
          score: this.score,
          wave: this.wave,
          enemiesDestroyed: this.enemiesDestroyed,
        },
      });
      window.dispatchEvent(gameOverEvent);
    });
  }

  dispatchMetricsToReact() {
    const boostActive = this.boostManager && this.boostManager.isBoostActive;
    const bossActive = !!(this.bossManager && this.bossManager.boss);
    const bossHealth = this.bossManager ? this.bossManager.bossHpPercent : 0;
    const bossName = this.bossManager ? this.bossManager.bossName : '';

    const HUDEvent = new CustomEvent('game-hud-update', {
      detail: {
        score: this.score,
        health: this.health,
        maxHealth: this.maxHealth,
        wave: this.wave,
        enemiesDestroyed: this.enemiesDestroyed,
        isShielded: this.isShielded,
        isRapidFire: this.isRapidFire,
        shieldTime: Math.max(0, Math.ceil(this.shieldTime / 1000)),
        rapidFireTime: Math.max(0, Math.ceil(this.rapidFireTime / 1000)),
        boostActive: boostActive,
        boostType: boostActive ? this.boostManager.boostType : null,
        boostTimeRemaining: boostActive ? this.boostManager.boostTimeRemaining : 0,
        difficultyLevel: this.difficultyLevel,
        bossActive,
        bossHealth,
        bossName,
        comboCount: this.comboCount,
        comboMultiplier: 1 + Math.min(2.0, Math.floor(this.comboCount / 5) * 0.2),
        isOverdrive: this.isOverdrive,
        dashCooldown: Math.max(0, this.dashCooldown),
        deflectorCooldown: Math.max(0, this.deflectorCooldown),
      },
    });
    window.dispatchEvent(HUDEvent);
  }

  /* ==================================================================
     TEXTURE GENERATORS
     ================================================================== */

  createGlowingTextures() {
    if (this.textures.exists('fogTexture')) return;

    const drawGlow = (key, size, drawFn) => {
      const tex = this.textures.createCanvas(key, size, size);
      drawFn(tex.getContext(), size / 2);
      tex.refresh();
    };

    const createPattern = (key, size, fillFn) => {
      const tex = this.textures.createCanvas(key, size, size);
      fillFn(tex.getContext(), size);
      tex.refresh();
    };

    // ============= BACKGROUND =============

    // Fog
    createPattern('fogTexture', 256, (ctx, s) => {
      ctx.fillStyle = '#04040a';
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 15; i++) {
        const g = ctx.createRadialGradient(
          Math.random() * s, Math.random() * s, 2,
          Math.random() * s, Math.random() * s, 40 + Math.random() * 30
        );
        g.addColorStop(0, 'rgba(80, 50, 120, 0.08)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, s, s);
      }
    });

    // Star back
    createPattern('starBackTexture', 128, (ctx, s) => {
      ctx.fillStyle = '#04040a';
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = '#44446c';
      for (let i = 0; i < 10; i++) {
        ctx.fillRect(Math.random() * s, Math.random() * s, 1.2, 1.2);
      }
    });

    // Star mid
    createPattern('starMidTexture', 128, (ctx, s) => {
      ctx.fillStyle = '#7777aa';
      for (let i = 0; i < 6; i++) {
        ctx.fillRect(Math.random() * s, Math.random() * s, 1.8, 1.8);
      }
    });

    // Star fore
    createPattern('starForeTexture', 128, (ctx, s) => {
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 5;
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(Math.random() * s, Math.random() * s, 3, 3);
      }
    });

    // Galaxy fog
    createPattern('galaxyFogTexture', 256, (ctx, s) => {
      for (let i = 0; i < 8; i++) {
        const g = ctx.createRadialGradient(
          Math.random() * s, Math.random() * s, 5,
          Math.random() * s, Math.random() * s, 60 + Math.random() * 40
        );
        g.addColorStop(0, 'rgba(100, 50, 180, 0.05)');
        g.addColorStop(0.5, 'rgba(50, 0, 100, 0.03)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, s, s);
      }
    });

    // Nebulae
    const createNebula = (key, c1, c2) => {
      createPattern(key, 256, (ctx, s) => {
        const g = ctx.createRadialGradient(s/2, s/2, 0, s/2, s/2, s/2);
        g.addColorStop(0, c1);
        g.addColorStop(0.3, c2);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, s, s);
      });
    };
    createNebula('nebulaBlueTexture', 'rgba(0, 150, 255, 0.25)', 'rgba(0, 50, 255, 0.1)');
    createNebula('nebulaPinkTexture', 'rgba(255, 0, 150, 0.2)', 'rgba(255, 0, 50, 0.06)');
    createNebula('nebulaPurpleTexture', 'rgba(150, 0, 255, 0.22)', 'rgba(50, 0, 255, 0.08)');

    // Twinkle star
    drawGlow('twinkleStarTexture', 12, (ctx, r) => {
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 6;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(r, r, 2, 0, Math.PI * 2);
      ctx.fill();
    });

    // Ambient particle
    drawGlow('ambientParticleTexture', 6, (ctx, r) => {
      ctx.fillStyle = '#aaaaff';
      ctx.beginPath();
      ctx.arc(r, r, 1.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // ============= BLACK HOLE =============
    {
      const s = 256;
      const tex = this.textures.createCanvas('blackHoleTexture', s, s);
      const c = tex.getContext();
      const g = c.createRadialGradient(s/2, s/2, 20, s/2, s/2, 100);
      g.addColorStop(0, 'rgba(255, 60, 0, 0.85)');
      g.addColorStop(0.2, 'rgba(255, 0, 150, 0.6)');
      g.addColorStop(0.5, 'rgba(157, 0, 255, 0.2)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, s, s);
      c.strokeStyle = 'rgba(255, 234, 0, 0.35)';
      c.lineWidth = 3;
      c.beginPath();
      c.arc(s/2, s/2, 40, 0, Math.PI * 0.95);
      c.stroke();
      c.strokeStyle = 'rgba(255, 0, 100, 0.25)';
      c.beginPath();
      c.arc(s/2, s/2, 65, Math.PI * 0.5, Math.PI * 1.6);
      c.stroke();
      tex.refresh();
    }

    // ============= PLAYER SHIP — HERO INTERCEPTOR =============
    drawGlow('playerShipTexture', 72, (ctx, r) => {
      const cx = r;   // center X = 36
      const cy = r;   // center Y = 36



      // === LAYER 0: Outer energy halo ===
      const halo = ctx.createRadialGradient(cx, cy, 8, cx, cy, 38);
      halo.addColorStop(0, 'rgba(0,240,255,0.18)');
      halo.addColorStop(0.6, 'rgba(255,0,200,0.07)');
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, 38, 0, Math.PI * 2);
      ctx.fill();

      // === LAYER 1: Main delta wings (large swept back) ===
      // Ship points UP (nose at top, cy-28)
      ctx.shadowColor = '#ff00cc';
      ctx.shadowBlur = 18;
      ctx.fillStyle = 'rgba(200,0,180,0.22)';
      ctx.strokeStyle = '#ff00cc';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(cx,     cy - 28);  // nose tip
      ctx.lineTo(cx - 28, cy + 18); // left wingtip
      ctx.lineTo(cx - 12, cy + 10); // left wing inner
      ctx.lineTo(cx,     cy + 18);  // tail center notch
      ctx.lineTo(cx + 12, cy + 10); // right wing inner
      ctx.lineTo(cx + 28, cy + 18); // right wingtip
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // === LAYER 2: Inner fuselage body ===
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 14;
      ctx.fillStyle = 'rgba(0,200,255,0.28)';
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx,      cy - 26);  // nose
      ctx.lineTo(cx - 10, cy + 6);   // left shoulder
      ctx.lineTo(cx - 8,  cy + 20);  // left tail base
      ctx.lineTo(cx,      cy + 14);  // tail notch
      ctx.lineTo(cx + 8,  cy + 20);  // right tail base
      ctx.lineTo(cx + 10, cy + 6);   // right shoulder
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // === LAYER 3: Cockpit canopy ===
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 20;
      const canopy = ctx.createRadialGradient(cx, cy - 14, 1, cx, cy - 14, 8);
      canopy.addColorStop(0, 'rgba(255,255,255,0.95)');
      canopy.addColorStop(0.4, 'rgba(0,240,255,0.7)');
      canopy.addColorStop(1, 'rgba(0,100,200,0.1)');
      ctx.fillStyle = canopy;
      ctx.beginPath();
      ctx.ellipse(cx, cy - 14, 5, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      // canopy rim
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // === LAYER 4: Twin engine pods ===
      [cx - 9, cx + 9].forEach(ex => {
        // Pod body
        ctx.shadowColor = '#ff6600';
        ctx.shadowBlur = 10;
        ctx.fillStyle = 'rgba(30,20,10,0.85)';
        ctx.strokeStyle = '#ff8800';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(ex, cy + 14, 4, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Engine fire
        const fire = ctx.createRadialGradient(ex, cy + 20, 0, ex, cy + 20, 5);
        fire.addColorStop(0, 'rgba(255,255,180,1)');
        fire.addColorStop(0.4, 'rgba(255,120,0,0.9)');
        fire.addColorStop(1, 'rgba(255,60,0,0)');
        ctx.fillStyle = fire;
        ctx.beginPath();
        ctx.ellipse(ex, cy + 20, 3, 5, 0, 0, Math.PI * 2);
        ctx.fill();
      });

      // === LAYER 5: Weapon rails / gun barrels ===
      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur = 6;
      ctx.strokeStyle = 'rgba(0,255,255,0.7)';
      ctx.lineWidth = 1.2;
      [cx - 6, cx + 6].forEach(gx => {
        ctx.beginPath();
        ctx.moveTo(gx, cy - 26);
        ctx.lineTo(gx, cy - 16);
        ctx.stroke();
      });

      // === LAYER 6: Central energy core ===
      const core = ctx.createRadialGradient(cx, cy - 2, 0, cx, cy - 2, 7);
      core.addColorStop(0, 'rgba(255,255,255,1)');
      core.addColorStop(0.3, 'rgba(0,255,255,0.9)');
      core.addColorStop(0.7, 'rgba(180,0,255,0.5)');
      core.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur = 22;
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(cx, cy - 2, 7, 0, Math.PI * 2);
      ctx.fill();

      // === LAYER 7: Wing accent stripe lines ===
      ctx.shadowBlur = 4;
      ctx.strokeStyle = 'rgba(255,0,200,0.55)';
      ctx.lineWidth = 0.8;
      // left stripe
      ctx.beginPath();
      ctx.moveTo(cx - 4, cy - 16);
      ctx.lineTo(cx - 22, cy + 14);
      ctx.stroke();
      // right stripe
      ctx.beginPath();
      ctx.moveTo(cx + 4, cy - 16);
      ctx.lineTo(cx + 22, cy + 14);
      ctx.stroke();
    });

    // Engine trail particle — electric plasma blue-white
    drawGlow('engineTrailTexture', 8, (ctx, r) => {
      const g = ctx.createRadialGradient(r, r, 0, r, r, r);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.3, 'rgba(100,200,255,0.9)');
      g.addColorStop(0.7, 'rgba(0,100,255,0.4)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(r, r, r, 0, Math.PI * 2);
      ctx.fill();
    });

    // ============= BULLET =============
    drawGlow('bulletTexture', 18, (ctx, r) => {
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#00f0ff';
      ctx.beginPath();
      ctx.arc(r, r, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(r, r, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // ============= ENEMY TEXTURES =============

    // Neon Wasp (fast drone) - diamond/hexagon, cyan glow
    drawGlow('droneTexture', 24, (ctx, r) => {
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 10;
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(r, 2);
      ctx.lineTo(20, r);
      ctx.lineTo(r, 22);
      ctx.lineTo(4, r);
      ctx.closePath();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ff0055';
      ctx.beginPath();
      ctx.arc(r, r, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // Drone trail
    drawGlow('droneTrailTexture', 6, (ctx, r) => {
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 4;
      ctx.fillStyle = '#00f0ff';
      ctx.beginPath();
      ctx.arc(r, r, 1.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // Void Hunter - large octagon, purple glow, intimidating
    drawGlow('hunterTexture', 36, (ctx, r) => {
      ctx.shadowColor = '#9d00ff';
      ctx.shadowBlur = 14;
      ctx.strokeStyle = '#9d00ff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      const sides = 8;
      for (let i = 0; i < sides; i++) {
        const a = (i / sides) * Math.PI * 2 - Math.PI / 2;
        const px = r + Math.cos(a) * 14;
        const py = r + Math.sin(a) * 14;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      // Inner pulsing core
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ff00ff';
      ctx.beginPath();
      ctx.arc(r, r, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowColor = '#9d00ff';
      ctx.shadowBlur = 6;
      ctx.strokeStyle = '#ff00ff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(r, r, 8, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Hunter trail
    drawGlow('hunterTrailTexture', 8, (ctx, r) => {
      ctx.shadowColor = '#9d00ff';
      ctx.shadowBlur = 5;
      ctx.fillStyle = '#9d00ff';
      ctx.beginPath();
      ctx.arc(r, r, 2, 0, Math.PI * 2);
      ctx.fill();
    });

    // ============= SPARK & GEM =============

    drawGlow('sparkTexture', 10, (ctx) => {
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 4;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(2, 2, 6, 6);
    });

    drawGlow('gemGlowTexture', 48, (ctx, r) => {
      const g = ctx.createRadialGradient(r, r, 2, r, r, r);
      g.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
      g.addColorStop(0.25, 'rgba(255, 255, 255, 0.7)');
      g.addColorStop(0.6, 'rgba(255, 255, 255, 0.2)');
      g.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, r * 2, r * 2);
    });

    drawGlow('gemTexture', 24, (ctx, r) => {
      ctx.shadowColor = '#39ff14';
      ctx.shadowBlur = 10;
      ctx.strokeStyle = '#39ff14';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(r, 2);
      ctx.lineTo(20, r);
      ctx.lineTo(r, 22);
      ctx.lineTo(4, r);
      ctx.closePath();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(r, 6);
      ctx.lineTo(16, r);
      ctx.lineTo(r, 18);
      ctx.lineTo(8, r);
      ctx.closePath();
      ctx.fill();
    });

    // ============= COLLECTIBLE BOOST TOKEN =============
    drawGlow('collectibleTexture', 20, (ctx, r) => {
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 8;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.beginPath();
      ctx.arc(r, r, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(r, r, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // ============= ENERGY FRAGMENT =============
    drawGlow('energyFragmentTexture', 12, (ctx, r) => {
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 6;
      ctx.fillStyle = '#00f0ff';
      ctx.beginPath();
      ctx.moveTo(r, 1);
      ctx.lineTo(10, r);
      ctx.lineTo(r, 11);
      ctx.lineTo(2, r);
      ctx.closePath();
      ctx.fill();
      
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(r - 1.5, r - 1.5, 3, 3);
    });

    // ============= NEW ENEMY VARIETIES =============
    
    // Rocket Bomber (slow, heavy) - Orange back-swept wing
    drawGlow('bomberTexture', 36, (ctx, r) => {
      ctx.shadowColor = '#ff5500';
      ctx.shadowBlur = 12;
      ctx.strokeStyle = '#ff5500';
      ctx.lineWidth = 3.0;
      ctx.fillStyle = 'rgba(255, 85, 0, 0.15)';
      ctx.beginPath();
      ctx.moveTo(34, r);
      ctx.lineTo(6, 4);
      ctx.lineTo(12, r);
      ctx.lineTo(6, 32);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.shadowBlur = 4;
      ctx.fillStyle = '#ffea00';
      ctx.beginPath();
      ctx.arc(10, r, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    // Bomber trail
    drawGlow('bomberTrailTexture', 8, (ctx, r) => {
      ctx.shadowColor = '#ff5500';
      ctx.shadowBlur = 5;
      ctx.fillStyle = '#ff5500';
      ctx.beginPath();
      ctx.arc(r, r, 2, 0, Math.PI * 2);
      ctx.fill();
    });

    // Shield Protector (Green Hexagon)
    drawGlow('shieldTexture', 30, (ctx, r) => {
      ctx.shadowColor = '#39ff14';
      ctx.shadowBlur = 10;
      ctx.strokeStyle = '#39ff14';
      ctx.lineWidth = 2.5;
      ctx.fillStyle = 'rgba(57, 255, 20, 0.1)';
      ctx.beginPath();
      const sides = 6;
      for (let i = 0; i < sides; i++) {
        const a = (i / sides) * Math.PI * 2;
        const px = r + Math.cos(a) * 11;
        const py = r + Math.sin(a) * 11;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });

    // Shield trail
    drawGlow('shieldTrailTexture', 6, (ctx, r) => {
      ctx.shadowColor = '#39ff14';
      ctx.shadowBlur = 4;
      ctx.fillStyle = '#39ff14';
      ctx.beginPath();
      ctx.arc(r, r, 1.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // Sniper Interceptor (Yellow needle wing)
    drawGlow('sniperTexture', 28, (ctx, r) => {
      ctx.shadowColor = '#ffea00';
      ctx.shadowBlur = 10;
      ctx.strokeStyle = '#ffea00';
      ctx.lineWidth = 2.0;
      ctx.fillStyle = 'rgba(255, 234, 0, 0.15)';
      ctx.beginPath();
      ctx.moveTo(26, r);
      ctx.lineTo(4, 8);
      ctx.lineTo(8, r);
      ctx.lineTo(4, 20);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ff0055';
      ctx.beginPath();
      ctx.arc(18, r, 2, 0, Math.PI * 2);
      ctx.fill();
    });

    // Sniper trail
    drawGlow('sniperTrailTexture', 6, (ctx, r) => {
      ctx.shadowColor = '#ffea00';
      ctx.shadowBlur = 4;
      ctx.fillStyle = '#ffea00';
      ctx.beginPath();
      ctx.arc(r, r, 1.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // Homing Rocket (Orange capsule with glowing tip)
    drawGlow('homingRocketTexture', 20, (ctx, r) => {
      ctx.shadowColor = '#ff5500';
      ctx.shadowBlur = 10;
      ctx.fillStyle = 'rgba(255, 85, 0, 0.4)';
      ctx.strokeStyle = '#ff5500';
      ctx.lineWidth = 1.5;
      
      ctx.beginPath();
      ctx.roundRect(2, r - 4, 16, 8, 4);
      ctx.fill();
      ctx.stroke();

      // White tip / core
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(6, r - 2, 10, 4, 2);
      ctx.fill();
    });

    // ============= BULLET / PLAYER LASER =============
    drawGlow('laserPlayerTexture', 32, (ctx, r) => {
      // Classic Arcade Double-Bullet / Chevron
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 2.0;
      
      // Left barrel bullet
      ctx.beginPath();
      ctx.moveTo(8, r - 6);
      ctx.lineTo(24, r - 6);
      ctx.lineTo(26, r - 4);
      ctx.lineTo(8, r - 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Right barrel bullet
      ctx.beginPath();
      ctx.moveTo(8, r + 4);
      ctx.lineTo(26, r + 4);
      ctx.lineTo(24, r + 6);
      ctx.lineTo(8, r + 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });

    // Sniper Bullet (Yellow needle capsule laser)
    drawGlow('sniperBulletTexture', 32, (ctx, r) => {
      ctx.shadowColor = '#ffea00';
      ctx.shadowBlur = 12;
      ctx.fillStyle = 'rgba(255, 234, 0, 0.4)';
      ctx.strokeStyle = '#ffea00';
      ctx.lineWidth = 1.5;
      
      ctx.beginPath();
      ctx.roundRect(2, r - 2, 28, 4, 2);
      ctx.fill();
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(4, r - 1, 24, 2, 1);
      ctx.fill();
    });

    // ============= BOSS SHIP & BULLET =============

    // Massive Command Warship
    drawGlow('bossTexture', 80, (ctx, r) => {
      ctx.shadowColor = '#9d00ff';
      ctx.shadowBlur = 18;
      ctx.strokeStyle = '#9d00ff';
      ctx.lineWidth = 4.0;
      ctx.fillStyle = 'rgba(157, 0, 255, 0.12)';
      ctx.beginPath();
      const sides = 8;
      for (let i = 0; i < sides; i++) {
        const a = (i / sides) * Math.PI * 2;
        const px = r + Math.cos(a) * 32;
        const py = r + Math.sin(a) * 32;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 12;
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 3.0;
      ctx.beginPath();
      ctx.moveTo(r + 34, r - 10);
      ctx.lineTo(r + 38, r);
      ctx.lineTo(r + 34, r + 10);
      ctx.stroke();

      ctx.shadowColor = '#ff00ff';
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(r, r, 9, 0, Math.PI * 2);
      ctx.fill();
    });

    // Boss Bullet (Heavy purple cylinder laser)
    drawGlow('bossBulletTexture', 36, (ctx, r) => {
      ctx.shadowColor = '#9d00ff';
      ctx.shadowBlur = 14;
      ctx.fillStyle = 'rgba(157, 0, 255, 0.4)';
      ctx.strokeStyle = '#9d00ff';
      ctx.lineWidth = 2.0;
      
      ctx.beginPath();
      ctx.roundRect(4, r - 4.5, 28, 9, 4.5);
      ctx.fill();
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(8, r - 2, 20, 4, 2);
      ctx.fill();
    });

    // ============= WRECKAGE SHARDS =============
    drawGlow('wreckageShard1', 16, (ctx, r) => {
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 4;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.beginPath();
      ctx.moveTo(r, 2);
      ctx.lineTo(14, 12);
      ctx.lineTo(2, 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });

    drawGlow('wreckageShard2', 16, (ctx) => {
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 4;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.beginPath();
      ctx.moveTo(4, 2);
      ctx.lineTo(12, 4);
      ctx.lineTo(10, 14);
      ctx.lineTo(2, 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });

    drawGlow('wreckageShard3', 12, (ctx, r) => {
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 3;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.0;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.beginPath();
      ctx.moveTo(r, 2);
      ctx.lineTo(10, r);
      ctx.lineTo(r, 10);
      ctx.lineTo(2, r);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });

    // ============= INTERACTIVE ASTEROID (SPACE ROCK) =============
    drawGlow('interactiveAsteroidTexture', 64, (ctx, r) => {
      ctx.fillStyle = '#1e2124'; // dark grey rock
      ctx.strokeStyle = '#a855f7'; // purple border
      ctx.lineWidth = 3;
      ctx.shadowColor = '#a855f7';
      ctx.shadowBlur = 10;

      const numPoints = 10;
      const points = [];
      const rBase = 20;
      for (let i = 0; i < numPoints; i++) {
        const angle = (i / numPoints) * Math.PI * 2;
        const radius = rBase + (Math.sin(i * 3.5) * 4) + (Math.cos(i * 4.5) * 2);
        points.push({
          x: r + Math.cos(angle) * radius,
          y: r + Math.sin(angle) * radius
        });
      }
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < numPoints; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Glowing green/cyan energy veins
      ctx.shadowColor = '#00ffcc';
      ctx.shadowBlur = 8;
      ctx.strokeStyle = '#00ffcc';
      ctx.lineWidth = 2;
      
      // Draw small jagged lines across the center
      ctx.beginPath();
      ctx.moveTo(r - 12, r - 5);
      ctx.lineTo(r - 2, r + 4);
      ctx.lineTo(r + 10, r - 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(r - 6, r + 10);
      ctx.lineTo(r + 6, r + 4);
      ctx.lineTo(r + 8, r - 12);
      ctx.stroke();
    });
  }

  /* ==================================================================
     DYNAMIC TEXTURE PROCESSORS
     ================================================================== */

  processChromaKey(sourceKey, destKey, options = {}) {
    // Guard: source must exist and be loaded
    if (!this.textures.exists(sourceKey)) {
      console.warn(`[processChromaKey] Source '${sourceKey}' not loaded, skipping.`);
      return;
    }

    const sourceImg = this.textures.get(sourceKey).getSourceImage();
    let w = (sourceImg && sourceImg.width > 0) ? sourceImg.width : 256;
    let h = (sourceImg && sourceImg.height > 0) ? sourceImg.height : 256;

    if (options.maxWidth && w > options.maxWidth) {
      const scale = options.maxWidth / w;
      w = options.maxWidth;
      h = Math.round(h * scale);
    }
    if (options.maxHeight && h > options.maxHeight) {
      const scale = options.maxHeight / h;
      h = options.maxHeight;
      w = Math.round(w * scale);
    }

    let tex;
    if (this.textures.exists(destKey)) {
      const existing = this.textures.get(destKey);
      // Reuse it only if it is a valid canvas texture (not default)
      if (existing && existing.key !== '__default' && existing.canvas) {
        tex = existing;
      }
    }

    if (!tex) {
      tex = this.textures.createCanvas(destKey, w, h);
    } else {
      // Use the safe Phaser CanvasTexture API to resize
      tex.setSize(w, h);
    }

    if (!tex || !tex.canvas) {
      console.error(`[processChromaKey] Failed to obtain canvas texture for '${destKey}'`);
      return;
    }

    const ctx = tex.context;

    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(sourceImg, 0, 0, w, h);

    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    const tintColor = options.tintColor;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      const brightness = (r + g + b) / 3;
      
      if (brightness > 240) {
        data[i + 3] = 0; // Pure white background
      } else if (brightness > 200) {
        // Feather edge for white outlines
        data[i + 3] = Math.max(0, ((240 - brightness) / 40) * 255);
      } else if (brightness < 18) {
        data[i + 3] = 0; // Pure black background
      } else if (brightness < 50) {
        // Feather edge to prevent black outlines
        data[i + 3] = ((brightness - 18) / 32) * 255;
      }
      
      if (tintColor && data[i + 3] > 0) {
        data[i] = Math.min(255, (r * 0.35) + (tintColor.r * 0.65));
        data[i + 1] = Math.min(255, (g * 0.35) + (tintColor.g * 0.65));
        data[i + 2] = Math.min(255, (b * 0.35) + (tintColor.b * 0.65));
      }
    }
    
    ctx.putImageData(imgData, 0, 0);
    tex.refresh();
  }

  createSniperTexture() {
    if (!this.textures.exists('enemyHunterRaw') || !this.textures.exists('sniperTexture')) return;
    const sourceImg = this.textures.get('enemyHunterRaw').getSourceImage();
    const tex = this.textures.get('sniperTexture');
    
    let baseW = sourceImg.width;
    let baseH = sourceImg.height;
    if (baseW > 72) {
      const scale = 72 / baseW;
      baseW = 72;
      baseH = Math.round(baseH * scale);
    }

    const w = Math.round(baseW * 0.6);
    const h = Math.round(baseH * 1.3);
    
    // Safely update canvas texture dimensions
    tex.setSize(w, h);
    
    const ctx = tex.context;
    
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(sourceImg, 0, 0, w, h);
    
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const brightness = (r + g + b) / 3;
      
      if (brightness > 240) {
        data[i + 3] = 0;
      } else if (brightness > 200) {
        data[i + 3] = Math.max(0, ((240 - brightness) / 40) * 255);
      } else if (brightness < 18) {
        data[i + 3] = 0;
      } else if (brightness < 50) {
        data[i + 3] = ((brightness - 18) / 32) * 255;
      }
      
      if (data[i + 3] > 0) {
        // Gold/Yellow tint overlay
        data[i] = Math.min(255, r * 0.3 + 255 * 0.7);
        data[i + 1] = Math.min(255, g * 0.3 + 220 * 0.7);
        data[i + 2] = Math.min(255, b * 0.3 + 0 * 0.7);
      }
    }
    ctx.putImageData(imgData, 0, 0);
    tex.refresh();
  }

  createBossTexture() {
    if (!this.textures.exists('enemyBomberRaw') || !this.textures.exists('bossTexture')) return;
    const sourceImg = this.textures.get('enemyBomberRaw').getSourceImage();
    const tex = this.textures.get('bossTexture');
    
    let baseW = sourceImg.width;
    let baseH = sourceImg.height;
    if (baseW > 160) {
      const scale = 160 / baseW;
      baseW = 160;
      baseH = Math.round(baseH * scale);
    }
    
    const w = Math.round(baseW * 1.8);
    const h = Math.round(baseH * 1.8);
    
    // Safely update canvas texture dimensions
    tex.setSize(w, h);
    
    const ctx = tex.context;
    
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(sourceImg, w * 0.1, h * 0.2, w * 0.8, h * 0.8); // Center
    ctx.drawImage(sourceImg, 0, h * 0.4, w * 0.4, h * 0.5); // Left secondary
    ctx.drawImage(sourceImg, w * 0.6, h * 0.4, w * 0.4, h * 0.5); // Right secondary
    
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const brightness = (r + g + b) / 3;
      
      if (brightness > 240) {
        data[i + 3] = 0;
      } else if (brightness > 200) {
        data[i + 3] = Math.max(0, ((240 - brightness) / 40) * 255);
      } else if (brightness < 18) {
        data[i + 3] = 0;
      } else if (brightness < 50) {
        data[i + 3] = ((brightness - 18) / 32) * 255;
      }
      
      if (data[i + 3] > 0) {
        // Deep purple/magenta tint overlay
        data[i] = Math.min(255, r * 0.35 + 157 * 0.65);
        data[i + 1] = Math.min(255, g * 0.35 + 0 * 0.65);
        data[i + 2] = Math.min(255, b * 0.35 + 255 * 0.65);
      }
    }
    ctx.putImageData(imgData, 0, 0);
    tex.refresh();
  }

  triggerRepairSurge(x, y) {
    const surgeRing = this.add.circle(x, y, 10, 0x39ff14, 0.05).setDepth(DEPTH.PLAYER_SHIELD);
    surgeRing.setStrokeStyle(3, 0x39ff14, 0.85);
    
    this.tweens.add({
      targets: surgeRing,
      radius: 95,
      alpha: 0,
      duration: 380,
      ease: 'Cubic.easeOut',
      onComplete: () => surgeRing.destroy()
    });

    synthAudio.playPickup('SHIELD'); // Play shield sound for repair ring

    const pushRadius = 95;

    // 1. Repel enemies within range and deal 1 shockwave damage
    if (this.enemies) {
      this.enemies.getChildren().forEach(enemy => {
        if (!enemy.active) return;
        const dist = Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y);
        if (dist < pushRadius) {
          const angle = Phaser.Math.Angle.Between(x, y, enemy.x, enemy.y);
          enemy.setVelocity(Math.cos(angle) * 340, Math.sin(angle) * 340);
          this.effectsManager.hitFlash(enemy);
          
          let hp = enemy.getData('hp') - 1;
          enemy.setData('hp', hp);
          if (hp <= 0) {
            const enemyColor = enemy.getData('color') || 0xff00ff;
            const points = enemy.getData('points') || 10;
            this.effectsManager.enemyDeath(enemy.x, enemy.y, enemyColor);
            synthAudio.playExplosion();
            this.score += points;
            this.enemiesDestroyed += 1;
            this.enemyManager.destroyEnemy(enemy);
          }
        }
      });
    }

    // 2. Repel Boss if active and in range
    if (this.isBossWave && this.bossManager && this.bossManager.boss && this.bossManager.boss.active) {
      const boss = this.bossManager.boss;
      const dist = Phaser.Math.Distance.Between(x, y, boss.x, boss.y);
      if (dist < pushRadius) {
        const angle = Phaser.Math.Angle.Between(x, y, boss.x, boss.y);
        if (boss.body) {
          boss.body.velocity.x += Math.cos(angle) * 140;
          boss.body.velocity.y += Math.sin(angle) * 140;
        }
      }
    }
  }

  updatePlayerLocator(time) {
    if (!this.player || !this.player.active) {
      if (this.playerLocatorReticle) this.playerLocatorReticle.clear();
      return;
    }

    const { x, y } = this.player;
    this.playerLocatorReticle.clear();

    const t = time / 1000;
    
    // Rotating outer reticle ring — scaled for 72px hero ship
    const numDashes = 16;
    const radius = 46;
    const angleStep = (Math.PI * 2) / numDashes;
    const currentRot = t * 1.2;

    this.playerLocatorReticle.lineStyle(1.8, this.shipTint, 0.5);
    
    for (let i = 0; i < numDashes; i++) {
      const startAngle = i * angleStep + currentRot;
      const endAngle = startAngle + (angleStep * 0.45);
      
      const x1 = x + Math.cos(startAngle) * radius;
      const y1 = y + Math.sin(startAngle) * radius;
      const x2 = x + Math.cos(endAngle) * radius;
      const y2 = y + Math.sin(endAngle) * radius;
      
      this.playerLocatorReticle.beginPath();
      this.playerLocatorReticle.moveTo(x1, y1);
      this.playerLocatorReticle.lineTo(x2, y2);
      this.playerLocatorReticle.strokePath();
    }

    // Inner pulsing circular beacon
    const pulseRad = 36 + Math.sin(t * 7) * 4;
    this.playerLocatorReticle.lineStyle(1.2, this.shipTint, 0.25);
    this.playerLocatorReticle.strokeCircle(x, y, pulseRad);

    // Crosshair tick lines pointing outward
    this.playerLocatorReticle.lineStyle(1.5, this.shipTint, 0.55);
    const tickLen = 7;
    const gap = radius + 3;
    const angles = [0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2];
    angles.forEach((angle) => {
      const x1 = x + Math.cos(angle) * gap;
      const y1 = y + Math.sin(angle) * gap;
      const x2 = x + Math.cos(angle) * (gap + tickLen);
      const y2 = y + Math.sin(angle) * (gap + tickLen);
      this.playerLocatorReticle.beginPath();
      this.playerLocatorReticle.moveTo(x1, y1);
      this.playerLocatorReticle.lineTo(x2, y2);
      this.playerLocatorReticle.strokePath();
    });

    // Floating Holographic Crown — floats ahead of the ship nose
    const rad = this.player.getData('fireAngle') || (this.player.rotation - Math.PI / 2);
    const crownDist = 44;
    const crownX = x + Math.cos(rad) * crownDist;
    const crownY = y + Math.sin(rad) * crownDist;

    const fX = Math.cos(rad);
    const fY = Math.sin(rad);
    const pX = -Math.sin(rad);
    const pY = Math.cos(rad);

    this.playerLocatorReticle.lineStyle(1.8, this.shipTint, 0.7);
    this.playerLocatorReticle.fillStyle(this.shipTint, 0.15);
    
    const vertices = [
      { x: crownX - pX * 10, y: crownY - pY * 10 },
      { x: crownX - pX * 12 + fX * 8, y: crownY - pY * 12 + fY * 8 },
      { x: crownX - pX * 5 + fX * 3, y: crownY - pY * 5 + fY * 3 },
      { x: crownX + fX * 11, y: crownY + fY * 11 },
      { x: crownX + pX * 5 + fX * 3, y: crownY + pY * 5 + fY * 3 },
      { x: crownX + pX * 12 + fX * 8, y: crownY + pY * 12 + fY * 8 },
      { x: crownX + pX * 10, y: crownY + pY * 10 }
    ];

    this.playerLocatorReticle.beginPath();
    this.playerLocatorReticle.moveTo(vertices[0].x, vertices[0].y);
    for (let i = 1; i < vertices.length; i++) {
      this.playerLocatorReticle.lineTo(vertices[i].x, vertices[i].y);
    }
    this.playerLocatorReticle.closePath();
    this.playerLocatorReticle.fillPath();
    this.playerLocatorReticle.strokePath();

    // Gold gem pulsing in front of crown
    this.playerLocatorReticle.fillStyle(0xffea00, 0.9);
    const gemX = crownX + fX * 18 + Math.cos(t * 5) * 1.5 * fX;
    const gemY = crownY + fY * 18 + Math.sin(t * 5) * 1.5 * fY;
    this.playerLocatorReticle.fillCircle(gemX, gemY, 2.8);
  }

  /* ==================================================================
     WEAPON SYNERGIES
     ================================================================== */

  firePlasmaLightning(startX, startY, angle) {
    this.effectsManager.muzzleFlash(startX, startY, angle, 0x00f0ff);
    const recoilForce = 3.5;
    this.player.x -= Math.cos(angle) * recoilForce;
    this.player.y -= Math.sin(angle) * recoilForce;

    [-1, 1].forEach((side) => {
      const b = this.bullets.create(startX, startY, 'bulletTexture');
      b.setDepth(DEPTH.BULLET);
      b.setRotation(angle);
      b.setBlendMode(Phaser.BlendModes.ADD);
      b.setScale(1.2);
      b.setTint(side === 1 ? 0x00f0ff : 0xffea00);
      
      b.setData('isHelix', true);
      b.setData('helixAngle', angle);
      b.setData('helixPhase', 0);
      b.setData('helixSide', side);
      b.setData('helixSpeed', 520);
      b.setData('helixAmp', 140);
      b.setData('helixFreq', 0.15);
      b.setData('damage', 2.0);
      b.setData('isPlasmaLightning', true);

      const trail = this.add.particles(0, 0, 'bulletTexture', {
        speed: 0,
        scale: { start: 1.1, end: 0.1 },
        alpha: { start: 0.6, end: 0 },
        lifespan: 140,
        frequency: 15,
        blendMode: 'ADD',
        follow: b,
        particleTint: side === 1 ? 0x00f0ff : 0xffea00
      });
      trail.setDepth(DEPTH.BULLET - 1);
      b.setData('trail', trail);
    });
  }

  fireSupernovaBlast(startX, startY, angle) {
    this.effectsManager.muzzleFlash(startX, startY, angle, 0xff5500);
    this.player.x -= Math.cos(angle) * 15;
    this.player.y -= Math.sin(angle) * 15;

    const b = this.bullets.create(startX, startY, 'bulletTexture');
    b.setDepth(DEPTH.BULLET);
    b.setRotation(angle);
    b.setBlendMode(Phaser.BlendModes.ADD);
    b.setScale(2.2);
    b.setTint(0xff5500);
    
    const vel = 220;
    b.setVelocity(Math.cos(angle) * vel, Math.sin(angle) * vel);
    b.setData('damage', 5.0);
    b.setData('isSupernova', true);

    const trail = this.add.particles(0, 0, 'bulletTexture', {
      speed: 0,
      scale: { start: 2.2, end: 0.1 },
      alpha: { start: 0.7, end: 0 },
      lifespan: 250,
      frequency: 12,
      blendMode: 'ADD',
      follow: b,
      particleTint: 0xff5500
    });
    trail.setDepth(DEPTH.BULLET - 1);
    b.setData('trail', trail);
  }

  fireLotusBlossom(startX, startY, angle) {
    this.effectsManager.muzzleFlash(startX, startY, angle, 0xff00ff);
    const recoilForce = 3.5;
    this.player.x -= Math.cos(angle) * recoilForce;
    this.player.y -= Math.sin(angle) * recoilForce;

    this.lotusRotation += 0.15;
    const baseAngle = angle + this.lotusRotation;

    for (let i = 0; i < 4; i++) {
      const shotAngle = baseAngle + (i * Math.PI / 2);
      const b = this.bullets.create(startX, startY, 'laserPlayerTexture');
      b.setDepth(DEPTH.BULLET);
      b.setRotation(shotAngle);
      b.setBlendMode(Phaser.BlendModes.ADD);
      b.setScale(1.1);
      
      const tint = i % 2 === 0 ? 0xff00ff : 0xffea00;
      b.setTint(tint);

      const vel = 480;
      b.setVelocity(Math.cos(shotAngle) * vel, Math.sin(shotAngle) * vel);
      b.setData('damage', 1.5);

      const trail = this.add.particles(0, 0, 'laserPlayerTexture', {
        speed: 0,
        scale: { start: 1.0, end: 0.1 },
        alpha: { start: 0.5, end: 0 },
        lifespan: 120,
        frequency: 18,
        blendMode: 'ADD',
        follow: b,
        particleTint: tint
      });
      trail.setDepth(DEPTH.BULLET - 1);
      b.setData('trail', trail);
    }
  }

  fireGravitySingularity(startX, startY, angle) {
    this.effectsManager.muzzleFlash(startX, startY, angle, 0x9d00ff);
    const recoilForce = 4.0;
    this.player.x -= Math.cos(angle) * recoilForce;
    this.player.y -= Math.sin(angle) * recoilForce;

    const b = this.bullets.create(startX, startY, 'bulletTexture');
    b.setDepth(DEPTH.BULLET);
    b.setRotation(angle);
    b.setBlendMode(Phaser.BlendModes.ADD);
    b.setScale(1.4);
    b.setTint(0x9d00ff);

    const vel = 380;
    b.setVelocity(Math.cos(angle) * vel, Math.sin(angle) * vel);
    b.setData('damage', 1.8);
    b.setData('isGravitySingularity', true);

    const trail = this.add.particles(0, 0, 'bulletTexture', {
      speed: 0,
      scale: { start: 1.4, end: 0.1 },
      alpha: { start: 0.6, end: 0 },
      lifespan: 180,
      frequency: 14,
      blendMode: 'ADD',
      follow: b,
      particleTint: 0x9d00ff
    });
    trail.setDepth(DEPTH.BULLET - 1);
    b.setData('trail', trail);
  }

  fireAegisShards(startX, startY, angle) {
    this.effectsManager.muzzleFlash(startX, startY, angle, 0x00f0ff);
    const recoilForce = 3.5;
    this.player.x -= Math.cos(angle) * recoilForce;
    this.player.y -= Math.sin(angle) * recoilForce;

    const numShards = 5;
    const spreadAngle = 0.5;
    const startAngle = angle - spreadAngle / 2;
    const stepAngle = spreadAngle / (numShards - 1);

    for (let i = 0; i < numShards; i++) {
      const shardAngle = startAngle + i * stepAngle;
      const b = this.bullets.create(startX, startY, 'wreckageShard1');
      b.setDepth(DEPTH.BULLET);
      b.setRotation(shardAngle);
      b.setBlendMode(Phaser.BlendModes.ADD);
      b.setScale(1.4);
      b.setTint(0x00f0ff);
      // Removed collideWorldBounds and setBounce
      b.setData('isAegisShard', true);
      b.setData('bounces', 0);
      b.setData('damage', 1.5);

      const vel = 450;
      b.setVelocity(Math.cos(shardAngle) * vel, Math.sin(shardAngle) * vel);

      const trail = this.add.particles(0, 0, 'wreckageShard1', {
        speed: 0,
        scale: { start: 1.2, end: 0.1 },
        alpha: { start: 0.5, end: 0 },
        lifespan: 160,
        frequency: 16,
        blendMode: 'ADD',
        follow: b,
        particleTint: 0x00f0ff
      });
      trail.setDepth(DEPTH.BULLET - 1);
      b.setData('trail', trail);
    }
  }

  /* ==================================================================
     COLLISION/SYNERGY HANDLERS
     ================================================================== */

  triggerLightningChain(x, y, initialEnemy) {
    synthAudio.playLightningSpark();
    let targets = [];
    let minDist = 160;
    this.enemies.getChildren().forEach((e) => {
      if (!e.active || e === initialEnemy) return;
      const dist = Phaser.Math.Distance.Between(x, y, e.x, e.y);
      if (dist < minDist) {
        targets.push({ enemy: e, dist: dist });
      }
    });
    this.interactiveAsteroids.getChildren().forEach((ast) => {
      if (!ast.active || ast === initialEnemy) return;
      const dist = Phaser.Math.Distance.Between(x, y, ast.x, ast.y);
      if (dist < minDist) {
        targets.push({ enemy: ast, dist: dist });
      }
    });

    targets.sort((a, b) => a.dist - b.dist);
    targets = targets.slice(0, 3);

    let prevX = x;
    let prevY = y;
    
    targets.forEach((t) => {
      const nextEnemy = t.enemy;
      const targetX = nextEnemy.x;
      const targetY = nextEnemy.y;

      const lightning = this.add.graphics().setDepth(DEPTH.BULLET + 1);
      lightning.lineStyle(2, 0x00f0ff, 0.95);
      lightning.beginPath();
      lightning.moveTo(prevX, prevY);
      
      const numSegments = 5;
      for (let i = 1; i < numSegments; i++) {
        const tRatio = i / numSegments;
        const baseX = prevX + (targetX - prevX) * tRatio;
        const baseY = prevY + (targetY - prevY) * tRatio;
        const offset = 8;
        const currentX = baseX + Phaser.Math.Between(-offset, offset);
        const currentY = baseY + Phaser.Math.Between(-offset, offset);
        lightning.lineTo(currentX, currentY);
      }
      lightning.lineTo(targetX, targetY);
      lightning.strokePath();

      this.tweens.add({
        targets: lightning,
        alpha: 0,
        duration: 80,
        onComplete: () => lightning.destroy()
      });

      let hp = nextEnemy.getData('hp') - 1.5;
      nextEnemy.setData('hp', hp);
      this.effectsManager.hitFlash(nextEnemy);
      this.effectsManager.bulletHit(targetX, targetY, 0x00f0ff);
      
      if (hp <= 0) {
        const enemyColor = nextEnemy.getData('color') || 0xff00ff;
        const points = nextEnemy.getData('points') || 10;
        this.effectsManager.enemyDeath(nextEnemy.x, nextEnemy.y, enemyColor);
        this.spawnWreckageDebris(nextEnemy.x, nextEnemy.y, enemyColor);
        synthAudio.playExplosion();

        if (nextEnemy.texture && nextEnemy.texture.key === 'interactiveAsteroidTexture') {
          if (Math.random() < 0.30) {
            this.collectibleManager.spawnUnbrokenGem(nextEnemy.x, nextEnemy.y, null, false);
          } else {
            for (let j = 0; j < 2; j++) {
              this.collectibleManager.spawnEnergyFragment(nextEnemy.x, nextEnemy.y);
            }
          }
          nextEnemy.destroy();
        } else {
          this.score += points;
          this.enemiesDestroyed += 1;
          this.enemyManager.destroyEnemy(nextEnemy);
          this.collectibleManager.tryDropFromEnemy(nextEnemy.x, nextEnemy.y, this.wave);
          this.checkWaveProgress();
        }
      }

      prevX = targetX;
      prevY = targetY;
    });
  }

  triggerSupernovaSplash(x, y) {
    synthAudio.playExplosion();
    const ring = this.add.circle(x, y, 10, 0xff5500, 0.15).setDepth(DEPTH.BULLET + 1);
    ring.setStrokeStyle(4, 0xffea00, 0.85);
    this.tweens.add({
      targets: ring,
      radius: 120,
      alpha: 0,
      duration: 350,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy()
    });

    this.cameras.main.shake(150, 0.008);

    this.enemies.getChildren().forEach((e) => {
      if (!e.active) return;
      const dist = Phaser.Math.Distance.Between(x, y, e.x, e.y);
      if (dist < 120) {
        const damage = 3.0;
        let hp = e.getData('hp') - damage;
        e.setData('hp', hp);
        this.effectsManager.hitFlash(e);
        this.effectsManager.bulletHit(e.x, e.y, 0xff5500);

        if (hp <= 0) {
          const enemyColor = e.getData('color') || 0xff00ff;
          const points = e.getData('points') || 10;
          this.effectsManager.enemyDeath(e.x, e.y, enemyColor);
          this.spawnWreckageDebris(e.x, e.y, enemyColor);
          this.score += points;
          this.enemiesDestroyed += 1;
          this.enemyManager.destroyEnemy(e);
          this.collectibleManager.tryDropFromEnemy(e.x, e.y, this.wave);
          this.checkWaveProgress();
        }
      }
    });

    this.interactiveAsteroids.getChildren().forEach((ast) => {
      if (!ast.active) return;
      const dist = Phaser.Math.Distance.Between(x, y, ast.x, ast.y);
      if (dist < 120) {
        const damage = 3.0;
        let hp = ast.getData('hp') - damage;
        ast.setData('hp', hp);
        this.effectsManager.hitFlash(ast);
        this.effectsManager.bulletHit(ast.x, ast.y, 0xff5500);

        if (hp <= 0) {
          this.effectsManager.enemyDeath(ast.x, ast.y, 0xa855f7);
          this.spawnWreckageDebris(ast.x, ast.y, 0xa855f7);
          
          if (Math.random() < 0.30) {
            this.collectibleManager.spawnUnbrokenGem(ast.x, ast.y, null, false);
          } else {
            for (let j = 0; j < 2; j++) {
              this.collectibleManager.spawnEnergyFragment(ast.x, ast.y);
            }
          }
          ast.destroy();
        }
      }
    });
  }

  triggerGravitySingularityVortex(x, y) {
    synthAudio.playBlackHoleHum();
    const vortex = this.add.graphics().setDepth(DEPTH.BULLET - 1);
    const singularity = {
      x: x,
      y: y,
      elapsed: 0,
      duration: 1200,
      graphics: vortex
    };
    this.gravitySingularities.push(singularity);
  }

  updateGravitySingularities(time, delta) {
    for (let i = this.gravitySingularities.length - 1; i >= 0; i--) {
      const s = this.gravitySingularities[i];
      s.elapsed += delta;

      if (s.elapsed >= s.duration) {
        s.graphics.destroy();
        this.gravitySingularities.splice(i, 1);
        continue;
      }

      s.graphics.clear();
      const lifeRatio = 1.0 - (s.elapsed / s.duration);
      const radius = 160 * lifeRatio;
      const currentRot = (s.elapsed / 1000) * 8.0;

      s.graphics.fillStyle(0x9d00ff, 0.08 * lifeRatio);
      s.graphics.fillCircle(s.x, s.y, radius);

      s.graphics.lineStyle(2.5, 0xff00ff, 0.6 * lifeRatio);
      const numArms = 3;
      for (let j = 0; j < numArms; j++) {
        s.graphics.beginPath();
        const baseAngle = currentRot + (j / numArms) * Math.PI * 2;
        s.graphics.moveTo(s.x, s.y);
        
        const numSteps = 12;
        for (let k = 1; k <= numSteps; k++) {
          const stepRatio = k / numSteps;
          const armAngle = baseAngle + stepRatio * 2.5;
          const armRadius = radius * stepRatio;
          s.graphics.lineTo(
            s.x + Math.cos(armAngle) * armRadius,
            s.y + Math.sin(armAngle) * armRadius
          );
        }
        s.graphics.strokePath();
      }

      s.graphics.fillStyle(0x000000, 0.95);
      s.graphics.fillCircle(s.x, s.y, 22 * lifeRatio);
      s.graphics.lineStyle(1.5, 0x9d00ff, 0.8 * lifeRatio);
      s.graphics.strokeCircle(s.x, s.y, 22 * lifeRatio);

      const pullRadius = 160;
      this.enemies.getChildren().forEach((enemy) => {
        if (!enemy.active) return;
        const dist = Phaser.Math.Distance.Between(s.x, s.y, enemy.x, enemy.y);
        if (dist < pullRadius) {
          const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, s.x, s.y);
          const pullForce = (1.0 - (dist / pullRadius)) * 260;
          if (enemy.body) {
            enemy.body.velocity.x += Math.cos(angle) * pullForce * (delta / 1000) * 60;
            enemy.body.velocity.y += Math.sin(angle) * pullForce * (delta / 1000) * 60;
          }

          const lastTick = enemy.getData('lastSingularityTick') || 0;
          if (time - lastTick > 150) {
            enemy.setData('lastSingularityTick', time);
            let hp = enemy.getData('hp') - 0.45;
            enemy.setData('hp', hp);
            this.effectsManager.hitFlash(enemy);
            
            if (hp <= 0) {
              const enemyColor = enemy.getData('color') || 0xff00ff;
              const points = enemy.getData('points') || 10;
              this.effectsManager.enemyDeath(enemy.x, enemy.y, enemyColor);
              this.spawnWreckageDebris(enemy.x, enemy.y, enemyColor);
              synthAudio.playExplosion();
              this.score += points;
              this.enemiesDestroyed += 1;
              this.enemyManager.destroyEnemy(enemy);
              this.collectibleManager.tryDropFromEnemy(enemy.x, enemy.y, this.wave);
              this.checkWaveProgress();
            }
          }
        }
      });

      this.interactiveAsteroids.getChildren().forEach((ast) => {
        if (!ast.active) return;
        const dist = Phaser.Math.Distance.Between(s.x, s.y, ast.x, ast.y);
        if (dist < pullRadius) {
          const angle = Phaser.Math.Angle.Between(ast.x, ast.y, s.x, s.y);
          const pullForce = (1.0 - (dist / pullRadius)) * 260;
          if (ast.body) {
            ast.body.velocity.x += Math.cos(angle) * pullForce * (delta / 1000) * 60;
            ast.body.velocity.y += Math.sin(angle) * pullForce * (delta / 1000) * 60;
          }

          const lastTick = ast.getData('lastSingularityTick') || 0;
          if (time - lastTick > 150) {
            ast.setData('lastSingularityTick', time);
            let hp = ast.getData('hp') - 0.45;
            ast.setData('hp', hp);
            this.effectsManager.hitFlash(ast);
            
            if (hp <= 0) {
              this.effectsManager.enemyDeath(ast.x, ast.y, 0xa855f7);
              this.spawnWreckageDebris(ast.x, ast.y, 0xa855f7);
              synthAudio.playExplosion();

              if (Math.random() < 0.30) {
                this.collectibleManager.spawnUnbrokenGem(ast.x, ast.y, null, false);
              } else {
                for (let j = 0; j < 2; j++) {
                  this.collectibleManager.spawnEnergyFragment(ast.x, ast.y);
                }
              }
              ast.destroy();
            }
          }
        }
      });
    }
  }

  /* ==================================================================
     INTERACTIVE ASTEROIDS & DEBRIS PHYSICS
     ================================================================== */

  spawnInitialAsteroids() {
    for (let i = 0; i < 7; i++) {
      let x = Phaser.Math.Between(100, this.ARENA_SIZE - 100);
      let y = Phaser.Math.Between(100, this.ARENA_SIZE - 100);
      
      while (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < 250) {
        x = Phaser.Math.Between(100, this.ARENA_SIZE - 100);
        y = Phaser.Math.Between(100, this.ARENA_SIZE - 100);
      }
      this.spawnInteractiveAsteroid(x, y);
    }
  }

  spawnInteractiveAsteroid(x, y) {
    if (this.interactiveAsteroids.getLength() >= 12) return;

    if (x === undefined || y === undefined) {
      const cam = this.cameras.main;
      const padding = 80;
      const edge = Phaser.Math.Between(0, 3);
      if (edge === 0) {
        x = Phaser.Math.Between(cam.worldView.left - padding, cam.worldView.right + padding);
        y = cam.worldView.top - padding;
      } else if (edge === 1) {
        x = Phaser.Math.Between(cam.worldView.left - padding, cam.worldView.right + padding);
        y = cam.worldView.bottom + padding;
      } else if (edge === 2) {
        x = cam.worldView.left - padding;
        y = Phaser.Math.Between(cam.worldView.top - padding, cam.worldView.bottom + padding);
      } else {
        x = cam.worldView.right + padding;
        y = Phaser.Math.Between(cam.worldView.top - padding, cam.worldView.bottom + padding);
      }
    }

    x = Phaser.Math.Clamp(x, 40, this.ARENA_SIZE - 40);
    y = Phaser.Math.Clamp(y, 40, this.ARENA_SIZE - 40);

    const rock = this.interactiveAsteroids.create(x, y, 'interactiveAsteroidTexture');
    rock.setDepth(DEPTH.PLAYER - 1);
    rock.setCircle(22, 10, 10);
    rock.setBounce(0.85);
    rock.setDamping(true);
    rock.setDrag(0.02);
    rock.setScale(1.0);
    rock.setData('hp', 6);
    rock.setData('rotSpeed', Phaser.Math.FloatBetween(-1.2, 1.2));
    
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const speed = Phaser.Math.FloatBetween(30, 80);
    rock.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
  }

  handlePlayerAsteroidCollision(player, asteroid) {
    if (this.isCombatFrozen) return;
    if (this.health <= 0 || !asteroid.active || this.isBossIntroActive) return;
    if (this.postDamageInvulnTimeRemaining > 0) return;
    if (this.isInvulnerable) return;

    if (this.isShielded) {
      const angle = Phaser.Math.Angle.Between(player.x, player.y, asteroid.x, asteroid.y);
      asteroid.setVelocity(Math.cos(angle) * 350, Math.sin(angle) * 350);
      return;
    }

    const damage = 4.0;
    this.health = Math.max(0, this.health - damage);
    this.lastDamageTime = this.time.now;
    this.postDamageInvulnTimeRemaining = 600;

    this.effectsManager.playerDamage();
    synthAudio.playDamage();

    const bounceAngle = Phaser.Math.Angle.Between(player.x, player.y, asteroid.x, asteroid.y);
    asteroid.setVelocity(Math.cos(bounceAngle) * 200, Math.sin(bounceAngle) * 200);

    this.dispatchMetricsToReact();

    if (this.health <= 0) {
      this.handleGameOver();
    }
  }

  handleBulletAsteroidCollision(bullet, asteroid) {
    if (this.isCombatFrozen) return;
    if (!bullet.active || !asteroid.active) return;

    const bulletDamage = bullet.getData('damage') || 1;
    const trail = bullet.getData('trail');
    
    const bx = bullet.x;
    const by = bullet.y;

    if (bullet.getData('isPlasmaLightning')) {
      this.triggerLightningChain(bx, by, asteroid);
    } else if (bullet.getData('isSupernova')) {
      this.triggerSupernovaSplash(bx, by);
    } else if (bullet.getData('isGravitySingularity')) {
      this.triggerGravitySingularityVortex(bx, by);
    } else if (bullet.getData('isAegisShard')) {
      if (trail) trail.destroy();
      this.spawnWreckageDebris(bullet.x, bullet.y, 0x00f0ff);
      bullet.destroy();
    } else {
      if (trail) trail.destroy();
      bullet.destroy();
    }

    let hp = asteroid.getData('hp') - bulletDamage;
    asteroid.setData('hp', hp);

    this.effectsManager.bulletHit(bx, by, 0xa855f7);
    this.effectsManager.hitFlash(asteroid);
    synthAudio.playHit();

    this.hitStopTimeRemaining = 25;

    if (hp <= 0) {
      this.effectsManager.enemyDeath(asteroid.x, asteroid.y, 0xa855f7);
      this.spawnWreckageDebris(asteroid.x, asteroid.y, 0xa855f7);
      synthAudio.playExplosion();

      // Drop loot: 30% Gem Container, 70% 2 Energy Fragments
      if (Math.random() < 0.30) {
        this.collectibleManager.spawnUnbrokenGem(asteroid.x, asteroid.y, null, false);
      } else {
        for (let i = 0; i < 2; i++) {
          this.collectibleManager.spawnEnergyFragment(asteroid.x, asteroid.y);
        }
      }

      asteroid.destroy();
    }
  }

  spawnWreckageDebris(x, y, color) {
    const numShards = Phaser.Math.Between(3, 6);
    for (let i = 0; i < numShards; i++) {
      const shardType = Phaser.Utils.Array.GetRandom(['wreckageShard1', 'wreckageShard2', 'wreckageShard3']);
      const shard = this.debrisGroup.create(x, y, shardType);
      shard.setDepth(DEPTH.PLAYER_TRAIL);
      shard.setTint(color || 0xffffff);
      shard.setCollideWorldBounds(true);
      shard.setBounce(0.55);
      shard.setDamping(true);
      shard.setDrag(0.03);

      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const speed = Phaser.Math.FloatBetween(60, 180);
      shard.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
      shard.setAngularVelocity(Phaser.Math.FloatBetween(-180, 180));

      this.tweens.add({
        targets: shard,
        alpha: 0,
        duration: Phaser.Math.Between(1500, 2500),
        onComplete: () => {
          shard.destroy();
        }
      });
    }
  }
}

