# GitHub and submission preparation

**Candidate:** Mahedee Hasan Shishir  
**Account:** https://github.com/mhshishir009  
**Suggested repository:** `smarttask-project-management-system` (not created yet)

Suggested description:

> A full-stack project and task management system with role-based access, analytics, project discussions, and notifications. Built with React, TypeScript, Express, TypeORM, and PostgreSQL for the Bright Mind Ltd recruitment assignment.

## Deliverables

| Requirement | Location/state |
|---|---|
| Application source | `src/`, `frontend/src/` |
| Overview/setup/configuration/run instructions | Root `README.md` |
| Schema/migrations and seed instructions | `src/infrastructure/database/migrations/`, `docs/DATABASE.md` |
| Sample data instructions | `docs/SAMPLE-DATA.md` |
| API documentation | `docs/API.md`, `docs/SmartTask.postman_collection.json` |
| One-page AI report | `AI-USAGE-REPORT.md`; review before submission |
| Optional screenshots | `docs/images/` |
| Local verification record | `docs/VERIFICATION.md` |
| GitHub URL/meaningful history | Pending publishing |
| Optional live demo | Pending; see `docs/DEPLOYMENT.md` |

## What to publish

Include source, lockfiles, migrations, tests, environment examples and documentation. Root `.gitignore` excludes actual environment files, dependencies, build output, logs/cache, local audit evidence and temporary artifacts. Curated screenshots live in `docs/images/`.

The confidential recruitment PDF and borrowed README examples are outside the project and are not copied into the submission. Do not add personal database dumps, real-user screenshots, access tokens or passwords.

## Repository creation and upload

1. Create a repository under your GitHub account. Choose appropriate visibility and ensure the reviewer can access it.
2. For this existing folder, leave automatic README/.gitignore/license initialization off; the local files will be uploaded.
3. Initialize this folder, review staged content, commit, and push to the actual URL GitHub returns. GitHub Desktop is an alternative to these commands.

The following commands are instructions, **not actions already executed**:

```bash
git init
git branch -M main
git check-ignore .env frontend/.env node_modules/ frontend/node_modules/ dist/ frontend/dist/ audit/ artifacts/
git add .
git diff --cached --name-only
git diff --cached --stat
git ls-files -- .env frontend/.env
```

The last command must print no real environment paths. Review staged contents before committing. If Git requests identity, use your real name and your GitHub-approved/noreply email, not an invented address.

```bash
git commit -m "Import SmartTask application and submission documentation"
git remote add origin YOUR_ACTUAL_GITHUB_REPOSITORY_URL
git push -u origin main
```

There is no existing Git history in this workspace. Keep the import honest; do not backdate or fabricate history. Use meaningful commits for subsequent real corrections/deployment changes. A single import alone does not establish the desired development history.

## Final review

- [ ] Review author details, limitations and AI report.
- [ ] Publish and verify reviewer access.
- [ ] Ensure secrets are absent from tracked files/history.
- [ ] Open README images/links on GitHub.
- [ ] Verify setup from a fresh checkout/disposable database.
- [ ] Keep Postman credentials/tokens local; remove them before exporting.
- [ ] Add a live URL only after deployment passes its checks.
- [ ] Recheck test/build results against the final commit.
- [ ] Be ready to explain authorization, task versions, transactions, persistence, recipient rules and AI-assisted work.
- [ ] Send repository URL, setup instructions and AI report through the original recruitment channel within its deadline.

This task does not create/push a repository or send a recruitment message automatically.
