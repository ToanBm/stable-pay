import db from '../config/database';
import { Employee } from '../models/Employee';
import dotenv from 'dotenv';

// Load .env to ensure DATABASE_URL is available
dotenv.config();

/**
 * Employee Database Service
 * Handles all database operations for employees
 */

const isSQLite = process.env.DATABASE_URL?.startsWith('sqlite://');

/**
 * Get employee by wallet address
 */
export async function getEmployeeByAddress(
  walletAddress: string
): Promise<Employee | null> {
  try {
    if (isSQLite) {
      const employee = (db as any).prepare(
        'SELECT * FROM employees WHERE wallet_address = ?'
      ).get(walletAddress.toLowerCase());
      return employee || null;
    } else {
      // PostgreSQL
      const result = await (db as any).query(
        'SELECT * FROM employees WHERE wallet_address = $1',
        [walletAddress.toLowerCase()]
      );
      return result.rows[0] || null;
    }
  } catch (error) {
    throw new Error(`Failed to get employee: ${error}`);
  }
}

/**
 * Create a new employee
 */
export async function createEmployee(
  employeeData: Omit<Employee, 'id' | 'created_at' | 'updated_at'>
): Promise<Employee> {
  try {
    const now = new Date();

    if (isSQLite) {
      const stmt = (db as any).prepare(`
        INSERT INTO employees (wallet_address, name, email, country, stripe_bank_account_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        employeeData.wallet_address.toLowerCase(),
        employeeData.name || null,
        employeeData.email || null,
        employeeData.country || null,
        employeeData.stripe_bank_account_id || null,
        now.toISOString(),
        now.toISOString()
      );

      return {
        ...employeeData,
        id: result.lastInsertRowid,
        created_at: now,
        updated_at: now,
      };
    } else {
      // PostgreSQL
      const result = await (db as any).query(
        `INSERT INTO employees (wallet_address, name, email, country, stripe_bank_account_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          employeeData.wallet_address.toLowerCase(),
          employeeData.name || null,
          employeeData.email || null,
          employeeData.country || null,
          employeeData.stripe_bank_account_id || null,
          now,
          now,
        ]
      );

      return result.rows[0];
    }
  } catch (error: any) {
    if (error.message?.includes('UNIQUE constraint') || error.code === '23505') {
      throw new Error('Employee with this wallet address already exists');
    }
    throw new Error(`Failed to create employee: ${error}`);
  }
}

/**
 * Update employee information
 */
export async function updateEmployee(
  walletAddress: string,
  updates: Partial<Omit<Employee, 'id' | 'wallet_address' | 'created_at'>>
): Promise<Employee | null> {
  try {
    const now = new Date();
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Build update query dynamically
    if (updates.name !== undefined) {
      fields.push(`name = $${paramIndex}`);
      values.push(updates.name);
      paramIndex++;
    }
    if (updates.email !== undefined) {
      fields.push(`email = $${paramIndex}`);
      values.push(updates.email);
      paramIndex++;
    }
    if (updates.country !== undefined) {
      fields.push(`country = $${paramIndex}`);
      values.push(updates.country);
      paramIndex++;
    }
    if (updates.stripe_bank_account_id !== undefined) {
      fields.push(`stripe_bank_account_id = $${paramIndex}`);
      values.push(updates.stripe_bank_account_id);
      paramIndex++;
    }

    if (fields.length === 0) {
      return getEmployeeByAddress(walletAddress);
    }

    fields.push(`updated_at = $${paramIndex}`);
    values.push(isSQLite ? now.toISOString() : now);
    paramIndex++;

    if (isSQLite) {
      const placeholders = fields.map((f, i) => f.replace(`$${i + 1}`, '?'));
      const stmt = (db as any).prepare(`
        UPDATE employees
        SET ${placeholders.join(', ')}
        WHERE wallet_address = ?
      `);
      
      values.push(walletAddress.toLowerCase());
      stmt.run(...values);

      return getEmployeeByAddress(walletAddress);
    } else {
      // PostgreSQL
      values.push(walletAddress.toLowerCase());
      const result = await (db as any).query(
        `UPDATE employees
         SET ${fields.join(', ')}
         WHERE wallet_address = $${paramIndex}
         RETURNING *`,
        values
      );

      return result.rows[0] || null;
    }
  } catch (error) {
    throw new Error(`Failed to update employee: ${error}`);
  }
}

/**
 * Delete employee by wallet address
 */
export async function deleteEmployee(walletAddress: string): Promise<boolean> {
  try {
    if (isSQLite) {
      const stmt = (db as any).prepare(
        'DELETE FROM employees WHERE wallet_address = ?'
      );
      const result = stmt.run(walletAddress.toLowerCase());
      return result.changes > 0;
    } else {
      // PostgreSQL
      const result = await (db as any).query(
        'DELETE FROM employees WHERE wallet_address = $1',
        [walletAddress.toLowerCase()]
      );
      return result.rowCount > 0;
    }
  } catch (error) {
    throw new Error(`Failed to delete employee: ${error}`);
  }
}

/**
 * List all employees (with pagination)
 */
export async function listEmployees(
  page: number = 1,
  limit: number = 20
): Promise<{ employees: Employee[]; total: number }> {
  try {
    const offset = (page - 1) * limit;

    if (isSQLite) {
      // Get total count
      const countResult = (db as any).prepare(
        'SELECT COUNT(*) as total FROM employees'
      ).get();
      const total = countResult.total;

      // Get employees
      const employees = (db as any)
        .prepare('SELECT * FROM employees ORDER BY created_at DESC LIMIT ? OFFSET ?')
        .all(limit, offset);

      return { employees, total };
    } else {
      // PostgreSQL
      const countResult = await (db as any).query(
        'SELECT COUNT(*) as total FROM employees'
      );
      const total = parseInt(countResult.rows[0].total);

      const result = await (db as any).query(
        'SELECT * FROM employees ORDER BY created_at DESC LIMIT $1 OFFSET $2',
        [limit, offset]
      );

      return { employees: result.rows, total };
    }
  } catch (error) {
    throw new Error(`Failed to list employees: ${error}`);
  }
}

