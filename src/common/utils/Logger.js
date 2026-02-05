/**
 * AppLogger - Production-friendly logging utility for Google Apps Script
 * Provides multiple logging destinations for debugging deployed applications
 * 
 * Named AppLogger (not Logger) to avoid conflict with GAS built-in Logger.
 * 
 * FOUNDATIONAL FILE: This is a low-level foundational module (like Properties and SpreadsheetManager).
 * It MUST NOT create circular dependencies. Use console.log() for internal tracing, never AppLogger itself.
 * 
 * ARCHITECTURE: This module uses static configuration loaded once at initialization.
 * Call AppLogger.configure() AFTER Properties and SpreadsheetManager are ready
 * to load configuration from the Properties sheet.
 * 
 * Safe defaults allow logging to work even before configure() is called.
 * System Logs are managed through the Bootstrap process. The Bootstrap sheet should contain:
 * | Reference | iD | sheetName | createIfMissing |
 * | SystemLogs |  | System Logs | True |
 * 
 * Pattern: IIFE-wrapped class with static methods (per gas-best-practices.md)
 */

var AppLogger = (function() {
  const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
  };
  
  /**
   * Static logger configuration - initialized with safe defaults, updated via configure()
   * @type {Object}
   */
  let CONFIG = {
    CONSOLE_LOGGING: true,
    SHEET_LOGGING: true,  // Enabled by default for production logging
    SCRIPT_PROPERTIES: false,
    EMAIL_ERRORS: false,
    EMAIL_RECIPIENT: 'membership@sc3.club',
    NAMESPACES: '*'  // '*' = all namespaces, or comma-separated list: 'MembershipManagement,VotingService'
  };
  
  /**
   * Current log level - initialized with safe default, updated via configure()
   * @type {number}
   */
  let currentLogLevel = LOG_LEVELS.INFO;
  
  /**
   * Load configuration from Properties sheet
   * Call this AFTER Properties and SpreadsheetManager are initialized
   * Safe to call multiple times to refresh configuration
   */
  function loadConfiguration() {
    // Only load if Properties module is available and ready (flat class pattern)
    if (typeof Properties === 'undefined') {
      console.log('[Logger] Properties not available, using default configuration');
      return;
    }
    
    try {
      CONFIG.CONSOLE_LOGGING = Properties.getBooleanProperty('loggerConsoleLogging', true);
      CONFIG.SHEET_LOGGING = Properties.getBooleanProperty('loggerSheetLogging', false);
      CONFIG.SCRIPT_PROPERTIES = Properties.getBooleanProperty('loggerScriptProperties', false);
      CONFIG.EMAIL_ERRORS = Properties.getBooleanProperty('loggerEmailErrors', false);
      CONFIG.EMAIL_RECIPIENT = Properties.getProperty('loggerEmailRecipient', 'membership@sc3.club');
      CONFIG.NAMESPACES = Properties.getProperty('loggerNamespaces', '*');
      
      const levelName = Properties.getProperty('loggerLevel', 'INFO').toUpperCase();
      currentLogLevel = LOG_LEVELS[levelName] !== undefined ? LOG_LEVELS[levelName] : LOG_LEVELS.INFO;
      
      console.log('[Logger] Configuration loaded from Properties sheet');
    } catch (error) {
      // If Properties fails to load, keep using defaults
      console.log('[Logger] Failed to load configuration from Properties, using defaults: ' + error);
    }
  }
  
  /**
   * Check if a namespace/service is enabled for logging
   * @param {string} service - Service name (e.g., 'MembershipManagement', 'VotingService')
   * @returns {boolean} True if logging enabled for this namespace
   */
  function isNamespaceEnabled(service) {
    // '*' means log everything
    if (CONFIG.NAMESPACES === '*') return true;
    
    // Parse comma-separated list of enabled namespaces
    const enabledNamespaces = CONFIG.NAMESPACES.split(',').map(ns => ns.trim());
    
    // Check if service matches any enabled namespace (prefix match)
    return enabledNamespaces.some(ns => service.startsWith(ns));
  }
  
  /**
   * Formats a log message with timestamp and service info
   * @param {string} level - Log level (DEBUG, INFO, WARN, ERROR)
   * @param {string} service - Service name
   * @param {string} message - Log message
   * @param {any} data - Optional additional data (JUSTIFIED: arbitrary debugging data, JSON-serialized)
   * @returns {string} Formatted message
   */
  function formatMessage(level, service, message, data) {
    const timestamp = new Date().toISOString();
    const baseMessage = `[${timestamp}] [${level}] [${service}] ${message}`;
    
    if (data !== undefined) {
      return `${baseMessage} | Data: ${JSON.stringify(data)}`;
    }
    
    return baseMessage;
  }
  
  /**
   * Gets the SystemLogs sheet from SpreadsheetManager
   * @returns {GoogleAppsScript.Spreadsheet.Sheet|null} The SystemLogs sheet or null if unavailable
   * @private
   */
  function getLogSheet() {
    try {
      // Check if SpreadsheetManager is available (flat class pattern)
      if (typeof SpreadsheetManager === 'undefined') {
        console.log('[AppLogger.getLogSheet] SpreadsheetManager not available yet, using fallback');
        return null;
      }
      
      // Get the sheet for SystemLogs from Bootstrap configuration
      const sheet = SpreadsheetManager.getSheet('SystemLogs');
      return sheet;
    } catch (error) {
      // If SystemLogs is not configured in Bootstrap or any other error, log and return null
      console.log('[AppLogger.getLogSheet] Failed to get SystemLogs sheet: ' + (error && error.message ? error.message : String(error)));
      return null;
    }
  }
  
  /**
   * Gets the container spreadsheet ID from script properties or current binding
   * @returns {string|null} The container spreadsheet ID
   * @deprecated This function is kept for backward compatibility but should not be needed with SpreadsheetManager
   */
  function getContainerSpreadsheetId() {
    try {
      // First try to get from script properties (if set during setup)
      const properties = PropertiesService.getScriptProperties();
      let containerId = properties.getProperty('CONTAINER_SPREADSHEET_ID');
      
      if (!containerId) {
        // Fallback: try to get from current active spreadsheet if we're in normal context
        try {
          const activeSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
          if (activeSpreadsheet) {
            containerId = activeSpreadsheet.getId();
            // Cache it for future use
            properties.setProperty('CONTAINER_SPREADSHEET_ID', containerId);
          }
        } catch (e) {
          // We might be in a trigger context where getActiveSpreadsheet() doesn't work
        }
      }
      
      return containerId;
    } catch (error) {
      console.log('[AppLogger.getContainerSpreadsheetId] Failed: ' + error);
      return null;
    }
  }

  /**
   * Gets or creates the logging sheet in the container spreadsheet
   * DEPRECATED: This is a fallback for when SpreadsheetManager is not available
   * @returns {GoogleAppsScript.Spreadsheet.Sheet|null} The log sheet
   * @private
   */
  function getLogSheetFallback() {
    try {
      let spreadsheet;
      
      // Try to get the container spreadsheet ID
      const containerId = getContainerSpreadsheetId();
      
      if (containerId) {
        try {
          // Open the specific container spreadsheet by ID
          spreadsheet = SpreadsheetApp.openById(containerId);
        } catch (e) {
          // If that fails, fall back to active spreadsheet
          spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
        }
      } else {
        // Fallback to active spreadsheet
        spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      }
      
      let logSheet = spreadsheet.getSheetByName('System_Logs');
      
      if (!logSheet) {
        logSheet = spreadsheet.insertSheet('System_Logs');
        // Setup headers
        logSheet.getRange(1, 1, 1, 5).setValues([['Timestamp', 'Level', 'Service', 'Message', 'Data']]);
        logSheet.getRange(1, 1, 1, 5).setFontWeight('bold');
        logSheet.setFrozenRows(1);
      }
      
      return logSheet;
    } catch (error) {
      console.log('[AppLogger.getLogSheetFallback] Failed: ' + error);
      return null;
    }
  }
  
  /**
   * Logs a message to the sheet using SpreadsheetManager
   * @param {string} level - Log level
   * @param {string} service - Service name
   * @param {string} message - Message
   * @param {any} data - Optional data (JUSTIFIED: arbitrary debugging data, JSON-serialized)
   */
  function logToSheet(level, service, message, data) {
    try {
      // Try to use the sheet-based approach
      const logSheet = getLogSheet();
      
      if (logSheet) {
        const timestamp = new Date();
        
        let dataStr = '';
        if (data !== undefined && data !== null) {
          // If data has error-like properties prefer a compact object with message/stack (and name if present)
          if (typeof data === 'object' && (data.message || data.stack)) {
            const errPart = {};
            if (data.name) errPart.name = data.name;
            if (data.message) errPart.message = data.message;
            if (data.stack) errPart.stack = data.stack;
            try {
              dataStr = JSON.stringify(errPart);
            } catch (e) {
              dataStr = String(errPart);
            }
          } else {
            try {
              dataStr = JSON.stringify(data);
            } catch (e) {
              dataStr = String(data);
            }
          }
        }

        logSheet.appendRow([timestamp, level, service, message, dataStr]);
        
        // Auto-rotate logs if they get too long (keep last 1000 entries)
        const lastRow = logSheet.getLastRow();
        if (lastRow > 1001) { // Header + 1000 data rows
          logSheet.deleteRows(2, lastRow - 1001);
        }
        
      } else {
        // Fallback to legacy sheet-based approach if sheet not available
        const fallbackSheet = getLogSheetFallback();
        if (!fallbackSheet) return;
        
        const timestamp = new Date();
        
        let dataStr = '';
        if (data !== undefined && data !== null) {
          // If data has error-like properties prefer a compact object with message/stack (and name if present)
          if (typeof data === 'object' && (data.message || data.stack)) {
            const errPart = {};
            if (data.name) errPart.name = data.name;
            if (data.message) errPart.message = data.message;
            if (data.stack) errPart.stack = data.stack;
            try {
              dataStr = JSON.stringify(errPart);
            } catch (e) {
              dataStr = String(errPart);
            }
          } else {
            try {
              dataStr = JSON.stringify(data);
            } catch (e) {
              dataStr = String(data);
            }
          }
        }

        fallbackSheet.appendRow([timestamp, level, service, message, dataStr]);
        
        // Auto-rotate logs if they get too long (keep last 1000 entries)
        const lastRow = fallbackSheet.getLastRow();
        if (lastRow > 1001) { // Header + 1000 data rows
          fallbackSheet.deleteRows(2, lastRow - 1001);
        }
      }
    } catch (error) {
      console.log('[AppLogger.logToSheet] Failed: ' + (error && error.message ? error.message : String(error)));
    }
  }
  
  /**
   * Logs to Script Properties (limited storage)
   * @param {string} level - Log level
   * @param {string} service - Service name
   * @param {string} message - Message
   */
  function logToProperties(level, service, message) {
    try {
      const properties = PropertiesService.getScriptProperties();
      const logKey = `log_${Date.now()}`;
      const logEntry = JSON.stringify({
        timestamp: new Date().toISOString(),
        level: level,
        service: service,
        message: message
      });
      
      properties.setProperty(logKey, logEntry);
      
      // Clean up old logs (keep last 50)
      const allProperties = properties.getProperties();
      const logKeys = Object.keys(allProperties)
        .filter(key => key.startsWith('log_'))
        .sort()
        .reverse();
      
      if (logKeys.length > 50) {
        const keysToDelete = logKeys.slice(50);
        keysToDelete.forEach(key => properties.deleteProperty(key));
      }
    } catch (error) {
      console.error('Failed to log to properties:', error);
    }
  }
  
  /**
   * Sends error notifications via email
   * @param {string} service - Service name
   * @param {string} message - Error message
   * @param {any} error - Error object or additional data (JUSTIFIED: arbitrary error data, JSON-serialized)
   */
  function sendErrorEmail(service, message, error) {
    try {
      if (!CONFIG.EMAIL_ERRORS || !CONFIG.EMAIL_RECIPIENT) return;
      
      const subject = `[SCCCC] System Error in ${service}`;
      const body = `
        Error occurred in service: ${service}
        
        Message: ${message}
        
        Time: ${new Date().toISOString()}
        
        Additional Details: ${error ? JSON.stringify(error, null, 2) : 'None'}
        
        This is an automated notification from the SCCCC Management System.
      `;
      
      GmailApp.sendEmail(CONFIG.EMAIL_RECIPIENT, subject, body);
    } catch (emailError) {
      console.error('Failed to send error email:', emailError);
    }
  }
  
  /**
   * Core logging function
   * @param {string} level - Log level
   * @param {string} service - Service name (e.g., 'MembershipManagement', 'VotingService')
   * @param {string} message - Message
   * @param {any} data - Optional additional data (JUSTIFIED: arbitrary debugging data, JSON-serialized)
   */
  function log(level, service, message, data) {
    const levelValue = LOG_LEVELS[level] || LOG_LEVELS.INFO;
    
    // Check if we should log this level
    if (levelValue < currentLogLevel) return;
    
    // Check namespace filtering
    if (!isNamespaceEnabled(service)) return;
    
    // Console logging (only works in script editor)
    if (CONFIG.CONSOLE_LOGGING) {
      const formattedMessage = formatMessage(level, service, message, data);
      console.log(formattedMessage);
    }
    
    // Sheet logging
    if (CONFIG.SHEET_LOGGING) {
      logToSheet(level, service, message, data);
    }
    
    // Script Properties logging
    if (CONFIG.SCRIPT_PROPERTIES) {
      logToProperties(level, service, message);
    }
    
    // Email for errors
    if (level === 'ERROR' && CONFIG.EMAIL_ERRORS) {
      sendErrorEmail(service, message, data);
    }
  }
  
  class AppLogger {
    /**
     * Log a debug message
     * @param {string} service - Service name (e.g., 'MembershipManagement')
     * @param {string} message - Log message
     * @param {any} [data] - Optional additional data (JUSTIFIED: arbitrary debugging data, JSON-serialized)
     */
    static debug(service, message, data) {
      log('DEBUG', service, message, data);
    }
    
    /**
     * Log an info message
     * @param {string} service - Service name (e.g., 'MembershipManagement')
     * @param {string} message - Log message
     * @param {any} [data] - Optional additional data (JUSTIFIED: arbitrary debugging data, JSON-serialized)
     */
    static info(service, message, data) {
      log('INFO', service, message, data);
    }
    
    /**
     * Log a warning message
     * @param {string} service - Service name (e.g., 'MembershipManagement')
     * @param {string} message - Log message
     * @param {any} [data] - Optional additional data (JUSTIFIED: arbitrary debugging data, JSON-serialized)
     */
    static warn(service, message, data) {
      log('WARN', service, message, data);
    }
    
    /**
     * Log an error message
     * @param {string} service - Service name (e.g., 'MembershipManagement')
     * @param {string} message - Log message
     * @param {any} [data] - Optional additional data (JUSTIFIED: arbitrary debugging data, JSON-serialized)
     */
    static error(service, message, data) {
      log('ERROR', service, message, data);
    }
    
    /**
     * Load/reload logger configuration from Properties sheet
     * Call this AFTER Properties and SpreadsheetManager are initialized
     * Safe to call multiple times
     * 
     * @example
     * // In your initialization code (e.g., onOpen trigger):
     * AppLogger.configure();
     */
    static configure() {
      loadConfiguration();
    }
    
    /**
     * Set log level programmatically (overrides Properties sheet value until next configure() call)
     * @param {string} level - 'DEBUG', 'INFO', 'WARN', or 'ERROR'
     * @deprecated Prefer setting loggerLevel in Properties sheet and calling configure()
     */
    static setLevel(level) {
      const levelUpper = level.toUpperCase();
      if (LOG_LEVELS[levelUpper] !== undefined) {
        currentLogLevel = LOG_LEVELS[levelUpper];
        console.log('[Logger] Log level set to: ' + levelUpper);
      } else {
        console.log('[Logger] Invalid log level: ' + level);
      }
    }
    
    /**
     * Get all log entries
     * @returns {Array<Array<any>>} Log entries as [Timestamp, Level, Service, Message, Data]
     */
    static getLogs() {
      try {
        const logSheet = getLogSheet();
        if (logSheet) {
          // Use sheet to get log data
          const lastRow = logSheet.getLastRow();
          if (lastRow <= 1) return [];
          
          return logSheet.getRange(2, 1, lastRow - 1, 5).getValues();
        } else {
          // Fallback to legacy approach
          const fallbackSheet = getLogSheetFallback();
          if (!fallbackSheet) return [];
          
          const lastRow = fallbackSheet.getLastRow();
          if (lastRow <= 1) return [];
          
          return fallbackSheet.getRange(2, 1, lastRow - 1, 5).getValues();
        }
      } catch (error) {
        console.log('[AppLogger.getLogs] Failed: ' + (error && error.message ? error.message : String(error)));
        return [];
      }
    }
    
    /**
     * Clear all log entries
     */
    static clearLogs() {
      try {
        const logSheet = getLogSheet();
        if (logSheet) {
          // Use sheet to clear log data
          if (logSheet.getLastRow() > 1) {
            logSheet.getRange(2, 1, logSheet.getLastRow() - 1, 5).clearContent();
          }
        } else {
          // Fallback to legacy approach
          const fallbackSheet = getLogSheetFallback();
          if (fallbackSheet && fallbackSheet.getLastRow() > 1) {
            fallbackSheet.getRange(2, 1, fallbackSheet.getLastRow() - 1, 5).clearContent();
          }
        }
      } catch (error) {
        console.log('[AppLogger.clearLogs] Failed: ' + (error && error.message ? error.message : String(error)));
      }
    }
    
    /**
     * Set the container spreadsheet ID for logging
     * @param {string} spreadsheetId - Spreadsheet ID
     */
    static setContainerSpreadsheet(spreadsheetId) {
      try {
        const properties = PropertiesService.getScriptProperties();
        properties.setProperty('CONTAINER_SPREADSHEET_ID', spreadsheetId);
      } catch (error) {
        console.error('Failed to set container spreadsheet ID:', error);
      }
    }
  }
  
  return AppLogger;
})();


// Node.js export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AppLogger;
}
