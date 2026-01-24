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

## Namespace Classification

### Removed (Backward Compatibility Only)

These were removed in Issue #346 and are no longer used:
- **`Common.*`** - Fully migrated to flat classes (ApiResponse, TokenManager, FeatureFlags, etc.)
- **`Audit.*`** - Migrated to AuditLogEntry, AuditLogger, AuditPersistence

**Exception**: Three `Common.*` namespaces remain ACTIVE (not backward compat):
- **`Common.Logger`** - Bridge to AppLogger (11 method aliases in Logger.js, but 0 actual usages in codebase - all code uses AppLogger directly)
- **`Common.Utils`** - Active utilities (wrapMenuFunction, extractSpreadsheetId) - 5 usages in Menu.js
- **`Common.HomePage.Manager`** - Active home page manager class - 1 usage in webapp_endpoints.js

### Active (Organizational Structure)

These are **ACTIVE namespaces** for service organization (NOT backward compatibility):

#### MembershipManagement Service Namespaces
- **`MembershipManagement.Internal`** - Private GAS adapter functions (52 usages)
  - Examples: getGroupAdder_(), getEmailSender_(), persistAuditEntries_()
  - Purpose: Encapsulate GAS-dependent initialization and persistence
  
- **`MembershipManagement.Utils`** - Shared utilities (54 usages)
  - Examples: addDaysToDate(), calculateExpirationDate(), expandTemplate(), convertFIFOItemsToSpreadsheet()
  - Purpose: Date math, FIFO queue conversion, template expansion
  
- **`MembershipManagement.Manager`** - Pure logic class (testable, ~800 lines)

#### Other Service Namespaces
- **`VotingService.*`** - Service-specific types and constants
- **`GroupManagementService.*`** - Service-specific types  
- **`ProfileManagementService.*`** - Service-specific types
- **`DirectoryService.*`** - Service-specific types
- **`EmailChangeService.*`** - Service-specific types

**Pattern**: Each service follows `Service.Internal`, `Service.Manager`, `Service.Api`, `Service.Trigger` structure.

---

## When to Use Namespace vs Flat Class

### Use Flat Class (IIFE-wrapped)

**For shared utilities across services:**
- Global types: `ApiResponse`, `AuditLogEntry`, `ValidatedMember`
- Infrastructure classes: `SpreadsheetManager`, `TokenManager`, `VerificationCodeManager`
- Cross-service utilities: `AppLogger`, `FeatureFlags`, `ServiceLogger`

**Pattern**:
```javascript
var TokenManager = (function() {
    class TokenManager {
        static generateToken(email, serviceName) {
            // Pure logic, testable
        }
        
        static validateToken(token) {
            // Pure logic, testable
        }
    }
    return TokenManager;
})();
```

**Benefits**:
- Direct class name access
- TypeScript-friendly with `.d.ts` files
- 100% testable in Jest
- No namespace pollution

---

### Use Namespace (Object literal)

**For service-specific organization:**
- Service internal adapters: `Service.Internal`
- Service utilities: `Service.Utils` (when service-specific)
- Service types: `Service.Manager`, `Service.Api`
- Multiple related functions that belong together logically

**Pattern**:
```javascript
// In 1namespaces.js
const MembershipManagement = {
    Internal: {},
    Utils: {},
    Manager: null  // Will be assigned in Manager.js
};

// In service file
MembershipManagement.Utils.addDaysToDate = function(date, days) {
    const result = MembershipManagement.Utils.dateOnly(date);
    result.setDate(result.getDate() + days);
    return result;
};

MembershipManagement.Utils.calculateExpirationDate = function(referenceDate, expires, period) {
    // Service-specific business logic
};
```

**Benefits**:
- Organizes related service functions
- Clear service boundaries
- Encapsulates service-specific logic
- Reduces global namespace clutter

---

## Decision Tree: Namespace vs Flat Class

```
Is this utility/class used by MULTIPLE services?
├─ YES → Use Flat Class (e.g., TokenManager, ApiResponse)
│         Shared across services = global utility
│
└─ NO → Is it service-specific?
        ├─ YES → Use Namespace (e.g., MembershipManagement.Utils)
        │         Service-specific = organizational namespace
        │
        └─ NO → Consider if it should be shared
                Maybe it belongs in a flat class after all
```

---

## Examples: Good vs Bad

### ✅ GOOD: Flat Class for Global Utility

```javascript
// TokenManager is used by authentication across ALL services
var TokenManager = (function() {
    class TokenManager {
        static generateToken(email, serviceName) {
            const timestamp = Date.now();
            const randomBytes = Utilities.getUuid();
            return `${email}:${serviceName}:${timestamp}:${randomBytes}`;
        }
    }
    return TokenManager;
})();

// Used everywhere:
// - GroupManagementService
// - ProfileManagementService
// - VotingService
// - etc.
```

### ✅ GOOD: Namespace for Service Organization

```javascript
// MembershipManagement.Utils contains ONLY membership-specific utilities
MembershipManagement.Utils.calculateExpirationDate = function(referenceDate, expires, period) {
    // Business logic specific to membership expiration rules
    // Only used within MembershipManagement service
};

MembershipManagement.Utils.convertFIFOItemsToSpreadsheet = function(items) {
    // FIFO queue format specific to MembershipManagement
    // Only used within MembershipManagement service
};
```

### ❌ BAD: Global Utility in Nested Namespace

```javascript
// ❌ WRONG - DateHelper is useful across ALL services, should be flat class
Common.Utils.DateHelper = {
    addDays: function(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    }
};

// ✅ CORRECT - Flat class for global utility
var DateHelper = (function() {
    class DateHelper {
        static addDays(date, days) {
            const result = new Date(date);
            result.setDate(result.getDate() + days);
            return result;
        }
    }
    return DateHelper;
})();
```

### ❌ BAD: Service-Specific Function in Global Namespace

```javascript
// ❌ WRONG - This is ONLY used by MembershipManagement
var calculateMembershipExpiration = function(referenceDate, expires, period) {
    // Service-specific logic
};

// ✅ CORRECT - Use service namespace
MembershipManagement.Utils.calculateExpirationDate = function(referenceDate, expires, period) {
    // Service-specific logic, properly scoped
};
```

---

## Migration Notes

### Issue #346: Namespace Flattening (Completed)

**Migrated from nested namespaces to flat classes:**
- `Common.Auth.TokenManager` → `TokenManager`
- `Common.Auth.VerificationCode` → `VerificationCodeManager`
- `Common.Logging.ServiceLogger` → `ServiceLogger`
- `Common.Data.ValidatedMember` → `ValidatedMember`
- `Audit.LogEntry` → `AuditLogEntry`
- `Audit.Logger` → `AuditLogger`
- `Audit.Persistence` → `AuditPersistence`

**Preserved active service namespaces:**
- `MembershipManagement.Internal` (52 usages) ✅ KEEP
- `MembershipManagement.Utils` (54 usages) ✅ KEEP
- Service-specific namespaces (VotingService.*, etc.) ✅ KEEP

### Remaining Common.* Namespaces (Active, Not Backward Compat)

Three `Common.*` namespaces remain because they're actively used:

1. **`Common.Logger`** (Logger.js) - Bridge to AppLogger
   - 11 method aliases defined
   - 0 actual usages found in codebase (all code uses AppLogger directly)
   - **Status**: Could be removed in future if confirmed unused

2. **`Common.Utils`** (Utils.js) - Active utilities
   - 5 usages in Menu.js (wrapMenuFunction)
   - Methods: wrapMenuFunction(), extractSpreadsheetId()
   - **Status**: KEEP - actively used

3. **`Common.HomePage.Manager`** (HomePageManager.js) - Active manager
   - 1 usage in webapp_endpoints.js (getAvailableServices)
   - **Status**: KEEP - actively used

---

## Related Documentation

- `gas-best-practices.md` - IIFE class pattern (preferred)
- `src/1namespaces.js` - Namespace declarations with migration notes
- `docs/archive/ISSUE-346-NAMESPACE-FLATTENING.md` - Migration tracking (completed work)
- Issue #362 - Namespace cleanup verification and documentation
