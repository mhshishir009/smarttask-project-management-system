import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateProjectMessages1792999492767 implements MigrationInterface {
  name = "CreateProjectMessages1792999492767";

  async up(queryRunner: QueryRunner): Promise<void> {
    // Additive migration: existing projects, users and tasks are not modified.
    await queryRunner.query(`CREATE TABLE "project_messages" (
      "id" BIGSERIAL PRIMARY KEY,
      "project_id" BIGINT NOT NULL,
      "author_id" BIGINT NOT NULL,
      "body" TEXT NOT NULL,
      "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT "fk_project_messages_project" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT,
      CONSTRAINT "fk_project_messages_author" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT,
      CONSTRAINT "chk_project_messages_body" CHECK (length(btrim("body")) > 0 AND char_length("body") <= 2000)
    )`);
    await queryRunner.query(`CREATE INDEX "idx_project_messages_thread" ON "project_messages" ("project_id", "id" DESC)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "project_messages"`);
  }
}
