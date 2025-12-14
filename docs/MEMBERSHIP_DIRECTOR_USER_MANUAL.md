# SCCCC Membership Database User Manual

**For:** Membership Director  
**Version:** 1.3.0  
**Last Updated:** December 14, 2025

---

## Table of Contents

1. [Overview](#overview)
2. [The Members Database](#the-members-database)
3. [How Transactions Become Members](#how-transactions-become-members)
4. [Membership Expiration System](#membership-expiration-system)
5. [Monitoring and Troubleshooting](#monitoring-and-troubleshooting)
6. [Menu Operations](#menu-operations)
7. [Understanding the Audit Log](#understanding-the-audit-log)
8. [Properties Sheet](#properties-sheet)
9. [Common Questions](#common-questions)

---

## Overview

The SCCCC membership system automatically manages member lifecycles from payment through expiration. This manual explains how the system works in business terms, so you can understand what's happening and intervene when needed.

### Key Principle: Automation with Oversight

The system is designed to **automate routine tasks** while **alerting you to exceptions**. Most of the time, it runs without intervention. When manual action is needed, you'll find clear evidence in the **Expiration Dead Letter** sheet or **Audit Log**.

---

## The Members Database

### What It Is

The **Members** sheet (sometimes called **ActiveMembers** in technical documentation) is the authoritative record of all current and past SCCCC members. Each row represents one membership period for one person.

### Key Fields

| Field | What It Means | Examples |
|-------|---------------|----------|
| **Email** | Unique identifier for the member | john.doe@example.com |
| **Status** | Current state | Active, Expired, Migrated |
| **First / Last** | Member name | John Doe |
| **Phone** | Contact number | (408) 555-1234 |
| **Joined** | When this membership period started | 01/15/2024 |
| **Expires** | When membership ends | 01/15/2025 |
| **Period** | Length of their current membership, in years | 2 |
| **Renewed On** | Last renewal date | 12/15/2024 |
| **Directory Share** | What they've opted to share publicly | Name/Email/Phone checkboxes |

### How Rows Work

- **One row = One membership period**
- When someone renews, we **update their existing row** (incrementing the year of their Expires date by Period years)
- When someone joins after being expired, we **create a new row** (Expires set to today + Period years)
- **Duplicate rows** indicate the same person joined, expired, then joined again later

---

## How Transactions Become Members

### The Transaction Flow

```
Payment Form → Transactions Sheet → System Processing → Members Sheet + Confirmation Email
```

**Step-by-step:**

1. **Member fills out payment form** → New row appears in **Transactions** sheet
2. **Payment processes** → Status changes from "Pending" to "Paid"
3. **System runs "Process Transactions"** → Creates/updates member record
4. **Member receives confirmation email** → Welcome email (new) or renewal confirmation (existing)

### When Transactions Are Processed

**Automatic Processing:**
- System checks for new paid transactions every 1-5 minutes after form submission
- Trigger backs off to hourly after 6 minutes of no new activity

**Manual Processing:**
- Use menu: **Membership Management > Process Transactions**
- Useful when you want to force immediate processing

### What Processing Does

**For new members** (email not found in Members sheet):
1. Creates new row in Members sheet
2. Sets Status = "Active"
3. Sets Period = number of years they purchased
4. Sets Joined = today, Expires = today + Period years
5. Adds member to Google Groups (using groups from `Public Groups` spreadsheet with `subscription` set to `auto`)
6. Sends welcome email
7. Creates entries in **Expiry Schedule** for future expiration notices

**For renewals** (email found, Active status):
1. Updates existing row
2. Sets Period to the number of years they purchased
3. Extends Expires date by Period years
4. Sets "Renewed On" = today
5. Sends renewal confirmation email
6. Updates **Expiry Schedule** with new expiration dates

---

## Membership Expiration System

### The Three-Sheet System

The expiration system uses three sheets to manage the lifecycle:

```
Expiry Schedule → Expiration Queue → Expiration Dead Letter
  (future)         (processing)       (failed)
```

---

### 1. Expiry Schedule

**Purpose:** Calendar of upcoming expiration notifications

**How It Works:**
- When someone joins or renews, the system creates **4 schedule entries**:
  - **Expiry1**: 30 days before expiration → "Your membership expires soon"
  - **Expiry2**: 7 days before expiration → "Final reminder"
  - **Expiry3**: On expiration day → "Your membership has expired"
  - **Expiry4**: 7 days after expiration → "You've been removed from groups"

**What You See:**
- Each row has: Date, Type (Expiry1-4), Email
- Sorted by date (soonest last)
- Rows disappear as they're processed

**Example:**
```
Date       | Type    | Email
-----------|---------|------------------
2025-02-01 | Expiry1 | john@example.com
2025-02-23 | Expiry2 | john@example.com
2025-03-01 | Expiry3 | john@example.com
2025-03-08 | Expiry4 | john@example.com
```

---

### 2. Expiration Queue

**Purpose:** Processing queue with retry logic for expiration emails and group removals

**How It Works:**
1. **Daily at 6:00 AM**, system runs `Process Expirations`
2. Finds schedule entries due today or earlier
3. Moves them to **Expiration Queue** for processing
4. A background process works through the queue (up to 50 items per run)
5. If an action fails (email bounces, group removal error), item stays in queue for retry
6. After 5 failed attempts, item moves to **Expiration Dead Letter**

**Key Fields:**

| Field | What It Means |
|-------|---------------|
| **memberEmail** | Who this expiration is for |
| **memberName** | For easy human reference |
| **actionType** | `notify-only` (just email) or `notify+remove` (email + remove from groups) |
| **attempts** | How many times we've tried (0-5) |
| **lastError** | What went wrong on last attempt |
| **nextAttemptAt** | When to try again (blank = try now) |
| **status** | `pending` (waiting), `processing` (in progress), `dead` (moved to dead letter) |

**Normal Flow:**
- Items appear in queue
- Process within seconds to minutes
- Disappear when successful

**Problem Flow:**
- Item fails (email bounce, group error)
- `attempts` increments
- `nextAttemptAt` set to future time (exponential backoff: 5 min → 15 min → 45 min → 2 hr → 6 hr)
- Item retried later
- After 5 failures → moved to **Expiration Dead Letter**

---

### 3. Expiration Dead Letter

**Purpose:** Failed expiration actions requiring manual intervention

**How It Works:**
- Items that fail 5 times are **automatically moved here**
- Status is always `dead`
- System sends alert email to `membership-automation@sc3.club`

**Common Failure Reasons:**

| Error | Meaning | Fix |
|-------|---------|-----|
| "Email bounce" | Member's email is invalid | Update email in Members sheet, send manual email |
| "Group not found" | Google Group doesn't exist | Check group settings, add member manually if needed |
| "Permission denied" | Automation account lacks permissions | Check group ownership/manager status |
| "Member already removed" | Already removed from group | No action needed, mark as resolved |

**Your Action:**
1. Review items weekly (or when alert email received - *not yet implemented*)
2. Fix underlying issue (update email, fix group permissions, etc.)
3. Take manual action (send email, remove from group) as needed
4. **Leave row in sheet** for audit trail (don't delete)
5. Add note in `note` column explaining resolution

---

### How Expiration Processing Runs

**Automatic (Daily at 6:00 AM):**
1. System checks **Expiry Schedule** for due dates
2. Generates **Expiration Queue** entries
3. Background process works through queue (50 items per batch)
4. Retries failures automatically
5. Moves persistent failures to **Dead Letter** (future - send email to **Membership Director**)

**Manual (Menu Item):**
- **Membership Management > Process Expirations**
- Useful when:
  - You've just added a renewal and want to update schedule
  - You want to force processing outside normal 6:00 AM run
  - Testing after making configuration changes

**What Happens in Each Expiry Type:**

| Type | Days from Expiration | Email Sent? | Group Removal? | Status Change? |
|------|---------------------|-------------|----------------|----------------|
| Expiry1 | -30 days | ✅ Warning | ❌ No | ❌ No |
| Expiry2 | -7 days | ✅ Final reminder | ❌ No | ❌ No |
| Expiry3 | 0 days (expiry date) | ✅ Expired notice | ❌ No | ❌ No |
| Expiry4 | +7 days | ✅ Removal notice | ✅ **Yes** | ✅ **Status → Expired** |

**Only Expiry4 changes membership status and removes from groups.**

---

## Monitoring and Troubleshooting
* To be automated in the future *

### Daily Tasks (5 minutes)

**1. Check Expiration Dead Letter**
- Open **Expiration Dead Letter** sheet
- If empty → All good! ✅
- If has rows → Review `lastError` and take action

**2. Check Audit Log (Recent Failures)**
- Open **Audit Log** sheet
- Filter: **Outcome = fail**, **Timestamp = last 24 hours**
- Review any failures, cross-reference with Dead Letter

**3. Check for Pending Payments**
- Open **Transactions** sheet
- Filter: **Status = Paid**, **Processed = blank**
- If any rows → Run **Membership Management > Process Transactions**

### Weekly Tasks (15 minutes)
**1. Review Expiration Queue Health**
- Open **Expiration Queue** sheet
- Check for items with `attempts > 2` (approaching dead letter)
- Proactively fix issues before they hit dead letter

**2. Verify Group Membership**
- Spot-check: Pick a random active member
- Verify they're in Google Groups (check group member list)
- If missing → Add manually, check automation logs

**3. Review Audit Log Trends**
- Open **Audit Log** sheet
- Create pivot table: Type (rows) × Outcome (columns)
- Look for unusual patterns (e.g., high failure rate for Renew)

### Monthly Tasks (30 minutes)

**1. Data Quality Check**
- **Members sheet:**
  - Any duplicate emails with Status = Active? (Should only be one)
  - Any missing phones? (Affects renewal matching)
  - Any invalid email formats?
  
**2. Schedule Health Check**
- **Expiry Schedule sheet:**
  - Verify all Active members have 4 schedule entries (Expiry1-4)
  - Check for orphaned entries (member no longer Active)

**3. Clean Up Dead Letter**
- Review resolved items in **Expiration Dead Letter**
- Add resolution notes to `note` column
- Do NOT delete rows (keep for audit trail)

---

## Menu Operations

### Membership Management Menu

Located in spreadsheet menu bar: **Membership Management**

---

#### Process Transactions

**What:** Processes paid transactions into member records  

**When to use:**
- After manual payment entry
- When automatic processing seems delayed
- To force immediate processing

**What happens:**
- Creates new members or renews existing
- Sends confirmation emails
- Updates Expiry Schedule
- Writes to Audit Log

**Time:** 30 seconds to 2 minutes (depends on volume)

---

#### Process Expirations

**What:** Generates expiration queue entries for due dates  

**When to use:**
- To manually trigger expiration processing (normally runs at 6:00 AM)
- After making changes to Expiry Schedule
- Testing configuration changes

**What happens:**
- Finds schedule entries due today or earlier
- Creates entries in **Expiration Queue**
- Kicks off background processing automatically

**Time:** 10-30 seconds

**Important Note:** This does NOT send emails directly. It creates queue entries that are processed by background triggers within minutes.

---

#### Find Possible Renewals

**What:** Analyzes members for potential duplicate accounts  

**When to use:**
- Quarterly data quality check
- When member reports "I renewed but system says I'm new"

**What happens:**
- Scans Members sheet for join records with similar identities (name, phone, email) where one Joins before the other Expires
- Suggests these as possible renewals in popup dialog

**What you do:**
1. Review suggested pairs
2. If confirmed duplicate, select both rows in Members sheet
3. Run **Merge Selected Members** menu item

**Time:** 30 seconds to 1 minute

---

#### Merge Selected Members

**What:** Combines two member rows into one renewal  

**When to use:**
- After finding duplicates with "Find possible renewals"
- When manually identifying member paid twice

**Prerequisites:**
- Must select **exactly 2 rows** in Members sheet
- Rows must have **shared identity** (names match, and either email or phone match)

**What happens:**
1. Validates rows share identity
2. Determines which is "initial" (earlier Joined) and "latest" (later Joined)
3. Converts "latest" join into renewal:
   - Keeps "initial" Joined date
   - Uses "latest" Expires date
   - Increments Period appropriately
   - Merges directory sharing preferences
4. Removes duplicate row
5. Updates Expiry Schedule
6. Writes to Audit Log

**Example:**
```
BEFORE:
Row 1: john@example.com, Joined 2023-01-01, Expires 2024-01-01, Period 1
Row 7: john@example.com, Joined 2024-01-01, Expires 2025-01-01, Period 1

AFTER:
Row 1: john@example.com, Joined 2023-01-01, Expires 2025-01-01, Period 2
Row 7: (deleted)
```

**Time:** 5-10 seconds

---

#### Process Migrations
**Deprecated - to be removed**

**What:** Bulk imports members from old system  

**When to use:**
- One-time migration from previous membership database
- Importing members from external source

**Prerequisites:**
- MigratingMembers sheet must exist
- Sheet must have required columns
- Each row must have `Migrate Me = TRUE` and `Migrated = blank`

**What happens:**
- Processes each flagged row
- Creates member record in Members sheet
- Sets Status = "Migrated"
- Adds to Google Groups
- Marks row as processed (sets Migrated = today)
- Writes to Audit Log

**Time:** 1-2 minutes per 50 members

**Note:** This is a specialized operation typically used once during initial system setup.

---

## Understanding the Audit Log

### What Is It?

The **Audit Log** is a permanent record of **business events**—things that happened to memberships:
- Someone joined
- Someone renewed
- Someone's membership expired
- Someone was removed from groups
- A migration completed

### Why It Matters

The Audit Log answers:
- **"What happened?"** → Type + Note columns
- **"When did it happen?"** → Timestamp column
- **"Did it work?"** → Outcome column (success/fail)
- **"Who was affected?"** → Email column
- **"Why did it fail?"** → Error column

---

### Audit Log Schema

| Column | What It Contains | Examples |
|--------|------------------|----------|
| **Timestamp** | When event occurred | 2025-03-01 14:23:45 |
| **Type** | Kind of business event | Join, Renew, Expiry1-4, ProcessTransaction |
| **Outcome** | Success or failure | success, fail |
| **Email** | Member affected | john.doe@example.com |
| **Note** | Human-readable description | "Member joined: john.doe@example.com" |
| **Error** | Error message (if failed) | "Email bounce: user not found" |
| **Details** | JSON data for debugging | `{"from": "old@example.com", "to": "new@example.com"}` |

---

### Common Audit Event Types

#### Membership Lifecycle Events

| Type | Means | When It Appears |
|------|-------|-----------------|
| **Join** | New member joined | After processing new paid transaction |
| **Renew** | Existing member renewed | After processing renewal transaction |
| **Migrate** | Member imported from old system | During bulk migration |

#### Expiration Events

| Type | Means | Email Sent? |
|------|-------|-------------|
| **Expiry1** | 30-day warning sent | ✅ Yes |
| **Expiry2** | 7-day final reminder sent | ✅ Yes |
| **Expiry3** | Expiration notice sent | ✅ Yes |
| **Expiry4** | Removed from groups | ✅ Yes (removal notice) |

#### Processing Events

| Type | Means | When It Appears |
|------|-------|-----------------|
| **ProcessTransaction** | Transaction processing (success or fail) | Every transaction attempt |

---

### How to Use Audit Log for Troubleshooting

#### Scenario 1: "Member says they renewed but are still getting expiration emails"

**Steps:**
1. Open **Audit Log**
2. Filter: **Email = member's email**, **Type = Renew**
3. Look for recent Renew entry with **Outcome = success**
4. If found → Renewal worked, check Expiry Schedule for correct dates
5. If not found → Check Transactions sheet, see if payment processed

---

#### Scenario 2: "Member says they never received confirmation email"

**Steps:**
1. Open **Audit Log**
2. Filter: **Email = member's email**, **Type = Join or Renew**
3. Check **Outcome** column:
   - **success** → Email was sent, check member's spam folder
   - **fail** → Check **Error** column for reason (e.g., "Email bounce")

---

#### Scenario 3: "Multiple members reporting expiration issues"

**Steps:**
1. Open **Audit Log**
2. Filter: **Type = Expiry4**, **Outcome = fail**, **Timestamp = last 7 days**
3. Look for patterns in **Error** column:
   - Same error for all? → System-wide issue (e.g., "Permission denied" → check group permissions)
   - Different errors? → Individual member issues

4. Cross-reference with **Expiration Dead Letter** for current status

---

#### Scenario 4: "Need to prove when someone's membership expired"

**Steps:**
1. Open **Audit Log**
2. Filter: **Email = member's email**, **Type = Expiry3 or Expiry4**
3. **Expiry3 Timestamp** = official expiration date
4. **Expiry4 Timestamp** = when removed from groups

---

### Audit Log Best Practices

**Do:**
- ✅ Check weekly for failure trends
- ✅ Export to CSV for long-term archival (monthly)
- ✅ Use filters to answer specific questions
- ✅ Reference Timestamp when communicating with members

**Don't:**
- ❌ Delete rows (permanent record)
- ❌ Manually edit entries
- ❌ Rely solely on Audit Log for current status (use Members sheet for that)

---

## Properties Sheet

### What Is It?

The **Properties** sheet contains system configuration values. Think of it as the "settings" panel for the automation.

### Key Properties You Might Adjust

| Property | What It Does | Typical Values |
|----------|--------------|----------------|
| **testEmails** | Testing mode for emails | FALSE (production), TRUE (testing) |
| **testGroupAdds** | Testing mode for group additions | FALSE (production), TRUE (testing) |
| **testGroupRemoves** | Testing mode for group removals | FALSE (production), TRUE (testing) |
| **expirationBatchSize** | How many expiration emails per batch | 50 (default), 1 (testing) |
| **expirationMaxAttempts** | Max retries before dead letter | 5 (default) |
| **loggerLevel** | Detail of logging | INFO (normal), DEBUG (verbose), ERROR (critical only) |

### When to Change Properties

**For Testing:**
- Set `testEmails=TRUE` before running "Process Expirations" on test data
- Set `expirationBatchSize=1` to process expirations one at a time

**For Troubleshooting:**
- Set `loggerLevel=DEBUG` to get detailed logs in System Logs sheet
- Set back to `INFO` after troubleshooting (DEBUG is very verbose)

**For Production:**
- Ensure all `test*` properties are FALSE
- Ensure `expirationBatchSize=50` for normal throughput

---

## Common Questions

### "How do I know if expirations are running?"

Check **Expiration Queue** sheet:
- Empty or very few rows → System is processing normally ✅
- Many rows with `status=pending` → Queue is backed up, check System Logs
- Many rows with high `attempts` → Failures occurring, check Dead Letter

### "What if a member renews right after I process expirations?"

No problem! The system:
1. Processes renewal (updates Members sheet, Expiry Schedule)
2. Removes old expiration queue entries for that member
3. Creates new schedule entries with updated dates

### "Can I manually remove someone from the expiration queue?"

**Yes, but not recommended.** Better to:
1. Process their renewal if they paid
2. Let the system move failed items to Dead Letter
3. Fix underlying issue (email, group permissions)

If you must remove manually:
- Delete row from **Expiration Queue** sheet
- Add note in **Audit Log** manually (Type=Manual, Note=why you removed it)

### "How long do items stay in Dead Letter?"

**Forever** (for audit trail). Dead Letter is an archive, not a queue. Items aren't automatically removed. You can:
- Add resolution notes in `note` column
- Leave rows indefinitely for historical reference
- Export to CSV and clear sheet if it gets too large (annually)

### "What if I need to re-send an expiration email?"

**Option 1: Let system retry**
- If item is in **Expiration Queue** with `attempts < 5`, it will retry automatically
- Fix underlying issue (update email address), wait for next retry

**Option 2: Manual email**
- Copy email content from queue item's `emailBody` field
- Send manually from your email client
- Mark item in queue as `status=dead` to stop retries
- Add note in Dead Letter explaining manual send

---

## Getting Help

### Self-Service (Start Here)

1. **Check Audit Log** for event history
2. **Check Expiration Dead Letter** for failed actions
3. **Check System Logs** for technical errors
4. **Review this manual** for how system works

### When to Escalate

Escalate to technical support if:
- System Logs show repeated ERROR entries
- Expiration Queue is backing up (>100 pending items)
- Dead Letter is growing rapidly (>10 new items per day)
- Menu items are failing consistently

**Provide this info when escalating:**
- Screenshot of Audit Log (filtered to relevant emails/dates)
- Screenshot of System Logs (ERROR level, last 24 hours)
- Description of what you expected vs. what happened

---

## Quick Reference Card

| Task | Where to Look | Action |
|------|---------------|--------|
| Check for failed expirations | Expiration Dead Letter | Review, fix, document |
| See if member renewed | Audit Log (filter by email) | Look for "Renew" entry |
| Process pending payments | Run "Process Transactions" menu | Takes 1-2 minutes |
| Find duplicate members | Run "Find possible renewals" menu | Review suggestions |
| Check system health | System Logs (ERROR level) | Look for repeated issues |
| Manual expiration trigger | Run "Process Expirations" menu | Creates queue entries |

---

**Prepared for:** Membership Director  
**Version:** 1.3.0  
**Last Updated:** December 14, 2025  
**Next Review:** June 2026
