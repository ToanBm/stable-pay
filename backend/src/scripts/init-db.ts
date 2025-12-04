import dotenv from 'dotenv';
import { initializeDatabase } from '../utils/database';

dotenv.config();

console.log('Initializing database...');
initializeDatabase();
console.log('Database initialization complete!');

