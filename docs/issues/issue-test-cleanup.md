# Test File Type Error Cleanup

## Overview

Clean up type errors in test files (`__tests__/`) to improve type safety and IntelliSense support during test development. This is a LOW priority task since all 1113 tests currently pass - these are mock type mismatches, not actual bugs.

## Current State

- **Production errors (src/)**: 0 ✅
- **Test errors (__tests__/)**: 326 ⚠️
- **Tests passing**: 1113/1113 ✅

## Goals

- Reduce test file type errors from 326 to < 50
- Fix mock object types in `__mocks__/google-apps-script.ts`
- Add type annotations to test helper functions
- Use `@ts-ignore` with justification for intentionally incomplete mocks

## Recommended Approach

**Agent Model**: Sonnet (mechanical fixes, repetitive patterns)

### Phase 1: Mock Type Fixes (1-2 hours)
1. Update `__mocks__/google-apps-script.ts` with more complete type signatures
2. Add proper types for `SpreadsheetApp`, `Sheet`, `Range` mocks
3. Document which methods are intentionally incomplete

### Phase 2: Helper Function Types (1 hour)
1. Add types to test helper factories in `__tests__/helpers/`
2. Ensure `fiddlerMock.js` has proper JSDoc types

### Phase 3: Test-Specific Fixes (1-2 hours)
1. Add inline types for test data objects
2. Use `@ts-ignore` with comments for edge case tests
3. Verify no new test errors introduced

## Success Criteria

```bash
# Target: < 50 test errors
npm run typecheck 2>&1 | grep "^__tests__/" | wc -l

# Must maintain: All tests passing
npm test  # 1113+ passing
```

## Effort Estimate

**2-4 hours** - Mechanical cleanup, low complexity

## Priority

**LOW** - Nice to have for developer experience, not blocking any functionality

## Notes

- This work improves IntelliSense and catches test bugs earlier
- Does NOT affect production code or runtime behavior
- Can be done incrementally (fix one test file at a time)
- Consider doing this work when onboarding new developers who rely on IDE hints
