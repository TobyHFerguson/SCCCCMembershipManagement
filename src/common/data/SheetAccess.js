/// <reference path="../../types/global.d.ts" />

/**
 * SheetAccess - Abstraction layer for spreadsheet operations
 * 
 * Purpose: Provide consistent interface for sheet access, hiding Fiddler implementation
 * 
 * Current: Uses Fiddler under the hood
 * Future: Can be swapped to native SpreadsheetApp without changing call sites
 * 
 * Layer: Layer 1 Infrastructure (can use AppLogger)
 * 
 * Pattern: IIFE-wrapped class with static methods (per gas-best-practices.md)
 */

var SheetAccess = (function() {
  // Get reference to SpreadsheetManager (available globally in GAS runtime, injected in tests)
  const getSpreadsheetManager = () => {
    if (typeof SpreadsheetManager !== 'undefined') {
      return SpreadsheetManager;
    }
    // In test environment, SpreadsheetManager is mocked via require
    if (typeof require !== 'undefined') {
      return require('./storage/SpreadsheetManager.js');
    }
    throw new Error('SpreadsheetManager not available');
  };

  /**
   * SheetAccess class - Abstraction over spreadsheet operations
   * All methods are static as this is a utility class
   * 
   * @class
   */
  class SheetAccess {
    /**
     * Get data from a sheet as array of row objects
     * @param {string} sheetName - Name of the sheet from Bootstrap
     * @returns {Object[]} Array of row objects with column names as keys
     */
    static getData(sheetName) {
      const manager = getSpreadsheetManager();
      const fiddler = manager.getFiddler(sheetName);
      return fiddler.getData();
    }
    
    /**
     * Get data as 2D array (headers + rows)
     * @param {string} sheetName - Name of the sheet from Bootstrap
     * @returns {any[][]} 2D array with headers in first row
     */
    static getDataAsArrays(sheetName) {
      const manager = getSpreadsheetManager();
      const sheet = manager.getSheet(sheetName);
      return sheet.getDataRange().getValues();
    }
    
    /**
     * Get data with formulas preserved (for rich text hyperlinks)
     * 
     * IMPORTANT: Call convertLinks() first for cells with rich text hyperlinks
     * 
     * @param {string} sheetName - Name of the sheet from Bootstrap
     * @returns {Object[]} Array of row objects with formulas merged in
     */
    static getDataWithFormulas(sheetName) {
      const manager = getSpreadsheetManager();
      const fiddler = manager.getFiddler(sheetName);
      return manager.getDataWithFormulas(fiddler);
    }
    
    /**
     * Write data to a sheet (replaces all data)
     * 
     * Note: This clears the cache after writing to ensure fresh reads
     * 
     * @param {string} sheetName - Name of the sheet from Bootstrap
     * @param {Object[]} data - Array of row objects
     */
    static setData(sheetName, data) {
      const manager = getSpreadsheetManager();
      const fiddler = manager.getFiddler(sheetName);
      fiddler.setData(data).dumpValues();
      manager.clearFiddlerCache(sheetName);
    }
    
    /**
     * Append rows to end of sheet
     * @param {string} sheetName - Name of the sheet from Bootstrap
     * @param {any[][]} rows - 2D array of values to append
     */
    static appendRows(sheetName, rows) {
      if (!rows || rows.length === 0) {
        return;
      }
      const manager = getSpreadsheetManager();
      const sheet = manager.getSheet(sheetName);
      const lastRow = sheet.getLastRow();
      const numCols = rows[0].length;
      sheet.getRange(lastRow + 1, 1, rows.length, numCols).setValues(rows);
    }
    
    /**
     * Update specific rows in a sheet
     * @param {string} sheetName - Name of the sheet from Bootstrap
     * @param {any[][]} rows - 2D array of values
     * @param {number} startRow - Starting row number (1-indexed)
     */
    static updateRows(sheetName, rows, startRow) {
      if (!rows || rows.length === 0) {
        return;
      }
      const manager = getSpreadsheetManager();
      const sheet = manager.getSheet(sheetName);
      const numCols = rows[0].length;
      sheet.getRange(startRow, 1, rows.length, numCols).setValues(rows);
    }
    
    /**
     * Convert rich text links to hyperlink formulas
     * 
     * IMPORTANT: Call this BEFORE getDataWithFormulas() for sheets with rich text links
     * 
     * @param {string} sheetName - Name of the sheet from Bootstrap
     */
    static convertLinks(sheetName) {
      const manager = getSpreadsheetManager();
      manager.convertLinks(sheetName);
    }
    
    /**
     * Clear cached data for a sheet
     * Call when external code may have modified the sheet
     * 
     * @param {string} [sheetName] - Specific sheet to clear, or omit to clear all
     */
    static clearCache(sheetName) {
      const manager = getSpreadsheetManager();
      manager.clearFiddlerCache(sheetName);
    }
    
    /**
     * Get raw Sheet object for advanced operations
     * 
     * Note: Prefer using higher-level methods when possible
     * Only use this when you need direct SpreadsheetApp API access
     * 
     * @param {string} sheetName - Name of the sheet from Bootstrap
     * @returns {GoogleAppsScript.Spreadsheet.Sheet} The sheet instance
     */
    static getSheet(sheetName) {
      const manager = getSpreadsheetManager();
      return manager.getSheet(sheetName);
    }
    
    /**
     * Get a Fiddler instance for a sheet (for advanced use)
     * 
     * Note: This is provided for backward compatibility
     * Prefer using higher-level methods when possible
     * 
     * @param {string} sheetName - Name of the sheet from Bootstrap
     * @returns {Fiddler} Fiddler instance with per-execution caching
     */
    static getFiddler(sheetName) {
      const manager = getSpreadsheetManager();
      return manager.getFiddler(sheetName);
    }
  }
  
  return SheetAccess;
})();

// Node.js module export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SheetAccess };
}
