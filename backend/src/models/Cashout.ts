export interface Cashout {
  id?: number;
  employee_address: string;
  amount_usdt: string;
  fiat_currency: string;
  fiat_amount?: string;
  exchange_rate?: string;
  tx_hash_onchain: string;
  payout_id_stripe?: string;
  stripe_bank_account_id?: string;
  status:
    | 'pending_transfer'
    | 'pending_payout'
    | 'in_transit'
    | 'paid'
    | 'failed'
    | 'canceled';
  error_message?: string;
  created_at?: Date;
  updated_at?: Date;
  completed_at?: Date;
}

