import { useState } from 'react';
import synthAudio from '../game/utils/synthAudio';
import { useWeb3 } from '../context/Web3Context';

/**
 * Shown after clearing Sector 09 — Wave 10 boss / ship upgrades are not ready yet.
 */
const BossComingSoon = ({ stats, onRestart }) => {
  const { score = 0, wave = 9, enemiesDestroyed = 0 } = stats;

  const { address, isCorrectChain, submitScore, txState } = useWeb3();
  const [hasSubmitted, setHasSubmitted] = useState(false);

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
    const success = await submitScore(score, wave, true); // true = win because they cleared sector 9
    if (success) {
      setHasSubmitted(true);
    }
  };

  const isPending = txState.status === 'pending' && txState.type === 'score';

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '420px',
        fontFamily: 'var(--font-retro)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1rem',
        position: 'relative',
        zIndex: 10,
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <h1
          style={{
            fontFamily: 'var(--font-brand)',
            fontSize: '2.2rem',
            letterSpacing: '4px',
            color: '#fff',
            textShadow: '0 0 14px rgba(157, 0, 255, 0.8), 0 0 40px rgba(255, 0, 85, 0.35)',
            margin: 0,
            lineHeight: 1.1,
          }}
        >
          SECTOR 10
        </h1>
        <p
          style={{
            fontSize: '0.55rem',
            letterSpacing: '3px',
            color: 'var(--neon-yellow)',
            margin: '8px 0 0',
            opacity: 0.9,
          }}
        >
          // BOSS LEVEL — IN DEVELOPMENT //
        </p>
      </div>

      <div
        style={{
          width: '100%',
          background: 'rgba(6, 6, 12, 0.92)',
          border: '1.5px solid rgba(157, 0, 255, 0.55)',
          borderRadius: '6px',
          padding: '16px 18px',
          textAlign: 'center',
          boxShadow: '0 0 22px rgba(157, 0, 255, 0.25), inset 0 0 12px rgba(0,0,0,0.5)',
        }}
      >
        <p
          style={{
            fontSize: '0.7rem',
            color: '#e2e8f0',
            lineHeight: 1.65,
            margin: '0 0 12px',
            letterSpacing: '0.4px',
          }}
        >
          You cleared <span style={{ color: 'var(--neon-cyan)' }}>Sector {String(wave).padStart(2, '0')}</span>.
          The next colossal boss fight, upgraded ship loadout, and new boss move set are still being built.
        </p>
        <p
          style={{
            fontSize: '0.85rem',
            color: 'var(--neon-pink)',
            fontWeight: 'bold',
            letterSpacing: '2px',
            margin: 0,
            textShadow: '0 0 10px var(--neon-pink-glow)',
          }}
        >
          STAY TUNED, PILOT
        </p>
      </div>

      <div style={{ width: '100%', display: 'flex', gap: '8px' }}>
        {[
          { label: 'SCORE', value: score, color: 'var(--neon-pink)' },
          { label: 'SECTOR', value: String(wave).padStart(2, '0'), color: 'var(--neon-cyan)' },
          { label: 'KILLS', value: enemiesDestroyed, color: '#cc44ff' },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            style={{
              flex: 1,
              background: 'rgba(6, 6, 12, 0.8)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '6px',
              padding: '10px 8px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '0.38rem', color: '#64748b', letterSpacing: '1px', marginBottom: '4px' }}>
              {label}
            </div>
            <div style={{ fontSize: '0.9rem', color, fontWeight: 'bold', textShadow: `0 0 8px ${color}` }}>
              {value}
            </div>
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

export default BossComingSoon;
