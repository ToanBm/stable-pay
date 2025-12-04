import db from '../config/database';
import { Payment } from '../models/Payment';
import dotenv from 'dotenv';

// Load .env to ensure DATABASE_URL is available
dotenv.config();

/**
 * Payment Database Service
 * Handles all database operations for payments (on-ramp)
 */

const isSQLite = process.env.DATABASE_URL?.startsWith('sqlite://');

/**
 * Create a new payment record
 */
export async function createPayment(
  paymentData: Omit<Payment, 'id' | 'created_at' | 'updated_at'>
): Promise<Payment> {
  try {
    const now = new Date();

    if (isSQLite) {
      const stmt = (db as any).prepare(`
        INSERT INTO payments (
          payment_intent_id, wallet_address, amount_fiat, fiat_currency,
          amount_usdt, exchange_rate, status, error_message,
          created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        paymentData.payment_intent_id,
        paymentData.wallet_address.toLowerCase(),
        paymentData.amount_fiat,
        paymentData.fiat_currency.toLowerCase(),
        paymentData.amount_usdt,
        paymentData.exchange_rate,
        paymentData.status,
        paymentData.error_message || null,
        now.toISOString(),
        now.toISOString()
      );

      return {
        ...paymentData,
        id: result.lastInsertRowid,
        created_at: now,
        updated_at: now,
      };
    } else {
      // PostgreSQL
      const result = await (db as any).query(
        `INSERT INTO payments (
          payment_intent_id, wallet_address, amount_fiat, fiat_currency,
          amount_usdt, exchange_rate, status, error_message,
          created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
          paymentData.payment_intent_id,
          paymentData.wallet_address.toLowerCase(),
          paymentData.amount_fiat,
          paymentData.fiat_currency.toLowerCase(),
          paymentData.amount_usdt,
          paymentData.exchange_rate,
          paymentData.status,
          paymentData.error_message || null,
          now,
          now,
        ]
      );

      return result.rows[0];
    }
  } catch (error: any) {
    if (error.message?.includes('UNIQUE constraint') || error.code === '23505') {
      throw new Error('Payment with this payment intent ID already exists');
    }
    throw new Error(`Failed to create payment: ${error}`);
  }
}

/**
 * Update payment record
 */
export async function updatePayment(
  paymentId: number,
  updates: Partial<Omit<Payment, 'id' | 'payment_intent_id' | 'created_at' | 'wallet_address'>>
): Promise<Payment | null> {
  try {
    const now = new Date();
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Build update query dynamically
    if (updates.amount_fiat !== undefined) {
      fields.push(`amount_fiat = $${paramIndex}`);
      values.push(updates.amount_fiat);
      paramIndex++;
    }
    if (updates.fiat_currency !== undefined) {
      fields.push(`fiat_currency = $${paramIndex}`);
      values.push(updates.fiat_currency);
      paramIndex++;
    }
    if (updates.amount_usdt !== undefined) {
      fields.push(`amount_usdt = $${paramIndex}`);
      values.push(updates.amount_usdt);
      paramIndex++;
    }
    if (updates.exchange_rate !== undefined) {
      fields.push(`exchange_rate = $${paramIndex}`);
      values.push(updates.exchange_rate);
      paramIndex++;
    }
    if (updates.tx_hash !== undefined) {
      fields.push(`tx_hash = $${paramIndex}`);
      values.push(updates.tx_hash);
      paramIndex++;
    }
    if (updates.block_number !== undefined) {
      fields.push(`block_number = $${paramIndex}`);
      values.push(updates.block_number);
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
    if (updates.completed_at !== undefined || updates.status === 'completed') {
      fields.push(`completed_at = $${paramIndex}`);
      const completedAtValue = updates.completed_at || (updates.status === 'completed' ? now : null);
      values.push(isSQLite && completedAtValue ? (completedAtValue instanceof Date ? completedAtValue.toISOString() : completedAtValue) : completedAtValue);
      paramIndex++;
    }

    if (fields.length === 0) {
      return getPaymentById(paymentId);
    }

    fields.push(`updated_at = $${paramIndex}`);
    values.push(isSQLite ? now.toISOString() : now);
    paramIndex++;

    if (isSQLite) {
      const placeholders = fields.map((f, i) => f.replace(`$${i + 1}`, '?'));
      const stmt = (db as any).prepare(`
        UPDATE payments
        SET ${placeholders.join(', ')}
        WHERE id = ?
      `);
      
      values.push(paymentId);
      stmt.run(...values);

      return getPaymentById(paymentId);
    } else {
      // PostgreSQL
      values.push(paymentId);
      const result = await (db as any).query(
        `UPDATE payments
         SET ${fields.join(', ')}
         WHERE id = $${paramIndex}
         RETURNING *`,
        values
      );

      return result.rows[0] || null;
    }
  } catch (error) {
    throw new Error(`Failed to update payment: ${error}`);
  }
}

/**
 * Get payment by ID
 */
export async function getPaymentById(paymentId: number): Promise<Payment | null> {
  try {
    if (isSQLite) {
      const payment = (db as any).prepare(
        'SELECT * FROM payments WHERE id = ? LIMIT 1'
      ).get(paymentId);
      return payment || null;
    } else {
      const result = await (db as any).query(
        'SELECT * FROM payments WHERE id = $1 LIMIT 1',
        [paymentId]
      );
      return result.rows[0] || null;
    }
  } catch (error) {
    throw new Error(`Failed to get payment: ${error}`);
  }
}

/**
 * Get payment by payment intent ID
 */
export async function getPaymentByPaymentIntentId(
  paymentIntentId: string
): Promise<Payment | null> {
  try {
    if (isSQLite) {
      const payment = (db as any).prepare(
        'SELECT * FROM payments WHERE payment_intent_id = ? LIMIT 1'
      ).get(paymentIntentId);
      return payment || null;
    } else {
      const result = await (db as any).query(
        'SELECT * FROM payments WHERE payment_intent_id = $1 LIMIT 1',
        [paymentIntentId]
      );
      return result.rows[0] || null;
    }
  } catch (error) {
    throw new Error(`Failed to get payment by payment intent ID: ${error}`);
  }
}

/**
 * Get payment by transaction hash
 */
export async function getPaymentByTxHash(
  txHash: string
): Promise<Payment | null> {
  try {
    if (isSQLite) {
      const payment = (db as any).prepare(
        'SELECT * FROM payments WHERE tx_hash = ? LIMIT 1'
      ).get(txHash);
      return payment || null;
    } else {
      const result = await (db as any).query(
        'SELECT * FROM payments WHERE tx_hash = $1 LIMIT 1',
        [txHash]
      );
      return result.rows[0] || null;
    }
  } catch (error) {
    throw new Error(`Failed to get payment by tx hash: ${error}`);
  }
}

/**
 * Get payment history for a wallet address
 */
export async function getPaymentHistoryByWallet(
  walletAddress: string,
  page: number = 1,
  limit: number = 20
): Promise<{ payments: Payment[]; total: number }> {
  try {
    const offset = (page - 1) * limit;

    if (isSQLite) {
      // Get total count
      const countResult = (db as any).prepare(
        'SELECT COUNT(*) as total FROM payments WHERE wallet_address = ?'
      ).get(walletAddress.toLowerCase());
      const total = countResult.total;

      // Get payments
      const payments = (db as any)
        .prepare(
          'SELECT * FROM payments WHERE wallet_address = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
        )
        .all(walletAddress.toLowerCase(), limit, offset);

      return { payments, total };
    } else {
      // PostgreSQL
      const countResult = await (db as any).query(
        'SELECT COUNT(*) as total FROM payments WHERE wallet_address = $1',
        [walletAddress.toLowerCase()]
      );
      const total = parseInt(countResult.rows[0].total);

      const result = await (db as any).query(
        'SELECT * FROM payments WHERE wallet_address = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
        [walletAddress.toLowerCase(), limit, offset]
      );

      return { payments: result.rows, total };
    }
  } catch (error) {
    throw new Error(`Failed to get payment history: ${error}`);
  }
}

/**
 * Get payments by status (for webhook processing)
 */
export async function getPaymentsByStatus(
  status: Payment['status']
): Promise<Payment[]> {
  try {
    if (isSQLite) {
      const payments = (db as any).prepare(
        'SELECT * FROM payments WHERE status = ? ORDER BY created_at ASC'
      ).all(status);
      return payments;
    } else {
      const result = await (db as any).query(
        'SELECT * FROM payments WHERE status = $1 ORDER BY created_at ASC',
        [status]
      );
      return result.rows;
    }
  } catch (error) {
    throw new Error(`Failed to get payments by status: ${error}`);
  }
}

