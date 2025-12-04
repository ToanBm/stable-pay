import React, { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { 
  createBankAccount, 
  type CreateBankAccountRequest,
} from '@/services/api/cashout';
import { 
  CASHOUT_CURRENCIES, 
  type CashoutCurrency, 
} from '@/utils/constants';

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

// Save bank accounts to localStorage
const saveBankAccountsToStorage = (accounts: BankAccount[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
  } catch (error) {
    console.error('Failed to save bank accounts to localStorage:', error);
  }
};

const AccountPage: React.FC = () => {
  const [formTab, setFormTab] = useState<'create' | 'import'>('create');
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [currency, setCurrency] = useState<CashoutCurrency>('USD');
  const [country, setCountry] = useState('');
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  
  // Manual form fields
  const [manualBankAccountId, setManualBankAccountId] = useState('');
  const [manualConnectedAccountId, setManualConnectedAccountId] = useState('');
  const [manualAccountHolderName, setManualAccountHolderName] = useState('');
  const [manualCurrency, setManualCurrency] = useState<CashoutCurrency>('USD');
  const [manualCountry, setManualCountry] = useState('');

  // Load bank accounts from localStorage on mount
  useEffect(() => {
    const saved = loadBankAccountsFromStorage();
    if (saved && Array.isArray(saved)) {
      setBankAccounts(saved);
    }
  }, []);

  // Create bank account mutation
  const createBankAccountMutation = useMutation({
    mutationFn: (data: CreateBankAccountRequest) => createBankAccount(data),
    onSuccess: (data) => {
      toast.success('Bank account created successfully!');
      
      // Add to local state
      const newAccount: BankAccount = {
        bankAccountId: data.bankAccountId,
        connectedAccountId: data.connectedAccountId,
        currency: data.currency,
        country: data.country,
        accountHolderName: data.accountHolderName,
        createdAt: new Date().toISOString(),
      };
      
      setBankAccounts((prev) => {
        const updated = [...prev, newAccount];
        // Save to localStorage immediately
        saveBankAccountsToStorage(updated);
        return updated;
      });

      // Reset form
      setEmail('');
      setFirstName('');
      setLastName('');
      setCurrency('USD');
      setCountry('');
      setShowForm(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create bank account');
    },
  });

  const handleCreateBankAccount = (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email');
      return;
    }

    if (!firstName || !lastName) {
      toast.error('Please enter first name and last name');
      return;
    }

    createBankAccountMutation.mutate({
      email,
      firstName,
      lastName,
      currency: currency.toLowerCase() as 'usd' | 'eur',
      country: country || undefined,
    });
  };

  const getDefaultCountry = (curr: CashoutCurrency): string => {
    const defaults: Record<CashoutCurrency, string> = {
      USD: 'US',
      EUR: 'DE',
    };
    return defaults[curr] || 'US';
  };

  const handleDeleteBankAccount = (bankAccountId: string) => {
    if (window.confirm('Are you sure you want to delete this bank account?')) {
      setBankAccounts((prev) => {
        const updated = prev.filter((acc) => acc.bankAccountId !== bankAccountId);
        saveBankAccountsToStorage(updated);
        return updated;
      });
      toast.success('Bank account deleted');
    }
  };

  const handleSubmitManualForm = (e: React.FormEvent) => {
    e.preventDefault();

    if (!manualBankAccountId || !manualBankAccountId.startsWith('ba_')) {
      toast.error('Invalid Bank Account ID (must start with ba_)');
      return;
    }

    if (!manualConnectedAccountId || !manualConnectedAccountId.startsWith('acct_')) {
      toast.error('Invalid Connected Account ID (must start with acct_)');
      return;
    }

    if (!manualAccountHolderName) {
      toast.error('Account Holder Name is required');
      return;
    }

    const newAccount: BankAccount = {
      bankAccountId: manualBankAccountId,
      connectedAccountId: manualConnectedAccountId,
      currency: manualCurrency,
      country: manualCountry || getDefaultCountry(manualCurrency),
      accountHolderName: manualAccountHolderName,
      createdAt: new Date().toISOString(),
    };

    setBankAccounts((prev) => {
      const updated = [...prev, newAccount];
      saveBankAccountsToStorage(updated);
      return updated;
    });

    toast.success('Bank account added manually!');
    
    // Reset form
    setManualBankAccountId('');
    setManualConnectedAccountId('');
    setManualAccountHolderName('');
    setManualCurrency('USD');
    setManualCountry('');
    setShowForm(false);
  };

  return (
    <div className="space-y-6">
      {/* Forms */}
      {showForm ? (
        <div className="bg-white/5 border border-white/10 rounded-lg p-6 backdrop-blur-sm w-full md:w-1/2 mx-auto">
          <div className="flex items-center gap-4 mb-6 border-b border-white/10 pb-4">
            <button 
              onClick={() => {
                setFormTab('create');
              }}
              className={`text-xs font-medium pb-2 border-b-2 transition-colors ${
                formTab === 'create'
                  ? 'text-white border-brand-primary'
                  : 'text-white/60 border-transparent hover:text-white'
              }`}
            >
              Create
            </button>
            <button 
              onClick={() => {
                setFormTab('import');
              }}
              className={`text-xs font-medium pb-2 border-b-2 transition-colors ${
                formTab === 'import'
                  ? 'text-white border-brand-primary'
                  : 'text-white/60 border-transparent hover:text-white'
              }`}
            >
              Import
            </button>
            <div className="flex-1"></div>
            <button 
              onClick={() => {
                setShowForm(false);
                setFormTab('create');
              }} 
              className="text-xs text-white hover:text-white"
            >
              Cancel
            </button>
          </div>

          {formTab === 'create' ? (
            <form onSubmit={handleCreateBankAccount} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input label="First Name" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Jane" required />
                <Input label="Last Name" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Doe" required />
              </div>
              <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@example.com" required />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-white mb-1.5 uppercase tracking-wide">Currency</label>
                  <select 
                    className="w-full px-3 h-10 bg-[#002315] border border-white/10 rounded-[4px] text-sm text-white focus:border-brand-primary focus:outline-none"
                    value={currency} 
                    onChange={e => setCurrency(e.target.value as CashoutCurrency)}
                  >
                    {CASHOUT_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <Input label="Country" value={country} onChange={e => setCountry(e.target.value)} placeholder={getDefaultCountry(currency)} />
              </div>
              <div className="pt-2">
                <Button type="submit" isLoading={createBankAccountMutation.isPending}>Create Account</Button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmitManualForm} className="space-y-4">
              <Input label="Bank Account ID" value={manualBankAccountId} onChange={e => setManualBankAccountId(e.target.value)} placeholder="ba_..." required />
              <Input label="Connected Account ID" value={manualConnectedAccountId} onChange={e => setManualConnectedAccountId(e.target.value)} placeholder="acct_..." required />
              <Input label="Holder Name" value={manualAccountHolderName} onChange={e => setManualAccountHolderName(e.target.value)} required />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-white mb-1.5 uppercase tracking-wide">Currency</label>
                  <select 
                    className="w-full px-3 h-10 bg-[#002315] border border-white/10 rounded-[4px] text-sm text-white focus:border-brand-primary focus:outline-none"
                    value={manualCurrency} 
                    onChange={e => setManualCurrency(e.target.value as CashoutCurrency)}
                  >
                    {CASHOUT_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <Input label="Country" value={manualCountry} onChange={e => setManualCountry(e.target.value)} />
              </div>
              <div className="pt-2">
                <Button type="submit">Add Manually</Button>
              </div>
            </form>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Bank Accounts List */}
          <div className="bg-white/5 border border-white/10 rounded-lg p-6 backdrop-blur-sm w-full md:w-1/2 mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-medium text-white">Bank Accounts</h2>
              <Button 
                onClick={() => {
                  setShowForm(true);
                  setFormTab('create');
                }}
                variant="secondary"
              >
                + New Account
              </Button>
            </div>
            {bankAccounts.length === 0 ? (
              <p className="text-sm text-white/60">No bank accounts. Create one to get started.</p>
            ) : (
              <div className="space-y-3">
                {bankAccounts.map((account) => (
                  <div 
                    key={account.bankAccountId} 
                    className="bg-[#002315] border border-white/10 rounded-lg p-4 flex items-center justify-between"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-sm font-medium text-white">{account.accountHolderName}</span>
                        <span className="text-xs text-white/60 px-2 py-0.5 bg-white/5 rounded">{account.currency}</span>
                        <span className="text-xs text-white/40">{account.country}</span>
                      </div>
                      <div className="text-xs text-white/40 font-mono space-y-0.5">
                        <div>Bank Account: {account.bankAccountId}</div>
                        <div>Connected Account: {account.connectedAccountId}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteBankAccount(account.bankAccountId)}
                      className="text-xs text-red-400 hover:text-red-300 px-3 py-1.5 border border-red-400/20 hover:border-red-400/40 rounded transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountPage;

