import { Request, Response } from 'express';
import { createPayrolls, updatePayroll, getPayrollsByPayrollId, getPayrollHistoryByEmployer, getPayrollHistoryByEmployee } from '../services/payrollService';
import { getUSDTBalance, isValidAddress, verifyPayrollTransaction } from '../utils/blockchain';
import { getUSDTContract } from '../config/blockchain';
import { ethers } from 'ethers';

/**
 * POST /api/payroll/prepare
 * Prepare a payroll batch - validate and calculate totals
 */
export async function preparePayroll(req: Request, res: Response) {
  try {
    const { employees, employer_address } = req.body;

    // Validation
    if (!employer_address || !isValidAddress(employer_address)) {
      return res.status(400).json({ error: 'Invalid employer address' });
    }

    if (!Array.isArray(employees) || employees.length === 0) {
      return res.status(400).json({ error: 'Employees array is required and cannot be empty' });
    }

    // Get USDT contract decimals (gUSDT on Stable has 18 decimals)
    const contract = getUSDTContract();
    const decimals = await contract.decimals();

    // Validate each employee entry
    const validatedEmployees = [];
    const seenAddresses = new Set<string>();
    let totalAmount = ethers.parseUnits('0', decimals);

    for (const emp of employees) {
      if (!emp.address || !isValidAddress(emp.address)) {
        return res.status(400).json({ error: `Invalid employee address: ${emp.address}` });
      }

      const normalizedAddress = emp.address.toLowerCase();
      
      // Check for duplicate addresses
      if (seenAddresses.has(normalizedAddress)) {
        return res.status(400).json({ error: `Duplicate employee address: ${emp.address}` });
      }
      seenAddresses.add(normalizedAddress);

      // Check if employee address is same as employer
      if (normalizedAddress === employer_address.toLowerCase()) {
        return res.status(400).json({ error: 'Employee address cannot be same as employer address' });
      }

      if (!emp.amount || parseFloat(emp.amount) <= 0) {
        return res.status(400).json({ error: `Invalid amount for employee ${emp.address}` });
      }

      // Validate amount is a valid number
      if (isNaN(parseFloat(emp.amount))) {
        return res.status(400).json({ error: `Amount must be a valid number for employee ${emp.address}` });
      }

      const amountWei = ethers.parseUnits(emp.amount, decimals);
      totalAmount += amountWei;

      validatedEmployees.push({
        employer_address,
        employee_address: emp.address,
        amount_usdt: emp.amount,
      });
    }

    // Check employer balance
    try {
      const balance = await getUSDTBalance(employer_address);
      const totalAmountStr = ethers.formatUnits(totalAmount, decimals);
      const balanceNum = parseFloat(balance);
      const requiredNum = parseFloat(totalAmountStr);
      
      if (balanceNum < requiredNum) {
        return res.status(400).json({
          error: 'Insufficient balance',
          balance: balance,
          required: totalAmountStr,
          shortfall: (requiredNum - balanceNum).toFixed(6),
        });
      }
    } catch (error: any) {
      // If balance check fails, log warning but continue (might be network issue)
      console.warn('Failed to check employer balance:', error.message);
      // In production, you might want to fail here for security
    }

    // Create payroll records in database
    const payrolls = await createPayrolls(validatedEmployees);
    const payrollId = payrolls[0]?.payroll_id;

    if (!payrollId) {
      throw new Error('Failed to create payroll records');
    }

    res.json({
      payrollId,
      totalAmount: ethers.formatUnits(totalAmount, decimals),
      employeeCount: validatedEmployees.length,
      employees: validatedEmployees.map((emp) => ({
        address: emp.employee_address,
        amount: emp.amount_usdt,
      })),
      status: 'pending',
    });
  } catch (error: any) {
    console.error('Error preparing payroll:', error);
    res.status(500).json({ error: error.message || 'Failed to prepare payroll' });
  }
}

/**
 * POST /api/payroll/execute
 * Record transaction hash after payroll is executed on-chain
 * Verifies transaction on-chain before updating status
 */
export async function executePayroll(req: Request, res: Response) {
  try {
    const { payrollId, txHash, blockNumber } = req.body;

    if (!payrollId) {
      return res.status(400).json({ error: 'payrollId is required' });
    }

    if (!txHash) {
      return res.status(400).json({ error: 'txHash is required' });
    }

    // Get all payrolls in this batch
    const payrolls = await getPayrollsByPayrollId(payrollId);

    if (payrolls.length === 0) {
      return res.status(404).json({ error: 'Payroll not found' });
    }

    // Get employer address from first payroll
    const employerAddress = payrolls[0].employer_address;

    // Verify transaction on-chain
    let verifiedTransfers;
    let verifiedBlockNumber = blockNumber;

    try {
      const verification = await verifyPayrollTransaction(txHash, employerAddress);
      verifiedTransfers = verification.transfers;
      verifiedBlockNumber = verification.blockNumber;

      // Verify that all expected employees received their payments
      const expectedEmployees = new Map<string, string>();
      for (const payroll of payrolls) {
        const addr = payroll.employee_address.toLowerCase();
        expectedEmployees.set(addr, payroll.amount_usdt);
      }

      const receivedEmployees = new Set<string>();
      for (const transfer of verifiedTransfers) {
        const to = transfer.to.toLowerCase();
        const expectedAmount = expectedEmployees.get(to);
        
        if (expectedAmount) {
          // Allow small tolerance for rounding differences
          const diff = Math.abs(parseFloat(transfer.amount) - parseFloat(expectedAmount));
          if (diff > 0.01) {
            return res.status(400).json({
              error: `Amount mismatch for employee ${transfer.to}`,
              expected: expectedAmount,
              received: transfer.amount,
            });
          }
          receivedEmployees.add(to);
        }
      }

      // Check if all employees received payments
      if (receivedEmployees.size !== expectedEmployees.size) {
        const missing = Array.from(expectedEmployees.keys()).filter(
          (addr) => !receivedEmployees.has(addr)
        );
        return res.status(400).json({
          error: 'Not all employees received payments',
          missing: missing,
        });
      }
    } catch (error: any) {
      // If verification fails, still allow update but mark as failed
      console.error('Transaction verification failed:', error);
      
      // Update payrolls with failed status
      await Promise.all(
        payrolls.map((payroll) =>
          updatePayroll(payroll.payroll_id, {
            tx_hash: txHash,
            block_number: blockNumber,
            status: 'failed',
          })
        )
      );

      return res.status(400).json({
        error: 'Transaction verification failed',
        details: error.message,
      });
    }

    // Update all payrolls in the batch with transaction info
    const updatePromises = payrolls.map((payroll) =>
      updatePayroll(payroll.payroll_id, {
        tx_hash: txHash,
        block_number: verifiedBlockNumber,
        status: 'completed',
      })
    );

    await Promise.all(updatePromises);

    // Fetch updated payrolls
    const updatedPayrolls = await getPayrollsByPayrollId(payrollId);

    res.json({
      success: true,
      payrollId,
      txHash,
      blockNumber: verifiedBlockNumber,
      employeeCount: updatedPayrolls.length,
      transfersVerified: verifiedTransfers.length,
      status: 'completed',
    });
  } catch (error: any) {
    console.error('Error executing payroll:', error);
    res.status(500).json({ error: error.message || 'Failed to execute payroll' });
  }
}

/**
 * GET /api/payroll/history
 * Get payroll history for employer or employee
 */
export async function getPayrollHistory(req: Request, res: Response) {
  try {
    const { employerAddress, employeeAddress } = req.query;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    if (!employerAddress && !employeeAddress) {
      return res.status(400).json({ error: 'Either employerAddress or employeeAddress is required' });
    }

    let result;

    if (employerAddress) {
      if (!isValidAddress(employerAddress as string)) {
        return res.status(400).json({ error: 'Invalid employer address' });
      }
      result = await getPayrollHistoryByEmployer(employerAddress as string, page, limit);
    } else {
      if (!isValidAddress(employeeAddress as string)) {
        return res.status(400).json({ error: 'Invalid employee address' });
      }
      result = await getPayrollHistoryByEmployee(employeeAddress as string, page, limit);
    }

    res.json({
      payrolls: result.payrolls,
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
    });
  } catch (error: any) {
    console.error('Error getting payroll history:', error);
    res.status(500).json({ error: error.message || 'Failed to get payroll history' });
  }
}

