import Phaser from 'phaser';
import synthAudio from '../utils/synthAudio';

/**
 * Depth constants for consistent rendering order across all systems.
 * Using positive values to prevent rendering glitches.
 */
export const DEPTH = {
  BG_FOG: 0,
  BG_STARS_BACK: 1,
  BG_NEBULA: 2,
  BG_STARS_MID: 3,
  BG_TWINKLE: 4,
  BG_STARS_FORE: 5,
  BG_AMBIENT: 6,
  BG_GALAXY_FOG: 7,
  BLACK_HOLE_DISK: 20,
  BLACK_HOLE_RING: 21,
  BLACK_HOLE_CORE: 22,
  ENEMY_TRAIL: 28,
  ENEMY: 30,
  PLAYER_TRAIL: 34,
  PLAYER_SHIELD: 35,
  PLAYER: 36,
  BULLET: 40,
  POWERUP: 45,
  EFFECT_BURST: 50,
  EFFECT_RING: 51,
  EFFECTS: 52,
  EFFECT_FLOATING_TEXT: 55,
  UI_OVERLAY: 100,
};

/**
 * BoostManager System
 *
 * Manages all temporary player boosts with unique visual identities:
 *
 * TITAN MODE     - Larger ship + bigger bullets + increased damage + orange/red aura
 * MULTI_SHOT     - Multiple bullet patterns (triple, arc, spiral) + colored trails
 * PHASE_DASH     - Ultra-fast burst + phase through enemies + afterimage trails
 * VOID_STORM     - Periodic gravity pulses + orbiting bullets + mini distortions
 *
 * Each boost has:
 *  - Unique visual identity (color, particles, glow)
 *  - Temporary duration with UI timer
 *  - Activation sound
 *  - Expiration warning
 *  - Only one major boost active at a time
 */
export default class BoostManager {
  constructor(scene) {
    this.scene = scene;
    this.activeBoost = null;
    this.boostTimer = 0;
    this.boostDuration = 0;
    this.maxBoostDuration = 8000;

    // Visual references for cleanup
    this.afterimages = [];
    this.orbitBullets = [];
    this.pulseRing = null;
    this.voidStormTimer = 0;
  }

  create() {
    // Setup afterimage pool (reused during phase dash)
    this.afterimagePool = [];
    for (let i = 0; i < 8; i++) {
      const img = this.scene.add.image(0, 0, 'playerShipTexture')
        .setDepth(DEPTH.PLAYER - 1)
        .setAlpha(0)
        .setVisible(false);
      this.afterimagePool.push(img);
    }
  }

  get isBoostActive() {
    return this.activeBoost !== null && this.boostTimer > 0;
  }

  get boostType() {
    return this.activeBoost;
  }

  get boostTimeRemaining() {
    return Math.max(0, Math.ceil(this.boostTimer / 1000));
  }

  /**
   * Attempt to activate a boost. Replaces any active boost.
   */
  activateBoost(type) {
    const { scene } = this;

    // Clear any existing boost first
    this.deactivateBoost();

    this.activeBoost = type;
    this.boostTimer = this.maxBoostDuration;

    // Play activation sound
    synthAudio.playBoostActivate(type);

    // Screen flash
    scene.cameras.main.flash(200, 255, 255, 255, 0.3);

    // Visual activation burst
    const colors = {
      TITAN: 0xff6600,
      MULTI_SHOT: 0xff00ff,
      PHASE_DASH: 0x00f0ff,
      VOID_STORM: 0x9d00ff,
      TWIN_SHIP: 0xff3333,
    };

    if (scene.effectsManager) {
      scene.effectsManager.emitPickupBurst(
        scene.player.x, scene.player.y, type
      );
      scene.effectsManager.showFloatingText(
        scene.player.x, scene.player.y - 40,
        type.replace('_', ' ') + ' ACTIVE',
        `#${colors[type].toString(16).padStart(6, '0')}`,
        '11px'
      );
    }

    // Boost-specific setup
    if (type === 'PHASE_DASH') {
      // Phase dash gives brief invulnerability
      scene.isShielded = true;
      scene.shieldTime = 1500;
    }

    if (type === 'VOID_STORM') {
      this.voidStormTimer = 0;
    }

    scene.dispatchMetricsToReact();
  }

  deactivateBoost() {
    if (!this.activeBoost) return;
    this.activeBoost = null;
    this.boostTimer = 0;

    // Cleanup afterimages
    this.afterimagePool.forEach(img => {
      img.setVisible(false).setAlpha(0);
    });

    // Cleanup void storm effects
    if (this.pulseRing) {
      this.pulseRing.destroy();
      this.pulseRing = null;
    }

    // Cleanup twin ships
    if (this.twinShipLeft) {
      this.twinShipLeft.destroy();
      this.twinShipRight.destroy();
      this.twinTrailLeft.destroy();
      this.twinTrailRight.destroy();
      this.twinShipLeft = null;
    }

    // Reset player scale if titan was active
    if (this.scene.player) {
      this.scene.player.setScale(1);
    }
  }

  update(time, delta) {
    const { scene } = this;
    if (!this.activeBoost || !scene.player) return;

    this.boostTimer -= delta;

    // Expiration warning (last 1.5s)
    const isExpiring = this.boostTimer < 1500;

    if (this.boostTimer <= 0) {
      synthAudio.playBoostExpire();
      this.deactivateBoost();
      scene.dispatchMetricsToReact();
      return;
    }

    // Apply boost-specific behavior every frame
    switch (this.activeBoost) {
      case 'TITAN':
        this.updateTitanMode(time, delta, isExpiring);
        break;
      case 'MULTI_SHOT':
        this.updateMultiShot(time, delta, isExpiring);
        break;
      case 'PHASE_DASH':
        this.updatePhaseDash(time, delta, isExpiring);
        break;
      case 'VOID_STORM':
        this.updateVoidStorm(time, delta, isExpiring);
        break;
      case 'TWIN_SHIP':
        this.updateTwinShip(time, delta, isExpiring);
        break;
    }
  }

  // ================================================================
  // TITAN MODE
  // ================================================================
  updateTitanMode(time, delta, isExpiring) {
    const { scene } = this;
    const player = scene.player;

    // Enlarge player
    const pulseScale = 1.3 + Math.sin(time * 0.008) * 0.05;
    player.setScale(pulseScale);

    // Orange/red aura ring
    if (!this.titanAura) {
      this.titanAura = scene.add.graphics().setDepth(DEPTH.PLAYER_SHIELD);
    }
    this.titanAura.clear();
    const alpha = isExpiring ? 0.2 + Math.sin(time * 0.02) * 0.15 : 0.35;
    this.titanAura.lineStyle(4, 0xff6600, alpha);
    this.titanAura.strokeCircle(player.x, player.y, 35 * pulseScale);

    // Orange glow ring
    this.titanAura.lineStyle(2, 0xff3300, alpha * 0.5);
    this.titanAura.strokeCircle(player.x, player.y, 45 * pulseScale);

    // Slower movement to balance power
    if (player.body) {
      player.body.velocity.x *= 0.97;
      player.body.velocity.y *= 0.97;
    }
  }

  // ================================================================
  // MULTI-SHOT
  // ================================================================
  updateMultiShot(time, delta, isExpiring) {
    const { scene } = this;
    const player = scene.player;

    // Rotating colored glow effect around player
    if (!this.multiGlow) {
      this.multiGlow = scene.add.graphics().setDepth(DEPTH.PLAYER_SHIELD);
    }
    this.multiGlow.clear();

    const colors = [0xff00ff, 0x00f0ff, 0x39ff14, 0xffea00];
    const count = 4;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + time * 0.003;
      const rx = Math.cos(a) * 30;
      const ry = Math.sin(a) * 30;
      const alpha = isExpiring ? 0.2 + Math.sin(time * 0.01 + i) * 0.1 : 0.5;
      this.multiGlow.fillStyle(colors[i], alpha);
      this.multiGlow.fillCircle(player.x + rx, player.y + ry, 4);
    }
  }

  // ================================================================
  // PHASE DASH
  // ================================================================
  updatePhaseDash(time, delta, isExpiring) {
    const { scene } = this;
    const player = scene.player;

    // Speed boost
    if (player.body) {
      const speedMult = 1.8;
      player.body.velocity.x *= speedMult;
      player.body.velocity.y *= speedMult;

      // Clamp to max velocity
      const maxV = 500;
      const vx = player.body.velocity.x;
      const vy = player.body.velocity.y;
      const mag = Math.sqrt(vx * vx + vy * vy);
      if (mag > maxV) {
        player.body.velocity.x = (vx / mag) * maxV;
        player.body.velocity.y = (vy / mag) * maxV;
      }
    }

    // Afterimage trail (spawn one periodically)
    if (time % 80 < delta) {
      this.spawnAfterimage(player.x, player.y, player.rotation);
    }

    // Update afterimage pool (fade out)
    this.afterimagePool.forEach(img => {
      if (img.visible) {
        img.setAlpha(img.alpha - 0.05);
        if (img.alpha <= 0) {
          img.setVisible(false);
        }
      }
    });

    // Phase dash visual glow
    if (!this.dashGlow) {
      this.dashGlow = scene.add.graphics().setDepth(DEPTH.PLAYER_SHIELD);
    }
    this.dashGlow.clear();
    const alpha = isExpiring ? 0.15 : 0.3;
    this.dashGlow.lineStyle(3, 0x00f0ff, alpha);
    this.dashGlow.strokeCircle(player.x, player.y, 25);

    // Electric streaks
    for (let i = 0; i < 3; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Phaser.Math.Between(20, 40);
      this.dashGlow.lineStyle(1, 0x00f0ff, alpha * 0.4);
      this.dashGlow.beginPath();
      this.dashGlow.moveTo(player.x, player.y);
      this.dashGlow.lineTo(
        player.x + Math.cos(angle) * dist,
        player.y + Math.sin(angle) * dist
      );
      this.dashGlow.stroke();
    }
  }

  spawnAfterimage(x, y, rotation) {
    const img = this.afterimagePool.find(i => !i.visible);
    if (!img) return;
    img.setPosition(x, y);
    img.setRotation(rotation);
    img.setAlpha(0.4);
    img.setVisible(true);
  }

  // ================================================================
  // TWIN SHIP
  // ================================================================
  updateTwinShip(time, delta, isExpiring) {
    const { scene } = this;
    const player = scene.player;

    if (!this.twinShipLeft) {
      this.twinShipLeft = scene.add.sprite(player.x, player.y, 'playerShipTexture').setDepth(DEPTH.PLAYER - 1).setScale(0.6).setTint(0xffaaaa);
      this.twinShipRight = scene.add.sprite(player.x, player.y, 'playerShipTexture').setDepth(DEPTH.PLAYER - 1).setScale(0.6).setTint(0xffaaaa);
      
      this.twinTrailLeft = scene.add.particles(0, 0, 'sparkTexture', {
        speed: { min: 20, max: 60 },
        scale: { start: 0.6, end: 0 },
        alpha: { start: 0.5, end: 0 },
        lifespan: 300,
        blendMode: 'ADD',
        follow: this.twinShipLeft,
      }).setDepth(DEPTH.PLAYER_TRAIL);

      this.twinTrailRight = scene.add.particles(0, 0, 'sparkTexture', {
        speed: { min: 20, max: 60 },
        scale: { start: 0.6, end: 0 },
        alpha: { start: 0.5, end: 0 },
        lifespan: 300,
        blendMode: 'ADD',
        follow: this.twinShipRight,
      }).setDepth(DEPTH.PLAYER_TRAIL);
    }

    const angleOffset = Math.sin(time * 0.002) * 0.3;
    const leftX = player.x + Math.cos(player.rotation - Math.PI / 2 + angleOffset) * 55;
    const leftY = player.y + Math.sin(player.rotation - Math.PI / 2 + angleOffset) * 55;
    const rightX = player.x + Math.cos(player.rotation + Math.PI / 2 - angleOffset) * 55;
    const rightY = player.y + Math.sin(player.rotation + Math.PI / 2 - angleOffset) * 55;

    this.twinShipLeft.x += (leftX - this.twinShipLeft.x) * 0.2;
    this.twinShipLeft.y += (leftY - this.twinShipLeft.y) * 0.2;
    this.twinShipLeft.setRotation(player.rotation);

    this.twinShipRight.x += (rightX - this.twinShipRight.x) * 0.2;
    this.twinShipRight.y += (rightY - this.twinShipRight.y) * 0.2;
    this.twinShipRight.setRotation(player.rotation);

    const alpha = isExpiring && (time % 200 < 100) ? 0.3 : 1.0;
    this.twinShipLeft.setAlpha(alpha);
    this.twinShipRight.setAlpha(alpha);
  }

  // ================================================================
  // VOID STORM
  // ================================================================
  updateVoidStorm(time, delta, isExpiring) {
    const { scene } = this;
    const player = scene.player;

    // Periodic gravity pulse (every 1.5s)
    this.voidStormTimer += delta;
    if (this.voidStormTimer > 1500) {
      this.voidStormTimer = 0;
      this.emitVoidPulse();
    }

    // Rotating energy ring around player
    if (!this.voidRing) {
      this.voidRing = scene.add.graphics().setDepth(DEPTH.PLAYER_SHIELD);
    }
    this.voidRing.clear();

    const ringCount = 2;
    for (let r = 0; r < ringCount; r++) {
      const radius = 30 + r * 15 + Math.sin(time * 0.003 + r) * 5;
      const alpha = (isExpiring ? 0.15 : 0.3) + Math.sin(time * 0.005 + r) * 0.1;
      this.voidRing.lineStyle(2, 0x9d00ff, alpha);
      this.voidRing.strokeCircle(player.x, player.y, radius);
    }

    // Black/purple distortion waves
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2 + time * 0.002;
      const rx = Math.cos(angle) * 40;
      const ry = Math.sin(angle) * 40;
      this.voidRing.fillStyle(0x6600aa, 0.2);
      this.voidRing.fillCircle(player.x + rx, player.y + ry, 3);
    }
  }

  emitVoidPulse() {
    const { scene } = this;
    const player = scene.player;

    // Push/pull nearby enemies
    const enemies = scene.enemies.getChildren();
    for (const enemy of enemies) {
      if (!enemy.active) continue;
      const dist = Phaser.Math.Distance.Between(player.x, player.y, enemy.x, enemy.y);
      if (dist > 250) continue;

      const angle = Phaser.Math.Angle.Between(player.x, player.y, enemy.x, enemy.y);
      const force = 200 * (1 - dist / 250);

      // Randomly push or pull
      const direction = Math.random() > 0.5 ? 1 : -1;
      if (enemy.body) {
        enemy.body.velocity.x += Math.cos(angle) * force * direction;
        enemy.body.velocity.y += Math.sin(angle) * force * direction;
      }
    }

    // Visual pulse ring
    if (this.pulseRing) this.pulseRing.destroy();
    this.pulseRing = scene.add.circle(player.x, player.y, 10, 0x9d00ff, 0.4)
      .setDepth(DEPTH.EFFECT_RING);
    scene.tweens.add({
      targets: this.pulseRing,
      scale: 25,
      alpha: 0,
      duration: 600,
      ease: 'Sine.easeOut',
      onComplete: () => {
        if (this.pulseRing) {
          this.pulseRing.destroy();
          this.pulseRing = null;
        }
      }
    });
  }

  /**
   * Returns bullet modifiers for the active boost.
   * Called by the scene's shootBullet method.
   */
  getBulletModifiers() {
    const mods = {
      scale: 1,
      damage: 1,
      velocity: 1,
      pattern: 'single',
      tint: null,
    };

    if (!this.activeBoost) return mods;

    switch (this.activeBoost) {
      case 'TITAN':
        mods.scale = 2.0;
        mods.damage = 2.5;
        mods.velocity = 0.9;
        mods.tint = 0xff6600;
        break;
      case 'MULTI_SHOT':
        mods.pattern = 'multi';
        mods.tint = 0xff00ff;
        break;
      case 'VOID_STORM':
        mods.pattern = 'orbit';
        mods.tint = 0x9d00ff;
        break;
      case 'TWIN_SHIP':
        mods.pattern = 'twin';
        mods.tint = 0xff3333;
        break;
    }

    return mods;
  }

  destroy() {
    this.deactivateBoost();
    this.afterimagePool.forEach(img => img.destroy());
    if (this.titanAura) this.titanAura.destroy();
    if (this.multiGlow) this.multiGlow.destroy();
    if (this.dashGlow) this.dashGlow.destroy();
    if (this.voidRing) this.voidRing.destroy();
    if (this.pulseRing) this.pulseRing.destroy();
  }
}
