# Logger Architecture and Initialization

## Layered Architecture

To prevent circular dependencies, the codebase follows a strict layering:

### Layer 0: Foundation (NO Common.Logger allowed)
- `SpreadsheetManager.js` - Low-level sheet access via bmPreFiddler
- `Properties.js` - Property management (reads from Properties sheet)
- `Logger.js` - Structured logging with namespace filtering (foundational module)

**Rules:**
- MUST use `Logger.log()` only (GAS built-in)
- MUST NOT use `Common.Logger.*`
- Reason: Common.Logger depends on Properties, creating circular dependency

**Note:** Logger.js is a foundational file that loads early and uses SpreadsheetManager, but its internal functions must avoid Common.Logger to prevent circular dependencies. Uses `console.log()` for cloud-compatible logging.

### Layer 1: Infrastructure (Common.Logger safe)
- `Data.Access.js` - High-level data access helpers
- Other utility modules

**Rules:**
- Can use `Common.Logger.*` methods
- Must call `Common.Logger.configure()` after Layer 0 is ready

### Layer 2: Application Services
- `MembershipManagement` namespace
- `VotingService` namespace
- etc.

**Rules:**
- Use `Common.Logger.*` for all logging
- Namespace parameter enables filtering

## Initialization Sequence

### Correct Order

```javascript
// 1. Foundation modules load with safe defaults (automatic)
// SpreadsheetManager and Properties ready with Logger.log() only

// 2. Configure Common.Logger (in onOpen, menu handler, or main entry point)
function onOpen() {
  Common.Logger.configure();  // Loads config from Properties sheet
  // Now Common.Logger is ready with full configuration
  
  // 3. Application code can now use Common.Logger
  Common.Logger.info('App', 'Application initialized');
}
```

### Configuration Properties

Set these in the Properties sheet (Reference='Properties' in Bootstrap):

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `loggerLevel` | string | `INFO` | Log level: DEBUG, INFO, WARN, ERROR |
| `loggerConsoleLogging` | boolean | `true` | Log to console (script editor) |
| `loggerSheetLogging` | boolean | `false` | Log to SystemLogs sheet |
| `loggerScriptProperties` | boolean | `false` | Log to Script Properties |
| `loggerEmailErrors` | boolean | `false` | Email ERROR level logs |
| `loggerEmailRecipient` | string | | Email address for error notifications |
| `loggerNamespaces` | string | `*` | Namespaces to log (comma-separated or `*` for all) |

### Bootstrap Configuration for SystemLogs

The SystemLogs sheet is managed through the Bootstrap process. Add this entry to the Bootstrap sheet:

| Reference | iD | sheetName | createIfMissing |
|-----------|---|-----------|-----------------|
| SystemLogs |  | System Logs | True |

**Benefits:**
- Sheet name is configurable (can be renamed without code changes)
- Consistent with other sheet management
- Fiddler-based access provides per-execution caching
- Supports formula data if needed in the future

**Fallback Behavior:**
If SystemLogs is not configured in Bootstrap or SpreadsheetManager is not available, Logger falls back to legacy direct sheet access to ensure logging always works.

### Namespace Filtering Examples

```javascript
// In Properties sheet:
loggerNamespaces = "*"  // Log everything (default)
loggerNamespaces = "MembershipManagement,VotingService"  // Log only these services
loggerNamespaces = "MembershipManagement"  // Log only MembershipManagement

// In code:
Common.Logger.info('MembershipManagement', 'Processing member');  // Logged if namespace enabled
Common.Logger.info('EmailService', 'Sending email');  // Filtered out if not in namespace list
```

## Guard Against Circular Dependencies

### Runtime Detection

The `Properties._loadPropertiesSheet()` function has a guard flag:

```javascript
let _isLoadingProperties = false;

function _loadPropertiesSheet() {
  if (_isLoadingProperties) {
    throw new Error('CIRCULAR DEPENDENCY DETECTED: _loadPropertiesSheet called recursively!');
  }
  _isLoadingProperties = true;
  try {
    // Load properties...
  } finally {
    _isLoadingProperties = false;
  }
}
```

If Common.Logger is accidentally used in Properties or SpreadsheetManager, this will throw immediately instead of infinite looping.

**Note:** Logger.js is also a foundational file. Its internal functions (like `getLogFiddler()`, `logToSheet()`) must use `Logger.log()` for error reporting, not `Common.Logger.*`, to avoid circular dependencies.

### Build-Time Detection

Run `npm test` to check for circular dependencies:

```bash
npm test circular-dependency.test.js
```

This validates that:
- Properties.js contains no `Common.Logger.*(` calls
- SpreadsheetManager.js contains no `Common.Logger.*(` calls
- Logger.js internal functions contain no `Common.Logger.*(` calls
- Logger.js uses SpreadsheetManager.getFiddler('SystemLogs')
- Logger.js has fallback when SpreadsheetManager is not available
- Logger.js is documented as a foundational file

## Migration from Old Logger

The old Logger had several issues that have been fixed:

1. **Circular Dependencies** - Old logger called `Common.Config.Properties` on every log statement
   - **Fixed**: Configuration loaded once via `Common.Logger.configure()`, cached for execution
2. **Custom Logging Wrappers** - Services had custom log functions (e.g., `MembershipManagement.Utils.log`)
   - **Fixed**: All services use `Common.Logger.*` directly with explicit service names
3. **Fragile Caller Detection** - Stack parsing to auto-detect function names was unreliable
   - **Fixed**: Removed auto-detection, use explicit service parameter only
4. **Mixed Logging Mechanisms** - `Logger.log()`, `console.*`, custom wrappers all used
   - **Fixed**: Layer 0 uses `console.log()`, Layer 1+ uses `Common.Logger.*`

### Before (Problematic)
```javascript
// Service code with custom wrapper
MembershipManagement.Utils.log('Processing member');  // ❌ Creates namespace confusion

// Logger with dynamic property lookups
function log(level, service, message) {
  const config = getLoggerConfig();  // ❌ Reads Properties on EVERY call
  const callerName = getCallerFunctionName();  // ❌ Fragile stack parsing
  service = `${service}.${callerName}`;  // ❌ Inconsistent namespaces
}

// Layer 0 with circular dependency risk
Logger.log('[Properties] Loading...');  // ❌ Should use console.log()
```

### After (Clean)
```javascript
// Service code with explicit service name
Common.Logger.info('MembershipManagement', 'Processing member');  // ✅ Clear, explicit

// Logger with static configuration
let CONFIG = { /* safe defaults */ };
let currentLogLevel = LOG_LEVELS.INFO;

function loadConfiguration() {
  // ✅ Called ONCE after Properties is ready
  CONFIG.CONSOLE_LOGGING = Common.Config.Properties.getBooleanProperty('loggerConsoleLogging', true);
}

function log(level, service, message, data) {
  // ✅ Uses static CONFIG - no dynamic dependencies
  // ✅ Uses explicit service parameter - no fragile detection
  if (CONFIG.CONSOLE_LOGGING) {
    console.log(formatMessage(level, service, message, data));
  }
}

// Layer 0 with cloud-compatible logging
console.log('[Properties] Loading...');  // ✅ No circular dependencies
```

## Troubleshooting

### "CIRCULAR DEPENDENCY DETECTED" Error

**Cause:** Common.Logger is being used in Properties.js or SpreadsheetManager.js

**Fix:** Replace `Common.Logger.*()` calls with `console.log()` in those files

### Logs Not Appearing

**Cause:** `Common.Logger.configure()` not called, using default configuration

**Fix:** Call `Common.Logger.configure()` in your initialization code

### Namespace Filtering Not Working

**Cause:** `loggerNamespaces` property not set or configure() not called

**Fix:**
1. Add `loggerNamespaces` to Properties sheet
2. Call `Common.Logger.configure()` after Properties is ready
3. Verify namespace parameter in log calls matches filter

### Properties Sheet Typo ("Propertes")

**Error:** `Sheet name Properties not found in Bootstrap. Available: ..., Propertes`

**Fix:** Edit Bootstrap sheet, change "Propertes" to "Properties" (add the "i")

## Recent Changes (Issue #320)

### Logging Refactor - December 2025

**Problem Statement:**
- Multiple inconsistent logging mechanisms (custom wrappers, console.*, Logger.log)
- Misidentified calling functions in logs
- Objects logged as `[object Object]` instead of JSON
- Circular dependency risks

**Changes Made:**

1. **Removed Custom Logging Wrappers**
   - Eliminated `MembershipManagement.Utils.log()` and similar custom functions
   - All services now use `Common.Logger.*` directly

2. **Standardized Layer 0 to console.log()**
   - Replaced all `Logger.log()` with `console.log()` in Layer 0 files
   - Ensures cloud-compatible logging in GAS runtime
   - Prevents circular dependencies

3. **Simplified Caller Detection**
   - Removed fragile `getCallerFunctionName()` stack parsing
   - Use explicit service names only (e.g., `'MembershipManagement'`)
   - Eliminates namespace confusion like `MembershipManagement.MembershipManagement.Utils.log`

4. **Consistent JSON Serialization**
   - All structured data passed via `data` parameter
   - Logger handles JSON.stringify() internally
   - Objects no longer appear as `[object Object]`

**Migration Guide for Services:**

```javascript
// ❌ OLD: Custom logging wrapper
MembershipManagement.Utils.log('Processing', member);

// ✅ NEW: Direct Common.Logger with structured data
Common.Logger.info('MembershipManagement', 'Processing member', { email: member.Email });

// ❌ OLD: console.error with string concatenation
console.error(`Error: ${error.message}\nStack: ${error.stack}`);

// ✅ NEW: Common.Logger with structured error data
Common.Logger.error('MembershipManagement', 'Operation failed', { 
  message: error.message, 
  stack: error.stack 
});

// ❌ OLD: Layer 0 using Logger.log()
Logger.log('[Properties] Loading configuration');

// ✅ NEW: Layer 0 using console.log()
console.log('[Properties] Loading configuration');
```

**Benefits:**
- ✅ Consistent logging format across all services
- ✅ Proper JSON serialization of objects
- ✅ Clear, explicit service names
- ✅ No circular dependencies
- ✅ Cloud-compatible Layer 0 logging
- ✅ 100% test coverage maintained
