# Disposable demonstration data

Use this walkthrough after migrations, role seeding, and Admin seeding. It creates sample records through the actual APIs/UI instead of shipping a database dump of the candidate's personal accounts. The examples use reserved `example.invalid` addresses; no email is sent. Choose your own passwords and keep them local.

## 1. Prepare the Admin

Sign in using root `.env` seed credentials. Complete mandatory password change and sign in again. For Postman, set local `adminEmail`, `adminPassword`, and (for the initial change) `newAdminPassword`; update `adminPassword` to the new value before the next Login. Publicly committed credential/token variables remain empty.

## 2. Register a Member

Use Register in the frontend, or `POST /api/auth/register`:

```json
{"fullName":"Demo Member","email":"member@example.invalid","password":"YOUR_UNIQUE_MEMBER_PASSWORD"}
```

Choose a password at least 12 characters long. Save returned `userId` as `memberId`; do not assume it is 2 in an existing database. This self-registration does not require first-login password change. Alternatively, an Admin-created user receives an initial temporary password and must change it.

## 3. Create a project as Admin

```http
POST /api/projects
Authorization: Bearer YOUR_ADMIN_ACCESS_TOKEN
Content-Type: application/json
```

```json
{"name":"Submission Demo","description":"Disposable sample workspace for the technical review"}
```

Save returned `projectId`. The Admin's own event appears as read history in the bell.

## 4. Create task examples

`POST /api/tasks` as Admin. Replace IDs with actual returned values:

```json
{"projectId":1,"assigneeId":2,"title":"Review the project brief","description":"Confirm scope and acceptance criteria","priority":"HIGH","dueAt":null}
```

Create a second task with priority `LOW` and an explicit future deadline, and a third with priority `MEDIUM` and a past deadline to demonstrate overdue work. Compute timestamps at the time you run the demo; do not rely on a fixed date remaining in the future. All new tasks start `TODO` with version `1`.

For each updated task, always use its latest returned `version` as `expectedVersion`.

## 5. Demonstrate workflow and collaboration

1. Sign in as Demo Member; verify its assigned tasks and unread assignment notification.
2. Move one task to `IN_PROGRESS`, then `DONE`, reading the new version each time.
3. Open Projects → Submission Demo → Discussion and post a plain-text update.
4. Return as Admin, refresh discussion, review status/discussion notifications, and check dashboard counts/charts.
5. If demonstrating reassignment, create a second disposable Member; old/new assignees receive the event, while the old assignee can no longer open that task.
6. Verify another unassigned Member cannot use the project's discussion API.

## 6. Demonstrate safe archive/delete rules

Create a separate **empty** project for deletion testing. Delete it as Admin and verify subsequent GET returns `404`. Do not attempt to delete personal or assignment work as a demonstration.

On the demo workspace, archive is blocked until all tasks are `DONE`. After archive, task/project edits and new discussion messages are blocked, while existing discussion remains readable. A project with tasks or discussion messages is intentionally retained rather than cascade-deleted.

No real credentials, tokens, personally identifying seed data, or automatic destructive cleanup are included. This walkthrough provides the sample-data creation instructions required by the assignment; there is no automatic all-projects seed script.
