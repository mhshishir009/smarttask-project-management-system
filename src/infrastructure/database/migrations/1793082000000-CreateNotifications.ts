import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateNotifications1793082000000 implements MigrationInterface {
  name = "CreateNotifications1793082000000";
  async up(runner: QueryRunner): Promise<void> {
    // Additive only. Optional targets preserve existing project/task deletion rules.
    await runner.query(`CREATE TABLE notifications (
      id BIGSERIAL PRIMARY KEY,
      recipient_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      event_key VARCHAR(160) NOT NULL,
      kind VARCHAR(40) NOT NULL,
      message TEXT NOT NULL,
      project_id BIGINT REFERENCES projects(id) ON DELETE SET NULL,
      task_id BIGINT REFERENCES tasks(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      read_at TIMESTAMPTZ,
      CONSTRAINT uq_notification_recipient_event UNIQUE(recipient_id, event_key)
    )`);
    await runner.query("CREATE INDEX idx_notifications_recipient_latest ON notifications(recipient_id, id DESC)");
    await runner.query("CREATE INDEX idx_notifications_unread ON notifications(recipient_id) WHERE read_at IS NULL");
  }
  async down(runner: QueryRunner): Promise<void> {await runner.query("DROP TABLE notifications");}
}
