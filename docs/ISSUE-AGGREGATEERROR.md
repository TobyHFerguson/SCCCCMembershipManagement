Title: Inconsistent use of AggregateError in MembershipManagement.Manager — refactor to return errors

Summary

Several Manager methods in `src/services/MembershipManagement/Manager.js` handle batch errors inconsistently. Some methods throw an `AggregateError` (e.g. `migrateCEMembers`), while others return an `errors` array as part of their return value (e.g. `processPaidTransactions` and `processExpiredMembers` returns failed items). This inconsistency makes it difficult for callers and tests to reliably consume partial successes and failures and complicates wrapper logic and audit patterns.

Files/locations affected

- `src/services/MembershipManagement/Manager.js`
  - `generateExpiringMembersList` (dead `AggregateError` throw; `errors` is never populated)
  - `migrateCEMembers` (throws `AggregateError` on any migration error)
  - `processPaidTransactions` (already returns `errors` array)
  - `processExpiredMembers` (already returns structured `failed`/`processed` arrays)
- Tests:
  - `__tests__/Manager.test.js` (contains tests expecting `AggregateError` in migration failure scenario)

Problem details / reproduction

1. `migrateCEMembers` collects per-row errors into an `errors` array and at the end does: `if (errors.length > 0) { throw new AggregateError(errors, 'Errors occurred while migrating members'); }`. This causes the entire migration operation to throw on any failure, preventing callers from receiving a partial success result and the `auditEntries` and `numMigrations` in a structured way.

2. `generateExpiringMembersList` contains a check that throws `AggregateError` if `errors.length > 0`, but in the current implementation `errors` is never populated, so the throw is effectively dead code. This is confusing and should be cleaned up.

Why this matters

- Generator/consumer pattern in this codebase prefers generators to return data (including partial errors) and keep side-effects in consumers.
- Throwing `AggregateError` breaks this pattern and forces higher layers to use exception handling instead of examining structured results.
- Tests and wrappers must handle both thrown errors and returned errors, increasing complexity.

Proposed change (high level)

- Align Manager methods to a single error-handling pattern: return errors as data rather than throwing.
  - `migrateCEMembers` should return `{ numMigrations, auditEntries, errors }` and NOT throw.
  - Remove the dead `AggregateError` throw in `generateExpiringMembersList`. Either populate `errors` or remove the check entirely.
- Update callers and wrappers (if any) that currently expect exceptions from `migrateCEMembers` to handle returned `errors` instead.
- Update tests in `__tests__/Manager.test.js` to assert on returned `errors` rather than expecting an exception.

Acceptance criteria

- `migrateCEMembers` returns `{ numMigrations, auditEntries, errors }` and does not throw on partial failures.
- `generateExpiringMembersList` no longer contains dead/unused `AggregateError` throws.
- Tests updated: migration failure test inspects returned `errors` array and `auditEntries` rather than catching `AggregateError`.
- All existing tests pass (or are updated) and new behavior is documented in the issue/PR.

Suggested implementation notes

- Change `migrateCEMembers`:
  - At the end, `return { numMigrations, auditEntries, errors };` instead of throwing. Keep `errors` populated as currently done.
  - Update any code that called it and expected an exception.
- Change `generateExpiringMembersList`:
  - Remove `errors` array and the `if (errors.length > 0) { throw ... }` check, or make sure `errors` is actually used if intended.
- Update tests accordingly.

Risk and impact

- Medium: touches core business logic and tests. Should be done in its own focused PR to limit scope.
- Backwards compatibility: Callers expecting thrown exceptions will need to be updated; however, the rest of the codebase already contains methods that return structured error data (good precedent).

Notes / Implementation checklist

- [ ] Create a feature branch `fix/migrate-return-errors` (or similar)
- [ ] Modify `migrateCEMembers` and `generateExpiringMembersList` in `src/services/MembershipManagement/Manager.js`
- [ ] Update tests in `__tests__/Manager.test.js` to inspect returned `errors`
- [ ] Run `npm test` and fix regressions
- [ ] Create PR referencing this issue and update release notes

References

- Related PR: https://github.com/TobyHFerguson/SCCCCMembershipManagement/pull/272 (current audit-trail work)
- Context: generator/consumer separation pattern in `copilot-instructions.md` and project docs

Reporter: @toby (drafted by Copilot)
