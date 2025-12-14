import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddActiveAndEntriesToChangelog1769000000000 implements MigrationInterface {
  name = 'AddActiveAndEntriesToChangelog1769000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('changelogs');
    if (!hasTable) return;

    const table = await queryRunner.getTable('changelogs');

    if (!table?.findColumnByName('active')) {
      await queryRunner.addColumn(
        'changelogs',
        new TableColumn({
          name: 'active',
          type: 'boolean',
          isNullable: false,
          default: true,
        }),
      );
    }

    if (!table?.findColumnByName('entries')) {
      await queryRunner.addColumn(
        'changelogs',
        new TableColumn({
          name: 'entries',
          type: 'jsonb',
          isNullable: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('changelogs');
    if (!hasTable) return;

    const table = await queryRunner.getTable('changelogs');

    if (table?.findColumnByName('entries')) {
      await queryRunner.dropColumn('changelogs', 'entries');
    }

    if (table?.findColumnByName('active')) {
      await queryRunner.dropColumn('changelogs', 'active');
    }
  }
}
