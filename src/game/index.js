import Phaser from 'phaser';
import ArcadeSurvival from './scenes/ArcadeSurvival';

/**
 * Bootstraps and creates a new Phaser Game instance.
 * @param {HTMLElement} parentEl - The container DOM element for the canvas.
 * @returns {Phaser.Game} The instantiated Phaser Game.
 */
export default function createGame(parentEl) {
  return new Phaser.Game({
    type: Phaser.AUTO,
    // Start with parent-element bounding size
    width: '100%',
    height: '100%',
    parent: parentEl,
    backgroundColor: '#06060c',
    
    // Scale manager makes the game fill its React parent container responsively
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },

    // Bind keyboard inputs globally to window so player doesn't need to click canvas for focus
    input: {
      keyboard: {
        target: window
      }
    },
    
    // Physics engine configured with zero gravity for top-down flight movement
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { y: 0 },
        debug: false, // Turn on to visualize hitboxes for development debugging
      },
    },
    
    // Core game scenes
    scene: [ArcadeSurvival],
  });
}
