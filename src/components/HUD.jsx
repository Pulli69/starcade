import { useState, useEffect, useCallback } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import synthAudio from '../game/utils/synthAudio';

/**
 * HUD Component
 * Renders a clean, retro arcade HUD overlay during gameplay.
 * Maximizes screen visibility by removing bulky background panels and glowing shadows.
 */
const HUD = ({ metrics }) => {
  const [isMuted, setIsMuted] = useState(synthAudio.isMuted);
  const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

  const handleDashTouch = useCallback(() => {
    // Dispatch a synthetic spacebar keydown to Phaser
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true }));
    setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ', bubbles: true })), 80);
  }, []);

  const handleDeflectTouch = useCallback(() => {
    // Dispatch a synthetic right-click to the Phaser canvas
    const canvas = document.querySelector('canvas');
    if (canvas) {
      canvas.dispatchEvent(new MouseEvent('mousedown', { button: 2, bubbles: true }));
      setTimeout(() => canvas.dispatchEvent(new MouseEvent('mouseup', { button: 2, bubbles: true })), 80);
    }
  }, []);

  const {
    score = 0,
    health = 100,
    maxHealth = 100,
    wave = 1,
    enemiesDestroyed = 0,
    isShielded = false,
    isRapidFire = false,
    shieldTime = 0,
    rapidFireTime = 0,
    boostActive = false,
    boostType = null,
    boostTimeRemaining = 0,
    bossActive = false,
    bossHealth = 0,
    bossName = '',
    comboCount = 0,
    comboMultiplier = 1.0,
    isOverdrive = false,
    dashCooldown = 0,
    deflectorCooldown = 0
  } = metrics;

  const highScore = Math.max(
    parseInt(localStorage.getItem('arcade_high_score') || '0', 10),
    score
  );

  useEffect(() => {
    if (score > parseInt(localStorage.getItem('arcade_high_score') || '0', 10)) {
      localStorage.setItem('arcade_high_score', score.toString());
    }
  }, [score]);

  const healthPercent = Math.max(0, (health / maxHealth) * 100);
  
  // Clean, solid color-coding for health
  let healthColor = 'var(--neon-cyan)';
  if (healthPercent < 30) {
    healthColor = 'var(--neon-pink)';
  } else if (healthPercent < 60) {
    healthColor = 'var(--neon-yellow)';
  }

  const boostColors = {
    TITAN: '#ff6600',
    MULTI_SHOT: '#ff00ff',
    PHASE_DASH: '#00f0ff',
    VOID_STORM: '#9d00ff',
  };
  const boostColor = boostColors[boostType] || 'var(--neon-yellow)';

  const handleMuteToggle = () => {
    const muted = synthAudio.toggleMute();
    setIsMuted(muted);
    if (!muted) synthAudio.playLaser();
  };

  return (
    <div className="hud-container" style={{
      position: 'absolute',
      top: 0, left: 0, width: '100%', height: '100%',
      pointerEvents: 'none', zIndex: 5,
      display: 'flex', flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '1rem',
      fontFamily: 'var(--font-retro)',
      fontSize: '0.6rem',
      color: '#cbd5e1'
    }}>
      {/* TOP ROW: HULL, SECTOR, SCORE */}
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
        
        {/* Left: Hull Health Bar & Sector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>HULL</span>
            <div style={{
              width: '120px',
              height: '8px',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '1px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${healthPercent}%`,
                height: '100%',
                backgroundColor: healthColor,
                transition: 'width 0.15s ease-out'
              }} />
            </div>
            <span style={{ color: healthColor }}>{Math.ceil(healthPercent)}%</span>
          </div>
          <div style={{ color: '#64748b', fontSize: '0.5rem', letterSpacing: '1px' }}>
            SECTOR: <span style={{ color: '#fff' }}>{String(wave).padStart(2, '0')}</span>
          </div>
        </div>

        {/* Right: High Score & Current Score */}
        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div>
            SCORE <span style={{ color: 'var(--neon-pink)' }}>{String(score).padStart(6, '0')}</span>
          </div>
          <div style={{ fontSize: '0.5rem', color: '#64748b' }}>
            HI-SCORE <span style={{ color: 'var(--neon-purple)' }}>{String(highScore).padStart(6, '0')}</span>
          </div>
        </div>

      </div>

      {/* BOSS HEALTH BAR */}
      {bossActive && (
        <div style={{
          position: 'absolute',
          top: '2.8rem',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '4px',
          width: '220px',
          backgroundColor: 'rgba(6, 6, 12, 0.85)',
          padding: '6px 10px',
          border: '1px solid var(--neon-pink)',
          borderRadius: '1px',
          boxShadow: '0 0 8px rgba(255, 0, 150, 0.25)',
          zIndex: 10
        }}>
          <div style={{ color: 'var(--neon-pink)', fontSize: '0.5rem', letterSpacing: '2px', fontWeight: 'bold' }}>
            {bossName.toUpperCase()}
          </div>
          <div style={{
            width: '100%',
            height: '6px',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '1px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${bossHealth}%`,
              height: '100%',
              backgroundColor: 'var(--neon-pink)',
              transition: 'width 0.1s ease-out'
            }} />
          </div>
        </div>
      )}

      {/* COMBO MULTIPLIER COUNTER */}
      {comboCount >= 2 && !bossActive && (
        <div style={{
          position: 'absolute',
          top: '2.8rem',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2px',
          animation: 'pulse 0.5s infinite alternate',
          zIndex: 10
        }}>
          <div style={{
            color: isOverdrive ? 'var(--neon-yellow)' : 'var(--neon-cyan)',
            fontSize: '0.85rem',
            fontWeight: 'bold',
            textShadow: isOverdrive ? '0 0 6px rgba(255, 234, 0, 0.5)' : 'none'
          }}>
            {comboCount} COMBO
          </div>
          <div style={{ color: '#64748b', fontSize: '0.45rem', letterSpacing: '1px' }}>
            MULTIPLIER x{comboMultiplier.toFixed(1)}
            {isOverdrive && <span style={{ color: 'var(--neon-yellow)' }}> [OVERDRIVE]</span>}
          </div>
        </div>
      )}

      {/* BOTTOM ROW: CORES, ACTIVE BOOSTS, MUTE */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', width: '100%' }}>
        
        {/* Bottom Left: Defeated Enemies & Defensive Cooldowns */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', alignItems: 'flex-start' }}>
          <div style={{ color: '#64748b' }}>
            CORES: <span style={{ color: 'var(--neon-pink)' }}>{enemiesDestroyed}</span>
          </div>
          <div style={{ display: 'flex', gap: '8px', pointerEvents: 'auto' }}>
            {/* Desktop: text labels for keyboard shortcuts */}
            {!isTouchDevice && (
              <>
                <div style={{
                  color: dashCooldown > 0 ? '#475569' : 'var(--neon-cyan)',
                  border: `1px solid ${dashCooldown > 0 ? '#1e293b' : 'var(--neon-cyan)'}`,
                  padding: '2px 4px', borderRadius: '2px', fontSize: '0.45rem',
                  backgroundColor: 'rgba(6, 6, 12, 0.7)', letterSpacing: '1px'
                }}>
                  DASH [SPACE]: {dashCooldown > 0 ? `${(dashCooldown / 1000).toFixed(1)}s` : 'READY'}
                </div>
                <div style={{
                  color: deflectorCooldown > 0 ? '#475569' : 'var(--neon-purple)',
                  border: `1px solid ${deflectorCooldown > 0 ? '#1e293b' : 'var(--neon-purple)'}`,
                  padding: '2px 4px', borderRadius: '2px', fontSize: '0.45rem',
                  backgroundColor: 'rgba(6, 6, 12, 0.7)', letterSpacing: '1px'
                }}>
                  DEFLECTOR [R-CLICK]: {deflectorCooldown > 0 ? `${(deflectorCooldown / 1000).toFixed(1)}s` : 'READY'}
                </div>
              </>
            )}
            {/* Mobile: large tap buttons */}
            {isTouchDevice && (
              <>
                <button
                  onTouchStart={handleDashTouch}
                  disabled={dashCooldown > 0}
                  style={{
                    pointerEvents: 'auto', cursor: 'pointer', minWidth: '64px', minHeight: '44px',
                    color: dashCooldown > 0 ? '#475569' : 'var(--neon-cyan)',
                    border: `1px solid ${dashCooldown > 0 ? '#1e293b' : 'var(--neon-cyan)'}`,
                    padding: '4px 8px', borderRadius: '4px', fontSize: '0.45rem',
                    backgroundColor: 'rgba(6, 6, 12, 0.85)', letterSpacing: '1px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px'
                  }}
                >
                  <span style={{ fontSize: '1rem' }}>⚡</span>
                  <span>{dashCooldown > 0 ? `${(dashCooldown / 1000).toFixed(1)}s` : 'DASH'}</span>
                </button>
                <button
                  onTouchStart={handleDeflectTouch}
                  disabled={deflectorCooldown > 0}
                  style={{
                    pointerEvents: 'auto', cursor: 'pointer', minWidth: '64px', minHeight: '44px',
                    color: deflectorCooldown > 0 ? '#475569' : 'var(--neon-purple)',
                    border: `1px solid ${deflectorCooldown > 0 ? '#1e293b' : 'var(--neon-purple)'}`,
                    padding: '4px 8px', borderRadius: '4px', fontSize: '0.45rem',
                    backgroundColor: 'rgba(6, 6, 12, 0.85)', letterSpacing: '1px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px'
                  }}
                >
                  <span style={{ fontSize: '1rem' }}>🌀</span>
                  <span>{deflectorCooldown > 0 ? `${(deflectorCooldown / 1000).toFixed(1)}s` : 'DEFLECT'}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Bottom Center: Boost Timers (Centered minimal list) */}
        <div style={{
          display: 'flex',
          gap: '8px',
          justifyContent: 'center',
          position: 'absolute',
          bottom: '1rem',
          left: '50%',
          transform: 'translateX(-50%)'
        }}>
          {boostActive && boostType && (
            <div style={{
              color: boostColor,
              border: `1px solid ${boostColor}`,
              padding: '3px 6px',
              borderRadius: '2px',
              fontSize: '0.5rem',
              backgroundColor: 'rgba(6, 6, 12, 0.8)'
            }}>
              {boostType.replace('_', ' ')}: {boostTimeRemaining}S
            </div>
          )}

          {isShielded && !boostActive && (
            <div style={{
              color: 'var(--neon-cyan)',
              border: '1px solid var(--neon-cyan)',
              padding: '3px 6px',
              borderRadius: '2px',
              fontSize: '0.5rem',
              backgroundColor: 'rgba(6, 6, 12, 0.8)'
            }}>
              SHIELD: {shieldTime}S
            </div>
          )}

          {isRapidFire && !boostActive && (
            <div style={{
              color: 'var(--neon-yellow)',
              border: '1px solid var(--neon-yellow)',
              padding: '3px 6px',
              borderRadius: '2px',
              fontSize: '0.5rem',
              backgroundColor: 'rgba(6, 6, 12, 0.8)'
            }}>
              OVERDRIVE: {rapidFireTime}S
            </div>
          )}
        </div>

        {/* Bottom Right: Clean Mute Link */}
        <button onClick={handleMuteToggle} style={{
          pointerEvents: 'auto',
          background: 'transparent',
          border: 'none',
          color: '#475569',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          outline: 'none',
          padding: '4px'
        }}>
          {isMuted ? <VolumeX size={14} color="#64748b" /> : <Volume2 size={14} color="#cbd5e1" />}
        </button>

      </div>
    </div>
  );
};

export default HUD;
