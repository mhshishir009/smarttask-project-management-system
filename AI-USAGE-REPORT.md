# AI Usage Report

**Candidate:** Mahedee Hasan Shishir  
**Project:** SmartTask - Smart Task & Project Management System  
**Prepared:** 26 October 2026

## Tools and scope

ChatGPT/Codex assisted with assignment-to-code inspection, backend debugging, React/API integration, targeted implementation, test creation, visual review, and submission documentation. The candidate directed scope, reported manual fixes, tested flows in the browser/Postman, and requested corrections. This report covers assistance evidenced in this project conversation; it does not claim that every line was written independently or that other tools were used.

## Three important prompts

These are English **paraphrases** of the candidate's Bengali/Banglish instructions, not verbatim quotations:

1. **Audit:** Read the assignment PDF, inspect my project against all business rules and requirements, and identify mismatches without changing code.
2. **Controlled fixes:** Fix one backend error at a time, add explanatory comments, preserve unrelated code/design, provide manual test steps, and wait for my result before the next fix.
3. **Integration and verification:** Connect the needed backend behavior to the frontend, add project-scoped discussion and recipient-specific event notifications within the agreed scope, test them, and prepare accurate submission documentation.

## One problem solved with AI

Task deletion required the current optimistic concurrency version. A manual DELETE request without `expectedVersion` returned `400 Invalid expected version`. The diagnosis distinguished required request data from a server defect. The frontend delete flow sends the current version; API documentation and manual requests describe the same contract. Repository/API tests cover missing/stale versions, permissions, and archived-project restrictions, and the candidate subsequently reported the manual test complete.

## One incomplete suggestion and its correction

An instruction used `npm --prefix frontend run lint/build` without sufficiently specifying the working directory. The candidate ran it while already inside `frontend/`, so npm searched for `frontend/frontend/package.json` and failed with ENOENT. The correction was to use prefixed commands from the repository root, or plain `npm run lint` / `npm run build` from inside `frontend/`. Setup instructions now state the directory explicitly. This illustrates why generated instructions needed to be checked against the actual environment.

## Verification and responsibility

The latest local verification recorded **294 passing Vitest tests across 22 files**, backend typecheck/build, and frontend lint/build. Real PostgreSQL discussion/notification smoke scripts use temporary tables and rollback, including permission, pagination, event-recipient, deduplication and transaction checks. The candidate reported completing core, discussion and notification manual tests; authentication design was checked on desktop/mobile while preserving its existing handlers. The suite is not described as 294 real-browser end-to-end tests.

Public deployment, fresh GitHub-clone setup, and a final technical explanation review remain pending. Before submission, the candidate should review this report for accuracy, understand the submitted code, and be prepared to explain AI-assisted changes. No confidential recruitment PDF, live credentials, tokens or production data are intentionally included in the submission documentation.
