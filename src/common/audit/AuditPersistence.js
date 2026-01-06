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
Audit.Persistence.persistAuditEntries = function (auditFiddler, auditEntries) {
  if (!auditFiddler) {
    throw new Error('Audit.Persistence.persistAuditEntries: auditFiddler is required');
  }

  if (!Array.isArray(auditEntries)) {
    throw new Error('Audit.Persistence.persistAuditEntries: auditEntries must be an array');
  }

  if (auditEntries.length === 0) {
    return 0; // nothing to persist
  }

  // Use class-based validation to ensure all entries are proper Audit.LogEntry instances
  const classValidatedEntries = Audit.LogEntry.validateArray(auditEntries, 'AuditPersistence.persistAuditEntries');
  
  // Deduplicate by unique ID if present
  const seen = new Set();
  const dedupedEntries = classValidatedEntries.filter(entry => {
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
  // Convert validated entries to array format for sheet persistence  
  const rows = dedupedEntries.map(entry => entry.toArray());

  // Append rows to Audit sheet via fiddler with structure validation
  try {
    const currentData = auditFiddler.getData();

    // Validate sheet structure before proceeding
    if (currentData.length > 0) {
      const firstRow = currentData[0];
      if (!Array.isArray(firstRow) || firstRow.length !== 6) {
        const errorMsg = `AUDIT SHEET CORRUPTION: Expected 6 columns, got ${Array.isArray(firstRow) ? firstRow.length : typeof firstRow}`;
        Common.Logger.error('AuditPersistence', errorMsg);
        
        // Send alert and attempt recovery
        try {
          MailApp.sendEmail({
            to: 'membership-automation@sc3.club',
            subject: 'CRITICAL: Audit Sheet Structure Corruption',
            body: `Audit sheet structure corruption detected at ${new Date().toISOString()}

${errorMsg}
First row: ${JSON.stringify(firstRow)}

Attempting recovery by clearing fiddler cache.
If this email repeats, manual intervention required.`
          });
        } catch (emailError) {
          Common.Logger.error('AuditPersistence', `Failed to send corruption alert: ${emailError.message}`);
        }

        // Attempt recovery
        Common.Data.Storage.SpreadsheetManager.clearFiddlerCache('Audit');
        const freshFiddler = Common.Data.Storage.SpreadsheetManager.getFiddler('Audit');
        const freshData = freshFiddler.getData();

        if (freshData.length > 0 && (!Array.isArray(freshData[0]) || freshData[0].length !== 6)) {
          Common.Logger.error('AuditPersistence', 'Recovery failed - audit entries lost');
          return 0;
        }

        auditFiddler = freshFiddler;
        currentData = freshData;
      }
    }

    // Proceed with normal persistence
    const updatedData = [...currentData, ...rows];
    auditFiddler.setData(updatedData).dumpValues();

    Common.Logger.info('AuditPersistence', `Wrote ${rows.length} audit entries`);
    return rows.length;

  } catch (err) {
    const errMsg = `Failed to persist ${rows.length} audit entries: ${err.toString()}`;
    Common.Logger.error('AuditPersistence', errMsg);
    
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
      Common.Logger.error('AuditPersistence', `Failed to send persistence alert: ${emailError.message}`);
    }
    
    return 0;
  }
};

// Node.js export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Audit };
}
