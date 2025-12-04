import Stripe from 'stripe';
import dotenv from 'dotenv';

// Ensure .env is loaded
dotenv.config();

let stripe: Stripe | null = null;

if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-11-20.acacia',
  });
} else {
  // Don't warn here - will be checked in getStripe()
}

export { stripe };

export const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

export function getStripe(): Stripe {
  if (!stripe) {
    // Try to initialize if not already done
    if (process.env.STRIPE_SECRET_KEY) {
      stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: '2024-11-20.acacia',
      });
    } else {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
  }
  return stripe;
}

