# Namespace Declaration Pattern

> **UPDATE (January 2026)**: This project has migrated to **IIFE-wrapped flat classes** per `gas-best-practices.md`. 
> The namespace pattern below is preserved for **backward compatibility only**.
> New code should use flat class names directly (e.g., `ServiceLogger`, not `Common.Logging.ServiceLogger`).

## Preferred Pattern: IIFE-Wrapped Flat Classes

**New code should use this pattern:**

```javascript
// ✅ CORRECT: IIFE-wrapped flat class (preferred)
var ServiceLogger = (function() {
    class ServiceLogger {
        constructor(serviceName, userEmail) {
            this.serviceName = serviceName;
            this.userEmail = userEmail;
        }
        
        logOperation(type, outcome, note) {
            // Implementation...
        }
    }
    
    return ServiceLogger;
})();

// Backward compatibility alias (will be removed in future)
if (typeof Common === 'undefined') var Common = {};
if (typeof Common.Logging === 'undefined') Common.Logging = {};
Common.Logging.ServiceLogger = ServiceLogger;

// Node.js export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ServiceLogger };
}
```

**Benefits:**
- Works in GAS, Node.js, and Jest
- No namespace conflicts
- Direct class name access
- TypeScript-friendly with `.d.ts` files

## Flattened Classes

The following have been migrated to flat class pattern:

| Old Namespace | Flat Class | File |
|---------------|------------|------|
| `Audit.LogEntry` | `AuditLogEntry` | `src/common/audit/AuditLogEntry.js` |
| `Audit.Logger` | `AuditLogger` | `src/common/audit/AuditLogger.js` |
| `Audit.Persistence` | `AuditPersistence` | `src/common/audit/AuditPersistence.js` |
| `Common.Data.ValidatedMember` | `ValidatedMember` | `src/common/data/ValidatedMember.js` |
| `Common.Data.MemberPersistence` | `MemberPersistence` | `src/common/data/MemberPersistence.js` |
| `Common.Data.Access` | `DataAccess` | `src/common/data/data_access.js` |
| `Common.Data.Storage.SpreadsheetManager` | `SpreadsheetManager` | `src/common/data/storage/SpreadsheetManager.js` |
| `Common.Logging.ServiceLogger` | `ServiceLogger` | `src/common/logging/ServiceLogger.js` |
| `Common.Logging.ServiceExecutionLogger` | `ServiceExecutionLogger` | `src/common/logging/ServiceExecutionLogger.js` |
| `Common.Config.FeatureFlags` | `FeatureFlags` | `src/common/config/FeatureFlags.js` |
| `Common.Auth.VerificationCode` | `VerificationCodeManager` | `src/common/auth/VerificationCode.js` |

---

## Legacy Pattern (Backward Compatibility)

The pattern below is preserved for files that haven't been migrated yet.

### Problem

This project uses a hybrid JavaScript environment:
- **Google Apps Script (GAS)**: All files concatenated into single script, `1namespaces.js` loads first
- **Node.js/Jest**: Each file loaded independently via `require()`

This creates a critical naming conflict when namespaces are declared:

```javascript
// 1namespaces.js (loads first in GAS)
const Audit = {};

// AuditPersistence.js (loads later in GAS, independently in Jest)
var Audit = Audit || {};  // ❌ CAUSES ERROR IN GAS!
```

**GAS Error**: `SyntaxError: Identifier 'Audit' has already been declared`

### Solution Pattern

All files that extend namespaces MUST use this defensive pattern:

```javascript
// ✅ CORRECT: Works in both GAS and Jest
if (typeof NamespaceName === 'undefined') NamespaceName = {};
NamespaceName.SubNamespace = NamespaceName.SubNamespace || {};
```

### How It Works

**In GAS**:
1. `1namespaces.js` runs first: `const Audit = {};`
2. `AuditPersistence.js` runs: `typeof Audit === 'undefined'` is `false`
3. Skip the assignment, just extend: `Audit.Persistence = ...`
4. ✅ No redeclaration error, no var hoisting conflict

**In Jest/Node**:
1. `AuditPersistence.js` loaded via `require()`
2. `typeof Audit === 'undefined'` is `true`
3. Create namespace via direct assignment: `Audit = {};`
4. Extend it: `Audit.Persistence = ...`
5. ✅ Namespace exists for testing, assigned to global scope

## NEVER Do This

```javascript
// ❌ WRONG - Conflicts with const in 1namespaces.js
var Audit = Audit || {};

// ❌ WRONG - Can't redeclare const
const Audit = Audit || {};

// ❌ WRONG - Only works in GAS, fails in Jest
Audit.Persistence = Audit.Persistence || {};  // ReferenceError in Jest
```

## Related Documentation

- `gas-best-practices.md` - IIFE class pattern (preferred)
- `src/1namespaces.js` - Namespace declarations with migration notes
- `docs/issues/ISSUE-346-NAMESPACE-FLATTENING.md` - Migration tracking
