/**
 * Audit Log Entry Class
 * 
 * Purpose: Provides type safety and validation for audit log entries.
 * Ensures all audit entries have proper structure and prevents corruption
 * by enforcing construction contracts at the class level.
 * 
 * Layer: Layer 1 Infrastructure (can use Common.Logger)
 * 
 * Usage:
 *   const entry = Audit.LogEntry.create('transaction', 'success', 'Payment processed');
 *   const validEntries = Audit.LogEntry.validateArray(auditEntries, 'processTransactions');
 * 
 * Pattern: IIFE-wrapped class (per gas-best-practices.md)
 */

// Extend Audit namespace (declared in 1namespaces.js in GAS)
if (typeof Audit === 'undefined') var Audit = {};

/**
 * Audit Log Entry class using IIFE-wrapped pattern
 * @class
 */
Audit.LogEntry = (function() {
  /**
   * @param {string} type - The type of audit event (e.g., 'transaction', 'member-update')
   * @param {string} outcome - The outcome ('success', 'fail', 'partial')
   * @param {string} [note] - Human readable description of the event
   * @param {string} [error] - Error message if outcome is 'fail' 
   * @param {string} [jsonData] - Structured data as JSON string
   * @param {Date} [timestamp] - Entry timestamp (defaults to current time)
   */
  class LogEntry {
    constructor(type, outcome, note, error, jsonData, timestamp) {
      // Validate required fields at construction time
      if (typeof type !== 'string' || type.trim() === '') {
        throw new Error(`Audit.LogEntry type must be non-empty string, got: ${typeof type} "${type}"`);
      }
      
      if (typeof outcome !== 'string' || outcome.trim() === '') {
        throw new Error(`Audit.LogEntry outcome must be non-empty string, got: ${typeof outcome} "${outcome}"`);
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
     * @returns {LogEntry} Valid audit entry (may be error entry if construction failed)
     */
    static create(type, outcome, note, error, jsonData, timestamp) {
      try {
        return new LogEntry(type, outcome, note, error, jsonData, timestamp);
      } catch (validationError) {
        Common.Logger.error('Audit.LogEntry', `Failed to create audit entry: ${validationError.message}`);
        
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
          Common.Logger.error('Audit.LogEntry', `Failed to send construction failure alert: ${emailError.message}`);
        }
        
        // Return a safe error entry instead of throwing
        return new LogEntry(
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
     * Ensures all entries are proper Audit.LogEntry instances
     * Replaces invalid entries with error entries to prevent corruption
     * 
     * @param {Array<LogEntry|object>} entries - Array of potential audit entries
     * @param {string} context - Context string for error reporting
     * @returns {Array<LogEntry>} Array of validated Audit.LogEntry instances
     */
    static validateArray(entries, context) {
      if (!Array.isArray(entries)) {
        Common.Logger.error('Audit.LogEntry', `${context}: entries is not an array: ${typeof entries}`);
        
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
          Common.Logger.error('Audit.LogEntry', `Failed to send non-array alert: ${emailError.message}`);
        }
        
        return [];
      }
      
      /** @type {Array<LogEntry>} */
      const validEntries = [];
      let corruptionDetected = false;
      
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        
        if (!(entry instanceof LogEntry)) {
          corruptionDetected = true;
          Common.Logger.error('Audit.LogEntry', `${context}: entry ${i} is not an Audit.LogEntry instance. Type: ${typeof entry}, Value: ${JSON.stringify(entry)}`);
          
          // Create safe replacement entry
          validEntries.push(LogEntry.create(
            'type-validation-error',
            'fail',
            `Non-Audit.LogEntry object detected at index ${i} in ${context}`,
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
            subject: 'CRITICAL: Non-Audit.LogEntry Objects Detected',
            body: `Invalid audit entry objects detected at ${new Date().toISOString()}

Context: ${context}
Total entries processed: ${entries.length}
Invalid objects found and replaced with error entries.

THIS INDICATES A BUG IN AUDIT ENTRY GENERATION CODE.

The ${context} code is creating raw objects instead of using Audit.LogEntry.create().
Review that code to ensure proper audit entry construction.

Processing continues normally with replacement error entries.`
          });
        } catch (emailError) {
          Common.Logger.error('Audit.LogEntry', `Failed to send corruption alert: ${emailError.message}`);
        }
      }
      
      return validEntries;
    }
  }

  return LogEntry;
})();

// Node.js module export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Audit;
}