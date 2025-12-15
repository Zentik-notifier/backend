import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBucketDeletionEvent1769200000000
  implements MigrationInterface
{
  name = 'AddBucketDeletionEvent1769200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add BUCKET_DELETION to events_type_enum if it does not exist
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_enum e
          JOIN pg_type t ON e.enumtypid = t.oid
          WHERE t.typname = 'events_type_enum'
            AND e.enumlabel = 'BUCKET_DELETION'
        ) THEN
          ALTER TYPE public."events_type_enum" ADD VALUE 'BUCKET_DELETION';
        END IF;
      END$$;
    `);
  }

  // Non rimuoviamo il valore dall'enum per sicurezza, come nelle altre migrazioni
  public async down(_queryRunner: QueryRunner): Promise<void> {
    return;
  }
}
