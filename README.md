# SCCCC Management

This repository contains the SCCCC membership management code.

## Expiration FIFO — Generator / Consumer contract

The expiration processing is split into two parts:

- Generator (pure JS, tested): `Manager.generateExpiringMembersList` — inspects `ActiveMembers` and `ExpirySchedule` and returns an array of human-friendly messages (no side-effects). These messages are persisted by the GAS wrapper into the `ExpirationFIFO` sheet.
- Consumer (pure JS, tested): `Manager.processExpiredMembers(expiredMembers, sendEmailFun, groupRemoveFun, opts)` — accepts a batch of expired items and applies side-effects via injected functions. It returns an object with:
	- `processed`: number of items successfully completed
	- `failed`: minimal, human-friendly array of failed items (stable shape used by tests/logging). Each failed object: `{ email, subject, htmlBody, groups, attempts, lastError }`.
	- `failedMeta`: machine-friendly array containing retry bookkeeping for persistence by the GAS wrapper. Each meta object: `{ __fifoId?, id?, attempts, lastAttemptAt (ISO), lastError, nextRetryAt (ISO or ''), dead (boolean) }`.

Notes:
- Manager is authoritative for retry/backoff decisions. The GAS wrapper should persist `failedMeta` into the FIFO and move items to the dead-letter sheet when `dead` is true.
- The wrapper is responsible only for GAS operations (sheet I/O, triggers, MailApp/AdminDirectory). Business logic remains in the pure-JS `Manager` for testability.

SCCCC Management
