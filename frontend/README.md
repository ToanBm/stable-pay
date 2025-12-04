# Frontend Setup Guide

## Completed Features

✅ **On-Ramp Page** (`/on-ramp`)
- Payment form with Stripe Card Element
- Real-time balance checking
- Payment status tracking
- Payment history
- Transaction explorer links

✅ **API Services**
- Payment API (`/services/api/payment.ts`)
- Cashout API (`/services/api/cashout.ts`)

✅ **Common Components**
- Button, Input, Loading

✅ **Routing & Navigation**
- React Router setup
- Navigation bar

## Installation

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Create .env File

Create `.env` file in `frontend/` directory:

```env
VITE_API_URL=http://localhost:3000
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_51SZ2yNLcdcGA3J2H27Agez2LwkvUQYVPUptJgZxZipJbeRYCUuJCEvMhjfNaYTvLH9bh39sojroFtkDRQOHezwx500N37EHR9T
VITE_STABLE_RPC_URL=https://rpc.testnet.stable.xyz
VITE_USDT_CONTRACT_ADDRESS=0x0000000000000000000000001000
```

**Note**: For Vercel deployment, set `VITE_API_URL` to your ngrok URL or production backend URL.

### 3. Run Development Server

```bash
npm run dev
```

Frontend will run at: `http://localhost:5173`

## Test On-Ramp Flow

1. Open `http://localhost:5173/on-ramp`
2. Enter information:
   - Amount: 100
   - Currency: USD or EUR
   - Wallet Address: `0x0dc5d0F55072BDaC9a53888cDDDec39f66F02dCc` (or your wallet)
3. Enter test card:
   - Card: `4242 4242 4242 4242`
   - Expiry: `12/34`
   - CVC: `123`
   - ZIP: `12345`
4. Click "Pay with Card"
5. Wait for payment processing and USDT transfer

## File Structure

```
frontend/
├── src/
│   ├── components/
│   │   └── common/
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       └── Loading.tsx
│   ├── pages/
│   │   ├── HomePage.tsx
│   │   ├── OnRampPage.tsx
│   │   └── OffRampPage.tsx
│   ├── services/
│   │   └── api/
│   │       ├── config.ts
│   │       ├── payment.ts
│   │       └── cashout.ts
│   ├── utils/
│   │   ├── constants/
│   │   └── validation/
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── index.html
├── vite.config.ts
├── vercel.json
└── package.json
```

## Deployment (Vercel)

1. **Connect repository** to Vercel
2. **Set environment variables**:
   - `VITE_API_URL`: Backend API URL (ngrok URL for local backend)
   - `VITE_STRIPE_PUBLISHABLE_KEY`: Stripe publishable key
3. **Deploy**

**Important**: When using ngrok for local backend, the API client automatically includes `ngrok-skip-browser-warning: true` header to bypass warning page.

## Next Steps

- [x] Implement On-Ramp page with Stripe integration
- [x] Add exchange rate display
- [x] Add payment status polling
- [ ] Implement Off-Ramp page with wallet connection
- [ ] Improve error handling
- [ ] Add responsive design improvements

## Notes

- Ensure backend is running at `http://localhost:3000` (or ngrok URL)
- Stripe webhook needs to be forwarded to backend
- Use test mode keys for development
- For Vercel deployment with local backend, use ngrok to expose backend
