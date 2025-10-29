import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExtendLogContextToText1738209000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "logs" ALTER COLUMN "context" TYPE text;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Best-effort down migration: truncate values longer than 255 and cast back
    await queryRunner.query(`
      ALTER TABLE "logs" ALTER COLUMN "context" TYPE varchar(255);
    `);
  }
}
