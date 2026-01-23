// @ts-check
/// <reference path="../../types/global.d.ts" />

/**
 * FeatureFlags - Simple feature flag management for Google Apps Script
 * 
 * Named FeatureFlags (not Common.Config.FeatureFlags) per namespace flattening.
 * 
 * CRITICAL: This module is in Layer 0 (Foundation).
 * - MUST NOT use AppLogger.* (creates circular dependency)
 * - MUST use Logger.log() (GAS built-in) only for tracing
 * 
 * Pattern: IIFE-wrapped class with static methods (per gas-best-practices.md)
 */

/**
 * FeatureFlagsManager - Pure logic for feature flag operations
 * All business logic is here and is fully testable.
 */
var FeatureFlagsManager = (function() {
  class FeatureFlagsManager {
    /**
     * Validate a feature flag name
     * @param {string} flagName - The flag name to validate
     * @returns {{valid: boolean, error?: string}}
     */
    static validateFlagName(flagName) {
      if (!flagName || typeof flagName !== 'string') {
        return { valid: false, error: 'Flag name must be a non-empty string' };
      }
      if (flagName.trim() !== flagName) {
        return { valid: false, error: 'Flag name cannot have leading/trailing whitespace' };
      }
      if (!/^[A-Z][A-Z0-9_]*$/.test(flagName)) {
        return { valid: false, error: 'Flag name must be uppercase with underscores (e.g., FEATURE_NEW_AUTH)' };
      }
      if (!flagName.startsWith('FEATURE_')) {
        return { valid: false, error: 'Flag name must start with FEATURE_ prefix' };
      }
      return { valid: true };
    }

    /**
     * Parse a boolean value from string
     * @param {string|boolean|null|undefined} value - The value to parse
     * @param {boolean} defaultValue - Default value if parsing fails
     * @returns {boolean}
     */
    static parseBoolean(value, defaultValue) {
      if (value === null || value === undefined) {
        return defaultValue;
      }
      if (typeof value === 'boolean') {
        return value;
      }
      const strValue = String(value).toLowerCase().trim();
      if (strValue === 'true' || strValue === '1' || strValue === 'yes' || strValue === 'on') {
        return true;
      }
      if (strValue === 'false' || strValue === '0' || strValue === 'no' || strValue === 'off') {
        return false;
      }
      return defaultValue;
    }

    /**
     * Format a flag value for storage
     * @param {boolean} value - The boolean value
     * @returns {string}
     */
    static formatForStorage(value) {
      return value ? 'true' : 'false';
    }

    /**
     * Check if a feature should be enabled based on flag value and environment
     * @param {boolean} flagValue - Current flag value
     * @param {boolean} isProduction - Whether running in production
     * @param {boolean} [forceEnabled=false] - Force enable regardless of flag
     * @returns {boolean}
     */
    static shouldEnableFeature(flagValue, isProduction, forceEnabled = false) {
      if (forceEnabled) {
        return true;
      }
      return flagValue;
    }

    /**
     * Generate a summary of all feature flags
     * @param {Record<string, boolean>} flags - Map of flag names to values
     * @returns {{enabled: string[], disabled: string[], total: number}}
     */
    static summarizeFlags(flags) {
      const enabled = [];
      const disabled = [];
      
      for (const [name, value] of Object.entries(flags)) {
        if (value) {
          enabled.push(name);
        } else {
          disabled.push(name);
        }
      }
      
      return {
        enabled: enabled.sort(),
        disabled: disabled.sort(),
        total: enabled.length + disabled.length
      };
    }
  }
  
  return FeatureFlagsManager;
})();

/**
 * Known feature flags with their default values
 * @type {Record<string, {name: string, defaultValue: boolean, description?: string}>}
 */
var FEATURE_FLAGS_CONFIG = {
  'FEATURE_USE_NEW_AUTH': {
    name: 'FEATURE_USE_NEW_AUTH',
    defaultValue: false,
    description: 'Enable new verification code authentication (SPA migration)'
  },
  'FEATURE_SPA_MODE': {
    name: 'FEATURE_SPA_MODE',
    defaultValue: false,
    description: 'Enable Single-Page Application mode for web services'
  }
};

/**
 * FeatureFlags - GAS layer for feature flag storage and retrieval
 * Provides persistent storage via Script Properties
 */
var FeatureFlags = (function() {
  class FeatureFlags {
    /**
     * Get a feature flag value
     * @param {string} flagName - Name of the feature flag (must start with FEATURE_)
     * @param {boolean} [defaultValue=false] - Default value if flag is not set
     * @returns {boolean} The feature flag value
     */
    static isEnabled(flagName, defaultValue = false) {
      // PURE: Validate flag name
      const validation = FeatureFlagsManager.validateFlagName(flagName);
      if (!validation.valid) {
        Logger.log('[FeatureFlags.isEnabled] Invalid flag name: ' + flagName + ' - ' + validation.error);
        return defaultValue;
      }

      // Use known flag default if available
      const knownFlag = FEATURE_FLAGS_CONFIG[flagName];
      const effectiveDefault = knownFlag ? knownFlag.defaultValue : defaultValue;

      try {
        // GAS: Read from Script Properties
        const props = PropertiesService.getScriptProperties();
        const value = props.getProperty(flagName);
        
        // PURE: Parse boolean value
        return FeatureFlagsManager.parseBoolean(value, effectiveDefault);
      } catch (error) {
        // NOTE: Don't use AppLogger here - Layer 0 file
        Logger.log('[FeatureFlags.isEnabled] Error reading flag ' + flagName + ': ' + error);
        return effectiveDefault;
      }
    }

    /**
     * Set a feature flag value
     * @param {string} flagName - Name of the feature flag (must start with FEATURE_)
     * @param {boolean} value - Value to set
     * @returns {{success: boolean, error?: string}}
     */
    static setFlag(flagName, value) {
      // PURE: Validate flag name
      const validation = FeatureFlagsManager.validateFlagName(flagName);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      try {
        // GAS: Write to Script Properties
        const props = PropertiesService.getScriptProperties();
        const storageValue = FeatureFlagsManager.formatForStorage(value);
        props.setProperty(flagName, storageValue);
        
        Logger.log('[FeatureFlags.setFlag] Set ' + flagName + ' = ' + storageValue);
        return { success: true };
      } catch (error) {
        Logger.log('[FeatureFlags.setFlag] Error setting flag ' + flagName + ': ' + error);
        return { success: false, error: String(error) };
      }
    }

    /**
     * Delete a feature flag
     * @param {string} flagName - Name of the feature flag to delete
     * @returns {{success: boolean, error?: string}}
     */
    static deleteFlag(flagName) {
      // PURE: Validate flag name
      const validation = FeatureFlagsManager.validateFlagName(flagName);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      try {
        // GAS: Delete from Script Properties
        const props = PropertiesService.getScriptProperties();
        props.deleteProperty(flagName);
        
        Logger.log('[FeatureFlags.deleteFlag] Deleted ' + flagName);
        return { success: true };
      } catch (error) {
        Logger.log('[FeatureFlags.deleteFlag] Error deleting flag ' + flagName + ': ' + error);
        return { success: false, error: String(error) };
      }
    }

    /**
     * Get all feature flags with their current values
     * @returns {Record<string, boolean>}
     */
    static getAllFlags() {
      const flags = {};
      
      try {
        // GAS: Read all Script Properties
        const props = PropertiesService.getScriptProperties();
        const allProps = props.getProperties();
        
        // Filter for FEATURE_ prefixed properties
        for (const [key, value] of Object.entries(allProps)) {
          if (key.startsWith('FEATURE_')) {
            flags[key] = FeatureFlagsManager.parseBoolean(value, false);
          }
        }
      } catch (error) {
        Logger.log('[FeatureFlags.getAllFlags] Error reading flags: ' + error);
      }
      
      return flags;
    }

    /**
     * Get a summary of all feature flags
     * @returns {{enabled: string[], disabled: string[], total: number}}
     */
    static getSummary() {
      const flags = FeatureFlags.getAllFlags();
      return FeatureFlagsManager.summarizeFlags(flags);
    }

    /**
     * Enable new authentication feature (convenience method)
     * @returns {{success: boolean, error?: string}}
     */
    static enableNewAuth() {
      return FeatureFlags.setFlag('FEATURE_USE_NEW_AUTH', true);
    }

    /**
     * Disable new authentication feature (emergency rollback)
     * @returns {{success: boolean, error?: string}}
     */
    static emergencyRollback() {
      const result = FeatureFlags.setFlag('FEATURE_USE_NEW_AUTH', false);
      if (result.success) {
        Logger.log('[FeatureFlags.emergencyRollback] New auth feature disabled - rollback complete');
      }
      return result;
    }

    /**
     * Check if new authentication is enabled
     * @returns {boolean}
     */
    static isNewAuthEnabled() {
      return FeatureFlags.isEnabled('FEATURE_USE_NEW_AUTH', false);
    }

    /**
     * Check if SPA mode is enabled
     * @returns {boolean}
     */
    static isSPAModeEnabled() {
      return FeatureFlags.isEnabled('FEATURE_SPA_MODE', false);
    }

    /**
     * Get known feature flags configuration
     * @returns {Record<string, {name: string, defaultValue: boolean, description?: string}>}
     */
    static getKnownFlags() {
      return { ...FEATURE_FLAGS_CONFIG };
    }
  }
  
  return FeatureFlags;
})();
// Node.js export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { 
    FeatureFlags: FeatureFlags,
    FeatureFlagsManager: FeatureFlagsManager
  };
}
