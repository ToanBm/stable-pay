import dotenv from 'dotenv';
import path from 'path';
import { getStripe } from '../config/stripe';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Script to create Connected Account and External Bank Account for multiple currencies
 * Supports: USD, EUR, JPY
 * 
 * Usage:
 *   npx tsx src/scripts/create-multi-currency-account.ts <email> "<name>" <currency> <country> [accountNumber/IBAN]
 * 
 * Examples:
 *   # USD
 *   npx tsx src/scripts/create-multi-currency-account.ts test@example.com "Jenny Rosen" usd US
 *   
 *   # EUR (Germany)
 *   npx tsx src/scripts/create-multi-currency-account.ts test@example.com "John Doe" eur DE DE89370400440532013000
 *   
 *   # JPY (Japan)
 *   npx tsx src/scripts/create-multi-currency-account.ts test@example.com "Yamada Taro" jpy JP
 */

interface CreateAccountParams {
  email: string;
  firstName?: string;
  lastName?: string;
  currency: 'usd' | 'eur' | 'jpy' | string;
  country: string;
  accountNumber?: string; // For US/JPY: account_number, For EUR: IBAN
  routingNumber?: string; // For US only
  accountHolderName?: string;
}

/**
 * Helper: Get default country for currency
 */
function getDefaultCountryForCurrency(currency: string): string {
  const currencyCountryMap: Record<string, string> = {
    'usd': 'US',
    'eur': 'DE',
    'jpy': 'JP',
  };
  return currencyCountryMap[currency.toLowerCase()] || 'US';
}

/**
 * Helper: Get test IBAN for EUR countries
 */
function getTestIBANForCountry(country: string): string {
  const testIBANs: Record<string, string> = {
    'DE': 'DE89370400440532013000',
    'FR': 'FR1420041010050500013M02606',
    'GB': 'GB82WEST12345698765432',
    'NL': 'NL91ABNA0417164300',
    'BE': 'BE68539007547034',
  };
  return testIBANs[country.toUpperCase()] || testIBANs['DE'];
}

/**
 * Helper: Get default account number for currency/country
 */
function getDefaultAccountNumber(currency: string, country: string): string {
  if (currency.toLowerCase() === 'eur') {
    return getTestIBANForCountry(country);
  }
  // For USD, JPY: use auto-verify test account
  return '000999999991';
}

/**
 * Helper: Get test phone number format for country
 */
function getTestPhoneNumber(country: string): string {
  const phoneMap: Record<string, string> = {
    'US': '+12025551234', // US format
    'JP': '+81312345678', // Japan format
    'DE': '+49301234567', // Germany format
    'FR': '+33123456789', // France format
    'GB': '+442071234567', // UK format
    'NL': '+31201234567', // Netherlands format
    'BE': '+3212345678', // Belgium format
  };
  return phoneMap[country.toUpperCase()] || '+12025551234';
}

/**
 * Create Connected Account with proper country-specific test values
 */
async function createConnectedAccount(params: CreateAccountParams): Promise<string> {
  try {
    console.log('=== Step 1: Creating Connected Account ===\n');
    
    const stripe = getStripe();
    
    const secretKey = process.env.STRIPE_SECRET_KEY || '';
    if (!secretKey.startsWith('sk_test_')) {
      console.error('❌ Error: Must use Stripe Test Mode (sk_test_...)');
      return '';
    }

    console.log('✅ Using Stripe Test Mode\n');

    const currency = params.currency.toLowerCase();
    const country = params.country.toUpperCase();

    // Build address based on country
    const addressData: any = {
      line1: 'address_full_match',
      postal_code: country === 'JP' ? '1000001' : country === 'DE' ? '10115' : '94111',
      country: country,
    };
    
    if (country === 'JP') {
      addressData.city = 'Tokyo';
    } else if (country === 'DE' || country === 'FR' || country === 'NL' || country === 'BE') {
      addressData.city = country === 'DE' ? 'Berlin' : country === 'FR' ? 'Paris' : country === 'NL' ? 'Amsterdam' : 'Brussels';
    } else {
      addressData.city = 'San Francisco';
      addressData.state = 'CA'; // Only US has state
    }

    // Split name
    const nameParts = (params.accountHolderName || '').split(' ');
    const firstName = params.firstName || nameParts[0] || 'Test';
    const lastName = params.lastName || nameParts.slice(1).join(' ') || 'User';

    // Recipient accounts không thể có card_payments capability
    // Chỉ US accounts (full service agreement) mới có card_payments
    const capabilities: any = {
      transfers: { requested: true },
    };
    
    if (country === 'US') {
      capabilities.card_payments = { requested: true };
    }

    const accountParams: any = {
      country: country,
      email: params.email,
      capabilities: capabilities,
      business_type: 'individual',
      individual: {
        first_name: firstName,
        last_name: lastName,
        email: params.email,
        dob: {
          day: 1,
          month: 1,
          year: 1901,
        },
        address: addressData,
        phone: getTestPhoneNumber(country),
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

    // Set recipient service agreement cho non-US accounts để hỗ trợ cross-border transfers
    // Cross-border payouts chỉ được support với recipient service agreement
    // Dùng type: 'custom' cho tất cả accounts
    accountParams.type = 'custom';
    
    if (country !== 'US') {
      accountParams.tos_acceptance.service_agreement = 'recipient';
      console.log('⚠️  Setting recipient service agreement for cross-border transfers');
    }

    // SSN chỉ dùng cho US accounts
    if (country === 'US') {
      accountParams.individual.ssn_last_4 = '0000';
      accountParams.individual.id_number = '000000000';
    }

    console.log('Creating connected account:');
    console.log('- Email:', params.email);
    console.log('- Name:', `${firstName} ${lastName}`);
    console.log('- Country:', country);
    console.log('- Currency:', currency.toUpperCase());
    console.log('');

    const account = await stripe.accounts.create(accountParams);

    console.log('✅ Connected Account created!');
    console.log('- Account ID:', account.id);
    console.log('- Country:', account.country);
    console.log('- Charges Enabled:', account.charges_enabled ? '✅' : '❌');
    console.log('- Payouts Enabled:', account.payouts_enabled ? '✅' : '❌');
    console.log('');

    return account.id;
  } catch (error: any) {
    console.error('\n❌ Error creating connected account:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
    throw error;
  }
}

/**
 * Create External Bank Account based on currency/country
 */
async function createExternalBankAccount(params: CreateAccountParams, connectedAccountId: string): Promise<string> {
  try {
    console.log('=== Step 2: Creating External Bank Account ===\n');

    const stripe = getStripe();
    const currency = params.currency.toLowerCase();
    const country = params.country.toUpperCase();

    console.log('Creating bank account:');
    console.log('- Currency:', currency.toUpperCase());
    console.log('- Country:', country);
    console.log('- Account Holder:', params.accountHolderName || 'Test User');
    console.log('');

    const bankAccountParams: any = {
      object: 'bank_account',
      country: country,
      currency: currency,
      account_holder_type: 'individual',
      account_holder_name: params.accountHolderName || 'Test User',
    };

    // US bank accounts: routing_number + account_number
    if (country === 'US' && currency === 'usd') {
      const routingNumber = params.routingNumber || '110000000';
      const accountNumber = params.accountNumber || '000999999991';
      
      bankAccountParams.routing_number = routingNumber;
      bankAccountParams.account_number = accountNumber;
      
      console.log('- Account Number:', accountNumber);
      console.log('- Routing Number:', routingNumber);
    }
    // EUR bank accounts: IBAN (không có routing_number)
    else if (currency === 'eur') {
      const iban = params.accountNumber || getTestIBANForCountry(country);
      
      bankAccountParams.account_number = iban;
      
      console.log('- IBAN:', iban);
      console.log('  (EUR accounts use IBAN format, no routing number)');
    }
    // JPY bank accounts: account_number + routing_number (required)
    // JP routing number format: xxxxxxx (7 digits)
    // Stripe test routing number for Japan: 0000000 (7 zeros)
    // Stripe test account number for Japan: 0001234 (as per Stripe docs)
    else if (currency === 'jpy' && country === 'JP') {
      const accountNumber = params.accountNumber || '0001234'; // Stripe test account number for Japan
      const routingNumber = params.routingNumber || '0000000'; // Stripe test routing number for Japan (7 zeros)
      
      bankAccountParams.account_number = accountNumber;
      bankAccountParams.routing_number = routingNumber;
      
      console.log('- Account Number:', accountNumber, '(Stripe test account for Japan)');
      console.log('- Routing Number:', routingNumber, '(Stripe test routing for Japan)');
    }
    // Other currencies: try with account_number only
    else {
      const accountNumber = params.accountNumber || '000999999991';
      
      bankAccountParams.account_number = accountNumber;
      
      console.log('- Account Number:', accountNumber);
      console.log('  ⚠️  Note: May require routing_number or other fields');
    }

    console.log('');

    const externalAccount = await stripe.accounts.createExternalAccount(
      connectedAccountId,
      {
        external_account: bankAccountParams,
      }
    );

    console.log('✅ Bank Account created!');
    console.log('- Bank Account ID:', externalAccount.id);
    console.log('- Currency:', externalAccount.currency?.toUpperCase());
    console.log('- Status:', (externalAccount as any).status || 'N/A');
    console.log('');

    return externalAccount.id;
  } catch (error: any) {
    console.error('\n❌ Error creating bank account:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    const email = process.argv[2];
    const name = process.argv[3];
    const currency = process.argv[4] || 'usd';
    const country = process.argv[5] || getDefaultCountryForCurrency(currency);
    const accountNumber = process.argv[6]; // Optional

    if (!email) {
      console.log('Usage: npx tsx src/scripts/create-multi-currency-account.ts <email> "<name>" <currency> <country> [accountNumber/IBAN]');
      console.log('');
      console.log('Examples:');
      console.log('  # USD');
      console.log('  npx tsx src/scripts/create-multi-currency-account.ts test@example.com "Jenny Rosen" usd US');
      console.log('');
      console.log('  # EUR (Germany)');
      console.log('  npx tsx src/scripts/create-multi-currency-account.ts test@example.com "John Doe" eur DE');
      console.log('');
      console.log('  # JPY (Japan)');
      console.log('  npx tsx src/scripts/create-multi-currency-account.ts test@example.com "Yamada Taro" jpy JP');
      console.log('');
      console.log('Supported currencies: usd, eur, jpy');
      process.exit(1);
    }

    console.log('========================================');
    console.log('Create Multi-Currency Connected Account');
    console.log('========================================\n');

    const params: CreateAccountParams = {
      email,
      accountHolderName: name,
      currency,
      country,
      accountNumber,
    };

    // Step 1: Create Connected Account
    const connectedAccountId = await createConnectedAccount(params);

    if (!connectedAccountId) {
      throw new Error('Failed to create connected account');
    }

    // Step 2: Create Bank Account
    const bankAccountId = await createExternalBankAccount(params, connectedAccountId);

    // Step 3: Wait and verify
    console.log('=== Step 3: Verifying Account ===\n');
    console.log('⏳ Waiting for auto-verification (2 seconds)...\n');
    await new Promise(resolve => setTimeout(resolve, 2000));

    const stripe = getStripe();
    const account = await stripe.accounts.retrieve(connectedAccountId);
    
    console.log('Account Status:');
    console.log('- Charges Enabled:', account.charges_enabled ? '✅' : '❌');
    console.log('- Payouts Enabled:', account.payouts_enabled ? '✅' : '❌');
    console.log('');

    console.log('========================================');
    console.log('✅ SUCCESS!');
    console.log('========================================\n');
    console.log('Connected Account ID:', connectedAccountId);
    console.log('Bank Account ID:', bankAccountId);
    console.log('Currency:', currency.toUpperCase());
    console.log('Country:', country);
    console.log('');
    console.log('💡 Save these IDs for payout:');
    console.log(`   CONNECTED_ACCOUNT_ID=${connectedAccountId}`);
    console.log(`   BANK_ACCOUNT_ID=${bankAccountId}`);
    console.log('');
    console.log('Test payout:');
    console.log(`   stripe payouts create --amount=1000 --currency=${currency} --account=${connectedAccountId} --destination=${bankAccountId}`);

  } catch (error: any) {
    console.error('\n========================================');
    console.error('❌ FAILED');
    console.error('========================================');
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { createConnectedAccount, createExternalBankAccount };

