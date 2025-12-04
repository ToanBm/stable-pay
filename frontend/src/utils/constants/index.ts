// ============================================
// API Configuration
// ============================================
// Get API URL from env, but fallback to localhost if not set or contains placeholder
const envApiUrl = import.meta.env.VITE_API_URL;
export const API_BASE_URL = 
  envApiUrl && !envApiUrl.includes('YOUR_VPS_IP') 
    ? envApiUrl 
    : 'http://localhost:3000';

// ============================================
// Stripe Configuration
// ============================================
export const STRIPE_PUBLISHABLE_KEY = 
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 
  'pk_test_51SZ2yNLcdcGA3J2H27Agez2LwkvUQYVPUptJgZxZipJbeRYCUuJCEvMhjfNaYTvLH9bh39sojroFtkDRQOHezwx500N37EHR9T';

// ============================================
// Blockchain Configuration (Fixed values - không dùng env)
// ============================================
export const STABLE_RPC_URL = 'https://rpc.testnet.stable.xyz';
export const USDT_CONTRACT_ADDRESS = '0x0000000000000000000000000000000000001000';
export const OFF_RAMP_ADDRESS = '0x520A3B99F0aB4091230303DD83805987D0aD471a';
export const BLOCK_EXPLORER_URL = 'https://testnet-explorer.stable.xyz';

// Chain ID
export const CHAIN_ID = '0x899'; // 2201 in hex
export const CHAIN_ID_DECIMAL = 2201;

// Stable Testnet Network Configuration
export const STABLE_TESTNET = {
  chainId: CHAIN_ID,
  chainIdDecimal: CHAIN_ID_DECIMAL,
  chainName: 'Stable Testnet',
  nativeCurrency: {
    name: 'gUSDT',
    symbol: 'gUSDT',
    decimals: 18,
  },
  rpcUrls: [STABLE_RPC_URL],
  blockExplorerUrls: [BLOCK_EXPLORER_URL],
};

// Supported Currencies
export const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'VND', 'JPY'] as const;
export type Currency = typeof SUPPORTED_CURRENCIES[number];

// Payment Currencies (for Stripe)
export const PAYMENT_CURRENCIES = ['USD', 'EUR'] as const;
export type PaymentCurrency = typeof PAYMENT_CURRENCIES[number];

// Cashout Currencies
export const CASHOUT_CURRENCIES = ['USD', 'EUR'] as const;
export type CashoutCurrency = typeof CASHOUT_CURRENCIES[number];

// Colors
export const COLORS = {
  primary: '#667eea',
  success: '#10b981',
  error: '#ef4444',
  warning: '#f59e0b',
  background: '#f9fafb',
} as const;
