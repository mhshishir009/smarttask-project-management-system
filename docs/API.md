# SmartTask REST API

**Base URL:** `http://localhost:5000/api`  
**Format:** JSON. Examples are illustrative; use IDs and versions returned by your own database.  
**Author:** Mahedee Hasan Shishir

## Authentication and conventions

Public: `GET /health`, `POST /auth/register`, `POST /auth/login`. All other listed routes require `Authorization: Bearer <accessToken>`. `POST /auth/change-password` is accessible during mandatory password change; workspace routes require that change to be complete.

The middleware verifies JWT signature/expiry and compares the current database account's active status, role ID, authentication version, and mandatory-password flag with the token. Changing a password invalidates older sessions. Signup always chooses `TEAM_MEMBER` server-side. Actor/creator/sender IDs are obtained from authentication, not trusted from request bodies.

Success envelopes use `{"success":true,"data":...}` and may include `message`. Some mutation responses contain only `success` and `message` or only `success`. Errors use `{"success":false,"message":"..."}`. Unknown routes return `404` with `API endpoint not found`; unexpected errors use a generic `500` response. The server logs unexpected errors locally.

| Status | Typical meaning |
|---|---|
| 200 | Read or mutation completed |
| 201 | User, project, task, or discussion message created |
| 400 | Missing/invalid fields, dates, IDs, cursor, expected version, or transition |
| 401 | Missing/invalid/expired token, inactive account, stale account state, invalid login |
| 403 | Role/assignment denied, mandatory password change, protected Admin deactivation |
| 404 | Missing resource, missing own notification, unknown route |
| 409 | Duplicate email, version conflict, archive/assignee/dependency conflict |
| 503 | Signup role has not been configured |

## Endpoint inventory

All paths below are relative to `/api`. A/M means Admin or Team Member, with resource restrictions described below.

| Method | Path | Access | Success |
|---|---|---|---|
| GET | `/health` | Public | 200 |
| POST | `/auth/register` | Public | 201 |
| POST | `/auth/login` | Public | 200 |
| POST | `/auth/change-password` | Authenticated, including mandatory-change sessions | 200 |
| GET | `/roles` | Authenticated, password changed | 200 |
| GET | `/roles/code/:code` | Authenticated, password changed | 200 |
| GET | `/roles/:id` | Authenticated, password changed | 200 |
| POST | `/users` | Admin | 201 |
| GET | `/users` | Admin | 200 |
| GET | `/users/:id` | Admin | 200 |
| PUT | `/users/:id` | Admin | 200 |
| PATCH | `/users/:id/deactivate` | Admin | 200 |
| POST | `/projects` | Admin | 201 |
| GET | `/projects` | A/M | 200 |
| GET | `/projects/:id` | A/M | 200 |
| PUT | `/projects/:id` | Admin | 200 |
| PATCH | `/projects/:id/archive` | Admin | 200 |
| DELETE | `/projects/:id` | Admin | 200 |
| POST | `/tasks` | Admin | 201 |
| GET | `/tasks` | Admin | 200 |
| GET | `/tasks/project/:projectId` | A/M; Members receive only their assignments | 200 |
| GET | `/tasks/:id` | Admin or current assignee | 200 |
| PUT | `/tasks/:id` | Admin | 200 |
| PATCH | `/tasks/:id/status` | Admin or current assignee | 200 |
| PATCH | `/tasks/:id/assign` | Admin | 200 |
| DELETE | `/tasks/:id` | Admin | 200 |
| GET | `/projects/:projectId/messages` | Admin or Member assigned a task in project | 200 |
| POST | `/projects/:projectId/messages` | Same, active project only | 201 |
| GET | `/notifications` | A/M; own recipients only | 200 |
| PATCH | `/notifications/:id/read` | A/M; own recipients only | 200 |
| PATCH | `/notifications/read-all` | A/M; own recipients only | 200 |

No `/auth/me`, `/auth/users`, `/auth/logout`, `/dashboard`, `/messages`, or password-reset endpoint exists. The frontend derives dashboard metrics from protected lists and clears its own session on logout.

## Health

`GET /health` returns:

```json
{"success":true,"message":"Smart Task Management API is running"}
```

The route does not issue a live SQL query. Server startup connects to PostgreSQL; `npm run db:check` independently tests connectivity.

## Accounts

### Register

`POST /auth/register`

```json
{"fullName":"Demo Member","email":"member@example.invalid","password":"YOUR_CHOSEN_PASSWORD"}
```

- Nonblank trimmed name, maximum 150 characters; valid trimmed email, maximum 255.
- Password at least 12 characters. Use your own value; examples are not supplied live credentials.
- Email is normalized to lowercase. Duplicate email returns `409`.
- Returns public user fields, including `userId`, `roleId`, `fullName`, `email`, active/Admin/password-change flags, and timestamps; no hash or access token.
- Signup has `mustChangePassword:false`; the user selected their own password. Any supplied role/Admin flags are ignored.

### Login

`POST /auth/login`

```json
{"email":"admin@example.invalid","password":"YOUR_CONFIGURED_ADMIN_PASSWORD"}
```

Response shape:

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "accessToken": "YOUR_ACCESS_TOKEN",
    "tokenType": "Bearer",
    "mustChangePassword": false,
    "user": {"userId": 1, "roleId": 1, "fullName": "System Administrator", "email": "admin@example.invalid"}
  }
}
```

Initial seeded/Admin-created accounts instead return `mustChangePassword:true` and the password-change-required login message. Use their token only to change the password before attempting workspace operations. Invalid credentials and inactive accounts share the invalid-email-or-password response.

### Change password

`POST /auth/change-password`

```json
{"currentPassword":"YOUR_CURRENT_PASSWORD","newPassword":"YOUR_DIFFERENT_NEW_PASSWORD"}
```

Verify the current password, use at least 12 characters, and choose a different new password. Success clears the mandatory-change flag and increments the authentication version; sign in again. Do not send a confirmation field; frontend confirmation is local validation.

### Roles and Admin user management

`GET /roles` returns an array of `{roleId,roleCode,roleName}`. `GET /roles/code/TEAM_MEMBER` and `/roles/code/ADMIN` retrieve one role; `/roles/:id` looks it up by numeric ID. Missing roles return `404`; invalid codes/IDs return `400`.

`POST /users`:

```json
{"fullName":"Invited Member","email":"invited@example.invalid","roleId":2,"temporaryPassword":"YOUR_TEMPORARY_PASSWORD"}
```

Resolve `roleId` from `/roles`; role IDs 1/2 are the convention used by authorization and the fresh role seed. Temporary passwords require at least 12 characters. Newly created users must change their initial password. Public response fields omit the hash.

`GET /users` returns the user list; `GET /users/:id` returns one user. `PUT /users/:id` accepts one or both of `fullName` and `email`; it is not a password reset or role-change endpoint.

```json
{"fullName":"Updated Member Name","email":"updated@example.invalid"}
```

`PATCH /users/:id/deactivate` has no body. System Admin and last-active-Admin protections return `403`. This does not delete the account, and there is no reactivate endpoint in this version.

## Projects

`POST /projects`:

```json
{"name":"Review Workspace","description":"Assignment demonstration project"}
```

Name must be nonblank and at most 200 characters. Description can be omitted or `null` on creation. New projects are active, with `createdBy` set from the authenticated Admin. Returned fields: `projectId`, `name`, `description`, `createdBy`, `isArchived`, `createdAt`, `updatedAt`.

`GET /projects` returns all project records, including archived ones, for both roles. `GET /projects/:id` returns one. Project search/archive filters/sorting/progress enrichment are performed in the frontend, not by undocumented project query parameters.

`PUT /projects/:id` requires a complete name plus a string/null description:

```json
{"name":"Updated Review Workspace","description":null}
```

Archived projects reject changes with `409`. `PATCH /projects/:id/archive` has no body. Archive fails with `409` if incomplete tasks exist or the project is already archived. The repository rechecks tasks inside the locked archive transaction.

`DELETE /projects/:id` has no body. A project with any tasks (including completed tasks) or discussion messages returns `409`; data is not cascaded away. An eligible empty project returns `200`, and subsequent reads/deletes return `404`.

## Tasks

### Create

`POST /tasks`:

```json
{
  "projectId": 1,
  "assigneeId": 2,
  "title": "Implement task review",
  "description": "Verify the assignment workflow",
  "priority": "HIGH",
  "dueAt": "2026-11-05T12:00:00Z"
}
```

- Project must exist and be active; assignee must be a valid active account. Null/missing assignee is rejected.
- Nonblank title, at most 200 characters. Description is optional/null.
- Priority is `LOW`, `MEDIUM`, or `HIGH`; creation defaults to `MEDIUM`.
- New status is always `TODO`, initial version is `1`; creator is the authenticated Admin.
- `dueAt` is optional/null. When supplied it must include seconds and an explicit timezone (`Z` or `+/-HH:MM`), with up to three optional fractional digits. Calendar dates, leap years and timezone offsets are validated.

Response fields: `taskId`, `projectId`, `assigneeId`, `createdBy`, `title`, `description`, `status`, `priority`, `dueAt`, `version`, `createdAt`, `updatedAt`.

### Read/filter

Admin example:

```http
GET /api/tasks?projectId=1&status=TODO&priority=HIGH&assigneeId=2
```

Supported filters combine with AND and may be omitted. Invalid enums, malformed IDs, duplicate supported query parameters and nested supported filters return `400`. Text search is frontend behavior; the API has no documented `search` filter.

Members use `GET /tasks/project/:projectId` (their assignments only) and `GET /tasks/:id` (current assignee only). An existing project with no Member assignments returns an empty task list. A Member cannot call the Admin `/tasks` list. Unauthorized access to another task returns `403`.

### Update details, status, assignment and deletion

Read the current `version`, then send it as a JSON number named `expectedVersion` on **every task mutation**. After a successful update, use the returned incremented version. A stale version returns `409`, without changing the task or generating a successful-action notification.

`PUT /tasks/:id` edits details, not status or ownership:

```json
{"title":"Updated review task","description":null,"priority":"MEDIUM","dueAt":null,"expectedVersion":1}
```

Provide `title` and `priority`. Omitted/null description and deadline become `null`; this endpoint is not a partial PATCH.

`PATCH /tasks/:id/status`:

```json
{"status":"IN_PROGRESS","expectedVersion":2}
```

Allowed transitions: `TODO → IN_PROGRESS → DONE`. Skipping, reversing, reopening, or repeating a status is rejected. Members must still be the current assignee when the locked transaction executes.

`PATCH /tasks/:id/assign`:

```json
{"assigneeId":3,"expectedVersion":3}
```

Admin-only; the replacement assignee must be active. `null` cannot unassign work. Successful reassignment notifies previous/new eligible assignees; reassignment to the same user does not create a reassignment notification.

`DELETE /tasks/:id` **requires a JSON body**:

```json
{"expectedVersion":4}
```

Admin-only, active project required. Missing/invalid version returns `400`, stale version `409`, missing task `404`, successful deletion `200`. Archived project tasks cannot be modified or deleted.

## Project Discussion

`GET /projects/:projectId/messages?before=51` returns the newest page before the optional positive message ID cursor:

```json
{
  "success": true,
  "data": {
    "messages": [{"messageId":50,"projectId":1,"authorId":2,"authorName":"Demo Member","body":"Ready for review.","createdAt":"2026-10-26T08:00:00.000Z"}],
    "nextBefore": null,
    "isArchived": false
  }
}
```

Each page contains up to 50 messages in **ascending** message order. The repository selects the latest page; send `nextBefore` to retrieve older history and prepend it. `null` means no earlier page. The actual cursor value comes from the response, not this illustrative example.

Admin access is unrestricted by assignment. A Member must currently have at least one task assigned in the project (completed tasks also count); loss of the final assignment revokes discussion access.

`POST /projects/:projectId/messages`:

```json
{"body":"Please review the updated implementation."}
```

Message must be a string, nonblank after trimming, and at most 2,000 characters. Sender/time are server-generated. The response has `201`, `Message sent`, and the created message object. The UI renders plain text, not HTML. Archived history remains readable; posting returns `409`. No edit/delete or realtime delivery endpoint exists.

## Notifications

`GET /notifications?before=100` returns up to 30 records, **newest first**, and an unread count over the recipient's entire history:

```json
{
  "success": true,
  "data": {
    "notifications": [{"notificationId":99,"kind":"TASK_ASSIGNED","message":"System Administrator created and assigned task “Review” to Demo Member.","projectId":1,"taskId":1,"createdAt":"2026-10-26T08:00:00.000Z","readAt":null,"canOpen":true}],
    "unreadCount": 1,
    "nextBefore": null
  }
}
```

- Identity is always the authenticated recipient; a client-supplied `recipientId` cannot select another user's rows.
- `kind`: `PROJECT_CREATED`, `PROJECT_ARCHIVED`, `TASK_ASSIGNED`, `TASK_REASSIGNED`, `TASK_STATUS_CHANGED`, `DISCUSSION_MESSAGE`.
- Follow `nextBefore` to retrieve older notifications. `readAt:null` means unread.
- `canOpen` reflects current target access; deleted/unassigned targets may remain as history. It does not replace backend authorization.
- Own actions appear already read. Only active eligible users receive new events. Discussion notifications contain the author/project, not the private message body.

`PATCH /notifications/:id/read` uses no request body fields. It is idempotent for an existing own row; another recipient's/missing row returns `404`.

`PATCH /notifications/read-all`:

```json
{"throughId":99}
```

Use the newest notification ID in the loaded snapshot. Only this recipient's unread rows at/below that ID are marked read; later arrivals remain unread. Success returns `{"success":true}`. A nonnumeric, missing, zero, fractional or unsafe snapshot ID returns `400`.

## Postman use

Import [SmartTask.postman_collection.json](SmartTask.postman_collection.json). Set credentials in your **local** collection variables; committed defaults are empty. Run Login to capture `accessToken`; initial Admin login must be followed by Change password and a fresh Login. Roles lookup and creation requests capture IDs; successful task responses capture the latest version.

Use individual requests against a disposable demo project. The collection contains delete/deactivate requests and alternative workflows; it is not an automatically ordered end-to-end test runner and has not been executed as a collection during documentation preparation. Save tokens/passwords locally only and remove them before exporting/sharing.
