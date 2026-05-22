import { useState, useEffect } from 'react';
import synthAudio from '../game/utils/synthAudio';
import { getAchievement } from '../config/achievements';

/**
 * AchievementToast Component
 * Listens for 'achievement-unlocked' events and shows a bottom-left popup.
 */
const AchievementToast = () => {
  const [queue, setQueue] = useState([]);
  const [current, setCurrent] = useState(null);

  useEffect(() => {
    const handleUnlock = (e) => {
      const { badgeId } = e.detail;
      const achievement = getAchievement(badgeId);
      if (achievement) {
        setQueue(prev => [...prev, achievement]);
      }
    };

    window.addEventListener('achievement-unlocked', handleUnlock);
    return () => window.removeEventListener('achievement-unlocked', handleUnlock);
  }, []);

  useEffect(() => {
    if (!current && queue.length > 0) {
      // Pop the next achievement
      const next = queue[0];
      setCurrent(next);
      setQueue(prev => prev.slice(1));
      
      // Play sound
      synthAudio.init();
      synthAudio.playPowerup();

      // Dismiss after 5s
      const timer = setTimeout(() => {
        setCurrent(null);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [current, queue]);

  if (!current) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      left: '20px',
      width: '280px',
      background: 'rgba(6,6,12,0.95)',
      border: `1.5px solid ${current.color}`,
      borderRadius: '8px',
      padding: '12px 16px',
      boxShadow: `0 0 20px ${current.color}40, inset 0 0 10px rgba(0,0,0,0.5)`,
      fontFamily: 'var(--font-retro)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      gap: '14px',
      animation: 'slideRight 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards'
    }}>
      <div style={{ 
        fontSize: '2rem', 
        filter: `drop-shadow(0 0 8px ${current.color})` 
      }}>
        {current.icon}
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span style={{ 
          fontSize: '0.45rem', 
          color: '#64748b', 
          letterSpacing: '1px' 
        }}>
          ACHIEVEMENT UNLOCKED
        </span>
        <span style={{ 
          fontSize: '0.7rem', 
          color: current.color, 
          letterSpacing: '1px', 
          fontWeight: 'bold',
          textShadow: `0 0 8px ${current.color}`
        }}>
          {current.name}
        </span>
      </div>

      <style>{`
        @keyframes slideRight {
          from { transform: translateX(-40px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default AchievementToast;
