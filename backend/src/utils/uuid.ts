/**
 * Generate a unique ID for payroll_id
 * Simple implementation using timestamp + random string
 */
export function generatePayrollId(): string {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 9);
  return `payroll_${timestamp}_${randomStr}`;
}

