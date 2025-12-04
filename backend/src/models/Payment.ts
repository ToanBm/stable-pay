export interface Payment {
  id?: number;
  payment_intent_id: string;
  wallet_address: string;
  amount_fiat: string;
  fiat_currency: string;
  amount_usdt: string;
  exchange_rate: string;
  tx_hash?: string;
  block_number?: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'canceled';
  error_message?: string;
  created_at?: Date;
  updated_at?: Date;
  completed_at?: Date;
}

