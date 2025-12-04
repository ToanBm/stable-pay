import { Router } from 'express';
import * as employeeController from '../controllers/employeeController';

const router = Router();

// GET /api/employees - List all employees
router.get('/', employeeController.listAllEmployees);

// POST /api/employees/register
router.post('/register', employeeController.registerEmployee);

// GET /api/employees/:address
router.get('/:address', employeeController.getEmployee);

// PUT /api/employees/:address
router.put('/:address', employeeController.updateEmployeeInfo);

// DELETE /api/employees/:address
router.delete('/:address', employeeController.deleteEmployeeInfo);

export default router;

