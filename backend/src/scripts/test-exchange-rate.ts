import dotenv from 'dotenv';
import path from 'path';
import { getExchangeRate } from '../services/exchangeRateService';

// Load .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function testExchangeRates() {
  console.log('='.repeat(60));
  console.log('🧪 Testing Exchange Rate Service');
  console.log('='.repeat(60));
  console.log('');

  const tests = [
    { from: 'USDT', to: 'VND', description: 'USDT to VND (Vietnamese Dong)' },
    { from: 'USDT', to: 'USD', description: 'USDT to USD (US Dollar)' },
    { from: 'USDT', to: 'EUR', description: 'USDT to EUR (Euro)' },
  ];

  for (const test of tests) {
    console.log(`\n📊 Test: ${test.description}`);
    console.log('-'.repeat(60));

    try {
      // First call - should fetch from API
      console.log('1️⃣  First call (fetching from CoinGecko API)...');
      const startTime1 = Date.now();
      const rate1 = await getExchangeRate(test.from, test.to);
      const time1 = Date.now() - startTime1;
      console.log(`   ✅ Rate: 1 ${test.from} = ${rate1.toLocaleString()} ${test.to}`);
      console.log(`   ⏱️  Time: ${time1}ms`);

      // Second call - should use cache
      console.log('\n2️⃣  Second call (should use cache)...');
      const startTime2 = Date.now();
      const rate2 = await getExchangeRate(test.from, test.to);
      const time2 = Date.now() - startTime2;
      console.log(`   ✅ Rate: 1 ${test.from} = ${rate2.toLocaleString()} ${test.to}`);
      console.log(`   ⏱️  Time: ${time2}ms (cached)`);

      if (rate1 === rate2) {
        console.log('   ✅ Rates match - Cache working correctly');
      } else {
        console.log('   ⚠️  Rates differ - might be market fluctuation');
      }

      if (time2 < time1 * 0.5) {
        console.log('   ✅ Cache is faster (as expected)');
      }

      // Example calculation
      const exampleAmount = 100;
      const fiatAmount = exampleAmount * rate1;
      console.log(`\n   💰 Example: ${exampleAmount} ${test.from} = ${fiatAmount.toLocaleString()} ${test.to}`);

    } catch (error: any) {
      console.error(`   ❌ Error: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Exchange Rate Test Complete');
  console.log('='.repeat(60));
}

// Run tests
testExchangeRates().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

