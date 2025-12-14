# Production Deployment Guide - Version 1.3.0

**Date:** December 14, 2025  
**Target Version:** 1.3.0  
**Source Branch:** Develop

---

## Overview

This guide documents all changes required to deploy the Develop branch to production, including new sheets, properties, triggers, deprecated components, and configuration updates.

---

## 1. New Sheets Required

### 1.1 Add to Bootstrap Sheet

Add these entries to the **Bootstrap** sheet if not already present:

| Reference | iD | sheetName | createIfMissing |
|-----------|---|-----------|-----------------|
| SystemLogs | | System Logs | TRUE |
| Audit | | Audit Log | TRUE |
| ExpirationFIFO | | Expiration Queue | TRUE |
| ExpirationDeadLetter | | Expiration Dead Letter | TRUE |

### 1.2 Sheet Schemas

**System Logs** - Technical execution logging
- Timestamp (Date)                                                   
- Level (String: DEBUG, INFO, WARN, ERROR)
- Service (String)
- Message (String)
- Data (String: JSON)

**Audit Log** - Business event tracking
- Timestamp (Date)
- Type (String: Join, Renew, Migrate, Expiry1-4, etc.)
- Outcome (String: success, fail)
- Email (String)
- Note (String)
- Error (String, optional)
- Details (String: JSON, optional)

**Expiration Queue** - FIFO processing with retry logic
- id, createdAt, status, memberEmail, memberName, expiryDate, actionType, groups
- emailTo, emailSubject, emailBody
- attempts, lastAttemptAt, lastError, nextAttemptAt, maxAttempts, note

**Expiration Dead Letter** - Failed expirations requiring manual intervention
- Same schema as Expiration Queue (status will always be 'dead')

---

## 2. Properties Sheet Updates

### 2.1 New Required Properties

Add these rows to the **Properties** sheet:

| Property | Value | Description | Service |
|----------|-------|-------------|---------|
| expirationMaxAttempts | 5 | Maximum retry attempts for expiration actions | MembershipManagement |
| expirationBatchSize | 50 | Number of expired members to process per batch | MembershipManagement |
| loggerLevel | INFO | Log level: DEBUG/INFO/WARN/ERROR | Logger |
| loggerSheetLogging | TRUE | Enable sheet-based logging | Logger |
| loggerConsoleLogging | TRUE | Enable console logging | Logger |
| loggerNamespaces | * | Namespaces to log (comma-separated or * for all) | Logger |
| loggerScriptProperties | FALSE | Enable Script Properties logging | Logger |
| loggerEmailErrors | FALSE | Email error-level logs | Logger |
| loggerEmailRecipient | membership-automation@sc3.club | Email address for error notifications | Logger |

### 2.2 Verify Existing Properties

| Property | Typical Value | Description |
|----------|---------------|-------------|
| testEmails | FALSE | Set TRUE for testing, FALSE for production |
| testGroupAdds | FALSE | Use test mode for group additions |
| testGroupRemoves | FALSE | Use test mode for group removals |
| domain | sc3.club | Email domain for member accounts |
| PREFILL_FORM_TEMPLATE | [URL] | Form template URL for renewals |

---

## 3. Script Properties

These are **code-managed** properties. No manual configuration needed. They are set automatically by trigger setup and runtime code.

| Property | Set By | Purpose |
|----------|--------|---------|
| CONTAINER_SPREADSHEET_ID | setupAllTriggers() | Container spreadsheet reference |
| ELECTIONS_SPREADSHEET_ID | setupAllTriggers() | External Elections spreadsheet |
| spreadsheetId | onFormSubmit trigger | Payment form spreadsheet |
| paymentCheckStartTime | onFormSubmit trigger | Payment processing timing |
| lastProcessedTime | checkPaymentStatus | Processing cursor |
| FEATURE_USE_NEW_AUTH | FeatureFlags API | Enable verification code authentication |

---

## 4. Triggers Configuration

### 4.1 Setup All Triggers

Run this function from **Apps Script Editor**:

```javascript
setupAllTriggers()
```

This creates **four installable triggers**:

1. **handleElectionsSheetEdit**: External Elections spreadsheet edit trigger
2. **processElectionsChanges**: Daily calendar trigger (midnight)
3. **onFormSubmit**: Container spreadsheet form submission trigger
4. **processMembershipExpirations**: Daily membership expiration processing (6:00 AM)

### 4.2 Verify Trigger Installation

In Apps Script Editor → **Triggers** (clock icon):
- `handleElectionsSheetEdit` - On edit (external Elections spreadsheet)
- `processElectionsChanges` - Time-driven (daily, 00:00)
- `onFormSubmit` - On form submit (container spreadsheet)
- `processMembershipExpirations` - Time-driven (daily, 06:00)

### 4.3 Dynamic Triggers (Auto-Created by Code)

These are created/deleted automatically:

- **processExpirationFIFOTrigger**: Minute-based trigger for queue processing (auto-deleted when queue empty)
- **checkPaymentStatus**: Minute/hourly trigger for payment processing (auto-deleted when complete)

---

## 5. Functions Added/Modified

### 5.1 New Functions

**MembershipManagement namespace:**
- `generateExpiringMembersList()`: Generator for expiration queue
- `processExpirationFIFO(opts)`: Consumer that processes queue with retry logic
- `Internal.persistAuditEntries_(entries)`: Writes audit log entries
- `Internal.sendExpirationErrorNotification_(error)`: Error alerts

**Menu functions:**
- Now wrapped with `Common.Utils.wrapMenuFunction()` for error handling
- "Process Expirations" now generates queue instead of direct processing

### 5.2 Modified Functions

**processMembershipExpirations()** (trigger function):
- Now calls `generateExpiringMembersList()` instead of processing directly
- Automatically kicks off `processExpirationFIFO()` if queue has items

**Manager.processPaidTransactions()**:
- Returns `{ recordsChanged, hasPendingPayments, errors, auditEntries }`
- Generates audit log entries for joins, renewals, failures

**Manager.migrateCEMembers()**:
- Returns `{ numMigrations, errors, auditEntries }`
- Generates audit log entries for migrations

### 5.3 New Web Services

**SPA Services (using verification code authentication):**
- GroupManagementService
- ProfileManagementService
- DirectoryService
- EmailChangeService
- VotingService

All services follow data-driven SPA architecture with:
- Server returns JSON data only
- Client renders HTML from data
- No tokens in URLs/HTML (verification code flow)
- Service home page with navigation

---

## 6. Bootstrap Entries No Longer Needed

### 6.1 Deprecated Sheet References

Remove these Bootstrap entries if present:

| Reference | Reason |
|-----------|--------|
| ExpiredMembers | Replaced by ExpirationFIFO and ExpirationDeadLetter |
| AmbiguousTransactions | Removed and replaced by smarter processing of members |

---

## 7. Menu Changes

**"Process Expirations" behavior change:**
- **Old**: Directly sent emails and removed members from groups
- **New**: Generates entries in Expiration Queue for batch processing with retry logic

---

## 8. Authentication System Updates

### 8.1 New Verification Code Authentication

**Feature Flag:** `FEATURE_USE_NEW_AUTH` in Script Properties

**New Flow:**
1. User enters email at service landing page
2. System generates 6-digit verification code
3. Code sent via email (10-minute expiry)
4. User enters code to authenticate
5. Session token granted (in-memory, not in URL)

**Security Features:**
- Rate limiting: 5 codes per email per hour
- Max 3 verification attempts per code
- Codes are single-use
- Tokens never exposed in URLs or HTML

### 8.2 Backward Compatibility

**Magic links still work** when `FEATURE_USE_NEW_AUTH` is disabled or not set.

**Deprecated (will be removed in future release):**
- `sendMagicLink()` function
- `Common.Auth.Utils.sendMagicLink()`
- `magicLinkInput.html`

---

## 9. Deployment Checklist

### Pre-Deployment

- [ ] **Backup production spreadsheet**
- [ ] Review all Properties sheet values
- [ ] Verify Bootstrap entries are correct
- [ ] Run `npm test` (must pass 100%)
- [ ] Review Script Properties (nothing to configure manually)
- [ ] Ensure clean git state (`git status` shows no uncommitted changes)

### Deployment

- [ ] Run `npm run prod:deploy-live` (requires clean git state)
- [ ] Verify deployment version created in Apps Script
- [ ] Run `setupAllTriggers()` from Apps Script editor
- [ ] Verify all four triggers installed correctly

### Post-Deployment

- [ ] Check **System Logs** sheet exists and is writable
- [ ] Check **Audit Log** sheet exists and is writable
- [ ] Check **Expiration Queue** sheet exists
- [ ] Check **Expiration Dead Letter** sheet exists
- [ ] Verify `loggerSheetLogging=TRUE` in Properties
- [ ] Test "Process Expirations" menu item (should create queue entries)
- [ ] Monitor System Logs for 24 hours for ERROR level entries

### First Week Monitoring

- [ ] Daily: Check **Expiration Dead Letter** for failed items
- [ ] Daily: Review **Audit Log** for unexpected failures
- [ ] Daily: Check **System Logs** for ERROR level entries
- [ ] Weekly: Review **Expiration Queue** for stuck items

---

## 10. Feature Flag Rollout Plan

### Phase 1: Verification (1-2 days)

1. Deploy with `FEATURE_USE_NEW_AUTH` = **false** (magic links active)
2. Verify all existing functionality works
3. Monitor System Logs for any errors

### Phase 2: Limited Testing (1 week)

1. Enable new auth: Run in Apps Script console:
   ```javascript
   Common.Config.FeatureFlags.enableNewAuth();
   ```
2. Test with 1-2 trusted users
3. Verify verification code emails are sent
4. Verify services load correctly
5. Monitor for issues

### Phase 3: Full Rollout (ongoing)

1. If successful, leave flag ON
2. Monitor deprecation warnings in logs
3. After 30-day stable period, remove deprecated magic link code

### Emergency Rollback

If critical issues occur:
```javascript
Common.Config.FeatureFlags.emergencyRollback();
```

This immediately disables new auth and returns to magic links.

---

## 11. Rollback Plan

### If Critical Issues Occur

**1. Stop all triggers:**
```javascript
ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
```

**2. Redeploy previous version:**
- In Apps Script editor: **Deploy > Manage Deployments**
- Select previous working version
- Click "Edit" and set as active

**3. Restore Properties:**
- Set `loggerSheetLogging=FALSE` to stop sheet logging
- Set `expirationBatchSize=0` to pause expiration processing

**4. Re-run trigger setup:**
```javascript
setupAllTriggers()
```

### Verification After Rollback

- [ ] Verify triggers are running
- [ ] Check System Logs for normal operation
- [ ] Test basic membership workflows (join, renewal)
- [ ] Monitor for 24 hours

---

## 12. Key Changes Summary

### Architecture Changes

1. **Expiration Processing**: Generator/consumer pattern with FIFO queue and retry logic
2. **Audit Logging**: All business events logged to Audit sheet
3. **System Logging**: Structured logging to System Logs sheet
4. **SPA Architecture**: Five services migrated to Single Page Application pattern
5. **Authentication**: New verification code flow (feature-flagged)

### Data Flow Changes

1. **Transactions → Members**: Enhanced audit trail
2. **Expiry Schedule → Queue → Dead Letter**: Three-sheet expiration system
3. **Email/Group Operations**: Automatic retry with exponential backoff

### Security Improvements

1. Tokens never in URLs or HTML
2. Rate limiting on verification codes
3. Single-use verification codes
4. Session tokens with expiry

---

## 13. Support Contacts

- **Technical Issues**: Check System Logs sheet, then GitHub Issues
- **Business Logic Issues**: Check Audit Log sheet for event history
- **Failed Expirations**: Check Expiration Dead Letter sheet
- **Deployment Issues**: Review deployment logs, check Script Properties

---

## 14. Version History

- **v1.3.0** (December 2025): Audit logging, FIFO processing, SPA migration, verification code auth
- **v1.2.12** (Prior): Voting Service, Elections integration
- **v1.1.1** (Prior): Magic link authentication

---

**Prepared by:** System Administrator  
**Last Updated:** December 14, 2025  
**Review Required:** Before each production deployment
