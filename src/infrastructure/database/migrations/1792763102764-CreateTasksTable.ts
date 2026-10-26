
import {
  MigrationInterface,
  QueryRunner,
} from "typeorm";

export class CreateTasksTable1792763102764
  implements MigrationInterface
{
  name = "CreateTasksTable1792763102764";

  public async up(
    queryRunner: QueryRunner
  ): Promise<void> {
    // ==========================================
    // 1. CREATE TASKS TABLE
    // ==========================================
    await queryRunner.query(`
      CREATE TABLE "tasks" (
        "id" BIGSERIAL PRIMARY KEY,

        "project_id" BIGINT NOT NULL,

        "assignee_id" BIGINT NULL,

        "created_by" BIGINT NOT NULL,

        "title" VARCHAR(200) NOT NULL,

        "description" TEXT NULL,

        "status" VARCHAR(20) NOT NULL DEFAULT 'TODO',

        "priority" VARCHAR(10) NOT NULL DEFAULT 'MEDIUM',

        "due_at" TIMESTAMPTZ NULL,

        "version" INTEGER NOT NULL DEFAULT 1,

        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        CONSTRAINT "fk_tasks_project"
          FOREIGN KEY ("project_id")
          REFERENCES "projects"("id")
          ON DELETE RESTRICT,

        CONSTRAINT "fk_tasks_assignee"
          FOREIGN KEY ("assignee_id")
          REFERENCES "users"("id")
          ON DELETE RESTRICT,

        CONSTRAINT "fk_tasks_created_by"
          FOREIGN KEY ("created_by")
          REFERENCES "users"("id")
          ON DELETE RESTRICT,

        CONSTRAINT "chk_tasks_title_not_empty"
          CHECK (LENGTH(TRIM("title")) > 0),

        CONSTRAINT "chk_tasks_status"
          CHECK (
            "status" IN ('TODO', 'IN_PROGRESS', 'DONE')
          ),

        CONSTRAINT "chk_tasks_priority"
          CHECK (
            "priority" IN ('LOW', 'MEDIUM', 'HIGH')
          ),

        CONSTRAINT "chk_tasks_version"
          CHECK ("version" >= 1)
      )
    `);

    // ==========================================
    // 2. CREATE INDEXES
    // ==========================================

    await queryRunner.query(`
      CREATE INDEX "idx_tasks_project_id"
      ON "tasks" ("project_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_tasks_assignee_id"
      ON "tasks" ("assignee_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_tasks_created_by"
      ON "tasks" ("created_by")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_tasks_status"
      ON "tasks" ("status")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_tasks_priority"
      ON "tasks" ("priority")
    `);
  }

  public async down(
    queryRunner: QueryRunner
  ): Promise<void> {
    await queryRunner.query(`
      DROP TABLE "tasks"
    `);
  }
}
