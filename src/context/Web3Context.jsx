/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { ethers } from 'ethers';
import contractData from '../contracts/StarcadeGame.json';
import { ACTIVE_NETWORK, getChainConfig } from '../config/chains';
import { decodeAchievements } from '../config/achievements';

const Web3Context = createContext(null);
const LS_WALLET_KEY = 'wallet_connected';

export const Web3Provider = ({ children }) => {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [address, setAddress] = useState('');
  const [balance, setBalance] = useState('0.0');
  const [chainId, setChainId] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');
  
  const [txState, setTxState] = useState({ status: 'idle', type: null, hash: '', message: '' });
  const [leaderboard, setLeaderboard] = useState([]);
  
  const [playerStats, setPlayerStats] = useState({
    personalBest: 0,
    achievementBits: 0,
    lastCheckIn: 0,
    hasCheckedInToday: false,
  });

  const addressRef = useRef(address);
  addressRef.current = address;

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  const clearError = () => setError('');

  const _hydrateFromProvider = async (tempProvider) => {
    try {
      const tempSigner = await tempProvider.getSigner();
      setSigner(tempSigner);
      const addr = await tempSigner.getAddress();
      setAddress(addr);
      addressRef.current = addr;
      try {
        const rawBalance = await tempProvider.getBalance(addr);
        setBalance(parseFloat(ethers.formatEther(rawBalance)).toFixed(4));
      } catch {
        setBalance('0.0');
      }
      const network = await tempProvider.getNetwork();
      setChainId(network.chainId.toString());
      return addr;
    } catch (err) {
      console.warn('_hydrateFromProvider failed:', err);
      return null;
    }
  };

  const _ensureActiveChain = async () => {
    if (!window.ethereum) return false;
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: ACTIVE_NETWORK.hex }],
      });
      return true;
    } catch (switchErr) {
      if (switchErr.code === 4902 || switchErr?.data?.originalError?.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [getChainConfig()],
          });
          return true;
        } catch (addErr) {
          if (addErr.code === 4001) {
            setError(`You rejected adding ${ACTIVE_NETWORK.name}. Please approve to continue.`);
          } else {
            setError(`Could not add ${ACTIVE_NETWORK.name}. Please add it manually.`);
          }
          return false;
        }
      } else if (switchErr.code === 4001) {
        setError(`Network switch rejected. Please approve switching to ${ACTIVE_NETWORK.name}.`);
        return false;
      } else {
        setError('Failed to switch network. Try switching manually in MetaMask.');
        return false;
      }
    }
  };

  // ─── 1. Disconnect ────────────────────────────────────────────────────────────

  const disconnectWallet = () => {
    setProvider(null);
    setSigner(null);
    setAddress('');
    addressRef.current = '';
    setBalance('0.0');
    setChainId('');
    setError('');
    localStorage.removeItem(LS_WALLET_KEY);
    setPlayerStats({
      personalBest: 0,
      achievementBits: 0,
      lastCheckIn: 0,
      hasCheckedInToday: false,
    });
  };

  // ─── 2. Switch Network ────────────────────────────────────────────────────────

  const switchToActiveChain = async () => {
    if (!window.ethereum) {
      setError('No wallet detected. Please install MetaMask.');
      return;
    }
    clearError();
    setIsConnecting(true);
    try {
      const switched = await _ensureActiveChain();
      if (switched) {
        const tempProvider = new ethers.BrowserProvider(window.ethereum);
        setProvider(tempProvider);
        await _hydrateFromProvider(tempProvider);
      }
    } finally {
      setIsConnecting(false);
    }
  };

  // ─── 3. Connect Wallet ────────────────────────────────────────────────────────

  const connectWallet = async () => {
    if (!window.ethereum) {
      setError('No Ethereum wallet detected. Please install MetaMask.');
      return;
    }
    clearError();
    setIsConnecting(true);
    try {
      const tempProvider = new ethers.BrowserProvider(window.ethereum);
      setProvider(tempProvider);
      await tempProvider.send('eth_requestAccounts', []);
      await _hydrateFromProvider(tempProvider);

      const network = await tempProvider.getNetwork();
      const currentChain = network.chainId.toString();

      if (currentChain !== ACTIVE_NETWORK.chainId.toString()) {
        // We do NOT auto switch network here as per the fix in WalletGate
      }

      localStorage.setItem(LS_WALLET_KEY, 'true');
      fetchData(); // Fetch leaderboard and stats
    } catch (err) {
      if (err.code === 4001 || err.message?.includes('User rejected')) {
        setError('Wallet connection rejected. Click "Connect Wallet" to try again.');
      } else if (err.message?.includes('Already processing eth_requestAccounts')) {
        setError('A connection request is already pending. Check your MetaMask popup.');
      } else {
        setError('Connection failed. Make sure your wallet is unlocked and try again.');
      }
      localStorage.removeItem(LS_WALLET_KEY);
    } finally {
      setIsConnecting(false);
    }
  };

  // ─── 4. Auto-reconnect ────────────────────────────────────────────────────────

  const _tryAutoConnect = useCallback(async () => {
    if (!window.ethereum) return;
    if (localStorage.getItem(LS_WALLET_KEY) !== 'true') return;

    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (accounts && accounts.length > 0) {
        const tempProvider = new ethers.BrowserProvider(window.ethereum);
        setProvider(tempProvider);
        await _hydrateFromProvider(tempProvider);
        fetchData();
      } else {
        localStorage.removeItem(LS_WALLET_KEY);
      }
    } catch (err) {
      console.warn('Auto-connect failed silently:', err);
      localStorage.removeItem(LS_WALLET_KEY);
    }
  }, []);

  // ─── 5. Fetch Data ────────────────────────────────────────────────────────────

  const fetchLeaderboard = useCallback(async () => {
    try {
      if (!ACTIVE_NETWORK.contractAddress) return;
      // Use wallet provider if available, otherwise fall back to public RPC
      const readProvider = window.ethereum
        ? new ethers.BrowserProvider(window.ethereum)
        : new ethers.JsonRpcProvider('https://mainnet.base.org');
      const contract = new ethers.Contract(ACTIVE_NETWORK.contractAddress, contractData.abi, readProvider);
      const [data, size] = await contract.getLeaderboard();
      const formatted = [];
      for (let i = 0; i < size; i++) {
        formatted.push({
          player: data[i].player,
          score: Number(data[i].score),
          level: Number(data[i].level),
          win: data[i].win,
          timestamp: Number(data[i].timestamp) * 1000,
        });
      }
      setLeaderboard(formatted);
    } catch (err) {
      console.warn('fetchLeaderboard failed:', err);
    }
  }, []);

  const fetchPlayerStats = useCallback(async () => {
    try {
      if (!window.ethereum || !addressRef.current || !ACTIVE_NETWORK.contractAddress) return;
      const tempProvider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(ACTIVE_NETWORK.contractAddress, contractData.abi, tempProvider);
      
      const stats = await contract.getPlayerStats(addressRef.current);
      const hasCheckedIn = await contract.hasCheckedInToday(addressRef.current);
      
      setPlayerStats({
        personalBest: Number(stats.personalBest),
        achievementBits: Number(stats.achievementBits),
        lastCheckIn: Number(stats.lastCheckIn) * 1000,
        hasCheckedInToday: hasCheckedIn,
      });
    } catch (err) {
      console.warn('fetchPlayerStats failed:', err);
    }
  }, []);

  const fetchData = useCallback(() => {
    fetchLeaderboard();
    if (addressRef.current) fetchPlayerStats();
  }, [fetchLeaderboard, fetchPlayerStats]);

  // ─── 6. Event Listeners ───────────────────────────────────────────────────────

  useEffect(() => {
    _tryAutoConnect();
    fetchLeaderboard(); // Load leaderboard immediately, no wallet needed

    if (window.ethereum) {
      const handleAccountsChanged = (accounts) => {
        if (accounts.length > 0) {
          const tempProvider = new ethers.BrowserProvider(window.ethereum);
          setProvider(tempProvider);
          _hydrateFromProvider(tempProvider).then(() => fetchData()).catch(console.error);
        } else {
          disconnectWallet();
        }
      };

      const handleChainChanged = () => {
        const newChainId = parseInt(window.ethereum.chainId, 16).toString();
        setChainId(newChainId);

        if (addressRef.current) {
          const tempProvider = new ethers.BrowserProvider(window.ethereum);
          setProvider(tempProvider);
          _hydrateFromProvider(tempProvider).then(() => fetchData()).catch(console.error);
        }
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);

      return () => {
        if (window.ethereum.removeListener) {
          window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
          window.ethereum.removeListener('chainChanged', handleChainChanged);
        }
      };
    }
  }, [_tryAutoConnect, fetchData, fetchLeaderboard]);

  // ─── 7. Transactions ──────────────────────────────────────────────────────────

  const submitScore = async (score, level, win) => {
    if (!signer || !ACTIVE_NETWORK.contractAddress) return false;
    
    // Generate a pseudo-random session ID
    const sessionId = ethers.hexlify(ethers.randomBytes(32));
    
    setTxState({ status: 'pending', type: 'score', hash: '', message: 'Submitting score to Base...' });
    
    try {
      const contract = new ethers.Contract(ACTIVE_NETWORK.contractAddress, contractData.abi, signer);
      const tx = await contract.submitScore(score, level, win, sessionId);
      
      setTxState({ status: 'pending', type: 'score', hash: tx.hash, message: 'Waiting for confirmation...' });
      
      const receipt = await tx.wait();
      
      // Parse events for AchievementUnlocked
      const achievementsUnlocked = [];
      for (const log of receipt.logs) {
        try {
          const parsedLog = contract.interface.parseLog(log);
          if (parsedLog && parsedLog.name === 'AchievementUnlocked') {
            achievementsUnlocked.push({
              badgeId: Number(parsedLog.args.badgeId),
              name: parsedLog.args.name
            });
          }
        } catch (e) {
          // Log may not belong to this contract
        }
      }

      if (achievementsUnlocked.length > 0) {
        // Dispatch custom event for AchievementToast
        achievementsUnlocked.forEach(ach => {
           window.dispatchEvent(new CustomEvent('achievement-unlocked', { detail: ach }));
        });
      }

      setTxState({ status: 'success', type: 'score', hash: tx.hash, message: 'Score recorded onchain!' });
      
      // Clear success after 6s
      setTimeout(() => {
        setTxState(prev => prev.hash === tx.hash ? { status: 'idle', type: null, hash: '', message: '' } : prev);
      }, 6000);
      
      fetchData();
      return true;
    } catch (err) {
      console.error('Score submission failed:', err);
      let errMsg = 'Transaction failed.';
      if (err.code === 4001 || err.message?.includes('User rejected')) {
        errMsg = 'Transaction rejected in wallet.';
      } else if (err.reason) {
        errMsg = `Reverted: ${err.reason}`;
      } else if (err.message) {
        // Truncate overly long error messages
        errMsg = err.message.substring(0, 100) + '...';
      }
      setTxState({ status: 'failed', type: 'score', hash: '', message: errMsg });
      return false;
    }
  };

  const dailyCheckIn = async () => {
    if (!signer || !ACTIVE_NETWORK.contractAddress) return false;
    
    if (playerStats.hasCheckedInToday) {
      setError('Already checked in today.');
      return false;
    }

    setTxState({ status: 'pending', type: 'checkin', hash: '', message: 'Recording check-in on Base...' });
    
    try {
      const contract = new ethers.Contract(ACTIVE_NETWORK.contractAddress, contractData.abi, signer);
      const tx = await contract.dailyCheckIn();
      
      setTxState({ status: 'pending', type: 'checkin', hash: tx.hash, message: 'Waiting for confirmation...' });
      const receipt = await tx.wait();
      
      // Parse events for AchievementUnlocked
      for (const log of receipt.logs) {
        try {
          const parsedLog = contract.interface.parseLog(log);
          if (parsedLog && parsedLog.name === 'AchievementUnlocked') {
            window.dispatchEvent(new CustomEvent('achievement-unlocked', { 
               detail: { badgeId: Number(parsedLog.args.badgeId), name: parsedLog.args.name }
            }));
          }
        } catch (e) {
          // ignore
        }
      }

      setTxState({ status: 'success', type: 'checkin', hash: tx.hash, message: 'Daily check-in complete!' });
      
      setTimeout(() => {
        setTxState(prev => prev.hash === tx.hash ? { status: 'idle', type: null, hash: '', message: '' } : prev);
      }, 6000);
      
      fetchData();
      return true;
    } catch (err) {
      console.error('Check-in failed:', err);
      let errMsg = 'Transaction failed.';
      if (err.code === 4001) errMsg = 'Transaction rejected.';
      else if (err.reason) errMsg = err.reason;
      setTxState({ status: 'failed', type: 'checkin', hash: '', message: errMsg });
      return false;
    }
  };

  const isCorrectChain = chainId === ACTIVE_NETWORK.chainId.toString();

  // If contract isn't deployed yet (empty VITE_CONTRACT_SEPOLIA)
  const isContractMissing = !ACTIVE_NETWORK.contractAddress || ACTIVE_NETWORK.contractAddress === '0x0000000000000000000000000000000000000000';

  return (
    <Web3Context.Provider value={{
      provider,
      signer,
      address,
      balance,
      chainId,
      isCorrectChain,
      isConnecting,
      error,
      txState,
      leaderboard,
      playerStats,
      isContractMissing,
      connectWallet,
      disconnectWallet,
      switchToActiveChain,
      submitScore,
      dailyCheckIn,
      fetchData,
      setTxState // Useful to clear tx state from components
    }}>
      {children}
    </Web3Context.Provider>
  );
};

export const useWeb3 = () => useContext(Web3Context);
