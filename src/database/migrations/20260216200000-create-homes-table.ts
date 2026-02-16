import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateHomesTable20260216200000 implements MigrationInterface {
  name = 'CreateHomesTable20260216200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "homes" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "owner_id" uuid NOT NULL,
        "name" varchar(120) NOT NULL,
        "address" varchar(255),
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_homes_owner_id_users_id" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_homes_owner_id" ON "homes" ("owner_id")');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_homes_owner_id"');
    await queryRunner.query('DROP TABLE IF EXISTS "homes"');
  }
}
