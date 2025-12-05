import { Request, Response } from 'express';
import { verifyWebhookSignature } from '../utils/stripe';
import { getCashoutByPayoutId, updateCashout } from '../services/cashoutService';
import { getPaymentByPaymentIntentId, updatePayment } from '../services/paymentService';
import { transferUSDTFromOfframp, waitForTransaction } from '../utils/blockchain';
import { stripeWebhookSecret } from '../config/stripe';
import type Stripe from 'stripe';

/**
 * POST /api/webhooks/stripe
 * Handle Stripe webhook events
 */
export async function handleStripeWebhook(req: Request, res: Response) {
  try {
    console.log('[Webhook] Received webhook request');
    console.log('[Webhook] Headers:', JSON.stringify(req.headers, null, 2));
    
    const signature = req.headers['stripe-signature'] as string;

    if (!signature) {
      console.error('[Webhook] Missing stripe-signature header');
      return res.status(400).json({ error: 'Missing stripe-signature header' });
    }
    
    console.log('[Webhook] Signature found, verifying...');

    // req.body is raw buffer for Stripe webhook
    const payload = req.body as string | Buffer;

    // Verify webhook signature
    const event = verifyWebhookSignature(
      payload,
      signature,
      stripeWebhookSecret
    ) as Stripe.Event;

    console.log('[Webhook] Event verified:', event.type);
    console.log('[Webhook] Event ID:', event.id);

    // Handle different event types
    switch (event.type) {
      case 'payout.paid':
        await handlePayoutPaid(event.data.object as Stripe.Payout);
        break;

      case 'payout.failed':
        await handlePayoutFailed(event.data.object as Stripe.Payout);
        break;

      case 'payout.canceled':
        await handlePayoutCanceled(event.data.object as Stripe.Payout);
        break;

      case 'payment_intent.succeeded':
        console.log('[Webhook] Handling payment_intent.succeeded');
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        console.log('[Webhook] payment_intent.succeeded handled successfully');
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      case 'payment_intent.canceled':
        await handlePaymentIntentCanceled(event.data.object as Stripe.PaymentIntent);
        break;

      default:
        // Unhandled event type - ignore
        break;
    }

    // Always return 200 to acknowledge receipt
    console.log('[Webhook] Sending 200 response');
    res.json({ received: true });
  } catch (error: any) {
    console.error('[Webhook] Error:', error.message);
    
    // Still return 200 to prevent Stripe from retrying
    // Log error for manual investigation
    res.status(200).json({ 
      received: true, 
      error: error.message 
    });
  }
}

/**
 * Handle payout.paid event
 */
async function handlePayoutPaid(payout: Stripe.Payout) {
  try {
    const cashout = await getCashoutByPayoutId(payout.id);

    if (!cashout) {
      console.warn(`Cashout not found for payout ${payout.id}`);
      return;
    }

    await updateCashout(cashout.id!, {
      status: 'paid',
      completed_at: new Date(),
    });
  } catch (error) {
    console.error('Error handling payout.paid:', error);
    throw error;
  }
}

/**
 * Handle payout.failed event
 */
async function handlePayoutFailed(payout: Stripe.Payout) {
  try {
    const cashout = await getCashoutByPayoutId(payout.id);

    if (!cashout) {
      console.warn(`Cashout not found for payout ${payout.id}`);
      return;
    }

    const failureCode = payout.failure_code || 'unknown';
    const failureMessage = payout.failure_message || 'Payout failed';

    await updateCashout(cashout.id!, {
      status: 'failed',
      error_message: `Stripe payout failed: ${failureCode} - ${failureMessage}`,
    });
  } catch (error) {
    console.error('Error handling payout.failed:', error);
    throw error;
  }
}

/**
 * Handle payout.canceled event
 */
async function handlePayoutCanceled(payout: Stripe.Payout) {
  try {
    const cashout = await getCashoutByPayoutId(payout.id);

    if (!cashout) {
      console.warn(`Cashout not found for payout ${payout.id}`);
      return;
    }

    await updateCashout(cashout.id!, {
      status: 'canceled',
      error_message: 'Stripe payout was canceled',
    });
  } catch (error) {
    console.error('Error handling payout.canceled:', error);
    throw error;
  }
}

/**
 * Handle payment_intent.succeeded event
 * Transfer USDT from offramp wallet to user wallet
 */
async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  try {
    const payment = await getPaymentByPaymentIntentId(paymentIntent.id);

    if (!payment) {
      console.warn(`Payment not found for payment intent ${paymentIntent.id}`);
      return;
    }

    // Check if already processed
    if (payment.status === 'completed' || payment.tx_hash) {
      return;
    }

    // Update status to processing
    await updatePayment(payment.id!, {
      status: 'processing',
    });

    // Get wallet address from metadata
    const walletAddress = paymentIntent.metadata?.wallet_address || payment.wallet_address;

    if (!walletAddress) {
      throw new Error('Wallet address not found in payment intent metadata');
    }

    // Transfer USDT from offramp wallet to user wallet
    // Convert amount to string if needed (database might return number)
    const amountUSDT = typeof payment.amount_usdt === 'string' 
      ? payment.amount_usdt 
      : String(payment.amount_usdt);
    
    console.log(`[Webhook] Transferring ${amountUSDT} USDT to ${walletAddress}...`);
    
    let tx;
    try {
      tx = await transferUSDTFromOfframp(walletAddress, amountUSDT);
      console.log(`[Webhook] Transaction created: ${tx.hash}`);
    } catch (error: any) {
      console.error(`[Webhook] Failed to create transaction:`, error);
      throw new Error(`Failed to create USDT transfer transaction: ${error.message}`);
    }

    // Wait for transaction confirmation
    console.log(`[Webhook] Waiting for transaction confirmation: ${tx.hash}`);
    let receipt;
    try {
      receipt = await waitForTransaction(tx.hash);
      if (receipt) {
        console.log(`[Webhook] Transaction receipt received:`, {
          hash: receipt.hash,
          blockNumber: receipt.blockNumber,
          status: receipt.status,
        });
      }
    } catch (error: any) {
      console.error(`[Webhook] Failed to wait for transaction:`, error);
      throw new Error(`Failed to confirm transaction: ${error.message}`);
    }

    if (!receipt || receipt.status !== 1) {
      console.error(`[Webhook] Transaction failed on-chain. Status: ${receipt?.status}`);
      throw new Error(`Transaction failed on-chain. Status: ${receipt?.status}`);
    }

    // Update payment with transaction hash
    console.log(`[Webhook] Updating payment ${payment.id} with transaction hash: ${receipt.hash}`);
    await updatePayment(payment.id!, {
      tx_hash: receipt.hash,
      block_number: receipt.blockNumber,
      status: 'completed',
      completed_at: new Date(),
    });
    console.log(`[Webhook] Payment ${payment.id} updated successfully`);
  } catch (error: any) {
    console.error('Error handling payment_intent.succeeded:', error);

    // Update payment status to failed
    try {
      const payment = await getPaymentByPaymentIntentId(paymentIntent.id);
      if (payment) {
        await updatePayment(payment.id!, {
          status: 'failed',
          error_message: error.message || 'Failed to transfer USDT',
        });
      }
    } catch (updateError) {
      console.error('Failed to update payment status:', updateError);
    }

    throw error;
  }
}

/**
 * Handle payment_intent.payment_failed event
 */
async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  try {
    const payment = await getPaymentByPaymentIntentId(paymentIntent.id);

    if (!payment) {
      console.warn(`Payment not found for payment intent ${paymentIntent.id}`);
      return;
    }

    const failureMessage = paymentIntent.last_payment_error?.message || 'Payment failed';

    await updatePayment(payment.id!, {
      status: 'failed',
      error_message: `Stripe payment failed: ${failureMessage}`,
    });
  } catch (error) {
    console.error('Error handling payment_intent.payment_failed:', error);
    throw error;
  }
}

/**
 * Handle payment_intent.canceled event
 */
async function handlePaymentIntentCanceled(paymentIntent: Stripe.PaymentIntent) {
  try {
    const payment = await getPaymentByPaymentIntentId(paymentIntent.id);

    if (!payment) {
      console.warn(`Payment not found for payment intent ${paymentIntent.id}`);
      return;
    }

    await updatePayment(payment.id!, {
      status: 'canceled',
      error_message: 'Payment intent was canceled',
    });
  } catch (error) {
    console.error('Error handling payment_intent.canceled:', error);
    throw error;
  }
}

