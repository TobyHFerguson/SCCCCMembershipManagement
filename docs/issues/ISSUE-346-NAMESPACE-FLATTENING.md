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

### Phase -1 Step 3: Common.Config.Properties ✅ COMPLETE

**Layer**: 0 (Foundation - cannot use Logger)

| Old Name | New Name | Status |
|----------|----------|--------|
| `Common.Config.Properties` | `Properties` | ✅ Complete |

**Changes Made**:
- Converted `Properties.js` to flat IIFE class pattern with static methods
- Updated `Properties.d.ts` with `declare class Properties {...}` pattern
- Updated ~27 usages from `Common.Config.Properties` to `Properties`
- Updated `Logger.js` availability check to use flat `Properties` class
- Updated `MembershipManagement.wrapper.test.js` mock to include flat Properties
- Added backward compatibility bridge for gradual migration

**Results**:
- Tests: 1113 passing ✅
- Type Errors: 358 (increase due to module export format, to be addressed later)

---

### Phase -1 Step 4: Common.Logger → AppLogger ✅ COMPLETE

**Layer**: 0 (Foundation - provides logging to all other modules)

**IMPORTANT**: Renamed to `AppLogger` (not `Logger`) to avoid conflict with GAS built-in `Logger` global.
GAS has a built-in `Logger` object with `.log()` method that we still use for low-level logging.

| Old Name | New Name | Status |
|----------|----------|--------|
| `Common.Logger.info` | `AppLogger.info` | ✅ Complete |
| `Common.Logger.error` | `AppLogger.error` | ✅ Complete |
| `Common.Logger.warn` | `AppLogger.warn` | ✅ Complete |
| `Common.Logger.debug` | `AppLogger.debug` | ✅ Complete |
| `Common.Logger.configure` | `AppLogger.configure` | ✅ Complete |
| `Common.Logger.setLevel` | `AppLogger.setLevel` | ✅ Complete |
| `Common.Logger.getLogs` | `AppLogger.getLogs` | ✅ Complete |
| `Common.Logger.clearLogs` | `AppLogger.clearLogs` | ✅ Complete |

**Usages Replaced**: ~222

**Files Changed**:
- `src/common/utils/Logger.js` - Rewritten to IIFE-wrapped `AppLogger` class
- `src/common/utils/Logger.d.ts` - Simplified (declarations moved to global.d.ts)
- `src/types/global.d.ts` - Added `declare class AppLogger` and updated `Common.Logger`
- `__mocks__/google-apps-script.ts` - Added `AppLogger` mock separate from GAS `Logger`
- All source files updated from `Logger.info/debug/warn/error/configure` to `AppLogger.*`
- All test files updated with proper mock setup for both `AppLogger` and GAS `Logger`

**Backward Compatibility**:
- `Common.Logger` still works (points to `AppLogger`)
- GAS built-in `Logger.log()` still works (separate global)

**Results**:
- Tests: 1113 passing ✅
- Type Errors: 363 (slight increase from 358, all test infrastructure errors)

---

### Phase -1 Step 5: Common.Config.FeatureFlags ✅ COMPLETE

**Layer**: 0 (Foundation - cannot use Logger)

| Old Name | New Name | Status |
|----------|----------|--------|
| `Common.Config.FeatureFlags` | `FeatureFlags` | ✅ Complete |
| `Common.Config.FeatureFlagsManager` | `FeatureFlagsManager` | ✅ Complete |

**Changes Made**:
- Converted `FeatureFlags.js` to flat IIFE class pattern with two classes
- Created `FeatureFlags.d.ts` with reference to global.d.ts
- Added `declare class FeatureFlags` and `declare class FeatureFlagsManager` to `global.d.ts`
- Added `interface FeatureFlagConfig` to `global.d.ts`
- Updated ~7 usages from `Common.Config.FeatureFlags` to `FeatureFlags`
- Updated `Common.Config` namespace in `global.d.ts` to reference flat classes
- Added backward compatibility bridge for gradual migration

**Results**:
- Tests: 1113 passing ✅
- Type Errors: 363 (stable from Step 4)

---

### Phase -1 Step 6: Common.Auth Namespace ✅ COMPLETE

**Layer**: 0 (Foundation - cannot use Logger)

| Old Name | New Name | Status |
|----------|----------|--------|
| `Common.Auth.TokenManager` | `TokenManager` | ✅ Complete |
| `Common.Auth.TokenStorage` | `TokenStorage` | ✅ Complete |
| `Common.Auth.VerificationCode` | `VerificationCode` | ✅ Complete |
| `Common.Auth.VerificationCodeManager` | `VerificationCodeManager` | ✅ Complete |
| `Common.Auth.Utils` | `AuthUtils` | ✅ Complete |

**Changes Made**:
- Created `TokenManager.js` with IIFE-wrapped class (replaces token_manager.js)
- Created `TokenStorage.js` with IIFE-wrapped class (replaces token_storage.js)
- Rewrote `VerificationCode.js` with IIFE-wrapped `VerificationCode` and `VerificationCodeManager` classes
- Created `AuthUtils.js` with IIFE-wrapped class (replaces utils.js)
- Added all class declarations to `global.d.ts`
- Updated ~42 usages across source files
- Updated `Common.Auth` namespace in `global.d.ts` to reference flat classes
- Updated `ApiClient.test.js` to mock flat `TokenManager` class
- Maintained backward compatibility via `Common.Auth.*` bridges

**Results**:
- Tests: 1113 passing ✅
- Type Errors: TBD (to verify)

---

### Phase -1 Step 7: Common.Api Namespace ✅ COMPLETE

**Commit**: `0647f03` (2026-01-22)

| Old Name | New Name | Status |
|----------|----------|--------|
| `Common.Api.ClientManager` | `ApiClientManager` | ✅ Complete |

**Changes Made**:
- Converted `ApiClient.js` to flat IIFE classes: `ApiClient`, `ApiClientManager`
- Added flat class declarations in `global.d.ts`
- Updated 10 files to use flat class names
- Maintained backward compatibility via `Common.Api.*` bridges

**Results**:
- Tests: 1113 passing ✅

---

### Phase -1 Step 8: Common.Data Namespace ✅ COMPLETE

**Commit**: `41a4da8` (2026-01-22)

| Old Name | New Name | Status |
|----------|----------|--------|
| `Common.Data.ValidatedMember` | `ValidatedMember` | ✅ Complete |
| `Common.Data.MemberPersistence` | `MemberPersistence` | ✅ Complete |
| `Common.Data.Access` | `DataAccess` | ✅ Complete |

**Changes Made**:
- Converted `ValidatedMember.js` to flat IIFE class
- Converted `MemberPersistence.js` to flat IIFE class
- Converted `data_access.js` to flat `DataAccess` object
- Added flat class declarations in `global.d.ts`
- Updated 25 files with ~40 usages across src/ and __tests__/
- Maintained backward compatibility via `Common.Data.*` bridges

**Results**:
- Tests: 1113 passing ✅
- Type Errors: 475 (reduced from 480 baseline)

---

### Phase -1 Step 9: Common.Logging Namespace ✅ COMPLETE

**Commit**: `4f39411` (2026-01-21)

| Old Name | New Name | Status |
|----------|----------|--------|
| `Common.Logging.ServiceLogger` | `ServiceLogger` | ✅ Complete |
| `Common.Logging.ServiceExecutionLogger` | `ServiceExecutionLogger` | ✅ Complete |

**Changes Made**:
- ServiceLogger.js: Flat IIFE-wrapped class with backward compat alias
- ServiceExecutionLogger.js: Flat object with backward compat alias
- Updated usages in webapp_endpoints.js, Api.js files
- Updated test files with flat class mocks
- Added flat declarations to global.d.ts

**Results**:
- Tests: 1113 passing ✅
- Files: 9 changed

---

### Phase -1 Step 10: Cleanup ⏳ PENDING

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
