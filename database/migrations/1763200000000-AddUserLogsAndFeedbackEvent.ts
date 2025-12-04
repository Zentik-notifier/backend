import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class AddUserLogsAndFeedbackEvent1763200000000
  implements MigrationInterface
{
  name = 'AddUserLogsAndFeedbackEvent1763200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Add USER_FEEDBACK to events_type_enum if it does not exist
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_enum e
          JOIN pg_type t ON e.enumtypid = t.oid
          WHERE t.typname = 'events_type_enum'
            AND e.enumlabel = 'USER_FEEDBACK'
        ) THEN
          ALTER TYPE public."events_type_enum" ADD VALUE 'USER_FEEDBACK';
        END IF;
      END$$;
    `);

    // 2) Create enum type for user_logs.type if it does not exist
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE t.typname = 'user_logs_type_enum' AND n.nspname = 'public'
        ) THEN
          CREATE TYPE public."user_logs_type_enum" AS ENUM ('FEEDBACK', 'APP_LOG');
        END IF;
      END$$;
    `);

    // 3) Create user_logs table if it does not exist
    const hasTable = await queryRunner.hasTable('user_logs');
    if (!hasTable) {
      await queryRunner.createTable(
        new Table({
          name: 'user_logs',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              isPrimary: true,
              default: 'uuid_generate_v4()',
            },
            {
              name: 'type',
              type: 'enum',
              enumName: 'user_logs_type_enum',
            },
            {
              name: 'userId',
              type: 'uuid',
              isNullable: true,
            },
            {
              name: 'payload',
              type: 'jsonb',
              isNullable: false,
            },
            {
              name: 'createdAt',
              type: 'timestamp',
              default: 'now()',
            },
          ],
        }),
        true,
      );
    }
  }

  // NOTE: non rimuoviamo il valore dall'enum events_type_enum perché non è
  // sicuro se già utilizzato. Manteniamo la stessa scelta delle migrazioni originali.
  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('user_logs');
    if (hasTable) {
      await queryRunner.dropTable('user_logs');
    }
    await queryRunner.query(
      'DROP TYPE IF EXISTS public."user_logs_type_enum";',
    );
  }
}


