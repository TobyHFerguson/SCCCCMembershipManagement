Expiration FIFO schema

This document records the canonical schema for the ExpirationFIFO and ExpirationDeadLetter sheets used by the MembershipManagement expiration pipeline.

Purpose
- ExpirationFIFO: durable queue of planned expiration messages; processed by a minute trigger calling `MembershipManagement.processExpirationFIFO`.
- ExpirationDeadLetter: archive of messages that exceeded retry limits (manual operator review required).

Canonical FIFO row schema (columns, data types, description)

- id (string): unique identifier for the FIFO row (e.g. ISO timestamp + random suffix). Primary key for mapping back to manager failures.
- createdAt (ISO string): timestamp when the row was created.
- status (string): 'pending' | 'dead' | 'processing' — current lifecycle state. Wrapper will set 'dead' for dead-lettered rows.
- memberEmail (string): canonical member email addressed by this plan.
- memberName (string): human readable name for operator context.
- expiryDate (YYYY-MM-DD string): the member's expiry date for operator convenience.
- actionType (string): 'notify-only' | 'notify+remove' or other action types if extended.
- groups (string): comma-separated group email addresses to remove the member from (if actionType includes removal).
- emailTo (string): recipient email address for the planned message (usually same as memberEmail).
- emailSubject (string): fully-expanded email subject.
- emailBody (string): fully-expanded HTML body for the email.
- attempts (number): integer count of attempts already made to process this row.
- lastAttemptAt (Date in spreadsheet / ISO string internally): timestamp of the most recent attempt. Stored as a Date object in the spreadsheet (displays in user's timezone), converted to ISO string for Manager processing.
- lastError (string): short error message recorded from the last attempt.
- nextAttemptAt (Date in spreadsheet / ISO string internally): timestamp when the row becomes eligible for the next attempt; empty string means immediately eligible. Stored as a Date object in the spreadsheet (displays in user's timezone), converted to ISO string for Manager processing.
- maxAttempts (number or empty): per-row max attempts if provided; otherwise wrapper uses script-level default (see properties).
- note (string): free-text operator note field.

Note on timestamp storage:
- In the spreadsheet: `lastAttemptAt` and `nextAttemptAt` are stored as JavaScript Date objects, which Google Sheets displays in the user's local timezone for easy human readability.
- Internally (Manager processing): These fields are converted to ISO string format (e.g., "2025-11-21T10:30:00.000Z") for consistent testing and processing.
- The conversion is handled automatically by the wrapper layer (`MembershipManagement.processExpirationFIFO`).

Canonical Dead-Letter row schema
- same columns as FIFO rows, but `status` MUST be 'dead'. Dead-letter rows are appended to `ExpirationDeadLetter` for operator review.

Script properties and defaults
- expirationBatchSize: number of FIFO rows processed per invocation (default 50)
- expirationMaxAttempts or maxAttempts: default maximum attempt count (default 5)
- logging: 'true' or 'false' — enables detailed logging

Manager / Wrapper contract
- Manager.generateExpiringMembersList: returns an array of generated messages (pure JS, no side-effects). Wrapper maps these messages into FIFO rows.
- Manager.processExpiredMembers: consumer function that accepts an array of normalized messages and injected side-effect functions (sendEmailFun, groupRemoveFun). MUST return an object with at least:
  - processed (number)
  - failed (human-friendly minimal failed items for logs/testing)
  - failedMeta (array) — machine-facing metadata for each failed item, where each metadata object includes:
    - __fifoId or id (string) — original FIFO id
    - id (string)
    - attempts (number)
    - lastAttemptAt (ISO string)
    - lastError (string)
    - nextAttemptAt (ISO string)
    - dead (boolean)
  The wrapper is authoritative for persistence and will rely on `failedMeta` to update `attempts`, `nextAttemptAt` and to move rows to the dead-letter sheet when `dead` is true.

Idempotency
- Manager actions (email send, group removal) should be implemented to be idempotent where possible. The wrapper handles retry bookkeeping; the Manager should avoid destructive non-idempotent behavior without guardrails.

Operator guidance
- Operators should periodically check `ExpirationDeadLetter` for items that require manual intervention.
- For testing, run the generator against a test spreadsheet copy and run the wrapper with `opts.dryRun=true` to validate behavior without persisting updates or creating triggers.

Examples
- Row example as stored in spreadsheet (JSON representation):
{
  "id": "20251118T123045-1a2b3c",
  "createdAt": "2025-11-18T12:30:45.123Z",
  "status": "pending",
  "memberEmail": "alice@example.com",
  "memberName": "Alice Example",
  "expiryDate": "2025-11-01",
  "actionType": "notify+remove",
  "groups": "member_discussions@sc3.club,board_announcements@sc3.club",
  "emailTo": "alice@example.com",
  "emailSubject": "Your membership has expired",
  "emailBody": "<p>Hi Alice...</p>",
  "attempts": 0,
  "lastAttemptAt": "",
  "lastError": "",
  "nextAttemptAt": "",
  "maxAttempts": "",
  "note": ""
}

- Row example after failure (with Date objects for timestamps):
{
  "id": "20251118T123045-1a2b3c",
  "createdAt": "2025-11-18T12:30:45.123Z",
  "status": "pending",
  "memberEmail": "alice@example.com",
  "memberName": "Alice Example",
  "expiryDate": "2025-11-01",
  "actionType": "notify+remove",
  "groups": "member_discussions@sc3.club,board_announcements@sc3.club",
  "emailTo": "alice@example.com",
  "emailSubject": "Your membership has expired",
  "emailBody": "<p>Hi Alice...</p>",
  "attempts": 2,
  "lastAttemptAt": new Date("2025-11-21T18:30:00.000Z"),
  "lastError": "Error: Email service temporarily unavailable",
  "nextAttemptAt": new Date("2025-11-21T18:35:00.000Z"),
  "maxAttempts": "",
  "note": ""
}

Note: When displayed in the spreadsheet, the Date objects will show in the user's local timezone.

Contact
- For questions about the contract or schema, see README.md or contact the repository owner.
