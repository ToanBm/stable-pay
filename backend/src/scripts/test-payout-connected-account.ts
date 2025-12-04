import dotenv from 'dotenv';
import path from 'path';
import { getStripe } from '../config/stripe';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Test payout to connected account's bank account
 * 
 * Usage:
 *   npx tsx src/scripts/test-payout-connected-account.ts <connectedAccountId> <bankAccountId> [amount]
 * 
 * Example:
 *   npx tsx src/scripts/test-payout-connected-account.ts acct_1Sa6f3LcDsl6GGq8 ba_1Sa6f7LcDsl6GGq83oIpDfiN 10
 */
async function testPayoutConnectedAccount() {
  try {
    console.log('========================================');
    console.log('Test Payout - Connected Account');
    console.log('========================================\n');

    const stripe = getStripe();
    
    // Get arguments
    const connectedAccountId = process.argv[2];
    const bankAccountId = process.argv[3];
    const amount = parseFloat(process.argv[4] || '10'); // Default $10

    if (!connectedAccountId || !bankAccountId) {
      console.error('❌ Error: Missing required arguments\n');
      console.log('Usage:');
      console.log('  npx tsx src/scripts/test-payout-connected-account.ts <connectedAccountId> <bankAccountId> [amount]');
      console.log('\nExample:');
      console.log('  npx tsx src/scripts/test-payout-connected-account.ts acct_1Sa6f3LcDsl6GGq8 ba_1Sa6f7LcDsl6GGq83oIpDfiN 10');
      process.exit(1);
    }

    console.log('Configuration:');
    console.log('- Connected Account ID:', connectedAccountId);
    console.log('- Bank Account ID:', bankAccountId);
    console.log('- Amount:', `$${amount} (${Math.round(amount * 100)} cents)`);
    console.log('- Currency: USD');
    console.log('');

    // Step 1: Verify connected account status
    console.log('=== Step 1: Verifying Connected Account Status ===');
    try {
      const account = await stripe.accounts.retrieve(connectedAccountId);
      console.log('✅ Connected Account found');
      console.log('- Email:', account.email || 'N/A');
      console.log('- Charges Enabled:', account.charges_enabled ? '✅' : '❌');
      console.log('- Payouts Enabled:', account.payouts_enabled ? '✅' : '❌');
      console.log('- Details Submitted:', account.details_submitted ? '✅' : '❌');
      console.log('');

      if (!account.payouts_enabled) {
        console.error('❌ Error: Payouts not enabled for this account');
        console.log('   Please ensure the account is fully activated.');
        process.exit(1);
      }
    } catch (error: any) {
      console.error('❌ Error retrieving connected account:', error.message);
      process.exit(1);
    }

    // Step 2: Verify bank account
    console.log('=== Step 2: Verifying Bank Account ===');
    try {
      const bankAccount = await stripe.accounts.retrieveExternalAccount(
        connectedAccountId,
        bankAccountId
      ) as any;
      console.log('✅ Bank Account found');
      console.log('- Bank Name:', bankAccount.bank_name || 'N/A');
      console.log('- Last 4:', bankAccount.last4 || 'N/A');
      console.log('- Status:', bankAccount.status || 'N/A');
      console.log('- Currency:', bankAccount.currency || 'N/A');
      console.log('- Default for currency:', bankAccount.default_for_currency ? '✅' : '❌');
      console.log('');
    } catch (error: any) {
      console.error('❌ Error retrieving bank account:', error.message);
      process.exit(1);
    }

    // Step 3: Check connected account balance
    console.log('=== Step 3: Checking Connected Account Balance ===');
    try {
      const balance = await stripe.balance.retrieve({
        stripeAccount: connectedAccountId,
      });
      console.log('Current Balance:');
      console.log('- Available:', `$${(balance.available[0]?.amount || 0) / 100} ${balance.available[0]?.currency?.toUpperCase() || 'USD'}`);
      console.log('- Pending:', `$${(balance.pending[0]?.amount || 0) / 100} ${balance.pending[0]?.currency?.toUpperCase() || 'USD'}`);
      console.log('');
    } catch (error: any) {
      console.log('⚠️  Could not check balance (non-critical):', error.message);
      console.log('');
    }

    // Step 4: Transfer funds to connected account (if needed)
    const requiredAmount = Math.round(amount * 100);
    let needTransfer = false;
    
    try {
      const balance = await stripe.balance.retrieve({
        stripeAccount: connectedAccountId,
      });
      const availableAmount = balance.available[0]?.amount || 0;
      needTransfer = availableAmount < requiredAmount;
    } catch (error) {
      // If can't check balance, assume we need to transfer
      needTransfer = true;
    }

    if (needTransfer) {
      console.log('=== Step 4: Transferring Funds to Connected Account ===');
      try {
        console.log(`Transferring $${amount} from platform account to connected account...`);
        
        // Create a Transfer from platform to connected account
        const transfer = await stripe.transfers.create({
          amount: requiredAmount,
          currency: 'usd',
          destination: connectedAccountId,
          description: `Test transfer for payout - ${amount} USD`,
        });

        console.log('✅ Transfer created successfully!');
        console.log('- Transfer ID:', transfer.id);
        console.log('- Amount:', `$${transfer.amount / 100} ${transfer.currency.toUpperCase()}`);
        console.log('- Destination:', transfer.destination);
        console.log('');
        console.log('⏳ Waiting a moment for transfer to settle...');
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        
        // Verify balance after transfer
        const newBalance = await stripe.balance.retrieve({
          stripeAccount: connectedAccountId,
        });
        console.log('✅ New balance:', `$${(newBalance.available[0]?.amount || 0) / 100} USD`);
        console.log('');
      } catch (error: any) {
        console.error('❌ Error transferring funds:', error.message);
        if (error.code) {
          console.error('Error code:', error.code);
        }
        console.log('');
        console.log('💡 Note: Transfer might require platform account to have balance');
        console.log('   In test mode, you may need to add test funds to platform account first');
        console.log('');
        throw error;
      }
    }

    // Step 5: Create payout
    console.log('=== Step 5: Creating Payout ===');
    try {
      console.log('Creating payout from connected account...');
      const payout = await stripe.payouts.create(
        {
          amount: requiredAmount,
          currency: 'usd',
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
      console.log('- Amount:', `$${payout.amount / 100} ${payout.currency.toUpperCase()}`);
      console.log('- Status:', payout.status);
      console.log('- Method:', payout.method || 'standard');
      console.log('- Destination:', payout.destination || bankAccountId);
      console.log('- Arrival Date:', payout.arrival_date ? new Date(payout.arrival_date * 1000).toISOString() : 'N/A');
      console.log('');

      console.log('========================================');
      console.log('✅ SUCCESS!');
      console.log('========================================');
      console.log('');
      console.log('📝 Next Steps:');
      console.log('1. Monitor payout status:');
      console.log(`   stripe payouts retrieve ${payout.id}`);
      console.log('');
      console.log('2. Check webhook events (if Stripe CLI is running):');
      console.log('   - payout.paid (when payout succeeds)');
      console.log('   - payout.failed (if payout fails)');
      console.log('');
      console.log('3. In test mode, payouts typically:');
      console.log('   - Instant method: Complete immediately');
      console.log('   - Standard method: Complete within a few minutes');
      console.log('');

    } catch (error: any) {
      console.error('\n❌ Error creating payout:', error.message);
      if (error.code) {
        console.error('Error code:', error.code);
      }
      if (error.type) {
        console.error('Error type:', error.type);
      }
      console.log('');
      console.log('💡 Common Issues:');
      console.log('   - Insufficient balance in platform account (for transfer)');
      console.log('   - Insufficient balance in connected account (after transfer)');
      console.log('   - Bank account not verified');
      console.log('   - Account restrictions');
      console.log('');
      console.log('💡 Solution:');
      console.log('   In test mode, add test funds to platform account via Dashboard:');
      console.log('   https://dashboard.stripe.com/test/balance/overview');
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
testPayoutConnectedAccount();

