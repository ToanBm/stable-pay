export interface Payroll {
  id?: number;
  payroll_id: string;
  employer_address: string;
  employee_address: string;
  amount_usdt: string;
  tx_hash?: string;
  block_number?: number;
  status: 'pending' | 'completed' | 'failed';
  timestamp?: Date;
}

