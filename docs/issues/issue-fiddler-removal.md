# Remove Fiddler Library Dependency

## Overview

Replace the external `bmPreFiddler` library with native `SpreadsheetApp` calls throughout the codebase. This is a long-term architectural cleanup to reduce external dependencies and simplify the codebase.

## Current State

All spreadsheet access goes through `SpreadsheetManager.getFiddler(sheetName)` which uses the external `bmPreFiddler` library. While Fiddler works correctly, it adds:
- External dependency (3rd party library)
- Per-execution caching complexity
- Additional abstraction layer

**Example Pattern** (already established in `AuditPersistence.js`):
```javascript
// ✅ Native SpreadsheetApp pattern
const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Audit');
const lastRow = sheet.getLastRow();
sheet.getRange(lastRow + 1, 1, auditEntries.length, headers.length).setValues(rows);
```

## Goals

1. Replace all `getFiddler()` calls with native `SpreadsheetApp` API
2. Maintain same functionality (get data, set data, formulas, etc.)
3. Remove `bmPreFiddler` from `appsscript.json` dependencies
4. All 1113+ tests still passing
5. Zero production type errors maintained

## Recommended Approach

**Agent Models**:
- **Opus** for planning (migration strategy, risk analysis, rollback plan)
- **Sonnet** for execution (sheet-by-sheet migration following pattern)

### Phase 1: Planning and Risk Analysis (Opus, 2-3 hours)

**Deliverables**:

1. **Migration Strategy**:
   - Sheet-by-sheet incremental migration (NOT big bang)
   - Which sheets to migrate first (lowest risk)
   - Which sheets to migrate last (highest risk)
   - Testing strategy for each sheet

2. **Pattern Extraction** from `AuditPersistence.js`:
   ```javascript
   // Read pattern
   const sheet = SpreadsheetManager.getSheet(sheetName);
   const data = sheet.getDataRange().getValues();
   const headers = data[0];
   const rows = data.slice(1);
   
   // Write pattern
   sheet.getRange(startRow, startCol, numRows, numCols).setValues(values);
   
   // Append pattern
   const lastRow = sheet.getLastRow();
   sheet.getRange(lastRow + 1, 1, newRows.length, headers.length).setValues(newRows);
   ```

3. **Risk Assessment**:
   - Which sheets have complex Fiddler usage (formulas, links)?
   - Which services are most critical (avoid breaking MembershipManagement first)?
   - What's the rollback plan if migration fails?

4. **Testing Strategy**:
   - Unit tests: Update mocks to use SpreadsheetApp
   - Integration tests: Verify each sheet after migration
   - Manual tests: Test critical workflows in dev environment

### Phase 2: Low-Risk Sheets (Sonnet, 2-3 hours)

**Target Sheets** (simple read/write, low criticality):
- `SystemLogs` - Logging only
- `Audit` - Already migrated in `AuditPersistence.js`
- `Bootstrap` - Config sheet, rarely written

**Per-Sheet Process**:
1. Identify all `getFiddler('SheetName')` calls
2. Replace with native `SpreadsheetApp` pattern
3. Update tests (mocks)
4. Run tests: `npm test -- --testNamePattern="SheetName"`
5. Deploy to dev: `npm run dev:push`
6. Manual verification in dev environment
7. Commit and push (one sheet per commit)

### Phase 3: Medium-Risk Sheets (Sonnet, 3-4 hours)

**Target Sheets** (complex operations, moderate criticality):
- `Elections` - VotingService
- `Tokens` - Auth system
- `ExpirationFIFO` - Retry queue

**Additional Considerations**:
- Handle Fiddler-specific methods (`getDataWithFormulas`, `convertLinks`)
- Preserve caching behavior if needed (or verify not needed)
- More extensive testing (all related tests must pass)

### Phase 4: High-Risk Sheets (Sonnet, 3-4 hours)

**Target Sheets** (critical business logic):
- `ActiveMembers` - Core member data
- `ActionSpecs` - Membership processing rules
- `ExpirySchedule` - Renewal logic

**Critical Path**:
- Deploy to dev first
- Extensive manual testing
- Leave in dev for 24-48 hours
- Monitor for errors
- Only then deploy to staging

### Phase 5: SpreadsheetManager Cleanup (Sonnet, 1 hour)

1. Remove `getFiddler()` method
2. Remove Fiddler caching logic
3. Keep `getSheet()` method (still useful)
4. Update `appsscript.json` to remove `bmPreFiddler` library
5. Update documentation

### Phase 6: Final Verification (1 hour)

```bash
# All tests must pass
npm test  # 1113+ passing

# No type errors
npm run typecheck  # 0 production errors

# Verify in staging
npm run stage:deploy
# Run full manual test suite (all services)

# Deploy to prod
npm run prod:deploy-live
# Monitor for errors in first 24 hours
```

## Migration Tracking

Create a checklist issue to track progress:

- [ ] **Phase 1: Planning** (Opus)
  - [ ] Migration strategy document
  - [ ] Risk assessment
  - [ ] Testing strategy

- [ ] **Phase 2: Low-Risk Sheets** (Sonnet)
  - [ ] SystemLogs
  - [ ] Bootstrap
  
- [ ] **Phase 3: Medium-Risk Sheets** (Sonnet)
  - [ ] Elections
  - [ ] Tokens
  - [ ] ExpirationFIFO
  
- [ ] **Phase 4: High-Risk Sheets** (Sonnet)
  - [ ] ActiveMembers
  - [ ] ActionSpecs
  - [ ] ExpirySchedule
  
- [ ] **Phase 5: SpreadsheetManager Cleanup** (Sonnet)
  - [ ] Remove getFiddler()
  - [ ] Remove Fiddler caching
  - [ ] Update appsscript.json
  
- [ ] **Phase 6: Verification**
  - [ ] All tests passing
  - [ ] Dev testing complete
  - [ ] Staging deployment successful
  - [ ] Prod deployment successful

## Success Criteria

- ✅ All `getFiddler()` calls replaced with native `SpreadsheetApp`
- ✅ `bmPreFiddler` library removed from `appsscript.json`
- ✅ All 1113+ tests still passing
- ✅ 0 production type errors maintained
- ✅ All services verified in production
- ✅ No performance degradation
- ✅ Documentation updated

## Effort Estimate

**8-16 hours total**:
- Opus planning: 2-3 hours
- Sonnet low-risk: 2-3 hours
- Sonnet medium-risk: 3-4 hours
- Sonnet high-risk: 3-4 hours
- Cleanup: 1 hour
- Verification: 1 hour

## Priority

**LOW** - Architectural improvement, not a functional requirement. Current system works correctly.

## Benefits

1. **Reduced Dependencies**: One less external library to maintain
2. **Simplified Codebase**: Native API is more straightforward
3. **Better Type Safety**: Native types from `@types/google-apps-script`
4. **Performance**: Eliminate Fiddler caching overhead (if not needed)

## Risks

1. **Breaking Changes**: Fiddler may have subtle behaviors we depend on
2. **Testing Complexity**: Hard to test spreadsheet operations comprehensively
3. **Time Investment**: 8-16 hours for marginal benefit

## Mitigation

- Incremental migration (one sheet at a time)
- Extensive testing at each step
- Deploy to dev → staging → prod with monitoring
- Keep commits small for easy rollback

## Notes

- `AuditPersistence.js` already uses native pattern - reference implementation
- Consider if Fiddler caching provides significant performance benefit
- Some Fiddler methods (`getDataWithFormulas`, `convertLinks`) may need custom implementations
- This work could be split across multiple PRs (one per phase)
