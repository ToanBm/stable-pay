import { getStripe } from '../config/stripe';
import type Stripe from 'stripe';

/**
 * Create a payout to bank account
 * If connectedAccountId is provided, creates payout from connected account context
 */
export async function createPayout(params: {
  amount: number; // Amount in fiat currency (will be converted to cents)
  currency: 'usd' | 'eur' | 'vnd';
  destination: string; // Bank account ID (ba_test_xxx)
  method?: 'standard' | 'instant';
  connectedAccountId?: string; // Connected account ID if bank account belongs to connected account
}): Promise<Stripe.Payout> {
  try {
    const stripe = getStripe();
    
    const payoutParams: Stripe.PayoutCreateParams = {
      amount: Math.round(params.amount * 100), // Convert to cents
      currency: params.currency,
      destination: params.destination,
      method: params.method || 'standard',
    };
    
    // If connectedAccountId is provided, create payout from connected account context
    const payout = params.connectedAccountId
      ? await stripe.payouts.create(payoutParams, {
          stripeAccount: params.connectedAccountId,
        })
      : await stripe.payouts.create(payoutParams);

    return payout;
  } catch (error: any) {
    if (error?.type && error.type.startsWith('Stripe')) {
      throw new Error(`Stripe error: ${error.message}`);
    }
    throw new Error(`Failed to create payout: ${error}`);
  }
}

/**
 * Get payout status
 */
export async function getPayoutStatus(
  payoutId: string
): Promise<Stripe.Payout> {
  try {
    const stripe = getStripe();
    const payout = await stripe.payouts.retrieve(payoutId);
    return payout;
  } catch (error: any) {
    if (error?.type && error.type.startsWith('Stripe')) {
      throw new Error(`Stripe error: ${error.message}`);
    }
    throw new Error(`Failed to get payout status: ${error}`);
  }
}

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string,
  secret: string
): Stripe.Event {
  try {
    const stripe = getStripe();
    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      secret
    );
    return event;
  } catch (error: any) {
    if (error?.type && error.type.startsWith('Stripe')) {
      throw new Error(`Stripe webhook error: ${error.message}`);
    }
    throw new Error(`Failed to verify webhook signature: ${error}`);
  }
}

/**
 * Transfer funds from platform account to connected account
 */
export async function transferToConnectedAccount(params: {
  amount: number; // Amount in fiat currency (will be converted to cents)
  currency: 'usd' | 'eur';
  destination: string; // Connected account ID (acct_xxx)
  description?: string;
}): Promise<Stripe.Transfer> {
  try {
    const stripe = getStripe();
    const transfer = await stripe.transfers.create({
      amount: Math.round(params.amount * 100), // Convert to cents
      currency: params.currency,
      destination: params.destination,
      description: params.description || `Transfer ${params.currency.toUpperCase()} for payout`,
    });
    
    return transfer;
  } catch (error: any) {
    if (error?.type && error.type.startsWith('Stripe')) {
      throw new Error(`Stripe error: ${error.message}`);
    }
    throw new Error(`Failed to transfer to connected account: ${error}`);
  }
}

/**
 * Get exchange rate with caching
 * Note: Actual rate will be determined by Stripe at payout time
 * This function provides estimated rate for display/calculation
 */
export async function getExchangeRate(
  from: string,
  to: string
): Promise<number> {
  // Import exchange rate service dynamically to avoid circular dependencies
  const { getExchangeRate: getRate } = await import(
    '../services/exchangeRateService'
  );
  return getRate(from, to);
}

/**
 * Create a Payment Intent for on-ramp (VISA/Mastercard → USDT)
 */
export async function createPaymentIntent(params: {
  amount: number; // Amount in fiat currency (will be converted to cents)
  currency: 'usd' | 'eur';
  walletAddress: string; // User's wallet address to receive USDT
  metadata?: Record<string, string>;
}): Promise<Stripe.PaymentIntent> {
  try {
    const stripe = getStripe();
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(params.amount * 100), // Convert to cents
      currency: params.currency,
      metadata: {
        wallet_address: params.walletAddress,
        ...params.metadata,
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    return paymentIntent;
  } catch (error: any) {
    if (error?.type && error.type.startsWith('Stripe')) {
      throw new Error(`Stripe error: ${error.message}`);
    }
    throw new Error(`Failed to create payment intent: ${error}`);
  }
}

/**
 * Confirm a Payment Intent (client-side confirmation)
 * Note: Usually done on frontend, but this can be used for server-side confirmation
 */
export async function confirmPaymentIntent(
  paymentIntentId: string,
  paymentMethodId?: string
): Promise<Stripe.PaymentIntent> {
  try {
    const stripe = getStripe();
    const paymentIntent = await stripe.paymentIntents.confirm(
      paymentIntentId,
      paymentMethodId ? { payment_method: paymentMethodId } : {}
    );

    return paymentIntent;
  } catch (error: any) {
    if (error?.type && error.type.startsWith('Stripe')) {
      throw new Error(`Stripe error: ${error.message}`);
    }
    throw new Error(`Failed to confirm payment intent: ${error}`);
  }
}

/**
 * Get Payment Intent status
 */
export async function getPaymentIntent(
  paymentIntentId: string
): Promise<Stripe.PaymentIntent> {
  try {
    const stripe = getStripe();
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    return paymentIntent;
  } catch (error: any) {
    if (error?.type && error.type.startsWith('Stripe')) {
      throw new Error(`Stripe error: ${error.message}`);
    }
    throw new Error(`Failed to get payment intent: ${error}`);
  }
}

