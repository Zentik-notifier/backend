import { MigrationInterface, QueryRunner } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Initial database schema migration
 * 
 * This migration creates the complete database schema from the exported schema_init.sql file.
 * It only runs if the database is completely empty (no tables exist).
 * 
 * For existing databases, this migration is safely skipped.
 */
export class InitialSchema1762016264000 implements MigrationInterface {
  name = 'InitialSchema1762016264000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if database already has tables (indicates an existing installation)
    const tables = await queryRunner.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND table_name != 'migrations'
        AND table_name != 'typeorm_metadata';
    `);

    if (tables.length > 0) {
      // Database already initialized - skip this migration
      console.log('✅ Database already initialized, skipping schema creation');
      return;
    }

    // Database is empty - run initial schema
    console.log('🗄️  Initializing empty database with full schema...');

    // Load and execute schema_init.sql
    // Try multiple paths to support both development and production (dist) builds
    const possiblePaths = [
      path.join(__dirname, '../schema_init.sql'), // Development: database/migrations -> database/schema_init.sql
      path.join(__dirname, '../../database/schema_init.sql'), // Production: dist/database/migrations -> database/schema_init.sql
      path.join(process.cwd(), 'database/schema_init.sql'), // Root: backend/database/schema_init.sql
      path.join(process.cwd(), 'schema_init.sql'), // Fallback: backend/schema_init.sql
    ];

    let schemaPath: string | null = null;
    for (const candidatePath of possiblePaths) {
      if (fs.existsSync(candidatePath)) {
        schemaPath = candidatePath;
        console.log(`✅ Found schema file at: ${schemaPath}`);
        break;
      }
    }

    if (!schemaPath) {
      const pathsTried = possiblePaths.join('\n  - ');
      throw new Error(`Schema file not found. Tried paths:\n  - ${pathsTried}`);
    }

    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    
    // Execute the entire schema SQL at once
    // PostgreSQL can handle large multi-statement SQL files
    try {
      await queryRunner.query(schemaSql);
      console.log('✅ Database schema initialized successfully');
    } catch (error: any) {
      // If that fails, try cleaning and splitting
      console.log('⚠️  Direct execution failed, trying cleaned version...');
      const cleanedSql = this.cleanPgDumpOutput(schemaSql);
      await queryRunner.query(cleanedSql);
      console.log('✅ Database schema initialized successfully (cleaned version)');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // This migration is meant for fresh installations only
    // Reverting would be dangerous for existing databases
    console.log('⚠️  Cannot safely revert initial schema migration');
  }

  /**
   * Remove pg_dump specific commands from SQL
   */
  private cleanPgDumpOutput(sql: string): string {
    let cleaned = sql;
    
    // Remove SET commands
    cleaned = cleaned.replace(/^SET\s+\w+\s*=.*;?\s*$/gm, '');
    
    // Remove SELECT pg_catalog commands
    cleaned = cleaned.replace(/^SELECT pg_catalog\..*;?\s*$/gm, '');
    
    // Remove ALTER ... OWNER commands
    cleaned = cleaned.replace(/^ALTER\s+[A-Z_]+\s+.*OWNER\s+TO.*;?\s*$/gm, '');
    
    // Remove COMMENT commands
    cleaned = cleaned.replace(/^COMMENT\s+ON.*;?\s*$/gm, '');
    
    // Remove GRANT commands
    cleaned = cleaned.replace(/^GRANT\s+.*ON.*TO.*;?\s*$/gm, '');
    
    // Remove PostgreSQL dump comments
    cleaned = cleaned.replace(/^--\s*PostgreSQL.*$/gm, '');
    cleaned = cleaned.replace(/^--\s*Dumped by.*$/gm, '');
    cleaned = cleaned.replace(/^--\s*$/gm, '');
    cleaned = cleaned.replace(/^--\s*Name:.*$/gm, '');
    cleaned = cleaned.replace(/^--\s*Type:.*$/gm, '');
    
    return cleaned;
  }
}

