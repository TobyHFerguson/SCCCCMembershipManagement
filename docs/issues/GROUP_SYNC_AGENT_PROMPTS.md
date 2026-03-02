# Group Sync — Agent Prompts for Sub-Issues

> **Usage**: Copy the prompt for the relevant issue and paste it into Copilot chat when assigning the issue to an agent. Each prompt provides the context the agent needs beyond what's in the issue itself.

---

## Issue #433 — ValidatedGroupDefinition + DataAccess + backward-compatible getPublicGroups

```
Implement issue #433. This creates a new ValidatedGroupDefinition class and updates DataAccess.

Before writing any code, read these files to understand the exact patterns you must follow:
- src/common/data/ValidatedPublicGroup.js (the class you're modeling after — copy its IIFE pattern, fromRow pattern, validateRows pattern, and module.exports pattern exactly)
- __tests__/ValidatedPublicGroup.test.js (copy this test structure exactly, including the column-order independence tests)
- src/common/data/data_access.js (understand the getPublicGroups method you'll be wrapping)
- src/types/global.d.ts (search for ValidatedPublicGroup to see the type declaration pattern: declare var + interface)
- src/zVerifyDeployment.js (search for PublicGroups to see where to update the sheet reference)
- .github/gas-best-practices.md (search for "IIFE" and "static get" to understand mandatory patterns)

Key things to get right:
1. The IIFE pattern: `var ValidatedGroupDefinition = (function() { class ValidatedGroupDefinition { ... } return ValidatedGroupDefinition; })();` — use `var`, not `const`
2. Email normalization: if Email field has no `@`, append `@sc3.club`
3. `getPublicGroups()` must become a wrapper that calls `getGroupDefinitions()` and maps results to ValidatedPublicGroup instances — this preserves backward compatibility for all existing consumers
4. The column-order independence test is MANDATORY
5. Run `npm run validate-all` before committing and confirm all existing tests still pass without modification
```

---

## Issue #434 — GroupSubscription.listMembers adapter

```
Implement issue #434. This adds a single method to an existing file.

Before writing any code, read:
- src/gas_integration/GroupSubscription.js (the entire file — it's ~106 lines. Your new method must follow the exact same style)

Focus specifically on the `listGroupsFor` method — your `listMembers` method uses the same pagination pattern but with a different API call:
- `listGroupsFor` calls `AdminDirectory.Groups.list({userKey: email, ...})`
- `listMembers` calls `AdminDirectory.Members.list(groupEmail, {pageToken: ..., maxResults: ...})`

Note the API difference: Members.list takes the groupKey as the FIRST positional argument, not inside the options object.

Also add a verification check in src/zVerifyDeployment.js — search for existing GroupSubscription checks or add one near the AdminDirectory verification section.

This is a small issue — the main risk is getting the AdminDirectory.Members.list API signature wrong. The implementation in the issue body is correct; follow it closely.

Run `npm run validate-all` before committing.
```

---

## Issue #435 — GroupSync.Manager — resolution engine

```
Implement issue #435. This creates the core pure-logic resolution engine.

Before writing any code, read these files:
- src/common/data/ValidatedGroupDefinition.js (created in #433 — understand the shape: Name, Email, Aliases, Subscription, Type, Members, Managers, Note)
- src/services/GroupManagementService/Manager.js (example of a pure-logic Manager class using namespace extension pattern)
- .github/gas-best-practices.md (search for "IIFE" for class pattern)
- src/1namespaces.js (understand namespace declaration — but do NOT modify this file yet; that's issue #437)

Key design decisions:
1. This file uses namespace extension: `if (typeof GroupSync === 'undefined') GroupSync = {};` at the top, then `GroupSync.Manager = (function() { ... })();`
2. ALL methods are static — this is a utility class, not instantiated
3. `resolveToEmails` is recursive with cycle detection via a `visited` Set. Use BACKTRACKING: add to visited before recursing, remove after, so the same group can appear in multiple independent branches
4. The `visited` parameter uses group Names (case-insensitive), not emails
5. Results must be deduplicated and sorted
6. `Anyone` keyword is SKIPPED (produces no emails) — it means self-service subscription
7. `Everyone` keyword resolves to all active member emails
8. Bare names without `@` that don't match a group Name are treated as emails and get `@sc3.club` appended
9. `computeDesiredState` returns null for desiredMembers/desiredManagers when that dimension shouldn't be synced (per the sync scope rules in the issue)

For the test file, set up the namespace mock: `global.GroupSync = {};` before requiring the module. Create realistic test data that mirrors the actual Google_Groups.md structure (Officers containing President/VP/Treasurer/Secretary, Directors containing Officers, etc.) to catch real-world edge cases.

Zero GAS dependencies allowed in Manager.js. Run `npm run validate-all` before committing.
```

---

## Issue #436 — GroupSync.Manager — reconciliation engine (computeActions)

```
Implement issue #436. This adds computeActions and formatActionsSummary to the existing GroupSync.Manager class.

Before writing any code, read:
- src/services/GroupSync/Manager.js (created in #435 — you're adding to this file inside the existing IIFE)
- __tests__/GroupSync.Manager.test.js (created in #435 — you're adding test sections to this file)

Key rules for reconciliation logic:
1. OWNERs are SACRED — never add, remove, promote, or demote an OWNER. Filter them out before all diffing.
2. All email comparisons must be case-insensitive (lowercase both sides)
3. When desiredMembers is null, skip member reconciliation entirely
4. When desiredManagers is null, skip manager reconciliation entirely
5. When removing an extra MANAGER: if desiredMembers is also managed AND the email IS in desiredMembers → DEMOTE (not remove). If desiredMembers is managed but email is NOT there → REMOVE. If desiredMembers is null (not managed) → DEMOTE to regular member.
6. formatActionsSummary should produce human-readable lines like "ADD toby@gmail.com → Board Announcements (MANAGER)"

Add your methods inside the existing IIFE class body, before `return Manager;`. Add test sections to the existing test file. Do not create new files.

Run `npm run validate-all` before committing.
```

---

## Issue #437 — GAS integration (namespace, menu, orchestration, audit, dry-run)

```
Implement issue #437. This wires everything together into a working GAS integration.

Before writing any code, read ALL of these carefully:
- src/1namespaces.js (you'll add the GroupSync namespace declaration here)
- src/triggers.js (you'll add GroupSync.Menu.create() to onOpen)
- src/services/VotingService/Menu.js (simplest menu pattern to follow)
- src/services/MembershipManagement/Menu.js (the wrapMenuFunction_ pattern and global function pattern)
- src/services/MembershipManagement/MembershipManagement.js (search for "AuditLogger" and "persistAuditEntries" to understand the audit pattern)
- src/common/audit/AuditPersistence.js (how audit entries are persisted)
- src/gas_integration/GroupSubscription.js (the adapter methods you'll call: listMembers, subscribeMember, removeMember, updateMember)
- src/services/GroupSync/Manager.js (the pure logic you're orchestrating)
- src/common/data/data_access.js (DataAccess.getGroupDefinitions and DataAccess.getMembers)

Critical patterns:
1. Namespace: `const GroupSync = { Internal: {} };` in 1namespaces.js
2. Menu callbacks MUST be global functions (not namespace methods) — GAS menu items can only call global scope functions
3. Named `syncGroups` and `syncGroupsDryRun` — check these don't collide with existing globals
4. All AdminDirectory operations go through GroupSubscription adapter — NEVER call AdminDirectory directly
5. Dry-run shows a dialog with planned actions; live mode executes them and shows results
6. Each action execution is wrapped in try-catch for graceful partial failure
7. Add deployment verification checks in zVerifyDeployment.js

For getActiveEmails_(): use DataAccess.getMembers() and filter/map to get lowercase email strings for active members. Check how MembershipManagement determines active status.

Run `npm run validate-all` before committing. After pushing, wait for BOTH CI and Deploy & Verify workflows to be green — the Deploy & Verify workflow will test that the namespace loads, the menu function exists, and the global functions are callable in the GAS runtime.
```

---

## Issue #438 — Migration (populate GroupDefinitions sheet, update Bootstrap)

```
Implement issue #438. This is primarily a manual migration task with some code verification.

The manual steps (which I will do in the spreadsheet):
1. Rename the PublicGroups sheet tab to GroupDefinitions
2. Add columns: Aliases, Type, Members, Managers, Note
3. Reorder columns to match HEADERS order
4. Populate all ~30 rows from docs/Google_Groups.md
5. Update Bootstrap sheet reference from PublicGroups to GroupDefinitions

Your job as agent:
1. Verify there are NO remaining references to 'PublicGroups' as a string literal in src/ — run: grep -rn "'PublicGroups'" src/
2. If any remain, update them to 'GroupDefinitions'
3. Run npm run validate-all to confirm everything passes
4. After I've made the spreadsheet changes in staging, verify Deploy & Verify passes

This issue may have minimal or no code changes if issues #433 and #437 already handled all the string reference updates. The main value is the verification step.
```

---

## General Tips for All Issues

When starting any issue, tell the agent:

```
Read .github/copilot-instructions.md and .github/gas-best-practices.md before starting. These contain mandatory project rules. Key rules:
- IIFE-wrapped classes (never bare class declarations)
- static get for constants (never static fields)
- var for top-level declarations (never const in GAS global scope for classes)
- SheetAccess for all spreadsheet operations
- No @param {any} or @param {Object} without JUSTIFIED comment
- Run npm run validate-all before every commit
- Both CI and Deploy & Verify workflows must be green before the PR is ready
```
