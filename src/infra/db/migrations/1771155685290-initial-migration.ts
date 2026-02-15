import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialMigration1771155685290 implements MigrationInterface {
  name = 'InitialMigration1771155685290';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."user_role_enum" AS ENUM('admin', 'user')`,
    );
    await queryRunner.query(
      `CREATE TABLE "user" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "password" character varying, "display_name" text, "picture" text, "roles" "public"."user_role_enum" array NOT NULL, "suspended" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_user_email" UNIQUE ("email"), CONSTRAINT "PK_user" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."audit_action_enum" AS ENUM('INSERT', 'UPDATE', 'DELETE')`,
    );
    await queryRunner.query(
      `CREATE TABLE "audit_log" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "actor_id" uuid, "action" "public"."audit_action_enum" NOT NULL, "entity_name" character varying NOT NULL, "entity_id" character varying NOT NULL, "old_value" jsonb, "new_value" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_audit_log" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "audit_actor_id_index" ON "audit_log" ("actor_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "audit_action_index" ON "audit_log" ("action") `,
    );
    await queryRunner.query(
      `CREATE INDEX "audit_entity_name_index" ON "audit_log" ("entity_name") `,
    );
    await queryRunner.query(
      `CREATE INDEX "audit_entity_id_index" ON "audit_log" ("entity_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "files" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "extension" character varying NOT NULL, "mimetype" character varying NOT NULL, "path" character varying NOT NULL, "size" integer, "user_id" uuid NOT NULL, "width" integer, "height" integer, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_file_path" UNIQUE ("path"), CONSTRAINT "PK_file" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."oauth_provider_enum" AS ENUM('google', 'github', 'linkedin', 'local')`,
    );
    await queryRunner.query(
      `CREATE TABLE "auth_providers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "provider" "public"."oauth_provider_enum" NOT NULL, "auth_provider_id" text, "password_hash" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_auth_provider" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "user_provider_index" ON "auth_providers" ("user_id", "provider") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "provider_auth_provider_id_index" ON "auth_providers" ("provider", "auth_provider_id") WHERE "auth_provider_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE TABLE "password_reset_token" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "token" character varying NOT NULL, "used" boolean NOT NULL DEFAULT false, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid, CONSTRAINT "PK_password_reset_token" PRIMARY KEY ("id"))`,
    );

    await queryRunner.query(
      `CREATE TYPE "public"."invite_status_enum" AS ENUM('pending', 'accepted', 'expired')`,
    );
    await queryRunner.query(
      `CREATE TABLE "invite" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "invite_code" character varying NOT NULL, "role" "public"."user_role_enum" NOT NULL, "status" "public"."invite_status_enum" NOT NULL DEFAULT 'pending', "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_invite_invite_code" UNIQUE ("invite_code"), CONSTRAINT "UQ_invite_email" UNIQUE ("email"), CONSTRAINT "PK_invite" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "files" ADD CONSTRAINT "FK_file_to_user" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "auth_providers" ADD CONSTRAINT "FK_auth_provider_to_user" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "password_reset_token" ADD CONSTRAINT "FK_password_reset_token_to_user" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "password_reset_token" DROP CONSTRAINT "FK_password_reset_token_to_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "auth_providers" DROP CONSTRAINT "FK_auth_provider_to_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "files" DROP CONSTRAINT "FK_file_to_user"`,
    );
    await queryRunner.query(`DROP TABLE "invite"`);
    await queryRunner.query(`DROP TYPE "public"."invite_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."user_role_enum"`);
    await queryRunner.query(`DROP TABLE "password_reset_token"`);
    await queryRunner.query(
      `DROP INDEX "public"."provider_auth_provider_id_index"`,
    );
    await queryRunner.query(`DROP INDEX "public"."user_provider_index"`);
    await queryRunner.query(`DROP TABLE "auth_providers"`);
    await queryRunner.query(`DROP TYPE "public"."oauth_provider_enum"`);
    await queryRunner.query(`DROP TABLE "files"`);
    await queryRunner.query(`DROP INDEX "public"."audit_entity_id_index"`);
    await queryRunner.query(`DROP INDEX "public"."audit_entity_name_index"`);
    await queryRunner.query(`DROP INDEX "public"."audit_action_index"`);
    await queryRunner.query(`DROP INDEX "public"."audit_actor_id_index"`);
    await queryRunner.query(`DROP TABLE "audit_log"`);
    await queryRunner.query(`DROP TYPE "public"."audit_action_enum"`);
    await queryRunner.query(`DROP TABLE "user"`);
  }
}
