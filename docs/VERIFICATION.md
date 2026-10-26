# Verification record

**Recorded:** 26 October 2026. Local Windows/PowerShell, Node 24.19.0, npm 11.17.0 and reachable local PostgreSQL.

## Executed checks

Run from the repository root:

| Command | Result |
|---|---|
| `npm test` | 294 tests passed, 22 files |
| `npm run typecheck` | Passed |
| `npm run build` | Passed |
| `npm --prefix frontend run lint` | Passed |
| `npm --prefix frontend run build` | Passed; output `frontend/dist/` |
| `node tests/database/discussionSmoke.cjs` | Passed using PostgreSQL temporary tables |
| `node tests/database/notificationSmoke.cjs` | Passed using PostgreSQL temporary tables |

Inside `frontend/`, use `npm run lint` / `npm run build` without the prefix. A prefixed command there would target the nonexistent `frontend/frontend/package.json`.

## Automated coverage

- Service/repository tests cover validation, active assignees, filtering, version checks, authorization, archive constraints and dependent-data deletion safeguards.
- HTTP tests exercise real Express routes/controllers/services with isolated repository/token fixtures, without writing live business records.
- Frontend helper/rendering tests cover analytics, project presentation, search/notification destinations and role-specific behavior. They are not a complete browser automation suite.
- Discussion PostgreSQL checks validate migration SQL, stored messages, permissions, archived read-only behavior, pagination and history protection.
- Notification PostgreSQL checks use actual migrations/repositories for all six event hooks, recipients, actor attribution, read ownership/snapshots, permissions, pagination, deduplication and rollback on notification failure.

Both database scripts seed fixtures in temporary tables and roll back. They require connectivity and a current backend build; they do not reset/populate the real application tables.

## Manual and visual evidence

The candidate reported completing core, Project Discussion and event notification manual tests in the project conversation. Shared screenshots showed an assigned Member reading an Admin's discussion message. Isolated synthetic UI previews checked discussion send/history/archive controls and notification unread/read/navigation behavior.

Login/Register were visually checked on the running frontend; Change Password presentation/toggle was inspected in an isolated preview. Mobile checks included 320px/390px viewports, with the auth-only minimum-width fix verified on the running frontend. Authentication state/validation/submission-handler source was compared before/after the visual change and remained identical.

Documentation preparation reruns the checks above. This does not imply a new manual end-to-end pass for every path or 294 real-browser tests.

## Pending verification

- Fresh installation from a published GitHub clone; no repository has been published yet.
- Live deployment, HTTPS routing, hosted database and remote role-based flows.
- Postman execution as a complete sequence; the collection is an importable set of individual requests, including destructive examples.
- Broad browser compatibility, long-running/load testing and production hardening.

After publishing, verify setup from a fresh checkout/disposable database and record the commit. After deployment, record real frontend/API URLs and rerun login, initial password change, assignment, discussion, notifications, deep-link refresh and authorization checks.
