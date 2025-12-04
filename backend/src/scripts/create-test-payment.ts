import dotenv from 'dotenv';
import path from 'path';
import { getStripe } from '../config/stripe';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Create a test payment to add balance to Platform Account
 * 
 * Usage:
 *   npx tsx src/scripts/create-test-payment.ts [amount] [--instant]
 * 
 * Example:
 *   npx tsx src/scripts/create-test-payment.ts 100
 *   npx tsx src/scripts/create-test-payment.ts 100 --instant
 * 
 * Note: Use --instant flag to create available balance immediately
 *       (requires special test card 4000000000000077 via Dashboard)
 */
async function createTestPayment() {
  try {
    console.log('========================================');
    console.log('Create Test Payment - Platform Account');
    console.log('========================================\n');

    const stripe = getStripe();
    
    // Get amount from arguments or use default
    const amount = parseFloat(process.argv[2] || '100'); // Default $100

    // Check if we're in test mode
    const secretKey = process.env.STRIPE_SECRET_KEY || '';
    if (!secretKey.startsWith('sk_test_')) {
      console.error('❌ Error: Must use Stripe Test Mode (sk_test_...)');
      console.log('   Current key starts with:', secretKey.substring(0, 12));
      process.exit(1);
    }

    console.log('Configuration:');
    console.log('- Amount:', `$${amount} (${Math.round(amount * 100)} cents)`);
    console.log('- Currency: USD');
    console.log('- Mode: Test Mode ✅');
    console.log('');

    // Check Platform Account status
    console.log('=== Step 1: Checking Platform Account Status ===');
    try {
      const account = await stripe.account.retrieve();
      console.log('✅ Platform Account found');
      console.log('- Account ID:', account.id);
      console.log('- Email:', account.email || 'N/A');
      console.log('- Charges Enabled:', account.charges_enabled ? '✅' : '❌');
      console.log('- Payouts Enabled:', account.payouts_enabled ? '✅' : '❌');
      console.log('');

      if (!account.charges_enabled) {
        console.log('⚠️  Warning: Charges not enabled for this account');
        console.log('   Payment might fail. Trying anyway...\n');
      }
    } catch (error: any) {
      console.error('❌ Error retrieving account:', error.message);
      process.exit(1);
    }

    // Step 2: Create Charge directly with test token
    console.log('=== Step 2: Creating Charge ===');
    console.log('Using test token method...');
    console.log('');
    
    let charge;
    try {
      console.log('Creating charge with test token...');
      
      // Note: Stripe API does not allow sending raw card numbers
      // For instant available balance, must use Stripe Dashboard with card 4000000000000077
      // This script uses tok_visa which may create pending balance
      
      console.log('⚠️  Note: This script may create PENDING balance.');
      console.log('   For INSTANT available balance, use Stripe Dashboard:');
      console.log('   1. Go to: https://dashboard.stripe.com/test/payments');
      console.log('   2. Click "Create payment"');
      console.log('   3. Use test card: 4000000000000077 (instant available)');
      console.log('');
      
      charge = await stripe.charges.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: 'usd',
        source: 'tok_visa', // Creates pending balance - use Dashboard with 4000000000000077 for instant
        description: `Test payment - ${amount} USD (may be pending)`,
        metadata: {
          test_payment: 'true',
          purpose: 'add_platform_balance',
        },
      });

      console.log('✅ Charge created successfully');
      console.log('- Charge ID:', charge.id);
      console.log('- Status:', charge.status);
      console.log('- Amount:', `$${charge.amount / 100} ${charge.currency.toUpperCase()}`);
      console.log('- Paid:', charge.paid ? '✅' : '❌');
      console.log('');
    } catch (error: any) {
      console.error('❌ Error creating charge:', error.message);
      if (error.code) {
        console.error('Error code:', error.code);
      }
      console.log('');
      console.log('⚠️  Charge API failed. Trying alternative method...');
      console.log('');
      
      // Alternative: Try PaymentIntent with automatic payment methods
      try {
        console.log('=== Alternative: Creating Payment Intent ===');
        console.log('Using automatic payment methods...');
        
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(amount * 100),
          currency: 'usd',
          automatic_payment_methods: {
            enabled: true,
          },
          description: `Test payment - ${amount} USD`,
          metadata: {
            test_payment: 'true',
            purpose: 'add_platform_balance',
          },
        });

        console.log('✅ Payment Intent created (requires manual confirmation)');
        console.log('- Payment Intent ID:', paymentIntent.id);
        console.log('- Client Secret:', paymentIntent.client_secret);
        console.log('');
        console.log('💡 Note: Payment Intent requires frontend confirmation');
        console.log('   To complete payment, use Stripe.js or Dashboard');
        console.log('');
        console.log('📝 Alternative: Use Stripe Dashboard to create test payment');
        console.log('   1. Go to: https://dashboard.stripe.com/test/payments');
        console.log('   2. Click "Create payment"');
        console.log('   3. Use test card: 4242 4242 4242 4242');
        console.log('');
        
        throw new Error('Payment Intent requires manual confirmation. Use Dashboard instead.');
      } catch (altError: any) {
        console.error('❌ Alternative method also failed:', altError.message);
        throw error; // Throw original error
      }
    }

    // Step 4: Check balance after payment
    console.log('=== Step 4: Checking Balance ===');
    try {
      // Wait a moment for payment to settle
      console.log('⏳ Waiting for payment to settle...');
      await new Promise(resolve => setTimeout(resolve, 2000));

      const balance = await stripe.balance.retrieve();
      console.log('✅ Balance retrieved');
      console.log('');
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

    // Step 5: Summary
    console.log('========================================');
    console.log('✅ SUCCESS!');
    console.log('========================================');
    console.log('');
    console.log('📝 Payment Details:');
    console.log('- Charge ID:', charge.id);
    console.log('- Status:', charge.status);
    console.log('- Amount:', `$${amount} USD`);
    console.log('- Paid:', charge.paid ? '✅' : '❌');
    console.log('');
    console.log('💡 Note:');
    console.log('   - Payment may take a few minutes to appear in balance');
    console.log('   - Test payments with tok_visa may be PENDING (not available immediately)');
    console.log('   - For INSTANT available balance, use Dashboard with card: 4000000000000077');
    console.log('   - Check Dashboard: https://dashboard.stripe.com/test/balance/overview');
    console.log('');

  } catch (error: any) {
    console.error('\n========================================');
    console.error('❌ FAILED');
    console.error('========================================');
    console.error('Error:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
    if (error.type) {
      console.error('Error type:', error.type);
    }
    console.log('');
    console.log('💡 Common Issues:');
    console.log('   - Charges not enabled for account (check Dashboard)');
    console.log('   - Invalid test card details');
    console.log('   - Network/API errors');
    console.log('');
    process.exit(1);
  }
}

// Run the script
createTestPayment();

