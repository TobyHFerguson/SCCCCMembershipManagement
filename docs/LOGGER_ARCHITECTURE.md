# Logger Architecture and Initialization

## Layered Architecture

To prevent circular dependencies, the codebase follows a strict layering:

### Layer 0: Foundation (NO Common.Logger allowed)
- `SpreadsheetManager.js` - Low-level sheet access via bmPreFiddler
- `Properties.js` - Property management (reads from Properties sheet)

**Rules:**
- MUST use `Logger.log()` only (GAS built-in)
- MUST NOT use `Common.Logger.*`
- Reason: Common.Logger depends on Properties, creating circular dependency

### Layer 1: Infrastructure (Common.Logger safe)
- `Logger.js` - Structured logging with namespace filtering
- `Data.Access.js` - High-level data access helpers

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
| `loggerSheetLogging` | boolean | `false` | Log to Logs sheet |
| `loggerScriptProperties` | boolean | `false` | Log to Script Properties |
| `loggerEmailErrors` | boolean | `false` | Email ERROR level logs |
| `loggerEmailRecipient` | string | | Email address for error notifications |
| `loggerNamespaces` | string | `*` | Namespaces to log (comma-separated or `*` for all) |

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

### Build-Time Detection

Run `npm test` to check for circular dependencies:

```bash
npm test circular-dependency.test.js
```

This validates that:
- Properties.js contains no `Common.Logger.*(` calls
- SpreadsheetManager.js contains no `Common.Logger.*(` calls
- Logger.js uses static configuration

## Migration from Old Logger

The old Logger called `Common.Config.Properties` on every log statement, creating circular dependencies. The new Logger:

1. **Loads once** - Configuration loaded when `Common.Logger.configure()` called
2. **Safe defaults** - Works even before configure() with hardcoded defaults
3. **Explicit refresh** - Call configure() again to reload from Properties sheet
4. **Namespace filtering** - Filter logs by service name

### Before (Dangerous)
```javascript
function log(level, service, message) {
  // Called on EVERY log statement - creates circular dependency!
  const config = getLoggerConfig();  // Reads from Properties
  const currentLevel = getCurrentLogLevel();  // Reads from Properties
}
```

### After (Safe)
```javascript
let CONFIG = { /* safe defaults */ };
let currentLogLevel = LOG_LEVELS.INFO;

function loadConfiguration() {
  // Called ONCE after Properties is ready
  CONFIG.CONSOLE_LOGGING = Common.Config.Properties.getBooleanProperty('loggerConsoleLogging', true);
  // ...
}

function log(level, service, message) {
  // Uses static CONFIG - no dependency on Properties
  if (CONFIG.CONSOLE_LOGGING) {
    console.log(message);
  }
}
```

## Troubleshooting

### "CIRCULAR DEPENDENCY DETECTED" Error

**Cause:** Common.Logger is being used in Properties.js or SpreadsheetManager.js

**Fix:** Replace `Common.Logger.*()` calls with `Logger.log()` in those files

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
