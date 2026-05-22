import { useWeb3 } from '../context/Web3Context';
import synthAudio from '../game/utils/synthAudio';

/**
 * DailyCheckIn Component
 * Widget for the main menu to claim a daily check-in.
 */
const DailyCheckIn = () => {
  const { address, isCorrectChain, playerStats, dailyCheckIn, txState } = useWeb3();

  if (!address || !isCorrectChain) return null;

  const handleCheckIn = async () => {
    synthAudio.init();
    synthAudio.playPickup('POWERUP');
    await dailyCheckIn();
  };

  const isPending = txState.status === 'pending' && txState.type === 'checkin';
  
  if (playerStats.hasCheckedInToday) {
    return (
      <div style={{
        background: 'rgba(57, 255, 20, 0.05)',
        border: '1px solid rgba(57, 255, 20, 0.3)',
        borderRadius: '6px',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        fontFamily: 'var(--font-retro)'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.6rem', color: '#39ff14', letterSpacing: '1px' }}>
            CHECKED IN TODAY
          </span>
          <span style={{ fontSize: '0.45rem', color: '#64748b' }}>
            Current Streak: {playerStats.lastCheckIn > 0 ? (playerStats.achievementBits & (1 << 4) ? '3+ (Devotee)' : playerStats.lastCheckIn ? 'Active' : '0') : '0'} Days
          </span>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={handleCheckIn}
      disabled={isPending}
      className="cyber-button"
      style={{
        width: '100%',
        padding: '14px',
        borderRadius: '6px',
        background: 'rgba(204, 68, 255, 0.1)',
        borderColor: '#cc44ff',
        boxShadow: '0 0 15px rgba(204, 68, 255, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        fontFamily: 'var(--font-retro)',
        opacity: isPending ? 0.7 : 1,
        cursor: isPending ? 'wait' : 'pointer'
      }}
    >
      {isPending ? (
        <span style={{ fontSize: '0.7rem', color: '#cc44ff', letterSpacing: '2px' }}>
          RECORDING ON BASE...
        </span>
      ) : (
        <>
          <span style={{ fontSize: '0.7rem', color: '#cc44ff', letterSpacing: '2px', fontWeight: 'bold' }}>
            DAILY CHECK-IN
          </span>
        </>
      )}
    </button>
  );
};

export default DailyCheckIn;
