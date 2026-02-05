# SCCCC Membership System - Operator's Manual

**For:** System Administrators and Technical Operators  
**Version:** 1.3.0  
**Last Updated:** December 14, 2025

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Spreadsheet Reference](#spreadsheet-reference)
3. [Bootstrap Configuration](#bootstrap-configuration)
4. [Properties Sheet Configuration](#properties-sheet-configuration)
5. [Script Properties](#script-properties)
6. [Triggers and Automation](#triggers-and-automation)
7. [Logging Architecture](#logging-architecture)
8. [FIFO Processing System](#fifo-processing-system)
9. [Support Strategies](#support-strategies)
10. [Advanced Troubleshooting](#advanced-troubleshooting)

---

## System Architecture

### Layered Design

```
┌─────────────────────────────────────────┐
│     Triggers (Time/Form/Edit)           │
├─────────────────────────────────────────┤
│     Service Layer (GAS Wrappers)        │
│  - MembershipManagement                 │
│  - VotingService                        │
│  - DirectoryService, etc.               │
├─────────────────────────────────────────┤
│     Business Logic Layer (Manager)      │
│  - Pure JS functions (Jest testable)    │
│  - No GAS dependencies                  │
├─────────────────────────────────────────┤
│     Data Access Layer                   │
│  - SpreadsheetManager (SheetAccess)      │
│  - Properties, Logger                   │
├─────────────────────────────────────────┤
│     Google Sheets (Data Storage)        │
└─────────────────────────────────────────┘
```

### Key Principles

1. **Generator/Consumer Separation**
   - **Generator**: Pure functions return data (no side effects)
   - **Consumer**: GAS wrappers apply side effects (email, groups, sheets)
   - Example: `Manager.generateExpiringMembersList()` → `processExpirationFIFO()`

2. **Dependency Injection**
   - Manager class accepts `sendEmailFun`, `groupRemoveFun` as parameters
   - GAS layer injects `MailApp.sendEmail`, `AdminDirectory.Members.remove`
   - Enables testing with mocks

3. **Error Handling Strategy**
   - Manager returns errors as data: `{ success, errors, auditEntries }`
   - GAS layer logs errors, never throws
   - Failed items moved to FIFO queue for retry or dead letter

4. **Audit Trail**
   - Every business event generates exactly one `Audit.LogEntry`
   - Captured in `auditEntries` return value
   - GAS layer persists to Audit sheet

---

## Spreadsheet Reference

### Core Data Sheets

#### ActiveMembers (Members sheet)
**Purpose:** Authoritative member database

**Schema:**
```typescript
interface Member {
  Email: string;              // Unique per active membership
  Status: 'Active' | 'Expired' | 'Migrated';
  First: string;
  Last: string;
  Phone: string;              // Format: (XXX) XXX-XXXX
  Joined: Date;               // Start of current membership period
  Expires: Date;              // End date
  Period: number;             // 1 = first year, 2 = second year, etc.
  'Renewed On': Date | '';    // Last renewal date
  'Directory Share Name': boolean;
  'Directory Share Email': boolean;
  'Directory Share Phone': boolean;
  Migrated: Date | '';        // If imported from old system
}
```

**Invariants:**
- No duplicate emails with Status='Active'
- Expires > Joined
- Period >= 1

**SheetAccess:**
```javascript
const members = SheetAccess.getData('ActiveMembers');
```

---

#### Transactions
**Purpose:** Payment form responses

**Schema:**
```typescript
interface Transaction {
  Timestamp: Date;              // Form submission time
  'Email Address': string;
  'First Name': string;
  'Last Name': string;
  Phone: string;
  Payment: string;              // "1 year - $50.00"
  Directory: string;            // "Share Name, Share Email"
  Status: 'Pending' | 'Paid';
  'Transaction ID': string;
  Processed: Date | '';         // When processPaidTransactions ran
}
```

**Processing Flow:**
1. Form submission → Status='Pending'
2. Payment gateway → Status='Paid'
3. Trigger → `processTransactions()` → Processed=today

**SheetAccess:**
```javascript
SheetAccess.convertLinks('Transactions');
const txns = SheetAccess.getDataWithRichText('Transactions');
```

---

#### ExpirySchedule
**Purpose:** Calendar of future expiration notices

**Schema:**
```typescript
interface ExpirySchedule {
  Date: Date;                   // When to process
  Type: 'Expiry1' | 'Expiry2' | 'Expiry3' | 'Expiry4';
  Email: string;
}
```

**Lifecycle:**
1. Created when member joins/renews (4 entries per member)
2. Consumed by `generateExpiringMembersList()` when Date <= today
3. Entries removed as processed
4. Updated when member renews (old entries deleted, new entries created)

**SheetAccess:**
```javascript
const schedule = SheetAccess.getData('ExpirySchedule');
```

---

#### ExpirationFIFO (Expiration Queue)
**Purpose:** FIFO queue for expiration processing with retry logic

**Schema:**
```typescript
interface FIFOItem {
  id: string;                   // UUID (timestamp-random)
  createdAt: Date;              // Queue entry time
  status: 'pending' | 'processing' | 'dead';
  memberEmail: string;
  memberName: string;
  expiryDate: string;           // YYYY-MM-DD
  actionType: 'notify-only' | 'notify+remove';
  groups: string;               // Comma-separated
  emailTo: string;
  emailSubject: string;
  emailBody: string;            // HTML
  attempts: number;             // 0-5
  lastAttemptAt: Date | '';
  lastError: string;
  nextAttemptAt: Date | '';     // Exponential backoff
  maxAttempts: number;          // Per-row override
  note: string;                 // Operator notes
}
```

**Processing Contract:**
- Generator creates items with `attempts=0`, `status='pending'`
- Consumer processes up to `batchSize` items per run
- Failed items: increment `attempts`, set `nextAttemptAt` (exponential backoff)
- After `maxAttempts` failures: set `status='dead'`, move to ExpirationDeadLetter

**Exponential Backoff Schedule:**
- Attempt 1 → wait 5 minutes
- Attempt 2 → wait 15 minutes
- Attempt 3 → wait 45 minutes
- Attempt 4 → wait 2 hours
- Attempt 5 → wait 6 hours
- After attempt 5 → move to Dead Letter

**SheetAccess:**
```javascript
const queue = SheetAccess.getData('ExpirationFIFO');
```

---

#### ExpirationDeadLetter
**Purpose:** Failed expiration actions for manual review

**Schema:** Same as ExpirationFIFO (all items have `status='dead'`)

**Purpose:**
- Audit trail of persistent failures
- Operator review queue
- Never auto-deleted (permanent record)

**Common Failure Types:**

| Error Pattern | Root Cause | Resolution |
|---------------|------------|------------|
| "Email bounce" | Invalid email address | Update email in Members sheet |
| "Group not found" | Google Group deleted/renamed | Recreate group or update ActionSpecs |
| "Permission denied" | Automation account not manager | Add membership-automation@ as group manager |
| "Resource Not Found" | Member already removed | No action needed (expected) |
| "Network timeout" | Transient GAS issue | Manually retry or wait for resolution |

**SheetAccess:**
```javascript
const deadItems = SheetAccess.getData('ExpirationDeadLetter');
```

---

### Logging Sheets

#### SystemLogs (System Logs sheet)
**Purpose:** Technical execution logging

**Schema:**
```typescript
interface SystemLogEntry {
  Timestamp: Date;
  Level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  Service: string;              // Namespace (e.g., 'MembershipManagement')
  Message: string;
  Data: string;                 // JSON-serialized
}
```

**Log Levels:**

| Level | Purpose | When to Use | Performance Impact |
|-------|---------|-------------|-------------------|
| DEBUG | Detailed execution flow | Testing/troubleshooting only | High (very verbose) |
| INFO | Normal operations | Production default | Medium |
| WARN | Validation failures, expected errors | Production | Low |
| ERROR | Unexpected errors, exceptions | Always | Minimal |

**Rotation:**
- Max 1000 entries (oldest deleted when limit exceeded)
- Automatic rotation handled by `Common.Logger` module

**SheetAccess:**
```javascript
const logs = SheetAccess.getData('SystemLogs');
```

**Manual Logging:**
```javascript
Common.Logger.info('ServiceName', 'Message', { additionalData: 'value' });
Common.Logger.error('ServiceName', 'Error message', { error: error.message });
Common.Logger.debug('ServiceName', 'Debug details', { state: currentState });
```

---

#### Audit (Audit Log sheet)
**Purpose:** Business event tracking

**Schema:**
```typescript
interface AuditLogEntry {
  Timestamp: Date;
  Type: 'Join' | 'Renew' | 'Expiry1-4' | 'ProcessTransaction' | 'Migrate';
  Outcome: 'success' | 'fail';
  Email: string;
  Note: string;                 // Human-readable description
  Error: string;                // Error message (if failed)
  Details: string;              // JSON (optional)
}
```

**Audit Contract:**
- Every business event generates exactly one entry
- Generated by Manager methods, persisted by GAS layer
- Never deleted (permanent record)
- Not subject to rotation (grows indefinitely)

**Fiddler Access:**
```javascript
const fiddler = Common.Data.Storage.SpreadsheetManager.getFiddler('Audit');
const auditLog = fiddler.getData();
```

**Querying (Manual):**
```javascript
// Find all renewals in last 7 days
const logs = fiddler.getData();
const sevenDaysAgo = new Date(Date.now() - 7*24*60*60*1000);
const recentRenewals = logs.filter(entry => 
  entry.Type === 'Renew' && 
  entry.Timestamp >= sevenDaysAgo
);
```

---

#### Email Change Log
**Purpose:** Track email address changes

**Schema:**
```typescript
interface EmailChangeEntry {
  Timestamp: Date;
  OldEmail: string;
  NewEmail: string;
  Status: 'success' | 'fail';
  Error: string;                // If failed
}
```

**Use Cases:**
- Audit trail for email changes
- Troubleshoot "wrong email" issues
- Verify group membership updates

---

### Configuration Sheets

#### Properties
**Purpose:** System configuration (runtime settings)

**Schema:**
```typescript
interface PropertyEntry {
  Property: string;             // Key name
  Value: string;                // String value (parse to appropriate type)
  Description: string;
  Service: string;              // Owning namespace
}
```

**Access Methods:**
```javascript
// String property
const value = Common.Config.Properties.getProperty('propertyName');

// Boolean property
const flag = Common.Config.Properties.getBooleanProperty('testEmails', false);

// Number property
const num = Common.Config.Properties.getNumberProperty('expirationBatchSize', 50);

// Set property (runtime only, not persisted to sheet)
Common.Config.Properties.setProperty('propertyName', 'value');
```

**Cache Behavior:**
- Properties loaded once per execution
- Call `Common.Logger.configure()` to reload
- Changes to sheet require new execution to take effect

---

#### Bootstrap
**Purpose:** Sheet reference mapping

**Schema:**
```typescript
interface BootstrapEntry {
  Reference: string;            // Logical name (e.g., 'ActiveMembers')
  iD: string;                   // Spreadsheet ID (blank = current sheet)
  sheetName: string;            // Actual sheet name
  createIfMissing: boolean;     // Auto-create if doesn't exist
}
```

**Purpose:**
- Decouples code from sheet names
- Supports cross-spreadsheet references
- Allows renaming sheets without code changes

**Example:**
```
Reference      | iD | sheetName        | createIfMissing
---------------|----|-----------------|-----------------
ActiveMembers  |    | Members         | FALSE
SystemLogs     |    | System Logs     | TRUE
Elections      | 1SpF... | Elections   | FALSE
```

**Access:**
```javascript
// SheetAccess uses Bootstrap automatically
const members = SheetAccess.getData('ActiveMembers');
// This looks up 'ActiveMembers' in Bootstrap, opens 'Members' sheet
```

---

## Bootstrap Configuration

### Critical Bootstrap Entries

These entries are **required** for system operation:

```csv
Reference,iD,sheetName,createIfMissing
Properties,,Properties,FALSE
SystemLogs,,System Logs,TRUE
Audit,,Audit Log,TRUE
ActiveMembers,,Members,FALSE
Transactions,,Transactions,FALSE
ExpirySchedule,,Expiry Schedule,TRUE
ExpirationFIFO,,Expiration Queue,TRUE
ExpirationDeadLetter,,Expiration Dead Letter,TRUE
ActionSpecs,,Action Specs,FALSE
PublicGroups,,Public Groups,FALSE
```

### External Spreadsheet References

**Elections spreadsheet** (cross-spreadsheet reference):
```csv
Reference,iD,sheetName,createIfMissing
Elections,1SpFU7uTPRcoHyjD5AH6Pf1RbjBmU_kd9Is6aKNJ9xiE,Elections,FALSE
ElectionConfiguration,1SpFU7uTPRcoHyjD5AH6Pf1RbjBmU_kd9Is6aKNJ9xiE,Configuration,FALSE
```

### createIfMissing Guidelines

**Set TRUE when:**
- Sheet is created by system (logs, queues)
- Missing sheet should not block execution
- Sheet has default schema

**Set FALSE when:**
- Sheet must be manually configured (ActionSpecs, PublicGroups)
- Missing sheet indicates misconfiguration
- Sheet contains critical business data

### Bootstrap Troubleshooting

**Error: "Sheet name X not found in Bootstrap"**

Solution: Add missing entry to Bootstrap sheet
```
Reference: YourSheet
iD: [blank or spreadsheet ID]
sheetName: Actual Sheet Name
createIfMissing: TRUE or FALSE
```

**Error: "DID YOU MEAN: 'Propertes' is misspelled"**

Solution: Fix typo in Bootstrap sheet
```
Old: Propertes
New: Properties
```

---

## Properties Sheet Configuration

### Property Categories

#### Testing/Development Properties

| Property | Type | Default | Purpose |
|----------|------|---------|---------|
| testEmails | boolean | FALSE | Mock email sending (log only) |
| testGroupAdds | boolean | FALSE | Mock group additions |
| testGroupRemoves | boolean | FALSE | Mock group removals |
| testGroupEmailReplacements | boolean | FALSE | Mock group email changes |

**Usage:**
```javascript
if (Common.Config.Properties.getBooleanProperty('testEmails', false)) {
  console.log('Would send email:', email);
} else {
  MailApp.sendEmail(email);
}
```

---

#### Expiration Processing Properties

| Property | Type | Default | Purpose |
|----------|------|---------|---------|
| expirationMaxAttempts | number | 5 | Max retries before dead letter |
| expirationBatchSize | number | 50 | Items processed per consumer run |
| PREFILL_FORM_TEMPLATE | string | - | Renewal form URL template |

**Batch Size Tuning:**

| Value | Throughput | Use Case |
|-------|-----------|----------|
| 1 | 60 items/hour | Testing, debugging |
| 10 | 600 items/hour | Low-volume production |
| 50 | 3000 items/hour | **Recommended for production** |
| 100 | 6000 items/hour | High-volume periods (membership drive) |

**Max Attempts Tuning:**

| Value | Retry Duration | Trade-off |
|-------|----------------|-----------|
| 3 | ~20 minutes | Aggressive (fail fast, less retry overhead) |
| 5 | ~8 hours | **Balanced (default, handles transient errors)** |
| 10 | ~7 days | Conservative (handles extended outages) |

---

#### Logger Properties

| Property | Type | Default | Purpose |
|----------|------|---------|---------|
| loggerLevel | string | INFO | Log verbosity (DEBUG/INFO/WARN/ERROR) |
| loggerSheetLogging | boolean | FALSE | Write to System Logs sheet |
| loggerConsoleLogging | boolean | TRUE | Write to Apps Script console |
| loggerScriptProperties | boolean | FALSE | Write to Script Properties |
| loggerEmailErrors | boolean | FALSE | Email ERROR level logs |
| loggerEmailRecipient | string | - | Email address for error notifications |
| loggerNamespaces | string | * | Namespaces to log (comma-separated or *) |

**Log Level Impact:**

| Level | Entries Per Execution | Sheet Impact | Use Case |
|-------|----------------------|--------------|----------|
| ERROR | 0-5 | Minimal | Production monitoring |
| WARN | 5-20 | Low | Normal production |
| INFO | 20-100 | Medium | **Recommended** |
| DEBUG | 100-500 | High | Testing/troubleshooting only |

**Namespace Filtering:**
```javascript
// Only log these two services
loggerNamespaces: MembershipManagement,VotingService

// Log everything (default)
loggerNamespaces: *
```

---

#### Business Logic Properties

| Property | Type | Default | Purpose |
|----------|------|---------|---------|
| domain | string | sc3.club | Email domain for accounts |
| logOnly | boolean | FALSE | Dry-run mode (no changes) |

---

### Property Access Patterns

#### Reading Properties

```javascript
// String (returns null if not found)
const value = Common.Config.Properties.getProperty('propertyName');

// Boolean (returns defaultValue if not found)
const flag = Common.Config.Properties.getBooleanProperty('testEmails', false);

// Number (returns defaultValue if not found)
const num = Common.Config.Properties.getNumberProperty('expirationBatchSize', 50);
```

#### Setting Properties (Runtime Only)

```javascript
// Set in-memory (not persisted to sheet)
Common.Config.Properties.setProperty('myProperty', 'myValue');

// Use case: Pass data between functions in same execution
function step1() {
  Common.Config.Properties.setProperty('lastProcessedId', '123');
}

function step2() {
  const id = Common.Config.Properties.getProperty('lastProcessedId');
}
```

#### Reloading Properties

```javascript
// Force reload from sheet (clears cache)
Common.Logger.configure();
// Now properties reflect current sheet values
```

---

## Script Properties

### What Are Script Properties?

Script Properties are **key-value pairs stored in Apps Script project settings**, separate from spreadsheet data. They persist across executions and are **code-managed** (not operator-configured).

**Access in Apps Script Editor:**
1. Open Apps Script editor
2. **Project Settings** (gear icon)
3. Scroll to **Script Properties** section

---

### Standard Script Properties

#### Container/Elections Spreadsheet IDs

| Property | Set By | Purpose | Lifecycle |
|----------|--------|---------|-----------|
| CONTAINER_SPREADSHEET_ID | setupAllTriggers() | Container spreadsheet reference | Permanent |
| ELECTIONS_SPREADSHEET_ID | setupAllTriggers() | External Elections spreadsheet | Permanent |

**Usage:**
```javascript
const containerId = PropertiesService.getScriptProperties().getProperty('CONTAINER_SPREADSHEET_ID');
const containerSS = SpreadsheetApp.openById(containerId);
```

---

#### Payment Processing State

| Property | Set By | Purpose | Lifecycle |
|----------|--------|---------|-----------|
| spreadsheetId | onFormSubmit trigger | Payment form spreadsheet | Temporary (cleared when complete) |
| paymentCheckStartTime | onFormSubmit trigger | When payment monitoring started | Temporary |
| lastProcessedTime | checkPaymentStatus | Last successful processing run | Temporary |

**Lifecycle:**
1. Form submission → Set `spreadsheetId`, `paymentCheckStartTime`
2. Create 1-minute trigger for `checkPaymentStatus`
3. Every minute: Check for updates, process payments
4. Update `lastProcessedTime` on successful run
5. When no pending payments → Delete trigger, clear properties

---

#### Feature Flags

| Property | Set By | Purpose | Lifecycle |
|----------|--------|---------|-----------|
| FEATURE_USE_NEW_AUTH | FeatureFlags API | Enable verification code authentication | Permanent (toggle) |
| FEATURE_SPA_MODE | FeatureFlags API | Enable SPA mode for services | Permanent (toggle) |

**Management:**
```javascript
// Enable new auth
Common.Config.FeatureFlags.enableNewAuth();

// Check status
const enabled = Common.Config.FeatureFlags.isNewAuthEnabled();

// Emergency rollback
Common.Config.FeatureFlags.emergencyRollback();
```

---

#### Verification Code Tokens (Dynamic Keys)

| Property Pattern | Set By | Purpose | Lifecycle |
|-----------------|--------|---------|-----------|
| vc_<email>_<timestamp> | VerificationCode.generateAndStore | Verification code storage | 10 minutes |
| rl_<email> | VerificationCode.checkRateLimit | Rate limit tracking | 60 minutes |

**Example:**
```
vc_john@example.com_1704096000000: {"code": "123456", "expires": 1704096600000, "attempts": 0}
rl_john@example.com: {"count": 2, "resetAt": 1704099600000}
```

**Cleanup:**
- Expired tokens cleaned automatically by validation logic
- Rate limit counters reset after window expires

---

### Script Properties vs. Properties Sheet

| Aspect | Script Properties | Properties Sheet |
|--------|------------------|------------------|
| **Purpose** | Runtime state, code-managed | Configuration, operator-managed |
| **Persistence** | Project-level (survives sheet deletion) | Sheet-level (lost if sheet deleted) |
| **Access** | PropertiesService API | Common.Config.Properties |
| **Visibility** | Apps Script editor only | Visible in spreadsheet |
| **Performance** | Very fast (GAS native) | Slower (requires sheet access) |
| **Examples** | Trigger state, tokens, feature flags | testEmails, loggerLevel, batchSize |

**Rule of Thumb:**
- **Script Properties**: Data that code sets/updates during execution
- **Properties Sheet**: Configuration that operators change

---

## Triggers and Automation

### Installable Triggers

#### 1. handleElectionsSheetEdit
**Type:** On edit (external Elections spreadsheet)  
**Function:** `handleElectionsSheetEdit(e)`  
**Frequency:** Every edit  
**Purpose:** Sync Elections sheet changes to form lifecycle

**What it does:**
1. Detects edits to Elections sheet
2. Opens/closes ballot forms based on Start/End dates
3. Creates/deletes form submission triggers
4. Updates TriggerId column

**Monitoring:**
- Check System Logs for "VotingService" entries
- Verify TriggerId column populated for active elections
- Check that forms open/close on schedule

**Troubleshooting:**
- Missing TriggerId → Form not opened, check Start date
- Form still accepting votes after End → Check End date, run `processElectionsChanges()` manually
- Error logs → Check ELECTIONS_SPREADSHEET_ID in Script Properties

---

#### 2. processElectionsChanges
**Type:** Time-driven (daily, 00:00)  
**Function:** `processElectionsChanges()`  
**Frequency:** Daily at midnight  
**Purpose:** Lifecycle management for elections

**What it does:**
1. Opens forms for elections reaching Start date
2. Closes forms for elections past End date
3. Sends notifications to election officers

**Monitoring:**
- Check System Logs at 00:30 daily
- Verify election states (UNOPENED → ACTIVE → CLOSED)
- Confirm election officers received notifications

**Troubleshooting:**
- Notifications not sent → Check loggerEmailErrors=TRUE, verify SMTP
- Forms not opening → Check BALLOT_FOLDER_URL in Election Configuration
- State transitions not happening → Check timezone settings (should be America/Los_Angeles)

---

#### 3. onFormSubmit
**Type:** On form submit (container spreadsheet)  
**Function:** `onFormSubmit(e)`  
**Frequency:** Every form submission  
**Purpose:** Initiate payment processing workflow

**What it does:**
1. Stores spreadsheet ID in Script Properties
2. Sets `paymentCheckStartTime`
3. Creates 1-minute trigger for `checkPaymentStatus`

**Monitoring:**
- Check Script Properties after submission
- Verify trigger created (Triggers panel)
- Check System Logs for "New form submission on row: X"

**Troubleshooting:**
- No trigger created → Check onFormSubmit trigger exists
- Multiple triggers → Old triggers not cleaned up, run cleanup script
- Script Properties not set → Check PropertiesService permissions

---

#### 4. processMembershipExpirations
**Type:** Time-driven (daily, 06:00)  
**Function:** `processMembershipExpirations()`  
**Frequency:** Daily at 6:00 AM  
**Purpose:** Generate expiration queue from schedule

**What it does:**
1. Calls `MembershipManagement.generateExpiringMembersList()`
2. Creates entries in Expiration Queue
3. Kicks off `processExpirationFIFO()` if queue non-empty

**Monitoring:**
- Check System Logs at 06:30 daily
- Verify Expiration Queue populated
- Check for ERROR level entries
- Verify queue processing started (check for processExpirationFIFOTrigger)

**Troubleshooting:**
- No queue entries created → Check ExpirySchedule has due dates
- Queue not processing → Check expirationBatchSize > 0
- Trigger not running → Check trigger exists, check timezone
- ERROR entries → Check sheet permissions, Bootstrap configuration

---

### Dynamic Triggers

#### processExpirationFIFOTrigger
**Type:** Time-driven (minute-based, auto-created)  
**Function:** `processExpirationFIFOTrigger()`  
**Frequency:** Every 1 minute (while queue has items)  
**Purpose:** Process expiration queue batch-by-batch

**Lifecycle:**
1. Created by `generateExpiringMembersList()` when queue populated
2. Processes up to `expirationBatchSize` items per run
3. Self-reschedules if queue still has items
4. Auto-deletes when queue empty

**Monitoring:**
- Check Triggers panel (should NOT exist when queue empty)
- Check Expiration Queue `status` column (should be mostly empty)
- Check System Logs for "Expiration FIFO consumer" entries
- Monitor processing rate (50 items/minute with default batchSize=50)

**Troubleshooting:**
- Trigger not created → Check queue has items, check generateExpiringMembersList() ran
- Trigger not deleting → Check queue.length === 0 logic, manually delete trigger
- Processing slow → Increase expirationBatchSize (max 100)
- Items stuck in "processing" → Check for errors, reset status to "pending"

---

#### checkPaymentStatus
**Type:** Time-driven (minute/hourly, auto-created)  
**Function:** `checkPaymentStatus()`  
**Frequency:** 1 min → 5 min → 1 hour (backs off)  
**Purpose:** Process pending payment transactions

**Lifecycle:**
1. Created by `onFormSubmit` at 1-minute frequency
2. Checks for paid transactions, processes them
3. Backs off to 5-minute after 3 minutes
4. Backs off to hourly after 6 minutes
5. Auto-deletes when all payments processed

**Backoff Schedule:**
- 0-3 minutes: Every 1 minute
- 3-6 minutes: Every 5 minutes
- 6+ minutes: Every 60 minutes
- When hasPendingPayments=false: Delete trigger

**Monitoring:**
- Check Triggers panel (should delete within 6 minutes if no pending)
- Check Script Properties: `paymentCheckStartTime`, `lastProcessedTime`
- Check Transactions sheet `Processed` column
- Monitor for orphaned triggers (>24 hours old)

**Troubleshooting:**
- Trigger not deleting → Transactions stuck in "Pending", check payment gateway
- Multiple triggers → Old triggers not cleaned up, delete manually
- Processing not running → Check trigger exists, check script quota
- Trigger running too long → Delete trigger, clear Script Properties, re-submit form

---

### Trigger Management

#### Setup All Triggers
```javascript
// Run from Apps Script editor
setupAllTriggers();

// Returns:
// {
//   success: true,
//   electionsSpreadsheetId: "1SpF...",
//   editTriggerId: "12345",
//   calendarTriggerId: "67890",
//   formSubmitTriggerId: "11111",
//   membershipExpirationTriggerId: "22222"
// }
```

#### List All Triggers
```javascript
const triggers = ScriptApp.getProjectTriggers();
triggers.forEach(t => {
  console.log(`Function: ${t.getHandlerFunction()}`);
  console.log(`  ID: ${t.getUniqueId()}`);
  console.log(`  Type: ${t.getEventType()}`);
  console.log('---');
});
```

#### Delete All Triggers
```javascript
ScriptApp.getProjectTriggers().forEach(t => {
  ScriptApp.deleteTrigger(t);
  console.log(`Deleted trigger: ${t.getHandlerFunction()}`);
});
```

#### Delete Specific Trigger by Function Name
```javascript
function _deleteTriggersByFunctionName(functionName) {
  const triggers = ScriptApp.getProjectTriggers();
  let deleted = 0;
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === functionName) {
      ScriptApp.deleteTrigger(trigger);
      deleted++;
    }
  });
  console.log(`Deleted ${deleted} trigger(s) for ${functionName}`);
}

// Usage:
_deleteTriggersByFunctionName('processExpirationFIFOTrigger');
```

#### Clean Up Orphaned Triggers
```javascript
function cleanUpOrphanedTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  const now = new Date().getTime();
  const oneDayMs = 24 * 60 * 60 * 1000;
  
  triggers.forEach(trigger => {
    const func = trigger.getHandlerFunction();
    
    // Delete dynamic triggers older than 24 hours
    if (func === 'checkPaymentStatus' || func === 'processExpirationFIFOTrigger') {
      const triggerAge = now - trigger.getTriggerSourceId(); // Approximation
      if (triggerAge > oneDayMs) {
        ScriptApp.deleteTrigger(trigger);
        console.log(`Deleted orphaned trigger: ${func}`);
      }
    }
  });
}
```

---

## Logging Architecture

### Three-Layer Logging System

```
┌─────────────────────────────────────────┐
│   Apps Script Console (execution log)   │  ← Always active
├─────────────────────────────────────────┤
│   System Logs Sheet (structured logs)   │  ← Enabled via loggerSheetLogging
├─────────────────────────────────────────┤
│   Audit Log Sheet (business events)     │  ← Always active
└─────────────────────────────────────────┘
```

### Layer 0: Foundation Logging

**Files:** `SpreadsheetManager.js`, `Properties.js`, `Logger.js`  
**Restriction:** MUST use `Logger.log()` only (GAS built-in), NOT `Common.Logger.*`  
**Reason:** Circular dependency prevention

**Example:**
```javascript
// CORRECT (in SpreadsheetManager.js)
Logger.log('Opening sheet: ' + sheetName);

// WRONG (causes circular dependency)
Common.Logger.info('SpreadsheetManager', 'Opening sheet: ' + sheetName);
```

---

### Layer 1: Infrastructure Logging

**Files:** All application services (MembershipManagement, VotingService, etc.)  
**Tools:** `Common.Logger.*` methods  
**Purpose:** Structured logging with levels, namespaces, and destinations

**Standard Pattern:**
```javascript
// At start of operation
Common.Logger.info('ServiceName', 'Starting operation', { param1: value1 });

// During processing
Common.Logger.debug('ServiceName', 'Processing item', { itemId: item.id });

// On error
Common.Logger.error('ServiceName', 'Operation failed', { error: error.message, stack: error.stack });

// On completion
Common.Logger.info('ServiceName', 'Operation completed', { itemsProcessed: count });
```

---

### Layer 2: Business Event Logging (Audit)

**Purpose:** Permanent record of business events  
**Tool:** `Audit.Logger` class  
**Output:** Audit Log sheet

**Pattern:**
```javascript
// Create audit logger
const auditLogger = new Audit.Logger();

// Log business event
const auditEntry = auditLogger.logOperation(
  'Join',                           // Type
  'success',                        // Outcome
  'Member joined: john@example.com', // Note
  null,                             // Error (if failed)
  { email: 'john@example.com', period: 1 } // Details
);

// Return audit entries for persistence
return { result: data, auditEntries: [auditEntry] };
```

---

### Logging Configuration

#### Enable Sheet Logging
```javascript
// In Properties sheet
loggerSheetLogging: TRUE
loggerConsoleLogging: TRUE
loggerLevel: INFO
```

#### Change Log Level Dynamically
```javascript
// Set property in sheet
// Then reload configuration
Common.Logger.configure();
```

#### Filter by Namespace
```javascript
// Log only specific services
loggerNamespaces: MembershipManagement,VotingService

// Log everything
loggerNamespaces: *
```

---

### Log Rotation

**System Logs:**
- Max 1000 entries
- Oldest entries deleted when limit exceeded
- Automatic rotation by `Common.Logger`

**Audit Log:**
- No rotation (grows indefinitely)
- Manual export recommended quarterly
- Archive to CSV for long-term storage

**Manual Log Export:**
```javascript
function exportSystemLogs() {
  const fiddler = Common.Data.Storage.SpreadsheetManager.getFiddler('SystemLogs');
  const logs = fiddler.getData();
  
  // Convert to CSV
  const csv = logs.map(row => 
    Object.values(row).map(v => JSON.stringify(v)).join(',')
  ).join('\n');
  
  // Save to Drive
  DriveApp.createFile('system-logs-' + new Date().toISOString() + '.csv', csv);
}
```

---

## FIFO Processing System

### Architecture

```
┌─────────────────────┐
│  Expiry Schedule    │  ← Future events
│  (calendar)         │
└──────────┬──────────┘
           │ Daily 6AM
           ↓
┌─────────────────────┐
│  generateExpiring   │  ← Generator (pure function)
│  MembersList()      │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  Expiration Queue   │  ← Work queue (50 items/min)
│  (FIFO)             │
└──────────┬──────────┘
           │ Minute-based trigger
           ↓
┌─────────────────────┐
│  processExpiration  │  ← Consumer (side effects)
│  FIFO()             │
└──────────┬──────────┘
           │
           ├─ Success → Remove from queue
           │
           └─ Failure → Increment attempts, set nextAttemptAt
                        │
                        └─ After 5 attempts
                           │
                           ↓
                  ┌─────────────────────┐
                  │ Expiration Dead     │  ← Manual review
                  │ Letter              │
                  └─────────────────────┘
```

### Generator Phase

**Function:** `MembershipManagement.generateExpiringMembersList()`

**Input:**
- ExpirySchedule sheet (items with Date <= today)
- ActionSpecs sheet (email templates, group lists)
- ActiveMembers sheet (member details)

**Output:**
- ExpirationFIFO sheet (new queue items with attempts=0, status='pending')
- No side effects (no emails sent, no groups modified)

**Idempotency:**
- Safe to run multiple times
- Checks for existing queue items before creating duplicates
- Uses unique ID (timestamp + random) to prevent collisions

---

### Consumer Phase

**Function:** `MembershipManagement.processExpirationFIFO(opts)`

**Input:**
- ExpirationFIFO sheet (items with status='pending', nextAttemptAt <= now)
- expirationBatchSize property (default: 50)

**Output:**
- Emails sent (via MailApp or test mode)
- Groups modified (via AdminDirectory or test mode)
- Queue items updated (attempts++, lastAttemptAt, lastError)
- Dead letter items (status='dead' after 5 failures)
- Audit log entries

**Side Effects:**
- Sends emails
- Removes members from Google Groups
- Updates member Status to 'Expired' (Expiry4 only)

**Error Handling:**
- Catches all exceptions per item
- Logs error to `lastError` field
- Increments `attempts`
- Sets `nextAttemptAt` using exponential backoff
- Moves to dead letter after maxAttempts failures

---

### Exponential Backoff

**Formula:** `nextAttemptAt = now + (5 * 3^attempts) minutes`

**Schedule:**
```
Attempt 1: Wait 5 minutes   (5 * 3^0 = 5)
Attempt 2: Wait 15 minutes  (5 * 3^1 = 15)
Attempt 3: Wait 45 minutes  (5 * 3^2 = 45)
Attempt 4: Wait 2 hours     (5 * 3^3 = 135 min)
Attempt 5: Wait 6 hours     (5 * 3^4 = 405 min)
```

**Purpose:**
- Avoid hammering failing resources
- Allow time for transient errors to resolve
- Spread load over time

---

### Monitoring FIFO Health

#### Check Queue Length
```javascript
function checkQueueHealth() {
  const fiddler = Common.Data.Storage.SpreadsheetManager.getFiddler('ExpirationFIFO');
  const queue = fiddler.getData();
  
  const pending = queue.filter(item => item.status === 'pending').length;
  const processing = queue.filter(item => item.status === 'processing').length;
  
  console.log(`Queue health:`);
  console.log(`  Pending: ${pending}`);
  console.log(`  Processing: ${processing}`);
  console.log(`  Total: ${queue.length}`);
  
  if (queue.length > 100) {
    console.warn('⚠️ Queue backing up! Consider increasing expirationBatchSize');
  }
}
```

#### Check Retry Distribution
```javascript
function checkRetryDistribution() {
  const fiddler = Common.Data.Storage.SpreadsheetManager.getFiddler('ExpirationFIFO');
  const queue = fiddler.getData();
  
  const distribution = {};
  queue.forEach(item => {
    const attempts = item.attempts || 0;
    distribution[attempts] = (distribution[attempts] || 0) + 1;
  });
  
  console.log('Retry distribution:');
  Object.keys(distribution).sort().forEach(attempts => {
    console.log(`  ${attempts} attempts: ${distribution[attempts]} items`);
  });
}
```

#### Check Dead Letter Rate
```javascript
function checkDeadLetterRate() {
  const deadFiddler = Common.Data.Storage.SpreadsheetManager.getFiddler('ExpirationDeadLetter');
  const deadItems = deadFiddler.getData();
  
  const last24h = deadItems.filter(item => {
    const age = Date.now() - item.createdAt.getTime();
    return age < 24 * 60 * 60 * 1000;
  });
  
  console.log(`Dead letter rate: ${last24h.length} items in last 24 hours`);
  
  if (last24h.length > 10) {
    console.error('⚠️ High dead letter rate! Investigate common errors');
  }
}
```

---

## Support Strategies

### Incident Response Workflow

```
1. User reports issue
   ↓
2. Check Audit Log (What happened?)
   ↓
3. Check System Logs (Why did it happen?)
   ↓
4. Check Expiration Dead Letter (Is it stuck?)
   ↓
5. Fix root cause
   ↓
6. Document in issue tracker
```

---

### Common Support Scenarios

#### Scenario 1: "Member says they renewed but still getting expiration emails"

**Triage:**
1. Check Audit Log: Filter by member email, look for "Renew" entry
2. Check Members sheet: Verify Expires date is extended
3. Check ExpirySchedule: Verify old schedule entries are deleted
4. Check ExpirationFIFO: Verify no pending expiration items for this member

**Root Causes:**
- Transaction not processed → Run "Process Transactions" menu
- Ambiguous transaction → Check AmbiguousTransactions sheet
- Schedule not updated → Manually delete old schedule entries, re-run renewal

**Resolution:**
1. Process renewal if not done
2. Manually delete queue items for this member
3. Send manual "renewal confirmed" email
4. Document in Audit Log (Type=Manual, Note=explanation)

---

#### Scenario 2: "Expiration queue is backing up (>100 items)"

**Triage:**
1. Check System Logs: Look for ERROR entries from processExpirationFIFO
2. Check queue distribution: Run `checkRetryDistribution()` script
3. Check dead letter rate: Run `checkDeadLetterRate()` script

**Root Causes:**
- Low batch size → Increase `expirationBatchSize` to 100
- High failure rate → Check common errors in `lastError` field
- Trigger not running → Check for processExpirationFIFOTrigger in Triggers panel
- Script quota exceeded → Check Apps Script quotas dashboard

**Resolution:**
1. If quota exceeded: Wait for quota reset, or request quota increase
2. If high failure rate: Fix underlying issue (group permissions, email templates)
3. If low batch size: Update `expirationBatchSize` in Properties sheet
4. If trigger missing: Manually run `generateExpiringMembersList()` to recreate trigger

---

#### Scenario 3: "Member removed from group but shouldn't have been"

**Triage:**
1. Check Audit Log: Filter by member email, Type=Expiry4
2. Check Members sheet: Verify Expires date and Status
3. Check ExpirationDeadLetter: Check if action failed but member reports removal

**Root Causes:**
- Incorrect expiration date in Members sheet
- Manual group removal (not by automation)
- Race condition (renewal processed after Expiry4 sent)

**Resolution:**
1. Re-add member to groups manually
2. If renewed: Update Members sheet, remove from queue
3. If not renewed but shouldn't expire: Update Expires date, remove from queue
4. Document in Audit Log (Type=Manual, Note=explanation)

---

#### Scenario 4: "Dead letter items piling up with same error"

**Triage:**
1. Check dead letter for common `lastError` pattern
2. Group by error message
3. Check System Logs for related ERROR entries

**Common Patterns:**

| Error Pattern | Root Cause | Resolution |
|---------------|------------|------------|
| "Group not found" | Group deleted or renamed | Update ActionSpecs with correct group name, or recreate group |
| "Permission denied" | Automation account not manager | Add membership-automation@sc3.club as manager to all groups |
| "Email bounce" | Many invalid emails | Bulk email validation, contact members for updated emails |
| "Network timeout" | GAS API issues | Transient, will resolve; manually retry after 24 hours |

**Resolution:**
1. Fix root cause (group permissions, ActionSpecs, etc.)
2. Manually process dead letter items (send emails, add/remove from groups)
3. Document resolution in `note` column
4. Leave items in dead letter for audit trail

---

### Performance Monitoring

#### Check Execution Time
```javascript
function monitorPerformance() {
  const fiddler = Common.Data.Storage.SpreadsheetManager.getFiddler('SystemLogs');
  const logs = fiddler.getData();
  
  // Find recent processExpirationFIFO runs
  const fifoRuns = logs.filter(log => 
    log.Service === 'MembershipManagement' && 
    log.Message.includes('FIFO consumer') &&
    log.Timestamp > new Date(Date.now() - 24*60*60*1000)
  );
  
  fifoRuns.forEach(run => {
    const data = JSON.parse(run.Data);
    console.log(`${run.Timestamp}: Processed ${data.processed} items in ${data.duration}ms`);
  });
}
```

#### Check API Quota Usage
```javascript
function checkQuotaUsage() {
  // This must be run from Apps Script editor (not available in standalone scripts)
  console.log('API Quotas:');
  console.log(`  Email quota: ${MailApp.getRemainingDailyQuota()}`);
  console.log(`  URL Fetch quota: ${UrlFetchApp.getRemainingQuota()}`);
  // AdminDirectory quota not directly queryable; monitor via GCP console
}
```

---

## Advanced Troubleshooting

### Debugging Tools

#### Enable DEBUG Logging
```javascript
// Set in Properties sheet
loggerLevel: DEBUG
loggerSheetLogging: TRUE

// Then reload
Common.Logger.configure();

// Run problematic operation
// Check System Logs for detailed execution flow

// IMPORTANT: Set back to INFO after troubleshooting
loggerLevel: INFO
Common.Logger.configure();
```

#### Test Mode (Dry Run)
```javascript
// Set test properties
testEmails: TRUE
testGroupAdds: TRUE
testGroupRemoves: TRUE

// Run operation
// Check System Logs for "TESTING MODE" entries
// No actual emails sent or groups modified

// Disable test mode
testEmails: FALSE
testGroupAdds: FALSE
testGroupRemoves: FALSE
```

#### Manual FIFO Processing
```javascript
function manualProcessFIFO() {
  // Process just 1 item with debug logging
  const result = MembershipManagement.processExpirationFIFO({
    batchSize: 1,
    dryRun: false
  });
  
  console.log('Processed:', result.processed);
  console.log('Failed:', result.failed);
  console.log('Dead:', result.dead);
  console.log('Errors:', result.errors);
}
```

---

### Data Integrity Checks

#### Verify Schedule Completeness
```javascript
function verifyScheduleCompleteness() {
  const membersFiddler = Common.Data.Storage.SpreadsheetManager.getFiddler('ActiveMembers');
  const scheduleFiddler = Common.Data.Storage.SpreadsheetManager.getFiddler('ExpirySchedule');
  
  const members = membersFiddler.getData().filter(m => m.Status === 'Active');
  const schedule = scheduleFiddler.getData();
  
  members.forEach(member => {
    const entries = schedule.filter(s => s.Email === member.Email);
    if (entries.length !== 4) {
      console.error(`⚠️ Member ${member.Email} has ${entries.length} schedule entries (expected 4)`);
    }
  });
}
```

#### Check for Orphaned Queue Items
```javascript
function checkOrphanedQueueItems() {
  const membersFiddler = Common.Data.Storage.SpreadsheetManager.getFiddler('ActiveMembers');
  const queueFiddler = Common.Data.Storage.SpreadsheetManager.getFiddler('ExpirationFIFO');
  
  const members = membersFiddler.getData();
  const queue = queueFiddler.getData();
  
  queue.forEach(item => {
    const member = members.find(m => m.Email === item.memberEmail);
    if (!member) {
      console.warn(`⚠️ Queue item ${item.id} references unknown member ${item.memberEmail}`);
    } else if (member.Status === 'Active' && item.actionType === 'notify+remove') {
      console.warn(`⚠️ Queue item ${item.id} will remove ACTIVE member ${item.memberEmail}`);
    }
  });
}
```

---

### Emergency Procedures

#### Stop All Processing
```javascript
function emergencyStop() {
  // Delete all dynamic triggers
  ScriptApp.getProjectTriggers().forEach(trigger => {
    const func = trigger.getHandlerFunction();
    if (func === 'processExpirationFIFOTrigger' || func === 'checkPaymentStatus') {
      ScriptApp.deleteTrigger(trigger);
      console.log(`Deleted trigger: ${func}`);
    }
  });
  
  // Set batch size to 0 (stops consumer)
  // Note: Must manually update Properties sheet
  console.log('Set expirationBatchSize=0 in Properties sheet to fully stop processing');
}
```

#### Resume Processing
```javascript
function resumeProcessing() {
  // Set batch size back to normal
  // Note: Must manually update Properties sheet
  console.log('Set expirationBatchSize=50 in Properties sheet');
  
  // Manually trigger generation
  MembershipManagement.generateExpiringMembersList();
  console.log('Queue regenerated and processing resumed');
}
```

#### Reset Queue Item for Retry
```javascript
function resetQueueItem(itemId) {
  const fiddler = Common.Data.Storage.SpreadsheetManager.getFiddler('ExpirationFIFO');
  const queue = fiddler.getData();
  
  const index = queue.findIndex(item => item.id === itemId);
  if (index === -1) {
    console.error(`Item ${itemId} not found in queue`);
    return;
  }
  
  queue[index].attempts = 0;
  queue[index].lastError = '';
  queue[index].nextAttemptAt = '';
  queue[index].status = 'pending';
  
  fiddler.setData(queue).dumpValues();
  console.log(`Reset item ${itemId} for retry`);
}
```

---

### Backup and Recovery

#### Export Critical Data
```javascript
function backupCriticalData() {
  const sheets = ['ActiveMembers', 'Transactions', 'ExpirySchedule', 'Audit'];
  const timestamp = Utilities.formatDate(new Date(), 'America/Los_Angeles', 'yyyy-MM-dd-HHmmss');
  
  sheets.forEach(sheetName => {
    const fiddler = Common.Data.Storage.SpreadsheetManager.getFiddler(sheetName);
    const data = fiddler.getData();
    
    const csv = [
      Object.keys(data[0]).join(','),
      ...data.map(row => Object.values(row).map(v => JSON.stringify(v)).join(','))
    ].join('\n');
    
    DriveApp.createFile(`backup-${sheetName}-${timestamp}.csv`, csv);
  });
  
  console.log('Backup complete');
}
```

---

## Appendix A: Sheet Schema Reference

### Complete Schema Definitions

Available in separate documentation:
- `docs/BOOTSTRAP_CONFIGURATION.md`
- `docs/ExpirationFIFO_SCHEMA.md`

---

## Appendix B: API Reference

### Common.Logger

```typescript
namespace Common.Logger {
  function configure(): void;
  function debug(service: string, message: string, data?: any): void;
  function info(service: string, message: string, data?: any): void;
  function warn(service: string, message: string, data?: any): void;
  function error(service: string, message: string, data?: any): void;
}
```

### Common.Config.Properties

```typescript
namespace Common.Config.Properties {
  function getProperty(key: string): string | null;
  function getBooleanProperty(key: string, defaultValue: boolean): boolean;
  function getNumberProperty(key: string, defaultValue: number): number;
  function setProperty(key: string, value: string): void;
}
```

### SheetAccess

```typescript
class SheetAccess {
  static getData(sheetName: string): any[];
  static getDataAsArrays(sheetName: string): any[][];
  static getDataWithRichText(sheetName: string): any[];
  static setData(sheetName: string, data: any[]): void;
  static convertLinks(sheetName: string): void;
  static getSheet(sheetName: string): GoogleAppsScript.Spreadsheet.Sheet;
}
```

---

## Appendix C: Quick Reference Commands

### Common Operations

```javascript
// View all triggers
ScriptApp.getProjectTriggers().forEach(t => 
  console.log(`${t.getHandlerFunction()}: ${t.getUniqueId()}`)
);

// Check queue health
const queue = SheetAccess.getData('ExpirationFIFO');
console.log(`Queue length: ${queue.length}`);

// Check dead letter
const dead = SheetAccess.getData('ExpirationDeadLetter');
console.log(`Dead letter items: ${dead.length}`);

// Check recent errors in System Logs
const logs = SheetAccess.getData('SystemLogs');
const errors = logs.filter(l => l.Level === 'ERROR' && 
  l.Timestamp > new Date(Date.now() - 24*60*60*1000)
);
console.log(`Errors in last 24h: ${errors.length}`);

// Enable/disable new auth
Common.Config.FeatureFlags.enableNewAuth();
Common.Config.FeatureFlags.emergencyRollback();
console.log(`New auth enabled: ${Common.Config.FeatureFlags.isNewAuthEnabled()}`);
```

---

**Prepared for:** System Operators and Administrators  
**Version:** 1.3.0  
**Last Updated:** December 14, 2025  
**Next Review:** March 2026
