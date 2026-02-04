// @ts-check
/// <reference path="../../types/global.d.ts" />

/**
 * AuditPersistence Module
 * 
 * Purpose: Single canonical helper for persisting audit entries to the Audit sheet.
 * 
 * Rules:
 * 1. Only this helper should write to the Audit sheet (enforced by code review)
 * 2. Accepts only audit entry arrays from Manager return values
 * 3. Validates schema before persisting
 * 4. Deduplicates by unique ID if present to avoid double-writes
 * 5. Returns number of rows written for verification
 * 
 * Layer: Layer 1 Infrastructure (can use AppLogger)
 * 
 * Usage:
 *   const numWritten = AuditPersistence.persistAuditEntries(result.auditEntries);
 * 
 * Pattern: IIFE-wrapped class with static methods (per gas-best-practices.md)
 */

// Load AuditLogEntry class for Node.js/Jest environment
if (typeof module !== 'undefined') {
  if (typeof AuditLogEntry === 'undefined') {
    var AuditLogEntry = require('./AuditLogEntry.js');
  }
}

/**
 * AuditPersistence class with static methods
 * @class
 */
var AuditPersistence = (function() {
  class AuditPersistence {
    /**
     * Persist audit entries to the Audit sheet via direct SpreadsheetApp
     * 
     * @param {AuditLogEntry[]} auditEntries - Array of audit log entries from Manager
     * @returns {number} Number of rows written
     */
    static persistAuditEntries(auditEntries) {
      if (!Array.isArray(auditEntries)) {
        throw new Error('AuditPersistence.persistAuditEntries: auditEntries must be an array');
      }

      if (auditEntries.length === 0) {
        return 0; // nothing to persist
      }

      // Use class-based validation to ensure all entries are proper AuditLogEntry instances
      const classValidatedEntries = AuditLogEntry.validateArray(auditEntries, 'AuditPersistence.persistAuditEntries');
      
      // Deduplicate by unique ID if present (Id is optional property added dynamically)
      const seen = new Set();
      const dedupedEntries = classValidatedEntries.filter(entry => {
        // @ts-ignore - Id is optional property that may be added dynamically
        if (entry.Id) {
          // @ts-ignore
          if (seen.has(entry.Id)) {
            // @ts-ignore
            AppLogger.warn('AuditPersistence', `Skipping duplicate entry with Id=${entry.Id}`);
            return false;
          }
          // @ts-ignore
          seen.add(entry.Id);
        }
        return true;
      });

      if (dedupedEntries.length === 0) {
        return 0; // all duplicates
      }
      
      // Convert validated entries to array format for sheet persistence  
      const rows = dedupedEntries.map(entry => entry.toArray());

      // Append rows to Audit sheet via direct SpreadsheetApp
      try {
        // Get the Audit sheet directly
        const auditSheet = SheetAccess.getSheet('Audit');
        if (!auditSheet) {
          throw new Error('Audit sheet not found');
        }

        // Get current data to validate structure
        const existingData = auditSheet.getDataRange().getValues();
        
        // Validate sheet has expected 6-column structure (if not empty)
        if (existingData.length > 0 && existingData[0].length !== 6) {
          const errorMsg = `AUDIT SHEET CORRUPTION: Expected 6 columns, found ${existingData[0].length}`;
          AppLogger.error('AuditPersistence', errorMsg);
          
          // Send critical alert
          try {
            MailApp.sendEmail({
              to: 'membership-automation@sc3.club',
              subject: 'CRITICAL: Audit Sheet Column Mismatch',
              body: `Audit sheet column corruption detected at ${new Date().toISOString()}

${errorMsg}
Expected: Timestamp, Type, Outcome, Note, Error, JSON (6 columns)
Found: ${existingData[0].length} columns

Manual intervention required to fix sheet structure.
Audit entries cannot be written until sheet is corrected.`
            });
          } catch (emailError) {
            AppLogger.error('AuditPersistence', `Failed to send corruption alert: ${emailError.message}`);
          }
          
          return 0; // Cannot proceed with corrupted sheet
        }

        // Append new rows directly to the sheet
        if (rows.length > 0) {
          const startRow = auditSheet.getLastRow() + 1;
          const range = auditSheet.getRange(startRow, 1, rows.length, 6);
          range.setValues(rows);
        }

        AppLogger.info('AuditPersistence', `Wrote ${rows.length} audit entries directly to sheet`);
        return rows.length;

      } catch (err) {
        const errMsg = `Failed to persist ${rows.length} audit entries: ${err.toString()}`;
        AppLogger.error('AuditPersistence', errMsg);
        
        // Send alert about persistence failure
        try {
          MailApp.sendEmail({
            to: 'membership-automation@sc3.club',
            subject: 'CRITICAL: Audit Persistence Exception',
            body: `Audit persistence failed at ${new Date().toISOString()}

Error: ${errMsg}

Processing continues without audit logging.`
          });
        } catch (emailError) {
          AppLogger.error('AuditPersistence', `Failed to send persistence alert: ${emailError.message}`);
        }
        
        return 0;
      }
    }
  }
  
  return AuditPersistence;
})();

// Node.js module export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AuditPersistence;
}
