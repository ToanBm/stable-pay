import { ethers } from 'ethers';
import {
  provider,
  getUSDTContract,
  employerWallet,
  offrampWallet,
} from '../config/blockchain';

/**
 * Get USDT balance of an address
 */
export async function getUSDTBalance(address: string): Promise<string> {
  try {
    const contract = getUSDTContract();
    const balance = await contract.balanceOf(address);
    const decimals = await contract.decimals();
    return ethers.formatUnits(balance, decimals);
  } catch (error) {
    throw new Error(`Failed to get USDT balance: ${error}`);
  }
}

/**
 * Transfer USDT from employer wallet to employee
 */
export async function transferUSDT(
  to: string,
  amount: string
): Promise<ethers.ContractTransactionResponse> {
  if (!employerWallet) {
    throw new Error('Employer wallet not configured');
  }

  try {
    const contract = getUSDTContract();
    const contractWithSigner = contract.connect(employerWallet);
    const decimals = await contract.decimals();
    const amountWei = ethers.parseUnits(amount, decimals);

    const tx = await contractWithSigner.transfer(to, amountWei);
    return tx;
  } catch (error) {
    throw new Error(`Failed to transfer USDT: ${error}`);
  }
}

/**
 * Transfer USDT from employee to offramp wallet
 * Employee must sign this transaction from frontend
 */
export async function verifyTransferTransaction(
  txHash: string
): Promise<{
  from: string;
  to: string;
  amount: string;
  success: boolean;
}> {
  try {
    const receipt = await provider.getTransactionReceipt(txHash);

    if (!receipt) {
      throw new Error('Transaction not found');
    }

    if (receipt.status !== 1) {
      throw new Error('Transaction failed');
    }

    const tx = await provider.getTransaction(txHash);
    if (!tx) {
      throw new Error('Transaction details not found');
    }

    // Get transfer event from receipt
    const contract = getUSDTContract();
    const transferEvent = contract.interface.parseLog({
      topics: receipt.logs[0].topics as string[],
      data: receipt.logs[0].data,
    });

    if (transferEvent?.name !== 'Transfer') {
      throw new Error('Transfer event not found');
    }

    const from = transferEvent.args[0] as string;
    const to = transferEvent.args[1] as string;
    const amount = transferEvent.args[2] as bigint;

    const decimals = await contract.decimals();
    const amountFormatted = ethers.formatUnits(amount, decimals);

    return {
      from,
      to,
      amount: amountFormatted,
      success: true,
    };
  } catch (error: any) {
    // Provide more detailed error message
    const errorMessage = error?.message || String(error);
    console.error('[Blockchain] Verify transaction error:', errorMessage);
    console.error('[Blockchain] TX Hash:', txHash);
    
    // Check for specific RPC errors
    if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
      throw new Error('RPC endpoint returned 403 Forbidden. Please check RPC configuration.');
    }
    
    if (errorMessage.includes('could not decode')) {
      throw new Error('Could not decode transaction data. Transaction may not exist or contract address is incorrect.');
    }
    
    throw new Error(`Failed to verify transaction: ${errorMessage}`);
  }
}

/**
 * Wait for transaction confirmation
 * Note: Stable has instant finality, but we still wait for receipt
 */
export async function waitForTransaction(
  txHash: string
): Promise<ethers.TransactionReceipt | null> {
  try {
    const receipt = await provider.waitForTransaction(txHash);
    return receipt;
  } catch (error) {
    throw new Error(`Failed to wait for transaction: ${error}`);
  }
}

/**
 * Get transaction receipt
 */
export async function getTransactionReceipt(
  txHash: string
): Promise<ethers.TransactionReceipt | null> {
  try {
    const receipt = await provider.getTransactionReceipt(txHash);
    return receipt;
  } catch (error) {
    throw new Error(`Failed to get transaction receipt: ${error}`);
  }
}

/**
 * Check if address is valid
 */
export function isValidAddress(address: string): boolean {
  return ethers.isAddress(address);
}

/**
 * Get offramp wallet address
 */
export function getOfframpAddress(): string {
  if (!offrampWallet) {
    throw new Error('Offramp wallet not configured');
  }
  return offrampWallet.address;
}

/**
 * Transfer USDT from offramp wallet to user wallet (for on-ramp)
 * This is called when payment_intent.succeeded webhook is received
 */
export async function transferUSDTFromOfframp(
  to: string,
  amount: string,
  maxRetries: number = 3
): Promise<ethers.ContractTransactionResponse> {
  if (!offrampWallet) {
    throw new Error('Offramp wallet not configured');
  }

  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const contract = getUSDTContract();
      const contractWithSigner = contract.connect(offrampWallet);
      const decimals = await contract.decimals();
      const amountWei = ethers.parseUnits(amount, decimals);

      // Check offramp wallet balance before transferring
      const balance = await contract.balanceOf(offrampWallet.address);
      if (balance < amountWei) {
        throw new Error(
          `Insufficient balance in offramp wallet. Required: ${ethers.formatUnits(amountWei, decimals)} USDT, Available: ${ethers.formatUnits(balance, decimals)} USDT`
        );
      }

      const tx = await contractWithSigner.transfer(to, amountWei);
      return tx;
    } catch (error: any) {
      lastError = error;
      
      // Retry on network/RPC errors (502, 503, timeout, etc.)
      const isRetryableError = 
        error.message?.includes('502') ||
        error.message?.includes('503') ||
        error.message?.includes('Bad Gateway') ||
        error.message?.includes('Service Unavailable') ||
        error.message?.includes('timeout') ||
        error.message?.includes('ECONNRESET') ||
        error.message?.includes('ETIMEDOUT') ||
        error.code === 'SERVER_ERROR' ||
        error.code === 'TIMEOUT';
      
      if (isRetryableError && attempt < maxRetries) {
        const waitTime = attempt * 2; // 2s, 4s, 6s
        console.warn(`RPC error on attempt ${attempt}/${maxRetries}, retrying in ${waitTime}s...`);
        await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
        continue;
      }
      
      // Don't retry on non-retryable errors (insufficient balance, invalid address, etc.)
      throw new Error(`Failed to transfer USDT from offramp wallet: ${error.message}`);
    }
  }
  
  throw new Error(`Failed to transfer USDT from offramp wallet after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`);
}

/**
 * Get offramp wallet USDT balance
 */
export async function getOfframpBalance(): Promise<string> {
  if (!offrampWallet) {
    throw new Error('Offramp wallet not configured');
  }

  try {
    return await getUSDTBalance(offrampWallet.address);
  } catch (error) {
    throw new Error(`Failed to get offramp wallet balance: ${error}`);
  }
}

/**
 * Verify payroll transaction - can handle single or batch transfers
 * Returns all transfers found in the transaction
 */
export async function verifyPayrollTransaction(
  txHash: string,
  expectedEmployer: string
): Promise<{
  transfers: Array<{
    from: string;
    to: string;
    amount: string;
  }>;
  success: boolean;
  blockNumber: number;
}> {
  try {
    const receipt = await provider.getTransactionReceipt(txHash);

    if (!receipt) {
      throw new Error('Transaction not found');
    }

    if (receipt.status !== 1) {
      throw new Error('Transaction failed');
    }

    const tx = await provider.getTransaction(txHash);
    if (!tx) {
      throw new Error('Transaction details not found');
    }

    // Verify sender is the employer
    if (tx.from.toLowerCase() !== expectedEmployer.toLowerCase()) {
      throw new Error('Transaction sender does not match employer address');
    }

    // Get all Transfer events from receipt
    const contract = getUSDTContract();
    const transfers: Array<{ from: string; to: string; amount: string }> = [];

    for (const log of receipt.logs) {
      try {
        const parsedLog = contract.interface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        });

        if (parsedLog && parsedLog.name === 'Transfer') {
          const from = parsedLog.args[0] as string;
          const to = parsedLog.args[1] as string;
          const amount = parsedLog.args[2] as bigint;

          // Only include transfers FROM employer (payroll transfers)
          if (from.toLowerCase() === expectedEmployer.toLowerCase()) {
            const decimals = await contract.decimals();
            const amountFormatted = ethers.formatUnits(amount, decimals);

            transfers.push({
              from,
              to,
              amount: amountFormatted,
            });
          }
        }
      } catch (error) {
        // Skip logs that are not Transfer events
        continue;
      }
    }

    if (transfers.length === 0) {
      throw new Error('No payroll transfers found in transaction');
    }

    return {
      transfers,
      success: true,
      blockNumber: receipt.blockNumber,
    };
  } catch (error: any) {
    throw new Error(`Failed to verify payroll transaction: ${error.message}`);
  }
}

