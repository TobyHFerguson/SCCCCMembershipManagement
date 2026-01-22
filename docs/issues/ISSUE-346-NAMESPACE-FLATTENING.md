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

### Phase -1 Step 2: Common.Logger Namespace ⏳ PENDING

| Old Name | New Name | Status |
|----------|----------|--------|
| `Common.Logger.info` | `Logger.info` | ⏳ Pending |
| `Common.Logger.error` | `Logger.error` | ⏳ Pending |
| `Common.Logger.warn` | `Logger.warn` | ⏳ Pending |
| `Common.Logger.debug` | `Logger.debug` | ⏳ Pending |
| `Common.Logger.configure` | `Logger.configure` | ⏳ Pending |

**Estimated Usages**: ~230

---

### Phase -1 Step 3: Common.Config Namespace ⏳ PENDING

| Old Name | New Name | Status |
|----------|----------|--------|
| `Common.Config.Properties` | `Properties` | ⏳ Pending |
| `Common.Config.FeatureFlags` | `FeatureFlags` | ⏳ Pending |

---

### Phase -1 Step 4: Common.Auth Namespace ⏳ PENDING

| Old Name | New Name | Status |
|----------|----------|--------|
| `Common.Auth.TokenManager` | `TokenManager` | ⏳ Pending |
| `Common.Auth.VerificationCode` | `VerificationCode` | ⏳ Pending |
| `Common.Auth.Utils` | `AuthUtils` | ⏳ Pending |

---

### Phase -1 Step 5: Common.Api Namespace ⏳ PENDING

| Old Name | New Name | Status |
|----------|----------|--------|
| `Common.Api.ClientManager` | `ApiClientManager` | ⏳ Pending |

---

### Phase -1 Step 6: Common.Data Namespace ⏳ PENDING

| Old Name | New Name | Status |
|----------|----------|--------|
| `Common.Data.ValidatedMember` | `ValidatedMember` | ⏳ Pending |
| `Common.Data.MemberPersistence` | `MemberPersistence` | ⏳ Pending |
| `Common.Data.Access` | `DataAccess` | ⏳ Pending |
| `Common.Data.Storage.SpreadsheetManager` | `SpreadsheetManager` | ⏳ Pending |

---

### Phase -1 Step 7: Common.Logging Namespace ⏳ PENDING

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
