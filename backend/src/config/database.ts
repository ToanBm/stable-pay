import { Pool } from 'pg';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Load .env before checking DATABASE_URL
dotenv.config();

const dbUrl = process.env.DATABASE_URL || '';

let db: any;

// Check if using SQLite
if (dbUrl.startsWith('sqlite://')) {
  // Extract file path from sqlite:// URL
  const dbPath = dbUrl.replace('sqlite://', '');
  // Handle relative paths starting with ./
  const resolvedPath = dbPath.startsWith('./') || dbPath.startsWith('.\\') 
    ? path.join(process.cwd(), dbPath.substring(2))
    : path.resolve(process.cwd(), dbPath);
  
  // Ensure directory exists
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // Open database with write mode
  db = new Database(resolvedPath);
  
  // Enable foreign keys and WAL mode for better concurrency
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
} else if (dbUrl) {
  // Use PostgreSQL only if DATABASE_URL is provided and not SQLite
  db = new Pool({
    connectionString: dbUrl,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
} else {
  // Fallback: If no DATABASE_URL, default to SQLite
  const defaultDbPath = path.resolve(process.cwd(), './payroll.db');
  db = new Database(defaultDbPath);
  db.pragma('foreign_keys = ON');
}

export default db;

