/**
 * Script to verify gUSDT contract address
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { provider, usdtContractAddress, getUSDTContract } from '../config/blockchain';
import { ethers } from 'ethers';

async function checkGUSDTContract() {
  try {
    console.log('\n🔍 Checking gUSDT Contract...\n');
    console.log('Contract Address:', usdtContractAddress);
    console.log('RPC URL:', provider.connection?.url || 'default');
    
    // Get contract
    const contract = getUSDTContract();
    
    // Try to get symbol (if available in ABI)
    try {
      // Add symbol to ABI temporarily
      const extendedAbi = [
        ...contract.interface.fragments,
        'function symbol() view returns (string)',
        'function name() view returns (string)',
      ];
      const extendedContract = new ethers.Contract(usdtContractAddress, extendedAbi, provider);
      
      try {
        const symbol = await extendedContract.symbol();
        console.log('✅ Symbol:', symbol);
      } catch {
        console.log('⚠️  Symbol not available (may not be in ABI)');
      }
      
      try {
        const name = await extendedContract.name();
        console.log('✅ Name:', name);
      } catch {
        console.log('⚠️  Name not available (may not be in ABI)');
      }
    } catch (error) {
      console.log('⚠️  Could not get symbol/name');
    }
    
    // Get decimals
    const decimals = await contract.decimals();
    console.log('✅ Decimals:', decimals);
    
    if (decimals === 18) {
      console.log('✅ Decimals = 18 (correct for gUSDT)');
    } else {
      console.log('⚠️  Decimals =', decimals, '(gUSDT should be 18)');
    }
    
    // Test balance of a known address
    const testAddress = '0x0000000000000000000000000000000000000000';
    const balance = await contract.balanceOf(testAddress);
    console.log('✅ Contract is callable');
    console.log('   Test balance:', ethers.formatUnits(balance, decimals), 'tokens');
    
    // Check if this is the native gas token address
    if (usdtContractAddress.toLowerCase() === '0x0000000000000000000000000000000000001000') {
      console.log('\n✅ This is the standard gUSDT contract address on Stable Testnet');
      console.log('   Address: 0x0000000000000000000000000000000000001000');
      console.log('   This is the native gas token (gUSDT)');
    } else {
      console.log('\n⚠️  Contract address differs from standard gUSDT address');
      console.log('   Standard: 0x0000000000000000000000000000000000001000');
      console.log('   Current: ', usdtContractAddress);
    }
    
    console.log('\n✅ Contract verification complete!');
    
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

checkGUSDTContract()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

