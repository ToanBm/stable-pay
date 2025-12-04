import React, { useState } from 'react';
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js';
import { useQuery, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import {
  createPaymentIntent,
  getPaymentStatus,
  getExchangeRate,
  type CreatePaymentIntentRequest,
} from '@/services/api/payment';
import { 
  PAYMENT_CURRENCIES, 
  type PaymentCurrency,
  BLOCK_EXPLORER_URL,
} from '@/utils/constants';
import { isValidAddress } from '@/utils/validation';

type PaymentStatus = 'idle' | 'loading' | 'success' | 'error';

interface PaymentResult {
  paymentIntentId: string;
  txHash?: string;
  amountUSDT: string;
}

const OnRampPage: React.FC = () => {
  const stripe = useStripe();
  const elements = useElements();

  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<PaymentCurrency>('USD');
  const [walletAddress, setWalletAddress] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('idle');
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null);

  // Reset form function
  const resetForm = () => {
    setAmount('');
    setCurrency('USD');
    // Keep wallet address for convenience
    setPaymentStatus('idle');
    setPaymentResult(null);
    
    // Clear card element
    if (elements) {
      const cardElement = elements.getElement(CardElement);
      if (cardElement) {
        cardElement.clear();
      }
    }

  };


  // Get exchange rate
  const { data: exchangeRate, error: rateError, isLoading: isLoadingRate } = useQuery({
    queryKey: ['exchangeRate', currency],
    queryFn: () => {
      console.log('[OnRampPage] Fetching exchange rate for:', currency);
      return getExchangeRate(currency);
    },
    refetchInterval: 60000, // Refetch every minute
    retry: 2,
  });

  // Log exchange rate changes
  React.useEffect(() => {
    if (exchangeRate) {
      console.log('[OnRampPage] Exchange rate updated:', exchangeRate);
    }
    if (rateError) {
      console.error('[OnRampPage] Exchange rate error:', rateError);
    }
  }, [exchangeRate, rateError]);

  // Create payment intent mutation
  const createIntentMutation = useMutation({
    mutationFn: (data: CreatePaymentIntentRequest) => createPaymentIntent(data),
  });


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      toast.error('Stripe is not loaded yet');
      return;
    }

    // Validation
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (!walletAddress || !isValidAddress(walletAddress)) {
      toast.error('Please enter a valid wallet address');
      return;
    }

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      toast.error('Card element not found');
      return;
    }

    setPaymentStatus('loading');

    try {
      // Step 1: Create payment intent
      toast.loading('Creating payment intent...');
      const intentResponse = await createIntentMutation.mutateAsync({
        amount: parseFloat(amount),
        currency,
        walletAddress,
      });

      toast.dismiss();
      toast.success('Payment intent created! Confirming payment...');

      // Step 2: Confirm payment with Stripe
      const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(
        intentResponse.clientSecret,
        {
          payment_method: {
            card: cardElement,
            billing_details: {
              address: {
                postal_code: '12345', // Default postal code for test cards
              },
            },
          },
        }
      );

      if (confirmError) {
        throw new Error(confirmError.message || 'Payment confirmation failed');
      }

      if (!paymentIntent) {
        throw new Error('No payment intent returned');
      }

      // Step 3: Check payment status
      if (paymentIntent.status === 'succeeded') {
        toast.dismiss();
        toast.success('Payment successful! Waiting for USDT transfer...');

        // Set success immediately with amount info from intent response
        setPaymentResult({
          paymentIntentId: paymentIntent.id,
          amountUSDT: intentResponse.amountUSDT,
        });
        setPaymentStatus('success');
        

        // Poll for payment status to get TX hash (in background)
        let attempts = 0;
        const maxAttempts = 30;
        const pollInterval = setInterval(async () => {
          attempts++;
          try {
            const status = await getPaymentStatus(paymentIntent.id);
            if (status.txHash) {
              clearInterval(pollInterval);
              // Update result with TX hash
              setPaymentResult({
                paymentIntentId: paymentIntent.id,
                txHash: status.txHash,
                amountUSDT: status.amountUSDT,
              });
              toast.success('USDT transfer completed! Transaction hash available.');
              
              // Reload again to show updated history
            } else if (attempts >= maxAttempts) {
              clearInterval(pollInterval);
              // Don't change status, keep success but no TX hash
              toast.error('TX hash not found yet. Check payment history later.');
            }
          } catch (error) {
            if (attempts >= maxAttempts) {
              clearInterval(pollInterval);
              // Don't change status, keep success
              console.error('Failed to check payment status:', error);
            }
            // Continue polling if not max attempts
          }
        }, 2000);
      } else if (paymentIntent.status === 'processing') {
        toast.dismiss();
        toast.loading('Payment is processing...');
        setPaymentStatus('loading');
      } else {
        throw new Error(`Payment status: ${paymentIntent.status}`);
      }
    } catch (error: any) {
      toast.dismiss();
      toast.error(error.message || 'Payment failed');
      setPaymentStatus('error');
      console.error('Payment error:', error);
    }
  };

  return (
    <div>
      <div className="bg-white/5 border border-white/10 rounded-lg p-6 backdrop-blur-sm w-full md:w-1/2 mx-auto">
            <h2 className="text-base font-medium text-white mb-6">Buy Stablecoins</h2>
          
          {paymentStatus === 'success' ? (
             <div className="text-center py-8">
               <div className="w-12 h-12 bg-brand-primary/20 rounded-full flex items-center justify-center mx-auto mb-4 text-brand-primary text-xl shadow-[0_0_15px_rgba(0,123,80,0.3)]">✓</div>
               <h3 className="text-base text-white font-medium mb-1">Payment Successful</h3>
               <p className="text-sm text-white mb-6">You received {paymentResult?.amountUSDT ? parseFloat(paymentResult.amountUSDT).toFixed(2) : '0.00'} USDT</p>
               
               <div className="bg-[#0C3223] p-4 rounded border border-white/10 mb-6 text-left">
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-white">Payment ID</span>
                    <span className="text-white font-mono">{paymentResult?.paymentIntentId}</span>
          </div>
                  {paymentResult?.txHash && (
                    <div className="flex justify-between text-xs">
                      <span className="text-white">TX Hash</span>
                      <a href={`${BLOCK_EXPLORER_URL}/tx/${paymentResult.txHash}`} target="_blank" className="text-brand-primary hover:underline font-mono truncate max-w-[200px]">{paymentResult.txHash}</a>
          </div>
        )}
               </div>
               
               <Button onClick={resetForm} variant="outline" className="w-full">New Transaction</Button>
             </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-3 gap-4">
                <Input label="Amount" type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="100.00" required />
                <div>
                   <label className="block text-xs font-medium text-white mb-1.5 uppercase tracking-wide">Currency</label>
              <select
                     className="w-full px-3 h-10 bg-[#002315] border border-white/10 rounded-[4px] text-sm text-white focus:border-brand-primary focus:outline-none"
                value={currency}
                     onChange={e => setCurrency(e.target.value as PaymentCurrency)}
              >
                     {PAYMENT_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-white mb-1.5 uppercase tracking-wide">Estimated output</label>
                  <div className="w-full px-3 h-10 bg-[#002315] border border-white/10 rounded-[4px] text-sm text-white flex items-center justify-end">
                    <span className="text-white">
                      {(() => {
                        if (isLoadingRate) return 'Loading...';
                        if (rateError || !exchangeRate) return '0.00';
                        if (!exchangeRate.rate || isNaN(exchangeRate.rate)) return '0.00';
                        if (!amount || parseFloat(amount) <= 0) return '0.00';
                        const result = parseFloat(amount) * exchangeRate.rate;
                        return isNaN(result) ? '0.00' : result.toFixed(2);
                      })()} USDT
                    </span>
                  </div>
                </div>
            </div>

              <Input label="Wallet Address" value={walletAddress} onChange={e => setWalletAddress(e.target.value)} placeholder="0x..." className="font-mono text-xs" required />

              <div>
                <label className="block text-xs font-medium text-white mb-1.5 uppercase tracking-wide">Card Details</label>
                <div className="px-3 py-3 bg-[#002315] border border-white/10 rounded-[4px]">
                  <CardElement options={{
                    hidePostalCode: false, // Hiển thị postal code field
                    style: {
                      base: {
                        fontSize: '14px',
                        color: '#ffffff',
                        '::placeholder': { color: '#ffffff50' },
                      },
                      invalid: { color: '#ef4444' },
                    }
                  }} />
                </div>
                <p className="mt-1.5 text-xs text-white/60">
                  Test card: 4242 4242 4242 4242 | Expiry: 12/34 | CVC: 123 | ZIP: 12345
                </p>
              </div>

              <Button type="submit" className="w-full" isLoading={paymentStatus === 'loading'} disabled={!stripe}>
                Pay Now
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};

export default OnRampPage;
