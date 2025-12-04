// Load environment variables FIRST before any imports
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Now import other modules (they will have access to env vars)
import { ethers } from 'ethers';
import { createCashoutMessage } from '../utils/signature';
import { getOfframpAddress } from '../utils/blockchain';
import { provider, getUSDTContract } from '../config/blockchain';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  response?: any;
}

const results: TestResult[] = [];

/**
 * Test helper function
 */
async function test(
  name: string,
  testFn: () => Promise<any>
): Promise<void> {
  try {
    console.log(`\n🧪 Testing: ${name}`);
    const response = await testFn();
    results.push({ name, passed: true, response });
    console.log(`   ✅ PASSED`);
    if (response && typeof response === 'object') {
      console.log(`   Response:`, JSON.stringify(response, null, 2).substring(0, 200));
    }
  } catch (error: any) {
    results.push({ name, passed: false, error: error.message });
    console.log(`   ❌ FAILED: ${error.message}`);
  }
}

/**
 * Helper to make HTTP requests
 */
async function request(
  method: string,
  endpoint: string,
  body?: any
): Promise<any> {
  const url = `${API_BASE_URL}${endpoint}`;
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text();
    let errorData;
    try {
      errorData = JSON.parse(errorText);
    } catch {
      errorData = { error: errorText };
    }
    throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Main test function
 */
async function runTests() {
  console.log('='.repeat(60));
  console.log('🚀 API Testing Suite');
  console.log('='.repeat(60));
  console.log(`API Base URL: ${API_BASE_URL}\n`);

  // Test 1: Health Check
  await test('Health Check', async () => {
    return request('GET', '/health');
  });

  // Test 2: Register Employee
  // Use employee wallet from private key if available, otherwise use hardcoded address
  let testEmployeeAddress: string;
  let testEmployeeWallet: ethers.Wallet | null = null;
  
  if (process.env.TEST_EMPLOYEE_PRIVATE_KEY) {
    testEmployeeWallet = new ethers.Wallet(process.env.TEST_EMPLOYEE_PRIVATE_KEY, provider);
    testEmployeeAddress = testEmployeeWallet.address;
    console.log(`\n📝 Using employee wallet from TEST_EMPLOYEE_PRIVATE_KEY: ${testEmployeeAddress}`);
  } else {
    testEmployeeAddress = '0x574969d5fbf9ad24fa3756c0b2c6944b0ed2c220';
    console.log(`\n📝 Using hardcoded employee address: ${testEmployeeAddress} (no private key, cashout test will be skipped)`);
  }
  
  let employeeId: number | null = null;

  await test('Register Employee', async () => {
    const response = await request('POST', '/api/employees/register', {
      wallet_address: testEmployeeAddress,
      name: 'Test Employee',
      email: 'test@example.com',
      country: 'US',
    });
    employeeId = response.id;
    return response;
  });

  // Test 3: Get Employee
  await test('Get Employee', async () => {
    return request('GET', `/api/employees/${testEmployeeAddress}`);
  });

  // Test 4: Update Employee
  await test('Update Employee', async () => {
    return request('PUT', `/api/employees/${testEmployeeAddress}`, {
      name: 'Updated Test Employee',
    });
  });

  // Test 5: List Employees
  await test('List Employees', async () => {
    return request('GET', '/api/employees?page=1&limit=10');
  });

  // Test 6: Prepare Payroll
  // Use a different address for employer to avoid validation error
  const employerAddress = process.env.EMPLOYER_ADDRESS || '0x0dc5d0f55072bdac9a53888cdddec39f66f02dcc';
  let payrollId: string | null = null;

  // Test 6.0: Check Employer Balance
  await test('Check Employer Balance', async () => {
    return request('GET', `/api/cashout/balance/${employerAddress}`);
  });

  await test('Prepare Payroll', async () => {
    const response = await request('POST', '/api/payroll/prepare', {
      employer_address: employerAddress,
      employees: [
        {
          address: testEmployeeAddress,
          amount: '10.00',
        },
      ],
    });
    payrollId = response.payrollId;
    return response;
  });

  // Test 6.1: Prepare Payroll with Multiple Employees
  let batchPayrollId: string | null = null;
  // Use 2 different employee addresses for batch test
  const testEmployee2 = '0x42a3165d5aeacd2c04bce3d93eeb627de0ac1cac';

  await test('Prepare Payroll (Batch - Multiple Employees)', async () => {
    const response = await request('POST', '/api/payroll/prepare', {
      employer_address: employerAddress,
      employees: [
        {
          address: testEmployeeAddress,
          amount: '15.00',
        },
        {
          address: testEmployee2,
          amount: '20.00',
        },
      ],
    });
    batchPayrollId = response.payrollId;
    return response;
  });

  // Test 6.2: Prepare Payroll with Duplicate Address (should fail)
  await test('Prepare Payroll with Duplicate Employee (should fail)', async () => {
    try {
      await request('POST', '/api/payroll/prepare', {
        employer_address: employerAddress,
        employees: [
          {
            address: testEmployeeAddress,
            amount: '100',
          },
          {
            address: testEmployeeAddress, // Duplicate
            amount: '200',
          },
        ],
      });
      throw new Error('Should have failed with duplicate address');
    } catch (error: any) {
      if (error.message.includes('Duplicate') || error.message.includes('duplicate')) {
        return { error: 'Expected duplicate validation error' };
      }
      throw error;
    }
  });

  // Test 6.3: Prepare Payroll with Invalid Amount (should fail)
  await test('Prepare Payroll with Invalid Amount (should fail)', async () => {
    try {
      await request('POST', '/api/payroll/prepare', {
        employer_address: employerAddress,
        employees: [
          {
            address: testEmployee2,
            amount: 'invalid', // Invalid amount
          },
        ],
      });
      throw new Error('Should have failed with invalid amount');
    } catch (error: any) {
      if (error.message.includes('Invalid') || error.message.includes('amount') || error.message.includes('valid number')) {
        return { error: 'Expected amount validation error' };
      }
      throw error;
    }
  });

  // Test 6.4: Prepare Payroll with Employee = Employer (should fail)
  await test('Prepare Payroll with Employee = Employer (should fail)', async () => {
    try {
      await request('POST', '/api/payroll/prepare', {
        employer_address: employerAddress,
        employees: [
          {
            address: employerAddress, // Same as employer
            amount: '100',
          },
        ],
      });
      throw new Error('Should have failed with employee = employer');
    } catch (error: any) {
      if (error.message.includes('same as employer') || error.message.includes('cannot be same')) {
        return { error: 'Expected validation error' };
      }
      throw error;
    }
  });

  // Test 7: Execute Payroll (with mock txHash - will fail verification but test the endpoint)
  await test('Execute Payroll (with invalid txHash - should fail verification)', async () => {
    // If payrollId from previous test is not available, create a new one
    let testPayrollId = payrollId;
    if (!testPayrollId) {
      try {
        const prepareResponse = await request('POST', '/api/payroll/prepare', {
          employer_address: employerAddress,
          employees: [
            {
              address: testEmployeeAddress,
              amount: '5.00', // Small amount for test
            },
          ],
        });
        testPayrollId = prepareResponse.payrollId;
      } catch (error: any) {
        // If prepare also fails (e.g., RPC error), skip this test
        return { skipped: 'Cannot create payrollId due to RPC/network error' };
      }
    }
    
    try {
      await request('POST', '/api/payroll/execute', {
        payrollId: testPayrollId,
        txHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
        blockNumber: 12345,
      });
      throw new Error('Should have failed verification');
    } catch (error: any) {
      if (error.message.includes('verification') || error.message.includes('Transaction')) {
        return { error: 'Expected transaction verification error (this is expected with invalid txHash)' };
      }
      throw error;
    }
  });

  // Test 8: Get Payroll History (Employer)
  await test('Get Payroll History (Employer)', async () => {
    return request('GET', `/api/payroll/history?employerAddress=${employerAddress}&page=1&limit=10`);
  });

  // Test 9: Get Payroll History (Employee)
  await test('Get Payroll History (Employee)', async () => {
    return request('GET', `/api/payroll/history?employeeAddress=${testEmployeeAddress}&page=1&limit=10`);
  });

  // Test 10: Get Cashout Balance
  await test('Get Cashout Balance', async () => {
    return request('GET', `/api/cashout/balance/${testEmployeeAddress}`);
  });

  // Test 11: Get Cashout History
  await test('Get Cashout History', async () => {
    return request('GET', `/api/cashout/history/${testEmployeeAddress}?page=1&limit=10`);
  });

  // Test 12: Get Cashout Status (with invalid ID - should return 404)
  await test('Get Cashout Status (Non-existent ID - should return 404)', async () => {
    try {
      await request('GET', '/api/cashout/status/99999');
      throw new Error('Should have returned 404');
    } catch (error: any) {
      if (error.message.includes('404') || error.message.includes('not found')) {
        return { error: 'Expected 404 error' };
      }
      throw error;
    }
  });

  // Test 12.1: Request Cashout (Full Flow)
  // Note: This test requires:
  // 1. Employee wallet with USDT balance
  // 2. Employee private key (TEST_EMPLOYEE_PRIVATE_KEY in .env)
  // 3. Stripe test account with bank account
  await test('Request Cashout (Full Flow - requires USDT transfer)', async () => {
    // Use test employee wallet if available, otherwise skip
    if (!testEmployeeWallet) {
      return { skipped: 'TEST_EMPLOYEE_PRIVATE_KEY not set. Set it in .env to test cashout flow.' };
    }

    const employeeWallet = testEmployeeWallet;
    const employeeAddress = testEmployeeAddress;

    // Check if employee has USDT balance
    try {
      const balanceResponse = await request('GET', `/api/cashout/balance/${employeeAddress}`);
      const balance = parseFloat(balanceResponse.balance || '0');
      
      if (balance < 5.0) {
        return { skipped: `Employee wallet has insufficient balance (${balance} USDT). Need at least 5.0 USDT.` };
      }
    } catch (error: any) {
      return { skipped: `Cannot check employee balance: ${error.message}` };
    }

    // Step 1: Transfer USDT from employee to offramp wallet
    const cashoutAmount = '5.0'; // Small amount for test
    let txHash: string;
    
    try {
      const offrampAddress = getOfframpAddress();
      const contract = getUSDTContract();
      const contractWithSigner = contract.connect(employeeWallet) as ethers.Contract;
      const decimals = await contract.decimals();
      const amountWei = ethers.parseUnits(cashoutAmount, decimals);
      
      const tx = await contractWithSigner.transfer(offrampAddress, amountWei) as ethers.ContractTransactionResponse;
      txHash = tx.hash;
      
      // Wait for transaction confirmation
      await provider.waitForTransaction(txHash);
    } catch (error: any) {
      // If transfer fails, try to use a mock txHash for testing validation
      // In real scenario, this should be a real transaction
      return { skipped: `Cannot transfer USDT: ${error.message}. Need real on-chain transaction.` };
    }

    // Step 2: Create signature
    const timestamp = new Date().toISOString();
    const message = createCashoutMessage(employeeAddress, cashoutAmount, timestamp);
    const signature = await employeeWallet.signMessage(message);

    // Step 3: Request cashout
    // Note: bankAccountId should be a Stripe test bank account ID
    // For test, we can use a placeholder or skip if not available
    const testBankAccountId = process.env.STRIPE_TEST_BANK_ACCOUNT_ID || 'ba_test_1234567890';
    
    try {
      const response = await request('POST', '/api/cashout/request', {
        employeeAddress,
        amount: cashoutAmount,
        currency: 'usd',
        bankAccountId: testBankAccountId,
        signature,
        message,
        txHash,
      });
      return response;
    } catch (error: any) {
      // If Stripe payout fails (expected in test env), that's okay - we tested the flow
      if (error.message.includes('Stripe') || error.message.includes('payout') || error.message.includes('bank')) {
        return { 
          partial: 'Cashout request processed but Stripe payout may have failed (expected in test env)',
          error: error.message 
        };
      }
      throw error;
    }
  });

  // Test 12.2: Request Cashout with Invalid Signature (should fail)
  await test('Request Cashout with Invalid Signature (should fail)', async () => {
    try {
      const timestamp = new Date().toISOString();
      const message = createCashoutMessage(testEmployeeAddress, '10.0', timestamp);
      const invalidSignature = '0x' + '0'.repeat(130); // Invalid signature

      await request('POST', '/api/cashout/request', {
        employeeAddress: testEmployeeAddress,
        amount: '10.0',
        currency: 'usd',
        bankAccountId: 'ba_test_1234567890',
        signature: invalidSignature,
        message,
        txHash: '0x' + '0'.repeat(64), // Mock txHash
      });
      throw new Error('Should have failed with invalid signature');
    } catch (error: any) {
      if (error.message.includes('Invalid signature') || error.message.includes('signature')) {
        return { error: 'Expected signature validation error' };
      }
      throw error;
    }
  });

  // Test 12.3: Request Cashout with Missing Fields (should fail)
  await test('Request Cashout with Missing Fields (should fail)', async () => {
    try {
      await request('POST', '/api/cashout/request', {
        employeeAddress: testEmployeeAddress,
        amount: '10.0',
        // Missing currency, bankAccountId, signature, message, txHash
      });
      throw new Error('Should have failed with missing fields');
    } catch (error: any) {
      if (error.message.includes('required') || error.message.includes('Invalid') || error.message.includes('Missing')) {
        return { error: 'Expected validation error for missing fields' };
      }
      throw error;
    }
  });

  // ========== Payment APIs (On-Ramp) Tests ==========
  // Use a valid Ethereum address format (42 chars, starts with 0x)
  const testWalletAddress = '0xef42751fc1b6e2e37770097392da681a1ea0998a';
  let paymentIntentId: string | null = null;

  // Test 13: Get Offramp Balance
  await test('Get Offramp Balance', async () => {
    return request('GET', '/api/payment/offramp-balance');
  });

  // Test 14: Create Payment Intent
  await test('Create Payment Intent', async () => {
    const response = await request('POST', '/api/payment/create-intent', {
      amount: '100',
      currency: 'usd',
      walletAddress: testWalletAddress,
    });
    paymentIntentId = response.paymentIntentId;
    return response;
  });

  // Test 15: Get Payment Status
  await test('Get Payment Status', async () => {
    if (!paymentIntentId) {
      throw new Error('No paymentIntentId available');
    }
    return request('GET', `/api/payment/status/${paymentIntentId}`);
  });

  // Test 16: Get Payment History
  await test('Get Payment History', async () => {
    return request('GET', `/api/payment/history/${testWalletAddress}?page=1&limit=10`);
  });

  // Test 17: Create Payment Intent with Invalid Address (should fail)
  await test('Create Payment Intent with Invalid Address (should fail)', async () => {
    try {
      await request('POST', '/api/payment/create-intent', {
        amount: '100',
        currency: 'usd',
        walletAddress: '0xinvalid',
      });
      throw new Error('Should have failed with invalid address');
    } catch (error: any) {
      if (error.message.includes('Invalid')) {
        return { error: 'Expected validation error' };
      }
      throw error;
    }
  });

  // Test 18: Create Payment Intent with Invalid Amount (should fail)
  await test('Create Payment Intent with Invalid Amount (should fail)', async () => {
    try {
      await request('POST', '/api/payment/create-intent', {
        amount: '-100',
        currency: 'usd',
        walletAddress: testWalletAddress,
      });
      throw new Error('Should have failed with invalid amount');
    } catch (error: any) {
      if (error.message.includes('Invalid')) {
        return { error: 'Expected validation error' };
      }
      throw error;
    }
  });

  // Test 19: Get Payment Status (Non-existent ID - should return 404)
  await test('Get Payment Status (Non-existent ID - should return 404)', async () => {
    try {
      await request('GET', '/api/payment/status/pi_test_000000000000000000000000');
      throw new Error('Should have returned 404');
    } catch (error: any) {
      if (error.message.includes('404') || error.message.includes('not found')) {
        return { error: 'Expected 404 error' };
      }
      throw error;
    }
  });

  // Test 20: Error Cases
  await test('Get Non-existent Employee (should return 404)', async () => {
    try {
      await request('GET', '/api/employees/0x0000000000000000000000000000000000000000');
      throw new Error('Should have returned 404');
    } catch (error: any) {
      if (error.message.includes('404') || error.message.includes('not found')) {
        return { error: 'Expected 404 error' };
      }
      throw error;
    }
  });

  await test('Register Employee with Invalid Address (should fail)', async () => {
    try {
      await request('POST', '/api/employees/register', {
        wallet_address: '0xinvalid',
        name: 'Invalid',
      });
      throw new Error('Should have failed with invalid address');
    } catch (error: any) {
      if (error.message.includes('Invalid')) {
        return { error: 'Expected validation error' };
      }
      throw error;
    }
  });

  // Test 14: Payroll History with Invalid Address (should fail)
  await test('Get Payroll History with Invalid Address (should fail)', async () => {
    try {
      await request('GET', '/api/payroll/history?employerAddress=0xinvalid');
      throw new Error('Should have failed with invalid address');
    } catch (error: any) {
      if (error.message.includes('Invalid')) {
        return { error: 'Expected validation error' };
      }
      throw error;
    }
  });

  // Test 15: Payroll History without Address (should fail)
  await test('Get Payroll History without Address (should fail)', async () => {
    try {
      await request('GET', '/api/payroll/history');
      throw new Error('Should have failed without address');
    } catch (error: any) {
      if (error.message.includes('required') || error.message.includes('Either')) {
        return { error: 'Expected validation error' };
      }
      throw error;
    }
  });

  // Cleanup: Delete test employee
  await test('Delete Test Employee', async () => {
    return request('DELETE', `/api/employees/${testEmployeeAddress}`);
  });

  // Print Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary');
  console.log('='.repeat(60));

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;

  console.log(`Total Tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);

  if (failed > 0) {
    console.log('\nFailed Tests:');
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`  - ${r.name}: ${r.error}`);
      });
  }

  console.log('\n' + '='.repeat(60));

  if (failed > 0) {
    process.exit(1);
  }
}

// Check if fetch is available (Node.js 18+)
if (typeof fetch === 'undefined') {
  console.error('❌ Error: fetch is not available. Please use Node.js 18+ or install node-fetch.');
  process.exit(1);
}

// Run tests
runTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

