import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTotalCallsAndLastResetToSystemAccessTokens1738207000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE system_access_tokens
      ADD COLUMN IF NOT EXISTS "totalCalls" INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "lastResetAt" TIMESTAMP WITH TIME ZONE NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE system_access_tokens
      DROP COLUMN IF EXISTS "totalCalls",
      DROP COLUMN IF EXISTS "lastResetAt";
    `);
  }
}


