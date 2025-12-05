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
    // Try to find file from project root (for production) or src (for development)
    const sqlitePath = path.join(process.cwd(), 'src/config/database.sqlite.sql');
    const sqlitePathDist = path.join(process.cwd(), 'dist/config/database.sqlite.sql');
    const sqlitePathAlt = path.join(__dirname, '../config/database.sqlite.sql');
    
    let sqlFile: string;
    try {
      sqlFile = readFileSync(sqlitePath, 'utf-8');
    } catch {
      try {
        sqlFile = readFileSync(sqlitePathDist, 'utf-8');
      } catch {
        sqlFile = readFileSync(sqlitePathAlt, 'utf-8');
      }
    }
    
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
    const sqlPath = path.join(process.cwd(), 'src/config/database.sql');
    const sqlPathDist = path.join(process.cwd(), 'dist/config/database.sql');
    const sqlPathAlt = path.join(__dirname, '../config/database.sql');
    
    let sqlFile: string;
    try {
      sqlFile = readFileSync(sqlPath, 'utf-8');
    } catch {
      try {
        sqlFile = readFileSync(sqlPathDist, 'utf-8');
      } catch {
        sqlFile = readFileSync(sqlPathAlt, 'utf-8');
      }
    }
    
    // For PostgreSQL, you would run this manually or use migrations
    console.log('PostgreSQL: Run database.sql manually or use migrations');
  }
}

