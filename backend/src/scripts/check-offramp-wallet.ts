/**
 * Script to check offramp wallet balance and configuration
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { getOfframpAddress, getOfframpBalance, getUSDTBalance } from '../utils/blockchain';
import { getUSDTContract } from '../config/blockchain';

async function checkOfframpWallet() {
  try {
    console.log('\n🔍 Checking Offramp Wallet...\n');
    
    // Get offramp address
    try {
      const address = getOfframpAddress();
      console.log('✅ Offramp Wallet Address:', address);
    } catch (error: any) {
      console.error('❌ Offramp wallet not configured:', error.message);
      console.log('\n⚠️  Please set OFFRAMP_PRIVATE_KEY in .env file');
      process.exit(1);
    }
    
    // Get balance
    try {
      const balance = await getOfframpBalance();
      console.log('✅ Offramp Wallet Balance:', balance, 'gUSDT');
      
      const balanceNum = parseFloat(balance);
      if (balanceNum < 10) {
        console.log('\n⚠️  WARNING: Balance is less than 10 gUSDT');
        console.log('   Current balance:', balance, 'gUSDT');
        console.log('   Required for test:', '10 gUSDT');
        console.log('   Shortfall:', (10 - balanceNum).toFixed(6), 'gUSDT');
      } else {
        console.log('✅ Balance is sufficient for test transfer (10 gUSDT)');
      }
    } catch (error: any) {
      console.error('❌ Failed to get balance:', error.message);
    }
    
    // Test contract interaction
    try {
      const contract = getUSDTContract();
      const address = getOfframpAddress();
      const decimals = await contract.decimals();
      const balanceWei = await contract.balanceOf(address);
      const balanceFormatted = ethers.formatUnits(balanceWei, decimals);
      
      console.log('\n📊 Contract Details:');
      console.log('   Decimals:', decimals);
      console.log('   Balance (wei):', balanceWei.toString());
      console.log('   Balance (formatted):', balanceFormatted, 'gUSDT');
    } catch (error: any) {
      console.error('❌ Contract interaction failed:', error.message);
    }
    
    console.log('\n✅ Check complete!');
    
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Import ethers for formatting
import { ethers } from 'ethers';

checkOfframpWallet()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

