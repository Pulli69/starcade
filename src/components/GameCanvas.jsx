import { useEffect, useRef } from 'react';
import createGame from '../game';

/**
 * GameCanvas Component
 * Mounts and wraps the Phaser canvas inside the React rendering tree,
 * handling safe initialization and garbage collection destruction.
 */
const GameCanvas = () => {
  const containerRef = useRef(null);
  const gameRef = useRef(null);

  useEffect(() => {
    // Instantiate Phaser inside our container reference
    if (containerRef.current && !gameRef.current) {
      gameRef.current = createGame(containerRef.current);
    }

    const handleGameRestart = () => {
      const game = gameRef.current;
      if (!game) return;

      const scene = game.scene.getScene('ArcadeSurvival');
      if (scene) {
        if (scene.dialogueManager) scene.dialogueManager.stop();
        if (scene.bossManager) scene.bossManager.teardownActiveBoss?.();
        scene.tweens?.killAll();
        scene.time?.removeAllEvents();
        scene.isGameOver = false;
        scene.isCombatFrozen = false;
        if (scene.physics?.world) scene.physics.world.resume();
        scene.scene.restart();
      } else {
        game.scene.start('ArcadeSurvival');
      }
    };

    window.addEventListener('game-restart', handleGameRestart);

    // Safely destroy Phaser canvas upon unmounting to avoid memory leaks
    return () => {
      window.removeEventListener('game-restart', handleGameRestart);
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

  return (
    <div 
      ref={containerRef} 
      id="phaser-game-container" 
      style={{
        width: '100%',
        height: '100%',
        position: 'absolute',
        top: 0,
        left: 0,
        backgroundColor: '#06060c',
        zIndex: 1
      }}
    />
  );
};

export default GameCanvas;
