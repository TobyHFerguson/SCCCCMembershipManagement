# PR proposal: assertion-mode + plan to simplify MembershipManager.findMemberIndex

This document is a short PR/implementation proposal you can use as the description when opening the work branch.

Summary
-------

We audited the `ActiveMembers` sheet (pasted into `tmp/ActiveMembers.tsv`) and found no duplicate emails and only one missing phone. This reduces the risk of simplifying our identity resolution.

Plan
----

1. Implement `MEMBERSHIP_ASSERTION_MODE` (Script Property default: false).
2. Add `MembershipManagement.Manager.assertMembershipInvariants(membershipData)` which logs duplicate emails and missing phones and optionally writes a brief row to `MembershipAuditLog` fiddler.
3. Run the assertion-mode in production for a 7–14 day window.
4. If no violations, open a follow-up PR to simplify `findMemberIndex` to the deterministic, email-first / phone-fallback algorithm and update tests.

Implementation notes
--------------------

- Location: `src/services/MembershipManagement/Manager.js`.
- Add tests in `__tests__/` to exercise assertion-mode and new simplified `findMemberIndex` behavior.
- Keep the current Policy B handling for ambiguous transactions during the audit window (do not auto-credit ambiguous txns).
- Document the feature flag and the small migration step (fix the one missing phone row) in the changelog.

Suggested PR title
------------------

feat(membership): add assertion-mode for identity invariants + plan to simplify findMemberIndex

Acceptance criteria
-------------------

- New unit tests covering assertion-mode and detection of duplicates/missing phones
- Script property `MEMBERSHIP_ASSERTION_MODE` honored and defaulting to false
- No change to the production-processing semantics while assertion-mode runs
- Follow-up PR to simplify `findMemberIndex` prepared after the assertion window

Useful commands (locally)
-------------------------

Create a branch, commit changes, and push:

```bash
git checkout -b feat/membership-assertions
git add -A
git commit -m "feat(membership): assertion-mode for identity invariants"
git push -u origin feat/membership-assertions
```

Open a PR using GitHub CLI (template will be the docs file above):

```bash
gh pr create --fill --title "feat(membership): assertion-mode for identity invariants" --body-file docs/pr/simplify-findMemberIndex-proposal.md
```

If you want I can implement the assertion-mode patch now and run the tests. Otherwise this PR text is ready for you to paste into a GitHub issue/PR.
