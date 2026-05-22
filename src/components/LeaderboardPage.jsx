import { useWeb3 } from '../context/Web3Context';

const truncateAddress = (addr) => {
  if (!addr) return '';
  return addr.substring(0, 6) + '...' + addr.substring(addr.length - 4);
};

const LeaderboardPage = ({ onBack }) => {
  const { leaderboard } = useWeb3();

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
      boxSizing: 'border-box',
      backgroundColor: 'rgba(6, 6, 12, 0.65)'
    }}>
      <div className="cyber-panel float-animation" style={{
        maxWidth: '500px',
        width: '90%',
        maxHeight: '75vh',
        padding: '2.8rem 2rem 2.2rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
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
        <span style={{ position: 'absolute', top: '-7px', left: '16px', color: 'var(--neon-pink)', fontSize: '0.42rem', background: '#06060c', padding: '0 4px', letterSpacing: '0.5px', fontFamily: 'var(--font-retro)' }}>SYS.LEADERBOARD</span>

        <h2 style={{
          fontFamily: 'var(--font-retro)',
          fontSize: '1.2rem',
          color: 'var(--neon-cyan)',
          textAlign: 'center',
          letterSpacing: '3px',
          marginBottom: '1rem',
          textShadow: '0 0 10px var(--neon-cyan-glow)'
        }}>
          GLOBAL STANDINGS
        </h2>

        <div style={{
          height: '2px',
          background: 'linear-gradient(90deg, transparent, var(--neon-pink) 20%, var(--neon-cyan) 80%, transparent)',
          width: '100%',
          marginBottom: '1.5rem',
          opacity: 0.8
        }} />

        <div style={{
          flex: 1,
          overflowY: 'auto',
          paddingRight: '10px',
          marginBottom: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}>
          {leaderboard.length > 0 ? (
            leaderboard.map((entry, idx) => (
              <div key={idx} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '0.75rem',
                fontFamily: 'var(--font-retro)',
                color: idx === 0 ? 'var(--neon-yellow)' : (idx < 3 ? 'var(--neon-cyan)' : '#94a3b8'),
                background: 'rgba(6, 6, 12, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '4px',
                padding: '0.6rem 0.8rem',
                boxShadow: idx === 0 ? '0 0 10px rgba(255, 234, 0, 0.1)' : 'none'
              }}>
                <div style={{ display: 'flex', gap: '15px' }}>
                  <span style={{ minWidth: '35px' }}>#{idx + 1}</span>
                  <span>{entry.player.length > 12 ? truncateAddress(entry.player) : entry.player}</span>
                </div>
                <span style={{ fontWeight: 'bold' }}>{entry.score}</span>
              </div>
            ))
          ) : (
            <div style={{
              textAlign: 'center',
              color: '#475569',
              fontSize: '0.6rem',
              padding: '2rem 0',
              fontFamily: 'var(--font-retro)'
            }}>
              NO SCORE LOGS DETECTED ONCHAIN
            </div>
          )}
        </div>

        <button 
          className="cyber-button" 
          onClick={onBack}
          style={{
            fontFamily: 'var(--font-retro)',
            fontSize: '0.7rem',
            padding: '0.6rem 1.5rem',
            borderColor: 'var(--neon-pink)',
            color: '#fff',
            alignSelf: 'center',
            width: '100%',
            borderRadius: '4px',
            cursor: 'pointer',
            transition: 'all 0.3s'
          }}
        >
          RETURN TO MENU
        </button>

      </div>
    </div>
  );
};

export default LeaderboardPage;
