import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateUserTemplatesTable1765194473000
  implements MigrationInterface
{
  name = 'CreateUserTemplatesTable1765194473000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add MESSAGE_TEMPLATE value to ExecutionType enum first
    await queryRunner.commitTransaction();
    await queryRunner.startTransaction();

    await queryRunner.query(`
      ALTER TYPE "entity_executions_type_enum" 
      ADD VALUE IF NOT EXISTS 'MESSAGE_TEMPLATE'
    `);

    // Commit to make the enum value available
    await queryRunner.commitTransaction();
    await queryRunner.startTransaction();

    // Create user_templates table
    const hasTable = await queryRunner.hasTable('user_templates');
    if (!hasTable) {
      await queryRunner.createTable(
        new Table({
          name: 'user_templates',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              isPrimary: true,
              default: 'uuid_generate_v4()',
            },
            {
              name: 'name',
              type: 'character varying',
              isNullable: false,
            },
            {
              name: 'description',
              type: 'text',
              isNullable: true,
            },
            {
              name: 'title',
              type: 'text',
              isNullable: true,
            },
            {
              name: 'subtitle',
              type: 'text',
              isNullable: true,
            },
            {
              name: 'body',
              type: 'text',
              isNullable: false,
            },
            {
              name: 'input',
              type: 'text',
              isNullable: true,
            },
            {
              name: 'output',
              type: 'text',
              isNullable: true,
            },
            {
              name: 'userId',
              type: 'uuid',
              isNullable: false,
            },
            {
              name: 'createdAt',
              type: 'timestamp',
              default: 'now()',
            },
            {
              name: 'updatedAt',
              type: 'timestamp',
              default: 'now()',
            },
          ],
        }),
        true,
      );

      await queryRunner.createForeignKey(
        'user_templates',
        new TableForeignKey({
          columnNames: ['userId'],
          referencedColumnNames: ['id'],
          referencedTableName: 'users',
          onDelete: 'CASCADE',
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('user_templates');
    if (hasTable) {
      await queryRunner.dropTable('user_templates');
    }

    // Note: Cannot remove enum values in PostgreSQL
    // The MESSAGE_TEMPLATE enum value will remain but won't be used
  }
}
