import { useState, useEffect, useCallback, useRef } from 'react';
import GameCanvas from './components/GameCanvas';
import MainMenu from './components/MainMenu';
import HUD from './components/HUD';
import GameOver from './components/GameOver';
import BossVictory from './components/BossVictory';
import BossComingSoon from './components/BossComingSoon';
import WalletGate from './components/WalletGate';
import LeaderboardPage from './components/LeaderboardPage';
import TxStatus from './components/TxStatus';
import AchievementToast from './components/AchievementToast';
import menuWallpaper from './assets/menu_wallpaper.png';
import { useWeb3 } from './context/Web3Context';

/**
 * App Component
 * Coordinates screen routing, listens to Phaser events to update HUD states,
 * and overlays retro filter shaders (CRT / scanlines).
 * 
 * Wallet gating is handled via WalletGate: if the wallet is not connected
 * or on the wrong network, the user sees the gate overlay and cannot play.
 */
function App() {
  // Screen States: 'MENU' | 'PLAYING' | 'GAMEOVER' | 'VICTORY' | 'BOSS_SOON'
  const [screen, setScreen] = useState('MENU');

  // Web3 wallet gate
  const { address, isCorrectChain, disconnectWallet } = useWeb3();

  // Whether the wallet gate should be shown
  const isWalletGated = !address || !isCorrectChain;

  // Real-time HUD Metrics updated from Phaser
  const [metrics, setMetrics] = useState({
    score: 0,
    health: 100,
    maxHealth: 100,
    wave: 1,
    enemiesDestroyed: 0,
    isShielded: false,
    isRapidFire: false,
    shieldTime: 0,
    rapidFireTime: 0
  });

  // Game over statistics cached at death
  const [gameOverStats, setGameOverStats] = useState({
    score: 0,
    wave: 1,
    enemiesDestroyed: 0
  });

  // Boss victory stats cached on boss defeat
  const [victoryStats, setVictoryStats] = useState({
    score: 0,
    wave: 1,
    enemiesDestroyed: 0
  });

  // Sector 10 gate — boss level not ready yet
  const [comingSoonStats, setComingSoonStats] = useState({
    score: 0,
    wave: 9,
    enemiesDestroyed: 0,
  });

  // Background Music for Start/Game Over
  const bgmRef = useRef(null);

  useEffect(() => {
    if (!bgmRef.current) {
      const audio = new Audio('/audio/start and game over/start and game over.mp3');
      audio.volume = 0.5; // Medium volume
      audio.loop = true;
      bgmRef.current = audio;
    }

    const audio = bgmRef.current;
    // Play on MENU or GAMEOVER, provided the wallet is connected (so browser allows audio to play)
    const shouldPlay = !isWalletGated && (screen === 'MENU' || screen === 'GAMEOVER');

    if (shouldPlay) {
      if (audio.paused) {
        // Start from a random timestamp if metadata is loaded
        const playWithRandomTime = () => {
          if (audio.duration > 0 && isFinite(audio.duration)) {
            audio.currentTime = Math.random() * audio.duration;
          }
          audio.play().catch(e => console.log('Autoplay prevented by browser:', e));
        };

        if (audio.readyState >= 1) { // HAVE_METADATA
          playWithRandomTime();
        } else {
          audio.addEventListener('loadedmetadata', function onLoaded() {
            playWithRandomTime();
            audio.removeEventListener('loadedmetadata', onLoaded);
          });
        }
      }
    } else {
      audio.pause();
    }
  }, [screen, isWalletGated]);

  useEffect(() => {
    // A. Listen to real-time HUD stats updates dispatched by the Phaser physics loop
    const handleHUDUpdate = (e) => {
      setMetrics(e.detail);
    };

    // B. Listen to game over triggers dispatched by Phaser when player health reaches zero
    const handleGameOverEvent = (e) => {
      setGameOverStats({
        score: e.detail.score,
        wave: e.detail.wave,
        enemiesDestroyed: e.detail.enemiesDestroyed
      });
      // Transition to black screen first, then game over
      setScreen('BLACK_SCREEN');
      setTimeout(() => {
        setScreen('GAMEOVER');
      }, 1500); // 1.5s black screen delay
    };

    // C. Listen to boss victory event triggers when sector is cleared
    const handleVictoryEvent = (e) => {
      setVictoryStats({
        score: e.detail.score,
        wave: e.detail.wave,
        enemiesDestroyed: e.detail.enemiesDestroyed
      });
      setScreen('VICTORY');
    };

    const handleBossComingSoonEvent = (e) => {
      setComingSoonStats({
        score: e.detail.score,
        wave: e.detail.wave ?? 9,
        enemiesDestroyed: e.detail.enemiesDestroyed,
      });
      setScreen('BOSS_SOON');
    };

    window.addEventListener('game-hud-update', handleHUDUpdate);
    window.addEventListener('game-over-event', handleGameOverEvent);
    window.addEventListener('game-victory-event', handleVictoryEvent);
    window.addEventListener('game-boss-coming-soon-event', handleBossComingSoonEvent);

    return () => {
      window.removeEventListener('game-hud-update', handleHUDUpdate);
      window.removeEventListener('game-over-event', handleGameOverEvent);
      window.removeEventListener('game-victory-event', handleVictoryEvent);
      window.removeEventListener('game-boss-coming-soon-event', handleBossComingSoonEvent);
    };
  }, []);

  const handleStartMission = () => {
    // Reset HUD states and set screen to playing
    setMetrics({
      score: 0,
      health: 100,
      maxHealth: 100,
      wave: 1,
      enemiesDestroyed: 0,
      isShielded: false,
      isRapidFire: false,
      shieldTime: 0,
      rapidFireTime: 0
    });
    setScreen('PLAYING');
  };

  const handleRestartMission = () => {
    setMetrics({
      score: 0,
      health: 100,
      maxHealth: 100,
      wave: 1,
      enemiesDestroyed: 0,
      isShielded: false,
      isRapidFire: false,
      shieldTime: 0,
      rapidFireTime: 0,
    });
    setGameOverStats({ score: 0, wave: 1, enemiesDestroyed: 0 });
    setScreen('PLAYING');
  };

  const handleNextWave = () => {
    // Signal Phaser to resume and start the next wave
    window.dispatchEvent(new CustomEvent('game-resume-next-wave'));
    setScreen('PLAYING');
  };

  // Shortened wallet address for UI pill
  const shortAddr = address
    ? address.slice(0, 6) + '...' + address.slice(-4)
    : '';

  // Prevent page scrolling on touch (non-passive)
  useEffect(() => {
    const prevent = (e) => e.preventDefault();
    document.addEventListener('touchmove', prevent, { passive: false });
    return () => {
      document.removeEventListener('touchmove', prevent);
    };
  }, []);

  return (
    <>
      {/* Portrait Mode Warning — CSS media query shows this automatically on portrait mobile */}
      <div className="landscape-warning">
        <div className="icon">📱</div>
        <div style={{ fontFamily: 'var(--font-cyber)', fontSize: '1rem', color: '#00f0ff', marginBottom: '1rem', textShadow: '0 0 10px #00f0ff' }}>
          ROTATE TO PLAY
        </div>
        <div style={{ fontFamily: 'var(--font-retro)', fontSize: '0.5rem', color: 'rgba(255,255,255,0.6)', lineHeight: 2 }}>
          STARCADE requires landscape mode
        </div>
      </div>

    <div className="game-viewport" style={{
      width: '100vw',
      height: '100vh',
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundImage: (screen === 'MENU' || screen === 'GAMEOVER' || screen === 'VICTORY' || screen === 'BOSS_SOON') ? `radial-gradient(circle, rgba(6, 6, 12, 0.35) 0%, rgba(6, 6, 12, 0.88) 100%), url(${menuWallpaper})` : 'none',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      transition: 'background-image 0.5s ease-in-out'
    }}>
      {/* Global onchain overlays */}
      <TxStatus />
      <AchievementToast />

      {/* 1. RETRO ANALOG VISUAL FILTERS */}
      <div className="crt-overlay" />
      <div className="scanlines" />

      {/* ─── WALLET GATE ─────────────────────────────────────────────────────── */}
      {/* Blocks all gameplay UI until wallet is connected and on correct network */}
      {isWalletGated && <WalletGate />}

      {/* ─── WALLET STATUS PILL (shown in corner when connected) ─────────────── */}
      {!isWalletGated && (
        <div style={{
          position: 'absolute',
          top: '12px',
          right: '14px',
          zIndex: 10050,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          pointerEvents: 'auto',
        }}>
          {/* Address pill */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            background: 'rgba(6,6,12,0.82)',
            border: '1px solid rgba(57,255,20,0.35)',
            borderRadius: '4px',
            padding: '4px 10px',
            fontFamily: 'var(--font-retro, monospace)',
            fontSize: '0.45rem',
            color: '#39ff14',
            letterSpacing: '0.8px',
            textShadow: '0 0 5px rgba(57,255,20,0.5)',
          }}>
            <span style={{ opacity: 0.7 }}>◉</span>
            {shortAddr}
          </div>

          {/* Disconnect button */}
          <button
            id="wallet-disconnect-btn"
            onClick={disconnectWallet}
            title="Disconnect wallet"
            style={{
              background: 'rgba(255,30,30,0.08)',
              border: '1px solid rgba(255,60,60,0.35)',
              borderRadius: '4px',
              padding: '4px 8px',
              fontFamily: 'var(--font-retro, monospace)',
              fontSize: '0.42rem',
              color: '#ff6060',
              cursor: 'pointer',
              letterSpacing: '0.5px',
              transition: 'all 0.15s',
            }}
          >
            DISCONNECT
          </button>
        </div>
      )}

      {/* TOP LEFT LEADERBOARD TAB (Only shown when not gated) */}
      {!isWalletGated && screen !== 'PLAYING' && (
        <div style={{
          position: 'absolute',
          top: '12px',
          left: '14px',
          zIndex: 10050,
          pointerEvents: 'auto',
        }}>
          <button
            onClick={() => setScreen(screen === 'LEADERBOARD' ? 'MENU' : 'LEADERBOARD')}
            style={{
              background: screen === 'LEADERBOARD' ? 'rgba(0, 240, 255, 0.2)' : 'rgba(6,6,12,0.82)',
              border: '1px solid rgba(0, 240, 255, 0.5)',
              borderRadius: '4px',
              padding: '4px 10px',
              fontFamily: 'var(--font-retro, monospace)',
              fontSize: '0.45rem',
              color: 'var(--neon-cyan)',
              cursor: 'pointer',
              letterSpacing: '0.8px',
              transition: 'all 0.15s',
              boxShadow: screen === 'LEADERBOARD' ? '0 0 10px rgba(0, 240, 255, 0.3)' : 'none',
            }}
          >
            {screen === 'LEADERBOARD' ? 'CLOSE LEADERBOARD' : '🏆 LEADERBOARD'}
          </button>
        </div>
      )}

      {/* 2. CORE PHASER GAME LAYER */}
      {/* Mount canvas continuously for PLAYING, VICTORY, GAMEOVER, and BLACK_SCREEN states to show frozen game background and prevent unmount leaks */}
      {!isWalletGated && (screen === 'PLAYING' || screen === 'GAMEOVER' || screen === 'VICTORY' || screen === 'BOSS_SOON' || screen === 'BLACK_SCREEN') && (
        <GameCanvas />
      )}

      {/* 3. FLOATING HUD LAYER */}
      {!isWalletGated && screen === 'PLAYING' && (
        <HUD metrics={metrics} />
      )}

      {/* 4. MAIN MENU OVERLAY */}
      {!isWalletGated && screen === 'MENU' && (
        <MainMenu 
          onStart={handleStartMission} 
          onOpenLeaderboard={() => setScreen('LEADERBOARD')} 
        />
      )}

      {/* LEADERBOARD PAGE OVERLAY */}
      {!isWalletGated && screen === 'LEADERBOARD' && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 10001,
          pointerEvents: 'auto',
        }}>
          <LeaderboardPage onBack={() => setScreen('MENU')} />
        </div>
      )}

      {/* TRANSITIONAL BLACK SCREEN */}
      {!isWalletGated && screen === 'BLACK_SCREEN' && (
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: '#000',
          zIndex: 10005,
          pointerEvents: 'none',
          animation: 'fadeIn 1.5s ease-out'
        }} />
      )}

      {/* 5. GAME OVER SUMMARY SCORECARD */}
      {!isWalletGated && screen === 'GAMEOVER' && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(6, 6, 12, 0.65)',
          zIndex: 10001,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          pointerEvents: 'auto',
          animation: 'fadeIn 1s ease-out'
        }}>
          <GameOver stats={gameOverStats} onRestart={handleRestartMission} />
        </div>
      )}

      {/* 6. SECTOR 10 — BOSS LEVEL COMING SOON */}
      {!isWalletGated && screen === 'BOSS_SOON' && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(6, 6, 12, 0.72)',
          zIndex: 10001,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          pointerEvents: 'auto',
        }}>
          <BossComingSoon stats={comingSoonStats} onRestart={handleRestartMission} />
        </div>
      )}

      {/* 7. BOSS VICTORY / SECTOR COMPLETED OVERLAY */}
      {!isWalletGated && screen === 'VICTORY' && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(6, 6, 12, 0.7)',
          zIndex: 10001,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          pointerEvents: 'auto',
        }}>
          <BossVictory stats={victoryStats} onNextWave={handleNextWave} />
        </div>
      )}
    </div>
    </>
  );
}

export default App;
