/**
 * SpreadsheetManager - Low-level spreadsheet access using native SpreadsheetApp
 * 
 * CRITICAL: This module MUST NOT use AppLogger!
 * Reason: Creates infinite loop via Properties -> SpreadsheetManager -> _initializeSheets -> getContainerSpreadsheetId -> AppLogger -> Properties
 * Use console.log() only for tracing.
 * 
 * Pattern: IIFE-wrapped class with static methods (per gas-best-practices.md)
 */

var SpreadsheetManager = (function() {
  /** @type {Object.<string, any>|undefined} */
  let sheets;

  /**
   * Gets the container spreadsheet ID from script properties or current binding
   * @returns {string} The container spreadsheet ID
   * @throws {Error} If spreadsheet ID cannot be determined
   * @private
   */
  function getContainerSpreadsheetId() {
    try {
      // First try to get from script properties (if set during setup)
      const properties = PropertiesService.getScriptProperties();
      let containerId = properties.getProperty('CONTAINER_SPREADSHEET_ID');

      if (!containerId) {
        // Fallback: try to get from current active spreadsheet if we're in normal context
        try {
          console.log('[SpreadsheetManager.getContainerSpreadsheetId] Trying getActiveSpreadsheet fallback');
          const activeSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
          if (activeSpreadsheet) {
            containerId = activeSpreadsheet.getId();
            // Cache it for future use
            properties.setProperty('CONTAINER_SPREADSHEET_ID', containerId);
            console.log('[SpreadsheetManager.getContainerSpreadsheetId] Set from active spreadsheet: ' + containerId);
          }
        } catch (e) {
          // We might be in a trigger context where getActiveSpreadsheet() doesn't work reliably
          console.log('[SpreadsheetManager.getContainerSpreadsheetId] Could not get active spreadsheet: ' + e);
        }
      }

      if (!containerId) {
        const errorMsg = 'CONTAINER_SPREADSHEET_ID not found in Script Properties and could not determine from context';
        console.log('[SpreadsheetManager.getContainerSpreadsheetId] CRITICAL: ' + errorMsg);
        throw new Error(errorMsg);
      }

      return containerId;
    } catch (error) {
      console.log('[SpreadsheetManager.getContainerSpreadsheetId] Failed: ' + error);
      throw error;
    }
  }

  /**
   * Initialize sheets from Bootstrap using native SpreadsheetApp
   * @private
   */
  function _initializeSheets() {
    try {
      // Get the container spreadsheet ID to ensure we're accessing the correct spreadsheet
      const containerSpreadsheetId = getContainerSpreadsheetId();

      // Open the container spreadsheet
      const ss = SpreadsheetApp.openById(containerSpreadsheetId);
      const bootstrapSheet = ss.getSheetByName('Bootstrap');
      
      if (!bootstrapSheet) {
        throw new Error('Bootstrap sheet not found in container spreadsheet');
      }
      
      // Read Bootstrap data
      const dataRange = bootstrapSheet.getDataRange();
      const values = dataRange.getValues();
      const headers = values[0];
      
      // Convert to array of objects
      const bootStrap = values.slice(1).map(row => {
        const obj = {};
        headers.forEach((header, index) => {
          obj[header] = row[index];
        });
        return obj;
      });

      // Process Bootstrap data to extract IDs from URLs
      // This allows users to paste Google Sheets URLs in the id column instead of just IDs
      sheets = Object.fromEntries(bootStrap.map(row => {
        // Create a shallow copy to avoid mutating the original data
        const processedRow = { ...row };
        
        // If row has an id field, extract the ID from URL if it's a URL
        if (processedRow.id && typeof processedRow.id === 'string') {
          const trimmed = processedRow.id.trim();
          const urlPattern = /\/d\/([a-zA-Z0-9-_]+)/;
          const match = trimmed.match(urlPattern);
          if (match) {
            processedRow.id = match[1];
          } else {
            processedRow.id = trimmed;
          }
        }
        
        return [row.Reference, processedRow];
      }));
    } catch (error) {
      console.log('[SpreadsheetManager._initializeSheets] Error: ' + error);
      throw error;
    }
  }

  class SpreadsheetManager {
    /**
     * Get a sheet directly by name (replaces Fiddler for simpler access)
     * @param {string} sheetName - Name of the sheet from Bootstrap
     * @returns {GoogleAppsScript.Spreadsheet.Sheet} The sheet instance
     */
    static getSheet(sheetName) {
      if (!sheets) {
        _initializeSheets();
      }

      const sheet = sheets[sheetName];
      if (!sheet) {
        const availableSheets = Object.keys(sheets);
        throw new Error(`Sheet name ${sheetName} not found in Bootstrap. Available: ${availableSheets.join(', ')}`);
      }

      // Determine the spreadsheet ID - either from sheet config or container
      let spreadsheetId;
      if (sheet.id) {
        // External spreadsheet
        spreadsheetId = sheet.id;
      } else {
        // Local sheet in container spreadsheet
        spreadsheetId = getContainerSpreadsheetId();
        if (!spreadsheetId) {
          throw new Error(`No container spreadsheet ID available for local sheet: ${sheetName}`);
        }
      }

      // Return the actual sheet object from the spreadsheet
      const ss = SpreadsheetApp.openById(spreadsheetId);
      return ss.getSheetByName(sheet.sheetName);
    }
  }

  return SpreadsheetManager;
})();

// Node.js module export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SpreadsheetManager;
}
