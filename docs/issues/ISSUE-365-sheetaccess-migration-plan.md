# SheetAccess Migration Plan

## Overview

This document captures the migration plan for converting all remaining `SpreadsheetManager.getFiddler()` and `SpreadsheetManager.getSheet()` calls to use the new `SheetAccess` abstraction layer.

## Current State (Post-Issue #361)

The following have been migrated:
- ✅ `DirectoryService` (via `data_access.js`)
- ✅ `data_access.js` - 11 methods converted
- ✅ `AuditPersistence.js` - Already uses native pattern

## Remaining Migrations

### Summary of Direct SpreadsheetManager Usages

| Service/Module | File | Usages | Sheets Accessed | Risk Level |
|---------------|------|--------|-----------------|------------|
| MembershipManagement | MembershipManagement.js | 14 | ActiveMembers, ExpirySchedule, Transactions, MigratingMembers, ExpirationFIFO, ExpirationDeadLetter | HIGH |
| ~~EmailChangeService~~ | ~~emailChangeService.js, Api.js~~ | ~~4~~ | ~~EmailChange, ActiveMembers, ExpirySchedule~~ | ✅ DONE |
| ~~VotingService~~ | ~~VotingService.js, Data.js~~ | ~~2~~ | ~~ElectionConfiguration, Elections~~ | ✅ DONE |
| ~~TokenStorage~~ | ~~TokenStorage.js~~ | ~~4~~ | ~~Tokens~~ | ✅ DONE |
| Logger | Logger.js | 1 | SystemLogs | LOW (Layer 0 constraint) |
| Properties | Properties.js | 1 | Properties | LOW (Layer 0 constraint) |

**Remaining: 14 usages in MembershipManagement + 2 Layer 0 modules**

### Migration Order (Risk-Based)

1. ✅ **Phase 1: Low-Risk Infrastructure** - COMPLETED
   - ~~TokenStorage (Tokens)~~ - PR #372
   
2. ✅ **Phase 2: VotingService** - COMPLETED
   - ~~VotingService.js (ElectionConfiguration)~~ - PR #374
   - ~~Data.js (Elections)~~ - PR #374

3. ✅ **Phase 3: EmailChangeService** - COMPLETED
   - ~~emailChangeService.js (EmailChange, ActiveMembers, ExpirySchedule)~~ - PR #376
   - ~~Api.js (EmailChange)~~ - PR #376

4. **Phase 4: MembershipManagement** (4-5 hours) - Issue #370
   - MembershipManagement.js (all 14 usages)
   - Key decision: Use **Option B** (data-based injection) for `opts.fiddlers` pattern
   - This enables Issue #358 by eliminating Fiddler references from tests

### Special Considerations

#### Layer 0 Modules (DO NOT migrate yet)

The following modules are in Layer 0 and **cannot use SheetAccess** because SheetAccess depends on SpreadsheetManager, which is also Layer 0:

- `Logger.js` - Uses `SpreadsheetManager.getFiddler('SystemLogs')`
- `Properties.js` - Uses `SpreadsheetManager.getFiddler('Properties')`

These must remain using SpreadsheetManager directly until we remove Fiddler entirely (Issue #358).

#### Advanced Fiddler Features

Some usages require special handling:

1. **`.needFormulas()`** - For sheets with formulas
   ```javascript
   // Current
   const fiddler = SpreadsheetManager.getFiddler('Transactions').needFormulas();
   
   // After: SheetAccess handles this internally
   const data = SheetAccess.getDataWithFormulas('Transactions');
   ```

2. **`.mapRows()`** - For row transformation
   ```javascript
   // Current
   fiddler.mapRows((row) => { row.Email = newEmail; return row; });
   fiddler.dumpValues();
   
   // After: Use getData/setData pattern
   const data = SheetAccess.getData('EmailChange');
   const updated = data.map(row => { /* transform */ return row; });
   SheetAccess.setData('EmailChange', updated);
   ```

## Issues Created

- Issue #366: Migrate Remaining Services to SheetAccess (Tracking Issue)
- ✅ Issue #367: Migrate TokenStorage to SheetAccess - CLOSED (PR #372)
- ✅ Issue #368: Migrate VotingService to SheetAccess - CLOSED (PR #374)
- ✅ Issue #369: Migrate EmailChangeService to SheetAccess - CLOSED (PR #376)
- Issue #370: Migrate MembershipManagement to SheetAccess - **UPDATED**: Use Option B, 4-5 hours
- ~~Issue #371: Migrate GroupSettings to SheetAccess~~ - OBSOLETE (dead code removed)

## Success Criteria (Per Migration)

- ✅ All `SpreadsheetManager.getFiddler()` calls replaced with `SheetAccess` equivalents
- ✅ All existing tests pass
- ✅ Zero production type errors
- ✅ Manual testing in dev environment successful
- ✅ Documentation updated if needed

## Final Goal (Issue #358)

After MembershipManagement migration (Issue #370) completes:
1. Only Layer 0 modules (Logger.js, Properties.js) will still use SpreadsheetManager directly
2. Remove Fiddler dependency from `appsscript.json`
3. Remove `getFiddler()` from `SpreadsheetManager`
4. Simplify `SheetAccess` to use native SpreadsheetApp only

**Key Insight**: Using Option B (data-based injection) in Issue #370 means no test code will reference Fiddler, making Issue #358 a purely internal SheetAccess refactor.
