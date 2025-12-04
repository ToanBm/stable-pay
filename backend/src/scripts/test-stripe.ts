import dotenv from 'dotenv';
import path from 'path';
import { getStripe, stripeWebhookSecret } from '../config/stripe';
import { createPayout, getPayoutStatus, verifyWebhookSignature, getExchangeRate } from '../utils/stripe';

// Load .env from backend directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function testStripeConnection() {
  console.log('=== Testing Stripe Integration ===\n');

  // Debug: Check if env is loaded
  console.log('Debug - Checking environment variables...');
  console.log('   STRIPE_SECRET_KEY exists:', !!process.env.STRIPE_SECRET_KEY);
  console.log('   STRIPE_SECRET_KEY length:', process.env.STRIPE_SECRET_KEY?.length || 0);
  console.log('   STRIPE_WEBHOOK_SECRET exists:', !!process.env.STRIPE_WEBHOOK_SECRET);
  console.log('');

  // 1. Check Stripe Secret Key
  console.log('1. Stripe Configuration:');
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  
  if (!stripeSecretKey) {
    console.warn('⚠️  STRIPE_SECRET_KEY not configured');
    console.log('   Please add STRIPE_SECRET_KEY to .env file');
    console.log('   Get it from: https://dashboard.stripe.com/test/apikeys');
    console.log('   Make sure .env file is in backend/ directory');
    return;
  }

  // Mask secret key for display
  const maskedKey = stripeSecretKey.substring(0, 12) + '...' + stripeSecretKey.substring(stripeSecretKey.length - 4);
  console.log('   Secret Key:', maskedKey);
  console.log('   Mode:', stripeSecretKey.startsWith('sk_test_') ? 'Test Mode ✅' : 'Live Mode ⚠️');

  // 2. Test Stripe Client
  try {
    const stripe = getStripe();
    console.log('✅ Stripe client initialized!');
    
    // Test API connection by retrieving account info
    const account = await stripe.account.retrieve();
    console.log('   Account ID:', account.id);
    console.log('   Country:', account.country || 'N/A');
    console.log('   Default currency:', account.default_currency || 'N/A');
  } catch (error: any) {
    console.error('❌ Stripe client error:', error.message);
    return;
  }

  // 3. Test Webhook Secret
  console.log('\n2. Webhook Configuration:');
  if (stripeWebhookSecret) {
    const maskedSecret = stripeWebhookSecret.substring(0, 12) + '...';
    console.log('✅ Webhook secret configured:', maskedSecret);
  } else {
    console.warn('⚠️  STRIPE_WEBHOOK_SECRET not configured');
    console.log('   Get it from: https://dashboard.stripe.com/test/webhooks');
  }

  // 4. Test Payout Functions (without actually creating payout)
  console.log('\n3. Testing Payout Functions:');
  try {
    const stripe = getStripe();
    
    // List recent payouts to test API
    const payouts = await stripe.payouts.list({ limit: 1 });
    console.log('✅ Payout API accessible!');
    console.log('   Recent payouts count:', payouts.data.length);
    
    if (payouts.data.length > 0) {
      const recentPayout = payouts.data[0];
      console.log('   Latest payout ID:', recentPayout.id);
      console.log('   Status:', recentPayout.status);
      console.log('   Amount:', recentPayout.amount / 100, recentPayout.currency.toUpperCase());
    }
  } catch (error: any) {
    console.error('❌ Payout API error:', error.message);
  }

  // 5. Test Exchange Rate Function
  console.log('\n4. Testing Exchange Rate Function:');
  try {
    const rate = await getExchangeRate('usdt', 'usd');
    console.log('✅ Exchange rate function works!');
    console.log('   USDT to USD rate:', rate);
  } catch (error: any) {
    console.log('⚠️  Exchange rate function:', error.message);
  }

  // 6. Test Webhook Verification (mock)
  console.log('\n5. Testing Webhook Verification:');
  if (stripeWebhookSecret) {
    console.log('✅ Webhook secret available for verification');
    console.log('   Note: Full webhook test requires actual webhook event from Stripe');
  } else {
    console.warn('⚠️  Cannot test webhook verification without secret');
  }

  console.log('\n=== Test Complete ===');
  console.log('\nNext Steps:');
  console.log('1. Test actual payout creation (requires test bank account)');
  console.log('2. Test webhook handling (use Stripe CLI: stripe listen)');
  console.log('3. Test with real webhook events from Stripe dashboard');
}

testStripeConnection().catch(console.error);

