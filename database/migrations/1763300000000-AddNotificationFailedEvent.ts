import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNotificationFailedEvent1763300000000
  implements MigrationInterface
{
  name = 'AddNotificationFailedEvent1763300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add NOTIFICATION_FAILED to events_type_enum if it does not exist
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_enum e
          JOIN pg_type t ON e.enumtypid = t.oid
          WHERE t.typname = 'events_type_enum'
            AND e.enumlabel = 'NOTIFICATION_FAILED'
        ) THEN
          ALTER TYPE public."events_type_enum" ADD VALUE 'NOTIFICATION_FAILED';
        END IF;
      END$$;
    `);
  }

  // Non rimuoviamo il valore dall'enum per sicurezza, come nelle altre migrazioni
  public async down(_queryRunner: QueryRunner): Promise<void> {
    return;
  }
}
