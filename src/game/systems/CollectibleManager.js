import Phaser from 'phaser';
import { DEPTH } from './BoostManager';
import synthAudio from '../utils/synthAudio';

/**
 * CollectibleManager System
 *
 * Implements the shooting, breaking, and collection mechanics:
 * 1. Enemies drop Sealed/Unbroken Gems ('gemTexture').
 * 2. Player bullets collide with and break these Unbroken Gems.
 * 3. Shattering a gem triggers a screen shake, explosion sound, and releases either:
 *    - A high-tier Collectible Boost Item (30% chance or guaranteed from timer)
 *    - 3 to 5 small Energy Fragments (70% chance)
 * 4. Fired items and fragments float, rotate, and have quadratic magnetic attraction.
 * 5. Player collects rewards on overlap, triggering floating text, bursts, and audio.
 */
export default class CollectibleManager {
  constructor(scene) {
    this.scene = scene;
    this.magnetRange = 175; // Comfortable pickup pull radius
  }

  create() {
    this.startSpawnLoop();
  }

  update(time, delta) {
    const { scene } = this;
    if (!scene.player || !scene.player.active || scene.isCombatFrozen) return;

    const player = scene.player;

    // Position and animate powerup glows
    const powerups = scene.powerups.getChildren();
    for (const item of powerups) {
      if (!item.active) continue;

      const glow = item.getData('glow');
      if (glow && glow.active) {
        glow.setPosition(item.x, item.y);
        const pulse = Math.sin(time * 0.01) * 0.2;
        glow.setScale(1.3 + pulse);
        glow.setAlpha(0.7 + pulse * 1.5);
      }

      const dist = Phaser.Math.Distance.Between(item.x, item.y, player.x, player.y);

      if (dist < this.magnetRange) {
        const angle = Phaser.Math.Angle.Between(item.x, item.y, player.x, player.y);
        
        // Quadratic force pull: gets much stronger as the item gets closer
        const pullPercent = 1.0 - (dist / this.magnetRange);
        const force = 1.6 * (pullPercent * pullPercent) * (delta / 16);

        if (item.body) {
          item.body.velocity.x += Math.cos(angle) * force * 15;
          item.body.velocity.y += Math.sin(angle) * force * 15;

          // Cap speed to avoid slingshotting orbit loops
          const maxSpeed = 420;
          const speedSq = item.body.velocity.x ** 2 + item.body.velocity.y ** 2;
          if (speedSq > maxSpeed * maxSpeed) {
            const speed = Math.sqrt(speedSq);
            item.body.velocity.x = (item.body.velocity.x / speed) * maxSpeed;
            item.body.velocity.y = (item.body.velocity.y / speed) * maxSpeed;
          }
        } else {
          item.x += Math.cos(angle) * force * 8;
          item.y += Math.sin(angle) * force * 8;
        }

        item.setAlpha(1.0);
      }

      // Constrain inside bounds
      if (item.body) {
        const { ARENA_SIZE } = scene;
        item.x = Phaser.Math.Clamp(item.x, 30, ARENA_SIZE - 30);
        item.y = Phaser.Math.Clamp(item.y, 30, ARENA_SIZE - 30);
      }
    }

    // B. Keep unbroken gems within bounds too and position/animate their glows
    if (scene.unbrokenGems) {
      const gems = scene.unbrokenGems.getChildren();
      for (const gem of gems) {
        if (!gem.active) continue;
        const glow = gem.getData('glow');
        if (glow && glow.active) {
          glow.setPosition(gem.x, gem.y);
          const pulse = Math.sin(time * 0.008) * 0.15;
          glow.setScale(1.15 + pulse);
          glow.setAlpha(0.65 + pulse * 1.5);
        }
        const { ARENA_SIZE } = scene;
        gem.x = Phaser.Math.Clamp(gem.x, 30, ARENA_SIZE - 30);
        gem.y = Phaser.Math.Clamp(gem.y, 30, ARENA_SIZE - 30);
      }
    }
  }

  startSpawnLoop() {
    const { scene } = this;

    const delay = Math.max(5000, 11000 - scene.wave * 300);
    scene.time.addEvent({
      delay: delay,
      callback: () => {
        const { ARENA_SIZE } = scene;
        const x = Phaser.Math.Between(300, ARENA_SIZE - 300);
        const y = Phaser.Math.Between(300, ARENA_SIZE - 300);
        this.spawnUnbrokenGem(x, y, null, true);
      },
      loop: true,
    });
  }

  /**
   * Drops a sealed unbroken gem container.
   */
  tryDropFromEnemy(x, y, wave) {
    const dropChance = Math.min(0.60, 0.15 + wave * 0.05); // Scaling drop chance with waves

    if (Math.random() < dropChance) {
      this.spawnUnbrokenGem(x, y, null, false);
    }
  }

  /**
   * Spawns an unbroken gem container.
   */
  spawnUnbrokenGem(x, y, forcedType = null, isGuaranteedBoost = false) {
    const { scene } = this;
    if (scene.health <= 0) return null;

    // Create container using the default green glowing 'gemTexture'
    const gem = scene.unbrokenGems.create(x, y, 'gemTexture');
    gem.setData('isGuaranteedBoost', isGuaranteedBoost);
    gem.setData('forcedType', forcedType);
    gem.setDepth(DEPTH.POWERUP);

    gem.body.setSize(38, 38);
    gem.body.setOffset(-7, -7);

    // Green glowing visual aura
    const glow = scene.add.image(x, y, 'gemGlowTexture');
    glow.setDepth(DEPTH.POWERUP - 1);
    glow.setBlendMode(Phaser.BlendModes.ADD);
    glow.setTint(0x39ff14);
    gem.setData('glow', glow);

    // Initial bounce drop animation
    gem.y += -25;
    scene.tweens.add({
      targets: gem,
      y: y,
      duration: 350,
      ease: 'Bounce.easeOut',
    });

    // Slow orbital rotation
    scene.tweens.add({
      targets: gem,
      angle: 360,
      repeat: -1,
      duration: 3500,
    });

    // Glow pulse animation
    scene.tweens.add({
      targets: gem,
      alpha: { from: 0.75, to: 1.0 },
      yoyo: true,
      repeat: -1,
      duration: 600,
      ease: 'Sine.easeInOut',
    });

    return gem;
  }

  /**
   * Shatters a container gem, releasing rewards.
   */
  breakGem(gem) {
    const { scene } = this;
    if (!gem.active) return;

    const x = gem.x;
    const y = gem.y;
    const isGuaranteedBoost = gem.getData('isGuaranteedBoost');
    const forcedType = gem.getData('forcedType');

    // 1. Play visual effects and rumble sound
    if (scene.effectsManager) {
      scene.effectsManager.emitGemShatter(x, y);
    }
    synthAudio.playExplosion();

    // 2. Spawn rewards
    if (isGuaranteedBoost || Math.random() < 0.30) {
      // 30% chance or guaranteed: Spawn a boost powerup
      this.spawnCollectibleItem(x, y, forcedType);
    } else {
      // 70% chance: Spawn 3 to 5 energy fragments
      const fragmentCount = Phaser.Math.Between(3, 5);
      for (let i = 0; i < fragmentCount; i++) {
        this.spawnEnergyFragment(x, y);
      }
    }

    // 3. Clear container and glow
    const glow = gem.getData('glow');
    if (glow) glow.destroy();
    gem.destroy();
  }

  /**
   * Spawns a high-tier boost collectible item.
   */
  spawnCollectibleItem(x, y, forcedType = null) {
    const { scene } = this;
    const allTypes = ['HEAL', 'SHIELD', 'RAPID', 'TITAN', 'MULTI_SHOT', 'PHASE_DASH', 'VOID_STORM', 'TWIN_SHIP'];
    const type = forcedType || Phaser.Utils.Array.GetRandom(allTypes);

    const item = scene.powerups.create(x, y, 'gemTexture');
    item.setData('type', type);
    item.setDepth(DEPTH.POWERUP);
    item.setScale(1.25);

    // Color-code the token depending on the powerup type
    const typeTints = {
      HEAL: 0x39ff14,       // Green
      SHIELD: 0x00f0ff,     // Cyan
      RAPID: 0xffea00,      // Yellow
      TITAN: 0xff6600,      // Orange
      MULTI_SHOT: 0xff00ff, // Magenta
      PHASE_DASH: 0x88ffff, // Ice Blue
      VOID_STORM: 0x9d00ff, // Purple
      TWIN_SHIP: 0xff3333,  // Red
    };
    if (typeTints[type]) {
      item.setTint(typeTints[type]);
    }

    // Color-coded pulsing glow aura
    const glowColor = typeTints[type] || 0xffffff;
    const glow = scene.add.image(x, y, 'gemGlowTexture');
    glow.setDepth(DEPTH.POWERUP - 1);
    glow.setBlendMode(Phaser.BlendModes.ADD);
    glow.setTint(glowColor);
    item.setData('glow', glow);

    item.body.setSize(26, 26);
    item.body.setOffset(-3, -3);

    // Explode outwards slightly
    item.body.setVelocity(
      Phaser.Math.Between(-100, 100),
      Phaser.Math.Between(-100, 100)
    );
    item.body.setDrag(160);

    // Subtle float tween
    scene.tweens.add({
      targets: item,
      y: y - 10,
      yoyo: true,
      repeat: -1,
      duration: 1100,
      ease: 'Sine.easeInOut',
    });

    return item;
  }

  /**
   * Spawns a small score energy crystal fragment.
   */
  spawnEnergyFragment(x, y) {
    const { scene } = this;
    const fragment = scene.powerups.create(x, y, 'energyFragmentTexture');
    fragment.setData('type', 'ENERGY_FRAGMENT');
    fragment.setDepth(DEPTH.POWERUP);

    fragment.body.setSize(18, 18);

    // Spread outward in random directions
    fragment.body.setVelocity(
      Phaser.Math.Between(-160, 160),
      Phaser.Math.Between(-160, 160)
    );
    fragment.body.setDrag(200);

    // Fast initial rotation
    fragment.angle = Phaser.Math.Between(0, 360);
    scene.tweens.add({
      targets: fragment,
      angle: fragment.angle + 360,
      repeat: -1,
      duration: Phaser.Math.Between(1500, 3000),
    });

    return fragment;
  }

  /**
   * Renders the pickup feedback and activates the rewards.
   */
  handlePickup(player, item) {
    const { scene } = this;
    if (!item.active) return;

    const type = item.getData('type');

    if (type === 'ENERGY_FRAGMENT') {
      // Add Score
      scene.score += 150;
      scene.dispatchMetricsToReact();

      // Play metallic ping sound
      synthAudio.playPickup('SHIELD');

      // Floating score text
      if (scene.effectsManager) {
        scene.effectsManager.showFloatingText(item.x, item.y, '+150', '#00f0ff', '11px');
        scene.effectsManager.emitPickupBurst(item.x, item.y, 'SHIELD');
      }
    } else {
      // Trigger the appropriate boost
      if (type === 'HEAL') {
        scene.health = Math.min(scene.maxHealth, scene.health + 30);
        if (scene.effectsManager) {
          scene.effectsManager.emitHealEffect(player.x, player.y);
        }
        // Trigger Repair Surge kinetic shockwave!
        scene.triggerRepairSurge(player.x, player.y);
        // Temporary shield shimmer (1 second)
        scene.isShielded = true;
        scene.shieldTime = 1000;
      } else if (type === 'SHIELD') {
        scene.isShielded = true;
        scene.shieldTime = 6000;
        scene.dispatchMetricsToReact();
      } else if (type === 'RAPID') {
        scene.isRapidFire = true;
        scene.rapidFireTime = 6000;
        scene.dispatchMetricsToReact();
      } else {
        scene.boostManager.activateBoost(type);
      }

      // Play custom jingle and text
      synthAudio.playPickup(type === 'HEAL' || type === 'SHIELD' || type === 'RAPID' ? type : 'SHIELD');
      
      if (scene.effectsManager) {
        scene.effectsManager.emitPickupBurst(item.x, item.y, type);
        scene.effectsManager.showFloatingText(
          item.x, item.y,
          type.replace('_', ' '),
          type === 'HEAL' ? '#39ff14' : type === 'SHIELD' ? '#00f0ff' : '#ff00ff'
        );
      }
    }

    const glow = item.getData('glow');
    if (glow) glow.destroy();
    item.destroy();
  }
}
