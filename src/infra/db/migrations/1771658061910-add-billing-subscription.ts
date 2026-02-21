import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBillingSubscription1771658061910 implements MigrationInterface {
  name = 'AddBillingSubscription1771658061910';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."subscription_status_enum" AS ENUM('active', 'canceled', 'past_due', 'trialing', 'incomplete', 'incomplete_expired', 'unpaid')`,
    );
    await queryRunner.query(
      `CREATE TABLE "subscription" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "stripe_customer_id" character varying(128) NOT NULL, "stripe_subscription_id" character varying(128), "stripe_price_id" character varying(128), "status" "public"."subscription_status_enum" NOT NULL DEFAULT 'incomplete', "current_period_start" TIMESTAMP WITH TIME ZONE, "current_period_end" TIMESTAMP WITH TIME ZONE, "cancel_at_period_end" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_subscription" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "subscription_stripe_subscription_id_index" ON "subscription" ("stripe_subscription_id") WHERE "stripe_subscription_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "subscription_stripe_customer_id_index" ON "subscription" ("stripe_customer_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "subscription_user_id_index" ON "subscription" ("user_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "subscription" ADD CONSTRAINT "FK_subscription_to_user" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "subscription" DROP CONSTRAINT "FK_subscription_to_user"`,
    );
    await queryRunner.query(`DROP INDEX "public"."subscription_user_id_index"`);
    await queryRunner.query(
      `DROP INDEX "public"."subscription_stripe_customer_id_index"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."subscription_stripe_subscription_id_index"`,
    );
    await queryRunner.query(`DROP TABLE "subscription"`);
    await queryRunner.query(`DROP TYPE "public"."subscription_status_enum"`);
  }
}
