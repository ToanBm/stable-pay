# Ghi Chú Kỹ Thuật - Technical Notes

**Last Updated:** 2025-12-03

Tổng hợp các ghi chú kỹ thuật, setup guides, và code notes quan trọng.

---

## ⚠️ VẤN ĐỀ QUAN TRỌNG - TẠO BANK ACCOUNT ID CHO USER

### Vấn Đề:
- **User đăng ký cần có Bank Account ID (`ba_xxx`) để nhận payout**
- Hiện tại API `/api/employees/register` yêu cầu user tự cung cấp `stripe_bank_account_id`
- Cần **tự động tạo** Connected Account + Bank Account khi user đăng ký

### Giải Pháp Cần Implement:

**1. Tạo Utility Function:**
- Tách logic từ `create-connected-account-with-bank.ts` thành utility function
- File: `backend/src/utils/stripe.ts`
- Function: `createConnectedAccountWithBank(params)`
  - Tạo Connected Account (Custom type)
  - Tạo External Bank Account
  - Return: `{ connectedAccountId: 'acct_xxx', bankAccountId: 'ba_xxx' }`

**2. Tích Hợp Vào Register Endpoint:**
- Modify `backend/src/controllers/employeeController.ts` → `registerEmployee()`
- Tự động gọi `createConnectedAccountWithBank()` khi user đăng ký
- Lưu cả `connectedAccountId` và `bankAccountId` vào database

**3. Database Schema:**
- Cần thêm field `stripe_connected_account_id` vào table `employees` (hoặc dùng `stripe_bank_account_id` để lưu bank account ID)
- Lưu cả 2 IDs:
  - `stripe_connected_account_id`: `acct_xxx` (Connected Account ID)
  - `stripe_bank_account_id`: `ba_xxx` (Bank Account ID - dùng cho payout)

**4. Test Tokens (Test Mode):**
- Address: `'address_full_match'` - Auto-verify
- DOB: `1901-01-01` - Test DOB
- SSN: `'0000'` / `'000000000'` - Test SSN
- Bank Account: `'000999999991'` - Auto-verify sau 1-2 phút
- Business URL: `'https://accessible.stripe.com'` - Test URL
- MCC: `'5734'` - Valid MCC

**5. Flow:**
```
User Register → 
  → Create Connected Account (Custom) 
  → Create External Bank Account 
  → Save IDs to Database 
  → Return Employee with Bank Account ID
```

**6. Code Location:**
- Script: `backend/src/scripts/create-connected-account-with-bank.ts`
- Controller: `backend/src/controllers/employeeController.ts` → `registerEmployee()`
- Utility: `backend/src/utils/stripe.ts` (cần thêm function)

**7. Lưu Ý:**
- ✅ Test mode: Dùng test tokens để bypass verification
- ⚠️ Production: Cần collect thông tin thật từ user (bank account number, routing number, etc.)
- ⚠️ Production: Account có thể cần manual verification nếu không đủ thông tin

**Status:** ⏳ **PENDING - Cần implement**

---

## 📋 Mục Lục

1. [Project Setup](#1-project-setup)
2. [Environment Setup](#2-environment-setup)
3. [Stripe Integration](#3-stripe-integration)
4. [Blockchain Integration](#4-blockchain-integration)
5. [Database Schema](#5-database-schema)
6. [API Endpoints](#6-api-endpoints)
7. [Frontend Setup](#7-frontend-setup)
8. [Test Scripts](#8-test-scripts)
9. [Known Issues & Solutions](#9-known-issues--solutions)
10. [Code Notes](#10-code-notes)
11. [Flow Diagrams](#11-flow-diagrams)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Project Setup

### Backend Setup

```bash
cd backend
npm install
```

Tạo file `.env` trong `backend/`:
```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/payroll_db
# Hoặc SQLite: sqlite://./payroll.db

# Stable Testnet
STABLE_RPC_URL=https://rpc.testnet.stable.xyz
USDT_CONTRACT_ADDRESS=0x0000000000000000000000000000000000001000

# Wallets (TESTNET ONLY!)
EMPLOYER_PRIVATE_KEY=0x...
OFFRAMP_PRIVATE_KEY=0x...

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Server
PORT=3000
NODE_ENV=development

# CORS
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,https://your-domain.vercel.app
```

Chạy backend:
```bash
npm run dev
```

### Frontend Setup

```bash
cd frontend
npm install
```

Tạo file `.env` trong `frontend/`:
```env
VITE_API_URL=http://localhost:3000
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

Chạy frontend:
```bash
npm run dev
```

### Development URLs
- Backend: http://localhost:3000
- Frontend: http://localhost:5173 (Vite default)

---

## 2. Environment Setup

### File `.env` trong `backend/`

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/payroll_db
# Hoặc SQLite: sqlite://./payroll.db

# Stable Testnet
STABLE_RPC_URL=https://rpc.testnet.stable.xyz
USDT_CONTRACT_ADDRESS=0x0000000000000000000000000000000000001000

# Wallets (TESTNET ONLY!)
EMPLOYER_PRIVATE_KEY=0x...
OFFRAMP_PRIVATE_KEY=0x...

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Server
PORT=3000
NODE_ENV=development
```

### Lưu Ý Quan Trọng:
1. **KHÔNG commit file `.env` vào git** - đã có trong `.gitignore`
2. **Chỉ dùng testnet keys** - không dùng mainnet private keys
3. **Stripe test mode** - chỉ hoạt động với test bank accounts (`ba_test_xxx`)
4. **Database** - có thể dùng SQLite cho development (đơn giản hơn PostgreSQL)

---

## 3. Stripe Integration

### 2.1. Stripe CLI Setup

**Cài đặt:**
```bash
# Linux/WSL - Download từ: https://github.com/stripe/stripe-cli/releases
# Hoặc:
curl -s https://packages.stripe.com/api/security/keypair/stripe-cli-gpg/public | gpg --dearmor | sudo tee /usr/share/keyrings/stripe.gpg
echo "deb [signed-by=/usr/share/keyrings/stripe.gpg] https://packages.stripe.com/stripe-cli-debian-local stable main" | sudo tee -a /etc/apt/sources.list.d/stripe.list
sudo apt update
sudo apt install stripe
```

**Login:**
```bash
stripe login
```

**Forward Webhook (Development):**
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Webhook signing secret sẽ hiển thị (bắt đầu với `whsec_...`). Copy vào `.env`:
```env
STRIPE_WEBHOOK_SECRET=whsec_...
```

### 2.2. Platform Account vs Connected Account

**Platform Account:**
- Tài khoản Stripe chính của bạn
- Account ID: `acct_1SZ2yNLcdcGA3J2H`
- API Key: `STRIPE_SECRET_KEY` (từ `.env`)
- Vai trò: Nhận payments, quản lý balance, transfer funds

**Connected Account:**
- Tài khoản con cho từng user/employee
- Account ID: `acct_xxx` (ví dụ: `acct_1Sa6f3LcDsl6GGq8`)
- Vai trò: Nhận payout, có bank account riêng
- Type: Custom (cho phép programmatic activation)
- **⚠️ QUAN TRỌNG - Currency & Country:**
  - Connected Account US chỉ nhận payout USD
  - Để payout EUR → Tạo Connected Account ở quốc gia châu Âu (DE, FR, NL, etc.) và thêm bank account EUR
  - Để payout JPY → Tạo Connected Account ở Japan (JP) và thêm bank account JPY
  - Để payout VND → Tạo Connected Account ở Vietnam (VN) và thêm bank account VND
  - **Mỗi Connected Account chỉ có thể nhận payout bằng currency của country đó**

### 2.3. Stripe Connect Setup (Multi-Currency Accounts)

**Script:** `backend/src/scripts/create-multi-currency-account.ts` ⭐ (Khuyến nghị)

**Usage:**
```bash
# USD (US account)
npx tsx src/scripts/create-multi-currency-account.ts <email> "<name>" usd US

# EUR (European account - ví dụ: Germany)
npx tsx src/scripts/create-multi-currency-account.ts <email> "<name>" eur DE

# JPY (Japan account)
npx tsx src/scripts/create-multi-currency-account.ts <email> "<name>" jpy JP
```

**Script cũ (vẫn hoạt động):** `backend/src/scripts/create-connected-account-with-bank.ts`

**⚠️ QUAN TRỌNG - Currency & Country Rules:**
- **Connected Account US chỉ nhận payout USD**
- **Để payout EUR → Tạo Connected Account ở quốc gia châu Âu (DE, FR, NL, etc.) và thêm bank account EUR**
- **Để payout JPY → Tạo Connected Account ở Japan (JP) và thêm bank account JPY**
- **Để payout VND → Tạo Connected Account ở Vietnam (VN) và thêm bank account VND**
- **Mỗi Connected Account chỉ có thể nhận payout bằng currency của country đó**

**⚠️ QUAN TRỌNG - Cross-Border Transfers (Recipient Service Agreement):**
- **Non-US Connected Accounts** cần `service_agreement: 'recipient'` để hỗ trợ cross-border transfers
- Platform Account (US) có thể transfer funds đến Connected Accounts ở nước ngoài (EUR, JPY) nếu account dùng `recipient` service agreement
- Script `create-multi-currency-account.ts` tự động set `recipient` service agreement cho non-US accounts
- Flow hoạt động:
  1. Platform Account transfer EUR/USD/JPY → Connected Account (cross-border)
  2. Connected Account payout → Bank Account (cùng currency)
- ✅ **Đã test thành công:** EUR payout flow với recipient service agreement

**Test Tokens:**
- Address: `'address_full_match'` - Enable charges & payouts
- DOB: `{day: 1, month: 1, year: 1901}` - Test DOB
- SSN: `'0000'` và `id_number: '000000000'` - Test SSN (chỉ cho US accounts)
- Business URL: `'https://accessible.stripe.com'` - Test URL
- MCC: `'5734'` - Valid MCC
- TOS IP: `'8.8.8.8'` - Simulate TOS acceptance
- Bank Account: 
  - USD: `'000999999991'` (routing: `'110000000'`) - Auto-verifies sau 1-2 phút
  - EUR: IBAN format (ví dụ: `DE89370400440532013000`)
  - JPY: Account number format
  - VND: Account number format (có thể không hỗ trợ đầy đủ trong test mode)

### 2.4. Test Cards

**Successful Payment:**
- Card: `4242 4242 4242 4242`
- Expiry: `12/34` (bất kỳ ngày tương lai)
- CVC: `123` (bất kỳ 3 số)
- ZIP: `12345` (bất kỳ 5 số)

**Instant Available Balance:**
- Card: `4000000000000077` ⭐ (tạo available balance ngay, không pending)

### 2.5. Thêm Balance vào Platform Account

**Cách 1: Stripe Dashboard với Instant Available Balance ⭐ (Khuyến nghị)**

Để có **Available balance ngay lập tức** (không pending):

1. Vào: https://dashboard.stripe.com/test/payments
2. Click **"Create payment"** hoặc **"+ New"**
3. Điền thông tin:
   - **Amount**: $100 (hoặc số tiền bạn muốn)
   - **Currency**: USD
   - **Payment method**: Click "Add payment method" → Chọn "Card"
   - **Card Number**: `4000000000000077` ⭐ (Instant available balance)
   - **Expiry**: `12/34` (bất kỳ ngày tương lai)
   - **CVC**: `123` (bất kỳ 3 số)
   - **ZIP**: `12345` (bất kỳ 5 số)
4. Click **"Create payment"**
5. Balance sẽ là **Available** ngay (không pending)

**Lưu ý:** Card `4000000000000077` tạo available balance ngay lập tức, khác với card `4242 4242 4242 4242` (có thể pending vài phút).

**Cách 2: Script (Pending Balance)**
```bash
npx tsx src/scripts/create-test-payment.ts 100
```
⚠️ Script này dùng `tok_visa` và có thể tạo **pending balance** (không available ngay).

**Cách 3: Stripe CLI**
```bash
stripe charges create \
  --amount=10000 \
  --currency=usd \
  --source=tok_visa \
  --description="Test payment"
```
⚠️ Cũng có thể tạo pending balance.

---

## 4. Blockchain Integration

### 3.1. gUSDT Contract

- **Address:** `0x0000000000000000000000000000000000001000`
- **Symbol:** gUSDT
- **Decimals:** 18
- **Type:** Native gas token on Stable Testnet

### 3.2. Off-Ramp Wallet

- **Address:** `0x0dc5d0F55072BDaC9a53888cDDDec39f66F02dCc`
- **Balance:** Cần duy trì đủ để transfer cho users
- **Vai trò:** Nhận USDT từ employees (cashout), chuyển USDT cho users (on-ramp)

### 3.3. RPC Configuration

- **RPC URL:** `https://rpc.testnet.stable.xyz`
- **Network:** Stable Testnet
- **Chain ID:** 10143 (Monad testnet)

### 3.4. Retry Logic

RPC có thể trả về 502 Bad Gateway. Đã implement retry logic:
- Tự động retry 3 lần
- Exponential backoff: 2s, 4s, 6s
- Chỉ retry các lỗi có thể retry (502, 503, timeout)
- Không retry các lỗi không thể retry (insufficient balance, invalid address)

**Code Location:**
- `backend/src/utils/blockchain.ts` - `transferUSDTFromOfframp()`

---

## 5. Database Schema

### Tables

1. **employees**
   - `id`, `wallet_address`, `name`, `email`, `country`, `stripe_bank_account_id`, `created_at`, `updated_at`

2. **payrolls**
   - `id`, `payroll_id`, `employer_address`, `employee_address`, `amount_usdt`, `status`, `tx_hash`, `block_number`, `created_at`, `updated_at`

3. **cashouts**
   - `id`, `employee_address`, `amount_usdt`, `fiat_currency`, `fiat_amount`, `exchange_rate`, `tx_hash_onchain`, `payout_id_stripe`, `stripe_bank_account_id`, `status`, `error_message`, `created_at`, `updated_at`, `completed_at`

4. **payments**
   - `id`, `payment_intent_id`, `wallet_address`, `amount_fiat`, `amount_usdt`, `currency`, `tx_hash`, `block_number`, `status`, `created_at`, `updated_at`, `completed_at`

5. **exchange_rates**
   - `id`, `from_currency`, `to_currency`, `rate`, `source`, `timestamp`

---

## 6. API Endpoints

### Payment (On-Ramp)
- `POST /api/payment/create-intent` - Tạo payment intent
- `GET /api/payment/status/:paymentIntentId` - Check payment status
- `GET /api/payment/history/:walletAddress` - Get payment history
- `GET /api/payment/offramp-balance` - Check offramp wallet balance

### Cashout (Off-Ramp)
- `POST /api/cashout/request` - Request cashout
- `GET /api/cashout/balance/:address` - Get USDT balance
- `GET /api/cashout/history/:address` - Cashout history
- `GET /api/cashout/status/:cashoutId` - Get cashout status

### Webhooks
- `POST /api/webhooks/stripe` - Stripe webhook handler

---

## 7. Frontend Setup

### Tech Stack
- React 18 + TypeScript
- Vite (build tool)
- React Router (routing)
- TanStack React Query (data fetching)
- Axios (API client)
- Tailwind CSS (styling)
- Stripe.js (@stripe/stripe-js, @stripe/react-stripe-js)
- ethers.js (blockchain interaction)

### Project Structure
```
frontend/src/
├── pages/
│   ├── HomePage.tsx          # Overview page
│   ├── OnRampPage.tsx        # Buy Stablecoins page
│   ├── OffRampPage.tsx       # Cashout to Bank page
│   └── AccountPage.tsx       # Account management page
├── components/
│   └── common/
│       ├── Button.tsx
│       ├── Input.tsx
│       └── Loading.tsx
├── services/
│   └── api/
│       ├── config.ts         # Axios instance
│       ├── payment.ts         # Payment API
│       └── cashout.ts         # Cashout API
└── utils/
    └── constants/
        └── index.ts           # API URLs, Stripe keys, blockchain config
```

### Environment Variables
- `VITE_API_URL` - Backend API URL (default: http://localhost:3000)
- `VITE_STRIPE_PUBLISHABLE_KEY` - Stripe publishable key

### Frontend Flow

**On-Ramp (Buy) Flow:**
```
User Input (Amount, Currency, Wallet) 
  → Create Payment Intent 
  → Stripe Payment 
  → Webhook → Transfer USDT 
  → Display Success
```

**Off-Ramp (Cashout) Flow:**
```
User Input (Amount, Bank Account) 
  → Connect Wallet 
  → Transfer USDT (on-chain) 
  → Sign Message 
  → Submit Cashout Request 
  → Display Status
```

**Account Management Flow:**
```
Create Account → Stripe Connected Account + Bank Account → Save to localStorage
Import Account → Manual entry → Save to localStorage
```

---

## 8. Test Scripts

### On-Ramp Scripts
- `test-stripe.ts` - Test Stripe connection
- `test-blockchain.ts` - Test blockchain functions
- `test-exchange-rate.ts` - Test exchange rate
- `check-offramp-wallet.ts` - Check wallet balance
- `check-gusdt-contract.ts` - Verify contract
- `trigger-payment-webhook.ts` - Manually trigger webhook
- `test-api.ts` - Full API test suite

### Off-Ramp Scripts
- `create-connected-account-with-bank.ts` - Setup Connected Account
- `test-payout-connected-account.ts` - Test payout flow
- `create-test-payment.ts` - Create platform balance
- `check-platform-account.ts` - Check platform account
- `create-instant-balance.ts` - Guide tạo instant balance

### Utility Scripts
- `init-db.ts` - Initialize database

**Xem chi tiết:** `backend/SCRIPTS_REVIEW.md`

---

## 9. Known Issues & Solutions

### 7.1. RPC 502 Bad Gateway Error

**Vấn đề:** RPC endpoint đôi khi trả về 502 Bad Gateway

**Giải pháp:** ✅ Đã thêm retry logic với exponential backoff

### 7.2. Webhook Setup (Development)

**Vấn đề:** Backend chạy trên localhost → Stripe không thể gửi webhook trực tiếp

**Giải pháp:** 
- ✅ Stripe CLI để forward webhook
- ✅ Script `trigger-payment-webhook.ts` để manually trigger

### 7.3. Card Element Not Rendering

**Vấn đề:** Card element không hiển thị form

**Giải pháp:** ✅ Fixed JavaScript syntax, thêm CSP configuration

### 7.4. Amount Type Conversion

**Vấn đề:** Database trả về `amount_usdt` là number, nhưng `transferUSDTFromOfframp()` cần string

**Giải pháp:** ✅ Convert to string trong webhook handler

### 7.5. Insufficient Balance trong Connected Account

**Vấn đề:** Connected Account có $0 balance, không thể payout

**Giải pháp:** ✅ Transfer từ Platform Account → Connected Account trước khi payout

---

## 10. Code Notes

### 8.1. Important Files

**Controllers:**
- `backend/src/controllers/paymentController.ts` - Payment Intent handling
- `backend/src/controllers/cashoutController.ts` - Cashout request handling
- `backend/src/controllers/webhookController.ts` - Stripe webhook handling

**Services:**
- `backend/src/services/paymentService.ts` - Payment database operations
- `backend/src/services/cashoutService.ts` - Cashout database operations
- `backend/src/services/exchangeRateService.ts` - Exchange rate với caching

**Utils:**
- `backend/src/utils/stripe.ts` - Stripe functions (createPaymentIntent, createPayout)
- `backend/src/utils/blockchain.ts` - Blockchain functions (transferUSDT, getBalance)

**Config:**
- `backend/src/config/stripe.ts` - Stripe client initialization
- `backend/src/config/blockchain.ts` - Blockchain RPC và contract setup

### 8.2. Test Tokens & Values

**Stripe Test Tokens (Custom Accounts):**
- `address_full_match` - Auto-verify address
- DOB: `1901-01-01` - Test DOB
- SSN: `0000` (last 4), `000000000` (full) - Test SSN
- Business URL: `https://accessible.stripe.com` - Test URL
- MCC: `5734` - Valid MCC
- TOS IP: `8.8.8.8` - Simulate TOS acceptance
- Bank Account: `000999999991` - Auto-verifies sau 1-2 phút

### 8.3. Flow Diagrams

**On-Ramp Flow:**
```
User → VISA Payment → Stripe → Webhook → Backend → Transfer USDT → User Wallet
```

**Off-Ramp Flow:**
```
User → Transfer USDT (on-chain) → Off-Ramp Wallet → Backend → Stripe Payout → Bank Account
```

**Off-Ramp với Connected Account:**
```
User → Transfer USDT → Off-Ramp Wallet
Backend → Transfer Funds (Platform → Connected Account)
Backend → Payout (Connected Account → Bank Account)
```

---

## 11. Flow Diagrams

### On-Ramp Flow (VISA → USDT)
```
User → VISA Payment → Stripe → Webhook → Backend → Transfer USDT → User Wallet
```

### Off-Ramp Flow (USDT → Fiat)
```
User → Transfer USDT (on-chain) → Off-Ramp Wallet → Backend → Stripe Payout → Bank Account
```

### Off-Ramp với Connected Account
```
User → Transfer USDT → Off-Ramp Wallet
Backend → Transfer Funds (Platform → Connected Account)
Backend → Payout (Connected Account → Bank Account)
```

### Payroll Flow (Employer → Employee)
```
Employer → Prepare Payroll → Execute Transaction (on-chain) → Employees Receive USDT
```

---

## 12. Troubleshooting

### Stripe CLI không tìm thấy
```bash
export PATH="$HOME/.local/bin:$PATH"
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

### Webhook không được nhận
1. Kiểm tra backend server đang chạy trên port 3000
2. Kiểm tra `stripe listen` đang chạy
3. Kiểm tra `STRIPE_WEBHOOK_SECRET` trong `.env` đúng

### Balance đang Pending (không Available)
- Dùng test card đặc biệt: `4000000000000077` để tạo instant available balance
- Hoặc đợi pending balance settle (vài phút)

### Charges/Payouts không Enabled
- Check Dashboard: https://dashboard.stripe.com/test/account
- Activate account để enable charges/payouts
- Với Custom accounts: Dùng test tokens để bypass verification

### 9.1. Test Cards

**Successful Payment:**
- `4242 4242 4242 4242` - Visa, thành công ✅
- `5555 5555 5555 4444` - Mastercard, thành công ✅

**Instant Available Balance:**
- `4000000000000077` ⭐ - Tạo available balance ngay (không pending)

**Decline Scenarios:**
- `4000 0000 0000 0002` - Card declined
- `4000 0000 0000 9995` - Insufficient funds
- `4000 0025 0000 3155` - Requires authentication (3D Secure)

**Test Tokens:**
- `tok_visa` - Successful payment (tạo pending balance)
- `tok_instant` - Instant available balance (nếu được hỗ trợ)

### 9.2. Test Bank Account Numbers

**Routing Number:** `110000000` (test routing number)

**Account Numbers:**
- `000123456789` - Payout thành công ✅
- `000999999991` - Auto verify (test mode) ✅
- `000111111116` - Payout thất bại (no_account)
- `000111111113` - Payout thất bại (account_closed)
- `000222222227` - Payout thất bại (insufficient_funds)
- `000333333335` - Payout thất bại (debit_not_authorized)
- `000444444440` - Payout thất bại (invalid_currency)

### 9.3. Common Error Messages

**"You have insufficient available funds"**
- Platform Account balance đang ở trạng thái Pending
- Giải pháp: Dùng test card `4000000000000077` để tạo instant available balance

**"Received unknown parameter: on_behalf_of"**
- `on_behalf_of` không phải parameter hợp lệ cho payout API
- Giải pháp: Transfer từ Platform Account → Connected Account trước, sau đó payout từ Connected Account

**"You cannot add cards or bank accounts for payouts"**
- Standard account không cho phép tạo external account qua API
- Giải pháp: Dùng Connected Accounts (Custom hoặc Express)

**"Charges not enabled"**
- Account chưa được activate
- Giải pháp: Activate account trong Dashboard hoặc dùng test tokens với Custom accounts

---

## 13. Quick Reference

### Commands

```bash
# Stripe CLI
export PATH="$HOME/.local/bin:$PATH"
stripe login
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Test Scripts
npm run test:api
npm run test:blockchain
npm run test:stripe
npm run test:exchange-rate

# Database
npm run init-db

# Create Connected Account + Bank Account
npx tsx src/scripts/create-connected-account-with-bank.ts full <email> "<name>" <accountNumber> custom

# Test Payout
npx tsx src/scripts/test-payout-connected-account.ts <connectedAccountId> <bankAccountId> <amount>

# Check Platform Account
npx tsx src/scripts/check-platform-account.ts

# Create Test Payment
npx tsx src/scripts/create-test-payment.ts <amount>
```

### Important URLs

- Stripe Dashboard: https://dashboard.stripe.com/test
- Platform Account Balance: https://dashboard.stripe.com/test/balance/overview
- Payments: https://dashboard.stripe.com/test/payments
- Payouts: https://dashboard.stripe.com/test/payouts
- Connected Accounts: https://dashboard.stripe.com/test/connect/accounts/overview
- Webhooks: https://dashboard.stripe.com/test/webhooks

---

## 14. Production Checklist

- [ ] Setup PostgreSQL cho production
- [ ] Deploy backend với public URL
- [ ] Cấu hình webhook trong Stripe Dashboard (production mode)
- [ ] Environment variables cho production
- [ ] SSL certificate
- [ ] Monitoring và logging
- [ ] Rate limiting configuration
- [ ] Security headers (CORS, CSP, etc.)

