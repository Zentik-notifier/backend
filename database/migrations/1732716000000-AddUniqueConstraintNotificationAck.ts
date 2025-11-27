import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUniqueConstraintNotificationAck1732716000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // First, remove duplicates keeping the oldest record
    await queryRunner.query(`
      DELETE FROM events e1
      USING events e2
      WHERE e1.type = 'NOTIFICATION_ACK'
        AND e2.type = 'NOTIFICATION_ACK'
        AND e1."objectId" = e2."objectId"
        AND e1."targetId" = e2."targetId"
        AND e1."createdAt" > e2."createdAt"
    `);

    // Create partial unique index for NOTIFICATION_ACK events
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_events_notification_ack_unique"
      ON events ("objectId", "targetId")
      WHERE type = 'NOTIFICATION_ACK'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_events_notification_ack_unique"
    `);
  }
}

