import db from '../config/database';
import { Payroll } from '../models/Payroll';
import { generatePayrollId } from '../utils/uuid';
import dotenv from 'dotenv';

// Load .env to ensure DATABASE_URL is available
dotenv.config();

/**
 * Payroll Database Service
 * Handles all database operations for payrolls
 */

const isSQLite = process.env.DATABASE_URL?.startsWith('sqlite://');

/**
 * Create payroll records (batch)
 */
export async function createPayrolls(
  payrolls: Array<{
    employer_address: string;
    employee_address: string;
    amount_usdt: string;
    payroll_id?: string;
  }>
): Promise<Payroll[]> {
  try {
    // Generate a shared payroll_id for the batch (all employees in same batch share same payroll_id)
    const payrollId = payrolls[0]?.payroll_id || generatePayrollId();
    const now = new Date();
    const createdPayrolls: Payroll[] = [];

    if (isSQLite) {
      const stmt = (db as any).prepare(`
        INSERT INTO payrolls (payroll_id, employer_address, employee_address, amount_usdt, status, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const payroll of payrolls) {
        const result = stmt.run(
          payroll.payroll_id || payrollId,
          payroll.employer_address.toLowerCase(),
          payroll.employee_address.toLowerCase(),
          payroll.amount_usdt,
          'pending',
          now.toISOString()
        );

        createdPayrolls.push({
          id: result.lastInsertRowid,
          payroll_id: payroll.payroll_id || payrollId,
          employer_address: payroll.employer_address,
          employee_address: payroll.employee_address,
          amount_usdt: payroll.amount_usdt,
          status: 'pending',
          timestamp: now,
        });
      }
    } else {
      // PostgreSQL - use transaction
      for (const payroll of payrolls) {
        const result = await (db as any).query(
          `INSERT INTO payrolls (payroll_id, employer_address, employee_address, amount_usdt, status, timestamp)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [
            payroll.payroll_id || payrollId,
            payroll.employer_address.toLowerCase(),
            payroll.employee_address.toLowerCase(),
            payroll.amount_usdt,
            'pending',
            now,
          ]
        );
        createdPayrolls.push(result.rows[0]);
      }
    }

    return createdPayrolls;
  } catch (error) {
    throw new Error(`Failed to create payrolls: ${error}`);
  }
}

/**
 * Update payroll status and transaction info
 */
export async function updatePayroll(
  payrollId: string,
  updates: {
    tx_hash?: string;
    block_number?: number;
    status?: 'pending' | 'completed' | 'failed';
  }
): Promise<Payroll | null> {
  try {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

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

    if (fields.length === 0) {
      return getPayrollByPayrollId(payrollId);
    }

    if (isSQLite) {
      const placeholders = fields.map((f, i) => f.replace(`$${i + 1}`, '?'));
      const stmt = (db as any).prepare(`
        UPDATE payrolls
        SET ${placeholders.join(', ')}
        WHERE payroll_id = ?
      `);
      
      values.push(payrollId);
      stmt.run(...values);

      return getPayrollByPayrollId(payrollId);
    } else {
      // PostgreSQL
      values.push(payrollId);
      const result = await (db as any).query(
        `UPDATE payrolls
         SET ${fields.join(', ')}
         WHERE payroll_id = $${paramIndex}
         RETURNING *`,
        values
      );

      return result.rows[0] || null;
    }
  } catch (error) {
    throw new Error(`Failed to update payroll: ${error}`);
  }
}

/**
 * Get payroll by payroll_id
 */
export async function getPayrollByPayrollId(
  payrollId: string
): Promise<Payroll | null> {
  try {
    if (isSQLite) {
      const payroll = (db as any).prepare(
        'SELECT * FROM payrolls WHERE payroll_id = ? LIMIT 1'
      ).get(payrollId);
      return payroll || null;
    } else {
      const result = await (db as any).query(
        'SELECT * FROM payrolls WHERE payroll_id = $1 LIMIT 1',
        [payrollId]
      );
      return result.rows[0] || null;
    }
  } catch (error) {
    throw new Error(`Failed to get payroll: ${error}`);
  }
}

/**
 * Get payroll history for employer
 */
export async function getPayrollHistoryByEmployer(
  employerAddress: string,
  page: number = 1,
  limit: number = 20
): Promise<{ payrolls: Payroll[]; total: number }> {
  try {
    const offset = (page - 1) * limit;

    if (isSQLite) {
      // Get total count
      const countResult = (db as any).prepare(
        'SELECT COUNT(*) as total FROM payrolls WHERE employer_address = ?'
      ).get(employerAddress.toLowerCase());
      const total = countResult.total;

      // Get payrolls
      const payrolls = (db as any)
        .prepare(
          'SELECT * FROM payrolls WHERE employer_address = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?'
        )
        .all(employerAddress.toLowerCase(), limit, offset);

      return { payrolls, total };
    } else {
      // PostgreSQL
      const countResult = await (db as any).query(
        'SELECT COUNT(*) as total FROM payrolls WHERE employer_address = $1',
        [employerAddress.toLowerCase()]
      );
      const total = parseInt(countResult.rows[0].total);

      const result = await (db as any).query(
        'SELECT * FROM payrolls WHERE employer_address = $1 ORDER BY timestamp DESC LIMIT $2 OFFSET $3',
        [employerAddress.toLowerCase(), limit, offset]
      );

      return { payrolls: result.rows, total };
    }
  } catch (error) {
    throw new Error(`Failed to get payroll history: ${error}`);
  }
}

/**
 * Get payroll history for employee
 */
export async function getPayrollHistoryByEmployee(
  employeeAddress: string,
  page: number = 1,
  limit: number = 20
): Promise<{ payrolls: Payroll[]; total: number }> {
  try {
    const offset = (page - 1) * limit;

    if (isSQLite) {
      // Get total count
      const countResult = (db as any).prepare(
        'SELECT COUNT(*) as total FROM payrolls WHERE employee_address = ?'
      ).get(employeeAddress.toLowerCase());
      const total = countResult.total;

      // Get payrolls
      const payrolls = (db as any)
        .prepare(
          'SELECT * FROM payrolls WHERE employee_address = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?'
        )
        .all(employeeAddress.toLowerCase(), limit, offset);

      return { payrolls, total };
    } else {
      // PostgreSQL
      const countResult = await (db as any).query(
        'SELECT COUNT(*) as total FROM payrolls WHERE employee_address = $1',
        [employeeAddress.toLowerCase()]
      );
      const total = parseInt(countResult.rows[0].total);

      const result = await (db as any).query(
        'SELECT * FROM payrolls WHERE employee_address = $1 ORDER BY timestamp DESC LIMIT $2 OFFSET $3',
        [employeeAddress.toLowerCase(), limit, offset]
      );

      return { payrolls: result.rows, total };
    }
  } catch (error) {
    throw new Error(`Failed to get payroll history: ${error}`);
  }
}

/**
 * Get payroll by transaction hash
 */
export async function getPayrollByTxHash(
  txHash: string
): Promise<Payroll | null> {
  try {
    if (isSQLite) {
      const payroll = (db as any).prepare(
        'SELECT * FROM payrolls WHERE tx_hash = ? LIMIT 1'
      ).get(txHash);
      return payroll || null;
    } else {
      const result = await (db as any).query(
        'SELECT * FROM payrolls WHERE tx_hash = $1 LIMIT 1',
        [txHash]
      );
      return result.rows[0] || null;
    }
  } catch (error) {
    throw new Error(`Failed to get payroll by tx hash: ${error}`);
  }
}

/**
 * Get all payrolls by payroll_id (for batch payrolls)
 */
export async function getPayrollsByPayrollId(
  payrollId: string
): Promise<Payroll[]> {
  try {
    if (isSQLite) {
      const payrolls = (db as any).prepare(
        'SELECT * FROM payrolls WHERE payroll_id = ? ORDER BY timestamp DESC'
      ).all(payrollId);
      return payrolls;
    } else {
      const result = await (db as any).query(
        'SELECT * FROM payrolls WHERE payroll_id = $1 ORDER BY timestamp DESC',
        [payrollId]
      );
      return result.rows;
    }
  } catch (error) {
    throw new Error(`Failed to get payrolls: ${error}`);
  }
}

