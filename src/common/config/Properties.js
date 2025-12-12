// @ts-check
/// <reference path="../../types/global.d.ts" />

/**
 * Common.Properties - Manages application properties with spreadsheet-backed storage for user-configurable
 * settings and Script Properties for code-internal state tracking.
 * 
 * Properties are loaded once per execution from the Properties sheet (key/value pairs) and cached.
 * Code-internal properties (runtime state) always come from Script Properties and are never in the sheet.
 * 
 * CRITICAL: This module MUST NOT use Common.Logger!
 * Reason: Creates infinite loop - Common.Logger reads config from Properties -> Properties fails -> Common.Logger.error -> infinite recursion
 * Use console.log() only for tracing.
 */

if (typeof Common === 'undefined') Common = {};
if (typeof Common.Config === 'undefined') Common.Config = {};

Common.Config.Properties = (function () {
  
  /**
   * Per-execution cache of Properties sheet data
   * @type {Object.<string, string>|null}
   */
  let _propertyCache = null;

  /**
   * Guard flag to detect circular/recursive calls to _loadPropertiesSheet
   * @type {boolean}
   */
  let _isLoadingProperties = false;

  /**
   * Properties that are code-internal (runtime state) and must only exist in Script Properties.
   * These are set/modified by code, not by operators.
   * @type {Set<string>}
   */
  const CODE_INTERNAL_PROPERTIES = new Set([
    'CONTAINER_SPREADSHEET_ID',     // Set during trigger setup
    'ELECTIONS_SPREADSHEET_ID',     // Set during trigger setup  
    'spreadsheetId',                 // Set by form submission trigger
    'paymentCheckStartTime',         // Trigger timing state
    'lastProcessedTime'              // Processing cursor
    // Note: VOTING_TOKEN_* are also code-internal but use dynamic keys
  ]);

  /**
   * Load Properties sheet data into cache (called once per execution)
   * @private
   * @throws {Error} If Properties sheet is not configured in Bootstrap
   * @throws {Error} If called recursively (circular dependency detected)
   */
  function _loadPropertiesSheet() {
    // Detect circular dependency
    if (_isLoadingProperties) {
      const error = new Error('CIRCULAR DEPENDENCY DETECTED: _loadPropertiesSheet called recursively! This usually means Common.Logger is being used in Properties or SpreadsheetManager.');
      console.log('[Properties._loadPropertiesSheet] CRITICAL: ' + error.message);
      throw error;
    }
    
    _isLoadingProperties = true;
    
    try {
      const fiddler = Common.Data.Storage.SpreadsheetManager.getFiddler('Properties');
      const data = fiddler.getData() || [];
      
      _propertyCache = {};
      
      // Expected sheet structure: [Property, Value, Description, Service]
      // Row 0 is header, skip it
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row) continue; // Skip empty rows
        
        // bmPreFiddler returns objects with property names, not arrays
        const propertyName = row.Property ? String(row.Property).trim() : '';
        const value = row.Value !== undefined && row.Value !== null ? String(row.Value) : '';
        
        if (!propertyName) continue; // Skip rows without property name
                
        if (CODE_INTERNAL_PROPERTIES.has(propertyName)) {
          // NOTE: Don't use Common.Logger here - creates infinite loop
          console.log('[Properties._loadPropertiesSheet] WARNING: Property ' + propertyName + ' is code-internal and should not be in Properties sheet');
          continue;
        }
        
        _propertyCache[propertyName] = value;
      }
            // NOTE: Don't use Common.Logger here - creates infinite loop
    } catch (error) {
      console.log('[Properties._loadPropertiesSheet] CRITICAL ERROR: ' + error);
      // NOTE: NEVER use Common.Logger here - it creates infinite loop!
      // Common.Logger tries to read config from Properties, which calls this function again
      throw new Error(`Properties sheet not configured in Bootstrap. Add a row with Reference='Properties' pointing to your Properties sheet. Original error: ${error && error.message ? error.message : String(error)}`);
    } finally {
      // Always reset the guard flag, even if an error occurred
      _isLoadingProperties = false;
    }
  }

  /**
   * Check if a property key represents a code-internal property (including dynamic keys like VOTING_TOKEN_*)
   * @param {string} propertyName
   * @returns {boolean}
   * @private
   */
  function _isCodeInternalProperty(propertyName) {
    if (CODE_INTERNAL_PROPERTIES.has(propertyName)) {
      return true;
    }
    // Check for dynamic code-internal keys
    if (propertyName.startsWith('VOTING_TOKEN_')) {
      return true;
    }
    return false;
  }

  return {
    /**
     * Get a property value. User-configurable properties are read from Properties sheet (with Script Properties fallback).
     * Code-internal properties always come from Script Properties.
     * 
     * @param {string} propertyName - Name of property to retrieve
     * @param {string} [defaultValue] - Default value if property not found
     * @returns {string|null} Property value or default
     */
    getProperty: function(propertyName, defaultValue = null) {
      // Code-internal properties always come from Script Properties
      if (_isCodeInternalProperty(propertyName)) {
        return PropertiesService.getScriptProperties().getProperty(propertyName) || defaultValue;
      }

      // Load properties sheet into cache if not already loaded
      if (_propertyCache === null) {
        _loadPropertiesSheet();
      }

      // Check Properties sheet cache first
      if (_propertyCache && propertyName in _propertyCache) {
        return _propertyCache[propertyName];
      }

      // Fall back to Script Properties (for backward compatibility during migration)
      const scriptValue = PropertiesService.getScriptProperties().getProperty(propertyName);
      if (scriptValue !== null) {
        return scriptValue;
      }

      return defaultValue;
    },

    /**
     * Get a numeric property value
     * @param {string} propertyName - Name of property to retrieve
     * @param {number} [defaultValue] - Default value if property not found or not a number
     * @returns {number} Property value as number or default
     */
    getNumberProperty: function(propertyName, defaultValue = 0) {
      const value = this.getProperty(propertyName);
      if (value === null) return defaultValue;
      const num = Number(value);
      return isNaN(num) ? defaultValue : num;
    },

    /**
     * Get a boolean property value (checks for 'true' case-insensitive)
     * @param {string} propertyName - Name of property to retrieve
     * @param {boolean} [defaultValue] - Default value if property not found
     * @returns {boolean} Property value as boolean or default
     */
    getBooleanProperty: function(propertyName, defaultValue = false) {
      const value = this.getProperty(propertyName);
      if (value === null) return defaultValue;
      return String(value).toLowerCase() === 'true';
    },

    /**
     * Set a code-internal property (Script Properties only).
     * User-configurable properties should be set directly in the Properties sheet.
     * 
     * @param {string} propertyName - Name of property
     * @param {string} value - Value to set
     * @throws {Error} If attempting to set a user-configurable property via this method
     */
    setCodeInternalProperty: function(propertyName, value) {
      if (!_isCodeInternalProperty(propertyName)) {
        throw new Error(`Property '${propertyName}' is not a code-internal property. Set it in the Properties sheet instead.`);
      }
      PropertiesService.getScriptProperties().setProperty(propertyName, value);    },

    /**
     * Delete a code-internal property from Script Properties
     * @param {string} propertyName - Name of property to delete
     * @throws {Error} If attempting to delete a user-configurable property
     */
    deleteCodeInternalProperty: function(propertyName) {
      if (!_isCodeInternalProperty(propertyName)) {
        throw new Error(`Property '${propertyName}' is not a code-internal property. Remove it from the Properties sheet instead.`);
      }
      PropertiesService.getScriptProperties().deleteProperty(propertyName);
    },

    /**
     * Clear the property cache. Call if Properties sheet is modified during execution.
     */
    clearCache: function() {
      _propertyCache = null;
    },

    /**
     * Get all user-configurable properties as an object (for debugging/display)
     * @returns {Object.<string, string>} Map of property names to values
     */
    getAllUserProperties: function() {
      if (_propertyCache === null) {
        _loadPropertiesSheet();
      }
      return { ..._propertyCache }; // Return copy to prevent mutation
    }
  };
})();

// Node.js export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Properties: Common.Config.Properties };
}
