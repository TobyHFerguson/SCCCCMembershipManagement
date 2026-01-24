/**
 * AuditLogEntry Class
 * 
 * Purpose: Provides type safety and validation for audit log entries.
 * Ensures all audit entries have proper structure and prevents corruption
 * by enforcing construction contracts at the class level.
 * 
 * Layer: Layer 1 Infrastructure (can use AppLogger)
 * 
 * Usage:
 *   const entry = AuditLogEntry.create('transaction', 'success', 'Payment processed');
 *   const validEntries = AuditLogEntry.validateArray(auditEntries, 'processTransactions');
 * 
 * Pattern: IIFE-wrapped class (per gas-best-practices.md)
 */

/**
 * AuditLogEntry class using IIFE-wrapped pattern
 * @class
 */
var AuditLogEntry = (function() {
  /**
   * @param {string} type - The type of audit event (e.g., 'transaction', 'member-update')
   * @param {string} outcome - The outcome ('success', 'fail', 'partial')
   * @param {string} [note] - Human readable description of the event
   * @param {string} [error] - Error message if outcome is 'fail' 
   * @param {string} [jsonData] - Structured data as JSON string
   * @param {Date} [timestamp] - Entry timestamp (defaults to current time)
   */
  class AuditLogEntry {
    constructor(type, outcome, note, error, jsonData, timestamp) {
      // Validate required fields at construction time
      if (typeof type !== 'string' || type.trim() === '') {
        throw new Error(`AuditLogEntry type must be non-empty string, got: ${typeof type} "${type}"`);
      }
      
      if (typeof outcome !== 'string' || outcome.trim() === '') {
        throw new Error(`AuditLogEntry outcome must be non-empty string, got: ${typeof outcome} "${outcome}"`);
      }
      
      // Assign validated properties
      /** @type {Date} */
      this.Timestamp = timestamp instanceof Date ? timestamp : new Date();
      /** @type {string} */
      this.Type = type.trim();
      /** @type {string} */
      this.Outcome = outcome.trim();
      /** @type {string} */
      this.Note = String(note || '').trim();
      /** @type {string} */
      this.Error = String(error || '').trim();
      /** @type {string} */
      this.JSON = String(jsonData || '').trim();  // Use JSON for backward compatibility
    }

    /**
     * Convert audit entry to array format for spreadsheet persistence
     * Expected columns: Timestamp, Type, Outcome, Note, Error, JSON 
     * 
     * @returns {Array<Date|string>} Array with 6 elements matching audit sheet columns
     */
    toArray() {
      return [
        this.Timestamp,
        this.Type,
        this.Outcome,
        this.Note,
        this.Error,
        this.JSON
      ];
    }

    /**
     * Static factory method for safe construction
     * Never throws - returns valid entry or error entry
     * 
     * @param {string} type - Audit event type
     * @param {string} outcome - Event outcome  
     * @param {string} [note] - Event description
     * @param {string} [error] - Error details if any
     * @param {string} [jsonData] - Structured data
     * @param {Date} [timestamp] - Entry timestamp (defaults to current time)
     * @returns {AuditLogEntry} Valid audit entry (may be error entry if construction failed)
     */
    static create(type, outcome, note, error, jsonData, timestamp) {
      try {
        return new AuditLogEntry(type, outcome, note, error, jsonData, timestamp);
      } catch (validationError) {
        AppLogger.error('AuditLogEntry', `Failed to create audit entry: ${validationError.message}`);
        
        // Send alert about audit entry construction failure
        try {
          MailApp.sendEmail({
            to: 'membership-automation@sc3.club',
            subject: 'CRITICAL: Audit Entry Construction Failed',
            body: `Audit entry construction failed at ${new Date().toISOString()}

Error: ${validationError.message}

Attempted parameters:
- type: ${typeof type} "${type}"
- outcome: ${typeof outcome} "${outcome}"  
- note: ${typeof note} "${note}"
- error: ${typeof error} "${error}"

A safe error entry has been created instead to prevent system failure.
Review the calling code for proper audit entry parameter validation.`
          });
        } catch (emailError) {
          AppLogger.error('AuditLogEntry', `Failed to send construction failure alert: ${emailError.message}`);
        }
        
        // Return a safe error entry instead of throwing
        return new AuditLogEntry(
          'audit-construction-error',
          'fail',
          `Original audit entry construction failed: ${validationError.message}`,
          `Attempted: type="${type}", outcome="${outcome}"`,
          '',
          timestamp  // Use the same timestamp that was attempted
        );
      }
    }

    /**
     * Validate an array of audit entries - static validation method
     * Ensures all entries are proper AuditLogEntry instances
     * Replaces invalid entries with error entries to prevent corruption
     * 
     * @param {Array<AuditLogEntry|object>} entries - Array of potential audit entries
     * @param {string} context - Context string for error reporting
     * @returns {Array<AuditLogEntry>} Array of validated AuditLogEntry instances
     */
    static validateArray(entries, context) {
      if (!Array.isArray(entries)) {
        AppLogger.error('AuditLogEntry', `${context}: entries is not an array: ${typeof entries}`);
        
        // Send alert about non-array audit entries
        try {
          MailApp.sendEmail({
            to: 'membership-automation@sc3.club',
            subject: 'CRITICAL: Non-Array Audit Entries',
            body: `Non-array audit entries detected at ${new Date().toISOString()}

Context: ${context}
Expected: Array
Received: ${typeof entries}

Processing will continue with empty audit array to prevent system failure.
Review the ${context} implementation for proper audit entry generation.`
          });
        } catch (emailError) {
          AppLogger.error('AuditLogEntry', `Failed to send non-array alert: ${emailError.message}`);
        }
        
        return [];
      }
      
      /** @type {Array<AuditLogEntry>} */
      const validEntries = [];
      let corruptionDetected = false;
      
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        
        if (!(entry instanceof AuditLogEntry)) {
          corruptionDetected = true;
          AppLogger.error('AuditLogEntry', `${context}: entry ${i} is not an AuditLogEntry instance. Type: ${typeof entry}, Value: ${JSON.stringify(entry)}`);
          
          // Create safe replacement entry
          validEntries.push(AuditLogEntry.create(
            'type-validation-error',
            'fail',
            `Non-AuditLogEntry object detected at index ${i} in ${context}`,
            `Object was: ${JSON.stringify(entry)}`,
            ''
          ));
        } else {
          validEntries.push(entry);
        }
      }
      
      // Send consolidated alert if any corruption detected
      if (corruptionDetected) {
        try {
          MailApp.sendEmail({
            to: 'membership-automation@sc3.club',
            subject: 'CRITICAL: Non-AuditLogEntry Objects Detected',
            body: `Invalid audit entry objects detected at ${new Date().toISOString()}

Context: ${context}
Total entries processed: ${entries.length}
Invalid objects found and replaced with error entries.

THIS INDICATES A BUG IN AUDIT ENTRY GENERATION CODE.

The ${context} code is creating raw objects instead of using AuditLogEntry.create().
Review that code to ensure proper audit entry construction.

Processing continues normally with replacement error entries.`
          });
        } catch (emailError) {
          AppLogger.error('AuditLogEntry', `Failed to send corruption alert: ${emailError.message}`);
        }
      }
      
      return validEntries;
    }
  }

  return AuditLogEntry;
})();

// Node.js module export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AuditLogEntry;
}
