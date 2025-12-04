import db from '../config/database';
import { readFileSync } from 'fs';
import path from 'path';

/**
 * Initialize database with schema
 * Run this once to create tables
 */
export function initializeDatabase() {
  const dbUrl = process.env.DATABASE_URL || '';
  
  if (dbUrl.startsWith('sqlite://')) {
    // SQLite - execute SQLite-compatible SQL file
    const sqlFile = readFileSync(
      path.join(__dirname, '../config/database.sqlite.sql'),
      'utf-8'
    );
    
    try {
      // Execute entire SQL file at once
      (db as any).exec(sqlFile);
      console.log('SQLite database initialized');
    } catch (error) {
      const errorMsg = (error as Error).message;
      // If tables already exist, that's okay
      if (!errorMsg.includes('already exists')) {
        console.error('Database initialization error:', errorMsg);
        // Try to continue anyway
      } else {
        console.log('SQLite database already initialized');
      }
    }
  } else {
    // PostgreSQL - use pg client
    const sqlFile = readFileSync(
      path.join(__dirname, '../config/database.sql'),
      'utf-8'
    );
    
    // For PostgreSQL, you would run this manually or use migrations
    console.log('PostgreSQL: Run database.sql manually or use migrations');
  }
}

