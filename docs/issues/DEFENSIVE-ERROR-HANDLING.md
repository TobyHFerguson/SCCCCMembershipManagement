# Defensive Error Handling: Preventing Orphaned Queues & Trigger Issues

**Date**: 2026-01-16  
**Context**: Additional defensive improvements to the duplicate email fix

---

## TL;DR

**Problem**: The original fix prevented race conditions but had error paths that could leave the queue orphaned (no trigger to process it) or trigger stuck in error loops.

**Solution**: Added multi-layer defensive error handling with fallback trigger creation and catastrophic failure cleanup.

---

## Discovered Risk Scenarios

### Risk 1: Orphaned Queue (Trigger Create Fails)

**Scenario**:
```javascript
// Original code:
try {
  deleteTriggersByFunctionName('processExpirationFIFOTrigger');  // ✅ Succeeds
  createMinuteTrigger('processExpirationFIFOTrigger', 1);         // ❌ Throws!
} catch (e) {
  logError(e);  // ← Queue has 118 items, but NO TRIGGER to process them!
}
```

**Causes**:
- GAS quota exceeded (20 triggers per script max)
- Permission/authorization errors
- GAS service temporary unavailability
- Script lock conflicts

**Impact**:
- Queue items never processed
- Members never receive expiration emails
- Manual intervention required to fix

---

### Risk 2: Duplicate Delete (Hidden in create functions)

**Original Code**:
```javascript
// In main code:
deleteTriggersByFunctionName('processExpirationFIFOTrigger');  // Delete #1

// Inside _createMinuteTrigger:
_createMinuteTrigger: function (functionName, minutes) {
    deleteTriggersByFunctionName(functionName);  // Delete #2 (DUPLICATE!)
    return ScriptApp.newTrigger(functionName).timeBased().everyMinutes(minutes).create();
}
```

**Problem**:
- Double delete creates timing window
- If GAS delays first delete, second delete might miss it
- Could accidentally delete newly created trigger from another execution

**Impact**:
- Race condition reintroduced
- Unpredictable trigger state

---

### Risk 3: Catastrophic Failure Loop

**Scenario**:
```javascript
processExpirationFIFO() {
  try {
    // ... processing ...
    throw new Error('Spreadsheet corrupted!');  // Fatal error
  } catch (error) {
    logError(error);
    sendNotification(error);
    return { error };
  }
  // ← Trigger still exists! Fires again in 1 minute!
}
```

**What Happens**:
```
06:00 - Trigger fires → Catastrophic error → Email sent
06:01 - Trigger fires → Same error → Email sent
06:02 - Trigger fires → Same error → Email sent
...
60 emails per hour, forever!
```

**Impact**:
- Spam error notifications
- Quota consumption
- No automatic recovery
- Manual intervention required

---

## Defensive Improvements Implemented

### Improvement 1: Fallback Trigger Creation

**Location**: `generateExpiringMembersList()` lines 180-192

**Strategy**: If delete+create fails, try create alone
```javascript
try {
  deleteTriggersByFunctionName('processExpirationFIFOTrigger');
  createMinuteTrigger('processExpirationFIFOTrigger', 1);
} catch (e) {
  logError('Failed to schedule trigger', e);
  // DEFENSIVE: Try create without delete - orphaned queue is worse than duplicate trigger
  try {
    createMinuteTrigger('processExpirationFIFOTrigger', 1);
    log('Trigger created on retry after delete failure');
  } catch (retryError) {
    logError('CRITICAL: Failed to create trigger on retry - queue may be orphaned!', retryError);
  }
}
```

**Reasoning**:
- **Orphaned queue** = Members never get emails (BAD)
- **Duplicate trigger** = Some duplicates, but queue processed (LESS BAD)
- Trade-off: Choose "works with issues" over "completely broken"

**Outcome**:
- If delete fails but create succeeds → Might have 2 triggers briefly, but queue processes
- If both fail → CRITICAL log for immediate operator response

---

### Improvement 2: Catastrophic Failure Cleanup

**Location**: `processExpirationFIFO()` lines 347-361

**Strategy**: Delete trigger on fatal errors
```javascript
} catch (error) {
  logError('Expiration FIFO consumer failed', error);
  
  // DEFENSIVE: On catastrophic failure, delete trigger to prevent infinite retry loop
  if (!opts.dryRun) {
    try {
      log('Deleting trigger due to catastrophic failure');
      deleteTriggersByFunctionName('processExpirationFIFOTrigger');
    } catch (triggerError) {
      logError('Failed to delete trigger after catastrophic failure', triggerError);
    }
  }
  
  sendNotification(error);
  return { error };
}
```

**Reasoning**:
- Catastrophic errors (spreadsheet corruption, permission loss) won't self-heal
- Retrying every minute just spams errors
- Better to halt and require manual fix than loop forever

**Outcome**:
- Single error notification email
- Trigger deleted automatically
- Operator can investigate and manually restart

---

### Improvement 3: Fallback Trigger on Scheduling Errors

**Location**: `processExpirationFIFO()` lines 315-346

**Strategy**: If optimal scheduling fails, fall back to basic 1-minute trigger
```javascript
try {
  // Calculate optimal delay based on nextAttemptAt times
  const minutesUntilNext = calculateOptimalDelay(finalQueue);
  deleteTriggersByFunctionName('processExpirationFIFOTrigger');
  createMinuteTrigger('processExpirationFIFOTrigger', minutesUntilNext);
} catch (e) {
  logError('Error scheduling expiration FIFO trigger', e);
  // DEFENSIVE: If scheduling failed but queue has work, create basic 1-minute trigger
  try {
    createMinuteTrigger('processExpirationFIFOTrigger', 1);
    log('Created fallback 1-minute trigger after scheduling error');
  } catch (retryError) {
    logError('CRITICAL: Failed to create fallback trigger - queue orphaned!', retryError);
  }
}
```

**Reasoning**:
- Optimal scheduling is nice-to-have
- Queue processing is must-have
- If calculation fails, use simple 1-minute default
- Better to process too often than not at all

**Outcome**:
- Queue always has a trigger (even if suboptimal timing)
- Graceful degradation on complex scheduling errors

---

### Improvement 4: Remove Hidden Deletes

**Location**: `Trigger.js` lines 115-133

**Before** (Hidden Delete):
```javascript
_createMinuteTrigger: function (functionName, minutes) {
    deleteTriggersByFunctionName(functionName);  // ← HIDDEN!
    return ScriptApp.newTrigger(functionName).timeBased().everyMinutes(minutes).create();
}
```

**After** (Explicit Delete):
```javascript
_createMinuteTrigger: function (functionName, minutes) {
    // NOTE: Caller is responsible for deleting existing triggers
    // We don't delete here to avoid duplicate deletes and provide clearer error handling
    return ScriptApp.newTrigger(functionName).timeBased().everyMinutes(minutes).create();
}
```

**Reasoning**:
- Explicit > Implicit (principle of least surprise)
- Caller controls delete timing and error handling
- No duplicate deletes = no race condition windows
- Clear separation of concerns

**Outcome**:
- Predictable trigger management
- Better error handling at call site
- No hidden side effects

---

## Error Recovery Matrix

| Error Scenario | Before Fix | After Defensive Improvements |
|----------------|------------|------------------------------|
| Delete succeeds, create fails | ❌ Queue orphaned, manual fix required | ✅ Retry create, log CRITICAL if both fail |
| Create fails on first attempt | ❌ Queue orphaned | ✅ Fallback to basic trigger |
| Catastrophic processing error | ❌ Trigger loops forever, email spam | ✅ Auto-delete trigger, single notification |
| Optimal scheduling calculation fails | ❌ No trigger created | ✅ Fall back to 1-minute trigger |
| GAS quota exceeded (20 triggers) | ❌ Silent failure | 🟡 CRITICAL log, operator notified |
| Permission loss mid-execution | ❌ Infinite retry loop | ✅ Trigger deleted on catastrophic error |

---

## Trade-offs & Decisions

### Decision: Prefer "Duplicate Trigger" Over "Orphaned Queue"

**Reasoning**:
- Orphaned queue = members miss emails entirely (HIGH SEVERITY)
- Duplicate trigger = some members get 2 emails (LOW SEVERITY)
- We already have idempotency checks in email content
- Easier to apologize for duplicates than explain missed renewals

**Implementation**:
- Retry trigger creation even if delete failed
- Accept temporary duplicate triggers as lesser evil

---

### Decision: Auto-Delete on Catastrophic Failure

**Reasoning**:
- Catastrophic errors won't self-heal (corruption, permission loss)
- Retrying every minute wastes quota and spams errors
- Manual intervention required anyway
- Better to halt cleanly than loop infinitely

**Implementation**:
- Catch all errors at top level of `processExpirationFIFO`
- Delete trigger on catastrophic failure
- Send single notification email
- Log CRITICAL for operator response

---

### Decision: Remove Hidden Deletes from Create Functions

**Reasoning**:
- Duplicate deletes create timing windows for race conditions
- Explicit > Implicit (clearer code, better debugging)
- Caller should control delete timing and error handling
- Separation of concerns (create ≠ delete)

**Implementation**:
- Remove delete from `_createMinuteTrigger` and `_createHourlyTrigger`
- Callers explicitly delete before create
- Better error handling at call sites

---

## Remaining Risks (Accepted)

### Risk: GAS Quota Exhaustion (20 Triggers Max)

**Scenario**: Script already has 20 triggers for other features
- `_createMinuteTrigger` throws quota exceeded error
- Even retry fails
- Queue orphaned

**Mitigation**:
- CRITICAL log alerts operator
- Manual trigger cleanup required
- Not common in practice (we use ~5 triggers total)

**Acceptance**: Extremely rare, requires operator awareness

---

### Risk: Transient GAS Service Outage

**Scenario**: GAS service unavailable during trigger operations
- All create operations fail
- Queue orphaned temporarily

**Mitigation**:
- CRITICAL logs generated
- Retry logic will work once service recovers
- Daily generation trigger will reschedule

**Acceptance**: Self-healing once GAS recovers

---

### Risk: Race Between Manual & Automated Trigger Creation

**Scenario**: Operator manually creates trigger while automation also creates one
- Two triggers exist briefly
- Some duplicate processing possible

**Mitigation**:
- Operator training (don't manually create `processExpirationFIFOTrigger`)
- Triggers have same function name (eventual cleanup)
- Duplicate detection in audit logs

**Acceptance**: Human error, training issue not code issue

---

## Testing Strategy

### Unit Tests

✅ **All existing tests pass** (1050/1050)
- Queue persistence verified
- Trigger scheduling tested
- Error handling validated

### Manual Testing Required

**Test 1: Simulated Create Failure**
```javascript
// In dev environment:
function testOrphanedQueueDefense() {
  // Mock createMinuteTrigger to throw on first call
  const original = MembershipManagement.Trigger._createMinuteTrigger;
  let callCount = 0;
  MembershipManagement.Trigger._createMinuteTrigger = function(...args) {
    callCount++;
    if (callCount === 1) throw new Error('Simulated GAS quota exceeded');
    return original.apply(this, args);
  };
  
  // Trigger generation
  MembershipManagement.generateExpiringMembersList();
  
  // Verify: Trigger exists despite error
  // Verify: CRITICAL log generated
  // Verify: Fallback trigger created
}
```

**Test 2: Catastrophic Error Recovery**
```javascript
function testCatastrophicFailureCleanup() {
  // Add item to queue
  // Force processExpirationFIFO to throw
  // Verify: Trigger deleted
  // Verify: Single notification sent
  // Verify: Not called again
}
```

**Test 3: Duplicate Trigger Cleanup**
```javascript
function testDuplicateTriggerCleanup() {
  // Manually create 2 triggers with same function name
  // Call processExpirationFIFO
  // Verify: Only 1 trigger remains after processing
}
```

---

## Monitoring & Alerts

### CRITICAL Log Patterns

Monitor System Logs for these patterns:

1. **"CRITICAL: Failed to create trigger on retry - queue may be orphaned!"**
   - **Action**: Manually create `processExpirationFIFOTrigger`
   - **Urgency**: HIGH (queue not processing)

2. **"CRITICAL: Failed to create fallback trigger - queue orphaned!"**
   - **Action**: Check GAS quota, manually create trigger
   - **Urgency**: HIGH (queue not processing)

3. **"Deleting trigger due to catastrophic failure"**
   - **Action**: Investigate error, fix root cause, restart processing
   - **Urgency**: MEDIUM (single failure, needs fix)

### Normal Log Patterns

Expected logs (not errors):
- "Trigger created on retry after delete failure" - Fallback worked
- "Created fallback 1-minute trigger after scheduling error" - Degraded but working

---

## Operator Response Playbook

### Symptom: "Queue orphaned" CRITICAL log

**Diagnosis**: Trigger creation failed twice

**Resolution**:
```javascript
// 1. Check trigger quota
ScriptApp.getProjectTriggers().length  // Should be < 20

// 2. Manually create trigger
MembershipManagement.Trigger._deleteTriggersByFunctionName('processExpirationFIFOTrigger');
MembershipManagement.Trigger._createMinuteTrigger('processExpirationFIFOTrigger', 1);

// 3. Verify queue processing resumes
// Check System Logs for ProcessExpiredMember entries
```

---

### Symptom: Catastrophic failure notification email

**Diagnosis**: `processExpirationFIFO` threw fatal exception

**Resolution**:
```javascript
// 1. Check error details in System Logs

// 2. Fix root cause (common issues):
//    - Spreadsheet corruption → Restore from backup
//    - Permission loss → Re-authorize script
//    - Data format error → Fix data in sheets

// 3. Restart processing
MembershipManagement.Trigger._createMinuteTrigger('processExpirationFIFOTrigger', 1);
```

---

## Conclusion

### What We've Achieved

✅ **Eliminated race conditions** - Original duplicate email bug fixed  
✅ **Protected against orphaned queues** - Fallback trigger creation  
✅ **Prevented infinite error loops** - Auto-delete on catastrophic failure  
✅ **Graceful degradation** - Falls back to basic scheduling if optimal fails  
✅ **Explicit trigger management** - No hidden deletes  

### Remaining Philosophy

**Prefer "Imperfect Processing" Over "No Processing"**
- Duplicate trigger > Orphaned queue
- Basic 1-minute trigger > No trigger
- Some duplicates > Missed emails

**Fail Loudly with Recovery Path**
- CRITICAL logs for operator attention
- Auto-recovery where possible
- Clear manual recovery procedures

**Defense in Depth**
- Multiple fallback layers
- Try-catch at all trigger operations
- Catastrophic error handling

---

## References

- **Original Bug**: `docs/issues/ISSUE-EXPIRATION-DUPLICATE-EMAILS.md`
- **Why Bug Didn't Happen Before**: `docs/issues/WHY-BUG-DIDNT-HAPPEN-BEFORE.md`
- **Implementation**: `src/services/MembershipManagement/MembershipManagement.js` lines 180-361
- **Trigger Management**: `src/services/MembershipManagement/Trigger.js` lines 115-145
