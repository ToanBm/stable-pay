import { apiClient } from './config';
import type { PaymentCurrency } from '@/utils/constants';

export interface CreatePaymentIntentRequest {
  amount: number;
  currency: PaymentCurrency;
  walletAddress: string;
}

export interface CreatePaymentIntentResponse {
  paymentIntentId: string;
  clientSecret: string;
  amountUSDT: string;
  exchangeRate: number;
}

export interface PaymentStatusResponse {
  paymentIntentId: string;
  status: 'succeeded' | 'processing' | 'failed' | 'canceled' | 'requires_action';
  amountFiat: string;
  amountUSDT: string;
  currency: string;
  walletAddress: string;
  txHash?: string;
  blockNumber?: number;
  error?: string;
}

export interface PaymentHistoryItem {
  id: number;
  paymentIntentId: string;
  walletAddress: string;
  amountFiat: string;
  amountUSDT: string;
  currency: string;
  status: string;
  txHash?: string;
  createdAt: string;
}

export interface OfframpBalanceResponse {
  balance: string;
  currency: string;
  address: string;
}

// Create payment intent
export async function createPaymentIntent(
  data: CreatePaymentIntentRequest
): Promise<CreatePaymentIntentResponse> {
  const response = await apiClient.post<CreatePaymentIntentResponse>(
    '/api/payment/create-intent',
    data
  );
  return response.data;
}

// Get payment status
export async function getPaymentStatus(
  paymentIntentId: string
): Promise<PaymentStatusResponse> {
  const response = await apiClient.get<any>(
    `/api/payment/status/${paymentIntentId}`
  );
  // Map backend response (snake_case) to frontend format (camelCase)
  return {
    paymentIntentId: response.data.payment_intent_id || response.data.paymentIntentId,
    status: response.data.status === 'completed' ? 'succeeded' : response.data.status,
    amountFiat: response.data.amount_fiat || response.data.amountFiat,
    amountUSDT: response.data.amount_usdt || response.data.amountUSDT,
    currency: response.data.fiat_currency || response.data.currency,
    walletAddress: response.data.wallet_address || response.data.walletAddress,
    txHash: response.data.tx_hash || response.data.txHash, // Map tx_hash to txHash
    blockNumber: response.data.block_number || response.data.blockNumber,
    error: response.data.error_message || response.data.error,
  };
}

// Get payment history
export async function getPaymentHistory(
  walletAddress: string,
  page = 1,
  limit = 10
): Promise<PaymentHistoryItem[]> {
  const response = await apiClient.get<{ payments: any[]; total: number }>(
    `/api/payment/history/${walletAddress}`,
    {
      params: { page, limit },
    }
  );
  // Map backend response (snake_case) to frontend format (camelCase)
  return response.data.payments.map((payment: any) => ({
    id: payment.id,
    paymentIntentId: payment.payment_intent_id || payment.paymentIntentId,
    walletAddress: payment.wallet_address || payment.walletAddress,
    amountFiat: payment.amount_fiat || payment.amountFiat,
    amountUSDT: payment.amount_usdt || payment.amountUSDT,
    currency: payment.fiat_currency || payment.currency,
    status: payment.status,
    txHash: payment.tx_hash || payment.txHash, // Map tx_hash to txHash
    createdAt: payment.created_at || payment.createdAt,
  }));
}

// Get offramp balance
export async function getOfframpBalance(): Promise<OfframpBalanceResponse> {
  const response = await apiClient.get<OfframpBalanceResponse>(
    '/api/payment/offramp-balance'
  );
  return response.data;
}

// Get exchange rate
export interface ExchangeRateResponse {
  from: string;
  to: string;
  rate: number;
  usdtToFiatRate: number;
}

export async function getExchangeRate(
  currency: PaymentCurrency
): Promise<ExchangeRateResponse> {
  try {
    console.log('[Exchange Rate] Fetching rate for:', currency);
    console.log('[Exchange Rate] API URL:', apiClient.defaults.baseURL);
    const response = await apiClient.get<ExchangeRateResponse>(
      '/api/payment/exchange-rate',
      {
        params: { currency: currency.toLowerCase() }, // Convert to lowercase
      }
    );
    console.log('[Exchange Rate] Response status:', response.status);
    console.log('[Exchange Rate] Response headers:', response.headers);
    console.log('[Exchange Rate] Response data:', response.data);
    
    // Check if response is actually HTML (ngrok warning page)
    const responseData = response.data as any;
    if (typeof responseData === 'string' && responseData.includes('ngrok')) {
      console.error('[Exchange Rate] Received ngrok warning page HTML instead of JSON');
      throw new Error('Ngrok warning page detected');
    }
    
    // Validate response data
    if (!response.data || typeof response.data.rate !== 'number' || isNaN(response.data.rate)) {
      console.warn('[Exchange Rate] Invalid response from API:', response.data);
      console.warn('[Exchange Rate] Using default 1:1');
      return {
        from: currency,
        to: 'USDT',
        rate: 1,
        usdtToFiatRate: 1,
      };
    }
    
    return response.data;
  } catch (error: any) {
    console.error('[Exchange Rate] API error details:');
    console.error('[Exchange Rate] Error message:', error.message);
    console.error('[Exchange Rate] Error response:', error.response?.data);
    console.error('[Exchange Rate] Error status:', error.response?.status);
    console.error('[Exchange Rate] Using default 1:1 rate');
    // Fallback to 1:1 rate on error
    return {
      from: currency,
      to: 'USDT',
      rate: 1,
      usdtToFiatRate: 1,
    };
  }
}
