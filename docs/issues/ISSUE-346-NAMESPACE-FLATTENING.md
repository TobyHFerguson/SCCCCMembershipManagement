# Issue #346: Namespace Flattening Migration

## Overview

This document tracks the Phase -1 namespace flattening migration required before Phase 0 type fixes can proceed. The goal is to convert deep namespace patterns (e.g., `Common.Data.ValidatedMember`) to flat RideManager-style classes (e.g., `ValidatedMember`).

## Problem Statement

The SCCCCMembershipManagement codebase uses deep namespace nesting that conflicts with TypeScript's understanding of GAS runtime patterns:

```javascript
// ❌ Current pattern - causes TypeScript conflicts
const Common = { Data: { Storage: {} } };
Common.Data.ValidatedMember = (function() { class ValidatedMember {...} })();
```

The `const` declaration conflicts with `declare namespace` in `.d.ts` files, causing TypeScript to report errors on runtime assignments.

## Solution

Flatten all deep namespaces to the RideManager-style IIFE-wrapped class pattern:

```javascript
// ✅ Target pattern - no TypeScript conflicts
var ValidatedMember = (function() {
    class ValidatedMember {
        // ...
    }
    return ValidatedMember;
})();

// Node.js export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ValidatedMember;
}
```

Each class gets:
1. IIFE-wrapped class in `.js` file
2. Individual `.d.ts` file with `declare class ClassName {...}`
3. Global declaration in `global.d.ts`
4. All usages updated from `Namespace.ClassName` to `ClassName`

---

## Migration Progress

### Baseline (Before Phase -1)
- **Tests**: 1113 passing
- **Type Errors**: 330

### Phase -1 Step 1: Audit Namespace ✅ COMPLETE

**Commit**: `5f021b4` (2026-01-21)

| Old Name | New Name | Status |
|----------|----------|--------|
| `Audit.LogEntry` | `AuditLogEntry` | ✅ Complete |
| `Audit.Logger` | `AuditLogger` | ✅ Complete |
| `Audit.Persistence` | `AuditPersistence` | ✅ Complete |

**Changes Made**:
- Created `AuditLogEntry.js`, `AuditLogger.js`, `AuditPersistence.js` with IIFE pattern
- Created individual `.d.ts` files for each class
- Added global declarations to `global.d.ts`
- Updated 107+ usages across `src/` and `__tests__/`
- Removed `const Audit = {}` from `1namespaces.js`
- Deleted old `Audit.d.ts` (namespace-based)

**Results**:
- Tests: 1113 passing ✅
- Type Errors: 328 (down 2 from baseline)

---

## Dependency Order for Remaining Steps

The following namespaces must be flattened in **dependency order** to avoid circular reference issues:

1. **SpreadsheetManager** - Layer 0 foundation, no Common.* dependencies
2. **Properties** - Layer 0, depends on SpreadsheetManager
3. **Logger** - Layer 0, depends on Properties + SpreadsheetManager
4. **All other Common.* namespaces** - Layer 1+, depend on Logger

---

### Phase -1 Step 2: Common.Data.Storage.SpreadsheetManager ✅ COMPLETE

**Layer**: 0 (Foundation - cannot use Logger)

| Old Name | New Name | Status |
|----------|----------|--------|
| `Common.Data.Storage.SpreadsheetManager` | `SpreadsheetManager` | ✅ Complete |

**Changes Made**:
- Converted `SpreadsheetManager.js` to flat IIFE class pattern
- Created `SpreadsheetManager.d.ts` with typed method signatures
- Added global declaration in `global.d.ts` with typed overloads
- Updated ~50 usages from `Common.Data.Storage.SpreadsheetManager` to `SpreadsheetManager`
- Updated `Logger.js` availability check to use flat class pattern
- Updated `circular-dependency.test.js` assertion for new doc string
- Updated `EmailChangeService.Api.test.js` mock to include flat SpreadsheetManager
- Added backward compatibility bridge for gradual migration

**Results**:
- Tests: 1113 passing ✅
- Type Errors: 332 (slight increase, to be addressed in later phases)

---

### Phase -1 Step 3: Common.Config.Properties ⏳ PENDING

**Layer**: 0 (Foundation - cannot use Common.Logger)

| Old Name | New Name | Status |
|----------|----------|--------|
| `Common.Config.Properties` | `Properties` | ⏳ Pending |

---

### Phase -1 Step 4: Common.Logger ⏳ PENDING

**Layer**: 0 (Foundation - provides logging to all other modules)

| Old Name | New Name | Status |
|----------|----------|--------|
| `Common.Logger.info` | `Logger.info` | ⏳ Pending |
| `Common.Logger.error` | `Logger.error` | ⏳ Pending |
| `Common.Logger.warn` | `Logger.warn` | ⏳ Pending |
| `Common.Logger.debug` | `Logger.debug` | ⏳ Pending |
| `Common.Logger.configure` | `Logger.configure` | ⏳ Pending |

**Estimated Usages**: ~238

---

### Phase -1 Step 5: Common.Config.FeatureFlags ⏳ PENDING

| Old Name | New Name | Status |
|----------|----------|--------|
| `Common.Config.FeatureFlags` | `FeatureFlags` | ⏳ Pending |

---

### Phase -1 Step 6: Common.Auth Namespace ⏳ PENDING

| Old Name | New Name | Status |
|----------|----------|--------|
| `Common.Auth.TokenManager` | `TokenManager` | ⏳ Pending |
| `Common.Auth.VerificationCode` | `VerificationCode` | ⏳ Pending |
| `Common.Auth.Utils` | `AuthUtils` | ⏳ Pending |

---

### Phase -1 Step 7: Common.Api Namespace ⏳ PENDING

| Old Name | New Name | Status |
|----------|----------|--------|
| `Common.Api.ClientManager` | `ApiClientManager` | ⏳ Pending |

---

### Phase -1 Step 8: Common.Data Namespace ⏳ PENDING

| Old Name | New Name | Status |
|----------|----------|--------|
| `Common.Data.ValidatedMember` | `ValidatedMember` | ⏳ Pending |
| `Common.Data.MemberPersistence` | `MemberPersistence` | ⏳ Pending |
| `Common.Data.Access` | `DataAccess` | ⏳ Pending |

---

### Phase -1 Step 9: Common.Logging Namespace ⏳ PENDING

| Old Name | New Name | Status |
|----------|----------|--------|
| `Common.Logging.ServiceLogger` | `ServiceLogger` | ⏳ Pending |
| `Common.Logging.ServiceExecutionLogger` | `ServiceExecutionLogger` | ⏳ Pending |

---

### Phase -1 Step 8: Cleanup ⏳ PENDING

- [ ] Remove empty namespace declarations from `1namespaces.js`
- [ ] Update `NAMESPACE_DECLARATION_PATTERN.md` to reference new flat pattern
- [ ] Update `copilot-instructions.md` if needed
- [ ] Final test run and type error count

---

## After Phase -1: Resume Phase 0

Once all namespaces are flattened, resume Phase 0 type fixes:
- Remaining type errors should be actual type mismatches, not namespace conflicts
- No `@ts-ignore` should be needed for namespace patterns
- Follow RideManager's proven approach

---

## Reference

- **Issue**: #346
- **RideManager Pattern**: See `gas-best-practices.md` for IIFE class pattern
- **Related**: Issue #291 (SPA migration), PR #355 (type system improvements)
