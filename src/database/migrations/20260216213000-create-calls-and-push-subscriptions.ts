import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCallsAndPushSubscriptions20260216213000 implements MigrationInterface {
  name = 'CreateCallsAndPushSubscriptions20260216213000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "calls" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "home_id" uuid NOT NULL,
        "status" varchar(20) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "answered_at" timestamptz,
        "missed_at" timestamptz,
        CONSTRAINT "FK_calls_home_id_homes_id" FOREIGN KEY ("home_id") REFERENCES "homes"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_calls_home_id" ON "calls" ("home_id")');

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "push_subscriptions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "owner_id" uuid NOT NULL,
        "endpoint" varchar(1024) NOT NULL,
        "p256dh_key" varchar(512) NOT NULL,
        "auth_key" varchar(512) NOT NULL,
        "user_agent" varchar(512),
        "last_notified_at" timestamptz,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_push_subscriptions_owner_id_users_id" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_push_subscriptions_endpoint" UNIQUE ("endpoint")
      )
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_push_subscriptions_owner_id" ON "push_subscriptions" ("owner_id")'
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_push_subscriptions_owner_id"');
    await queryRunner.query('DROP TABLE IF EXISTS "push_subscriptions"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_calls_home_id"');
    await queryRunner.query('DROP TABLE IF EXISTS "calls"');
  }
}
