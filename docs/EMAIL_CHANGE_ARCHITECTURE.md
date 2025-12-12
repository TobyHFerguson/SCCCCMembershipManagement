# Email Change Architecture

## Overview

Email address changes must be handled consistently across all operations in the system. This document describes the unified architecture for email changes.

## The Three Email Change Paths

### 1. EmailChangeService (User-Initiated)
**Use Case**: Active member wants to change their email address via the web UI

**Flow**:
```
User requests change → Verification code sent → User verifies → Email changed
```

**What it updates**:
- `ActiveMembers` sheet: email field
- `ExpirySchedule` sheet: email field in all entries
- All Google Groups: member email address
- `EmailChange` log sheet: records the change

**Implementation**: `EmailChangeService.Api.handleVerifyAndChangeEmail()`

### 2. processPaidTransactions (Transaction Processing)
**Use Case**: Member renews but uses a different email address than on file

**Flow**:
```
Transaction processed → isPossibleRenewal detects match → Email automatically updated
```

**What it updates**:
- Member record: email field
- `ExpirySchedule` sheet: removes old entries, adds new ones
- All Google Groups: member email address (via `_groupEmailReplaceFun`)

**Implementation**: `MembershipManagement.Manager.processPaidTransactions()` → `renewMemberWithEmailChange_()` → `changeMemberEmail_()`

### 3. convertJoinToRenew (Manual Merge)
**Use Case**: Admin manually merges duplicate member records with different emails

**Flow**:
```
Admin selects two records → convertJoinToRenew merges → Email updated to LATEST
```

**What it updates**:
- Member record: merges INITIAL into LATEST, keeps LATEST email
- `ExpirySchedule` sheet: removes both old entries, adds new ones
- All Google Groups: member email address (via `_groupEmailReplaceFun`)

**Implementation**: `MembershipManagement.Manager.convertJoinToRenew()` → `changeMemberEmail_()`

## Unified Email Change Method

### `changeMemberEmail_(oldEmail, newEmail, member, expirySchedule)`

**Purpose**: Single source of truth for email changes in MembershipManagement

**Critical Execution Order**:

1. **Remove old expiry schedule entries** (indexed by old email)
   - `this.removeMemberFromExpirySchedule_(oldEmail, expirySchedule)`
   
2. **Update groups** (if emails differ)
   - `this._groupEmailReplaceFun(oldEmail, newEmail)`
   - Note: This delegates to `GroupSubscription.changeMembersEmail()` which updates the member's email in all Google Groups
   
3. **Update member record**
   - `member.Email = newEmail`

**Why This Order Matters**:
- Expiry schedule is indexed by email - must remove using OLD email before changing member record
- Groups need both old and new email to perform the swap
- Member record update must be last so subsequent operations see the new email

## Key Differences Between Paths

### EmailChangeService (Email-Only Change)
**Use Case**: User just wants to change their email address - NO membership changes

**Updates**:
- `ActiveMembers` sheet: Changes email field (member's Expires date UNCHANGED)
- `ExpirySchedule` sheet: Changes email field in ALL existing entries (dates UNCHANGED)
- Groups: Updates member email in all Google Groups
- Logging: Writes to `EmailChange` log sheet
- Authentication: Requires verification code

**Critical**: This is a **simple email update** - all expiry dates stay the same, only the email field changes.

### MembershipManagement Paths (Renewal + Email Change)
**Use Case**: Member is renewing AND changing email, or admin is merging duplicate records

**Updates**:
- Member record: Updates email AND Expires date (renewal calculation)
- `ExpirySchedule`: **DELETES all old entries, CREATES new entries** with NEW dates based on new Expires
- Groups: Updates member email in all Google Groups
- Logging: Uses Audit log for renewal events
- Authentication: Transaction processing (automatic), manual merge (admin UI)

**Critical**: This is a **renewal** - the member's expiration date changes, so ALL expiry schedule entries must be recalculated with new dates (Expiry1, Expiry2, Expiry3, Expiry4 based on new Expires date).

## Why The Difference Matters

### Scenario: Member expires on March 1, 2026

**ExpirySchedule before any changes**:
```
Email: john@old.com, Type: Expiry1, Date: Feb 15, 2026 (2 weeks before expiry)
Email: john@old.com, Type: Expiry2, Date: Feb 22, 2026 (1 week before expiry)
Email: john@old.com, Type: Expiry3, Date: Mar 1, 2026 (on expiry date)
Email: john@old.com, Type: Expiry4, Date: Mar 8, 2026 (1 week after expiry)
```

### Path 1: EmailChangeService (just change email)
User changes email from `john@old.com` to `john@new.com` (NO RENEWAL)

**ExpirySchedule after**:
```
Email: john@new.com, Type: Expiry1, Date: Feb 15, 2026  ← Email changed, date SAME
Email: john@new.com, Type: Expiry2, Date: Feb 22, 2026  ← Email changed, date SAME
Email: john@new.com, Type: Expiry3, Date: Mar 1, 2026   ← Email changed, date SAME
Email: john@new.com, Type: Expiry4, Date: Mar 8, 2026   ← Email changed, date SAME
```

### Path 2: processPaidTransactions (renewal + email change)
User renews for 1 year on Feb 1, 2026 using new email `john@new.com`

New expiration: March 1, 2027 (old expiry + 1 year since renewal is before expiry)

**ExpirySchedule after**:
```
Email: john@new.com, Type: Expiry1, Date: Feb 15, 2027  ← RECALCULATED (2 weeks before NEW expiry)
Email: john@new.com, Type: Expiry2, Date: Feb 22, 2027  ← RECALCULATED (1 week before NEW expiry)
Email: john@new.com, Type: Expiry3, Date: Mar 1, 2027   ← RECALCULATED (on NEW expiry date)
Email: john@new.com, Type: Expiry4, Date: Mar 8, 2027   ← RECALCULATED (1 week after NEW expiry)
```

Old entries are **deleted**, new entries are **created** with new dates.

## Implementation Notes

### Dependency Injection
Both `processPaidTransactions` and `convertJoinToRenew` use **injected** `_groupEmailReplaceFun`:

```javascript
constructor(..., groupManager, ...) {
  this._groupEmailReplaceFun = groupManager?.groupEmailReplaceFun || (() => {});
}
```

This allows:
- Testing with mock functions
- Production use with actual `GroupSubscription.changeMembersEmail()`
- Consistent behavior across all email change operations

### EmailChangeService Alignment
The `changeMemberEmail_()` method aligns with EmailChangeService behavior:
1. Both update expiry schedule
2. Both update groups via same underlying function
3. Both update the member/spreadsheet email field

The only difference is **where** the updates are persisted:
- EmailChangeService: Directly to sheets via fiddler (immediate)
- MembershipManagement: To in-memory arrays (persisted later by caller)

## Testing

### Unit Tests
- `Manager.test.js`: Tests email change during renewal (processPaidTransactions)
- `Manager.test.js`: Tests email change during merge (convertJoinToRenew)
- `EmailChangeService.Api.test.js`: Tests EmailChangeService flow

### Key Test Cases
1. Renewal with email change creates single audit entry
2. Expiry schedule removed with OLD email before update
3. Group email replacement called with correct old/new emails
4. convertJoinToRenew handles email change during merge

## Future Considerations

### Potential Unification
Could we create a **shared** email change module used by both services?

**Pros**:
- Single implementation for all email changes
- Guaranteed consistency
- Easier to add features (e.g., email validation, change logging)

**Cons**:
- Different execution contexts (immediate vs deferred persistence)
- Different group update mechanisms (direct vs injected)
- May overcomplicate simple use cases

**Recommendation**: Current architecture is good. The `changeMemberEmail_()` method provides sufficient consistency within MembershipManagement, and EmailChangeService is isolated enough that unification would add complexity without clear benefit.

### Audit Logging
Currently:
- EmailChangeService: Logs to `EmailChange` sheet
- MembershipManagement: Logs renewals to `Audit` sheet (includes email change note)

**Consideration**: Should ALL email changes write to `EmailChange` sheet for central tracking?

**Current Decision**: No. The two services serve different purposes:
- `EmailChange` log: User-initiated explicit email changes
- `Audit` log: Business events including detected email changes during renewals

## Summary

**Three paths for email changes with DIFFERENT purposes**:

### 1. EmailChangeService - Simple Email Update
**"I want a different email address"**
- Changes: Email field ONLY
- ExpirySchedule: Updates email in existing entries, keeps dates UNCHANGED
- Member expiration: UNCHANGED
- Use case: User wants mail sent to different address

### 2. processPaidTransactions - Renewal with Email Change  
**"I'm renewing AND I have a new email"**
- Changes: Email field AND Expires date (renewal)
- ExpirySchedule: DELETES old entries, CREATES new entries with RECALCULATED dates
- Member expiration: CHANGED (renewal calculation)
- Use case: Transaction processing detected renewal via name+phone match

### 3. convertJoinToRenew - Merge Duplicates
**"Admin merging duplicate member records"**
- Changes: Email field AND Expires date (merge/renewal)
- ExpirySchedule: DELETES old entries for BOTH emails, CREATES new entries with RECALCULATED dates
- Member expiration: CHANGED (merge recalculates based on renewal rules)
- Use case: Manual cleanup of duplicate records

**The Unified Part**: All three use `changeMemberEmail_()` or equivalent to:
1. Remove/update expiry schedule entries using OLD email
2. Update member email in all Google Groups  
3. Update member record email field

**The Different Part**: 
- EmailChangeService: Expiry dates stay same (just email field update)
- MembershipManagement: Expiry dates recalculated (renewal changes expiration)
