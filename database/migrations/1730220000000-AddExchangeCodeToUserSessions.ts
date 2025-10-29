import { MigrationInterface, QueryRunner } from "typeorm";

export class AddExchangeCodeToUserSessions1730220000000 implements MigrationInterface {
  name = 'AddExchangeCodeToUserSessions1730220000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user_sessions" ADD COLUMN IF NOT EXISTS "exchangeCode" text`);
    await queryRunner.query(`ALTER TABLE "user_sessions" ADD COLUMN IF NOT EXISTS "exchangeCodeRequestedAt" TIMESTAMP NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user_sessions" DROP COLUMN IF EXISTS "exchangeCodeRequestedAt"`);
    await queryRunner.query(`ALTER TABLE "user_sessions" DROP COLUMN IF EXISTS "exchangeCode"`);
  }
}


