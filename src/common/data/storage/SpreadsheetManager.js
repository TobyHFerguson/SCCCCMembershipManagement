/**
 * SpreadsheetManager - Low-level spreadsheet access via bmPreFiddler
 * 
 * CRITICAL: This module MUST NOT use Logger (formerly Common.Logger)!
 * Reason: Creates infinite loop via Properties -> getFiddler -> _initializeSheets -> getContainerSpreadsheetId -> Logger -> Properties
 * Use console.log() only for tracing.
 * 
 * Pattern: IIFE-wrapped class with static methods (per gas-best-practices.md)
 */

var SpreadsheetManager = (function() {
  /** @type {Object.<string, any>|undefined} */
  let sheets;
  
  /** @type {Object.<string, any>} Per-execution cache for fiddler instances */
  const __fiddlerCache = {};

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
   * Initialize sheets from Bootstrap
   * @private
   */
  function _initializeSheets() {
    try {
      // Get the container spreadsheet ID to ensure we're accessing the correct spreadsheet
      const containerSpreadsheetId = getContainerSpreadsheetId();

      // Use the container spreadsheet instead of current context
      const fiddlerConfig = containerSpreadsheetId
        ? { id: containerSpreadsheetId, sheetName: 'Bootstrap', createIfMissing: false }
        : { sheetName: 'Bootstrap', createIfMissing: false };

      const bootStrap = bmPreFiddler.PreFiddler().getFiddler(fiddlerConfig).getData();

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

  /**
   * Combines two arrays of objects by merging the properties of objects at the same index.
   * If a property in the first array's object is an empty string or undefined, the property from the second array's object is used.
   * 
   * @param {Array<Object>} arr1 - The first array of objects.
   * @param {Array<Object>} arr2 - The second array of objects.
   * @returns {Array<Object>} A new array of objects with combined properties.
   * @throws {Error} If the lengths of the two arrays are not equal.
   * @private
   */
  function _combineArrays(arr1, arr2) {
    if (arr1.length !== arr2.length) {
      throw new Error("Both arrays must have the same length");
    }

    return arr1.map((item, index) => {
      const combinedItem = { ...arr2[index] };
      for (const key in item) {
        if (item[key] !== "" && item[key] !== undefined) {
          combinedItem[key] = item[key];
        }
      }
      return combinedItem;
    });
  }

  class SpreadsheetManager {
    /**
     * Gets a fiddler based on the sheet name.
     * @param {string} sheetName - the name of the sheet.
     * @returns {Fiddler} - The fiddler.
     */
    static getFiddler(sheetName) {
      try {
        // Check cache first
        const containerSpreadsheetId = getContainerSpreadsheetId();
        const cacheKey = `${containerSpreadsheetId || 'default'}::${sheetName}`;

        if (__fiddlerCache[cacheKey]) {
          return __fiddlerCache[cacheKey];
        }

        if (!sheets) {
          _initializeSheets();
        }

        const sheet = sheets[sheetName];
        if (!sheet) {
          const availableSheets = Object.keys(sheets);
          let errorMsg = 'Sheet name ' + sheetName + ' not found in Bootstrap. Available: ' + availableSheets.join(', ');

          // Check for common typos
          if (sheetName === 'Properties' && availableSheets.includes('Propertes')) {
            errorMsg += '\n\nDID YOU MEAN: "Propertes" is misspelled in Bootstrap - should be "Properties"';
          }

          console.log('[SpreadsheetManager.getFiddler] ERROR: ' + errorMsg);
          throw new Error(errorMsg);
        }

        // Ensure we use the correct spreadsheet context
        const sheetConfig = sheets[sheetName];
        let fiddlerConfig;

        if (sheetConfig.id) {
          // If the sheet config has an ID, use it (external spreadsheet)
          fiddlerConfig = sheetConfig;
        } else {
          // If no ID in config, add container spreadsheet ID (local sheet)
          const containerIdForConfig = getContainerSpreadsheetId();
          fiddlerConfig = containerIdForConfig
            ? { ...sheetConfig, id: containerIdForConfig }
            : sheetConfig;
        }

        const fiddler = bmPreFiddler.PreFiddler().getFiddler(fiddlerConfig).needFormulas();

        // Cache the fiddler for reuse in this execution
        __fiddlerCache[cacheKey] = fiddler;

        return fiddler;
      } catch (error) {
        console.log('[SpreadsheetManager.getFiddler] Error getting fiddler for ' + sheetName + ': ' + error);
        error.message = `SpreadsheetManager.getFiddler(${sheetName}) failed: ${error.message}`;
        throw error;
      }
    }

    /**
     * Clear cached fiddler(s). Call when external code may have modified the sheet.
     * @param {string} [sheetName] - Specific sheet to clear, or omit to clear all
     */
    static clearFiddlerCache(sheetName) {
      if (!sheetName) {
        for (const k in __fiddlerCache) delete __fiddlerCache[k];
        return;
      }

      const containerSpreadsheetId = getContainerSpreadsheetId();
      const cacheKey = `${containerSpreadsheetId || 'default'}::${sheetName}`;

      if (__fiddlerCache[cacheKey]) {
        delete __fiddlerCache[cacheKey];
      }
    }

    /**
     * Returns the data from a fiddler with formulas merged into it.
     * @template T
     * @param {Fiddler<T>} fiddler 
     * @returns {T[]} - The merged data.
     */
    static getDataWithFormulas(fiddler) {
      fiddler.needFormulas();
      return _combineArrays(fiddler.getFormulaData(), fiddler.getData());
    }

    /**
     * Converts links in a sheet to hyperlinks.
     * @param {string} sheetName - The name of the sheet.
     */
    static convertLinks(sheetName) {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
      if (!sheet) return;
      const range = sheet.getDataRange();
      const rtvs = range.getRichTextValues();
      const values = range.getValues();
      const newValues = rtvs.map((row, r) => {
        return row.map((column, c) => {
          if (!column) return null;
          const v = column.getText() ? column.getText() : values[r][c];
          return column.getLinkUrl()
            ? '=hyperlink("'.concat(column.getLinkUrl(), '", "').concat(v, '")')
            : v;
        });
      });
      range.setValues(newValues);
      SpreadsheetApp.flush();
    }

    /**
     * Get a sheet directly by name (replaces fiddler for simpler access)
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
