// @ts-check
/// <reference path="../../types/global.d.ts" />

/**
 * Common.Utils - Utility functions for the application
 */

if (typeof Common === 'undefined') Common = {};
if (typeof Common.Utils === 'undefined') Common.Utils = {};

/**
 * Wraps a menu function with error handling to show errors in UI
 * @param {Function} fn - The function to wrap
 * @param {string} menuItemName - Name of menu item for error messages
 * @returns {Function} Wrapped function
 */
Common.Utils.wrapMenuFunction = function(fn, menuItemName) {
  AppLogger.configure();
  return function() {
    try {
      AppLogger.info('MenuWrapper', `Menu item '${menuItemName}' clicked - starting execution`);
      const result = fn.apply(this, arguments);
      AppLogger.info('MenuWrapper', `Menu item '${menuItemName}' completed successfully`);
      try {
        SpreadsheetApp.getUi().toast(`${menuItemName} completed successfully`, 'Success', 3);
      } catch (uiError) {
        // UI not available (e.g., running from trigger) - just log
        Logger.log(`[MenuWrapper] UI not available for toast notification`);
      }
      return result;
    } catch (error) {
      Logger.log(`[MenuWrapper] Menu item '${menuItemName}' failed: ${error}`);
      try {
        const ui = SpreadsheetApp.getUi();
        const errorMsg = error && error.message ? error.message : String(error);
        ui.alert(
          'Error',
          `Failed to execute '${menuItemName}':\n\n${errorMsg}\n\nCheck View > Executions for detailed logs.`,
          ui.ButtonSet.OK
        );
      } catch (uiError) {
        // UI not available (e.g., running from trigger) - error already logged
        AppLogger.warn('MenuWrapper', 'UI not available for error alert');
      }
      throw error;
    }
  };
};

/**
 * Extracts a Google document ID from a URL or returns the input unchanged if it's already an ID.
 * Handles various Google Docs URL formats including Sheets, Forms, Docs, Slides, etc.
 * 
 * @param {string|null|undefined} urlOrId - A Google Docs URL or document ID
 * @returns {string|null|undefined} The extracted document ID, or the input unchanged if not a URL
 * 
 * @example
 * extractSpreadsheetId('https://docs.google.com/spreadsheets/d/1ABC123/edit') // returns '1ABC123'
 * extractSpreadsheetId('1ABC123') // returns '1ABC123'
 * extractSpreadsheetId('https://docs.google.com/forms/d/1XYZ/edit') // returns '1XYZ'
 */
Common.Utils.extractSpreadsheetId = function(urlOrId) {
  // Handle null, undefined, and empty string
  if (!urlOrId) {
    return urlOrId;
  }

  // Trim whitespace
  const trimmed = String(urlOrId).trim();
  
  // If it's empty after trimming, return the original (to preserve behavior for whitespace-only strings)
  if (!trimmed) {
    return urlOrId;
  }

  // Try to extract ID from Google Docs URLs
  // Pattern matches:
  // - https://docs.google.com/spreadsheets/d/{ID}/edit
  // - https://docs.google.com/forms/d/{ID}/edit
  // - https://docs.google.com/document/d/{ID}/edit
  // - https://docs.google.com/presentation/d/{ID}/edit
  // And variations with query params, fragments, trailing slashes, etc.
  const urlPattern = /\/d\/([a-zA-Z0-9-_]+)/;
  const match = trimmed.match(urlPattern);
  
  if (match) {
    return match[1];
  }

  // If no URL pattern matched, return the trimmed input (it's likely already an ID)
  return trimmed;
};

// Node.js export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Utils: Common.Utils };
}
