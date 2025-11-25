# Namespace Declaration Pattern

## Problem

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

The `const` declaration in `1namespaces.js` makes `Audit` immutable, so the `var` redeclaration fails.

## Solution Pattern

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

## Examples

### Example 1: AuditPersistence.js

```javascript
// Extend Audit namespace (declared in 1namespaces.js in GAS)
if (typeof Audit === 'undefined') Audit = {};
Audit.Persistence = Audit.Persistence || {};

Audit.Persistence.persistAuditEntries = function(auditFiddler, auditEntries) {
  // Implementation...
};
```

### Example 2: Any Service Utility File

```javascript
// Extend MembershipManagement namespace
if (typeof MembershipManagement === 'undefined') MembershipManagement = {};
MembershipManagement.Utils = MembershipManagement.Utils || {};

MembershipManagement.Utils.someHelper = function() {
  // Implementation...
};
```

### Example 3: Common Utilities

```javascript
// Extend Common namespace
if (typeof Common === 'undefined') Common = {};
if (typeof Common.Data === 'undefined') Common.Data = {};
Common.Data.Access = Common.Data.Access || {};

Common.Data.Access.someFunction = function() {
  // Implementation...
};
```

## When to Use This Pattern

Apply this pattern in ANY file that:
1. Is NOT `1namespaces.js`
2. Extends a namespace declared in `1namespaces.js`
3. May be loaded independently in Jest tests

## Files That Declare Namespaces

Only `src/1namespaces.js` declares root namespaces with `const`:

```javascript
const Common = { /* ... */ };
const Audit = {};
const MembershipManagement = { Internal: {}, Utils: {} };
const VotingService = { Internal: {}, Constants: {} };
const DirectoryService = { /* ... */ };
const GroupManagementService = { /* ... */ };
const EmailChangeService = { /* ... */ };
const EmailService = { Menu: {} };
const DocsService = { Internal: {} };
const GroupSubscription = {};
```

ALL other files must use the defensive `typeof` pattern.

## Testing the Pattern

When creating new namespace extension files:

1. **Test in Jest**: File should load independently via `require()`
2. **Test in GAS**: Deploy and verify no "already declared" errors
3. **Check with grep**: Search for problematic patterns

```bash
# Find potentially problematic declarations
grep -r "^var \(Audit\|Common\|MembershipManagement\|VotingService\)" src/

# Should only find the defensive typeof pattern, never naked var declarations
```

## Why Direct Assignment Without `var`/`const`/`let`?

Use direct assignment (`if (typeof X === 'undefined') X = {};`) because:
- **No `var`**: `var` declarations are hoisted to the top of the scope during parsing, causing "already declared" errors in GAS even when inside an `if` block
- **No `const`/`let`**: Block-scoped declarations would create a variable local to the `if` block, not accessible outside
- **Direct assignment**: Creates a global variable in both GAS and Node/Jest without declaration conflicts
- This matches the pattern used in `Properties.js` and `Utils.js` which work correctly in both environments

## Related Documentation

- `docs/LOGGER_ARCHITECTURE.md` - Explains circular dependency prevention (related namespace issue)
- `src/1namespaces.js` - Single source of truth for namespace declarations
- `.github/copilot-instructions.md` - Project architecture overview
