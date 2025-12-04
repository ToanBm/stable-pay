import db from '../config/database';

const isSQLite = process.env.DATABASE_URL?.startsWith('sqlite://');

// Cache duration: 10 minutes (600000 ms)
const CACHE_DURATION_MS = 10 * 60 * 1000;

interface ExchangeRate {
  id?: number;
  from_currency: string;
  to_currency: string;
  rate: number;
  source: string;
  timestamp: Date;
}

/**
 * Get cached exchange rate from database
 */
async function getCachedRate(
  from: string,
  to: string
): Promise<ExchangeRate | null> {
  try {
    const now = new Date();
    const cacheExpiry = new Date(now.getTime() - CACHE_DURATION_MS);

    if (isSQLite) {
      const cached = (db as any)
        .prepare(
          `SELECT * FROM exchange_rates 
           WHERE from_currency = ? AND to_currency = ? 
           AND timestamp > ? 
           ORDER BY timestamp DESC LIMIT 1`
        )
        .get(
          from.toLowerCase(),
          to.toLowerCase(),
          cacheExpiry.toISOString()
        );
      return cached || null;
    } else {
      const result = await (db as any).query(
        `SELECT * FROM exchange_rates 
         WHERE from_currency = $1 AND to_currency = $2 
         AND timestamp > $3 
         ORDER BY timestamp DESC LIMIT 1`,
        [from.toLowerCase(), to.toLowerCase(), cacheExpiry]
      );
      return result.rows[0] || null;
    }
  } catch (error) {
    console.error('Error getting cached rate:', error);
    return null;
  }
}

/**
 * Save exchange rate to database cache
 */
async function saveRate(
  from: string,
  to: string,
  rate: number,
  source: string
): Promise<void> {
  try {
    const now = new Date();

    if (isSQLite) {
      const stmt = (db as any).prepare(
        `INSERT INTO exchange_rates (from_currency, to_currency, rate, source, timestamp)
         VALUES (?, ?, ?, ?, ?)`
      );
      stmt.run(
        from.toLowerCase(),
        to.toLowerCase(),
        rate,
        source,
        now.toISOString()
      );
    } else {
      await (db as any).query(
        `INSERT INTO exchange_rates (from_currency, to_currency, rate, source, timestamp)
         VALUES ($1, $2, $3, $4, $5)`,
        [from.toLowerCase(), to.toLowerCase(), rate, source, now]
      );
    }
  } catch (error) {
    console.error('Error saving rate to cache:', error);
    // Don't throw - caching failure shouldn't break the flow
  }
}

/**
 * Fetch USDT to VND rate from CoinGecko
 */
async function fetchUSDTtoVND(): Promise<number> {
  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=vnd',
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();
    const rate = data.tether?.vnd;

    if (!rate || rate <= 0) {
      throw new Error('Invalid rate from CoinGecko');
    }

    return rate;
  } catch (error) {
    console.error('Error fetching rate from CoinGecko:', error);
    throw error;
  }
}

/**
 * Fetch USDT to USD rate from CoinGecko
 */
async function fetchUSDTtoUSD(): Promise<number> {
  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=usd',
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();
    const rate = data.tether?.usd;

    if (!rate || rate <= 0) {
      throw new Error('Invalid rate from CoinGecko');
    }

    return rate;
  } catch (error) {
    console.error('Error fetching rate from CoinGecko:', error);
    throw error;
  }
}

/**
 * Fetch USDT to EUR rate from CoinGecko
 */
async function fetchUSDTtoEUR(): Promise<number> {
  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=eur',
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();
    const rate = data.tether?.eur;

    if (!rate || rate <= 0) {
      throw new Error('Invalid rate from CoinGecko');
    }

    return rate;
  } catch (error) {
    console.error('Error fetching rate from CoinGecko:', error);
    throw error;
  }
}

/**
 * Get exchange rate with caching
 * Checks cache first, then fetches from API if needed
 */
export async function getExchangeRate(
  from: string,
  to: string
): Promise<number> {
  const fromLower = from.toLowerCase();
  const toLower = to.toLowerCase();

  // Check cache first
  const cached = await getCachedRate(fromLower, toLower);
  if (cached) {
    console.log(
      `Using cached rate: ${from} → ${to} = ${cached.rate} (from ${cached.source})`
    );
    return cached.rate;
  }

  // Fetch from API
  let rate: number;
  let source: string = 'coingecko';

  try {
    if (fromLower === 'usdt') {
      if (toLower === 'vnd') {
        rate = await fetchUSDTtoVND();
      } else if (toLower === 'usd') {
        rate = await fetchUSDTtoUSD();
      } else if (toLower === 'eur') {
        rate = await fetchUSDTtoEUR();
      } else {
        throw new Error(`Unsupported currency pair: ${from} → ${to}`);
      }

      // Save to cache
      await saveRate(fromLower, toLower, rate, source);

      console.log(`Fetched new rate: ${from} → ${to} = ${rate} (from ${source})`);
      return rate;
    } else {
      throw new Error(`Unsupported from currency: ${from}`);
    }
  } catch (error: any) {
    console.error(`Failed to fetch exchange rate ${from} → ${to}:`, error);

    // Fallback to 1:1 for USDT/USD
    if (fromLower === 'usdt' && toLower === 'usd') {
      console.warn('Using fallback rate 1:1 for USDT/USD');
      return 1.0;
    }

    // For other pairs, try to use cached value even if expired
    if (cached) {
      console.warn(
        `Using expired cached rate: ${from} → ${to} = ${cached.rate}`
      );
      return cached.rate;
    }

    throw new Error(
      `Failed to get exchange rate for ${from} → ${to}: ${error.message}`
    );
  }
}

