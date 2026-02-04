# Refactor processTransactions for Testability

## Problem

`MembershipManagement.processTransactions()` is extremely complex with 10+ hard-coded dependencies, making it impossible to write comprehensive wrapper tests. This allowed a production bug (row count mismatch) to slip through despite having good test coverage on individual components.

**Current dependencies (all hard-coded):**
- `SpreadsheetManager.convertLinks()`
- `SpreadsheetManager.getFiddler()`
- `SpreadsheetManager.getDataWithFormulas()`
- `SpreadsheetManager.getSheet()`
- `DataAccess.getActionSpecs()`
- `DataAccess.getPublicGroups()`
- `MembershipManagement.Manager` initialization
- `MembershipManagement.Internal.persistAuditEntries_()`
- `MemberPersistence.writeChangedCells()`
- `Common.Logger.info()`

**Impact:**
- Production bug in row count handling wasn't caught by tests
- Changes to wrapper logic require manual testing only
- Difficult to verify edge cases (row merges, error handling, etc.)
- Test coverage gap documented in `__tests__/MembershipManagement.wrapper.test.js` (lines 307-315)

## Current State

**What IS tested:**
- ✅ `Manager.processPaidTransactions()` - 127 tests including `convertJoinToRenew` logic
- ✅ `MemberPersistence.writeChangedCells()` - 13 tests
- ✅ `ValidatedMember` instance preservation - 2 regression tests
- ✅ `processExpirationFIFO` wrapper - 7 integration tests (good example to follow)

**What is NOT tested:**
- ❌ `processTransactions` wrapper integration
- ❌ Row count mismatch scenario (the bug we just fixed)
- ❌ Error handling paths in wrapper
- ❌ Audit entry persistence integration

## Recent Bug Example

**Bug:** Row count mismatch error when `convertJoinToRenew` merges duplicate member records.

**Root cause:** `processTransactions` blindly called `MemberPersistence.writeChangedCells()` without checking if row count changed (merge operations reduce array size).

**Fix:** Added conditional logic (lines 65-82 in MembershipManagement.js):
```javascript
if (membershipData.length !== originalMembershipRows.length) {
  // Row count changed (convertJoinToRenew merged records) - full rewrite
  const allRows = [headers, ...membershipData.map(m => m.toArray())];
  sheet.getRange(1, 1, allRows.length, headers.length).setValues(allRows);
} else {
  // Row count unchanged - selective updates (efficient)
  MemberPersistence.writeChangedCells(sheet, originalMembershipRows, membershipData, headers);
}
```

**Why test would have caught it:** Integration test would have verified both code paths with realistic data including duplicate members.

## Proposed Solution

Refactor `processTransactions` to use **dependency injection pattern** similar to how `Manager` class accepts injected dependencies.

### Option A: Extract Pure Logic to Core Module

Split into testable Core + thin Adapter:

```javascript
// MembershipManagementCore.js - Pure logic (100% testable)
class MembershipManagementCore {
  static shouldUseFullRewrite(originalRowCount, modifiedRowCount) {
    return originalRowCount !== modifiedRowCount;
  }
  
  static prepareDataForPersistence(membershipData, headers) {
    return [headers, ...membershipData.map(m => m.toArray())];
  }
}

// MembershipManagement.js - Thin adapter
MembershipManagement.processTransactions = function() {
  const originalRows = /* load from sheet */;
  const result = manager.processPaidTransactions(/* ... */);
  
  // Use testable Core logic
  if (MembershipManagementCore.shouldUseFullRewrite(originalRows.length, result.membershipData.length)) {
    const allRows = MembershipManagementCore.prepareDataForPersistence(result.membershipData, headers);
    sheet.getRange(1, 1, allRows.length, headers.length).setValues(allRows);
  } else {
    MemberPersistence.writeChangedCells(/* ... */);
  }
};
```

**Tests:**
```javascript
// MembershipManagementCore.test.js
test('shouldUseFullRewrite returns true when row counts differ', () => {
  expect(MembershipManagementCore.shouldUseFullRewrite(3, 2)).toBe(true);
});

test('shouldUseFullRewrite returns false when row counts match', () => {
  expect(MembershipManagementCore.shouldUseFullRewrite(3, 3)).toBe(false);
});
```

### Option B: Dependency Injection Pattern

Create internal helper with injected dependencies (following `processExpirationFIFO` pattern):

```javascript
MembershipManagement.Internal.processTransactionsWithDeps_ = function(deps) {
  const {
    transactions,
    membershipRows,
    expirySchedule,
    actionSpecs,
    autoGroups,
    manager,
    sheet,
    headers,
    persistAuditEntries,
    writeChangedCells,
    logger
  } = deps;
  
  const result = manager.processPaidTransactions(/* ... */);
  
  if (membershipRows.length !== result.membershipData.length) {
    // Full rewrite
    const allRows = [headers, ...result.membershipData.map(m => m.toArray())];
    sheet.getRange(1, 1, allRows.length, headers.length).setValues(allRows);
    logger.info('MembershipManagement', `Used full rewrite: ${membershipRows.length} original vs ${result.membershipData.length}`);
  } else {
    // Selective updates
    writeChangedCells(sheet, membershipRows, result.membershipData, headers);
    logger.info('MembershipManagement', 'Used selective updates');
  }
  
  return result;
};

MembershipManagement.processTransactions = function() {
  // Load data using GAS APIs
  const transactions = /* ... */;
  const membershipRows = /* ... */;
  // ...
  
  // Call testable helper with injected dependencies
  return MembershipManagement.Internal.processTransactionsWithDeps_({
    transactions,
    membershipRows,
    expirySchedule,
    actionSpecs,
    autoGroups,
    manager,
    sheet,
    headers,
    persistAuditEntries: MembershipManagement.Internal.persistAuditEntries_,
    writeChangedCells: MemberPersistence.writeChangedCells,
    logger: Common.Logger
  });
};
```

**Tests:**
```javascript
test('should use selective updates when row count unchanged', () => {
  const writeChangedCells = jest.fn();
  const setValues = jest.fn();
  const logger = { info: jest.fn() };
  
  const membershipRows = [/* 2 rows */];
  const membershipData = [/* 2 ValidatedMember instances */];
  
  MembershipManagement.Internal.processTransactionsWithDeps_({
    membershipRows,
    manager: { processPaidTransactions: () => ({ membershipData, actionSchedule: [], auditEntries: [] }) },
    sheet: { getRange: () => ({ setValues }) },
    headers: ['Email', 'Status'],
    writeChangedCells,
    logger,
    /* other deps */
  });
  
  expect(writeChangedCells).toHaveBeenCalled();
  expect(setValues).not.toHaveBeenCalled();
});

test('should use full rewrite when row count changed', () => {
  const writeChangedCells = jest.fn();
  const setValues = jest.fn();
  const logger = { info: jest.fn() };
  
  const membershipRows = [/* 3 rows */];
  const membershipData = [/* 2 ValidatedMember instances - merge happened */];
  
  MembershipManagement.Internal.processTransactionsWithDeps_({
    membershipRows,
    manager: { processPaidTransactions: () => ({ membershipData, actionSchedule: [], auditEntries: [] }) },
    sheet: { getRange: () => ({ setValues }) },
    headers: ['Email', 'Status'],
    writeChangedCells,
    logger,
    /* other deps */
  });
  
  expect(writeChangedCells).not.toHaveBeenCalled();
  expect(setValues).toHaveBeenCalled();
});
```

## Recommendation

**Use Option A (Core + Adapter)** for this specific case:
- The critical logic (row count check, data preparation) is pure JavaScript
- Can achieve 100% test coverage on business logic
- Follows existing codebase pattern (Manager.js, ValidatedMember.js, etc.)
- Minimal changes to existing wrapper

**Option B** is better suited for functions with complex orchestration logic that's harder to extract (like `processExpirationFIFO`).

## Acceptance Criteria

- [ ] Critical logic extracted to testable Core module
- [ ] Tests written for row count handling (both code paths)
- [ ] Test coverage for data preparation logic
- [ ] Wrapper test for integration (or explanation why not needed)
- [ ] All existing tests still pass
- [ ] Zero type errors (`npm run typecheck`)
- [ ] Documentation updated (JSDoc, architecture docs if needed)
- [ ] Manual testing in dev environment
- [ ] Remove or update test gap comment in `MembershipManagement.wrapper.test.js`

## Related Files

- `src/services/MembershipManagement/MembershipManagement.js` - Current implementation (lines 53-95)
- `src/services/MembershipManagement/Manager.js` - Example of well-tested Core logic
- `__tests__/MembershipManagement.wrapper.test.js` - Test gap documented (lines 307-315)
- `__tests__/Manager.test.js` - 127 tests showing good Core coverage
- `.github/gas-best-practices.md` - TDD workflow and Core/Adapter pattern

## Related Issues

- Recent bug fix: Row count mismatch error (February 3, 2026)
- Issue #366: SheetAccess migration (shows pattern for refactoring wrappers)

## Effort Estimate

**2-3 hours:**
- 1 hour: Extract Core logic and write tests
- 30 min: Update wrapper to use Core
- 30 min: Manual testing in dev
- 30 min: Documentation updates

## Priority

**Medium** - No immediate bug, but improves code quality and prevents future issues.

Better to fix during SheetAccess migration when wrapper code is already being touched.
