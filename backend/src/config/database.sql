-- Employees table
CREATE TABLE IF NOT EXISTS employees (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(42) UNIQUE NOT NULL,
  name VARCHAR(255),
  email VARCHAR(255),
  country VARCHAR(2),
  stripe_bank_account_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Payrolls table
-- Note: payroll_id is NOT UNIQUE to support batch payrolls (multiple employees can share same payroll_id)
CREATE TABLE IF NOT EXISTS payrolls (
  id SERIAL PRIMARY KEY,
  payroll_id VARCHAR(255) NOT NULL,
  employer_address VARCHAR(42) NOT NULL,
  employee_address VARCHAR(42) NOT NULL,
  amount_usdt DECIMAL(18, 6) NOT NULL,
  tx_hash VARCHAR(66),
  block_number BIGINT,
  status VARCHAR(50) DEFAULT 'pending',
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Cashouts table
CREATE TABLE IF NOT EXISTS cashouts (
  id SERIAL PRIMARY KEY,
  employee_address VARCHAR(42) NOT NULL,
  amount_usdt DECIMAL(18, 6) NOT NULL,
  fiat_currency VARCHAR(3) NOT NULL,
  fiat_amount DECIMAL(18, 2),
  exchange_rate DECIMAL(18, 8),
  tx_hash_onchain VARCHAR(66) NOT NULL,
  payout_id_stripe VARCHAR(255),
  stripe_bank_account_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Exchange rates table (optional - cache rates)
CREATE TABLE IF NOT EXISTS exchange_rates (
  id SERIAL PRIMARY KEY,
  from_currency VARCHAR(10) NOT NULL,
  to_currency VARCHAR(10) NOT NULL,
  rate DECIMAL(18, 8) NOT NULL,
  source VARCHAR(50),
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Payments table (On-Ramp: VISA/Mastercard → USDT)
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  payment_intent_id VARCHAR(255) UNIQUE NOT NULL,
  wallet_address VARCHAR(42) NOT NULL,
  amount_fiat DECIMAL(18, 2) NOT NULL,
  fiat_currency VARCHAR(3) NOT NULL,
  amount_usdt DECIMAL(18, 6) NOT NULL,
  exchange_rate DECIMAL(18, 8) NOT NULL,
  tx_hash VARCHAR(66),
  block_number BIGINT,
  status VARCHAR(50) DEFAULT 'pending',
  -- pending, processing, completed, failed, canceled
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
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

