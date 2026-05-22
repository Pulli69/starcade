import Phaser from 'phaser';
import { DEPTH } from './BoostManager';

/**
 * EffectsManager System
 *
 * Centralizes all visual game feel effects:
 * - Screen shake on hits
 * - Particle explosions (enemy death, pickup burst)
 * - Floating score/status text
 * - Hit flash on enemies
 * - Wave announcements
 * - Screen pulse
 * - Healing spiral particles
 *
 * Performance:
 * - Shared particle emitters with dynamic tinting
 * - Text object pool with max limit
 * - Collision guard checks before any operation
 */
export default class EffectsManager {
  constructor(scene) {
    this.scene = scene;
    this.floatingTexts = [];
    this.maxTexts = 20;
  }

  create() {
    const { scene } = this;

    // Main explosion emitter (reused for death, pickups, etc.)
    this.explosionEmitter = scene.add.particles(0, 0, 'sparkTexture', {
      speed: { min: 80, max: 220 },
      angle: { min: 0, max: 360 },
      scale: { start: 1.0, end: 0 },
      alpha: { start: 1.0, end: 0 },
      lifespan: { min: 300, max: 700 },
      gravityY: 0,
      quantity: 10,
      emitting: false,
      blendMode: 'ADD',
    });
    this.explosionEmitter.setDepth(DEPTH.EFFECT_BURST);

    // Pickup burst emitter (smaller, upward float)
    this.pickupEmitter = scene.add.particles(0, 0, 'sparkTexture', {
      speed: { min: 50, max: 150 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.8, end: 0 },
      alpha: { start: 0.9, end: 0 },
      lifespan: { min: 200, max: 500 },
      gravityY: -20,
      quantity: 8,
      emitting: false,
      blendMode: 'ADD',
    });
    this.pickupEmitter.setDepth(DEPTH.EFFECT_BURST);
  }

  update() {
    // Clean up destroyed floating texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      if (!this.floatingTexts[i].active) {
        this.floatingTexts[i].destroy();
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  // =============================================================
  // ENEMY DEATH
  // =============================================================
  enemyDeath(x, y, color = 0xff00ff) {
    const { scene } = this;

    // Screen shake (stronger)
    scene.cameras.main.shake(120, 0.008);

    // Colored particle burst
    this.explosionEmitter.setParticleTint(color);
    this.explosionEmitter.emitParticleAt(x, y, 20);

    // White spark overlay
    this.explosionEmitter.setParticleTint(0xffffff);
    this.explosionEmitter.emitParticleAt(x, y, 10);

    // Spawn physical wreckage debris
    if (typeof scene.spawnWreckageDebris === 'function') {
      scene.spawnWreckageDebris(x, y, color);
    }

    // Rapid expanding shockwave ring
    const ring = scene.add.circle(x, y, 5, color, 0.85).setDepth(DEPTH.EFFECT_RING);
    ring.setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({
      targets: ring,
      scale: 6,
      alpha: 0,
      duration: 350,
      ease: 'Quad.easeOut',
      onComplete: () => ring.destroy()
    });
  }

  bulletCancel(x, y) {
    this.explosionEmitter.setParticleTint(0x9d00ff);
    this.explosionEmitter.emitParticleAt(x, y, 8);
  }

  // =============================================================
  // MUZZLE FLASH
  // =============================================================
  muzzleFlash(x, y, angle, color = 0x00f0ff) {
    const { scene } = this;
    
    // Quick expanding circle at muzzle position
    const flash = scene.add.circle(x, y, 4, color, 0.95).setDepth(DEPTH.EFFECT_BURST);
    flash.setBlendMode(Phaser.BlendModes.ADD);
    
    scene.tweens.add({
      targets: flash,
      radius: 16,
      alpha: 0,
      duration: 100,
      ease: 'Sine.easeOut',
      onComplete: () => flash.destroy()
    });

    // Small spark spurt along the angle
    for (let i = 0; i < 3; i++) {
      const sp = scene.add.circle(
        x, y, 
        Phaser.Math.FloatBetween(1.5, 3), 
        0xffffff, 
        1.0
      ).setDepth(DEPTH.EFFECT_BURST);
      sp.setBlendMode(Phaser.BlendModes.ADD);
      
      const speed = Phaser.Math.FloatBetween(60, 140);
      const dev = Phaser.Math.FloatBetween(-0.25, 0.25);
      const vx = Math.cos(angle + dev) * speed;
      const vy = Math.sin(angle + dev) * speed;
      
      scene.physics.add.existing(sp);
      sp.body.setVelocity(vx, vy);
      
      scene.tweens.add({
        targets: sp,
        scale: 0.1,
        alpha: 0,
        duration: Phaser.Math.Between(150, 300),
        onComplete: () => sp.destroy()
      });
    }
  }

  // =============================================================
  // PLAYER DAMAGE
  // =============================================================
  playerDamage() {
    const { scene } = this;
    scene.cameras.main.flash(150, 255, 0, 50, 0.4);
    scene.cameras.main.shake(100, 0.008);
  }

  // =============================================================
  // GEM SHATTER EXPLOSION
  // =============================================================
  emitGemShatter(x, y) {
    // Faint screen shake
    this.scene.cameras.main.shake(100, 0.005);

    // Green explosion particles
    this.explosionEmitter.setParticleTint(0x39ff14);
    this.explosionEmitter.emitParticleAt(x, y, 16);

    // Glowing white sparks overlay
    this.explosionEmitter.setParticleTint(0xffffff);
    this.explosionEmitter.emitParticleAt(x, y, 8);
  }

  // =============================================================
  // PICKUP BURST
  // =============================================================
  emitPickupBurst(x, y, type) {
    const { scene } = this;

    const colorMap = {
      'HEAL': 0x39ff14,
      'SHIELD': 0x00f0ff,
      'RAPID': 0xffea00,
      'TITAN': 0xff6600,
      'MULTI_SHOT': 0xff00ff,
      'PHASE_DASH': 0x00f0ff,
      'VOID_STORM': 0x9d00ff,
    };

    const color = colorMap[type] || 0x39ff14;

    this.pickupEmitter.setParticleTint(color);
    this.pickupEmitter.emitParticleAt(x, y, 12);

    // Expanding glow ring
    const ring = scene.add.circle(x, y, 5, color, 0.6)
      .setDepth(DEPTH.EFFECT_RING);
    scene.tweens.add({
      targets: ring,
      scale: 4,
      alpha: 0,
      duration: 350,
      ease: 'Sine.easeOut',
      onComplete: () => ring.destroy(),
    });
  }

  // =============================================================
  // FLOATING TEXT
  // =============================================================
  showFloatingText(x, y, text, color = '#ffffff', size = '14px') {
    const { scene } = this;

    if (this.floatingTexts.length >= this.maxTexts) {
      const oldest = this.floatingTexts.shift();
      if (oldest) oldest.destroy();
    }

    const floatingText = scene.add.text(x, y - 10, text, {
      fontFamily: '"Press Start 2P"',
      fontSize: size,
      color: color,
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(DEPTH.EFFECT_FLOATING_TEXT);

    this.floatingTexts.push(floatingText);

    scene.tweens.add({
      targets: floatingText,
      y: y - 60,
      alpha: 0,
      duration: 1000,
      ease: 'Sine.easeOut',
      onComplete: () => {
        floatingText.destroy();
        const idx = this.floatingTexts.indexOf(floatingText);
        if (idx > -1) this.floatingTexts.splice(idx, 1);
      },
    });
  }

  // =============================================================
  // HIT FLASH
  // =============================================================
  hitFlash(enemy) {
    if (!enemy.active) return;
    enemy.setTint(0xffffff);
    this.scene.time.delayedCall(60, () => {
      if (enemy.active) enemy.clearTint();
    });
  }

  // =============================================================
  // BULLET HIT SPARK EXPLOSION
  // =============================================================
  bulletHit(x, y, color = 0xffffff) {
    this.explosionEmitter.setParticleTint(color);
    this.explosionEmitter.emitParticleAt(x, y, 4);
  }


  // =============================================================
  // SHIELD DEFLECT
  // =============================================================
  shieldDeflect(x, y) {
    const { scene } = this;
    
    // Emit green sparks
    this.explosionEmitter.setParticleTint(0x39ff14);
    this.explosionEmitter.emitParticleAt(x, y, 6);

    // Glowing green ring
    const ring = scene.add.circle(x, y, 5, 0x39ff14, 0.8).setDepth(DEPTH.EFFECT_RING);
    ring.setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({
      targets: ring,
      scale: 3.5,
      alpha: 0,
      duration: 200,
      ease: 'Quad.easeOut',
      onComplete: () => ring.destroy()
    });
  }

  // =============================================================
  // WAVE ANNOUNCEMENT
  // =============================================================
  showWaveAnnouncement(wave) {
    const { scene } = this;
    const text = scene.add.text(
      scene.cameras.main.scrollX + scene.cameras.main.width / 2,
      scene.cameras.main.scrollY + scene.cameras.main.height / 2,
      `WAVE ${wave}`,
      {
        fontFamily: '"Press Start 2P"',
        fontSize: '32px',
        color: '#ffea00',
        stroke: '#9d00ff',
        strokeThickness: 5,
      }
    ).setOrigin(0.5).setDepth(DEPTH.UI_OVERLAY).setAlpha(0);

    scene.tweens.add({
      targets: text,
      alpha: 1,
      scale: { from: 0.5, to: 1.2 },
      duration: 400,
      ease: 'Back.easeOut',
      yoyo: true,
      hold: 600,
      onComplete: () => text.destroy(),
    });
  }

  // =============================================================
  // HEALING SPIRAL
  // =============================================================
  emitHealEffect(x, y) {
    const { scene } = this;
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const particle = scene.add.circle(
        x + Math.cos(angle) * 30,
        y + Math.sin(angle) * 30,
        3, 0x39ff14, 0.8
      ).setDepth(DEPTH.EFFECT_BURST);

      scene.tweens.add({
        targets: particle,
        x: x,
        y: y,
        alpha: 0,
        scale: 0.2,
        duration: 400,
        delay: i * 60,
        ease: 'Sine.easeIn',
        onComplete: () => particle.destroy(),
      });
    }
  }

  // =============================================================
  // SCREEN PULSE
  // =============================================================
  screenPulse(color = 0x00f0ff, intensity = 0.1) {
    const { scene } = this;
    const pulse = scene.add.rectangle(
      scene.cameras.main.scrollX + scene.cameras.main.width / 2,
      scene.cameras.main.scrollY + scene.cameras.main.height / 2,
      scene.cameras.main.width,
      scene.cameras.main.height,
      color, 0
    ).setDepth(DEPTH.UI_OVERLAY).setAlpha(0);

    scene.tweens.add({
      targets: pulse,
      alpha: intensity,
      yoyo: true,
      duration: 200,
      onComplete: () => pulse.destroy(),
    });
  }

  destroy() {
    this.explosionEmitter.destroy();
    this.pickupEmitter.destroy();
    for (const t of this.floatingTexts) {
      if (t.active) t.destroy();
    }
    this.floatingTexts = [];
  }
}
