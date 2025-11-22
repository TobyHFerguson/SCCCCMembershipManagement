PR Draft: Refactor Manager to return errors instead of throwing AggregateError

Branch: `fix/migrate-return-errors`

Title: Refactor MembershipManagement.Manager to return errors (avoid AggregateError throws)

Summary

This PR refactors error handling in `MembershipManagement.Manager` to make it consistent with the generator/consumer pattern used across the codebase. Specifically, it removes throwing `AggregateError` from manager-level methods and returns `errors` arrays as part of the method return values. This enables consumers and wrappers to handle partial successes and failures deterministically and simplifies audit handling.

Files to change (high level)

- `src/services/MembershipManagement/Manager.js`
  - `generateExpiringMembersList`
    - Remove dead `AggregateError` throw. Ensure returned shape remains `{ messages, auditEntries }` or include `errors` if needed.
  - `migrateCEMembers`
    - Replace `throw new AggregateError(errors, ...)` with `return { numMigrations, auditEntries, errors }`.
- `__tests__/Manager.test.js`
  - Replace tests that expect thrown `AggregateError` with assertions that inspect returned `errors` and `auditEntries`.

Why this approach

- Matches `processPaidTransactions` and `processExpiredMembers`, which already return errors/data rather than throwing.
- Keeps generator methods pure and returns useful diagnostics to the caller.
- Avoids exception-driven logic for routine partial failures.

Detailed change plan

1) Create branch `fix/migrate-return-errors` from `copilot/add-audit-trail-to-spreadsheet` (or `main` depending on workflow).

2) Code changes in `Manager.js`:
   - In `migrateCEMembers`, after the migration loop, replace the block:

```js
    if (errors.length > 0) {
      throw new AggregateError(errors, 'Errors occurred while migrating members');
    }
    return { numMigrations, auditEntries };
```

with

```js
    return { numMigrations, auditEntries, errors };
```

   - In `generateExpiringMembersList`, remove the unused `errors` array and the `if (errors.length > 0)` check. If we want to preserve an `errors` return for consistency, change the return signature to `{ messages, auditEntries, errors }` and populate `errors` appropriately.

3) Update tests in `__tests__/Manager.test.js`:
   - Modify the migration failure test to call `migrateCEMembers()` and assert that the returned `errors.length > 0`, and that `auditEntries` contains the expected failure audit entries.
   - Update any other tests that expected `AggregateError` to instead assert on returned `errors`.

4) Run tests and iterate until green.

5) Update changelog and release notes: explain the behavioral change in Manager API (returning `errors` instead of throwing). Add migration notes if external callers depend on exception behavior.

Checklist (PR template)

- [ ] Branch created: `fix/migrate-return-errors`
- [ ] `migrateCEMembers` refactored to return `errors`
- [ ] `generateExpiringMembersList` cleaned up (dead `AggregateError` removed)
- [ ] Tests updated and passing (`npm test`)
- [ ] PR description references `docs/ISSUE-AGGREGATEERROR.md`
- [ ] README/Docs updated (if necessary)

Commands

Create branch and push:

```bash
# from repo root
git checkout -b fix/migrate-return-errors
# make changes
git add src/services/MembershipManagement/Manager.js __tests__/Manager.test.js
git commit -m "Refactor: return errors from migrateCEMembers; remove dead AggregateError" 
git push -u origin fix/migrate-return-errors
# open PR via gh CLI
gh pr create --base main --head fix/migrate-return-errors --title "Refactor Manager to return errors instead of throwing" --body-file docs/PR-AGGREGATEERROR.md
```

Notes for reviewers

- This PR intentionally changes public method return shapes for `migrateCEMembers`. Reviewers should confirm callers are updated or that these methods are internal-only.
- This refactor improves observability and makes the error handling pattern consistent across Manager methods.

If you want, I can also implement the code changes and tests now on this branch — say the word and I will open the branch, apply the edits, update tests, and run `npm test`.
