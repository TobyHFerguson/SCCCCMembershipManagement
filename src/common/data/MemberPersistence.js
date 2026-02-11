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
        const member = modifiedMembers[i];
        
        // Use header-based property lookup (not toArray()) to handle any sheet column order
        for (let j = 0; j < headers.length; j++) {
          const currentValue = member[headers[j]];
          if (!MemberPersistence.valuesEqual(original[j], currentValue)) {
            // Write single cell that changed
            // Row index: i + 2 (skip header row, 1-based indexing)
            // Column index: j + 1 (1-based indexing)
            const range = sheet.getRange(i + 2, j + 1);
            range.setValue(currentValue);
            
            // When a Date cell is overwritten with a non-Date value, reset cell
            // formatting to prevent Google Sheets from interpreting numbers as
            // date serial numbers (fixes Period column corruption from column-order bug)
            if (original[j] instanceof Date && !(currentValue instanceof Date)) {
              if (typeof currentValue === 'number') {
                range.setNumberFormat('0');
              }
            }
            
            changeCount++;
          }
        }
      }
      
      return changeCount;
    }

    /**
     * Write changed cells for a single member at a known row position.
     * Supports partial updates — only properties present in newMember are compared.
     * Includes Date→non-Date format reset (same safety as writeChangedCells).
     * 
     * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - The sheet to write to
     * @param {Array<*>} originalRow - Original row data from sheet (without header)
     * @param {Record<string, *>} newMember - New member data (may be partial — only present keys are compared)
     * @param {Array<string>} headers - Column headers matching originalRow order
     * @param {number} sheetRow - 1-based row number in the sheet
     * @returns {number} Number of cells changed
     */
    static writeSingleMemberChanges(sheet, originalRow, newMember, headers, sheetRow) {
      let changeCount = 0;
      
      for (let j = 0; j < headers.length; j++) {
        const header = headers[j];
        if (header in newMember) {
          const newValue = newMember[header];
          if (!MemberPersistence.valuesEqual(originalRow[j], newValue)) {
            const range = sheet.getRange(sheetRow, j + 1);
            range.setValue(newValue);
            
            // When a Date cell is overwritten with a non-Date value, reset cell
            // formatting to prevent Google Sheets from interpreting numbers as
            // date serial numbers (fixes Period column corruption from column-order bug)
            if (originalRow[j] instanceof Date && !(newValue instanceof Date)) {
              if (typeof newValue === 'number') {
                range.setNumberFormat('0');
              }
            }
            
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
