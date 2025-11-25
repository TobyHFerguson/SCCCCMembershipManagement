# GAS PR Testing Guide

Purpose
- Centralize how to verify Google Apps Script behavior for PRs so reviewers and future contributors can reproduce tests.

Prerequisites
- Node/npm, gh, npx @google/clasp installed and authenticated.
- Repo checked out and up-to-date.

Local unit tests
1. Run all Jest tests:
   npm ci
   npm test
2. Run a focused test file:
   npm test -- __tests__/Manager.test.js

Dev deploy (safe sandboxed verification)
1. Push code to dev GAS environment:
   npm run dev:push
2. Create a dev version and redeploy (if needed):
   npm run dev:deploy
3. Run the relevant functions manually (Apps Script Editor / Web App / Trigger) or invoke via provided dev test scripts:
   npm run dev:profile-test

What to verify in GAS
- Executions & logs: Apps Script > Executions (or View > Execution Log in new IDE)
- Sheets created/modified: verify specific sheet names (e.g., ExpirationFIFO, ExpirationDeadLetter)
- Script Properties: check the Properties sheet or PropertiesService for any new/changed keys used by the PR
- Email/Group side-effects: for non-production tests use a test account or sandbox group to avoid live side-effects

Smoke test checklist to include in PR
- [ ] npm test passes locally
- [ ] dev push completed without errors
- [ ] dev redeploy created new version
- [ ] Relevant GAS function executed successfully in dev
- [ ] Expected sheets present and schema correct
- [ ] Audit entries written as expected
- [ ] No unexpected errors in Executions logs

How to run specific flows
- FIFO / Expiration flow:
  1. Ensure Bootstrap has required sheets
  2. Run MembershipManagement.generateExpiringMembersList (or wrapper)
  3. Run processExpirationFIFOTrigger or processExpirationFIFO wrapper
  4. Inspect ExpirationFIFO and ExpirationDeadLetter, and Audit sheet

- Web endpoints:
  1. Deploy web app to dev
  2. Open URL and exercise UI paths (or use curl with cookies/tokens)
  3. Inspect logs for auth/token flows

Recording results in the PR
- Add a short Test Summary in the PR body linking this doc and listing:
  - Commands run
  - Functions executed
  - Sheets/properties inspected
  - Any known issues or skipped checks

Rollback & re-deploy notes
- To rollback, redeploy previous GAS version via clasp or revert main to previous commit and run prod:deploy-live
- Always verify properties and sheet schema after rollback

Appendix: Useful commands
- Run tests: npm test
- Dev push: npm run dev:push
- Dev deploy: npm run dev:deploy
- Check Apps Script executions: open Apps Script Editor → Executions

# Testing
* [PR 272 Add business-level audit trail to spreadsheet](https://github.com/TobyHFerguson/SCCCCMembershipManagement/pull/272)
* [PR 269]


### Test Audit Logging

([PR 237](https://github.com/TobyHFerguson/SCCCCMembershipManagement/pull/272)),

Expiration Retry ()
 , Expiration Retry, DeadLetter
- Audit logging of Failures (to DeadLetter)
- Retrying expirations
- Move to Dead Letter on failure
  
#### Initial

### Expected Outcome
- `Expiration Dead Letter` will show expired members having failed to complete the expiration process because the `nonexistent@sc3.club` group didn't exist
- `Audit Log` will also show the failure
- `System Logs` will show how the process unwound
- `Expiry Schedule` & `Expiration Queue` will be empty, but will show partial results during processing.

