# Deployment readiness

**Current state:** SmartTask runs locally. No SmartTask Vercel project, hosted API or hosted database has been configured/verified. A free deployment is preferred; no provider plan, quota or permanent availability is promised here.

This documentation task does not deploy the app or change server behavior. These are the actual application's deployment requirements, not claims of completed hosting.

## Three required components

| Component | Build/output | Runtime |
|---|---|---|
| Frontend | `npm run build` in `frontend/`; output `dist/` | Static hosting with SPA fallback and API routing |
| Backend | `npm ci`, `npm run build`; `dist/server.js` | Node runtime and environment secrets |
| PostgreSQL | Six migrations, role/Admin seeds | Persistent database reachable from the API |

`npm start` invokes `prestart` (`tsc`), so that startup command requires TypeScript installed. Alternatively, after building successfully, a host can run the existing compiled entry with `node dist/server.js`.

## Frontend on Vercel

The intended project root is `frontend`, build command `npm run build`, output directory `dist`. Use the frontend lockfile and a compatible Node environment. These settings alone do not connect the backend:

1. React Router paths such as `/login` and `/projects` need an `index.html` fallback for direct navigation.
2. Vite's development `/api` proxy is not emitted into production. Configure a same-origin `/api/*` reverse proxy to the real API before the SPA fallback.
3. Alternatively, `VITE_API_BASE_URL=https://YOUR_BACKEND_HOST/api` is supported as a build-time address, but cross-origin browser access requires an explicit backend CORS policy. The current Express app has no such policy, so this variable alone is insufficient.
4. `VITE_*` values are browser-visible. Never place database/JWT/Admin secrets in them.

No `vercel.json` fallback/rewrite file exists yet. Prepare it against the selected real API URL during deployment, then test it. Do not publish an invented hostname as a live demo.

## Backend and hosted database

Configure the variables in root `.env.example` through the API host's secret settings. Do not upload the local `.env`.

The data source currently uses separate `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` values. It has no application-level `DATABASE_URL` parsing or explicit SSL/TLS option. A provider requiring a connection URL/TLS needs matching connection configuration added and tested during deployment. Do not disable certificate validation as a shortcut.

For a newly provisioned hosted database, run migrations, seed roles, then seed the initial Admin. Skip `db:create` when the provider already created the database. Use unique credentials and complete the initial password change.

Check the selected providers' current free-plan terms, process sleep/cold starts, persistence, database connectivity and usage limits at deployment time. Notification polling does not require a WebSocket service.

## Before adding a live link

- Frontend uses HTTPS and nested-route refresh works.
- `/api/health` reaches the API, not the frontend HTML fallback.
- Hosted database connects and all six migrations are applied.
- Registration/login and mandatory password change work.
- Admin task creation and Member assignment-only access work.
- Version/archive/deletion rules still work remotely.
- Discussion persists with assignment/archive restrictions.
- Notifications persist, reach correct recipients, mark read and open authorized targets.
- Logout clears local session; invalid/stale tokens remain rejected by the API.

Live deployment is an optional assignment bonus. Update README URLs only after actual verification; local setup and GitHub deliverables remain independently usable.
