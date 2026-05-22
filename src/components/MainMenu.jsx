import { useState, useEffect } from 'react';
import { useWeb3 } from '../context/Web3Context';
import synthAudio from '../game/utils/synthAudio';
import DailyCheckIn from './DailyCheckIn';

const truncateAddress = (addr) => {
  if (!addr) return '';
  return addr.substring(0, 6) + '...' + addr.substring(addr.length - 4);
};

/**
 * MainMenu Component
 * Renders a clean, retro arcade start screen.
 */
const MainMenu = ({ onStart, onOpenLeaderboard }) => {
  const [selectedSkin, setSelectedSkin] = useState(() => {
    return localStorage.getItem('ship_color') || 'pink';
  });

  const [credits, setCredits] = useState(1); // Start with 1 free credit so game is never stuck
  const { leaderboard, playerStats } = useWeb3();

  const handleInsertCoin = () => {
    synthAudio.init();
    if (typeof synthAudio.playCoin === 'function') {
      synthAudio.playCoin();
    } else {
      synthAudio.playPickup('SHIELD');
    }
    setCredits(prev => prev + 1);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key && e.key.toLowerCase() === 'c') {
        handleInsertCoin();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleStartGame = () => {
    if (credits <= 0) return;
    setCredits(prev => prev - 1);
    synthAudio.init();
    synthAudio.playGameStart();
    onStart();
  };

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
      pointerEvents: 'none',
      borderTop: '12vh solid #000',
      borderBottom: '12vh solid #000',
      boxSizing: 'border-box'
    }}>

      <div className="cyber-panel float-animation" style={{
        maxWidth: '440px',
        width: '90%',
        padding: '2.8rem 2rem 2.2rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        justifyContent: 'center',
        background: 'rgba(6, 6, 12, 0.84)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: '1.5px solid rgba(0, 240, 255, 0.35)',
        boxShadow: '0 0 25px rgba(0, 240, 255, 0.12), inset 0 0 15px rgba(255, 0, 127, 0.05)',
        pointerEvents: 'auto',
        position: 'relative',
        borderRadius: '4px'
      }}>
        {/* Corner Vector Crosshairs */}
        <span style={{ position: 'absolute', top: '8px', left: '10px', color: 'rgba(0, 240, 255, 0.45)', fontSize: '0.65rem', fontFamily: 'monospace', pointerEvents: 'none' }}>+</span>
        <span style={{ position: 'absolute', top: '8px', right: '10px', color: 'rgba(0, 240, 255, 0.45)', fontSize: '0.65rem', fontFamily: 'monospace', pointerEvents: 'none' }}>+</span>
        <span style={{ position: 'absolute', bottom: '8px', left: '10px', color: 'rgba(0, 240, 255, 0.45)', fontSize: '0.65rem', fontFamily: 'monospace', pointerEvents: 'none' }}>+</span>
        <span style={{ position: 'absolute', bottom: '8px', right: '10px', color: 'rgba(0, 240, 255, 0.45)', fontSize: '0.65rem', fontFamily: 'monospace', pointerEvents: 'none' }}>+</span>

        {/* Outer Terminal Labels */}
        <span style={{ position: 'absolute', top: '-7px', left: '16px', color: 'var(--neon-pink)', fontSize: '0.42rem', background: '#06060c', padding: '0 4px', letterSpacing: '0.5px', fontFamily: 'var(--font-retro)' }}>SYS.BOOT_LOG</span>
        <span style={{ position: 'absolute', bottom: '-7px', right: '16px', color: 'var(--neon-cyan)', fontSize: '0.42rem', background: '#06060c', padding: '0 4px', letterSpacing: '0.5px', fontFamily: 'var(--font-retro)' }}>V_1.0.4 // ONCHAIN</span>

        {/* Centered Arcade Logo with neon flickering effects */}
        <h1 className="flicker-animation" style={{
          fontFamily: 'var(--font-brand)',
          fontSize: '3.5rem',
          color: '#fff',
          textAlign: 'center',
          marginBottom: '0.1rem',
          letterSpacing: '6px',
          textShadow: '0 0 10px var(--neon-pink-glow), 0 0 20px var(--neon-pink-glow)'
        }}>
          STARCADE
        </h1>

        <div style={{
          height: '2px',
          background: 'linear-gradient(90deg, transparent, var(--neon-pink) 20%, var(--neon-cyan) 80%, transparent)',
          width: '70%',
          alignSelf: 'center',
          marginBottom: '1rem',
          opacity: 0.8
        }} />

        <button 
          className="cyber-button" 
          onClick={onOpenLeaderboard}
          style={{
            fontFamily: 'var(--font-retro)',
            fontSize: '0.65rem',
            padding: '0.6rem 1rem',
            marginBottom: '1.5rem',
            borderColor: 'var(--neon-pink)',
            color: 'var(--neon-pink)',
            alignSelf: 'center',
            width: '80%',
            borderRadius: '4px',
            cursor: 'pointer',
            transition: 'all 0.3s',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <span>🏆</span> VIEW GLOBAL LEADERBOARD
        </button>

        {/* Custom Ship Color Selection */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{
            fontFamily: 'var(--font-retro)',
            fontSize: '0.52rem',
            color: '#64748b',
            letterSpacing: '1px'
          }}>
            -- SELECT SHIP SKIN --
          </span>
          <div style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'center'
          }}>
            {[
              { id: 'pink', color: '#ff007f' },
              { id: 'cyan', color: '#00f0ff' },
              { id: 'yellow', color: '#ffea00' },
              { id: 'green', color: '#39ff14' },
              { id: 'purple', color: '#9d00ff' }
            ].map(skin => (
              <button
                key={skin.id}
                onClick={() => {
                  setSelectedSkin(skin.id);
                  localStorage.setItem('ship_color', skin.id);
                  synthAudio.playPickup('SHIELD');
                }}
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: skin.color,
                  border: selectedSkin === skin.id ? '2px solid #fff' : '2px solid transparent',
                  boxShadow: selectedSkin === skin.id ? `0 0 10px ${skin.color}` : 'none',
                  cursor: 'pointer',
                  transform: selectedSkin === skin.id ? 'scale(1.18)' : 'scale(1.0)',
                  transition: 'all 0.2s',
                  pointerEvents: 'auto'
                }}
              />
            ))}
          </div>
        </div>

        {/* Daily Check-In Widget */}
        <div style={{ marginTop: '1.2rem' }}>
          <DailyCheckIn />
        </div>

        {/* Coin Door Slot Section */}
        <div style={{
          marginTop: '1.2rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '15px'
          }}>
            {/* Flashing RED Coin Entry Slot Button */}
            <button
              onClick={handleInsertCoin}
              className="pulse-animation"
              style={{
                background: 'rgba(255, 30, 30, 0.12)',
                border: '1.5px solid #ff3333',
                borderRadius: '4px',
                padding: '6px 12px',
                color: '#ff6666',
                fontFamily: 'var(--font-retro)',
                fontSize: '0.52rem',
                cursor: 'pointer',
                boxShadow: '0 0 10px rgba(255, 50, 50, 0.25)',
                letterSpacing: '1px',
                pointerEvents: 'auto',
                transition: 'all 0.1s'
              }}
            >
              INSERT COIN [C]
            </button>
            <div style={{
              fontFamily: 'var(--font-retro)',
              fontSize: '0.55rem',
              color: credits > 0 ? 'var(--neon-green)' : 'var(--neon-cyan)',
              textShadow: credits > 0 ? '0 0 6px var(--neon-green-glow)' : '0 0 6px var(--neon-cyan-glow)'
            }}>
              CREDITS: {credits}
            </div>
          </div>
        </div>

        {/* Start Game Action */}
        <button 
          className={credits > 0 ? "cyber-button flicker-animation" : "cyber-button"} 
          onClick={handleStartGame}
          disabled={credits === 0}
          style={{
            fontFamily: 'var(--font-retro)',
            fontSize: '0.85rem',
            padding: '0.8rem 1.5rem',
            marginTop: '1.2rem',
            borderColor: credits > 0 ? 'var(--neon-cyan)' : '#475569',
            boxShadow: credits > 0 ? '0 0 15px var(--neon-cyan-glow)' : 'none',
            color: credits > 0 ? '#fff' : '#64748b',
            alignSelf: 'center',
            width: '100%',
            borderRadius: '4px',
            cursor: credits > 0 ? 'pointer' : 'not-allowed',
            opacity: credits > 0 ? 1 : 0.45,
            transition: 'all 0.3s'
          }}
        >
          {credits > 0 ? 'PRESS START' : 'INSERT COIN TO PLAY'}
        </button>

        {/* Clean Controls Guide */}
        <p style={{
          fontFamily: 'var(--font-retro)',
          fontSize: '0.45rem',
          color: '#475569',
          marginTop: '1.5rem',
          letterSpacing: '1px',
          textAlign: 'center',
          lineHeight: '1.4'
        }}>
          [WASD] TO FLY<br />
          [MOUSE] TO AIM & SHOOT
        </p>
      </div>
    </div>
  );
};

export default MainMenu;
