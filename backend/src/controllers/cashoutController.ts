import { Request, Response } from 'express';
import { createCashout, updateCashout, getCashoutById, getCashoutHistoryByEmployee, getCashoutByTxHash, getCashoutByPayoutId } from '../services/cashoutService';
import { getEmployeeByAddress } from '../services/employeeService';
import { verifySignature, validateCashoutMessage, createCashoutMessage } from '../utils/signature';
import { getUSDTBalance, verifyTransferTransaction, isValidAddress, getOfframpAddress } from '../utils/blockchain';
import { createPayout, getExchangeRate, transferToConnectedAccount } from '../utils/stripe';
import { ethers } from 'ethers';
import { getStripe } from '../config/stripe';
import type Stripe from 'stripe';

/**
 * POST /api/cashout/request
 * Request cashout - verify signature, check balance, verify transaction, create Stripe payout
 */
export async function requestCashout(req: Request, res: Response) {
  try {
    const { amount, currency, bankAccountId, connectedAccountId, signature, message, txHash } = req.body;
    const employeeAddress = req.body.employeeAddress || req.body.address; // Support both formats

    // Validation
    if (!employeeAddress || !isValidAddress(employeeAddress)) {
      return res.status(400).json({ error: 'Invalid employee address' });
    }

    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    if (!currency || !['usd', 'eur'].includes(currency.toLowerCase())) {
      return res.status(400).json({ error: 'Invalid currency. Supported: usd, eur' });
    }

    if (!bankAccountId) {
      return res.status(400).json({ error: 'Bank account ID is required' });
    }

    if (!signature || !message) {
      return res.status(400).json({ error: 'Signature and message are required' });
    }

    if (!txHash) {
      return res.status(400).json({ error: 'Transaction hash is required' });
    }

    // Verify signature
    const isValid = verifySignature(message, signature, employeeAddress);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Validate message format
    const isMessageValid = validateCashoutMessage(message, employeeAddress, amount);
    if (!isMessageValid) {
      return res.status(400).json({ 
        error: 'Invalid message format',
        message: message,
        expectedPattern: `I request cashout ${amount} USDT at ...\\n\\nAddress: ${employeeAddress}`
      });
    }

    // Get employee info (optional - for bank account verification)
    const employee = await getEmployeeByAddress(employeeAddress);
    
    // Verify transaction on-chain
    const offrampAddress = getOfframpAddress();
    
    let transferInfo;
    try {
      transferInfo = await verifyTransferTransaction(txHash);
    } catch (error: any) {
      console.error('[Cashout] Transaction verification failed:', error.message);
      
      // If RPC error, provide more helpful error message
      if (error.message.includes('403') || error.message.includes('Forbidden')) {
        return res.status(503).json({ 
          error: 'Blockchain RPC error. Please try again later or contact support.',
          details: error.message
        });
      }
      
      return res.status(400).json({ 
        error: 'Failed to verify transaction on-chain',
        details: error.message,
        txHash
      });
    }

    if (transferInfo.from.toLowerCase() !== employeeAddress.toLowerCase()) {
      return res.status(400).json({ error: 'Transaction sender does not match employee address' });
    }

    if (transferInfo.to.toLowerCase() !== offrampAddress.toLowerCase()) {
      return res.status(400).json({ error: 'Transaction recipient is not the offramp wallet' });
    }

    const transferAmount = parseFloat(transferInfo.amount);
    const requestedAmount = parseFloat(amount);

    // Allow small tolerance for rounding differences
    if (Math.abs(transferAmount - requestedAmount) > 0.01) {
      return res.status(400).json({
        error: 'Transaction amount does not match requested amount',
        requested: requestedAmount,
        transferred: transferAmount,
      });
    }

    // Check if cashout already exists for this transaction
    const existingCashout = await getCashoutByTxHash(txHash);
    if (existingCashout) {
      // Return existing cashout info instead of error
      return res.status(200).json({
        cashoutId: existingCashout.id,
        status: existingCashout.status,
        payoutId: existingCashout.payout_id_stripe || undefined,
        fiatAmount: existingCashout.fiat_amount,
        currency: existingCashout.fiat_currency,
        txHash,
        message: 'Cashout already exists for this transaction',
        existing: true,
      });
    }

    // Get exchange rate
    let exchangeRate = 1.0;
    try {
      exchangeRate = await getExchangeRate('usdt', currency.toLowerCase());
    } catch (error) {
      console.warn('Failed to get exchange rate, using 1:1:', error);
    }

    const fiatAmount = parseFloat(amount) * exchangeRate;

    // Create cashout record
    const cashout = await createCashout({
      employee_address: employeeAddress,
      amount_usdt: amount,
      fiat_currency: currency.toLowerCase(),
      fiat_amount: fiatAmount.toString(),
      exchange_rate: exchangeRate.toString(),
      tx_hash_onchain: txHash,
      stripe_bank_account_id: bankAccountId,
      status: 'pending_transfer',
    });

    // Create Stripe payout
    try {
      let payout: Stripe.Payout;
      
      // If connectedAccountId is provided, need to transfer first then payout from connected account
      if (connectedAccountId) {
        // Step 1: Transfer from platform account → connected account
        const transfer = await transferToConnectedAccount({
          amount: fiatAmount,
          currency: currency.toLowerCase() as 'usd' | 'eur',
          destination: connectedAccountId,
          description: `Transfer ${currency.toUpperCase()} for cashout payout`,
        });
        
        // Wait a bit for transfer to settle
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Step 2: Create payout from connected account context
        payout = await createPayout({
          amount: fiatAmount,
          currency: currency.toLowerCase() as 'usd' | 'eur' | 'vnd',
          destination: bankAccountId,
          method: 'standard',
          connectedAccountId: connectedAccountId,
        });
      } else {
        // Direct payout from platform account
        payout = await createPayout({
          amount: fiatAmount,
          currency: currency.toLowerCase() as 'usd' | 'eur' | 'vnd',
          destination: bankAccountId,
          method: 'standard',
        });
      }

      // Update cashout with payout ID
      await updateCashout(cashout.id!, {
        payout_id_stripe: payout.id,
        status: 'pending_payout',
      });

      const updatedCashout = await getCashoutById(cashout.id!);
      res.json({
        cashoutId: cashout.id,
        status: 'pending_payout',
        payoutId: payout.id,
        fiatAmount: fiatAmount.toString(),
        currency: currency.toLowerCase(),
        txHash,
      });
    } catch (error: any) {
      console.error('[Cashout] Stripe payout creation failed:', error.message);
      console.error('[Cashout] Error details:', error);
      
      // If Stripe payout fails, update cashout status
      try {
        await updateCashout(cashout.id!, {
          status: 'failed',
          error_message: error.message || 'Failed to create Stripe payout',
        });
      } catch (updateError) {
        console.error('[Cashout] Failed to update cashout status:', updateError);
      }

      throw error;
    }
  } catch (error: any) {
    console.error('[Cashout] Error requesting cashout:', error);
    
    // If error already has status code (from validation), use it
    const statusCode = error.statusCode || error.status || 500;
    const errorMessage = error.message || 'Failed to request cashout';
    
    res.status(statusCode).json({ error: errorMessage });
  }
}

/**
 * GET /api/cashout/balance/:address
 * Get USDT balance for an employee
 */
export async function getBalance(req: Request, res: Response) {
  try {
    const { address } = req.params;

    if (!address || !isValidAddress(address)) {
      return res.status(400).json({ error: 'Invalid address' });
    }

    const balance = await getUSDTBalance(address);

    res.json({
      balance: balance.toString(),
      currency: 'USDT',
      address: address.toLowerCase(),
    });
  } catch (error: any) {
    console.error('Error getting balance:', error);
    res.status(500).json({ error: error.message || 'Failed to get balance' });
  }
}

/**
 * GET /api/cashout/history/:address
 * Get cashout history for an employee
 */
export async function getCashoutHistory(req: Request, res: Response) {
  try {
    const { address } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    if (!address || !isValidAddress(address)) {
      return res.status(400).json({ error: 'Invalid address' });
    }

    const result = await getCashoutHistoryByEmployee(address, page, limit);

    res.json({
      cashouts: result.cashouts,
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
    });
  } catch (error: any) {
    console.error('Error getting cashout history:', error);
    res.status(500).json({ error: error.message || 'Failed to get cashout history' });
  }
}

/**
 * GET /api/cashout/status/:cashoutId
 * Get cashout status by ID
 */
export async function getCashoutStatus(req: Request, res: Response) {
  try {
    const { cashoutId } = req.params;

    if (!cashoutId || isNaN(parseInt(cashoutId))) {
      return res.status(400).json({ error: 'Invalid cashout ID' });
    }

    const cashout = await getCashoutById(parseInt(cashoutId));

    if (!cashout) {
      return res.status(404).json({ error: 'Cashout not found' });
    }

    res.json(cashout);
  } catch (error: any) {
    console.error('Error getting cashout status:', error);
    res.status(500).json({ error: error.message || 'Failed to get cashout status' });
  }
}

/**
 * POST /api/cashout/create-bank-account
 * Create a connected account with bank account for user
 */
export async function createBankAccount(req: Request, res: Response) {
  try {
    const { email, firstName, lastName, currency, country } = req.body;

    // Validation
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email is required' });
    }

    if (!firstName || !lastName) {
      return res.status(400).json({ error: 'First name and last name are required' });
    }

    if (!currency || !['usd', 'eur'].includes(currency.toLowerCase())) {
      return res.status(400).json({ error: 'Invalid currency. Supported: usd, eur' });
    }

    // Default country based on currency if not provided
    const defaultCountry: Record<string, string> = {
      'usd': 'US',
      'eur': 'DE',
    };
    const accountCountry = (country || defaultCountry[currency.toLowerCase()] || 'US').toUpperCase();

    const stripe = getStripe();

    // Check test mode
    const secretKey = process.env.STRIPE_SECRET_KEY || '';
    if (!secretKey.startsWith('sk_test_')) {
      return res.status(400).json({ error: 'This feature is only available in test mode' });
    }

    // Helper functions (inline for simplicity)
    const getTestPhoneNumber = (country: string): string => {
      const phoneMap: Record<string, string> = {
        'US': '+12025551234',
        'JP': '+81312345678',
        'DE': '+49301234567',
        'FR': '+33123456789',
        'GB': '+442071234567',
        'NL': '+31201234567',
        'BE': '+3212345678',
      };
      return phoneMap[country] || '+12025551234';
    };

    const getTestIBAN = (country: string): string => {
      const testIBANs: Record<string, string> = {
        'DE': 'DE89370400440532013000',
        'FR': 'FR1420041010050500013M02606',
        'GB': 'GB82WEST12345698765432',
        'NL': 'NL91ABNA0417164300',
        'BE': 'BE68539007547034',
      };
      return testIBANs[country] || testIBANs['DE'];
    };

    // Build address
    const addressData: any = {
      line1: 'address_full_match',
      postal_code: accountCountry === 'JP' ? '1000001' : accountCountry === 'DE' ? '10115' : '94111',
      country: accountCountry,
    };

    if (accountCountry === 'JP') {
      addressData.city = 'Tokyo';
    } else if (['DE', 'FR', 'NL', 'BE'].includes(accountCountry)) {
      addressData.city = accountCountry === 'DE' ? 'Berlin' : accountCountry === 'FR' ? 'Paris' : accountCountry === 'NL' ? 'Amsterdam' : 'Brussels';
    } else {
      addressData.city = 'San Francisco';
      addressData.state = 'CA';
    }

    // Build capabilities
    const capabilities: any = {
      transfers: { requested: true },
    };
    if (accountCountry === 'US') {
      capabilities.card_payments = { requested: true };
    }

    // Create connected account
    const accountParams: any = {
      type: 'custom',
      country: accountCountry,
      email: email,
      capabilities: capabilities,
      business_type: 'individual',
      individual: {
        first_name: firstName,
        last_name: lastName,
        email: email,
        dob: {
          day: 1,
          month: 1,
          year: 1901,
        },
        address: addressData,
        phone: getTestPhoneNumber(accountCountry),
      },
      business_profile: {
        name: 'Test Business',
        url: 'https://accessible.stripe.com',
        mcc: '5734',
        product_description: 'Software services',
      },
      tos_acceptance: {
        date: Math.floor(Date.now() / 1000),
        ip: '8.8.8.8',
      },
    };

    if (accountCountry !== 'US') {
      accountParams.tos_acceptance.service_agreement = 'recipient';
    }

    if (accountCountry === 'US') {
      accountParams.individual.ssn_last_4 = '0000';
      accountParams.individual.id_number = '000000000';
    }

    const account = await stripe.accounts.create(accountParams);

    // Create bank account
    const bankAccountParams: any = {
      object: 'bank_account',
      country: accountCountry,
      currency: currency.toLowerCase(),
      account_holder_type: 'individual',
      account_holder_name: `${firstName} ${lastName}`,
    };

    if (accountCountry === 'US' && currency.toLowerCase() === 'usd') {
      bankAccountParams.routing_number = '110000000';
      bankAccountParams.account_number = '000999999991';
    } else if (currency.toLowerCase() === 'eur') {
      bankAccountParams.account_number = getTestIBAN(accountCountry);
    } else {
      bankAccountParams.account_number = '000999999991';
    }

    const externalAccount = await stripe.accounts.createExternalAccount(account.id, {
      external_account: bankAccountParams,
    });

    res.json({
      success: true,
      connectedAccountId: account.id,
      bankAccountId: externalAccount.id,
      currency: currency.toUpperCase(),
      country: accountCountry,
      accountHolderName: `${firstName} ${lastName}`,
    });
  } catch (error: any) {
    console.error('Error creating bank account:', error);
    res.status(500).json({ error: error.message || 'Failed to create bank account' });
  }
}