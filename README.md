# StablePay - Payroll App

A payroll application that allows purchasing stablecoins with VISA/Mastercard and withdrawing funds to bank accounts via Stripe. All transactions are executed on Stable Testnet with gUSDT tokens.

## 📋 Overview

**StablePay** is a web application that enables:
- **On-Ramp (Buy)**: Purchase USDT with VISA/Mastercard, receive USDT directly to wallet
- **Off-Ramp (Cashout)**: Withdraw USDT to bank account via Stripe
- **Account Management**: Manage bank accounts and transaction history

**Blockchain**: Stable Testnet (gUSDT)  
**Payment Gateway**: Stripe  
**Status**: ✅ Backend Completed | ⏳ Frontend In Progress

---

## ✨ Features

### On-Ramp (Buy Stablecoins)
- ✅ Purchase USDT with VISA/Mastercard
- ✅ Automatic exchange rates (USD, EUR → USDT)
- ✅ Receive USDT directly to wallet on Stable Testnet
- ✅ Transaction history

### Off-Ramp (Cashout to Bank)
- ✅ Withdraw USDT to bank account
- ✅ Multi-currency support (USD, EUR)
- ✅ MetaMask wallet connection
- ✅ Transaction verification with signature

### Account Management
- ✅ Create new bank account
- ✅ Manual account import
- ✅ Manage multiple accounts
- ✅ View account balance

---

## 🛠 Tech Stack

### Backend
- **Runtime**: Node.js + TypeScript
- **Framework**: Express.js
- **Database**: SQLite (dev) / PostgreSQL (production)
- **Blockchain**: ethers.js (Stable Testnet)
- **Payment**: Stripe SDK
- **Security**: Helmet, CORS, Rate Limiting

### Frontend
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Routing**: React Router
- **State Management**: TanStack React Query
- **Styling**: Tailwind CSS
- **Payment**: Stripe.js
- **Blockchain**: ethers.js

---

## 📁 Project Structure

```
stable/
├── backend/
│   ├── src/
│   │   ├── config/          # Configuration files
│   │   ├── controllers/     # API controllers
│   │   ├── services/        # Business logic
│   │   ├── models/          # Data models
│   │   ├── routes/          # API routes
│   │   ├── middleware/      # Express middleware
│   │   ├── utils/           # Utility functions
│   │   ├── scripts/         # Test scripts
│   │   └── server.ts        # Entry point
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── pages/           # Page components
│   │   ├── components/      # Reusable components
│   │   ├── services/        # API services
│   │   ├── utils/           # Utilities
│   │   ├── App.tsx          # Main app component
│   │   └── main.tsx         # Entry point
│   ├── package.json
│   └── vite.config.ts
│
├── PROGRESS.md              # Project progress
├── TECHNICAL_NOTES.md       # Technical notes
└── README.md                # This file
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Git
- MetaMask extension (for frontend)
- Stripe account (test mode)

### 1. Clone Repository

```bash
git clone <repository-url>
cd stable
```

### 2. Setup Backend

```bash
cd backend
npm install
```

Create `.env` file in `backend/`:

```env
# Database
DATABASE_URL=sqlite://./payroll.db

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
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

Initialize database:

```bash
npm run init-db
```

Run backend:

```bash
npm run dev
```

Backend will run at: http://localhost:3000

### 3. Setup Frontend

```bash
cd frontend
npm install
```

Create `.env` file in `frontend/`:

```env
VITE_API_URL=http://localhost:3000
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

Run frontend:

```bash
npm run dev
```

Frontend will run at: http://localhost:5173

### 4. Setup Stripe CLI (Development)

To receive webhooks in development:

```bash
# Install Stripe CLI
curl -s https://packages.stripe.com/api/security/keypair/stripe-cli-gpg/public | gpg --dearmor | sudo tee /usr/share/keyrings/stripe.gpg
echo "deb [signed-by=/usr/share/keyrings/stripe.gpg] https://packages.stripe.com/stripe-cli-debian-local stable main" | sudo tee -a /etc/apt/sources.list.d/stripe.list
sudo apt update
sudo apt install stripe

# Login
stripe login

# Forward webhooks
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Copy webhook signing secret to backend `.env`.

---

## 📡 API Endpoints

### Payment (On-Ramp)
- `POST /api/payment/create-intent` - Create payment intent
- `GET /api/payment/status/:paymentIntentId` - Check payment status
- `GET /api/payment/history/:walletAddress` - Payment history
- `GET /api/payment/exchange-rate?currency=USD` - Get exchange rate
- `GET /api/payment/offramp-balance` - Offramp wallet balance

### Cashout (Off-Ramp)
- `POST /api/cashout/request` - Request cashout
- `GET /api/cashout/balance/:address` - USDT balance
- `GET /api/cashout/history/:address` - Cashout history
- `GET /api/cashout/status/:cashoutId` - Cashout status
- `GET /api/cashout/bank-account-balance/:bankAccountId` - Bank account balance
- `GET /api/cashout/platform-balance` - Platform account balance

### Bank Account
- `POST /api/cashout/create-bank-account` - Create bank account

### Webhooks
- `POST /api/webhooks/stripe` - Stripe webhook handler

### Health
- `GET /health` - Health check

See detailed API documentation in `TECHNICAL_NOTES.md`.

---

## 🔧 Development

### Backend Scripts

```bash
# Development
npm run dev

# Build
npm run build

# Start production
npm start

# Initialize database
npm run init-db

# Test scripts
npm run test:api
npm run test:blockchain
npm run test:stripe
npm run test:exchange-rate
```

### Frontend Scripts

```bash
# Development
npm run dev

# Build
npm run build

# Preview production build
npm run preview

# Lint
npm run lint
```

### Test Cards (Stripe Test Mode)

**Successful Payment:**
- Card: `4242 4242 4242 4242`
- Expiry: `12/34` (any future date)
- CVC: `123`
- ZIP: `12345`

**Instant Available Balance:**
- Card: `4000000000000077` ⭐

---

## 🌐 Blockchain Configuration

### Stable Testnet
- **RPC URL**: `https://rpc.testnet.stable.xyz`
- **Chain ID**: `2201` (0x899 in hex)
- **gUSDT Contract**: `0x0000000000000000000000000000000000001000`
- **Decimals**: 18
- **Explorer**: `https://testnet-explorer.stable.xyz`

### Wallets
- **Off-Ramp Wallet**: Receives USDT from users (cashout), sends USDT to users (on-ramp)
- **Employer Wallet**: Sends payroll to employees

---

## 🔐 Security

- ✅ Message signing verification for cashout requests
- ✅ Transaction verification on-chain
- ✅ Webhook signature verification
- ✅ Rate limiting
- ✅ CORS configuration
- ✅ Helmet security headers
- ✅ Input validation

**⚠️ Important Notes:**
- DO NOT commit private keys to git
- Only use testnet wallets and keys
- Stripe test mode only works with test bank accounts

---

## 📦 Deployment

### Backend (VPS)

1. **Setup Node.js on VPS**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

2. **Clone and build**
   ```bash
   git clone <repo>
   cd stable/backend
   npm install
   npm run build
   ```

3. **Setup environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with production values
   ```

4. **Run with PM2**
   ```bash
   npm install -g pm2
   pm2 start dist/server.js --name stablepay-backend
   pm2 save
   ```

5. **Setup Nginx reverse proxy** (optional)
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

### Frontend (Vercel)

1. **Connect repository** to Vercel
2. **Set environment variables**:
   - `VITE_API_URL`: Backend API URL (e.g., ngrok URL for local backend)
   - `VITE_STRIPE_PUBLISHABLE_KEY`: Stripe publishable key
3. **Deploy**

**Note**: When using ngrok for local backend, add `ngrok-skip-browser-warning: true` header to bypass warning page.

---

## 📚 Documentation

- **PROGRESS.md**: Project progress and completion status
- **TECHNICAL_NOTES.md**: Detailed technical notes, setup guides, troubleshooting

---

## 🧪 Testing

### Backend Tests

```bash
# Test API endpoints
npm run test:api

# Test blockchain connection
npm run test:blockchain

# Test Stripe integration
npm run test:stripe

# Test exchange rate service
npm run test:exchange-rate
```

### Frontend Testing

Use test cards from Stripe test mode to test payment flow.

---

## 🐛 Troubleshooting

### Backend cannot connect to RPC
- Check `STABLE_RPC_URL` in `.env`
- Check network connection
- RPC may return 502/503, retry logic is implemented

### Webhooks not received
- Check Stripe CLI is running
- Check `STRIPE_WEBHOOK_SECRET` is correct
- Check backend server is running on port 3000

### Frontend cannot connect to API
- Check `VITE_API_URL` in `.env`
- Check CORS configuration in backend
- Check backend server is running
- If using ngrok, ensure warning page is bypassed (header `ngrok-skip-browser-warning: true`)

### Exchange rate shows "0.00" or "NaN"
- Check ngrok URL is accessible
- Check backend exchange rate API is working
- Check browser console for errors
- Verify `ngrok-skip-browser-warning` header is set

See more troubleshooting in `TECHNICAL_NOTES.md`.

---

## 📝 License

ISC

---

## 👥 Contributing

1. Fork repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

---

## 📞 Support

For more information, see:
- `PROGRESS.md` - Project progress
- `TECHNICAL_NOTES.md` - Detailed technical notes

---

**Last Updated**: 2025-01-03  
**Version**: 1.0.0
