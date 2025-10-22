import { MigrationInterface, QueryRunner } from 'typeorm';

export class IncreaseLogMessageLength1729522000000 implements MigrationInterface {
  name = 'IncreaseLogMessageLength1729522000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Change the message column from varchar(255) to text to allow longer messages
    await queryRunner.query(`
      ALTER TABLE "logs" 
      ALTER COLUMN "message" TYPE TEXT
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert back to varchar(255) - this might truncate existing data
    await queryRunner.query(`
      ALTER TABLE "logs" 
      ALTER COLUMN "message" TYPE VARCHAR(255)
    `);
  }
}
