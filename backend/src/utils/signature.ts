import { ethers } from 'ethers';

/**
 * Verify message signature
 */
export function verifySignature(
  message: string,
  signature: string,
  expectedAddress: string
): boolean {
  try {
    const recoveredAddress = ethers.verifyMessage(message, signature);
    return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
  } catch (error) {
    return false;
  }
}

/**
 * Create a message for cashout request
 */
export function createCashoutMessage(
  address: string,
  amount: string,
  timestamp: string
): string {
  return `I request cashout ${amount} USDT at ${timestamp}\n\nAddress: ${address}`;
}

/**
 * Validate message format
 */
export function validateCashoutMessage(
  message: string,
  address: string,
  amount: string
): boolean {
  // Normalize addresses to lowercase for comparison
  const normalizedAddress = address.toLowerCase();
  
  // More flexible pattern - allows 1 or 2 newlines, case insensitive
  const patterns = [
    // Pattern 1: 2 newlines (original)
    new RegExp(
      `I request cashout ${amount} USDT at .+\\n\\nAddress: ${normalizedAddress}`,
      'i'
    ),
    // Pattern 2: 1 newline
    new RegExp(
      `I request cashout ${amount} USDT at .+\\nAddress: ${normalizedAddress}`,
      'i'
    ),
    // Pattern 3: Space instead of newline
    new RegExp(
      `I request cashout ${amount} USDT at .+ Address: ${normalizedAddress}`,
      'i'
    ),
  ];
  
  // Check if any pattern matches
  return patterns.some(pattern => pattern.test(message.toLowerCase()));
}

