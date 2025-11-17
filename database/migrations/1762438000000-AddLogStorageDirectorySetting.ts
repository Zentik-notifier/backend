import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLogStorageDirectorySetting1762438000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add LogStorageDirectory to enum - needs to be committed before use
    // We need to release the transaction, add the enum value, then continue
    await queryRunner.commitTransaction();
    await queryRunner.startTransaction();
    
    await queryRunner.query(`
      ALTER TYPE "server_setting_type_enum" 
      ADD VALUE IF NOT EXISTS 'LogStorageDirectory'
    `);
    
    // Commit to make the enum value available
    await queryRunner.commitTransaction();
    await queryRunner.startTransaction();

    // Insert default value for LogStorageDirectory
    await queryRunner.query(`
      INSERT INTO "server_settings" 
        ("configType", "valueText", "createdAt", "updatedAt") 
      VALUES 
        ('LogStorageDirectory', 'logs', NOW(), NOW())
      ON CONFLICT ("configType") DO NOTHING
    `);

    // Remove LogStorageEnabled setting (no longer needed, always enabled)
    await queryRunner.query(`
      DELETE FROM "server_settings" 
      WHERE "configType" = 'LogStorageEnabled'
    `);

    // Drop the logs table since we're moving to JSON file storage
    await queryRunner.query(`DROP TABLE IF EXISTS "logs"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Recreate the logs table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "level" character varying NOT NULL,
        "message" text NOT NULL,
        "context" character varying,
        "trace" text,
        "metadata" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_logs" PRIMARY KEY ("id")
      )
    `);

    // Create index on createdAt for performance
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_logs_createdAt" 
      ON "logs" ("createdAt")
    `);

    // Re-add LogStorageEnabled setting
    await queryRunner.query(`
      INSERT INTO "server_settings" 
        ("configType", "valueBool", "createdAt", "updatedAt") 
      VALUES 
        ('LogStorageEnabled', true, NOW(), NOW())
      ON CONFLICT ("configType") DO NOTHING
    `);

    // Remove the setting
    await queryRunner.query(`
      DELETE FROM "server_settings" 
      WHERE "configType" = 'LogStorageDirectory'
    `);

    // Note: Cannot remove enum values in PostgreSQL
    // The enum value will remain but won't be used
  }
}
