import { Request, Response } from 'express';
import { getEmployeeByAddress, createEmployee, updateEmployee, deleteEmployee, listEmployees } from '../services/employeeService';
import { isValidAddress } from '../utils/blockchain';

/**
 * GET /api/employees/:address
 * Get employee by wallet address
 */
export async function getEmployee(req: Request, res: Response) {
  try {
    const { address } = req.params;

    if (!address || !isValidAddress(address)) {
      return res.status(400).json({ error: 'Invalid address' });
    }

    const employee = await getEmployeeByAddress(address);

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    res.json(employee);
  } catch (error: any) {
    console.error('Error getting employee:', error);
    res.status(500).json({ error: error.message || 'Failed to get employee' });
  }
}

/**
 * POST /api/employees/register
 * Register a new employee
 */
export async function registerEmployee(req: Request, res: Response) {
  try {
    const { wallet_address, name, email, country, stripe_bank_account_id } = req.body;

    if (!wallet_address || !isValidAddress(wallet_address)) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }

    // Check if employee already exists
    const existing = await getEmployeeByAddress(wallet_address);
    if (existing) {
      return res.status(400).json({ error: 'Employee already exists' });
    }

    const employee = await createEmployee({
      wallet_address,
      name,
      email,
      country,
      stripe_bank_account_id,
    });

    res.status(201).json(employee);
  } catch (error: any) {
    console.error('Error registering employee:', error);
    res.status(500).json({ error: error.message || 'Failed to register employee' });
  }
}

/**
 * PUT /api/employees/:address
 * Update employee information
 */
export async function updateEmployeeInfo(req: Request, res: Response) {
  try {
    const { address } = req.params;
    const { name, email, country, stripe_bank_account_id } = req.body;

    if (!address || !isValidAddress(address)) {
      return res.status(400).json({ error: 'Invalid address' });
    }

    const employee = await updateEmployee(address, {
      name,
      email,
      country,
      stripe_bank_account_id,
    });

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    res.json(employee);
  } catch (error: any) {
    console.error('Error updating employee:', error);
    res.status(500).json({ error: error.message || 'Failed to update employee' });
  }
}

/**
 * DELETE /api/employees/:address
 * Delete employee
 */
export async function deleteEmployeeInfo(req: Request, res: Response) {
  try {
    const { address } = req.params;

    if (!address || !isValidAddress(address)) {
      return res.status(400).json({ error: 'Invalid address' });
    }

    const deleted = await deleteEmployee(address);

    if (!deleted) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    res.json({ success: true, message: 'Employee deleted' });
  } catch (error: any) {
    console.error('Error deleting employee:', error);
    res.status(500).json({ error: error.message || 'Failed to delete employee' });
  }
}

/**
 * GET /api/employees
 * List all employees (with pagination)
 */
export async function listAllEmployees(req: Request, res: Response) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await listEmployees(page, limit);

    res.json({
      employees: result.employees,
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
    });
  } catch (error: any) {
    console.error('Error listing employees:', error);
    res.status(500).json({ error: error.message || 'Failed to list employees' });
  }
}

