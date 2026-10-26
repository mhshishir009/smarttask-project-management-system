
import {
  MigrationInterface,
  QueryRunner,
} from "typeorm";

export class CreateProjectsTable1792731267331
  implements MigrationInterface
{
  name = "CreateProjectsTable1792731267331";

  public async up(
    queryRunner: QueryRunner
  ): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "projects" (
        "id" BIGSERIAL PRIMARY KEY,
        "name" VARCHAR(200) NOT NULL,
        "description" TEXT NULL,
        "created_by" BIGINT NOT NULL,
        "is_archived" BOOLEAN NOT NULL DEFAULT FALSE,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        CONSTRAINT "fk_projects_created_by"
          FOREIGN KEY ("created_by")
          REFERENCES "users"("id")
          ON DELETE RESTRICT,

        CONSTRAINT "chk_projects_name_not_empty"
          CHECK (LENGTH(TRIM("name")) > 0)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_projects_created_by"
      ON "projects" ("created_by")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_projects_is_archived"
      ON "projects" ("is_archived")
    `);
  }

  public async down(
    queryRunner: QueryRunner
  ): Promise<void> {
    await queryRunner.query(`
      DROP TABLE "projects"
    `);
  }
}
