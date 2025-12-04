import db from '../config/database';
import { Cashout } from '../models/Cashout';
import dotenv from 'dotenv';

// Load .env to ensure DATABASE_URL is available
dotenv.config();

/**
 * Cashout Database Service
 * Handles all database operations for cashouts
 */

const isSQLite = process.env.DATABASE_URL?.startsWith('sqlite://');

/**
 * Create a new cashout record
 */
export async function createCashout(
  cashoutData: Omit<Cashout, 'id' | 'created_at' | 'updated_at'>
): Promise<Cashout> {
  try {
    const now = new Date();

    if (isSQLite) {
      const stmt = (db as any).prepare(`
        INSERT INTO cashouts (
          employee_address, amount_usdt, fiat_currency, fiat_amount,
          exchange_rate, tx_hash_onchain, payout_id_stripe,
          stripe_bank_account_id, status, error_message,
          created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        cashoutData.employee_address.toLowerCase(),
        cashoutData.amount_usdt,
        cashoutData.fiat_currency,
        cashoutData.fiat_amount || null,
        cashoutData.exchange_rate || null,
        cashoutData.tx_hash_onchain,
        cashoutData.payout_id_stripe || null,
        cashoutData.stripe_bank_account_id || null,
        cashoutData.status,
        cashoutData.error_message || null,
        now.toISOString(),
        now.toISOString()
      );

      return {
        ...cashoutData,
        id: result.lastInsertRowid,
        created_at: now,
        updated_at: now,
      };
    } else {
      // PostgreSQL
      const result = await (db as any).query(
        `INSERT INTO cashouts (
          employee_address, amount_usdt, fiat_currency, fiat_amount,
          exchange_rate, tx_hash_onchain, payout_id_stripe,
          stripe_bank_account_id, status, error_message,
          created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *`,
        [
          cashoutData.employee_address.toLowerCase(),
          cashoutData.amount_usdt,
          cashoutData.fiat_currency,
          cashoutData.fiat_amount || null,
          cashoutData.exchange_rate || null,
          cashoutData.tx_hash_onchain,
          cashoutData.payout_id_stripe || null,
          cashoutData.stripe_bank_account_id || null,
          cashoutData.status,
          cashoutData.error_message || null,
          now,
          now,
        ]
      );

      return result.rows[0];
    }
  } catch (error) {
    throw new Error(`Failed to create cashout: ${error}`);
  }
}

/**
 * Update cashout record
 */
export async function updateCashout(
  cashoutId: number,
  updates: Partial<Omit<Cashout, 'id' | 'employee_address' | 'created_at' | 'tx_hash_onchain'>>
): Promise<Cashout | null> {
  try {
    const now = new Date();
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Build update query dynamically
    if (updates.amount_usdt !== undefined) {
      fields.push(`amount_usdt = $${paramIndex}`);
      values.push(updates.amount_usdt);
      paramIndex++;
    }
    if (updates.fiat_currency !== undefined) {
      fields.push(`fiat_currency = $${paramIndex}`);
      values.push(updates.fiat_currency);
      paramIndex++;
    }
    if (updates.fiat_amount !== undefined) {
      fields.push(`fiat_amount = $${paramIndex}`);
      values.push(updates.fiat_amount);
      paramIndex++;
    }
    if (updates.exchange_rate !== undefined) {
      fields.push(`exchange_rate = $${paramIndex}`);
      values.push(updates.exchange_rate);
      paramIndex++;
    }
    if (updates.payout_id_stripe !== undefined) {
      fields.push(`payout_id_stripe = $${paramIndex}`);
      values.push(updates.payout_id_stripe);
      paramIndex++;
    }
    if (updates.stripe_bank_account_id !== undefined) {
      fields.push(`stripe_bank_account_id = $${paramIndex}`);
      values.push(updates.stripe_bank_account_id);
      paramIndex++;
    }
    if (updates.status !== undefined) {
      fields.push(`status = $${paramIndex}`);
      values.push(updates.status);
      paramIndex++;
    }
    if (updates.error_message !== undefined) {
      fields.push(`error_message = $${paramIndex}`);
      values.push(updates.error_message);
      paramIndex++;
    }
    if (updates.completed_at !== undefined || updates.status === 'paid') {
      fields.push(`completed_at = $${paramIndex}`);
      const completedAtValue = updates.completed_at || (updates.status === 'paid' ? now : null);
      values.push(isSQLite && completedAtValue ? (completedAtValue instanceof Date ? completedAtValue.toISOString() : completedAtValue) : completedAtValue);
      paramIndex++;
    }

    if (fields.length === 0) {
      return getCashoutById(cashoutId);
    }

    fields.push(`updated_at = $${paramIndex}`);
    values.push(isSQLite ? now.toISOString() : now);
    paramIndex++;

    if (isSQLite) {
      const placeholders = fields.map((f, i) => f.replace(`$${i + 1}`, '?'));
      const stmt = (db as any).prepare(`
        UPDATE cashouts
        SET ${placeholders.join(', ')}
        WHERE id = ?
      `);
      
      values.push(cashoutId);
      stmt.run(...values);

      return getCashoutById(cashoutId);
    } else {
      // PostgreSQL
      values.push(cashoutId);
      const result = await (db as any).query(
        `UPDATE cashouts
         SET ${fields.join(', ')}
         WHERE id = $${paramIndex}
         RETURNING *`,
        values
      );

      return result.rows[0] || null;
    }
  } catch (error) {
    throw new Error(`Failed to update cashout: ${error}`);
  }
}

/**
 * Get cashout by ID
 */
export async function getCashoutById(cashoutId: number): Promise<Cashout | null> {
  try {
    if (isSQLite) {
      const cashout = (db as any).prepare(
        'SELECT * FROM cashouts WHERE id = ? LIMIT 1'
      ).get(cashoutId);
      return cashout || null;
    } else {
      const result = await (db as any).query(
        'SELECT * FROM cashouts WHERE id = $1 LIMIT 1',
        [cashoutId]
      );
      return result.rows[0] || null;
    }
  } catch (error) {
    throw new Error(`Failed to get cashout: ${error}`);
  }
}

/**
 * Get cashout by payout ID (Stripe)
 */
export async function getCashoutByPayoutId(
  payoutId: string
): Promise<Cashout | null> {
  try {
    if (isSQLite) {
      const cashout = (db as any).prepare(
        'SELECT * FROM cashouts WHERE payout_id_stripe = ? LIMIT 1'
      ).get(payoutId);
      return cashout || null;
    } else {
      const result = await (db as any).query(
        'SELECT * FROM cashouts WHERE payout_id_stripe = $1 LIMIT 1',
        [payoutId]
      );
      return result.rows[0] || null;
    }
  } catch (error) {
    throw new Error(`Failed to get cashout by payout ID: ${error}`);
  }
}

/**
 * Get cashout by transaction hash
 */
export async function getCashoutByTxHash(
  txHash: string
): Promise<Cashout | null> {
  try {
    if (isSQLite) {
      const cashout = (db as any).prepare(
        'SELECT * FROM cashouts WHERE tx_hash_onchain = ? LIMIT 1'
      ).get(txHash);
      return cashout || null;
    } else {
      const result = await (db as any).query(
        'SELECT * FROM cashouts WHERE tx_hash_onchain = $1 LIMIT 1',
        [txHash]
      );
      return result.rows[0] || null;
    }
  } catch (error) {
    throw new Error(`Failed to get cashout by tx hash: ${error}`);
  }
}

/**
 * Get cashout history for employee
 */
export async function getCashoutHistoryByEmployee(
  employeeAddress: string,
  page: number = 1,
  limit: number = 20
): Promise<{ cashouts: Cashout[]; total: number }> {
  try {
    const offset = (page - 1) * limit;

    if (isSQLite) {
      // Get total count
      const countResult = (db as any).prepare(
        'SELECT COUNT(*) as total FROM cashouts WHERE employee_address = ?'
      ).get(employeeAddress.toLowerCase());
      const total = countResult.total;

      // Get cashouts
      const cashouts = (db as any)
        .prepare(
          'SELECT * FROM cashouts WHERE employee_address = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
        )
        .all(employeeAddress.toLowerCase(), limit, offset);

      return { cashouts, total };
    } else {
      // PostgreSQL
      const countResult = await (db as any).query(
        'SELECT COUNT(*) as total FROM cashouts WHERE employee_address = $1',
        [employeeAddress.toLowerCase()]
      );
      const total = parseInt(countResult.rows[0].total);

      const result = await (db as any).query(
        'SELECT * FROM cashouts WHERE employee_address = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
        [employeeAddress.toLowerCase(), limit, offset]
      );

      return { cashouts: result.rows, total };
    }
  } catch (error) {
    throw new Error(`Failed to get cashout history: ${error}`);
  }
}

/**
 * Get cashouts by status (for webhook processing)
 */
export async function getCashoutsByStatus(
  status: Cashout['status']
): Promise<Cashout[]> {
  try {
    if (isSQLite) {
      const cashouts = (db as any).prepare(
        'SELECT * FROM cashouts WHERE status = ? ORDER BY created_at ASC'
      ).all(status);
      return cashouts;
    } else {
      const result = await (db as any).query(
        'SELECT * FROM cashouts WHERE status = $1 ORDER BY created_at ASC',
        [status]
      );
      return result.rows;
    }
  } catch (error) {
    throw new Error(`Failed to get cashouts by status: ${error}`);
  }
}

