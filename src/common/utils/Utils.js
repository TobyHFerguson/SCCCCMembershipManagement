// @ts-check
/// <reference path="../Common.d.ts" />

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
  Common.Logger.configure();
  return function() {
    try {
      Common.Logger.info('MenuWrapper', `Menu item '${menuItemName}' clicked - starting execution`);
      const result = fn.apply(this, arguments);
      Common.Logger.info('MenuWrapper', `Menu item '${menuItemName}' completed successfully`);
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
        Common.Logger.warn('MenuWrapper', 'UI not available for error alert');
      }
      throw error;
    }
  };
};

// Node.js export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Utils: Common.Utils };
}
