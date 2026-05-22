import Phaser from 'phaser';
import { DEPTH } from './BoostManager';

/**
 * SpaceBackground System
 *
 * Renders a LIVE animated 2D arcade space environment with:
 * - Deep space fog layer
 * - 3 parallax star fields (back, mid, fore)
 * - Pulsating nebula clouds with slow drift
 * - 3D Solar System (Red Sun & Planet drawn procedurally on Canvas + 3D sorting)
 * - Drifting and rotating rocky background asteroids with wrapping boundary simulation
 * - Twinkling individual stars
 * - Floating ambient particles
 * - Galaxy fog overlay
 *
 * Soft blur and dimming filters are applied to all background layers
 * to maintain crisp contrast and gameplay focus on the player and enemies.
 */
export default class SpaceBackground {
  constructor(scene) {
    this.scene = scene;
    this.twinkleStars = [];
    this.nebulae = [];
    this.planets = [];
    this.asteroids = [];
    this.sun = null;
    this.sunGlow = null;
    this.orbitGraphics = null;
  }

  create() {
    const { scene, scene: { ARENA_SIZE } } = this;
    const cx = ARENA_SIZE / 2;
    const cy = ARENA_SIZE / 2;

    // ---- DYNAMIC PROCEDURAL TEXTURES ----
    // Generate Red Sun texture if it doesn't exist
    if (!scene.textures.exists('sunTextureRed')) {
      const sunCanvas = scene.textures.createCanvas('sunTextureRed', 64, 64);
      const ctx = sunCanvas.context;
      const gradient = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
      gradient.addColorStop(0, '#ffffff');
      gradient.addColorStop(0.25, '#ff2b00'); // Neon red flaring core
      gradient.addColorStop(0.6, '#aa0000');
      gradient.addColorStop(0.9, '#550000');
      gradient.addColorStop(1, 'rgba(85,0,0,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(32, 32, 32, 0, Math.PI * 2);
      ctx.fill();
      sunCanvas.refresh();
    }

    // Generate Gas Giant planet texture if it doesn't exist (replacement for PNG planet)
    if (!scene.textures.exists('planetGasGiant')) {
      const planetCanvas = scene.textures.createCanvas('planetGasGiant', 64, 64);
      const ctx = planetCanvas.context;
      const gradient = ctx.createRadialGradient(32, 32, 2, 32, 32, 24);
      gradient.addColorStop(0, '#00f0ff');
      gradient.addColorStop(0.6, '#005f9e');
      gradient.addColorStop(1, 'rgba(0,95,158,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(32, 32, 24, 0, Math.PI * 2);
      ctx.fill();
      // Rings (diagonal ellipse)
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.75)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(32, 32, 28, 6, Math.PI / 6, 0, Math.PI * 2);
      ctx.stroke();
      planetCanvas.refresh();
    }

    // Generate Magma planet texture if it doesn't exist (used for secondary planet)
    if (!scene.textures.exists('planetMagma')) {
      const planetCanvas = scene.textures.createCanvas('planetMagma', 48, 48);
      const ctx = planetCanvas.context;
      const gradient = ctx.createRadialGradient(24, 24, 2, 24, 24, 20);
      gradient.addColorStop(0, '#ff4b00');
      gradient.addColorStop(0.6, '#9d00ff');
      gradient.addColorStop(1, 'rgba(157,0,255,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(24, 24, 20, 0, Math.PI * 2);
      ctx.fill();
      planetCanvas.refresh();
    }

    // Generate Ice planet texture if it doesn't exist (used for tertiary planet)
    if (!scene.textures.exists('planetIce')) {
      const planetCanvas = scene.textures.createCanvas('planetIce', 40, 40);
      const ctx = planetCanvas.context;
      const gradient = ctx.createRadialGradient(20, 20, 2, 20, 20, 16);
      gradient.addColorStop(0, '#ffffff');
      gradient.addColorStop(0.5, '#39ff14');
      gradient.addColorStop(1, 'rgba(57,255,20,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(20, 20, 16, 0, Math.PI * 2);
      ctx.fill();
      planetCanvas.refresh();
    }

    // Generate Rocky Asteroid texture if it doesn't exist
    if (!scene.textures.exists('asteroidTexture')) {
      const astCanvas = scene.textures.createCanvas('asteroidTexture', 48, 48);
      const ctx = astCanvas.context;
      ctx.fillStyle = '#262930'; // dark rock color
      ctx.strokeStyle = '#8b5cf6'; // neon purple accent outline
      ctx.lineWidth = 2.5;

      const numPoints = 8;
      const points = [];
      const cxPoint = 24, cyPoint = 24;
      const rBase = 15;
      for (let i = 0; i < numPoints; i++) {
        const angle = (i / numPoints) * Math.PI * 2;
        const r = rBase + (Math.sin(i * 3) * 3) + (Math.cos(i * 5) * 1.5);
        points.push({
          x: cxPoint + Math.cos(angle) * r,
          y: cyPoint + Math.sin(angle) * r
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

      // Draw craters
      ctx.strokeStyle = '#111317';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(16, 16, 2.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(28, 28, 3.5, 0, Math.PI * 2);
      ctx.stroke();
      astCanvas.refresh();
    }

    // ---- BACKGROUND DEPTH FOCUS FILTER ----
    // Helper function to blur and slightly dim background layers so foreground action stays clear
    const applyBackgroundBlur = (obj, amount = 1) => {
      // Dim opacity
      if (obj.setAlpha && obj !== this.sun && obj !== this.sunGlow) {
        obj.setAlpha(obj.alpha * 0.7);
      }
      // Apply Phaser PostFX blur filter if supported by the running engine instance
      if (obj.postFX && typeof obj.postFX.addBlur === 'function') {
        obj.postFX.addBlur(amount, 0.4, 0.4, 0.5);
      }
    };

    // LAYER 1: Deep space fog (farthest back)
    this.fogTile = scene.add.tileSprite(
      cx, cy, ARENA_SIZE, ARENA_SIZE, 'fogTexture'
    ).setDepth(DEPTH.BG_FOG).setAlpha(0.2);
    applyBackgroundBlur(this.fogTile, 1.5);

    // LAYER 2: Tiny faint stars (parallax x0.03)
    this.starBack = scene.add.tileSprite(
      cx, cy, ARENA_SIZE, ARENA_SIZE, 'starBackTexture'
    ).setDepth(DEPTH.BG_STARS_BACK).setAlpha(0.5);
    applyBackgroundBlur(this.starBack, 1.0);

    // LAYER 3: Nebula clouds
    const nebulaConfigs = [
      { x: 400, y: 400, key: 'nebulaBlueTexture', alpha: 0.22, scale: 2.8, driftX: 0.02, driftY: 0.015 },
      { x: 2000, y: 500, key: 'nebulaPinkTexture', alpha: 0.16, scale: 3.2, driftX: -0.015, driftY: 0.02 },
      { x: 500, y: 2000, key: 'nebulaPurpleTexture', alpha: 0.2, scale: 2.5, driftX: 0.01, driftY: -0.02 },
      { x: 2100, y: 2100, key: 'nebulaBlueTexture', alpha: 0.18, scale: 3.0, driftX: -0.02, driftY: -0.01 },
      { x: 1250, y: 800, key: 'nebulaPinkTexture', alpha: 0.14, scale: 2.2, driftX: 0.025, driftY: 0.01 },
    ];

    nebulaConfigs.forEach((cfg) => {
      const img = scene.add.image(cfg.x, cfg.y, cfg.key)
        .setDepth(DEPTH.BG_NEBULA)
        .setAlpha(cfg.alpha)
        .setScale(cfg.scale);
      img._driftX = cfg.driftX;
      img._driftY = cfg.driftY;
      img._baseX = cfg.x;
      img._baseY = cfg.y;
      this.nebulae.push(img);
      applyBackgroundBlur(img, 1.2);
    });

    // ---- SOLAR SYSTEM (3D Perspective Illusion) ----
    // 1. Draw Orbit Paths (extremely compact)
    this.orbitGraphics = scene.add.graphics().setDepth(DEPTH.BG_NEBULA);
    this.orbitGraphics.lineStyle(1.2, 0x00f0ff, 0.07); // Very faint track lines
    this.orbitGraphics.strokeEllipse(cx, cy, 90 * 2, 45 * 2);
    this.orbitGraphics.strokeEllipse(cx, cy, 160 * 2, 80 * 2);
    this.orbitGraphics.strokeEllipse(cx, cy, 240 * 2, 120 * 2);

    // 2. Central Red Sun (Procedural Canvas)
    this.sun = scene.add.image(cx, cy, 'sunTextureRed')
      .setDepth(DEPTH.BG_NEBULA + 1)
      .setScale(0.7) // Small scale
      .setAlpha(0.8)
      .setTint(0xdddddd);
    
    // Pulsing background sun-corona glow
    this.sunGlow = scene.add.image(cx, cy, 'sunTextureRed')
      .setDepth(DEPTH.BG_NEBULA)
      .setScale(0.9)
      .setAlpha(0.2)
      .setBlendMode('ADD');

    // Apply blur to Sun and its glow
    applyBackgroundBlur(this.sun, 1.2);
    applyBackgroundBlur(this.sunGlow, 1.5);

    // 3. Orbiting Planets (Highly compact radii and scales)
    this.planets = [
      {
        sprite: scene.add.image(cx, cy, 'planetMagma').setDepth(DEPTH.BG_NEBULA + 2),
        rx: 90,
        ry: 45,
        speed: 0.0008,
        offset: 0,
        scale: 0.22
      },
      {
        sprite: scene.add.image(cx, cy, 'planetGasGiant').setDepth(DEPTH.BG_NEBULA + 2),
        rx: 160,
        ry: 80,
        speed: 0.0004,
        offset: Math.PI * 0.7,
        scale: 0.25
      },
      {
        sprite: scene.add.image(cx, cy, 'planetIce').setDepth(DEPTH.BG_NEBULA + 2),
        rx: 240,
        ry: 120,
        speed: 0.0002,
        offset: Math.PI * 1.3,
        scale: 0.2
      }
    ];

    this.planets.forEach((p) => {
      p.sprite.setAlpha(0.85);
      p.sprite.setTint(0xdddddd);
      applyBackgroundBlur(p.sprite, 1.0);
    });

    // LAYER 4: Medium twinkling stars
    this.starMid = scene.add.tileSprite(
      cx, cy, ARENA_SIZE, ARENA_SIZE, 'starMidTexture'
    ).setDepth(DEPTH.BG_STARS_MID).setAlpha(0.65);
    applyBackgroundBlur(this.starMid, 0.5);

    // Individual twinkling stars
    for (let i = 0; i < 30; i++) {
      const star = scene.add.image(
        Phaser.Math.Between(50, ARENA_SIZE - 50),
        Phaser.Math.Between(50, ARENA_SIZE - 50),
        'twinkleStarTexture'
      ).setDepth(DEPTH.BG_TWINKLE)
       .setAlpha(Phaser.Math.FloatBetween(0.2, 0.7))
       .setScale(Phaser.Math.FloatBetween(0.4, 1.2));

      star._twinkleSpeed = Phaser.Math.FloatBetween(1.5, 4.0);
      star._twinkleOffset = Phaser.Math.FloatBetween(0, Math.PI * 2);
      this.twinkleStars.push(star);
    }

    // ---- FLOATING BACKGROUND ASTEROIDS ----
    for (let i = 0; i < 8; i++) {
      const ast = scene.add.image(
        Phaser.Math.Between(100, ARENA_SIZE - 100),
        Phaser.Math.Between(100, ARENA_SIZE - 100),
        'asteroidTexture'
      ).setDepth(DEPTH.BG_STARS_MID)
       .setScale(Phaser.Math.FloatBetween(0.6, 1.3))
       .setAlpha(0.45); // Fade slightly to keep in background
      
      ast._driftSpeedX = Phaser.Math.FloatBetween(-6, 6);
      ast._driftSpeedY = Phaser.Math.FloatBetween(-6, 6);
      ast._rotSpeed = Phaser.Math.FloatBetween(-0.4, 0.4);
      ast._driftX = ast.x;
      ast._driftY = ast.y;
      
      applyBackgroundBlur(ast, 0.6);
      this.asteroids.push(ast);
    }

    // LAYER 5: Bright foreground stars
    this.starFore = scene.add.tileSprite(
      cx, cy, ARENA_SIZE, ARENA_SIZE, 'starForeTexture'
    ).setDepth(DEPTH.BG_STARS_FORE).setAlpha(0.7);

    // LAYER 6: Floating ambient particles
    this.ambientParticles = scene.add.particles(0, 0, 'ambientParticleTexture', {
      x: { min: 0, max: ARENA_SIZE },
      y: { min: 0, max: ARENA_SIZE },
      speed: { min: 5, max: 25 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.6, end: 0 },
      alpha: { start: 0.4, end: 0 },
      lifespan: { min: 6000, max: 12000 },
      frequency: 400,
      quantity: 1,
      blendMode: 'ADD',
      emitZone: {
        type: 'random',
        source: new Phaser.Geom.Rectangle(0, 0, ARENA_SIZE, ARENA_SIZE)
      }
    });
    this.ambientParticles.setDepth(DEPTH.BG_AMBIENT);

    // LAYER 7: Subtle galaxy fog overlay
    this.galaxyFog = scene.add.tileSprite(
      cx, cy, ARENA_SIZE, ARENA_SIZE, 'galaxyFogTexture'
    ).setDepth(DEPTH.BG_GALAXY_FOG).setAlpha(0.08);
    applyBackgroundBlur(this.galaxyFog, 1.2);
  }

  update(time) {
    const { scene, scene: { ARENA_SIZE } } = this;
    const cx = ARENA_SIZE / 2;
    const cy = ARENA_SIZE / 2;

    const scrollX = scene.cameras.main.scrollX;
    const scrollY = scene.cameras.main.scrollY;

    this.fogTile.tilePositionX = scrollX * 0.01;
    this.fogTile.tilePositionY = scrollY * 0.01;
    this.starBack.tilePositionX = scrollX * 0.03;
    this.starBack.tilePositionY = scrollY * 0.03;
    this.starMid.tilePositionX = scrollX * 0.08;
    this.starMid.tilePositionY = scrollY * 0.08;
    this.starFore.tilePositionX = scrollX * 0.18;
    this.starFore.tilePositionY = scrollY * 0.18;
    this.galaxyFog.tilePositionX = scrollX * 0.04;
    this.galaxyFog.tilePositionY = scrollY * 0.04;

    // Nebula drift + parallax (-0.04 scroll factor)
    this.nebulae.forEach((neb) => {
      const t = time / 1000;
      neb.x = (neb._baseX + Math.sin(t * neb._driftX * 5) * 30) - scrollX * (-0.04);
      neb.y = (neb._baseY + Math.cos(t * neb._driftY * 5) * 30) - scrollY * (-0.04);
      neb.setAlpha(0.14 + Math.sin(t * 0.3 + neb._driftX * 10) * 0.06);
    });

    // Twinkling stars
    this.twinkleStars.forEach((star) => {
      const t = time / 1000;
      star.setAlpha(0.2 + Math.sin(t * star._twinkleSpeed + star._twinkleOffset) * 0.25);
    });

    // Rotate and pulse the Sun with parallax offset (-0.02 scroll factor)
    const t = time / 1000;
    const offsetX = -scrollX * (-0.02);
    const offsetY = -scrollY * (-0.02);

    if (this.sun) {
      this.sun.x = cx + offsetX;
      this.sun.y = cy + offsetY;
      this.sun.setAngle(t * 1.5);
    }
    if (this.sunGlow) {
      this.sunGlow.x = cx + offsetX;
      this.sunGlow.y = cy + offsetY;
      this.sunGlow.setScale(0.9 + Math.sin(t * 3.5) * 0.06);
      this.sunGlow.setAlpha(0.15 + Math.sin(t * 3.5) * 0.04);
    }

    // Redraw orbits with parallax offset
    if (this.orbitGraphics) {
      this.orbitGraphics.clear();
      this.orbitGraphics.lineStyle(1.2, 0x00f0ff, 0.07);
      this.orbitGraphics.strokeEllipse(cx + offsetX, cy + offsetY, 90 * 2, 45 * 2);
      this.orbitGraphics.strokeEllipse(cx + offsetX, cy + offsetY, 160 * 2, 80 * 2);
      this.orbitGraphics.strokeEllipse(cx + offsetX, cy + offsetY, 240 * 2, 120 * 2);
    }

    // Move and depth-sort planets for 3D illusion
    this.planets.forEach((p) => {
      const angle = (time * p.speed) + p.offset;
      
      // Calculate coordinates on the tilted orbit ellipse, offset by solar system parallax
      const px = cx + offsetX + Math.cos(angle) * p.rx;
      const py = cy + offsetY + Math.sin(angle) * p.ry;
      
      p.sprite.x = px;
      p.sprite.y = py;
      
      // Scale based on orbital depth position (sin of angle)
      // Ranges from -1 (farthest/back) to +1 (closest/front)
      const depthFactor = Math.sin(angle);
      const relativeScale = p.scale * (1.0 + depthFactor * 0.25);
      p.sprite.setScale(relativeScale);
      
      // Dynamic depth sorting
      if (depthFactor < 0) {
        // Behind the sun
        p.sprite.setDepth(DEPTH.BG_NEBULA);
      } else {
        // In front of the sun
        p.sprite.setDepth(DEPTH.BG_NEBULA + 2);
      }
      
      p.sprite.setAngle(time * 0.04); // slow individual rotation
    });

    // Drift and rotate background asteroids with wrapping boundaries and parallax (-0.06 scroll factor)
    this.asteroids.forEach((ast) => {
      ast._driftX += ast._driftSpeedX * 0.05;
      ast._driftY += ast._driftSpeedY * 0.05;
      ast.angle += ast._rotSpeed;

      // Wrap around bounds in drift space
      if (ast._driftX < -60) ast._driftX = ARENA_SIZE + 60;
      if (ast._driftX > ARENA_SIZE + 60) ast._driftX = -60;
      if (ast._driftY < -60) ast._driftY = ARENA_SIZE + 60;
      if (ast._driftY > ARENA_SIZE + 60) ast._driftY = -60;

      // Set final world position with parallax applied
      ast.x = ast._driftX - scrollX * (-0.06);
      ast.y = ast._driftY - scrollY * (-0.06);
    });
  }

  destroy() {
    this.ambientParticles.destroy();
    this.nebulae.forEach((n) => n.destroy());
    this.twinkleStars.forEach((s) => s.destroy());
    this.fogTile.destroy();
    this.starBack.destroy();
    this.starMid.destroy();
    this.starFore.destroy();
    this.galaxyFog.destroy();

    // Solar system cleanups
    if (this.sun) this.sun.destroy();
    if (this.sunGlow) this.sunGlow.destroy();
    if (this.orbitGraphics) this.orbitGraphics.destroy();
    this.planets.forEach((p) => {
      if (p.sprite) p.sprite.destroy();
    });

    // Asteroids cleanups
    this.asteroids.forEach((ast) => {
      if (ast) ast.destroy();
    });
  }
}
