import { useWeb3 } from '../context/Web3Context';
import { getTxUrl } from '../config/chains';

/**
 * TxStatus Component
 * Floating overlay in the bottom right for tracking onchain transactions.
 */
const TxStatus = () => {
  const { txState, setTxState } = useWeb3();

  if (txState.status === 'idle') return null;

  const isPending = txState.status === 'pending';
  const isSuccess = txState.status === 'success';
  const isFailed = txState.status === 'failed';

  // Colors based on state
  const borderColor = isPending ? '#00f0ff' : isSuccess ? '#39ff14' : '#ff3366';
  const glowColor = isPending ? 'rgba(0,240,255,0.4)' : isSuccess ? 'rgba(57,255,20,0.4)' : 'rgba(255,51,102,0.4)';

  const handleDismiss = () => {
    setTxState(prev => ({ ...prev, status: 'idle' }));
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      width: '320px',
      background: 'rgba(6,6,12,0.95)',
      border: `1.5px solid ${borderColor}`,
      borderRadius: '8px',
      padding: '16px',
      boxShadow: `0 0 20px ${glowColor}, inset 0 0 10px rgba(0,0,0,0.5)`,
      fontFamily: 'var(--font-retro)',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      animation: 'slideUp 0.3s ease-out forwards'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Status Icon */}
          {isPending && (
            <div className="spinner" style={{
              width: '14px', height: '14px', border: '2px solid transparent',
              borderTopColor: '#00f0ff', borderRadius: '50%', animation: 'spin 1s linear infinite'
            }} />
          )}
          {isSuccess && <span style={{ color: '#39ff14', fontSize: '1.2rem', lineHeight: 1 }}>✓</span>}
          {isFailed && <span style={{ color: '#ff3366', fontSize: '1.2rem', lineHeight: 1 }}>✕</span>}
          
          <span style={{
            color: borderColor,
            fontSize: '0.65rem',
            letterSpacing: '2px',
            textTransform: 'uppercase',
            fontWeight: 'bold'
          }}>
            {isPending ? 'TX PENDING' : isSuccess ? 'TX SUCCESS' : 'TX FAILED'}
          </span>
        </div>
        
        {/* Dismiss Button */}
        <button onClick={handleDismiss} style={{
          background: 'none', border: 'none', color: '#64748b', cursor: 'pointer',
          fontSize: '1rem', lineHeight: 1, padding: 0
        }}>
          ×
        </button>
      </div>

      <p style={{
        margin: 0,
        fontSize: '0.75rem',
        color: '#e2e8f0',
        lineHeight: 1.4
      }}>
        {txState.message}
      </p>

      {txState.hash && (
        <a 
          href={getTxUrl(txState.hash)} 
          target="_blank" 
          rel="noopener noreferrer"
          style={{
            fontSize: '0.6rem',
            color: '#64748b',
            textDecoration: 'underline',
            alignSelf: 'flex-start',
            marginTop: '4px'
          }}
        >
          View on BaseScan ↗
        </a>
      )}

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default TxStatus;
