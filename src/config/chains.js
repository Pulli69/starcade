/**
 * chains.js — Single source of truth for all network config.
 *
 * To switch to Base mainnet: set VITE_NETWORK=mainnet in .env
 * Everything else updates automatically.
 */

export const NETWORKS = {
  sepolia: {
    chainId: 84532,
    hex: '0x14a34',
    name: 'Base Sepolia',
    rpcUrl: import.meta.env.VITE_BASE_SEPOLIA_RPC || 'https://sepolia.base.org',
    explorerUrl: import.meta.env.VITE_BASE_SEPOLIA_EXPLORER || 'https://sepolia.basescan.org',
    contractAddress: import.meta.env.VITE_CONTRACT_SEPOLIA || '',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    isTestnet: true,
  },
  mainnet: {
    chainId: 8453,
    hex: '0x2105',
    name: 'Base',
    rpcUrl: import.meta.env.VITE_BASE_MAINNET_RPC || 'https://mainnet.base.org',
    explorerUrl: import.meta.env.VITE_BASE_MAINNET_EXPLORER || 'https://basescan.org',
    contractAddress: import.meta.env.VITE_CONTRACT_MAINNET || '',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    isTestnet: false,
  },
};

/** The currently active network — controlled by VITE_NETWORK env var */
export const ACTIVE_NETWORK = NETWORKS[import.meta.env.VITE_NETWORK ?? 'sepolia'] ?? NETWORKS.sepolia;

/** wallet_addEthereumChain / wallet_switchEthereumChain payload */
export const getChainConfig = (network = ACTIVE_NETWORK) => ({
  chainId: network.hex,
  chainName: network.name,
  nativeCurrency: network.nativeCurrency,
  rpcUrls: [network.rpcUrl],
  blockExplorerUrls: [network.explorerUrl],
});

/** Returns a Basescan tx link for the active network */
export const getTxUrl = (hash) =>
  hash ? `${ACTIVE_NETWORK.explorerUrl}/tx/${hash}` : '';

/** Returns a Basescan address link */
export const getAddressUrl = (addr) =>
  addr ? `${ACTIVE_NETWORK.explorerUrl}/address/${addr}` : '';
