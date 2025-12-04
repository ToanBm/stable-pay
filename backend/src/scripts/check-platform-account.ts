import dotenv from 'dotenv';
import path from 'path';
import { getStripe } from '../config/stripe';

// Load .env from backend directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function checkPlatformAccount() {
  console.log('========================================');
  console.log('Platform Account Information');
  console.log('========================================\n');

  try {
    // Check if STRIPE_SECRET_KEY exists
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    
    if (!stripeSecretKey) {
      console.error('❌ STRIPE_SECRET_KEY not found in .env file');
      console.log('\n💡 Please add STRIPE_SECRET_KEY to backend/.env file');
      console.log('   Get it from: https://dashboard.stripe.com/test/apikeys');
      process.exit(1);
    }

    // Mask secret key for display
    const maskedKey = stripeSecretKey.substring(0, 12) + '...' + stripeSecretKey.substring(stripeSecretKey.length - 4);
    console.log('Stripe Secret Key:', maskedKey);
    console.log('Mode:', stripeSecretKey.startsWith('sk_test_') ? 'Test Mode ✅' : 'Live Mode ⚠️');
    console.log('');

    // Get Stripe client
    const stripe = getStripe();
    
    // Retrieve Platform Account info
    console.log('Retrieving Platform Account information...');
    const account = await stripe.account.retrieve();

    console.log('\n✅ Platform Account Information:');
    console.log('========================================');
    console.log('Account ID:', account.id);
    console.log('Email:', account.email || 'N/A');
    console.log('Country:', account.country || 'N/A');
    console.log('Default Currency:', account.default_currency || 'N/A');
    console.log('Charges Enabled:', account.charges_enabled ? '✅' : '❌');
    console.log('Payouts Enabled:', account.payouts_enabled ? '✅' : '❌');
    console.log('Type:', account.type || 'standard');
    console.log('');

    // Check balance (Platform Account balance)
    try {
      const balance = await stripe.balance.retrieve();
      console.log('💰 Platform Account Balance:');
      if (balance.available && balance.available.length > 0) {
        balance.available.forEach((bal: any) => {
          console.log(`   Available: $${(bal.amount / 100).toFixed(2)} ${bal.currency.toUpperCase()}`);
        });
      }
      if (balance.pending && balance.pending.length > 0) {
        balance.pending.forEach((bal: any) => {
          console.log(`   Pending: $${(bal.amount / 100).toFixed(2)} ${bal.currency.toUpperCase()}`);
        });
      }
      console.log('');
    } catch (error: any) {
      console.log('⚠️  Could not retrieve balance:', error.message);
      console.log('');
    }

    console.log('========================================');
    console.log('✅ Check complete!');
    console.log('========================================');
    console.log('');
    console.log('📝 Summary:');
    console.log(`   Platform Account ID: ${account.id}`);
    console.log(`   This account is used for:`);
    console.log(`   - Receiving payments (VISA → USDT)`);
    console.log(`   - Managing fiat balance (USD)`);
    console.log(`   - Transferring funds to Connected Accounts`);
    console.log(`   - Creating payouts to employee bank accounts`);
    console.log('');

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.type) {
      console.error('Error type:', error.type);
    }
    if (error.code) {
      console.error('Error code:', error.code);
    }
    process.exit(1);
  }
}

// Run the check
checkPlatformAccount();

