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
| MembershipManagement | MembershipManagement.js | 11 | ActiveMembers, ExpirySchedule, Transactions, MigratingMembers, ExpirationFIFO, ExpirationDeadLetter | HIGH |
| EmailChangeService | emailChangeService.js, Api.js | 4 | EmailChange, ActiveMembers, ExpirySchedule | MEDIUM |
| VotingService | VotingService.js, Data.js | 2 | ElectionConfiguration, Elections | MEDIUM |
| TokenStorage | TokenStorage.js | 4 | Tokens | LOW |
| Logger | Logger.js | 1 | SystemLogs | LOW (Layer 0 constraint) |
| Properties | Properties.js | 1 | Properties | LOW (Layer 0 constraint) |

**Total: ~27 usages across 6 modules**

### Migration Order (Risk-Based)

1. **Phase 1: Low-Risk Infrastructure** (2-3 hours)
   - TokenStorage (Tokens)
   
2. **Phase 2: VotingService** (2-3 hours)
   - VotingService.js (ElectionConfiguration)
   - Data.js (Elections)

3. **Phase 3: EmailChangeService** (3-4 hours)
   - emailChangeService.js (EmailChange, ActiveMembers, ExpirySchedule)
   - Api.js (EmailChange)

4. **Phase 4: MembershipManagement** (5-6 hours)
   - MembershipManagement.js (all 11 usages)
   - Complex Fiddler features: `.needFormulas()`, `.mapRows()`

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
- Issue #367: Migrate TokenStorage to SheetAccess
- Issue #368: Migrate VotingService to SheetAccess
- Issue #369: Migrate EmailChangeService to SheetAccess
- Issue #370: Migrate MembershipManagement to SheetAccess
- Issue #371: Migrate GroupSettings to SheetAccess
## Success Criteria (Per Migration)

- ✅ All `SpreadsheetManager.getFiddler()` calls replaced with `SheetAccess` equivalents
- ✅ All existing tests pass
- ✅ Zero production type errors
- ✅ Manual testing in dev environment successful
- ✅ Documentation updated if needed

## Final Goal (Issue #358)

After all migrations complete:
1. Remove Fiddler dependency from `appsscript.json`
2. Remove `getFiddler()` from `SpreadsheetManager`
3. Simplify `SheetAccess` to use native SpreadsheetApp only
