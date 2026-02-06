/**
 * SheetAccess - Abstraction layer for spreadsheet operations
 * 
 * Purpose: Provide consistent interface for sheet access using native SpreadsheetApp
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
  
  // Get reference to ValidatedMember (available globally in GAS runtime, injected in tests)
  const getValidatedMember = () => {
    if (typeof ValidatedMember !== 'undefined') {
      return ValidatedMember;
    }
    // In test environment, ValidatedMember is loaded via require
    if (typeof require !== 'undefined') {
      const module = require('./ValidatedMember.js');
      return module.ValidatedMember;
    }
    throw new Error('ValidatedMember not available');
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
      const sheet = manager.getSheet(sheetName);
      const values = sheet.getDataRange().getValues();
      const headers = values[0];
      return values.slice(1).map(row => {
        const obj = {};
        headers.forEach((h, i) => obj[h] = row[i]);
        return obj;
      });
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
     * Get data from sheet with RichText preserved for link columns
     * Returns objects where link columns have {text, url} structure
     * 
     * @param {string} sheetName - Bootstrap sheet name
     * @param {string[]} [richTextColumns=[]] - Column names to extract RichText from
     * @returns {Object[]} Array of row objects with RichText data
     */
    static getDataWithRichText(sheetName, richTextColumns = []) {
      const manager = getSpreadsheetManager();
      const sheet = manager.getSheet(sheetName);
      const range = sheet.getDataRange();
      const values = range.getValues();
      const richTextValues = range.getRichTextValues();
      const headers = values[0];
      
      const richTextColIndices = richTextColumns.map(col => headers.indexOf(col));
      
      return values.slice(1).map((row, rowIndex) => {
        const obj = {};
        headers.forEach((header, colIndex) => {
          if (richTextColIndices.includes(colIndex)) {
            const rtv = richTextValues[rowIndex + 1][colIndex];
            const url = rtv ? rtv.getLinkUrl() : null;
            obj[header] = url ? { text: rtv.getText(), url: url } : row[colIndex];
          } else {
            obj[header] = row[colIndex];
          }
        });
        return obj;
      });
    }
    
    /**
     * Write data to a sheet (replaces all data)
     * 
     * @param {string} sheetName - Name of the sheet from Bootstrap
     * @param {Object[]} data - Array of row objects
     */
    static setData(sheetName, data) {
      const manager = getSpreadsheetManager();
      const sheet = manager.getSheet(sheetName);
      
      if (!data || data.length === 0) {
        // Clear all data except header (only if sheet has columns)
        if (sheet.getLastRow() > 1 && sheet.getLastColumn() > 0) {
          sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
        }
        return;
      }
      
      const headers = Object.keys(data[0] || {});
      const lastColumn = sheet.getLastColumn();
      const existingHeaders = lastColumn > 0 
        ? sheet.getRange(1, 1, 1, lastColumn).getValues()[0]
        : [];
      
      // Use existing header order if available and non-empty, otherwise use data's keys
      const orderedHeaders = existingHeaders.length && existingHeaders[0] ? existingHeaders : headers;
      
      // Write headers if sheet is empty
      if (lastColumn === 0 && orderedHeaders.length > 0) {
        sheet.getRange(1, 1, 1, orderedHeaders.length).setValues([orderedHeaders]);
      }
      
      const rows = data.map(obj => orderedHeaders.map(h => obj[h] ?? ''));
      
      // Clear existing data (except headers) and write new
      if (sheet.getLastRow() > 1 && sheet.getLastColumn() > 0) {
        sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
      }
      if (rows.length > 0) {
        sheet.getRange(2, 1, rows.length, orderedHeaders.length).setValues(rows);
      }
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

    // ========================================================================
    // Typed Accessors - Returns validated, strongly-typed data
    // ========================================================================

    /**
     * Get active members with validation
     * 
     * Returns validated member data with proper type safety.
     * Invalid rows are filtered out and alert emails are sent to membership-automation@sc3.club.
     * 
     * @returns {ValidatedMember[]} Array of validated member objects
     */
    static getActiveMembers() {
      const rawData = this.getDataAsArrays('ActiveMembers');
      if (rawData.length === 0) return [];
      
      const headers = rawData[0];
      const rows = rawData.slice(1);
      
      const ValidatedMemberClass = getValidatedMember();
      // Use ValidatedMember.validateRows which handles validation and error alerting
      return ValidatedMemberClass.validateRows(rows, headers, 'SheetAccess.getActiveMembers');
    }

    // ========================================================================
    // *ById Methods - For dynamic/external spreadsheets not in Bootstrap
    // ========================================================================

    /**
     * Get a sheet by spreadsheet ID and sheet name (for dynamic spreadsheets not in Bootstrap)
     * 
     * Use this for sheets that are configured dynamically (e.g., VotingService election results
     * where the spreadsheet ID comes from form.getDestinationId()).
     * 
     * @param {string} spreadsheetId - The spreadsheet ID to open
     * @param {string} sheetName - The name of the sheet tab within the spreadsheet
     * @param {boolean} [createIfMissing=false] - Whether to create the sheet if it doesn't exist
     * @returns {GoogleAppsScript.Spreadsheet.Sheet} The sheet instance
     * @throws {Error} If sheet not found and createIfMissing is false
     */
    static getSheetById(spreadsheetId, sheetName, createIfMissing = false) {
      const manager = getSpreadsheetManager();
      return manager.getSheetById(spreadsheetId, sheetName, createIfMissing);
    }

    /**
     * Get data as 2D array from a spreadsheet by ID (for dynamic spreadsheets not in Bootstrap)
     * 
     * @param {string} spreadsheetId - The spreadsheet ID to open
     * @param {string} sheetName - The name of the sheet tab within the spreadsheet
     * @returns {any[][]} 2D array with headers in first row
     * @throws {Error} If sheet not found
     */
    static getDataAsArraysById(spreadsheetId, sheetName) {
      const sheet = this.getSheetById(spreadsheetId, sheetName, false);
      return sheet.getDataRange().getValues();
    }

    /**
     * Get data from a spreadsheet by ID as array of row objects (for dynamic spreadsheets not in Bootstrap)
     * 
     * @param {string} spreadsheetId - The spreadsheet ID to open
     * @param {string} sheetName - The name of the sheet tab within the spreadsheet
     * @returns {Object[]} Array of row objects with column names as keys
     * @throws {Error} If sheet not found
     */
    static getDataById(spreadsheetId, sheetName) {
      const values = this.getDataAsArraysById(spreadsheetId, sheetName);
      if (values.length === 0) return [];
      const headers = values[0];
      return values.slice(1).map(row => {
        const obj = {};
        headers.forEach((h, i) => obj[h] = row[i]);
        return obj;
      });
    }

    /**
     * Write data to a sheet by spreadsheet ID (for dynamic spreadsheets not in Bootstrap)
     * 
     * @param {string} spreadsheetId - The spreadsheet ID to open
     * @param {string} sheetName - The name of the sheet tab within the spreadsheet
     * @param {Object[]} data - Array of row objects
     * @param {boolean} [createIfMissing=false] - Whether to create the sheet if it doesn't exist
     */
    static setDataById(spreadsheetId, sheetName, data, createIfMissing = false) {
      const sheet = this.getSheetById(spreadsheetId, sheetName, createIfMissing);
      
      if (!data || data.length === 0) {
        // Clear all data except header (only if sheet has columns)
        if (sheet.getLastRow() > 1 && sheet.getLastColumn() > 0) {
          sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
        }
        return;
      }
      
      const headers = Object.keys(data[0] || {});
      const lastColumn = sheet.getLastColumn();
      const existingHeaders = lastColumn > 0 
        ? sheet.getRange(1, 1, 1, lastColumn).getValues()[0]
        : [];
      
      // Use existing header order if available and non-empty, otherwise use data's keys
      const orderedHeaders = existingHeaders.length && existingHeaders[0] ? existingHeaders : headers;
      
      // Write headers if sheet is empty
      if (lastColumn === 0 && orderedHeaders.length > 0) {
        sheet.getRange(1, 1, 1, orderedHeaders.length).setValues([orderedHeaders]);
      }
      
      const rows = data.map(obj => orderedHeaders.map(h => obj[h] ?? ''));
      
      // Clear existing data (except headers) and write new
      if (sheet.getLastRow() > 1 && sheet.getLastColumn() > 0) {
        sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
      }
      if (rows.length > 0) {
        sheet.getRange(2, 1, rows.length, orderedHeaders.length).setValues(rows);
      }
    }

    /**
     * Open a spreadsheet by ID and return it (for operations needing the full spreadsheet object)
     * 
     * Use sparingly - prefer specific *ById methods. This exposes the raw SpreadsheetApp API.
     * 
     * @param {string} spreadsheetId - The spreadsheet ID to open
     * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet} The spreadsheet instance
     */
    static getSpreadsheetById(spreadsheetId) {
      return SpreadsheetApp.openById(spreadsheetId);
    }
  }
  
  return SheetAccess;
})();

// Node.js module export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SheetAccess };
}
