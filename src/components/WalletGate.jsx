import { useWeb3 } from '../context/Web3Context';
import { ACTIVE_NETWORK } from '../config/chains';

/**
 * WalletGate Component
 * Full-screen overlay that blocks access to the game until wallet is connected
 * and the user is on the correct network.
 * Keeps all wallet logic isolated from gameplay.
 */
const WalletGate = () => {
  const {
    address,
    isCorrectChain,
    isConnecting,
    error,
    connectWallet,
    switchToActiveChain,
    disconnectWallet,
  } = useWeb3();

  const truncate = (addr) =>
    addr ? addr.slice(0, 6) + '...' + addr.slice(-4) : '';

  // --- Styles ---
  const overlayStyle = {
    position: 'fixed',
    inset: 0,
    width: '100vw',
    height: '100vh',
    background: 'radial-gradient(ellipse at 60% 40%, rgba(0,80,120,0.22) 0%, rgba(6,6,12,0.97) 70%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99999,
    fontFamily: 'var(--font-retro, monospace)',
    overflow: 'hidden',
    borderTop: '12vh solid #000',
    borderBottom: '12vh solid #000',
    boxSizing: 'border-box',
  };

  const panelStyle = {
    maxWidth: '420px',
    width: '90%',
    background: 'rgba(6, 6, 12, 0.88)',
    border: '1.5px solid rgba(0, 240, 255, 0.35)',
    borderRadius: '6px',
    boxShadow: '0 0 40px rgba(0,240,255,0.10), 0 0 80px rgba(255,0,127,0.06), inset 0 0 20px rgba(0,240,255,0.04)',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
    padding: '2.8rem 2rem 2.4rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: '0',
    position: 'relative',
  };

  const titleStyle = {
    fontFamily: 'var(--font-brand, sans-serif)',
    fontSize: '3.2rem',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: '6px',
    textShadow: '0 0 10px rgba(255,0,127,0.8), 0 0 28px rgba(255,0,127,0.5)',
    marginBottom: '0.1rem',
    lineHeight: 1,
  };

  const dividerStyle = {
    height: '2px',
    background: 'linear-gradient(90deg, transparent, #ff007f 20%, #00f0ff 80%, transparent)',
    width: '65%',
    alignSelf: 'center',
    opacity: 0.75,
    margin: '0.7rem auto 1.5rem',
  };

  const subtitleStyle = {
    fontSize: '0.5rem',
    color: 'var(--neon-cyan, #00f0ff)',
    textAlign: 'center',
    letterSpacing: '2.5px',
    marginBottom: '1.8rem',
    opacity: 0.75,
  };

  const sectionLabelStyle = {
    fontSize: '0.45rem',
    color: '#64748b',
    letterSpacing: '1.5px',
    textAlign: 'center',
    marginBottom: '0.7rem',
  };

  const networkBadgeStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '7px',
    background: 'rgba(0,240,255,0.06)',
    border: '1px solid rgba(0,240,255,0.18)',
    borderRadius: '4px',
    padding: '0.55rem 1rem',
    marginBottom: '1.5rem',
  };

  const dotStyle = (on) => ({
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    background: on ? '#39ff14' : '#475569',
    boxShadow: on ? '0 0 6px #39ff14' : 'none',
    flexShrink: 0,
  });

  const networkTextStyle = {
    fontSize: '0.5rem',
    color: '#94a3b8',
    letterSpacing: '1px',
    textTransform: 'uppercase',
  };

  const btnBase = {
    fontFamily: 'var(--font-retro, monospace)',
    letterSpacing: '1.5px',
    borderRadius: '4px',
    cursor: isConnecting ? 'wait' : 'pointer',
    width: '100%',
    transition: 'all 0.18s',
    opacity: isConnecting ? 0.6 : 1,
  };

  const primaryBtnStyle = {
    ...btnBase,
    fontSize: '0.75rem',
    padding: '0.85rem 1.2rem',
    background: 'rgba(0,240,255,0.08)',
    border: '1.5px solid rgba(0,240,255,0.7)',
    color: '#fff',
    boxShadow: '0 0 14px rgba(0,240,255,0.25)',
  };

  const warningBtnStyle = {
    ...btnBase,
    fontSize: '0.75rem',
    padding: '0.85rem 1.2rem',
    background: 'rgba(255,180,0,0.08)',
    border: '1.5px solid rgba(255,180,0,0.6)',
    color: '#ffd060',
    boxShadow: '0 0 12px rgba(255,180,0,0.15)',
  };

  const disconnectBtnStyle = {
    ...btnBase,
    fontSize: '0.55rem',
    padding: '0.5rem 0.8rem',
    marginTop: '0.6rem',
    background: 'rgba(255,30,30,0.06)',
    border: '1px solid rgba(255,60,60,0.25)',
    color: '#ff6060',
    boxShadow: 'none',
    opacity: 0.85,
  };

  const errorBoxStyle = {
    background: 'rgba(255, 30, 30, 0.08)',
    border: '1px solid rgba(255, 60, 60, 0.35)',
    borderRadius: '4px',
    padding: '0.6rem 0.9rem',
    marginBottom: '1rem',
    fontSize: '0.48rem',
    color: '#ff8080',
    letterSpacing: '0.5px',
    lineHeight: '1.5',
    textAlign: 'center',
  };

  const addressPillStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    background: 'rgba(57,255,20,0.07)',
    border: '1px solid rgba(57,255,20,0.3)',
    borderRadius: '4px',
    padding: '0.5rem 1rem',
    marginBottom: '1.2rem',
    fontSize: '0.55rem',
    color: '#39ff14',
    letterSpacing: '1px',
    textShadow: '0 0 5px rgba(57,255,20,0.5)',
  };

  const wrongNetworkBoxStyle = {
    background: 'rgba(255,140,0,0.07)',
    border: '1px solid rgba(255,140,0,0.28)',
    borderRadius: '4px',
    padding: '0.65rem 0.9rem',
    marginBottom: '1rem',
    fontSize: '0.48rem',
    color: '#ffb060',
    letterSpacing: '0.5px',
    lineHeight: '1.5',
    textAlign: 'center',
  };

  return (
    <div style={overlayStyle}>
      {/* Scanline overlay for CRT feel */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)',
        zIndex: 0,
      }} />

      <div style={panelStyle}>
        {/* Corner markers */}
        {[['top','8px','left','10px'],['top','8px','right','10px'],['bottom','8px','left','10px'],['bottom','8px','right','10px']].map(([v,vs,h,hs],i) => (
          <span key={i} style={{ position:'absolute', [v]:vs, [h]:hs, color:'rgba(0,240,255,0.4)', fontSize:'0.65rem', fontFamily:'monospace', pointerEvents:'none' }}>+</span>
        ))}

        {/* Panel labels */}
        <span style={{ position:'absolute', top:'-7px', left:'16px', color:'#ff007f', fontSize:'0.42rem', background:'#06060c', padding:'0 4px', letterSpacing:'0.5px' }}>AUTH.GATE</span>
        <span style={{ position:'absolute', bottom:'-7px', right:'16px', color:'rgba(0,240,255,0.7)', fontSize:'0.42rem', background:'#06060c', padding:'0 4px', letterSpacing:'0.5px', textTransform: 'uppercase' }}>{ACTIVE_NETWORK.name} // {ACTIVE_NETWORK.chainId}</span>

        {/* Title */}
        <h1 style={titleStyle}>STARCADE</h1>
        <div style={dividerStyle} />
        <p style={subtitleStyle}>// PILOT AUTHENTICATION REQUIRED //</p>

        {/* Network status badge */}
        <p style={sectionLabelStyle}>-- NETWORK STATUS --</p>
        <div style={networkBadgeStyle}>
          <div style={dotStyle(address && isCorrectChain)} />
          <span style={networkTextStyle}>
            {address && isCorrectChain
              ? `CONNECTED // ${ACTIVE_NETWORK.name}`
              : address
              ? 'WRONG NETWORK DETECTED'
              : 'NO WALLET CONNECTED'}
          </span>
        </div>

        {/* Error messages */}
        {error && (
          <div style={errorBoxStyle}>
            ⚠ {error}
          </div>
        )}

        {/* Connected address pill */}
        {address && (
          <div style={addressPillStyle}>
            <span>✓</span>
            <span>PILOT: {truncate(address)}</span>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────────────────── */}
        {/* STATE: Connected but WRONG NETWORK                                   */}
        {/* ────────────────────────────────────────────────────────────────────── */}
        {address && !isCorrectChain && (
          <>
            <div style={wrongNetworkBoxStyle}>
              Please switch to {ACTIVE_NETWORK.name} to play.
            </div>

            {/* Primary action: switch network (adds it if missing) */}
            <button
              style={warningBtnStyle}
              onClick={switchToActiveChain}
              disabled={isConnecting}
            >
              {isConnecting ? 'SWITCHING...' : `⟳ SWITCH TO ${ACTIVE_NETWORK.name.toUpperCase()}`}
            </button>

            {/* Secondary: disconnect so they can try a different wallet */}
            <button
              style={disconnectBtnStyle}
              onClick={disconnectWallet}
              disabled={isConnecting}
            >
              ✕ DISCONNECT WALLET
            </button>
          </>
        )}

        {/* ────────────────────────────────────────────────────────────────────── */}
        {/* STATE: NOT CONNECTED                                                 */}
        {/* ────────────────────────────────────────────────────────────────────── */}
        {!address && (
          <button
            style={primaryBtnStyle}
            onClick={connectWallet}
            disabled={isConnecting}
          >
            {isConnecting ? 'CONNECTING...' : '◈ CONNECT WALLET'}
          </button>
        )}

        {/* Hint text */}
        <p style={{
          fontSize: '0.45rem',
          color: '#475569',
          textAlign: 'center',
          marginTop: '1.4rem',
          letterSpacing: '0.8px',
          lineHeight: '1.6',
        }}>
          MetaMask or any EIP-1193 browser wallet required.
          <br />
          Connect wallet to auto-add {ACTIVE_NETWORK.name}.
        </p>
      </div>
    </div>
  );
};

export default WalletGate;
