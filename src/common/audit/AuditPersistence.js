/**
 * Audit Persistence Helper
 * 
 * Purpose: Single canonical helper for persisting audit entries to the Audit sheet.
 * 
 * Rules:
 * 1. Only this helper should write to the Audit fiddler (enforced by code review)
 * 2. Accepts only audit entry arrays from Manager return values
 * 3. Validates schema before persisting
 * 4. Deduplicates by unique ID if present to avoid double-writes
 * 5. Returns number of rows written for verification
 * 
 * Layer: Layer 1 Infrastructure (can use Common.Logger)
 * 
 * Usage:
 *   const auditFiddler = Common.Data.Storage.SpreadsheetManager.getFiddler('Audit');
 *   const numWritten = Audit.Persistence.persistAuditEntries(auditFiddler, result.auditEntries);
 */

// Extend Audit namespace (declared in 1namespaces.js in GAS)
// Use direct assignment pattern to avoid var hoisting issues
if (typeof Audit === 'undefined') Audit = {};
Audit.Persistence = Audit.Persistence || {};

/**
 * Persist audit entries to the Audit sheet via fiddler
 * 
 * @param {object} auditFiddler - Fiddler instance for Audit sheet
 * @param {Array<Audit.LogEntry>} auditEntries - Array of audit log entries from Manager
 * @returns {number} Number of rows written
 */
Audit.Persistence.persistAuditEntries = function(auditFiddler, auditEntries) {
    if (!auditFiddler) {
      throw new Error('Audit.Persistence.persistAuditEntries: auditFiddler is required');
    }
    
    if (!Array.isArray(auditEntries)) {
      throw new Error('Audit.Persistence.persistAuditEntries: auditEntries must be an array');
    }
    
    if (auditEntries.length === 0) {
      return 0; // nothing to persist
    }
    
    // Validate schema for each entry
    const validatedEntries = auditEntries.map((entry, idx) => {
      if (!entry || typeof entry !== 'object') {
        throw new Error(`Audit.Persistence.persistAuditEntries: entry at index ${idx} is not an object`);
      }
      
      // Required fields
      if (!entry.Type) {
        throw new Error(`Audit.Persistence.persistAuditEntries: entry at index ${idx} missing required field: Type`);
      }
      if (!entry.Outcome) {
        throw new Error(`Audit.Persistence.persistAuditEntries: entry at index ${idx} missing required field: Outcome`);
      }
      if (!entry.Outcome.match(/^(success|fail)$/)) {
        throw new Error(`Audit.Persistence.persistAuditEntries: entry at index ${idx} has invalid Outcome: ${entry.Outcome} (must be 'success' or 'fail')`);
      }
      if (!entry.Note && !entry.Error) {
        throw new Error(`Audit.Persistence.persistAuditEntries: entry at index ${idx} must have Note or Error`);
      }
      
      return entry;
    });
    
    // Deduplicate by unique ID if present
    const seen = new Set();
    const dedupedEntries = validatedEntries.filter(entry => {
      if (entry.Id) {
        if (seen.has(entry.Id)) {
          Common.Logger.warn('AuditPersistence', `Skipping duplicate entry with Id=${entry.Id}`);
          return false;
        }
        seen.add(entry.Id);
      }
      return true;
    });
    
    if (dedupedEntries.length === 0) {
      return 0; // all duplicates
    }
    
    // Convert entries to rows for sheet persistence
    // Expected Audit sheet columns: Timestamp, Type, Outcome, Note, Error, JsonData
    const rows = dedupedEntries;
    
    // Append rows to Audit sheet via fiddler
    try {
      const currentData = auditFiddler.getData();
      const updatedData = [...currentData, ...rows];
      auditFiddler.setData(updatedData).dumpValues();
      
      Common.Logger.info('AuditPersistence', `Wrote ${rows.length} audit entries`);
      return rows.length;
    } catch (err) {
      const errMsg = `Failed to persist ${rows.length} entries: ${err && err.toString ? err.toString() : String(err)}`;
      Common.Logger.error('AuditPersistence', errMsg);
      throw new Error(errMsg);
    }
};

// Node.js export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Audit };
}
