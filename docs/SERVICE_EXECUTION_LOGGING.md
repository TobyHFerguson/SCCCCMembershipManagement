# Service Execution Logging Architecture

## Overview

This document describes the dual-logging architecture for tracking service executions in the SCCCC Membership Management system. Every service execution generates both **business audit logs** (for compliance and user tracking) and **technical system logs** (for debugging and operations).

## Goals

1. **Business Audit Logging**: Answer "Who did what when?" for compliance and audit purposes
2. **Technical System Logging**: Enable debugging of production issues without requiring test harnesses
3. **Consistent Patterns**: All services follow the same logging conventions
4. **Minimal Overhead**: Logging doesn't impact performance or user experience

## Architecture

### Two-Tier Logging System

#### 1. System Logs (Technical Debugging)
- **Storage**: `System Logs` sheet via `Common.Logger`
- **Purpose**: Technical execution flow, errors, debugging information
- **Audience**: Developers, operations staff
- **Levels**: DEBUG, INFO, WARN, ERROR
- **Content**: Method entry/exit, validation steps, data transformations, error details

#### 2. Audit Logs (Business Compliance)
- **Storage**: `Audit` sheet via `Audit.Logger` and `Audit.Persistence`
- **Purpose**: Business-level tracking of user actions and outcomes
- **Audience**: Business stakeholders, compliance officers, auditors
- **Fields**: Timestamp, Type, Outcome (success/fail), Note, Error, JSON data
- **Content**: Service access, profile updates, subscription changes, business operations

### Logging Components

#### `Common.Logging.ServiceLogger`
Pure JavaScript utility that provides unified logging interface:
- `logServiceAccess(operation)` - Logs service access (e.g., getData)
- `logOperation(type, outcome, note, error, jsonData)` - Logs business operations
- `logError(operation, error, additionalData)` - Logs errors with full details
- `createAuditEntry(...)` - Creates audit entries without system logging

**Example**:
```javascript
const logger = new Common.Logging.ServiceLogger('GroupManagementService', 'user@example.com');

// Log service access
const accessEntry = logger.logServiceAccess('getData');
// System Log: INFO: User user@example.com accessed service via getData()
// Audit Entry: GroupManagementService.Access | success | User accessed service

// Log business operation
const opEntry = logger.logOperation(
  'SubscriptionUpdate',
  'success',
  'Updated 3 subscriptions',
  undefined,
  { groupCount: 3 }
);
// System Log: INFO: SubscriptionUpdate: Updated 3 subscriptions
// Audit Entry: GroupManagementService.SubscriptionUpdate | success | Updated 3 subscriptions

// Persist audit entries
const auditFiddler = Common.Data.Storage.SpreadsheetManager.getFiddler('Audit');
Audit.Persistence.persistAuditEntries(auditFiddler, [accessEntry, opEntry]);
```

#### `Common.Logging.ServiceExecutionLogger`
Wrapper utilities for automatic logging (not currently used - direct logging preferred for clarity):
- `wrapGetData(serviceName, email, getDataFn)` - Wraps getData with logging
- `wrapApiHandler(serviceName, operation, email, handlerFn, params)` - Wraps API handlers

## Implementation Patterns

### Pattern 1: Service Access Logging (getData)

Every `Service.Api.getData()` method should log:
1. **Start**: INFO level with user email
2. **Debug points**: DEBUG level for internal operations
3. **Success**: INFO level with summary data
4. **Errors**: ERROR level with full error details

**Note**: Service access audit logging is handled by the `getServiceContent()` wrapper in `webapp_endpoints.js`. Individual `getData()` methods only need system logs.

```javascript
// In Service.Api.getData
Service.Api.getData = function(email) {
  Common.Logger.info('ServiceName', `getData() started for user: ${email}`);
  
  try {
    // Debug-level logging for internal steps
    Common.Logger.debug('ServiceName', 'Fetching data from source');
    const data = fetchData(email);
    
    Common.Logger.info('ServiceName', `getData() completed successfully for user: ${email}`, {
      dataCount: data.length
    });
    
    return {
      serviceName: 'Service Name',
      data: data
    };
  } catch (error) {
    Common.Logger.error('ServiceName', `getData() failed for user: ${email}`, error);
    return {
      serviceName: 'Service Name',
      error: error.message
    };
  }
};
```

### Pattern 2: Business Operation Logging (Updates, Changes)

API handlers that modify data should log:
1. **Start**: INFO with operation name and user
2. **Validation**: WARN for validation failures
3. **Operation**: INFO/DEBUG for execution steps
4. **Audit Entry**: Business-level operation record
5. **Completion**: INFO with operation summary

```javascript
// In Service.Api.handleUpdate
Service.Api.handleUpdate = function(params) {
  const userEmail = params._authenticatedEmail;
  const updates = params.updates;
  
  Common.Logger.info('ServiceName', `handleUpdate() started for user: ${userEmail}`, {
    updateCount: updates.length
  });
  
  try {
    // Validation
    const validation = validateUpdates(updates);
    if (!validation.valid) {
      Common.Logger.warn('ServiceName', `Validation failed for user: ${userEmail}`, {
        error: validation.error
      });
      return Common.Api.ClientManager.errorResponse(validation.error, 'VALIDATION_ERROR');
    }
    
    // Execute update
    Common.Logger.debug('ServiceName', 'Executing update');
    const result = executeUpdate(userEmail, updates);
    
    // Create audit entry
    const logger = new Common.Logging.ServiceLogger('ServiceName', userEmail);
    const auditEntry = logger.logOperation(
      'DataUpdate',
      result.success ? 'success' : 'fail',
      `Updated ${result.count} items`,
      result.error,
      { updateCount: result.count, changes: updates }
    );
    
    // Persist audit entry
    try {
      const auditFiddler = Common.Data.Storage.SpreadsheetManager.getFiddler('Audit');
      Audit.Persistence.persistAuditEntries(auditFiddler, [auditEntry]);
    } catch (auditError) {
      Common.Logger.error('ServiceName', 'Failed to persist audit entry', auditError);
    }
    
    Common.Logger.info('ServiceName', `handleUpdate() completed for user: ${userEmail}`, {
      success: result.success,
      count: result.count
    });
    
    return Common.Api.ClientManager.successResponse(result);
  } catch (error) {
    Common.Logger.error('ServiceName', `handleUpdate() failed for user: ${userEmail}`, error);
    return Common.Api.ClientManager.errorResponse('Update failed', 'UPDATE_ERROR');
  }
};
```

### Pattern 3: Error Logging

All errors should be logged with full context:

```javascript
try {
  // Operation
} catch (error) {
  Common.Logger.error('ServiceName', `Operation failed: ${error.message}`, {
    operation: 'operationName',
    userEmail: userEmail,
    errorStack: error.stack,
    additionalContext: {...}
  });
  
  // For critical errors, also create audit entry
  const logger = new Common.Logging.ServiceLogger('ServiceName', userEmail);
  const errorEntry = logger.logError('operationName', error, { context: '...' });
  
  // Persist if needed
  const auditFiddler = Common.Data.Storage.SpreadsheetManager.getFiddler('Audit');
  Audit.Persistence.persistAuditEntries(auditFiddler, [errorEntry]);
}
```

## Service Access Audit Events

The `getServiceContent()` wrapper in `webapp_endpoints.js` automatically creates audit entries for all service accesses:

| Event Type | Outcome | Note | When |
|------------|---------|------|------|
| `ServiceName.Access` | success | User accessed service via getData() | Service loaded successfully |
| `ServiceName.Error` | fail | Error in getData for user | Service load failed |

## Business Operation Audit Events

Services should create custom audit entries for business operations:

| Service | Event Type | Example |
|---------|------------|---------|
| GroupManagementService | `SubscriptionUpdate` | User updated group subscriptions |
| ProfileManagementService | `ProfileUpdate` | User updated profile fields |
| EmailChangeService | `EmailChange` | User changed email address |
| VotingService | `VoteCast` | User voted in election |

## Audit Entry Schema

All audit entries follow this schema (defined in `Audit.d.ts`):

```typescript
interface LogEntry {
  Timestamp: Date;              // When the event occurred
  Type: string;                 // Event type (e.g., "ProfileUpdate", "ServiceName.Access")
  Outcome: 'success' | 'fail';  // Whether the operation succeeded
  Note: string;                 // Human-readable description
  Error: string;                // Error message if outcome is 'fail'
  JSON: string;                 // JSON-serialized additional data
}
```

## System Log Entry Schema

System logs are written via `Common.Logger` to the `System Logs` sheet:

```
Timestamp | Level | Service | Message | Data
----------|-------|---------|---------|-----
2024-01-15T10:30:00Z | INFO | ProfileManagementService.handleUpdateProfile | handleUpdateProfile() started for user: user@example.com | {"updateCount": 2}
```

## Testing Logging Code

### Unit Tests

When testing code with logging:

```javascript
beforeEach(() => {
  global.Common = {
    Logger: {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    },
    Logging: {
      ServiceLogger: jest.fn().mockImplementation(() => ({
        logOperation: jest.fn().mockReturnValue({
          Timestamp: new Date(),
          Type: 'Test.Operation',
          Outcome: 'success',
          Note: 'Test note',
          Error: '',
          JSON: ''
        })
      }))
    },
    Data: {
      Storage: {
        SpreadsheetManager: {
          getFiddler: jest.fn()
        }
      }
    }
  };
  
  global.Audit = {
    Persistence: {
      persistAuditEntries: jest.fn()
    }
  };
});
```

### Integration Tests

To verify logging in GAS environment:
1. Deploy to dev environment
2. Execute service operations
3. Check System Logs sheet for technical logs
4. Check Audit sheet for business audit entries
5. Verify log entries contain expected user email, operation, and outcome

## Configuration

### Enabling Sheet Logging

By default, system logs only go to console. To enable sheet logging:

1. Set Properties sheet values:
   - `loggerSheetLogging` = `true`
   - `loggerLevel` = `INFO` (or `DEBUG` for verbose logging)

2. Ensure Bootstrap sheet has `SystemLogs` entry:
   ```
   Reference: SystemLogs
   sheetName: System Logs
   createIfMissing: True
   ```

3. Ensure Bootstrap sheet has `Audit` entry:
   ```
   Reference: Audit
   sheetName: Audit
   createIfMissing: True
   ```

### Log Levels

- **DEBUG**: Detailed execution flow (verbose, for debugging only)
- **INFO**: Normal operations (service access, successful operations)
- **WARN**: Validation failures, expected errors
- **ERROR**: Unexpected errors, exceptions

Set level via Properties sheet `loggerLevel` property.

## Best Practices

1. **Log at entry/exit**: Every public method should log start and completion
2. **Include user context**: Always log the user email for audit trail
3. **Structured data**: Use the data parameter for structured logging, not string concatenation
4. **Error details**: Include full error objects, not just messages
5. **Audit important operations**: Any data modification should create an audit entry
6. **Don't log sensitive data**: Never log passwords, tokens, or PII beyond email
7. **Performance**: Logging should be fast - avoid expensive operations in log calls
8. **Test coverage**: Test that logging calls are made, not just business logic

## Migration Checklist for New Services

When adding a new service with logging:

- [ ] Add system logging to `Service.Api.getData()`
  - [ ] INFO at start with user email
  - [ ] DEBUG for internal operations
  - [ ] INFO on success with summary data
  - [ ] ERROR on failure with full error
- [ ] Add comprehensive logging to all API handlers
  - [ ] INFO at start
  - [ ] WARN for validation failures
  - [ ] DEBUG for execution steps
  - [ ] INFO/ERROR on completion
- [ ] Create audit entries for business operations
  - [ ] Use `Common.Logging.ServiceLogger`
  - [ ] Persist via `Audit.Persistence.persistAuditEntries`
- [ ] Update tests to mock logging infrastructure
  - [ ] Mock `Common.Logger.*`
  - [ ] Mock `Common.Logging.ServiceLogger`
  - [ ] Mock `Audit.Persistence.persistAuditEntries`
- [ ] Test in GAS environment
  - [ ] Verify System Logs sheet entries
  - [ ] Verify Audit sheet entries
  - [ ] Verify no performance impact

## Examples

See these services for complete logging implementations:
- `src/services/GroupManagementService/Api.js` - Complex update operations
- `src/services/ProfileManagementService/Api.js` - Profile updates with audit
- `src/services/DirectoryService/Api.js` - Simple read-only service
- `src/webapp_endpoints.js` - Service access wrapper logging

## Troubleshooting

### "Common.Logger is undefined"
- Ensure `Common.Logger.configure()` is called during app initialization
- Check that `src/common/utils/Logger.js` is loaded before service files

### "Audit.Persistence is undefined"
- Ensure `src/common/audit/AuditPersistence.js` is loaded
- Check that Audit sheet exists in Bootstrap configuration

### Logs not appearing in sheets
- Verify `loggerSheetLogging` is `true` in Properties sheet
- Check Bootstrap sheet has correct System Logs / Audit entries
- Verify sheet permissions allow writes
- Check error logs in console for persistence errors

### Performance issues
- Reduce log level to INFO or WARN (disable DEBUG)
- Verify log rotation is working (max 1000 entries in System Logs)
- Check that logging code isn't in tight loops
