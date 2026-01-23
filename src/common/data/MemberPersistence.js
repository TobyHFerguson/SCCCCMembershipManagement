/**
 * Member Persistence Helper
 * 
 * Purpose: Provides selective cell writing for member updates to minimize
 * version history noise and improve debugging of sheet changes.
 * 
 * Layer: Layer 1 Infrastructure (can use AppLogger)
 * 
 * Usage:
 *   const changeCount = MemberPersistence.writeChangedCells(
 *     sheet, originalRows, modifiedMembers, headers
 *   );
 * 
 * Pattern: Flat IIFE-wrapped class (per gas-best-practices.md)
 */

/**
 * MemberPersistence class using flat IIFE-wrapped pattern
 * @class
 */
var MemberPersistence = (function() {
  class MemberPersistence {
    /**
     * Write only changed member cells to minimize version history noise
     * 
     * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - The ActiveMembers sheet
     * @param {Array<Array<*>>} originalRows - Original row data from sheet (without header)
     * @param {Array<ValidatedMember>} modifiedMembers - Updated member objects
     * @param {Array<string>} headers - Column headers
     * @returns {number} Number of cells changed
     */
    static writeChangedCells(sheet, originalRows, modifiedMembers, headers) {
      let changeCount = 0;
      
      // Sanity check: ensure we have matching row counts
      if (originalRows.length !== modifiedMembers.length) {
        AppLogger.error(
          'MemberPersistence',
          `Row count mismatch: ${originalRows.length} original rows vs ${modifiedMembers.length} modified members`
        );
        throw new Error('Cannot write changed cells: row count mismatch between original and modified data');
      }
      
      for (let i = 0; i < modifiedMembers.length; i++) {
        const original = originalRows[i];
        const modified = modifiedMembers[i].toArray();
        
        for (let j = 0; j < modified.length; j++) {
          if (!MemberPersistence.valuesEqual(original[j], modified[j])) {
            // Write single cell that changed
            // Row index: i + 2 (skip header row, 1-based indexing)
            // Column index: j + 1 (1-based indexing)
            sheet.getRange(i + 2, j + 1).setValue(modified[j]);
            changeCount++;
          }
        }
      }
      
      return changeCount;
    }

    /**
     * Value equality that handles Dates and primitives
     * 
     * @param {*} a - First value
     * @param {*} b - Second value
     * @returns {boolean} True if values are equal
     */
    static valuesEqual(a, b) {
      // Both are Dates - compare timestamps
      if (a instanceof Date && b instanceof Date) {
        return a.getTime() === b.getTime();
      }
      
      // One is Date, other isn't - not equal
      if (a instanceof Date || b instanceof Date) {
        return false;
      }
      
      // Both null or undefined
      if ((a === null || a === undefined) && (b === null || b === undefined)) {
        return true;
      }
      
      // Standard comparison for primitives
      return a === b;
    }
  }

  return MemberPersistence;
})();

// Node.js module export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MemberPersistence };
}
