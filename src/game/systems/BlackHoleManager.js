import Phaser from 'phaser';
import { DEPTH } from './BoostManager';

/**
 * BlackHoleManager System
 *
 * Spawns 2-4 tactical space anomalies with:
 * - Screen boundary margins (min 280px from borders)
 * - Visible gravity radius ring (cyan) & inward rippling gravity flow ring (purple)
 * - Orbiting space dust particles that spiral and accelerate toward the core
 * - Light refraction/distortion disk (Einstein ring simulation)
 * - Quadratic gravity pull that affects player, enemies, projectiles, and collectibles
 * - Core damage hazard dealing continuous damage on contact
 */
export default class BlackHoleManager {
  constructor(scene) {
    this.scene = scene;
    this.blackHoles = [];
  }

  create() {
    const { ARENA_SIZE } = this.scene;
    const count = Phaser.Math.Between(2, 4);
    const playerSpawnX = ARENA_SIZE / 2;
    const playerSpawnY = ARENA_SIZE / 2;

    for (let i = 0; i < count; i++) {
      let x, y, validPosition = false;
      let attempts = 0;

      while (!validPosition && attempts < 30) {
        // Enforce safe spawn margins: min 280px from borders
        x = Phaser.Math.Between(280, ARENA_SIZE - 280);
        y = Phaser.Math.Between(280, ARENA_SIZE - 280);
        attempts++;

        // Keep away from player spawning area
        const distToSpawn = Phaser.Math.Distance.Between(x, y, playerSpawnX, playerSpawnY);
        if (distToSpawn < 400) continue;

        // Keep away from other black holes
        validPosition = true;
        for (const bh of this.blackHoles) {
          if (Phaser.Math.Distance.Between(x, y, bh.x, bh.y) < 380) {
            validPosition = false;
            break;
          }
        }
      }

      // Final fallback boundaries
      if (!validPosition) {
        x = Phaser.Math.Between(350, ARENA_SIZE - 350);
        y = Phaser.Math.Between(350, ARENA_SIZE - 350);
      }

      const sizeScale = Phaser.Math.FloatBetween(0.85, 1.25);
      this.createBlackHole(x, y, sizeScale);
    }
  }

  createBlackHole(x, y, scale) {
    const { scene } = this;
    const gravityRadius = Phaser.Math.Between(160, 220) * scale;
    const gravityStrength = Phaser.Math.FloatBetween(40, 85) * scale;
    const rotationSpeed = Phaser.Math.FloatBetween(0.3, 0.6);
    const pulseSpeed = Phaser.Math.FloatBetween(0.8, 1.6);

    // 1. Accretion disk image
    const disk = scene.add.image(x, y, 'blackHoleTexture')
      .setDepth(DEPTH.BLACK_HOLE_DISK)
      .setScale(scale * 1.8);

    // 2. Gravity indicators (outer cyan ring, rippling purple ring)
    const ring1 = scene.add.graphics().setDepth(DEPTH.BLACK_HOLE_RING);
    const ring2 = scene.add.graphics().setDepth(DEPTH.BLACK_HOLE_RING);

    // 3. Event horizon core (high-neon stroke + refraction ring)
    const core = scene.add.graphics().setDepth(DEPTH.BLACK_HOLE_CORE);
    const coreRadius = Math.round(30 * scale);

    // 4. Space Dust Particles Group (Visual spiral funnel)
    const dustParticles = [];
    const particleCount = 20 + Math.floor(scale * 10);
    for (let p = 0; p < particleCount; p++) {
      dustParticles.push({
        angle: Math.random() * Math.PI * 2,
        distance: Phaser.Math.Between(coreRadius + 5, gravityRadius),
        speed: Phaser.Math.FloatBetween(1.2, 3.2),
        color: Phaser.Utils.Array.GetRandom([0x00f0ff, 0xff00ff, 0x9d00ff, 0xffea00]),
        size: Phaser.Math.FloatBetween(1.5, 3.0),
      });
    }
    const particleGraphics = scene.add.graphics().setDepth(DEPTH.BLACK_HOLE_CORE - 1);

    const blackHole = {
      x, y, scale, gravityRadius, gravityStrength,
      rotationSpeed, pulseSpeed,
      disk, ring1, ring2, core, coreRadius,
      dustParticles, particleGraphics,
      pulsePhase: 0,
    };

    this.blackHoles.push(blackHole);
    return blackHole;
  }

  update(time, delta) {
    const { scene } = this;
    const dt = delta / 1000;

    for (const bh of this.blackHoles) {
      bh.pulsePhase += dt * bh.pulseSpeed;

      // Rotate accretion disk
      bh.disk.angle += bh.rotationSpeed;

      // A. Draw Outer Gravity Boundary Ring (Cyan)
      bh.ring1.clear();
      const ringAlpha = 0.15 + Math.sin(bh.pulsePhase * 2.0) * 0.05;
      bh.ring1.lineStyle(1.5, 0x00f0ff, ringAlpha);
      bh.ring1.strokeCircle(bh.x, bh.y, bh.gravityRadius);

      // B. Ripple Gravity Inward Ring (Purple Flow)
      bh.ring2.clear();
      const rippleProgress = 1 - ((time * 0.0004 * bh.pulseSpeed) % 1.0);
      const rippleRadius = bh.coreRadius + (bh.gravityRadius - bh.coreRadius) * rippleProgress;
      const rippleAlpha = rippleProgress * 0.35;
      bh.ring2.lineStyle(2.0, 0x9d00ff, rippleAlpha);
      bh.ring2.strokeCircle(bh.x, bh.y, rippleRadius);

      // C. Draw Core & Einstein Light Refraction Ring
      bh.core.clear();
      
      // Neon Refraction Ring (Orange/Red edge distortion layer)
      const refractionAlpha = 0.08 + Math.abs(Math.sin(bh.pulsePhase * 0.5)) * 0.06;
      bh.core.lineStyle(16 * bh.scale, 0xff5500, refractionAlpha);
      bh.core.strokeCircle(bh.x, bh.y, bh.coreRadius + 10);

      // Event Horizon Edge (Pulsing Magenta)
      const neonAlpha = 0.75 + Math.abs(Math.sin(bh.pulsePhase * 3)) * 0.25;
      bh.core.lineStyle(3 * bh.scale, 0xff00ff, neonAlpha);
      bh.core.strokeCircle(bh.x, bh.y, bh.coreRadius + 1);

      // Event Horizon Black Core
      bh.core.fillStyle(0x06060c, 1.0);
      bh.core.fillCircle(bh.x, bh.y, bh.coreRadius);

      // D. Draw & Update Orbiting Space Dust Funnel
      bh.particleGraphics.clear();
      for (const p of bh.dustParticles) {
        // Orbit speed increases near core
        const proximityFactor = 1 - ((p.distance - bh.coreRadius) / (bh.gravityRadius - bh.coreRadius)); // 0 at edge, 1 at core
        const orbitRate = (0.02 + proximityFactor * 0.06) * bh.rotationSpeed * (delta / 16);
        p.angle += orbitRate;

        // Pull inward (faster near core)
        const pullRate = (p.speed + proximityFactor * 5) * (delta / 16);
        p.distance -= pullRate;

        // Respawn when hitting core
        if (p.distance <= bh.coreRadius) {
          p.distance = bh.gravityRadius * Phaser.Math.FloatBetween(0.85, 1.0);
          p.angle = Math.random() * Math.PI * 2;
        }

        const px = bh.x + Math.cos(p.angle) * p.distance;
        const py = bh.y + Math.sin(p.angle) * p.distance;
        const alpha = Math.min(1.0, (p.distance - bh.coreRadius) / 20) * (0.35 + proximityFactor * 0.65);

        bh.particleGraphics.fillStyle(p.color, alpha);
        bh.particleGraphics.fillPoint(px, py, p.size);
      }

      // ---- GRAVITY PHYSICS ----
      if (!scene.isCombatFrozen) {
        if (scene.player && scene.player.active) {
          this.applyGravity(bh, scene.player, delta);
          
          // Core contact hazard: continuous damage
          const distToPlayer = Phaser.Math.Distance.Between(bh.x, bh.y, scene.player.x, scene.player.y);
          if (distToPlayer < bh.coreRadius + 12) {
            scene.health = Math.max(0, scene.health - 22 * dt); // 22% health damage per second
            scene.dispatchMetricsToReact();
            if (scene.effectsManager) {
              scene.effectsManager.playerDamage();
            }
            if (scene.health <= 0) {
              scene.handleGameOver();
            }
          }
        }

        this.applyGravityToGroup(bh, scene.enemies, delta);
        this.applyGravityToGroup(bh, scene.powerups, delta);
        this.applyGravityToGroup(bh, scene.bullets, delta);
        
        // Pull unbroken gems too if they exist
        if (scene.unbrokenGems) {
          this.applyGravityToGroup(bh, scene.unbrokenGems, delta);
        }
      }
    }
  }

  applyGravityToGroup(bh, group, delta) {
    const children = group.getChildren();
    for (const sprite of children) {
      if (!sprite.active) continue;
      if (sprite.getData('gravityResistant') === true) continue;
      this.applyGravity(bh, sprite, delta);
    }
  }

  applyGravity(bh, sprite, delta) {
    const dist = Phaser.Math.Distance.Between(bh.x, bh.y, sprite.x, sprite.y);
    if (dist > bh.gravityRadius || dist < 10) return;

    const normalizedDist = dist / bh.gravityRadius;
    const angle = Phaser.Math.Angle.Between(sprite.x, sprite.y, bh.x, bh.y);

    // Bullets bend less based on velocity (fast bullets resist more)
    let velocityFactor = 1;
    if (sprite.body && (sprite.body.velocity.x !== 0 || sprite.body.velocity.y !== 0)) {
      const speed = Math.sqrt(
        sprite.body.velocity.x ** 2 + sprite.body.velocity.y ** 2
      );
      velocityFactor = Math.min(1, 350 / Math.max(speed, 50));
    }

    // Quadratic gravity: pull increases dramatically closer to the core
    const gravityFactor = (1 - normalizedDist) ** 1.8;
    const forceMagnitude = bh.gravityStrength * gravityFactor * (delta / 1000) * 16 * velocityFactor;

    if (sprite.body) {
      sprite.body.velocity.x += Math.cos(angle) * forceMagnitude;
      sprite.body.velocity.y += Math.sin(angle) * forceMagnitude;
    } else {
      sprite.x += Math.cos(angle) * forceMagnitude;
      sprite.y += Math.sin(angle) * forceMagnitude;
    }
  }

  getGravityData() {
    return this.blackHoles.map(bh => ({
      x: bh.x, y: bh.y,
      radius: bh.gravityRadius,
      strength: bh.gravityStrength,
    }));
  }

  destroy() {
    for (const bh of this.blackHoles) {
      bh.disk.destroy();
      bh.ring1.destroy();
      bh.ring2.destroy();
      bh.core.destroy();
      bh.particleGraphics.destroy();
    }
    this.blackHoles = [];
  }
}
