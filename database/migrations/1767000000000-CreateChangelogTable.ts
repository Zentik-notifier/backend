import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateChangelogTable1767000000000 implements MigrationInterface {
  name = 'CreateChangelogTable1767000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('changelogs');
    if (!hasTable) {
      await queryRunner.createTable(
        new Table({
          name: 'changelogs',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              isPrimary: true,
              default: 'uuid_generate_v4()',
            },
            {
              name: 'iosVersion',
              type: 'character varying',
              length: '50',
              isNullable: false,
            },
            {
              name: 'androidVersion',
              type: 'character varying',
              length: '50',
              isNullable: true,
            },
            {
              name: 'uiVersion',
              type: 'character varying',
              length: '50',
              isNullable: true,
            },
            {
              name: 'backendVersion',
              type: 'character varying',
              length: '50',
              isNullable: true,
            },
            {
              name: 'description',
              type: 'text',
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
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('changelogs');
    if (hasTable) {
      await queryRunner.dropTable('changelogs');
    }
  }
}
