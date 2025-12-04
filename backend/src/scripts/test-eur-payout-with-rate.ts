import dotenv from 'dotenv';
import path from 'path';
import { getStripe } from '../config/stripe';
import { getExchangeRate } from '../utils/stripe';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Test EUR payout với tỉ giá USDT → EUR
 * Payout trực tiếp từ Platform Account EUR balance → User bank account EUR
 * 
 * Usage:
 *   npx tsx src/scripts/test-eur-payout-with-rate.ts <bankAccountId> <amountUSDT>
 * 
 * Example:
 *   npx tsx src/scripts/test-eur-payout-with-rate.ts ba_1Sa84wQ1g9JBmO9wTWhhq5M1 100
 */
async function testEURPayoutWithRate() {
  try {
    console.log('========================================');
    console.log('Test EUR Payout with Exchange Rate');
    console.log('========================================\n');

    const stripe = getStripe();
    
    const bankAccountId = process.argv[2];
    const amountUSDT = parseFloat(process.argv[3] || '100'); // Default 100 USDT

    if (!bankAccountId) {
      console.error('❌ Error: Missing bank account ID\n');
      console.log('Usage:');
      console.log('  npx tsx src/scripts/test-eur-payout-with-rate.ts <bankAccountId> <amountUSDT>');
      console.log('\nExample:');
      console.log('  npx tsx src/scripts/test-eur-payout-with-rate.ts ba_1Sa84wQ1g9JBmO9wTWhhq5M1 100');
      process.exit(1);
    }

    console.log('Configuration:');
    console.log('- Bank Account ID:', bankAccountId);
    console.log('- Amount USDT:', amountUSDT);
    console.log('- Currency: EUR');
    console.log('');

    // Step 1: Get exchange rate USDT → EUR
    console.log('=== Step 1: Getting Exchange Rate (USDT → EUR) ===');
    let exchangeRate = 1.0;
    try {
      exchangeRate = await getExchangeRate('usdt', 'eur');
      console.log(`✅ Exchange Rate: 1 USDT = ${exchangeRate} EUR`);
      console.log('');
    } catch (error: any) {
      console.error('❌ Error getting exchange rate:', error.message);
      console.log('⚠️  Using default rate 1:1');
      console.log('');
    }

    // Calculate EUR amount
    const eurAmount = amountUSDT * exchangeRate;
    const eurAmountCents = Math.round(eurAmount * 100); // Convert to cents

    console.log('Amount Calculation:');
    console.log(`- USDT Amount: ${amountUSDT} USDT`);
    console.log(`- Exchange Rate: ${exchangeRate} EUR/USDT`);
    console.log(`- EUR Amount: €${eurAmount.toFixed(2)} (${eurAmountCents} cents)`);
    console.log('');

    // Step 2: Check platform account EUR balance
    console.log('=== Step 2: Checking Platform Account EUR Balance ===');
    try {
      const balance = await stripe.balance.retrieve();
      const eurBalance = balance.available.find((b: any) => b.currency === 'eur');
      
      if (eurBalance) {
        const availableEUR = (eurBalance.amount / 100).toFixed(2);
        console.log(`✅ Platform Account has €${availableEUR} available`);
        console.log('');
        
        if (eurBalance.amount < eurAmountCents) {
          console.error(`❌ Insufficient EUR balance. Need €${eurAmount.toFixed(2)}, but only have €${availableEUR}`);
          process.exit(1);
        }
      } else {
        console.error('❌ No EUR balance found in platform account');
        console.log('   Please add EUR funds to platform account first');
        process.exit(1);
      }
    } catch (error: any) {
      console.error('❌ Error checking balance:', error.message);
      process.exit(1);
    }

    // Step 3: Get connected account ID from bank account
    console.log('=== Step 3: Getting Connected Account ID ===');
    console.log('Please provide connected account ID:');
    console.log('   Usage: npx tsx src/scripts/test-eur-payout-with-rate.ts <bankAccountId> <amountUSDT> <connectedAccountId>');
    console.log('');
    console.log('Example:');
    console.log('   npx tsx src/scripts/test-eur-payout-with-rate.ts ba_1Sa84wQ1g9JBmO9wTWhhq5M1 100 acct_1Sa84sQ1g9JBmO9w');
    console.log('');
    
    const connectedAccountId = process.argv[4];
    if (!connectedAccountId) {
      console.error('❌ Error: Missing connected account ID');
      process.exit(1);
    }

    // Step 4: Transfer EUR from Platform Account → Connected Account
    console.log('=== Step 4: Transferring EUR from Platform Account → Connected Account ===');
    try {
      console.log(`Transferring €${eurAmount.toFixed(2)} from platform account to connected account...`);
      
      const transfer = await stripe.transfers.create({
        amount: eurAmountCents,
        currency: 'eur',
        destination: connectedAccountId,
        description: `Transfer EUR for payout - ${eurAmount.toFixed(2)} EUR`,
      });

      console.log('✅ Transfer created successfully!');
      console.log('- Transfer ID:', transfer.id);
      console.log('- Amount:', `€${(transfer.amount / 100).toFixed(2)}`);
      console.log('- Currency:', transfer.currency.toUpperCase());
      console.log('- Destination:', transfer.destination);
      console.log('');
      console.log('⏳ Waiting for transfer to settle...');
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      
      // Verify balance after transfer
      const newBalance = await stripe.balance.retrieve({
        stripeAccount: connectedAccountId,
      });
      const eurBalance = newBalance.available.find((b: any) => b.currency === 'eur');
      const balanceDisplay = eurBalance ? `€${(eurBalance.amount / 100).toFixed(2)}` : '€0.00';
      console.log('✅ Connected Account EUR balance:', balanceDisplay);
      console.log('');
    } catch (error: any) {
      console.error('❌ Error transferring EUR:', error.message);
      if (error.code) {
        console.error('Error code:', error.code);
      }
      console.log('');
      throw error;
    }

    // Step 5: Create payout from connected account
    console.log('=== Step 5: Creating EUR Payout from Connected Account ===');
    try {
      console.log(`Creating payout: €${eurAmount.toFixed(2)} from connected account to bank account ${bankAccountId}...`);
      
      const payout = await stripe.payouts.create(
        {
          amount: eurAmountCents,
          currency: 'eur',
          destination: bankAccountId,
          method: 'standard',
        },
        {
          stripeAccount: connectedAccountId,
        }
      );

      console.log('✅ Payout created successfully!');
      console.log('');
      console.log('Payout Details:');
      console.log('- Payout ID:', payout.id);
      console.log('- Amount:', `€${(payout.amount / 100).toFixed(2)}`);
      console.log('- Currency:', payout.currency.toUpperCase());
      console.log('- Status:', payout.status);
      console.log('- Method:', payout.method || 'standard');
      console.log('- Destination:', payout.destination || bankAccountId);
      console.log('- Arrival Date:', payout.arrival_date ? new Date(payout.arrival_date * 1000).toISOString() : 'N/A');
      console.log('');
      
      console.log('Exchange Rate Summary:');
      console.log(`- ${amountUSDT} USDT × ${exchangeRate} = €${eurAmount.toFixed(2)}`);
      console.log('');

      console.log('========================================');
      console.log('✅ SUCCESS!');
      console.log('========================================');
      console.log('');
      console.log('📝 Next Steps:');
      console.log('1. Monitor payout status:');
      console.log(`   stripe payouts retrieve ${payout.id}`);
      console.log('');
      console.log('2. Check webhook events:');
      console.log('   - payout.paid (when payout succeeds)');
      console.log('   - payout.failed (if payout fails)');
      console.log('');

    } catch (error: any) {
      console.error('❌ Error creating payout:', error.message);
      if (error.code) {
        console.error('Error code:', error.code);
      }
      if (error.type) {
        console.error('Error type:', error.type);
      }
      console.log('');
      console.log('💡 Common Issues:');
      console.log('   - Bank account ID is from connected account (may not work)');
      console.log('   - Bank account not verified');
      console.log('   - Insufficient balance');
      console.log('');
      throw error;
    }

  } catch (error: any) {
    console.error('\n========================================');
    console.error('❌ FAILED');
    console.error('========================================');
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run the test
testEURPayoutWithRate();

