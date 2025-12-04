import { apiClient } from './config';

export interface RequestCashoutRequest {
  employeeAddress: string;
  amount: string;
  currency: 'usd' | 'eur';
  bankAccountId: string;
  connectedAccountId?: string; // Required if bank account belongs to connected account
  signature: string;
  message: string;
  txHash: string;
}

export interface RequestCashoutResponse {
  cashoutId: number;
  status: string;
  payoutId?: string;
  fiatAmount: string;
  currency: string;
  txHash: string;
  message?: string;
  existing?: boolean;
}

export interface CashoutBalanceResponse {
  balance: string;
  currency: string;
  address: string;
}

export interface CashoutHistoryItem {
  id: number;
  employeeAddress: string;
  amountUSDT: string;
  fiatCurrency: string;
  fiatAmount: string;
  exchangeRate: string;
  txHashOnchain: string;
  payoutIdStripe?: string;
  status: string;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
}

export interface CashoutStatusResponse {
  id: number;
  employeeAddress: string;
  amountUSDT: string;
  fiatCurrency: string;
  fiatAmount: string;
  status: string;
  payoutIdStripe?: string;
  txHashOnchain: string;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
}

// Request cashout
export async function requestCashout(
  data: RequestCashoutRequest
): Promise<RequestCashoutResponse> {
  const response = await apiClient.post<RequestCashoutResponse>(
    '/api/cashout/request',
    data
  );
  return response.data;
}

// Get USDT balance
export async function getCashoutBalance(
  address: string
): Promise<CashoutBalanceResponse> {
  const response = await apiClient.get<CashoutBalanceResponse>(
    `/api/cashout/balance/${address}`
  );
  return response.data;
}

// Get cashout history
export async function getCashoutHistory(
  address: string
): Promise<CashoutHistoryItem[]> {
  const response = await apiClient.get<CashoutHistoryItem[]>(
    `/api/cashout/history/${address}`
  );
  return response.data;
}

// Get cashout status
export async function getCashoutStatus(
  cashoutId: number
): Promise<CashoutStatusResponse> {
  const response = await apiClient.get<CashoutStatusResponse>(
    `/api/cashout/status/${cashoutId}`
  );
  return response.data;
}

// Create bank account
export interface CreateBankAccountRequest {
  email: string;
  firstName: string;
  lastName: string;
  currency: 'usd' | 'eur';
  country?: string;
}

export interface CreateBankAccountResponse {
  success: boolean;
  connectedAccountId: string;
  bankAccountId: string;
  currency: string;
  country: string;
  accountHolderName: string;
}

export async function createBankAccount(
  data: CreateBankAccountRequest
): Promise<CreateBankAccountResponse> {
  const response = await apiClient.post<CreateBankAccountResponse>(
    '/api/cashout/create-bank-account',
    data
  );
  return response.data;
}
