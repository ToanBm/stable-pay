/**
 * Script to manually trigger payment_intent.succeeded webhook handler
 * This is useful for testing when Stripe webhook is not configured
 * 
 * Usage: npx tsx src/scripts/trigger-payment-webhook.ts <payment_intent_id>
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { getPaymentIntent } from '../utils/stripe';
import { getPaymentByPaymentIntentId, updatePayment } from '../services/paymentService';
import { transferUSDTFromOfframp, waitForTransaction } from '../utils/blockchain';
import type Stripe from 'stripe';

async function triggerPaymentWebhook(paymentIntentId: string) {
  try {
    console.log(`\n🔔 Triggering webhook for Payment Intent: ${paymentIntentId}\n`);

    // Get payment intent from Stripe
    const paymentIntent = await getPaymentIntent(paymentIntentId);
    console.log('✅ Payment Intent retrieved from Stripe');
    console.log(`   Status: ${paymentIntent.status}`);
    console.log(`   Amount: ${paymentIntent.amount / 100} ${paymentIntent.currency.toUpperCase()}`);

    // Get payment from database
    const payment = await getPaymentByPaymentIntentId(paymentIntentId);
    if (!payment) {
      throw new Error(`Payment not found in database for payment intent ${paymentIntentId}`);
    }
    console.log(`\n✅ Payment found in database (ID: ${payment.id})`);
    console.log(`   Status: ${payment.status}`);
    console.log(`   Wallet: ${payment.wallet_address}`);
    console.log(`   Amount USDT: ${payment.amount_usdt}`);

    // Check if already processed
    if (payment.status === 'completed' || payment.tx_hash) {
      console.log(`\n⚠️  Payment already processed!`);
      console.log(`   TX Hash: ${payment.tx_hash}`);
      console.log(`   Status: ${payment.status}`);
      return;
    }

    // Check if payment intent succeeded
    if (paymentIntent.status !== 'succeeded') {
      throw new Error(`Payment Intent status is ${paymentIntent.status}, not 'succeeded'`);
    }

    // Update status to processing
    await updatePayment(payment.id!, {
      status: 'processing',
    });
    console.log(`\n⏳ Updated payment status to 'processing'`);

    // Get wallet address
    const walletAddress = paymentIntent.metadata?.wallet_address || payment.wallet_address;
    if (!walletAddress) {
      throw new Error('Wallet address not found in payment intent metadata');
    }

    console.log(`\n💸 Transferring ${payment.amount_usdt} USDT to ${walletAddress}...`);

    // Transfer USDT from offramp wallet to user wallet
    // Convert amount to string if needed
    const amountUSDT = typeof payment.amount_usdt === 'string' 
      ? payment.amount_usdt 
      : payment.amount_usdt.toString();
    
    // Retry logic for RPC errors
    let tx;
    const maxRetries = 3;
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`   Attempt ${attempt}/${maxRetries}...`);
        tx = await transferUSDTFromOfframp(walletAddress, amountUSDT);
        console.log(`✅ Transaction created: ${tx.hash}`);
        break;
      } catch (error: any) {
        lastError = error;
        if (error.message.includes('502') || error.message.includes('Bad Gateway')) {
          if (attempt < maxRetries) {
            const waitTime = attempt * 2; // 2s, 4s, 6s
            console.log(`   ⚠️  RPC error, retrying in ${waitTime}s...`);
            await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
            continue;
          }
        }
        throw error;
      }
    }
    
    if (!tx) {
      throw lastError || new Error('Failed to create transaction after retries');
    }

    // Wait for transaction confirmation
    console.log(`⏳ Waiting for transaction confirmation...`);
    const receipt = await waitForTransaction(tx.hash);

    if (!receipt || receipt.status !== 1) {
      throw new Error('Transaction failed');
    }

    console.log(`✅ Transaction confirmed!`);
    console.log(`   Block: ${receipt.blockNumber}`);
    console.log(`   Hash: ${receipt.hash}`);

    // Update payment with transaction hash
    await updatePayment(payment.id!, {
      tx_hash: receipt.hash,
      block_number: receipt.blockNumber.toString(),
      status: 'completed',
      completed_at: new Date(),
    });

    console.log(`\n🎉 Payment completed successfully!`);
    console.log(`   Payment ID: ${payment.id}`);
    console.log(`   TX Hash: ${receipt.hash}`);
    console.log(`   Block: ${receipt.blockNumber}`);
    console.log(`   Wallet: ${walletAddress}`);
    console.log(`   Amount: ${payment.amount_usdt} USDT`);

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    
    // Try to update payment status to failed
    try {
      const payment = await getPaymentByPaymentIntentId(paymentIntentId);
      if (payment && payment.status !== 'completed') {
        await updatePayment(payment.id!, {
          status: 'failed',
          error_message: error.message,
        });
        console.log('Updated payment status to failed');
      }
    } catch (updateError) {
      console.error('Failed to update payment status:', updateError);
    }
    
    process.exit(1);
  }
}

// Get payment intent ID from command line
const paymentIntentId = process.argv[2];

if (!paymentIntentId) {
  console.error('Usage: npx tsx src/scripts/trigger-payment-webhook.ts <payment_intent_id>');
  console.error('Example: npx tsx src/scripts/trigger-payment-webhook.ts pi_3SZpsPLcdcGA3J2H1Vkl4ylF');
  process.exit(1);
}

triggerPaymentWebhook(paymentIntentId)
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });

