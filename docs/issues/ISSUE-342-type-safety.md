# Refactor: Ensure system is type correct, with minimal type escapes

## Problem Statement

The codebase has **insufficient TypeScript type coverage**, leading to runtime errors that should have been caught at compile-time. Multiple production bugs have been caused by missing or incorrect JSDoc type annotations.

## Bugs Caused by Missing Types

### Bug 1: `toArray is not a function` (Feb 2026)
- **Symptom**: Runtime error when processing new member transactions
- **Root Cause**: `Manager.addNewMember_()` had **no JSDoc annotations** - returned plain object instead of `ValidatedMember` instance
- **TypeScript would have caught**: `Type '{ Email: string; Status: string; }' is not assignable to type 'ValidatedMember'. Property 'toArray' is missing.`
- **Fix**: Added JSDoc with `@returns {ValidatedMember}` - forced implementation to use constructor

### Bug 2: Spread operator on untyped object
- **Symptom**: TypeScript error `TS2556: A spread argument must either have a tuple type or be passed to a rest parameter`
- **Root Cause**: `extractDirectorySharing_()` had no return type JSDoc, so `...Object.values()` couldn't be verified
- **Fix**: Added explicit return type JSDoc and replaced spread with explicit property access

## Patterns That Need Fixing

### 1. Methods without JSDoc annotations
Many private methods (especially `*_` suffixed) lack any type annotations:
```javascript
// ❌ WRONG - No JSDoc, TypeScript can't help
addNewMember_(txn, expirySchedule, membershipData) {
  return { Email: txn.email };  // Plain object - no error!
}

// ✅ CORRECT - Full type safety
/**
 * @param {Record<string, any>} txn
 * @param {Array<Record<string, any>>} expirySchedule
 * @param {ValidatedMember[]} membershipData
 * @returns {ValidatedMember}
 */
addNewMember_(txn, expirySchedule, membershipData) {
  return { Email: txn.email };  // TypeScript ERROR!
}
```

### 2. Mismatched JSDoc vs `.d.ts` files
Example: `ValidatedMember` constructor
- JSDoc said `@param {Date} renewedOn`
- Implementation accepted `null | string | Date`
- `.d.ts` said `renewedOn: Date | null`
- Passing `''` caused TypeScript error

### 3. `{any}` and `{Object}` usage
Per `gas-best-practices.md`, these defeat type checking:
```javascript
// ❌ WRONG
@param {any} data
@param {Object} options

// ✅ CORRECT
@param {ValidatedMember} data
@param {{force?: boolean, debug?: boolean}} options
```

### 4. Implicit `any` in array callbacks
```javascript
// ❌ WRONG - item is implicitly 'any'
members.map(item => item.Email)

// ✅ CORRECT - array typed, item inferred
/** @param {ValidatedMember[]} members */
function getEmails(members) {
  return members.map(item => item.Email);  // item is ValidatedMember
}
```

## Acceptance Criteria

### Must Have
- [ ] `npm run typecheck` reports **zero errors** in `src/` directory
- [ ] All public methods have complete JSDoc (`@param` and `@returns`)
- [ ] All private methods (`*_` suffix) have complete JSDoc
- [ ] No `@param {any}` or `@param {Object}` without justification comment
- [ ] All `.d.ts` files match their `.js` implementations exactly

### Should Have
- [ ] `npm run validate-types` script validates `.d.ts` matches `.js`
- [ ] Pre-commit hook runs `npm run typecheck`
- [ ] CI fails on any TypeScript error

### Nice to Have
- [ ] Enable `noImplicitAny` in `tsconfig.json` (may require significant cleanup)
- [ ] Enable `strictNullChecks` for null safety

## Files to Audit (Priority Order)

1. **Manager classes** (business logic - highest risk)
   - `src/services/MembershipManagement/Manager.js`
   - `src/services/*/Manager.js`

2. **Data layer** (type boundaries)
   - `src/common/data/ValidatedMember.js`
   - `src/common/data/MemberPersistence.js`
   - `src/common/data/data_access.js`

3. **Type definitions** (must match implementations)
   - `src/types/global.d.ts`
   - `src/types/membership.d.ts`

## Implementation Approach

1. **Audit each file** for methods missing JSDoc
2. **Add JSDoc** with proper types (not `any`)
3. **Run `npm run typecheck`** after each file
4. **Update `.d.ts`** if implementation signature changed
5. **Run tests** to verify no regressions

## References

- `gas-best-practices.md` - Type Safety Patterns section
- `gas-best-practices.md` - Zero Tolerance for `any` and `Object`
- `gas-best-practices.md` - Detecting Hidden `any` Types
