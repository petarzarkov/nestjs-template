import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOauth1766730208007 implements MigrationInterface {
  name = 'AddOauth1766730208007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."auth_providers_provider_enum" AS ENUM('google', 'github', 'linkedin', 'local')`,
    );
    await queryRunner.query(
      `CREATE TABLE "auth_providers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "provider" "public"."auth_providers_provider_enum" NOT NULL, "auth_provider_id" text, "password_hash" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "userId" uuid, CONSTRAINT "PK_cb277e892a115855fc95c373422" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_433e10d8a567aaed74853a8376" ON "auth_providers" ("user_id", "provider") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_b859d42fe29a33291c2689d766" ON "auth_providers" ("provider", "auth_provider_id") WHERE "auth_provider_id" IS NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "user" ADD "display_name" text`);
    await queryRunner.query(`ALTER TABLE "user" ADD "picture" text`);
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "password" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "auth_providers" ADD CONSTRAINT "FK_eb4fd6d0f3ad537effb4cb7505a" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "auth_providers" DROP CONSTRAINT "FK_eb4fd6d0f3ad537effb4cb7505a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "password" SET NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "picture"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "display_name"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b859d42fe29a33291c2689d766"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_433e10d8a567aaed74853a8376"`,
    );
    await queryRunner.query(`DROP TABLE "auth_providers"`);
    await queryRunner.query(
      `DROP TYPE "public"."auth_providers_provider_enum"`,
    );
  }
}
