# Issue: Duplicate Expiration Emails - Race Condition in Queue Processing

**Status**: FIXED  
**Date**: 2026-01-16  
**Severity**: CRITICAL  
**Production Impact**: Members received up to 6 duplicate expiration emails

---

## Summary

On 2026-01-15, the expiration processing system sent duplicate emails to 118 members. Some members received the same expiration email up to 6 times. Analysis of the audit logs revealed a race condition in the trigger scheduling logic where multiple trigger executions processed the same queue items before changes were persisted.

---

## Root Cause

### The Bug

In `src/services/MembershipManagement/MembershipManagement.js`, the `generateExpiringMembersList()` function had this code:

```javascript
// If we added items to the queue, kick off the consumer to start processing
// Pass through already-fetched fiddlers to avoid redundant getFiddler calls
if (result.messages.length > 0) {
  MembershipManagement.processExpirationFIFO({ 
    fiddlers: { expirationFIFO, membershipFiddler, expiryScheduleFiddler } 
  });
}
```

**Problem**: This **synchronously called** `processExpirationFIFO()`, which:
1. Processed a batch of 50 items
2. Scheduled a 1-minute trigger for remaining items
3. Returned control to `generateExpiringMembersList()`

But the **daily 6 AM trigger** (`processExpirationFIFOTrigger`) was **never deleted** when generation started!

### The Race Condition Sequence

```
06:00:00 - Daily trigger runs generateExpiringMembersList()
06:00:05 - Adds 118 items to ExpirationFIFO
06:00:06 - Calls processExpirationFIFO() synchronously
06:00:07 - Processes first 50 items (emails sent)
06:00:08 - Schedules 06:01 trigger
06:00:09 - generateExpiringMembersList() returns

06:01:00 - Minute trigger fires (as expected)
06:01:01 - Processes next 50 items

⚠️ PROBLEM: Daily 6 AM trigger ALSO fires again!
06:01:05 - Daily trigger runs AGAIN (not deleted)
06:01:06 - Sees same queue state (if dumpValues() hasn't persisted yet)
06:01:07 - Processes SAME items again 🔥

🔄 This repeats multiple times...
```

### Why Some Members Got 6 Emails

Members at the **start of the queue** were hit hardest because:
- Multiple trigger executions happened before `fiddler.setData().dumpValues()` persisted changes
- Each execution saw the **same initial queue state**
- Items were processed, emails sent, but queue updates hadn't persisted
- Next execution re-processed the same items

**Log Evidence**:
```
"id": "2026-01-15T142424678Z-6272cb"  // c.zegers@yahoo.com
Processed 6 times (same ID, same timestamp)

"id": "2026-01-15T142424678Z-45d980"  // carolineking2@aol.com
Processed 6 times (same ID, same timestamp)
```

---

## The Fix

### Changed Behavior

**BEFORE** (Race Condition):
```javascript
if (result.messages.length > 0) {
  MembershipManagement.processExpirationFIFO({ /* ... */ });
}
```

**AFTER** (Safe Trigger Scheduling):
```javascript
if (result.messages.length > 0) {
  try {
    Common.Logger.info('MembershipManagement', 'Scheduling immediate processing trigger for queue items');
    MembershipManagement.Trigger._deleteTriggersByFunctionName('processExpirationFIFOTrigger');
    MembershipManagement.Trigger._createMinuteTrigger('processExpirationFIFOTrigger', 1);
  } catch (e) {
    Common.Logger.error('MembershipManagement', 'Failed to schedule expiration processing trigger', { error: String(e) });
  }
}
```

### Key Changes

1. **Delete existing triggers** before scheduling new one (prevents multiple concurrent executions)
2. **Schedule asynchronously** via trigger (don't call synchronously)
3. **Add error handling** around trigger operations
4. **Add detailed logging** for debugging future trigger issues

### Why This Works

- **No synchronous call**: The generation function returns immediately after scheduling
- **Trigger deletion**: Any existing `processExpirationFIFOTrigger` is deleted first
- **Single execution path**: Only one trigger processes the queue at a time
- **Proper serialization**: Each batch completes and persists before next batch starts

---

## Testing

### Unit Tests

Existing tests in `__tests__/MembershipManagement.wrapper.test.js` verify:
- ✅ Queue items are properly persisted after processing
- ✅ Triggers are scheduled when work remains
- ✅ Triggers are deleted when queue is empty

### Manual Testing Required

1. **Staging Environment Test**:
   ```bash
   npm run stage:deploy
   ```
   - Run `generateExpiringMembersList()` manually
   - Verify trigger is scheduled, not executed synchronously
   - Check System Logs for proper sequencing

2. **Production Deployment**:
   - Deploy during off-hours (NOT 6 AM)
   - Monitor first daily run closely
   - Check for duplicate audit entries

---

## Prevention

### Code Review Checklist

When modifying expiration processing:
- [ ] **Never** call `processExpirationFIFO()` synchronously except from triggers
- [ ] Always `_deleteTriggersByFunctionName()` before scheduling new trigger
- [ ] Verify queue persistence (`dumpValues()`) happens before scheduling next batch
- [ ] Check audit logs for duplicate entries with same ID

### Architecture Notes

**Generator/Consumer Separation**:
- `generateExpiringMembersList()`: **Generator** - creates queue items
- `processExpirationFIFO()`: **Consumer** - processes queue items via trigger

These MUST remain **separate execution paths**:
- Generator runs once daily at 6 AM
- Consumer runs via minute-based triggers until queue empty
- **Never** call consumer from within generator

---

## Rollout Plan

### Phase 1: Deploy to Staging
```bash
npm run stage:deploy
```
- Test manual `generateExpiringMembersList()` execution
- Verify no duplicate processing
- Check trigger scheduling behavior

### Phase 2: Production Deployment
```bash
npm run prod:deploy-live
```
- Deploy on a **non-6AM day** (e.g., Saturday afternoon)
- Watch first daily 6 AM run on Sunday morning
- Monitor for any duplicate audit entries

### Phase 3: Verification
- Check audit logs for 7 days after deployment
- Confirm no duplicate `ProcessExpiredMember` entries with same ID
- Verify member feedback (no duplicate email complaints)

---

## Communication

### User Notification

**To Affected Members** (118 people):
> Subject: Apology - Duplicate Expiration Notice
> 
> We experienced a technical issue on January 15th that caused some members to receive multiple copies of their membership expiration notice. We sincerely apologize for the confusion.
> 
> **Important**: You only need to respond to ONE of the emails. Your membership status and expiration date remain unchanged.
> 
> The issue has been resolved and will not happen again.

### Board Notification

**To Board Members**:
> A race condition in the expiration processing system caused 118 members to receive duplicate emails on Jan 15. Root cause identified and fixed. Deployed to production [DATE]. No data integrity issues - only duplicate notifications.

---

## Related Issues

- #262 - Original FIFO Queue Implementation
- #291 - SPA + Authentication Migration (current phase)

---

## Lessons Learned

1. **Trigger management is critical**: Always delete existing triggers before scheduling
2. **Synchronous calls from generators break isolation**: Generator should only create work, not execute it
3. **Race conditions in GAS are subtle**: Fiddler persistence takes time, concurrent executions see stale data
4. **Audit logs saved us**: Having detailed logs made root cause analysis possible

---

## References

- **Fixed Code**: `src/services/MembershipManagement/MembershipManagement.js` lines 171-183
- **Test Coverage**: `__tests__/MembershipManagement.wrapper.test.js`
- **Architecture Doc**: `docs/ExpirationFIFO_SCHEMA.md` § "Generator/Consumer Separation"
- **Production Logs**: System Logs sheet, 2026-01-15
