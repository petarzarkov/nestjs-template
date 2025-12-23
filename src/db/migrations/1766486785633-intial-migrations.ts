import type { MigrationInterface, QueryRunner } from 'typeorm';

export class IntialMigrations1766486785633 implements MigrationInterface {
  name = 'IntialMigrations1766486785633';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      CREATE TYPE "public"."user_roles_enum" AS ENUM('admin', 'user')
    `);
    await queryRunner.query(/* sql */ `
      CREATE TABLE "user" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4 (),
        "email" character varying NOT NULL,
        "password" character varying NOT NULL,
        "roles" "public"."user_roles_enum" array NOT NULL,
        "suspended" boolean NOT NULL DEFAULT FALSE,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE ("email"),
        CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(/* sql */ `
      CREATE TABLE "password_reset_token" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4 (),
        "token" character varying NOT NULL,
        "expires_at" TIMESTAMP NOT NULL,
        "used" boolean NOT NULL DEFAULT FALSE,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "user_id" uuid,
        CONSTRAINT "PK_838af121380dfe3a6330e04f5bb" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(/* sql */ `
      CREATE TYPE "public"."invite_role_enum" AS ENUM('admin', 'user')
    `);
    await queryRunner.query(/* sql */ `
      CREATE TYPE "public"."invite_status_enum" AS ENUM('pending', 'accepted', 'expired')
    `);
    await queryRunner.query(/* sql */ `
      CREATE TABLE "invite" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4 (),
        "email" character varying NOT NULL,
        "invite_code" character varying NOT NULL,
        "role" "public"."invite_role_enum" NOT NULL,
        "status" "public"."invite_status_enum" NOT NULL DEFAULT 'pending',
        "expires_at" TIMESTAMP NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_658d8246180c0345d32a100544e" UNIQUE ("email"),
        CONSTRAINT "PK_fc9fa190e5a3c5d80604a4f63e1" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(/* sql */ `
      CREATE UNIQUE INDEX "IDX_a25a71ac34ea0c1e2b6dd4329d" ON "invite" ("invite_code")
    `);
    await queryRunner.query(/* sql */ `
      ALTER TABLE "password_reset_token"
      ADD CONSTRAINT "FK_7eabb22ed38459ffc24dc8b415d" FOREIGN KEY ("user_id") REFERENCES "user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      ALTER TABLE "password_reset_token"
      DROP CONSTRAINT "FK_7eabb22ed38459ffc24dc8b415d"
    `);
    await queryRunner.query(/* sql */ `
      DROP INDEX "public"."IDX_a25a71ac34ea0c1e2b6dd4329d"
    `);
    await queryRunner.query(/* sql */ `DROP TABLE "invite"`);
    await queryRunner.query(/* sql */ `
      DROP TYPE "public"."invite_status_enum"
    `);
    await queryRunner.query(/* sql */ `DROP TYPE "public"."invite_role_enum"`);
    await queryRunner.query(/* sql */ `DROP TABLE "password_reset_token"`);
    await queryRunner.query(/* sql */ `DROP TABLE "user"`);
    await queryRunner.query(/* sql */ `DROP TYPE "public"."user_roles_enum"`);
  }
}
