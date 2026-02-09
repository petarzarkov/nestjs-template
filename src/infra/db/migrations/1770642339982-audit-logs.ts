import { MigrationInterface, QueryRunner } from 'typeorm';

export class AuditLogs1770642339982 implements MigrationInterface {
  name = 'AuditLogs1770642339982';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."audit_log_action_enum" AS ENUM('INSERT', 'UPDATE', 'DELETE')`,
    );
    await queryRunner.query(
      `CREATE TABLE "audit_log" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "actor_id" uuid, "action" "public"."audit_log_action_enum" NOT NULL, "entity_name" character varying NOT NULL, "entity_id" character varying NOT NULL, "old_value" jsonb, "new_value" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_07fefa57f7f5ab8fc3f52b3ed0b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_15a6f5aad57db494c17986ed2e" ON "audit_log" ("actor_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_951e6339a77994dfbad976b35c" ON "audit_log" ("action") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e0e011e292b5dc8962526090ed" ON "audit_log" ("entity_name") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c6c5d74b38ecfe778182348e7c" ON "audit_log" ("entity_id") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c6c5d74b38ecfe778182348e7c"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e0e011e292b5dc8962526090ed"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_951e6339a77994dfbad976b35c"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_15a6f5aad57db494c17986ed2e"`,
    );
    await queryRunner.query(`DROP TABLE "audit_log"`);
    await queryRunner.query(`DROP TYPE "public"."audit_log_action_enum"`);
  }
}
