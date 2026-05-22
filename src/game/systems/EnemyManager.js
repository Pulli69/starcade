import Phaser from 'phaser';
import { DEPTH } from './BoostManager';
import synthAudio from '../utils/synthAudio';

/**
 * EnemyManager System
 * Manages Drones, Hunters, Bombers, Shield Protectors, and Sniper Interceptors.
 */
export default class EnemyManager {
  constructor(scene) {
    this.scene = scene;
    this.maxEnemies = 32;

    // AI Director: coordinated squad attack system
    this.squadState = {
      attackSlots: 2,
      roleTimer: 0,
      roleCycleDuration: 3500
    };
    this.healGraphics = null;
  }

  create() {
    // Enemy textures are generated dynamically in the scene generator
  }

  update(time) {
    const { scene } = this;
    if (!scene.enemies) return;
    const enemies = scene.enemies.getChildren();

    if (!this.targetingGraphics) {
      this.targetingGraphics = scene.add.graphics().setDepth(DEPTH.ENEMY + 5);
    }
    this.targetingGraphics.clear();
    this.targetingGraphics.lineStyle(1.5, 0xff0000, 0.85);

    // Freeze enemies if dialogue is active
    if (scene.isCombatFrozen) {
      for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        if (!enemy.active) continue;

        // Set velocity to zero to freeze in place
        enemy.setVelocity(0, 0);

        // Keep outline synced and visible
        const outline = enemy.getData('outlineSprite');
        if (outline) {
          outline.setPosition(enemy.x, enemy.y);
          outline.setRotation(enemy.rotation);
          outline.setScale(enemy.scaleX * 1.28);
          outline.setVisible(enemy.visible);
          outline.setAlpha(enemy.alpha);
        }

        // Draw high-tech HUD targeting brackets
        const size = Math.max(enemy.width, enemy.height) * enemy.scaleX * 0.72;
        const len = size * 0.35;
        
        // Top-Left
        this.targetingGraphics.beginPath();
        this.targetingGraphics.moveTo(enemy.x - size, enemy.y - size + len);
        this.targetingGraphics.lineTo(enemy.x - size, enemy.y - size);
        this.targetingGraphics.lineTo(enemy.x - size + len, enemy.y - size);
        this.targetingGraphics.strokePath();

        // Top-Right
        this.targetingGraphics.beginPath();
        this.targetingGraphics.moveTo(enemy.x + size, enemy.y - size + len);
        this.targetingGraphics.lineTo(enemy.x + size, enemy.y - size);
        this.targetingGraphics.lineTo(enemy.x + size - len, enemy.y - size);
        this.targetingGraphics.strokePath();

        // Bottom-Left
        this.targetingGraphics.beginPath();
        this.targetingGraphics.moveTo(enemy.x - size, enemy.y + size - len);
        this.targetingGraphics.lineTo(enemy.x - size, enemy.y + size);
        this.targetingGraphics.lineTo(enemy.x - size + len, enemy.y + size);
        this.targetingGraphics.strokePath();

        // Bottom-Right
        this.targetingGraphics.beginPath();
        this.targetingGraphics.moveTo(enemy.x + size, enemy.y + size - len);
        this.targetingGraphics.lineTo(enemy.x + size, enemy.y + size);
        this.targetingGraphics.lineTo(enemy.x + size - len, enemy.y + size);
        this.targetingGraphics.strokePath();
      }
      return;
    }

    // AI Director: assign squad roles to coordinate attacks
    this.updateSquadDirector(time, enemies);

    // Heal beam graphics (shared across all shield enemies)
    if (!this.healGraphics) {
      this.healGraphics = this.scene.add.graphics().setDepth(DEPTH.ENEMY + 2);
    }
    this.healGraphics.clear();

    for (let i = enemies.length - 1; i >= 0; i--) {
      const enemy = enemies[i];
      
      // Clean up outline sprite if enemy is no longer active
      const outline = enemy.getData('outlineSprite');
      if (!enemy.active) {
        if (outline) {
          outline.destroy();
          enemy.setData('outlineSprite', null);
        }
        continue;
      }

      // Sync red outline sprite position, rotation, scaleX, and visibility
      if (outline) {
        outline.setPosition(enemy.x, enemy.y);
        outline.setRotation(enemy.rotation);
        outline.setScale(enemy.scaleX * 1.28); // Increased size to show outside the ship
        outline.setVisible(enemy.visible);
        outline.setAlpha(enemy.alpha);
      }

      // Draw high-tech HUD targeting brackets around the enemy
      const size = Math.max(enemy.width, enemy.height) * enemy.scaleX * 0.72;
      const len = size * 0.35;
      
      // Top-Left
      this.targetingGraphics.beginPath();
      this.targetingGraphics.moveTo(enemy.x - size, enemy.y - size + len);
      this.targetingGraphics.lineTo(enemy.x - size, enemy.y - size);
      this.targetingGraphics.lineTo(enemy.x - size + len, enemy.y - size);
      this.targetingGraphics.strokePath();

      // Top-Right
      this.targetingGraphics.beginPath();
      this.targetingGraphics.moveTo(enemy.x + size, enemy.y - size + len);
      this.targetingGraphics.lineTo(enemy.x + size, enemy.y - size);
      this.targetingGraphics.lineTo(enemy.x + size - len, enemy.y - size);
      this.targetingGraphics.strokePath();

      // Bottom-Left
      this.targetingGraphics.beginPath();
      this.targetingGraphics.moveTo(enemy.x - size, enemy.y + size - len);
      this.targetingGraphics.lineTo(enemy.x - size, enemy.y + size);
      this.targetingGraphics.lineTo(enemy.x - size + len, enemy.y + size);
      this.targetingGraphics.strokePath();

      // Bottom-Right
      this.targetingGraphics.beginPath();
      this.targetingGraphics.moveTo(enemy.x + size, enemy.y + size - len);
      this.targetingGraphics.lineTo(enemy.x + size, enemy.y + size);
      this.targetingGraphics.lineTo(enemy.x + size - len, enemy.y + size);
      this.targetingGraphics.strokePath();

      if (enemy.getData('isHelperDrone')) {
        this.updateDrone(enemy, time);
        continue;
      }

      const type = enemy.getData('type');
      if (type === 'drone') {
        this.updateDrone(enemy, time);
      } else if (type === 'hunter') {
        this.updateHunter(enemy, time);
      } else if (type === 'bomber') {
        this.updateBomber(enemy, time);
      } else if (type === 'shield') {
        this.updateShield(enemy, time);
      } else if (type === 'sniper') {
        this.updateSniper(enemy, time);
      }
    }
  }

  updateDrone(enemy, time) {
    const player = this.scene.player;
    if (!player || !player.active) return;

    // AI: Dodge incoming player bullets
    if (this.tryDodge(enemy, time)) return;

    const speed = enemy.getData('speed') || 180;
    const wobbleAmp = enemy.getData('wobbleAmp') || 2.0;
    const wobbleFreq = enemy.getData('wobbleFreq') || 0.003;
    const role = enemy.getData('squadRole') || 'attacker';

    const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, player.x, player.y);
    const dist = Phaser.Math.Distance.Between(enemy.x, enemy.y, player.x, player.y);
    const wobbleAngle = Math.sin(time * wobbleFreq + enemy.getData('wobbleOffset')) * wobbleAmp;

    if (role === 'flanker') {
      // Flankers orbit the player instead of charging directly
      const orbitAngle = angle + Math.PI / 2;
      if (dist > 260) {
        const blend = angle * 0.6 + orbitAngle * 0.4;
        enemy.setVelocity(Math.cos(blend) * speed * 0.7, Math.sin(blend) * speed * 0.7);
      } else if (dist < 150) {
        const retreat = angle + Math.PI;
        const blend = retreat * 0.5 + orbitAngle * 0.5;
        enemy.setVelocity(Math.cos(blend) * speed * 0.8, Math.sin(blend) * speed * 0.8);
      } else {
        enemy.setVelocity(Math.cos(orbitAngle) * speed * 0.6, Math.sin(orbitAngle) * speed * 0.6);
      }
    } else {
      // Attacker: chase with wobble
      const moveAngle = angle + wobbleAngle;
      enemy.setVelocity(Math.cos(moveAngle) * speed, Math.sin(moveAngle) * speed);
    }

    enemy.setRotation(angle + Math.PI / 2);

    const trail = enemy.getData('trailEmitter');
    if (trail && trail.active) {
      trail.setPosition(enemy.x, enemy.y);
    }
  }

  updateHunter(enemy, time) {
    const player = this.scene.player;
    if (!player || !player.active) return;

    // AI: Dodge incoming player bullets
    if (this.tryDodge(enemy, time)) return;

    const speed = enemy.getData('speed') || 80;
    const chargeSpeed = enemy.getData('chargeSpeed') || 180;
    const minChargeDist = enemy.getData('minChargeDist') || 200;
    const role = enemy.getData('squadRole') || 'attacker';

    const dist = Phaser.Math.Distance.Between(enemy.x, enemy.y, player.x, player.y);
    const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, player.x, player.y);

    const pulse = 1.3 + Math.sin(time * 0.005 + enemy.getData('pulseOffset')) * 0.2;
    enemy.setScale(pulse);

    if (role === 'attacker') {
      // Attacker: charge at the player
      if (dist > minChargeDist) {
        enemy.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
      } else {
        enemy.setVelocity(Math.cos(angle) * chargeSpeed, Math.sin(angle) * chargeSpeed);
      }
      enemy.setData('isCharging', dist <= minChargeDist);
    } else {
      // Flanker: strafe around the player at medium range
      const orbitAngle = angle + Math.PI / 2;
      if (dist > 320) {
        enemy.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
      } else if (dist < 180) {
        const retreat = angle + Math.PI;
        enemy.setVelocity(Math.cos(retreat) * speed, Math.sin(retreat) * speed);
      } else {
        enemy.setVelocity(Math.cos(orbitAngle) * speed * 0.9, Math.sin(orbitAngle) * speed * 0.9);
      }
      enemy.setData('isCharging', false);
    }

    enemy.setRotation(angle + Math.PI / 2);

    const trail = enemy.getData('trailEmitter');
    if (trail && trail.active) {
      trail.setPosition(enemy.x, enemy.y);
    }
  }

  updateBomber(enemy, time) {
    const { scene } = this;
    const player = scene.player;
    if (!player || !player.active) return;

    const speed = enemy.getData('speed') || 50;
    const dist = Phaser.Math.Distance.Between(enemy.x, enemy.y, player.x, player.y);
    const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, player.x, player.y);

    // Reposition: Bomber stays back and drifts
    if (dist > 420) {
      enemy.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    } else if (dist < 280) {
      enemy.setVelocity(-Math.cos(angle) * speed, -Math.sin(angle) * speed);
    } else {
      enemy.setVelocity(
        Math.sin(time * 0.001) * speed * 0.8,
        Math.cos(time * 0.001) * speed * 0.8
      );
    }
    enemy.setRotation(angle + Math.PI / 2);

    let g = enemy.getData('warningGraphics');
    if (!g) {
      g = scene.add.graphics().setDepth(DEPTH.BULLET - 1);
      enemy.setData('warningGraphics', g);
    }

    // Fire homing rocket
    const nextFire = enemy.getData('nextFire') || 0;
    
    // Bomber telegraph warning: 800ms before firing
    if (time > nextFire - 800 && time < nextFire) {
      g.clear();
      const progress = (nextFire - time) / 800; // 1.0 down to 0.0
      const warningRadius = 16 + progress * 40;
      g.lineStyle(2.5, 0xff6600, 0.85);
      g.strokeCircle(enemy.x, enemy.y, warningRadius);
      g.fillStyle(0xff6600, 0.15 * (1.0 - progress));
      g.fillCircle(enemy.x, enemy.y, warningRadius);
    }

    if (time > nextFire && (enemy.getData('squadRole') || 'attacker') === 'attacker') {
      g.clear();
      enemy.setData('nextFire', time + 4500); // 4.5s cooldown
      this.fireHomingRocket(enemy);
    }

    const trail = enemy.getData('trailEmitter');
    if (trail && trail.active) {
      trail.setPosition(enemy.x, enemy.y);
    }
  }

  fireHomingRocket(enemy) {
    const { scene } = this;
    if (!scene.bomberRockets) return;

    synthAudio.playDamage(); // Warning sound
    const rocket = scene.bomberRockets.create(enemy.x, enemy.y, 'homingRocketTexture');
    rocket.setDepth(DEPTH.BULLET);
    rocket.setData('hp', 1);
    rocket.setData('damage', 18);
    rocket.setScale(1.1);

    const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, scene.player.x, scene.player.y);
    rocket.setVelocity(Math.cos(angle) * 140, Math.sin(angle) * 140);
    rocket.setRotation(angle);

    // Attach rocket particles
    const trail = scene.add.particles(0, 0, 'bomberTrailTexture', {
      speed: { min: 2, max: 6 },
      scale: { start: 0.6, end: 0 },
      alpha: { start: 0.6, end: 0 },
      lifespan: 300,
      frequency: 45,
      quantity: 1,
      blendMode: 'ADD',
      follow: rocket
    });
    trail.setDepth(DEPTH.ENEMY_TRAIL);
    rocket.setData('trail', trail);
  }

  updateShield(enemy, time) {
    const { scene } = this;
    const player = scene.player;
    if (!player || !player.active) return;

    // Find nearest non-shield enemy to protect
    let target = null;
    let minDist = 999999;
    scene.enemies.getChildren().forEach(other => {
      if (!other.active || other === enemy || other.getData('type') === 'shield') return;
      const d = Phaser.Math.Distance.Between(enemy.x, enemy.y, other.x, other.y);
      if (d < minDist) {
        minDist = d;
        target = other;
      }
    });

    const destX = target ? target.x : player.x;
    const destY = target ? target.y : player.y;
    const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, destX, destY);
    const speed = enemy.getData('speed') || 95;

    enemy.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    enemy.setRotation(angle + Math.PI / 2);

    // Pulse shield state (active for 2.8 seconds, off for 1.4 seconds)
    const cycle = time % 4200;
    const shieldActive = cycle < 2800;
    enemy.setData('shieldActive', shieldActive);

    let g = enemy.getData('shieldGraphics');
    if (!g) {
      g = scene.add.graphics().setDepth(DEPTH.ENEMY + 1);
      enemy.setData('shieldGraphics', g);
    }
    g.clear();

    if (shieldActive) {
      const pulseRadius = 24 + Math.sin(time * 0.015) * 3;
      g.lineStyle(2.5, 0x39ff14, 0.7 + Math.sin(time * 0.01) * 0.15);
      g.strokeCircle(enemy.x, enemy.y, pulseRadius);
      g.fillStyle(0x39ff14, 0.07);
      g.fillCircle(enemy.x, enemy.y, pulseRadius);
    } else {
      g.lineStyle(1.5, 0xffea00, 0.25);
      g.strokeCircle(enemy.x, enemy.y, 22);
    }

    // Healing Aura: repair nearby allies when shield is active
    if (shieldActive) {
      const healTimer = enemy.getData('healTimer') || 0;
      if (time > healTimer) {
        enemy.setData('healTimer', time + 2500);
        const allies = scene.enemies.getChildren();
        for (const other of allies) {
          if (!other.active || other === enemy) continue;
          const d = Phaser.Math.Distance.Between(enemy.x, enemy.y, other.x, other.y);
          if (d < 160) {
            const curHp = other.getData('hp');
            const maxHp = other.getData('maxHp');
            if (curHp < maxHp) {
              other.setData('hp', Math.min(maxHp, curHp + 1));
              if (this.scene.effectsManager) {
                this.scene.effectsManager.showFloatingText(
                  other.x, other.y - 15, 'REPAIR +1', '#39ff14', '10px'
                );
              }
            }
          }
        }
      }
      // Draw heal beams to nearby allies
      if (this.healGraphics) {
        const allies = scene.enemies.getChildren();
        for (const other of allies) {
          if (!other.active || other === enemy) continue;
          const d = Phaser.Math.Distance.Between(enemy.x, enemy.y, other.x, other.y);
          if (d < 160) {
            this.healGraphics.lineStyle(1.5, 0x39ff14, 0.4 + Math.sin(time * 0.01) * 0.2);
            this.healGraphics.beginPath();
            this.healGraphics.moveTo(enemy.x, enemy.y);
            this.healGraphics.lineTo(other.x, other.y);
            this.healGraphics.strokePath();
          }
        }
      }
    }

    const trail = enemy.getData('trailEmitter');
    if (trail && trail.active) {
      trail.setPosition(enemy.x, enemy.y);
    }
  }

  updateSniper(enemy, time) {
    const { scene } = this;
    const player = scene.player;
    if (!player || !player.active) return;

    const speed = enemy.getData('speed') || 75;
    const dist = Phaser.Math.Distance.Between(enemy.x, enemy.y, player.x, player.y);
    const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, player.x, player.y);

    const state = enemy.getData('sniperState') || 'move';
    const nextAction = enemy.getData('nextAction') || 0;

    let g = enemy.getData('warningGraphics');
    if (!g) {
      g = scene.add.graphics().setDepth(DEPTH.BULLET - 1);
      enemy.setData('warningGraphics', g);
    }

    if (state === 'move') {
      g.clear();
      enemy.setRotation(angle + Math.PI / 2);

      if (dist > 460) {
        enemy.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
      } else if (dist < 320) {
        enemy.setVelocity(-Math.cos(angle) * speed, -Math.sin(angle) * speed);
      } else {
        // Orbit/Strafe
        enemy.setVelocity(-Math.sin(angle) * speed * 0.9, Math.cos(angle) * speed * 0.9);
      }

      if (time > nextAction && (enemy.getData('squadRole') || 'attacker') === 'attacker') {
        enemy.setData('sniperState', 'charge');
        enemy.setData('nextAction', time + 1300); // 1.3s charge
        enemy.setVelocity(0, 0); // Lock in place
      }
    } else if (state === 'charge') {
      enemy.setRotation(angle + Math.PI / 2);

      // Render red warning line
      g.clear();
      g.lineStyle(1.5, 0xff0055, 0.4 + Math.sin(time * 0.03) * 0.35);
      g.beginPath();
      g.moveTo(enemy.x, enemy.y);
      g.lineTo(player.x, player.y);
      g.stroke();

      if (time > nextAction) {
        this.fireSniperBullet(enemy, angle);
        g.clear();
        enemy.setData('sniperState', 'move');
        enemy.setData('nextAction', time + 3200); // 3.2s cooldown
      }
    }

    const trail = enemy.getData('trailEmitter');
    if (trail && trail.active) {
      trail.setPosition(enemy.x, enemy.y);
    }
  }

  fireSniperBullet(enemy, angle) {
    const { scene } = this;
    if (!scene.enemiesBullets) return;

    synthAudio.playLaser();
    const b = scene.enemiesBullets.create(enemy.x, enemy.y, 'sniperBulletTexture');
    b.setDepth(DEPTH.BULLET);
    b.setRotation(angle);
    b.setBlendMode(Phaser.BlendModes.ADD);
    b.setVelocity(Math.cos(angle) * 750, Math.sin(angle) * 750);
    b.setData('damage', 20);
    b.setData('isHoming', true);
    b.setScale(1.2);

    // Yellow particle trail for motion streaks
    const trail = scene.add.particles(0, 0, 'sniperTrailTexture', {
      speed: 0,
      scale: { start: 1.0, end: 0.1 },
      alpha: { start: 0.55, end: 0 },
      lifespan: 140,
      frequency: 18,
      blendMode: 'ADD',
      follow: b
    });
    trail.setDepth(DEPTH.BULLET - 1);
    b.setData('trail', trail);
  }

  /* ==================================================================
     AI DIRECTOR — SQUAD COORDINATION
     ================================================================== */

  updateSquadDirector(time, enemies) {
    if (time < this.squadState.roleTimer) return;
    this.squadState.roleTimer = time + this.squadState.roleCycleDuration;

    const active = enemies.filter(e => e.active && !e.getData('isHelperDrone'));
    if (active.length === 0) return;

    const combatants = [];
    active.forEach(e => {
      const t = e.getData('type');
      if (t === 'shield') {
        e.setData('squadRole', 'support');
      } else {
        combatants.push(e);
      }
    });

    // Shuffle and assign: ~40% attackers, rest flankers
    Phaser.Utils.Array.Shuffle(combatants);
    const maxAttackers = Math.max(1, Math.min(this.squadState.attackSlots, Math.ceil(combatants.length * 0.4)));

    for (let i = 0; i < combatants.length; i++) {
      combatants[i].setData('squadRole', i < maxAttackers ? 'attacker' : 'flanker');
    }
  }

  /**
   * AI Dodge: Agile enemies (drones, hunters) evade incoming player bullets.
   * Returns true if the enemy is currently dodging and normal movement should be skipped.
   */
  tryDodge(enemy, time) {
    const type = enemy.getData('type');
    if (type !== 'drone' && type !== 'hunter') return false;

    // Check if still in a dodge animation
    const dodgeEnd = enemy.getData('dodgeEndTime') || 0;
    if (time < dodgeEnd) return true;

    const dodgeCooldown = enemy.getData('dodgeCooldown') || 0;
    if (time < dodgeCooldown) return false;

    const scene = this.scene;
    if (!scene.bullets) return false;

    const bullets = scene.bullets.getChildren();
    for (const b of bullets) {
      if (!b.active || !b.body) continue;
      const dist = Phaser.Math.Distance.Between(enemy.x, enemy.y, b.x, b.y);
      if (dist > 130) continue;

      const bVx = b.body.velocity.x;
      const bVy = b.body.velocity.y;
      const bSpeed = Math.sqrt(bVx * bVx + bVy * bVy);
      if (bSpeed < 10) continue;

      // Dot product: is bullet moving toward this enemy?
      const toX = enemy.x - b.x;
      const toY = enemy.y - b.y;
      const dot = (bVx * toX + bVy * toY) / (bSpeed * dist);

      if (dot > 0.55) {
        const bAngle = Math.atan2(bVy, bVx);
        const dodgeDir = Math.random() > 0.5 ? 1 : -1;
        const dodgeAngle = bAngle + dodgeDir * Math.PI / 2;
        const dodgeSpeed = 380;

        enemy.setVelocity(
          Math.cos(dodgeAngle) * dodgeSpeed,
          Math.sin(dodgeAngle) * dodgeSpeed
        );
        enemy.setData('dodgeCooldown', time + 1400);
        enemy.setData('dodgeEndTime', time + 180);
        return true;
      }
    }
    return false;
  }

  spawnEnemy(type, x, y) {
    const { scene } = this;
    if (scene.enemies.countActive() >= this.maxEnemies) return null;

    let enemy = null;
    switch (type) {
      case 'drone': enemy = this.spawnDrone(x, y); break;
      case 'hunter': enemy = this.spawnHunter(x, y); break;
      case 'bomber': enemy = this.spawnBomber(x, y); break;
      case 'shield': enemy = this.spawnShield(x, y); break;
      case 'sniper': enemy = this.spawnSniper(x, y); break;
    }

    if (enemy) {
      // Create red outline sprite behind the enemy ship for high visibility target recognition
      const outline = scene.add.sprite(x, y, enemy.texture.key);
      outline.setScale(enemy.scale * 1.15);
      outline.setTint(0xff0000);
      outline.setDepth(DEPTH.ENEMY - 1);
      enemy.setData('outlineSprite', outline);

      if (enemy.preFX && enemy.getData('color')) {
        enemy.preFX.addGlow(enemy.getData('color'), 2.5, 0, false, 0.1, 15);
      }
    }
    return enemy;
  }

  spawnDrone(x, y) {
    const { scene } = this;
    const wave = scene.wave;
    const enemy = scene.enemies.create(x, y, 'droneTexture');
    enemy.setCollideWorldBounds(true);
    enemy.setDepth(DEPTH.ENEMY);
    enemy.setScale(1.4);

    const hp = 1 + Math.floor(wave / 3);
    const speed = Phaser.Math.Between(160, 240) + wave * 3;

    enemy.setData('type', 'drone');
    enemy.setData('hp', hp);
    enemy.setData('maxHp', hp);
    enemy.setData('speed', speed);
    enemy.setData('damage', 8);
    enemy.setData('points', 20 + wave * 2);
    enemy.setData('wobbleAmp', Phaser.Math.FloatBetween(1.0, 3.0));
    enemy.setData('wobbleFreq', Phaser.Math.FloatBetween(0.002, 0.005));
    enemy.setData('wobbleOffset', Phaser.Math.FloatBetween(0, Math.PI * 2));
    enemy.setData('color', 0x00f0ff);

    const trail = scene.add.particles(0, 0, 'droneTrailTexture', {
      speed: { min: 5, max: 15 },
      scale: { start: 0.6, end: 0 },
      alpha: { start: 0.5, end: 0 },
      lifespan: 300,
      frequency: 30,
      quantity: 1,
      blendMode: 'ADD',
      follow: enemy
    });
    trail.setDepth(DEPTH.ENEMY_TRAIL);
    enemy.setData('trailEmitter', trail);

    return enemy;
  }

  spawnHunter(x, y) {
    const { scene } = this;
    const wave = scene.wave;
    const enemy = scene.enemies.create(x, y, 'hunterTexture');
    enemy.setCollideWorldBounds(true);
    enemy.setDepth(DEPTH.ENEMY);

    const hp = 3 + Math.floor(wave / 2);
    const speed = Phaser.Math.Between(60, 90) + wave * 2;

    enemy.setData('type', 'hunter');
    enemy.setData('hp', hp);
    enemy.setData('maxHp', hp);
    enemy.setData('speed', speed);
    enemy.setData('chargeSpeed', speed * 2.2);
    enemy.setData('damage', 14);
    enemy.setData('minChargeDist', Phaser.Math.Between(150, 250));
    enemy.setData('points', 40 + wave * 5);
    enemy.setData('pulseOffset', Phaser.Math.FloatBetween(0, Math.PI * 2));
    enemy.setData('isCharging', false);
    enemy.setData('color', 0xff00ff);

    const trail = scene.add.particles(0, 0, 'hunterTrailTexture', {
      speed: { min: 3, max: 10 },
      scale: { start: 0.8, end: 0 },
      alpha: { start: 0.4, end: 0 },
      lifespan: 450,
      frequency: 50,
      quantity: 1,
      blendMode: 'ADD',
      follow: enemy
    });
    trail.setDepth(DEPTH.ENEMY_TRAIL);
    enemy.setData('trailEmitter', trail);

    return enemy;
  }

  spawnBomber(x, y) {
    const { scene } = this;
    const wave = scene.wave;
    const enemy = scene.enemies.create(x, y, 'bomberTexture');
    enemy.setCollideWorldBounds(true);
    enemy.setDepth(DEPTH.ENEMY);
    enemy.setScale(1.8);

    const hp = 6 + Math.floor(wave / 1.5);
    const speed = Phaser.Math.Between(45, 65) + wave * 1.5;

    enemy.setData('type', 'bomber');
    enemy.setData('hp', hp);
    enemy.setData('maxHp', hp);
    enemy.setData('speed', speed);
    enemy.setData('damage', 15);
    enemy.setData('points', 70 + wave * 6);
    enemy.setData('nextFire', scene.time.now + Phaser.Math.Between(1500, 3000));
    enemy.setData('color', 0xff5500);
    enemy.setData('gravityResistant', true);

    const trail = scene.add.particles(0, 0, 'bomberTrailTexture', {
      speed: { min: 4, max: 12 },
      scale: { start: 0.9, end: 0 },
      alpha: { start: 0.5, end: 0 },
      lifespan: 500,
      frequency: 45,
      quantity: 1,
      blendMode: 'ADD',
      follow: enemy
    });
    trail.setDepth(DEPTH.ENEMY_TRAIL);
    enemy.setData('trailEmitter', trail);

    return enemy;
  }

  spawnShield(x, y) {
    const { scene } = this;
    const wave = scene.wave;
    const enemy = scene.enemies.create(x, y, 'shieldTexture');
    enemy.setCollideWorldBounds(true);
    enemy.setDepth(DEPTH.ENEMY);
    enemy.setScale(1.5);

    const hp = 4 + Math.floor(wave / 2);
    const speed = Phaser.Math.Between(80, 110) + wave * 2;

    enemy.setData('type', 'shield');
    enemy.setData('hp', hp);
    enemy.setData('maxHp', hp);
    enemy.setData('speed', speed);
    enemy.setData('damage', 10);
    enemy.setData('points', 60 + wave * 5);
    enemy.setData('shieldActive', true);
    enemy.setData('color', 0x39ff14);

    const trail = scene.add.particles(0, 0, 'shieldTrailTexture', {
      speed: { min: 3, max: 9 },
      scale: { start: 0.7, end: 0 },
      alpha: { start: 0.45, end: 0 },
      lifespan: 400,
      frequency: 40,
      quantity: 1,
      blendMode: 'ADD',
      follow: enemy
    });
    trail.setDepth(DEPTH.ENEMY_TRAIL);
    enemy.setData('trailEmitter', trail);

    return enemy;
  }

  spawnSniper(x, y) {
    const { scene } = this;
    const wave = scene.wave;
    const enemy = scene.enemies.create(x, y, 'sniperTexture');
    enemy.setCollideWorldBounds(true);
    enemy.setDepth(DEPTH.ENEMY);
    enemy.setScale(1.5);

    const hp = 3 + Math.floor(wave / 2.5);
    const speed = Phaser.Math.Between(70, 95) + wave * 2.2;

    enemy.setData('type', 'sniper');
    enemy.setData('hp', hp);
    enemy.setData('maxHp', hp);
    enemy.setData('speed', speed);
    enemy.setData('damage', 12);
    enemy.setData('points', 80 + wave * 7);
    enemy.setData('sniperState', 'move');
    enemy.setData('nextAction', scene.time.now + Phaser.Math.Between(2000, 4000));
    enemy.setData('color', 0xffea00);

    const trail = scene.add.particles(0, 0, 'sniperTrailTexture', {
      speed: { min: 2, max: 8 },
      scale: { start: 0.7, end: 0 },
      alpha: { start: 0.5, end: 0 },
      lifespan: 350,
      frequency: 35,
      quantity: 1,
      blendMode: 'ADD',
      follow: enemy
    });
    trail.setDepth(DEPTH.ENEMY_TRAIL);
    enemy.setData('trailEmitter', trail);

    return enemy;
  }

  destroyEnemy(enemy) {
    const trail = enemy.getData('trailEmitter');
    if (trail) trail.destroy();

    const sg = enemy.getData('shieldGraphics');
    if (sg) sg.destroy();

    const wg = enemy.getData('warningGraphics');
    if (wg) wg.destroy();

    const outline = enemy.getData('outlineSprite');
    if (outline) outline.destroy();

    enemy.destroy();
  }

  destroy() {
    const enemies = this.scene.enemies.getChildren();
    for (const enemy of enemies) {
      const trail = enemy.getData('trailEmitter');
      if (trail) trail.destroy();
      const sg = enemy.getData('shieldGraphics');
      if (sg) sg.destroy();
      const wg = enemy.getData('warningGraphics');
      if (wg) wg.destroy();
      const outline = enemy.getData('outlineSprite');
      if (outline) outline.destroy();
    }
    if (this.healGraphics) {
      this.healGraphics.destroy();
      this.healGraphics = null;
    }
    if (this.targetingGraphics) {
      this.targetingGraphics.destroy();
      this.targetingGraphics = null;
    }
  }
}
