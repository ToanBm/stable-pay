import dotenv from 'dotenv';
import { ethers } from 'ethers';
import { provider, rpcUrl, usdtContractAddress, getUSDTContract, employerWallet, offrampWallet } from '../config/blockchain';
import { getUSDTBalance, isValidAddress } from '../utils/blockchain';

dotenv.config();

async function testBlockchainConnection() {
  console.log('=== Testing Stable Testnet Connection ===\n');

  // 1. Test RPC URL
  console.log('1. RPC URL:', rpcUrl);
  
  // 2. Test Provider Connection
  try {
    const blockNumber = await provider.getBlockNumber();
    console.log('✅ Provider connected!');
    console.log('   Current block number:', blockNumber);
  } catch (error) {
    console.error('❌ Provider connection failed:', error);
    return;
  }

  // 3. Test USDT Contract Address
  console.log('\n2. USDT Contract Address:', usdtContractAddress || 'NOT SET');
  
  if (!usdtContractAddress) {
    console.warn('⚠️  USDT_CONTRACT_ADDRESS not configured');
    return;
  }

  // 4. Test USDT Contract
  try {
    const contract = getUSDTContract();
    console.log('✅ USDT Contract loaded!');
    
    // Get decimals
    const decimals = await contract.decimals();
    console.log('   Decimals:', decimals);
    
    // Get contract name/symbol if available
    try {
      const symbol = await contract.symbol();
      console.log('   Symbol:', symbol);
    } catch {
      // Symbol might not be in ABI
    }
  } catch (error) {
    console.error('❌ USDT Contract error:', error);
    return;
  }

  // 5. Test Balance Function
  console.log('\n3. Testing balance function...');
  if (usdtContractAddress) {
    try {
      // Test with a random address (should return 0 or valid balance)
      const testAddress = '0x0000000000000000000000000000000000000000';
      const balance = await getUSDTBalance(testAddress);
      console.log('✅ Balance function works!');
      console.log('   Test address balance:', balance, 'USDT');
    } catch (error) {
      console.error('❌ Balance function error:', error);
    }
  }

  // 6. Test Address Validation
  console.log('\n4. Testing address validation...');
  // Use provided test address
  const validAddr = '0xC62cC8d9cF9186f5f1E6458641b45C70c1899537';
  const invalidAddr = '0xinvalid';
  
  const validCheck = isValidAddress(validAddr);
  const invalidCheck = !isValidAddress(invalidAddr);
  
  console.log('   Valid address check:', validCheck ? '✅' : '❌');
  console.log('     Address:', validAddr);
  console.log('   Invalid address check:', invalidCheck ? '✅' : '❌');
  console.log('     Address:', invalidAddr);
  
  // Also test balance of this address
  if (validCheck && usdtContractAddress) {
    try {
      const balance = await getUSDTBalance(validAddr);
      console.log('   Balance of test address:', balance, 'USDT');
    } catch (error) {
      console.log('   Could not fetch balance for test address');
    }
  }
  
  if (!validCheck) {
    console.log('   ⚠️  Address validation might have issues');
  }

  // 7. Test Wallets
  console.log('\n5. Testing wallets...');
  
  if (employerWallet) {
    console.log('✅ Employer wallet configured');
    console.log('   Address:', employerWallet.address);
    try {
      const balance = await provider.getBalance(employerWallet.address);
      console.log('   Balance:', ethers.formatEther(balance), 'ETH/gUSDT');
    } catch (error) {
      console.log('   Could not fetch balance');
    }
  } else {
    console.warn('⚠️  Employer wallet not configured');
  }

  if (offrampWallet) {
    console.log('✅ Offramp wallet configured');
    console.log('   Address:', offrampWallet.address);
    try {
      const balance = await provider.getBalance(offrampWallet.address);
      console.log('   Balance:', ethers.formatEther(balance), 'ETH/gUSDT');
    } catch (error) {
      console.log('   Could not fetch balance');
    }
  } else {
    console.warn('⚠️  Offramp wallet not configured');
  }

  console.log('\n=== Test Complete ===');
}

testBlockchainConnection().catch(console.error);

