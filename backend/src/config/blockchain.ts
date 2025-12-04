import { ethers } from 'ethers';
import dotenv from 'dotenv';
import path from 'path';

// Load .env to ensure environment variables are available
// Try to load from project root (where .env usually is)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
// Also try default location as fallback
dotenv.config();

// Stable Testnet RPC
export const rpcUrl = process.env.STABLE_RPC_URL || 'https://rpc.testnet.stable.xyz';

// Provider
export const provider = new ethers.JsonRpcProvider(rpcUrl);

// gUSDT Contract Address (gas token on Stable Testnet)
export const usdtContractAddress = process.env.USDT_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000001000';

// Wallets
export const employerWallet = process.env.EMPLOYER_PRIVATE_KEY
  ? new ethers.Wallet(process.env.EMPLOYER_PRIVATE_KEY, provider)
  : null;

export const offrampWallet = process.env.OFFRAMP_PRIVATE_KEY
  ? new ethers.Wallet(process.env.OFFRAMP_PRIVATE_KEY, provider)
  : null;

// USDT Contract ABI (ERC20 standard)
export const usdtAbi = [
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
];

export const getUSDTContract = () => {
  if (!usdtContractAddress) {
    throw new Error('USDT_CONTRACT_ADDRESS not configured');
  }
  return new ethers.Contract(usdtContractAddress, usdtAbi, provider);
};

