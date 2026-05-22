import { useState } from 'react';
import synthAudio from '../game/utils/synthAudio';
import { useWeb3 } from '../context/Web3Context';

const getRankDetails = (score) => {
  if (score === 0)       return { rank: 'F', title: 'SPACE DUST',      color: '#ff3366', roasts: ["Did you even touch the keyboard, space cadet?", "A training dummy would have survived longer.", "Go find some baddie to cry on her shoulder, space hazard."] };
  if (score <= 350)      return { rank: 'E', title: 'SCRAP COLLECTOR',  color: '#ff5533', roasts: ["Your ship was cardboard, and so are your skills.", "Even the tutorial drones feel sorry for you.", "Was that a dash, or did you slide directly into that bullet?"] };
  if (score <= 1000)     return { rank: 'D', title: 'CARGO HAULER',     color: '#ffea00', roasts: ["Mediocre pilot logs detected. Go cry on someone's shoulder.", "You flew like a heavy cargo ship — slow, clunky, and easy to pop.", "Dodge slide? More like dodge collision. Try moving next time!"] };
  if (score <= 2500)     return { rank: 'C', title: 'LASER JOCKEY',     color: '#39ff14', roasts: ["You shoot decent, but your dodging is trash.", "Average performance. Killed a few bugs before exploding.", "Error 404: Elite Skill Not Found. Reboot your pilot brain."] };
  if (score <= 6000)     return { rank: 'B', title: 'VOID RANGER',      color: '#00f0ff', roasts: ["Not bad. But the boss still turned your ship into space soup.", "Good effort — 'almost surviving' doesn't buy fuel credits.", "Nice lifesteal, but you can't siphon your way out of a laser blast!"] };
  if (score <= 15000)    return { rank: 'A', title: 'STAR COMMANDER',   color: '#cc44ff', roasts: ["Excellent! You fought bravely, but space is cold and unforgiving.", "Very respectable! The galaxy trembled, but you still ended up in pieces.", "Boss shield breaker confirmed — but your shield crashed too."] };
  return                        { rank: 'S', title: 'COSMIC ACE',       color: '#ffffff', roasts: ["Absolute legend. Space honors your name!", "You broke the simulation! The galaxy is safe in your hands.", "Respect, commander. Even in defeat, your legacy is eternal."] };
};

const GameOver = ({ stats, onRestart }) => {
  const { score = 0, wave = 1, enemiesDestroyed = 0 } = stats;
  const rankInfo = getRankDetails(score);

  const [roastLine] = useState(
    () => rankInfo.roasts[Math.floor(Math.random() * rankInfo.roasts.length)]
  );

  const { address, isCorrectChain, submitScore, txState, playerStats } = useWeb3();
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const cachedHighScore = parseInt(localStorage.getItem('arcade_high_score') || '0', 10);
  // Also consider on-chain personal best if available
  const personalBest = Math.max(cachedHighScore, playerStats?.personalBest || 0);
  const isNewHighScore = score > 0 && score > personalBest;
  
  if (score > cachedHighScore) {
    localStorage.setItem('arcade_high_score', String(score));
  }

  const handleRestart = () => {
    try {
      synthAudio.init();
      synthAudio.stopBGM?.();
      synthAudio.playGameStart?.();
    } catch { void 0; }
    onRestart();
    window.dispatchEvent(new CustomEvent('game-restart'));
  };

  const handleSubmitScore = async () => {
    if (hasSubmitted) return;
    const success = await submitScore(score, wave, false); // false = not a win since game over
    if (success) {
      setHasSubmitted(true);
    }
  };

  const rc = rankInfo.color;
  const isPending = txState.status === 'pending' && txState.type === 'score';

  return (
    <div style={{
      width: '100%',
      maxWidth: '400px',
      fontFamily: 'var(--font-retro)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '1rem',
      position: 'relative',
      zIndex: 10,
    }}>

      {/* ── HEADER ── */}
      <div style={{ textAlign: 'center' }}>
        <h1 style={{
          fontFamily: 'var(--font-brand)',
          fontSize: '3rem',
          letterSpacing: '6px',
          color: '#fff',
          textShadow: `0 0 14px var(--neon-pink-glow), 0 0 40px rgba(255,0,80,0.3)`,
          margin: 0,
          lineHeight: 1
        }}>
          GAME OVER
        </h1>
        <p style={{ fontSize: '0.45rem', letterSpacing: '3px', color: 'var(--neon-cyan)', margin: '6px 0 0', opacity: 0.7 }}>
          // CORE CRITICAL — PILOT EJECTED //
        </p>
      </div>

      {/* ── RANK BADGE ── */}
      <div style={{
        width: '100%',
        background: `linear-gradient(135deg, rgba(6,6,12,0.95), rgba(20,10,30,0.9))`,
        border: `1.5px solid ${rc}`,
        borderRadius: '6px',
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: `0 0 18px ${rc}40, inset 0 0 12px rgba(0,0,0,0.5)`,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '0.4rem', color: '#64748b', letterSpacing: '1px' }}>PILOT RANK</span>
          <span style={{ fontSize: '1.6rem', fontFamily: 'var(--font-brand)', color: rc, textShadow: `0 0 10px ${rc}`, lineHeight: 1 }}>
            {rankInfo.rank}
          </span>
        </div>
        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '0.4rem', color: '#64748b', letterSpacing: '1px' }}>CERTIFICATION</span>
          <span style={{ fontSize: '0.65rem', color: rc, fontWeight: 'bold', letterSpacing: '1.5px', textShadow: `0 0 8px ${rc}` }}>
            {rankInfo.title}
          </span>
        </div>
      </div>

      {/* ── ROAST LINE ── */}
      <div style={{
        width: '100%',
        background: 'rgba(6,6,12,0.88)',
        border: '1px dashed rgba(255,255,255,0.12)',
        borderRadius: '6px',
        padding: '14px 16px',
        position: 'relative',
        textAlign: 'center',
      }}>
        <span style={{
          position: 'absolute', top: '-7px', left: '14px',
          background: '#08080f', padding: '0 6px',
          fontSize: '0.38rem', letterSpacing: '1.5px',
          color: rc, fontFamily: 'monospace',
        }}>
          DEBRIEF_LOG
        </span>
        <p style={{
          fontSize: '0.6rem',
          color: '#e2e8f0',
          fontStyle: 'italic',
          lineHeight: 1.6,
          margin: 0,
          letterSpacing: '0.3px',
        }}>
          "{roastLine}"
        </p>
      </div>

      {/* ── NEW HIGH SCORE ── */}
      {isNewHighScore && (
        <div style={{
          width: '100%',
          background: 'rgba(255,234,0,0.06)',
          border: '1px solid rgba(255,234,0,0.4)',
          borderRadius: '6px',
          padding: '8px 14px',
          textAlign: 'center',
          fontSize: '0.5rem',
          color: 'var(--neon-yellow)',
          letterSpacing: '2px',
        }}>
          ★ NEW PERSONAL BEST ★
        </div>
      )}

      {/* ── STATS ROW ── */}
      <div style={{ width: '100%', display: 'flex', gap: '8px' }}>
        {[
          { label: 'SCORE',    value: score,            color: 'var(--neon-pink)' },
          { label: 'SECTOR',   value: String(wave).padStart(2,'0'), color: 'var(--neon-cyan)' },
          { label: 'KILLS',    value: enemiesDestroyed,  color: '#cc44ff' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            flex: 1,
            background: 'rgba(6,6,12,0.8)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '6px',
            padding: '10px 8px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '0.38rem', color: '#64748b', letterSpacing: '1px', marginBottom: '4px' }}>{label}</div>
            <div style={{ fontSize: '0.9rem', color, fontWeight: 'bold', textShadow: `0 0 8px ${color}` }}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── SUBMIT TO ONCHAIN ── */}
      {address && isCorrectChain && score > 0 && (
        <button
          type="button"
          onClick={handleSubmitScore}
          disabled={isPending || hasSubmitted}
          className="cyber-button"
          style={{
            width: '100%',
            fontSize: '0.65rem',
            padding: '0.8rem',
            borderRadius: '6px',
            borderColor: hasSubmitted ? '#39ff14' : 'var(--neon-cyan)',
            boxShadow: hasSubmitted ? '0 0 10px rgba(57,255,20,0.3)' : '0 0 10px rgba(0,240,255,0.3)',
            background: hasSubmitted ? 'rgba(57,255,20,0.1)' : 'rgba(0,240,255,0.05)',
            letterSpacing: '2px',
            marginTop: '0.2rem',
            opacity: (isPending || hasSubmitted) ? 0.8 : 1,
            cursor: (isPending || hasSubmitted) ? 'default' : 'pointer',
          }}
        >
          {isPending ? 'SUBMITTING TO BASE...' : hasSubmitted ? '✓ SCORE RECORDED ONCHAIN' : '▲ SUBMIT SCORE TO BASE'}
        </button>
      )}

      {/* ── PLAY AGAIN ── */}
      <button
        type="button"
        onClick={handleRestart}
        className="cyber-button"
        style={{
          width: '100%',
          fontSize: '0.85rem',
          padding: '0.8rem',
          borderRadius: '6px',
          borderColor: 'var(--neon-pink)',
          boxShadow: '0 0 18px var(--neon-pink-glow)',
          letterSpacing: '3px',
          marginTop: '0.2rem',
        }}
      >
        ▶ PLAY AGAIN
      </button>
    </div>
  );
};

export default GameOver;
