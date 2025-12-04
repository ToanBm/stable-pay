import React, { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ethers } from 'ethers';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { 
  requestCashout,
  type RequestCashoutRequest,
} from '@/services/api/cashout';
import { 
  type CashoutCurrency, 
  USDT_CONTRACT_ADDRESS,
  OFF_RAMP_ADDRESS,
} from '@/utils/constants';

// Type declaration for window.ethereum
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      isMetaMask?: boolean;
    };
  }
}

interface BankAccount {
  bankAccountId: string;
  connectedAccountId: string;
  currency: string;
  country: string;
  accountHolderName: string;
  createdAt: string;
}

const STORAGE_KEY = 'bank_accounts';

// Load bank accounts from localStorage
const loadBankAccountsFromStorage = (): BankAccount[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to load bank accounts from localStorage:', error);
    return [];
  }
};


const OffRampPage: React.FC = () => {
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);

  // Cashout form fields
  const [selectedBankAccount, setSelectedBankAccount] = useState<BankAccount | null>(null);
  const [cashoutAmount, setCashoutAmount] = useState('');
  const [cashoutCurrency, setCashoutCurrency] = useState<CashoutCurrency>('USD');
  const [walletAddress, setWalletAddress] = useState('');
  const [txHash, setTxHash] = useState('');
  const [signature, setSignature] = useState('');
  const [cashoutMessage, setCashoutMessage] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  
  // USDT Contract ABI (ERC20 standard)
  const USDT_ABI = [
    'function balanceOf(address owner) view returns (uint256)',
    'function transfer(address to, uint256 amount) returns (bool)',
    'function decimals() view returns (uint8)',
  ];

  // Load bank accounts from localStorage on mount
  useEffect(() => {
    const saved = loadBankAccountsFromStorage();
    if (saved && Array.isArray(saved)) {
      setBankAccounts(saved);
    }
  }, []);

  // Cashout mutation
  const cashoutMutation = useMutation({
    mutationFn: (data: RequestCashoutRequest) => requestCashout(data),
    onSuccess: (data) => {
      if (data.existing) {
        toast.success(`Cashout already exists! Status: ${data.status}. ${data.message || ''}`);
      } else {
        toast.success(`Cashout request successful! Payout ID: ${data.payoutId || 'Pending'}`);
      }
      
      // Reset form
      setSelectedBankAccount(null);
      setCashoutAmount('');
      setCashoutCurrency('USD');
      setWalletAddress('');
      setTxHash('');
      setSignature('');
      setCashoutMessage('');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to request cashout');
    },
  });

  // Connect wallet function
  const handleConnectWallet = async () => {
    if (typeof window.ethereum === 'undefined') {
      toast.error('MetaMask is not installed. Please install MetaMask extension.');
      return;
    }

    setIsConnecting(true);
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (accounts && accounts.length > 0) {
        setWalletAddress(accounts[0]);
        toast.success('Wallet connected!');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  // Transfer USDT function
  const handleTransferUSDT = async () => {
    if (!walletAddress) {
      toast.error('Please connect wallet first');
      return;
    }

    if (!cashoutAmount || parseFloat(cashoutAmount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (typeof window.ethereum === 'undefined') {
      toast.error('MetaMask is not installed');
      return;
    }

    setIsTransferring(true);
    try {
      // Connect to provider
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      // Use default decimals = 18 for gUSDT (skip contract call to avoid errors)
      const decimals = 18;
      
      // Convert amount to wei (with decimals)
      const amountWei = ethers.parseUnits(cashoutAmount, decimals);
      
      // Get USDT contract
      const usdtContract = new ethers.Contract(USDT_CONTRACT_ADDRESS, USDT_ABI, signer);
      
      // Skip balance check - let blockchain handle insufficient balance error
      // This avoids BAD_DATA errors if contract doesn't exist on wrong network
      
      // Transfer USDT
      toast.loading('Please confirm the transaction in MetaMask...', { id: 'transfer' });
      const tx = await usdtContract.transfer(OFF_RAMP_ADDRESS, amountWei);
      
      toast.loading('Transaction submitted. Waiting for confirmation...', { id: 'transfer' });
      
      // Wait for transaction to be mined
      const receipt = await tx.wait();
      
      // Set TX hash
      setTxHash(receipt.hash);
      
      toast.success(`Transfer successful! TX Hash: ${receipt.hash.substring(0, 10)}...`, { id: 'transfer' });
      
      // Auto-generate and sign message after successful transfer
      setTimeout(() => {
        handleSignMessage();
      }, 1000);
      
    } catch (error: any) {
      console.error('Transfer error:', error);
      
      if (error.code === 4001) {
        toast.error('User rejected the transaction', { id: 'transfer' });
      } else if (error.code === 'INSUFFICIENT_FUNDS' || error.message?.includes('insufficient funds')) {
        toast.error('Insufficient funds for transaction or gas fee', { id: 'transfer' });
      } else if (error.message?.includes('execution reverted') || error.message?.includes('insufficient balance')) {
        toast.error('Insufficient USDT balance in your wallet', { id: 'transfer' });
      } else if (error.message?.includes('BAD_DATA') || error.message?.includes('could not decode')) {
        toast.error('Contract error. Please ensure you\'re connected to Stable Testnet. Contract address may not exist on this network.', { id: 'transfer' });
      } else {
        toast.error(error.message || 'Failed to transfer USDT. Please check your network connection and try again.', { id: 'transfer' });
      }
    } finally {
      setIsTransferring(false);
    }
  };

  // Sign message function
  const handleSignMessage = async () => {
    if (!walletAddress) {
      toast.error('Please connect wallet first');
      return;
    }

    if (!cashoutAmount || !walletAddress) {
      toast.error('Please enter amount and wallet address first');
      return;
    }

    if (typeof window.ethereum === 'undefined') {
      toast.error('MetaMask is not installed');
      return;
    }

    // Generate message
    const timestamp = new Date().toISOString();
    const message = `I request cashout ${cashoutAmount} USDT at ${timestamp}\n\nAddress: ${walletAddress}`;
    setCashoutMessage(message);

    setIsSigning(true);
    try {
      // Use window.ethereum to sign message directly
      const signature = await window.ethereum.request({
        method: 'personal_sign',
        params: [message, walletAddress],
      });
      setSignature(signature);
      toast.success('Message signed successfully!');
    } catch (error: any) {
      if (error.code === 4001) {
        toast.error('User rejected the signature request');
      } else {
        toast.error(error.message || 'Failed to sign message');
      }
    } finally {
      setIsSigning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cashout Request */}
      <div className="w-full md:w-1/2 mx-auto">
        {/* Cashout Form */}
        <div className="bg-white/5 border border-white/10 rounded-lg p-6 backdrop-blur-sm">
          <div className="mb-6">
            <h2 className="text-base font-medium text-white">Cashout to Bank</h2>
          </div>
              
          <div className="space-y-6">
                {/* Bank Account Selection */}
                <div>
                  <label className="block text-xs font-medium text-white mb-1.5 uppercase tracking-wide">Bank Account</label>
                  <select 
                    className="w-full px-3 h-10 bg-[#002315] border border-white/10 rounded-[4px] text-sm text-white focus:border-brand-primary focus:outline-none"
                    value={selectedBankAccount?.bankAccountId || ''}
                    onChange={(e) => {
                      const account = bankAccounts.find(acc => acc.bankAccountId === e.target.value);
                      if (account) {
                        setSelectedBankAccount(account);
                        setCashoutCurrency(account.currency.toUpperCase() as CashoutCurrency);
                      } else {
                        setSelectedBankAccount(null);
                      }
                    }}
                  >
                    <option value="">Select a bank account</option>
                    {bankAccounts.map(acc => (
                      <option key={acc.bankAccountId} value={acc.bankAccountId}>
                        {acc.accountHolderName} ({acc.currency}) - {acc.bankAccountId}
                      </option>
                    ))}
                  </select>
                  {bankAccounts.length === 0 && (
                    <p className="text-xs text-white mt-2">No accounts available. Create one using the buttons above.</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Input 
                    label="Amount" 
                    type="number" 
                    step="0.000001" 
                    value={cashoutAmount} 
                    onChange={e => setCashoutAmount(e.target.value)} 
                    placeholder="0.00"
                  />
                  <div>
                    <label className="block text-xs font-medium text-white mb-1.5 uppercase tracking-wide">Currency</label>
                    <div className="w-full px-3 h-10 bg-[#002315] border border-white/10 rounded-[4px] text-sm text-white flex items-center">
                      {selectedBankAccount ? selectedBankAccount.currency : '-'}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-medium text-white uppercase tracking-wide">Wallet Connection</label>
                  <div className="flex gap-2 items-center">
                    <div className="flex-1">
                      <Input 
                        value={walletAddress} 
                        onChange={e => setWalletAddress(e.target.value)} 
                        placeholder="0x..."
                        className="font-mono text-xs"
                      />
                    </div>
                    <Button variant="secondary" onClick={handleConnectWallet} disabled={!!walletAddress} isLoading={isConnecting} className="h-10">
                      {walletAddress ? 'Connected' : 'Connect'}
                    </Button>
                  </div>
                </div>
          </div>

          {/* Transaction Step */}
          {selectedBankAccount && walletAddress && cashoutAmount && !txHash && (
            <div className="bg-[#0C3223] border border-white/10 rounded-lg p-6 space-y-4 mt-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-6 h-6 rounded-full bg-brand-primary/20 flex items-center justify-center text-xs text-brand-primary font-bold">1</div>
                  <div>
                    <span className="text-xs font-medium text-white uppercase tracking-wide block">Step 1 of 2</span>
                    <span className="text-xs text-brand-primary">Transfer USDT</span>
                  </div>
                </div>
                <p className="text-sm text-white">Transfer <span className="text-white font-medium">{cashoutAmount} USDT</span> to the treasury wallet.</p>
                <div className="bg-black/50 p-3 rounded border border-white/5">
                  <p className="text-xs text-white font-mono break-all">{OFF_RAMP_ADDRESS}</p>
                </div>
              <Button className="w-full" onClick={handleTransferUSDT} isLoading={isTransferring}>Confirm Transfer</Button>
            </div>
          )}

          {/* Signature Step */}
          {selectedBankAccount && txHash && !signature && (
            <div className="bg-[#0C3223] border border-white/10 rounded-lg p-6 space-y-4 mt-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-6 h-6 rounded-full bg-brand-primary/20 flex items-center justify-center text-xs text-brand-primary font-bold">2</div>
                  <div>
                    <span className="text-xs font-medium text-white uppercase tracking-wide block">Step 2 of 2</span>
                    <span className="text-xs text-brand-primary">Sign Message</span>
                  </div>
                </div>
                <p className="text-sm text-white">Sign the cashout request message.</p>
              <Input value={txHash} disabled className="font-mono text-xs text-white" label="TX Hash Confirmed" />
              <Button className="w-full" onClick={handleSignMessage} isLoading={isSigning}>Sign Message</Button>
            </div>
          )}

          {/* Submit Step */}
          {selectedBankAccount && signature && (
            <div className="bg-brand-primary/10 border border-brand-primary/30 rounded-lg p-6 mt-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-6 h-6 rounded-full bg-brand-primary/20 flex items-center justify-center text-xs text-brand-primary font-bold">✓</div>
                <div>
                  <span className="text-xs font-medium text-white uppercase tracking-wide block">Step 2 of 2</span>
                  <span className="text-xs text-brand-primary">Ready to submit</span>
                </div>
              </div>
              <Button 
                className="w-full" 
                onClick={(e) => {
                  e.preventDefault();
                  if (!selectedBankAccount) return;
                  cashoutMutation.mutate({
                     employeeAddress: walletAddress,
                     amount: cashoutAmount,
                     currency: cashoutCurrency.toLowerCase() as 'usd' | 'eur',
                     bankAccountId: selectedBankAccount.bankAccountId,
                     connectedAccountId: selectedBankAccount.connectedAccountId,
                     signature,
                     message: cashoutMessage,
                     txHash,
                  });
                }} 
                isLoading={cashoutMutation.isPending}
              >
                Submit Request
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OffRampPage;