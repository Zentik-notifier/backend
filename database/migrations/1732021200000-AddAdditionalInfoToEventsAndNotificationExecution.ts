import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAdditionalInfoToEventsAndNotificationExecution1732021200000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add additionalInfo column to events table
    await queryRunner.query(`
      ALTER TABLE "events" 
      ADD COLUMN "additionalInfo" jsonb
    `);

    // Add comment to describe the column
    await queryRunner.query(`
      COMMENT ON COLUMN "events"."additionalInfo" 
      IS 'Additional information stored as JSON'
    `);

    // Add NOTIFICATION value to ExecutionType enum
    await queryRunner.commitTransaction();
    await queryRunner.startTransaction();

    await queryRunner.query(`
      ALTER TYPE "entity_executions_type_enum" 
      ADD VALUE IF NOT EXISTS 'NOTIFICATION'
    `);

    // Commit to make the enum value available
    await queryRunner.commitTransaction();
    await queryRunner.startTransaction();
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove additionalInfo column from events table
    await queryRunner.query(`
      ALTER TABLE "events" 
      DROP COLUMN "additionalInfo"
    `);

    // Note: Cannot remove enum values in PostgreSQL
    // The NOTIFICATION enum value will remain but won't be used
  }
}
