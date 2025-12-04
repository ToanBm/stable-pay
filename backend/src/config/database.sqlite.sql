-- SQLite compatible schema
-- Employees table
CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wallet_address TEXT UNIQUE NOT NULL,
  name TEXT,
  email TEXT,
  country TEXT,
  stripe_bank_account_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Payrolls table
-- Note: payroll_id is NOT UNIQUE to support batch payrolls (multiple employees can share same payroll_id)
CREATE TABLE IF NOT EXISTS payrolls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payroll_id TEXT NOT NULL,
  employer_address TEXT NOT NULL,
  employee_address TEXT NOT NULL,
  amount_usdt REAL NOT NULL,
  tx_hash TEXT,
  block_number INTEGER,
  status TEXT DEFAULT 'pending',
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Cashouts table
CREATE TABLE IF NOT EXISTS cashouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_address TEXT NOT NULL,
  amount_usdt REAL NOT NULL,
  fiat_currency TEXT NOT NULL,
  fiat_amount REAL,
  exchange_rate REAL,
  tx_hash_onchain TEXT NOT NULL,
  payout_id_stripe TEXT,
  stripe_bank_account_id TEXT,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);

-- Exchange rates table
CREATE TABLE IF NOT EXISTS exchange_rates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_currency TEXT NOT NULL,
  to_currency TEXT NOT NULL,
  rate REAL NOT NULL,
  source TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Payments table (On-Ramp: VISA/Mastercard → USDT)
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_intent_id TEXT UNIQUE NOT NULL,
  wallet_address TEXT NOT NULL,
  amount_fiat REAL NOT NULL,
  fiat_currency TEXT NOT NULL,
  amount_usdt REAL NOT NULL,
  exchange_rate REAL NOT NULL,
  tx_hash TEXT,
  block_number INTEGER,
  status TEXT DEFAULT 'pending',
  -- pending, processing, completed, failed, canceled
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payrolls_payroll_id ON payrolls(payroll_id);
CREATE INDEX IF NOT EXISTS idx_payrolls_employer ON payrolls(employer_address);
CREATE INDEX IF NOT EXISTS idx_payrolls_employee ON payrolls(employee_address);
CREATE INDEX IF NOT EXISTS idx_payrolls_tx_hash ON payrolls(tx_hash);
CREATE INDEX IF NOT EXISTS idx_cashouts_employee ON cashouts(employee_address);
CREATE INDEX IF NOT EXISTS idx_cashouts_tx_hash ON cashouts(tx_hash_onchain);
CREATE INDEX IF NOT EXISTS idx_cashouts_payout_id ON cashouts(payout_id_stripe);
CREATE INDEX IF NOT EXISTS idx_cashouts_status ON cashouts(status);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_currencies ON exchange_rates(from_currency, to_currency);
CREATE INDEX IF NOT EXISTS idx_payments_payment_intent_id ON payments(payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payments_wallet_address ON payments(wallet_address);
CREATE INDEX IF NOT EXISTS idx_payments_tx_hash ON payments(tx_hash);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

