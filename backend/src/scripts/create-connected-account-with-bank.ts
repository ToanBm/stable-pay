import dotenv from 'dotenv';
import path from 'path';
import { getStripe } from '../config/stripe';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Script to create Connected Account and External Bank Account for a user
 * Based on Stripe Connect architecture
 * 
 * Flow:
 * 1. Create Connected Account (acct_xxx) for user
 * 2. Create External Bank Account (ba_xxx) for the connected account
 * 
 * Test Account Numbers (routing: 110000000):
 * - 000123456789: Payout thành công
 * - 000111111116: Payout thất bại (no_account)
 * - 000111111113: Payout thất bại (account_closed)
 * - 000222222227: Payout thất bại (insufficient_funds)
 * - 000333333335: Payout thất bại (debit_not_authorized)
 * - 000444444440: Payout thất bại (invalid_currency)
 * - 000999999991: Auto verify (test mode)
 */

interface CreateConnectedAccountParams {
  email: string;
  firstName?: string;
  lastName?: string;
  businessName?: string;
  country?: string;
  businessType?: 'individual' | 'company';
  accountType?: 'express' | 'standard' | 'custom';
}

interface CreateBankAccountParams {
  connectedAccountId: string;
  accountNumber?: string;
  accountHolderName?: string;
  accountHolderType?: 'individual' | 'company';
}

/**
 * Step 1: Create Connected Account for user
 */
async function createConnectedAccount(params: CreateConnectedAccountParams): Promise<string> {
  try {
    console.log('=== Step 1: Creating Connected Account ===\n');
    
    const stripe = getStripe();
    
    // Check test mode
    const secretKey = process.env.STRIPE_SECRET_KEY || '';
    if (!secretKey.startsWith('sk_test_')) {
      console.error('❌ Error: Must use Stripe Test Mode (sk_test_...)');
      return '';
    }

    console.log('✅ Using Stripe Test Mode\n');

    // Use Custom account type by default for test mode (can bypass verification)
    // Custom accounts allow platform control and can use test values to auto-verify
    const accountType = params.accountType || 'custom';
    
    const accountParams: any = {
      type: accountType,
      country: params.country || 'US',
      email: params.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    };

    // For Custom accounts, add full test values to bypass verification
    if (accountType === 'custom') {
      accountParams.business_type = params.businessType || 'individual';
      
      // Add individual with test values for auto-verification
      accountParams.individual = {
        first_name: params.firstName || 'Test',
        last_name: params.lastName || 'User',
        email: params.email, // Fix: Add individual.email (required field)
        dob: {
          day: 1,
          month: 1,
          year: 1901, // Test DOB để pass match
        },
        address: {
          line1: 'address_full_match', // Test token: Enable both charges & payouts
          city: 'San Francisco',
          state: 'CA',
          postal_code: '94111',
          country: 'US',
        },
        phone: '000-000-0000', // Test phone
        ssn_last_4: '0000', // Test SSN để pass
        id_number: '000000000', // Full test SSN nếu cần (pass match)
      };
      
      // Business profile với test values
      accountParams.business_profile = {
        name: params.businessName || 'Test Business',
        url: 'https://accessible.stripe.com', // Test URL: Pass validation
        mcc: '5734', // Valid MCC cho software (bypass requirement)
        product_description: 'Software services for stable app', // Bypass description check
      };
      
      // Accept TOS
      accountParams.tos_acceptance = {
        date: Math.floor(Date.now() / 1000),
        ip: '8.8.8.8', // Simulate TOS acceptance để pass
      };
    } else if (accountType === 'express') {
      // Express accounts
      accountParams.business_type = params.businessType || 'individual';
      
      // Add individual info if provided
      if (params.firstName || params.lastName) {
        accountParams.individual = {};
        if (params.firstName) accountParams.individual.first_name = params.firstName;
        if (params.lastName) accountParams.individual.last_name = params.lastName;
      }
    }

    // Add business profile if provided
    if (params.businessName) {
      accountParams.business_profile = {
        name: params.businessName,
      };
    }

    console.log('Creating connected account with params:');
    console.log('- Account Type:', accountType, accountType === 'express' ? '(allows API bank account creation)' : '');
    console.log('- Email:', params.email);
    console.log('- Country:', params.country || 'US');
    if (accountType === 'express') {
      console.log('- Business Type:', params.businessType || 'individual');
    }
    console.log('- Name:', `${params.firstName || ''} ${params.lastName || ''}`.trim() || 'N/A');
    console.log('');

    const account = await stripe.accounts.create(accountParams);

    console.log('✅ Connected Account created successfully!');
    console.log('Connected Account ID:', account.id);
    console.log('Country:', account.country || 'N/A');
    console.log('Email:', account.email || 'N/A');
    console.log('Charges Enabled:', account.charges_enabled ? '✅' : '❌');
    console.log('Payouts Enabled:', account.payouts_enabled ? '✅' : '❌');
    console.log('Details Submitted:', account.details_submitted ? '✅' : '❌');
    console.log('');

    // For Custom accounts, check requirements and fill missing fields
    if (accountType === 'custom' && (!account.payouts_enabled || !account.charges_enabled)) {
      console.log('Checking requirements and filling missing fields...');
      const updatedAccount = await fillAccountRequirements(account.id, stripe);
      return updatedAccount?.id || account.id;
    }

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
 * Fill account requirements to enable payouts (Custom accounts only)
 */
async function fillAccountRequirements(accountId: string, stripe: any) {
  try {
    // Retrieve account to check requirements
    const account = await stripe.accounts.retrieve(accountId);
    
    if (account.requirements?.currently_due && account.requirements.currently_due.length > 0) {
      console.log('Found missing requirements:', account.requirements.currently_due);
      
      const updateData: any = {};
      
      // Fill missing requirements with test values
      if (account.requirements.currently_due.some((field: string) => field.includes('individual.address'))) {
        updateData.individual = {
          ...account.individual,
          address: {
            line1: 'address_full_match',
            city: 'San Francisco',
            state: 'CA',
            postal_code: '94111',
            country: 'US',
          },
        };
      }
      
      if (account.requirements.currently_due.some((field: string) => field.includes('individual.dob'))) {
        updateData.individual = {
          ...updateData.individual || account.individual,
          dob: {
            day: 1,
            month: 1,
            year: 1901,
          },
        };
      }
      
      if (account.requirements.currently_due.some((field: string) => field.includes('individual.ssn'))) {
        updateData.individual = {
          ...updateData.individual || account.individual,
          ssn_last_4: '0000',
          id_number: '000000000',
        };
      }
      
      // Handle document verification nếu cần
      if (account.requirements.currently_due.some((field: string) => field.includes('verification.document'))) {
        console.log('⚠️  Document verification required. Creating test file...');
        try {
          // Tạo test file (fake image data)
          const file = await stripe.files.create({
            purpose: 'identity_document',
            file: {
              data: Buffer.from('fake image data for test verification'),
              name: 'test.jpg',
              type: 'application/octet-stream',
            },
          });
          
          updateData.individual = {
            ...updateData.individual || account.individual,
            verification: {
              document: {
                front: file.id, // Test file: Pass verification
              },
            },
          };
          
          console.log('✅ Uploaded test identity document:', file.id);
        } catch (fileError: any) {
          console.log('⚠️  Could not create test file:', fileError.message);
        }
      }
      
      // Fill business_profile nếu cần
      if (account.requirements.currently_due.some((field: string) => field.includes('business_profile'))) {
        updateData.business_profile = {
          name: 'Test Business',
          url: 'https://accessible.stripe.com',
          mcc: '5734',
          product_description: 'Software services for stable app',
        };
      }
      
      if (Object.keys(updateData).length > 0) {
        console.log('Updating account with test values...');
        const updated = await stripe.accounts.update(accountId, updateData);
        console.log('✅ Account updated');
        console.log('Charges Enabled:', updated.charges_enabled ? '✅' : '❌');
        console.log('Payouts Enabled:', updated.payouts_enabled ? '✅' : '❌');
        return updated;
      }
    }
    
    return account;
  } catch (error: any) {
    console.log('⚠️  Could not auto-fill requirements:', error.message);
    // Try to retrieve account again, or return null if failed
    try {
      const stripe = getStripe();
      return await stripe.accounts.retrieve(accountId);
    } catch {
      return null;
    }
  }
}

/**
 * Verify account activation status and enable payouts
 */
async function verifyAccountActivation(accountId: string) {
  try {
    const stripe = getStripe();
    const account = await stripe.accounts.retrieve(accountId);
    
    console.log('Account Status Check:');
    console.log('- Charges Enabled:', account.charges_enabled ? '✅' : '❌');
    console.log('- Payouts Enabled:', account.payouts_enabled ? '✅' : '❌');
    console.log('- Details Submitted:', account.details_submitted ? '✅' : '❌');
    
    if (account.capabilities) {
      console.log('\nCapabilities:');
      console.log('- card_payments:', account.capabilities.card_payments === 'active' ? '✅ active' : `❌ ${account.capabilities.card_payments || 'inactive'}`);
      console.log('- transfers:', account.capabilities.transfers === 'active' ? '✅ active' : `❌ ${account.capabilities.transfers || 'inactive'}`);
    }
    
    if (account.requirements?.currently_due && account.requirements.currently_due.length > 0) {
      console.log('\n⚠️  Still missing requirements:', account.requirements.currently_due);
      console.log('   Trying to fill remaining requirements...');
      await fillAccountRequirements(accountId, stripe);
      
      // Wait a bit for auto-verification to process (bank account auto-verify)
      console.log('\n⏳ Waiting for auto-verification to process (bank account)...');
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      
      // Check again
      const recheckAccount = await stripe.accounts.retrieve(accountId);
      console.log('Re-check after auto-verification:');
      console.log('- Charges Enabled:', recheckAccount.charges_enabled ? '✅' : '❌');
      console.log('- Payouts Enabled:', recheckAccount.payouts_enabled ? '✅' : '❌');
    } else if (account.payouts_enabled && account.charges_enabled) {
      console.log('\n🎉 Account is fully activated!');
    }
    
    console.log('');
  } catch (error: any) {
    console.log('⚠️  Could not verify account:', error.message);
  }
}

/**
 * Step 2: Create External Bank Account for connected account
 */
async function createExternalBankAccount(params: CreateBankAccountParams): Promise<string> {
  try {
    console.log('=== Step 2: Creating External Bank Account ===\n');

    const stripe = getStripe();

    // Use auto-verify account number by default for Custom accounts
    const accountNumber = params.accountNumber || '000999999991';
    const routingNumber = '110000000'; // Standard test routing number

    console.log('Creating bank account for connected account:', params.connectedAccountId);
    console.log('Account Number:', accountNumber);
    console.log('Routing Number:', routingNumber);
    console.log('Account Holder:', params.accountHolderName || 'Test User');
    console.log('Account Holder Type:', params.accountHolderType || 'individual');
    console.log('');

    const externalAccount = await stripe.accounts.createExternalAccount(
      params.connectedAccountId,
      {
        external_account: {
          object: 'bank_account',
          country: 'US',
          currency: 'usd',
          routing_number: routingNumber,
          account_number: accountNumber,
          account_holder_type: params.accountHolderType || 'individual',
          account_holder_name: params.accountHolderName || 'Jenny Rosen',
        },
      }
    );

    console.log('✅ External Bank Account created successfully!');
    console.log('Bank Account ID:', externalAccount.id);
    console.log('Bank Name:', (externalAccount as any).bank_name || 'N/A');
    console.log('Last 4:', (externalAccount as any).last4 || 'N/A');
    console.log('Status:', (externalAccount as any).status || 'N/A');
    console.log('Currency:', externalAccount.currency || 'N/A');
    console.log('');

    // Show test account number scenarios
    if (accountNumber === '000123456789') {
      console.log('📝 Test Scenario: Payout will succeed');
    } else if (accountNumber === '000111111116') {
      console.log('📝 Test Scenario: Payout will fail (no_account)');
    } else if (accountNumber === '000111111113') {
      console.log('📝 Test Scenario: Payout will fail (account_closed)');
    } else if (accountNumber === '000222222227') {
      console.log('📝 Test Scenario: Payout will fail (insufficient_funds)');
    } else if (accountNumber === '000333333335') {
      console.log('📝 Test Scenario: Payout will fail (debit_not_authorized)');
    } else if (accountNumber === '000999999991') {
      console.log('📝 Test Scenario: Auto verify bank account (test mode)');
      console.log('   This account number auto-triggers and completes verification');
    }

    console.log('');
    console.log('📝 Save these IDs:');
    console.log(`STRIPE_CONNECTED_ACCOUNT_ID=${params.connectedAccountId}`);
    console.log(`STRIPE_BANK_ACCOUNT_ID=${externalAccount.id}`);

    return externalAccount.id;
  } catch (error: any) {
    console.error('\n❌ Error creating external bank account:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
    throw error;
  }
}

/**
 * Full flow: Create connected account + bank account
 */
async function createConnectedAccountWithBank(
  userEmail: string,
  options?: {
    firstName?: string;
    lastName?: string;
    businessName?: string;
    accountNumber?: string;
    accountHolderName?: string;
    accountType?: 'express' | 'standard' | 'custom';
  }
) {
  try {
    console.log('========================================');
    console.log('Stripe Connect: Create Account + Bank');
    console.log('========================================\n');

    // Step 1: Create Connected Account
    const connectedAccountId = await createConnectedAccount({
      email: userEmail,
      firstName: options?.firstName,
      lastName: options?.lastName,
      businessName: options?.businessName,
      country: 'US',
      businessType: 'individual',
      accountType: options?.accountType || 'custom', // Default to Custom for test mode (can bypass verification)
    });

    if (!connectedAccountId) {
      throw new Error('Failed to create connected account');
    }

    // Step 2: Create External Bank Account (use auto-verify number for Custom)
    const accountNumber = options?.accountNumber || (options?.accountType === 'custom' ? '000999999991' : '000123456789');
    const bankAccountId = await createExternalBankAccount({
      connectedAccountId,
      accountNumber,
      accountHolderName: options?.accountHolderName,
      accountHolderType: 'individual',
    });
    
    // Step 3: For Custom accounts, verify bank account and check requirements again
    if (options?.accountType === 'custom' || !options?.accountType) {
      console.log('\n=== Step 3: Verifying Account Status ===\n');
      await verifyAccountActivation(connectedAccountId);
    }

    console.log('========================================');
    console.log('✅ SUCCESS!');
    console.log('========================================\n');
    console.log('Connected Account ID:', connectedAccountId);
    console.log('Bank Account ID:', bankAccountId);
    console.log('\n💡 Next steps:');
    console.log('1. Save these IDs to your database');
    console.log('2. Use bank account ID for payouts');
    console.log('3. Test payout with:');
    console.log(`   stripe payouts create --amount=1000 --currency=usd --account=${connectedAccountId} --destination=${bankAccountId}`);

    return {
      connectedAccountId,
      bankAccountId,
    };
  } catch (error: any) {
    console.error('\n========================================');
    console.error('❌ FAILED');
    console.error('========================================\n');
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// CLI usage
async function main() {
  const command = process.argv[2];

  if (command === 'full') {
    // Full flow with all params
    // Format: full <email> <name> <accountNumber> <accountType>
    // Example: full test@example.com "Jenny Rosen" 000999999991 custom
    const email = process.argv[3] || 'test@example.com';
    const fullName = process.argv[4] || 'Test User'; // Full name, not split
    const accountNumber = process.argv[5] || '000999999991';
    const accountType = (process.argv[6] as 'express' | 'standard' | 'custom') || 'custom'; // Default to Custom for auto-verify

    // Split full name into first and last
    const nameParts = fullName.split(' ');
    const firstName = nameParts[0] || 'Test';
    const lastName = nameParts.slice(1).join(' ') || 'User';

    await createConnectedAccountWithBank(email, {
      firstName,
      lastName,
      accountNumber,
      accountHolderName: fullName,
      accountType,
    });
  } else if (command === 'account-only') {
    // Only create connected account
    const email = process.argv[3] || 'test@example.com';
    const firstName = process.argv[4] || 'Test';
    const lastName = process.argv[5] || 'User';
    const accountType = (process.argv[6] as 'express' | 'standard' | 'custom') || 'custom';

    await createConnectedAccount({
      email,
      firstName,
      lastName,
      country: 'US',
      businessType: 'individual',
      accountType,
    });
  } else if (command === 'bank-only') {
    // Only create bank account (need connected account ID)
    const connectedAccountId = process.argv[3];
    const accountNumber = process.argv[4] || '000123456789';
    const accountHolderName = process.argv[5] || 'Jenny Rosen';

    if (!connectedAccountId) {
      console.error('❌ Error: Connected Account ID is required');
      console.log('Usage: npx tsx src/scripts/create-connected-account-with-bank.ts bank-only <connected_account_id> [account_number] [account_holder_name]');
      process.exit(1);
    }

    await createExternalBankAccount({
      connectedAccountId,
      accountNumber,
      accountHolderName,
      accountHolderType: 'individual',
    });
  } else {
    // Default: Show help
    console.log('========================================');
    console.log('Stripe Connect Account + Bank Creator');
    console.log('========================================\n');
    console.log('Usage:');
    console.log('');
    console.log('1. Full flow (create account + bank):');
    console.log('   npx tsx src/scripts/create-connected-account-with-bank.ts full [email] [name] [account_number] [account_type]');
    console.log('');
    console.log('   Example:');
    console.log('   npx tsx src/scripts/create-connected-account-with-bank.ts full test@example.com "Jenny Rosen" 000999999991 custom');
    console.log('');
    console.log('   Note: account_type: custom (default, auto-verify) | express | standard');
    console.log('         Use quotes around name if it contains spaces');
    console.log('');
    console.log('2. Create connected account only:');
    console.log('   npx tsx src/scripts/create-connected-account-with-bank.ts account-only [email] [first_name] [last_name] [account_type]');
    console.log('   account_type: custom (default, auto-verify) | express | standard');
    console.log('');
    console.log('3. Create bank account only (for existing connected account):');
    console.log('   npx tsx src/scripts/create-connected-account-with-bank.ts bank-only <connected_account_id> [account_number] [account_holder_name]');
    console.log('');
    console.log('Test Account Numbers (routing: 110000000):');
    console.log('  - 000123456789: Payout thành công ✅');
    console.log('  - 000111111116: Payout thất bại (no_account)');
    console.log('  - 000111111113: Payout thất bại (account_closed)');
    console.log('  - 000222222227: Payout thất bại (insufficient_funds)');
    console.log('  - 000333333335: Payout thất bại (debit_not_authorized)');
    console.log('  - 000444444440: Payout thất bại (invalid_currency)');
    console.log('  - 000999999991: Auto verify (test mode)');
    console.log('');
    console.log('Default (if no params):');
    console.log('  Email: test@example.com');
    console.log('  Name: Test User');
    console.log('  Account Number: 000999999991 (auto-verify)');
    console.log('');
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { createConnectedAccount, createExternalBankAccount, createConnectedAccountWithBank };

