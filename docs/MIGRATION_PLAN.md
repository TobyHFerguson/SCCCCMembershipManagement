# Migration plan: move internal dates to canonical ISO (YYYY-MM-DD)

This document captures the design rationale, the safe migration checklist, helper API contracts, testing guidance, and a draft PR body for consolidating the work already on `fix/move-to-canonical-date-string`.

Summary
-------
- Goal: make the codebase use a canonical, deterministic, date-only internal representation: the ISO date string `YYYY-MM-DD`.
- Scope: small, incremental, non-breaking changes only. Do not deploy to production until spreadsheet migration is validated.
- Current state: `Manager` & its unit tests have been updated on branch `fix/move-to-canonical-date-string` to use ISO strings. This branch is meant to be reviewed and staged for follow-up work (sheet migration).

Design decisions & rationale
----------------------------
- Canonical internal representation: `YYYY-MM-DD` (text). Reasons: deterministic comparisons, lexical sort == chronological sort, timezone-agnostic when stored as date-only.
- Sheet policy (recommended): keep canonical ISO strings in a data column (hidden if desired) and maintain a date-typed display column for users to view and sort naturally. This is reversible and low-risk.
- Conversion policy: never implicitly convert values when reading sheets. Use explicit helper `parseSheetDate` to read and `writeDateToSheet` to write, with a feature flag gating writes to production cells.

Safe migration checklist (high level)
-----------------------------------
1. Backup & test copy
   - Make a full copy: File → Make a copy in Google Sheets. Label it `MIGRATION TEST - DO NOT EDIT`.
   - Export critical sheets as CSV for offline backup.

2. Add non-breaking helpers (read-only)
   - Implement `MembershipManagement.Utils.parseSheetDate(value, options)` that returns `''` for blank/unparseable or `YYYY-MM-DD` for parsed values.
   - Implement `MembershipManagement.Utils.writeDateToSheet(iso, sheet, row, col, opts)` (but gate its usage). The repo should only add these helpers now; writing logic stays unused until cutover.

3. Dry-run migration on test copy
   - Add two columns per date field: `Expires (ISO)` and `Expires (Display)`.
   - Run a dry-run script that reads the old column, normalizes with `parseSheetDate`, writes ISO to `Expires (ISO)` and a date-typed construct to `Expires (Display)` (or formula). The script must generate a CSV audit report and not modify original columns.

4. Validate
   - Verify sorting on both `Expires (ISO)` (lexicographic) and `Expires (Display)` (date-typed) produce identical chronological order.
   - Check dependent formulas, filters, and scripts for broken references.
   - Spot check edge cases: blank cells, locale strings (MM/DD/YYYY vs DD/MM/YYYY), date-time strings (strip time), serial numbers and formula results.

5. Production cutover (apply mode)
   - After validation, run the migration against production using the script’s `apply` mode.
   - Keep the original column for a grace period or replace it with ISO depending on downstream needs.
   - Flip the `writeDatesToSheets` feature flag only when you are ready to have application code update sheets.

Rollback
--------
- Use the CSV audit file produced by the dry-run / apply script to restore original values if needed.
- If code got merged and deployed prematurely: prefer `git revert <merge-commit>` and restore the sheet from backup.

Helper API contract (spec)
-------------------------
- parseSheetDate(value, options = {})
  - Accepts: Date object, number (sheet serial), ISO string, locale string, or null/empty
  - options.sheetLocale: 'US' | 'EU' | 'ISO' (default 'US')
  - Returns: ISO string `YYYY-MM-DD` on success, `''` for blank, `null` or `''` for unparseable (caller should flag)
  - Behavior: for Date inputs, convert to UTC-midnight and return ISO to avoid timezone shift. For numeric serials, convert to date using spreadsheet epoch conversion.

- writeDateToSheet(iso, sheet, row, col, opts = {})
  - opts.asDateCell (default true): if true, write a Date object (UTC-midnight) so Sheets treats the cell as date-typed; otherwise write the ISO text.
  - Must be used only when `writeDatesToSheets` flag is enabled.

Small implementation notes
--------------------------
- When creating Date objects for Sheets, use `new Date(Date.UTC(y, m-1, d))` to avoid timezone shifts when the sheet timezone is not UTC.
- Formula-based display option (no script required):
  - Given ISO in A2, display date typed value with:
    =DATE(VALUE(LEFT(A2,4)), VALUE(MID(A2,6,2)), VALUE(RIGHT(A2,2)))
  - After verifying, copy→Paste special→Values to convert formula results into static date values.

Validation checklist (pre-deploy)
-------------------------------
- All unit tests pass locally (run `npm test`).
- `__tests__/Manager.test.js` remains green with canonical expectations.
- Dry-run CSV: no unparseable rows (or manual review list handled).
- User acceptance: at least one member test user sorts and inspects the display column and finds behavior acceptable.

Draft PR body (copy-paste into PR when ready)
-------------------------------------------
Title: WIP: Move internal dates to canonical ISO (YYYY-MM-DD) — DO NOT MERGE

Body:
```
Summary
-------
This PR is a work-in-progress that moves internal date handling toward a canonical, date-only ISO representation (`YYYY-MM-DD`). It is intentionally marked WIP/draft and must NOT be merged or deployed until spreadsheet migration and UI validation are complete.

Files changed (high-level)
- `src/services/MembershipManagement/utils.js` — added/updated canonical helpers (parse/add/iso helpers)
- `src/services/MembershipManagement/Manager.js` — internal fields now use ISO date-only strings (non-deploy until sheet migration)
- `__tests__/Manager.test.js` — updated expectations to assert ISO strings

What remains
- Implement and validate `parseSheetDate` and a dry-run migration on a test copy of the spreadsheet.
- Add a feature flag `writeDatesToSheets` (default false) to prevent any writes to live sheet cells until migration is complete.
- Update dependent sheets/formulas to reference new display columns where appropriate.

Migration plan
- See `docs/MIGRATION_PLAN.md` (included in this PR) for an ordered checklist: backup -> helpers -> dry-run -> validate -> cutover

Testing
- Unit tests updated for Manager — run `npm test` locally. Do not deploy until manual sheet validation is complete.

Notes & rollback
- Keep the branch open and the PR in WIP state. If this is merged prematurely, revert with `git revert` and restore the sheet from backups.

```

Suggested reviewers: @yourself, any owner of the sheets or membership workflows

— end PR body

Next steps I can help with
-------------------------
- Add `parseSheetDate` and `writeDateToSheet` helpers (non-breaking). I can create the helper in `src/services/MembershipManagement/utils.js` and unit tests for it.
- Create the dry-run migration script (`scripts/migrate_dates.js` or `src/gas/migrate_dates.gs`) and a CSV audit output.

If you want, I can open a draft PR for you. Otherwise push and open it yourself. Suggested local commands:

```bash
# run tests
npm test

# commit any remaining work
git add -A
git commit -m "WIP: canonical date internals (ISO YYYY-MM-DD) + migration doc"
git push -u origin fix/move-to-canonical-date-string

# if you use GitHub CLI to open a draft PR:
gh pr create --title "WIP: Move internal dates to canonical ISO (YYYY-MM-DD) — DO NOT MERGE" \
  --body-file docs/MIGRATION_PLAN.md --draft --base main
```

Questions / notes
-----------------
- Do you want me to open the draft PR for you, or would you like to push and open it yourself? If you want me to open it, I will need your confirmation to run the push/open PR steps (I can prepare the commit locally and add the doc file now).

---
Generated on: 2025-11-15
