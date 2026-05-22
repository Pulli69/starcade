import { useEffect } from 'react';
import synthAudio from '../game/utils/synthAudio';

/**
 * BossVictory Component
 * Renders a premium, glassmorphic sector completion dashboard overlay.
 */
const BossVictory = ({ stats, onNextWave }) => {
  const { score = 0, wave = 1, enemiesDestroyed = 0 } = stats;

  useEffect(() => {
    // Play a rewarding arpeggio jingle on mount
    synthAudio.init();
    synthAudio.playPowerup();
  }, []);

  const handleNextWave = () => {
    // Play transition chime
    synthAudio.playGameStart();
    onNextWave();
  };

  const handleHover = () => {
    // Retro hover tick sound
    synthAudio.playPickup('HEAL');
  };

  return (
    <div className="cyber-panel float-animation" style={{
      maxWidth: '450px',
      width: '90%',
      position: 'relative',
      zIndex: 10,
      textAlign: 'center',
      padding: '2.2rem 1.8rem',
      border: '1px solid rgba(57, 255, 20, 0.3)', // Emerald neon theme
      boxShadow: '0 0 25px rgba(57, 255, 20, 0.12)',
      fontFamily: 'var(--font-retro)'
    }}>
      {/* Title */}
      <h1 style={{
        fontFamily: 'var(--font-brand)',
        fontSize: '2.3rem',
        marginBottom: '0.4rem',
        color: '#fff',
        letterSpacing: '3px',
        textShadow: '0 0 12px var(--neon-green-glow)'
      }}>
        SECTOR PURGED
      </h1>
      
      <p style={{
        fontSize: '0.55rem',
        letterSpacing: '3px',
        marginBottom: '1.8rem',
        color: 'var(--neon-green)',
        textTransform: 'uppercase'
      }}>
        // QUANTUM HOSTILE NEUTRALIZED //
      </p>

      {/* Cyber diagnostics layout */}
      <div style={{
        background: 'rgba(6, 6, 12, 0.55)',
        border: '1px solid rgba(57, 255, 20, 0.1)',
        borderRadius: '4px',
        padding: '1.2rem',
        marginBottom: '1.8rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.9rem',
        fontSize: '0.65rem',
        textAlign: 'left'
      }}>
        <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#64748b' }}>COMPLETED SECTOR:</span>
          <span style={{ color: 'var(--neon-green)', fontWeight: 'bold' }}>
            {String(wave).padStart(2, '0')}
          </span>
        </div>

        <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#64748b' }}>CURRENT SCORE:</span>
          <span style={{ fontSize: '0.8rem', color: '#fff', textShadow: '0 0 6px rgba(255,255,255,0.3)', fontWeight: 'bold' }}>
            {score}
          </span>
        </div>

        <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#64748b' }}>CORES INCINERATED:</span>
          <span style={{ color: 'var(--neon-cyan)', fontWeight: 'bold' }}>
            {enemiesDestroyed}
          </span>
        </div>
        
        {/* Visual signal trace */}
        <div style={{
          height: '2px',
          background: 'linear-gradient(90deg, transparent, var(--neon-green), transparent)',
          opacity: 0.6,
          marginTop: '4px'
        }} />
      </div>

      {/* Continuation button */}
      <button 
        className="cyber-button" 
        onClick={handleNextWave}
        onMouseEnter={handleHover}
        style={{
          width: '100%',
          fontSize: '0.75rem',
          padding: '0.75rem',
          borderRadius: '4px',
          borderColor: 'var(--neon-green)',
          boxShadow: '0 0 10px var(--neon-green-glow)',
          background: 'rgba(57, 255, 20, 0.05)'
        }}
      >
        ADVANCE TO NEXT SECTOR
      </button>
    </div>
  );
};

export default BossVictory;
