Issue: #262 — Expiration batching (updated scope)

Summary
-------
This updates issue #262 to explicitly include non-email side-effects discovered during implementation: group removals during Expiry4 processing. The overall goal remains to split expiration processing into a pure "generator" (plan) and a retrying "consumer" that applies side-effects and sends email in bounded batches, using a FIFO sheet as the durable queue.

Why this change
---------------
During implementation we discovered that `processExpirations` not only builds emails but also mutates state (member.Status) and calls group removal functions. Group removals are external, flaky, and retryable (Google Groups API, transient errors, rate-limits). Packing these into the generator causes either:
- generator to throw on group-remove failures (current behavior), or
- generator to swallow errors (bad for observability).

To make the system robust and consistent, generate a plan only (no side-effects). The consumer will apply state changes and side-effects with retries and dead-lettering.

Scope (updated)
----------------
- Generator (Manager.processExpirations): pure function that inspects membership data and expirySchedule and returns a plan object (no external side-effects).
  - Plan contains: message payloads (emails), side-effect actions (groupRemovals, groupAdds if any), and metadata to allow idempotent application by the consumer.
- Consumer (Manager.applyExpirationPlan / sendExpirationEmails): applies side-effects and sends emails in bounded batches (<= batchSize), with per-action retry semantics and aggregated results (no throwing for recoverable errors).
- Durable FIFO: a spreadsheet sheet (ExpirationEmails FIFO) will store serialized plan entries with attempts and lastError fields. Consumer reads N entries per run and processes them, moving failed entries to a DeadLetter sheet after maxRetries.
- Feature flag & dry-run: support a dry-run or test-sheet mode so operator can validate before enabling writes to production FIFO.

Acceptance criteria
-------------------
1. `Manager.processExpirations` returns a plan object:
   {
     id: <uuid>,
     createdAt: <ISO date>,
     messages: [ { to, subject, htmlBody, Type, meta } ],
     actions: [ { actionId, type: 'groupRemove'|'groupAdd'|'memberStatusChange', email, groupEmail, meta } ],
     meta: { ... }
   }
   - This function does not call `_sendEmailFun` or group remove/add functions.

2. `Manager.applyExpirationPlan(plan, emailSendFun, opts)` applies plan side-effects and sends emails. It:
   - applies actions idempotently (use membership/email + plan id for dedupe),
   - retries transient failures per-action (recording attempts),
   - returns an aggregated result: { applied: <number>, actionFailures: [...], emailFailures: [...], remainingActions: [...] }
   - Does not throw for expected transient failures; only throws on catastrophic errors (storage unavailable, programming errors).

3. A GAS-level `MembershipManagement.processExpirations()` wrapper:
   - calls Manager.processExpirations
   - serializes the plan and appends it to `ExpirationEmails` FIFO sheet (unless feature-flagged to dry-run/test-sheet)
   - if new entries were appended, ensure a consumer trigger is scheduled (minute-trigger) or a running consumer will pick it up

4. A GAS-level `MembershipManagement.sendExpirationEmails()` wrapper (consumer):
   - takes up to `batchSize` entries from `ExpirationEmails` FIFO,
   - calls `Manager.applyExpirationPlan` with a real `emailSendFun` (MailApp or test stub) and a group-manager implementation,
   - updates attempts and lastError fields for failed plan entries and re-schedules them (or moves to DeadLetter after `maxRetries`),
   - returns a run summary and ensures a re-trigger if entries remain.

5. FIFO schema and defaults documented (below) and unit/integration tests provided.

FIFO schema (suggested)
------------------------
ExpirationEmails (sheet)
- id (UUID)
- createdAt (ISO)
- planJSON (string, serialized plan)
- attempts (int)
- lastError (string)
- nextRetryAt (ISO|null)
- lockedBy (optional)
- lockedUntil (optional)

DeadLetter (sheet)
- id
- createdAt
- planJSON
- attempts
- firstError
- lastError
- movedAt

Configuration defaults
----------------------
- batchSize: 50
- maxRetries: 5
- retryBackoff: linear or exponential (configurable) — default linear 1 minute * attempts
- featureFlagProperty: `enableExpirationFifoWrites` (ScriptProperties) — default: false in production until validated

API Contracts (summary)
------------------------
- Manager.processExpirations(activeMembers, expirySchedule, prefillFormTemplate) => plan
  - pure: inspects and returns plan, does not write or mutate external systems. It may return an `errors[]` for data problems but should not throw for per-member group remove failures (since not performing them anymore).

- Manager.applyExpirationPlan(plan, groupManager, emailSendFun, opts) => { appliedCount, actionFailures, emailFailures }
  - Applies actions and sends emails; implement idempotent checks so re-processing a plan does not double-remove or re-send unnecessarily.

Observability & operator alerts
-------------------------------
- Every consumer run writes a short run-summary row to a `ExpirationRuns` sheet with timestamp, processedCount, sentCount, failedCount, deadLetterCount.
- When entries are moved to DeadLetter, send an operator alert (email to admin address in script properties) with sample entries and instructions.

Testing strategy
----------------
- Unit tests for `Manager.processExpirations` producing the expected plan shape and content (already updated).
- Unit tests for `Manager.applyExpirationPlan` that mock groupManager and emailSendFun to simulate success/failure and verify retry behavior.
- Integration-style tests using an in-memory FIFO implementation to exercise the consumer loop, retries, and dead-lettering.
- Manual dry-run on a spreadsheet copy, validated by operator.

Rollout plan
------------
1. Update the issue and this PR description (this file) so reviewers know the new scope.
2. Implement generator-only plan and consumer per the API above and add unit tests.
3. Add the FIFO writer and consumer GAS wrappers, guarded by `enableExpirationFifoWrites=false` by default.
4. Dry-run on a copy spreadsheet (operator validation).
5. Enable feature flag for a small pilot group (or time window), monitor errors and dead-letter counts.
6. Full switch-over when confidence is high.

Notes / rationale
-----------------
- Group removals are flaky and should have retries; the consumer is the correct place for that.
- Centralizing side-effects in one place (consumer) prevents partial mutations during plan building.
- The FIFO sheet is a pragmatic durable queue for GAS where external queues are not available.

Proposed text for GitHub issue body (copy/paste)
-----------------------------------------------
Title: Refactor expiration processing to generator + consumer (durable FIFO) — include group-removals in consumer

Body:
We discovered during implementation that Expiry processing performs side-effects beyond email (notably Google Group removals). These are flaky and retryable. This issue updates the scope: the generator must be pure and the consumer must apply side-effects and emails with retries and dead-lettering.

Acceptance criteria: (see above) — ensure the PR implements the generator plan, consumer apply with retries, FIFO schema, tests, and a dry-run/feature-flag rollout plan.

---

Please review this update and suggest wording changes; once you're happy I'll either post the content to the GitHub issue (if you want me to do that) or we can proceed with the refactor work.
