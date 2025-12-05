import { Request, Response } from 'express';
import { createPayment, updatePayment, getPaymentByPaymentIntentId, getPaymentHistoryByWallet } from '../services/paymentService';
import { createPaymentIntent, getPaymentIntent, getExchangeRate } from '../utils/stripe';
import { transferUSDTFromOfframp, getOfframpBalance, isValidAddress } from '../utils/blockchain';
import { Payment } from '../models/Payment';

/**
 * POST /api/payment/create-intent
 * Create a Payment Intent for on-ramp (VISA/Mastercard → USDT)
 */
export async function createPaymentIntentHandler(req: Request, res: Response) {
  try {
    const { amount, currency, walletAddress } = req.body;

    // Validation
    if (!walletAddress || !isValidAddress(walletAddress)) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }

    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    if (!currency || !['usd', 'eur'].includes(currency.toLowerCase())) {
      return res.status(400).json({ error: 'Invalid currency. Supported: usd, eur' });
    }

    // Get exchange rate (Fiat → USDT)
    // Service returns USDT → Fiat, so we need to invert it
    let exchangeRate = 1.0;
    try {
      const usdtToFiatRate = await getExchangeRate('usdt', currency.toLowerCase());
      // Invert: if 1 USDT = X Fiat, then 1 Fiat = 1/X USDT
      exchangeRate = 1 / usdtToFiatRate;
    } catch (error) {
      console.warn('Failed to get exchange rate, using 1:1:', error);
    }

    const amountUSDT = parseFloat(amount) * exchangeRate;

    // Validate maximum amount: 5 USDT limit
    if (amountUSDT > 5) {
      return res.status(400).json({
        error: 'Maximum purchase limit is 5 USDT',
        maxAmount: '5',
        requested: amountUSDT.toFixed(6),
      });
    }

    // Check offramp wallet balance
    try {
      const offrampBalance = await getOfframpBalance();
      if (parseFloat(offrampBalance) < amountUSDT) {
        return res.status(400).json({
          error: 'Insufficient balance in offramp wallet',
          available: offrampBalance,
          required: amountUSDT.toFixed(6),
        });
      }
    } catch (error: any) {
      console.warn('Failed to check offramp balance:', error.message);
      // Continue anyway, will check again when processing
    }

    // Create Stripe Payment Intent
    const paymentIntent = await createPaymentIntent({
      amount: parseFloat(amount),
      currency: currency.toLowerCase() as 'usd' | 'eur',
      walletAddress,
      metadata: {
        amount_usdt: amountUSDT.toFixed(6),
        exchange_rate: exchangeRate.toString(),
      },
    });

    // Create payment record in database
    const payment = await createPayment({
      payment_intent_id: paymentIntent.id,
      wallet_address: walletAddress,
      amount_fiat: amount,
      fiat_currency: currency.toLowerCase(),
      amount_usdt: amountUSDT.toFixed(6),
      exchange_rate: exchangeRate.toString(),
      status: 'pending',
    });

    res.json({
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      amount: parseFloat(amount),
      currency: currency.toLowerCase(),
      amountUSDT: amountUSDT.toFixed(6),
      exchangeRate: exchangeRate.toString(),
      walletAddress,
      status: 'pending',
    });
  } catch (error: any) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({ error: error.message || 'Failed to create payment intent' });
  }
}

/**
 * GET /api/payment/status/:paymentIntentId
 * Get payment status by Payment Intent ID
 */
export async function getPaymentStatus(req: Request, res: Response) {
  try {
    const { paymentIntentId } = req.params;

    if (!paymentIntentId) {
      return res.status(400).json({ error: 'Payment Intent ID is required' });
    }

    // Get payment from database
    const payment = await getPaymentByPaymentIntentId(paymentIntentId);

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Get latest status from Stripe
    try {
      const stripePaymentIntent = await getPaymentIntent(paymentIntentId);
      
      // Update payment status if changed
      if (stripePaymentIntent.status !== payment.status) {
        let newStatus: Payment['status'] = 'pending';
        if (stripePaymentIntent.status === 'succeeded') {
          newStatus = payment.tx_hash ? 'completed' : 'processing';
        } else if (stripePaymentIntent.status === 'canceled') {
          newStatus = 'canceled';
        } else if (stripePaymentIntent.status === 'requires_payment_method') {
          newStatus = 'failed';
        }

        if (newStatus !== payment.status) {
          await updatePayment(payment.id!, { status: newStatus });
          payment.status = newStatus;
        }
      }
    } catch (error) {
      // If Stripe API fails, return database status
      console.warn('Failed to get Stripe payment intent:', error);
    }

    // Log payment response for debugging
    console.log(`[Payment Status] Payment ${payment.id} - Status: ${payment.status}, TX Hash: ${payment.tx_hash || 'N/A'}`);

    res.json(payment);
  } catch (error: any) {
    console.error('Error getting payment status:', error);
    res.status(500).json({ error: error.message || 'Failed to get payment status' });
  }
}

/**
 * GET /api/payment/history/:walletAddress
 * Get payment history for a wallet address
 */
export async function getPaymentHistory(req: Request, res: Response) {
  try {
    const { walletAddress } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    if (!walletAddress || !isValidAddress(walletAddress)) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }

    const result = await getPaymentHistoryByWallet(walletAddress, page, limit);

    res.json({
      payments: result.payments,
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
    });
  } catch (error: any) {
    console.error('Error getting payment history:', error);
    res.status(500).json({ error: error.message || 'Failed to get payment history' });
  }
}

/**
 * GET /api/payment/offramp-balance
 * Get offramp wallet balance (for checking available liquidity)
 */
export async function getOfframpBalanceHandler(req: Request, res: Response) {
  try {
    const balance = await getOfframpBalance();

    res.json({
      balance,
      currency: 'USDT',
      address: (await import('../utils/blockchain')).getOfframpAddress(),
    });
  } catch (error: any) {
    console.error('Error getting offramp balance:', error);
    res.status(500).json({ error: error.message || 'Failed to get offramp balance' });
  }
}

/**
 * GET /api/payment/exchange-rate?currency=USD
 * Get exchange rate (Fiat → USDT) for display
 */
export async function getExchangeRateHandler(req: Request, res: Response) {
  try {
    const { currency } = req.query;
    console.log(`[Exchange Rate Handler] Request for currency: ${currency}`);

    if (!currency || !['usd', 'eur'].includes((currency as string).toLowerCase())) {
      console.warn(`[Exchange Rate Handler] Invalid currency: ${currency}`);
      return res.status(400).json({ error: 'Invalid currency. Supported: usd, eur' });
    }

    const currencyLower = (currency as string).toLowerCase();
    const currencyUpper = currency.toString().toUpperCase();
    
    // Get exchange rate (Fiat → USDT)
    // Service returns USDT → Fiat, so we need to invert it
    let exchangeRate = 1.0;
    try {
      console.log(`[Exchange Rate Handler] Fetching USDT → ${currencyLower} rate...`);
      const usdtToFiatRate = await getExchangeRate('usdt', currencyLower);
      console.log(`[Exchange Rate Handler] Got USDT → ${currencyLower} rate: ${usdtToFiatRate}`);
      
      // Ensure usdtToFiatRate is a valid non-zero number before inverting
      if (typeof usdtToFiatRate === 'number' && !isNaN(usdtToFiatRate) && usdtToFiatRate > 0) {
        exchangeRate = 1 / usdtToFiatRate;
        console.log(`[Exchange Rate Handler] Calculated ${currencyUpper} → USDT rate: ${exchangeRate}`);
      } else {
        console.warn(`[Exchange Rate Handler] Invalid usdtToFiatRate (${usdtToFiatRate}), using 1:1`);
        exchangeRate = 1.0; // Fallback to 1:1
      }
    } catch (error: any) {
      console.error('[Exchange Rate Handler] Failed to get exchange rate:', error);
      console.warn('[Exchange Rate Handler] Using fallback 1:1 rate');
      exchangeRate = 1.0; // Fallback to 1:1 on error
    }
    const response = {
      from: currencyUpper,
      to: 'USDT',
      rate: exchangeRate,
      // Also return USDT to Fiat rate for reference (avoid division by zero)
      usdtToFiatRate: exchangeRate > 0 ? 1 / exchangeRate : 1,
    };
    
    console.log(`[Exchange Rate Handler] Sending response:`, response);
    res.json(response);
  } catch (error: any) {
    console.error('[Exchange Rate Handler] Error getting exchange rate:', error);
    res.status(500).json({ error: error.message || 'Failed to get exchange rate' });
  }
}

