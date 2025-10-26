/**
 * Production-friendly logging utility for Google Apps Script
 * Provides multiple logging destinations for debugging deployed applications
 */

(function() {
  // Configuration - set to true to enable different logging methods
  const CONFIG = {
    CONSOLE_LOGGING: true,        // Standard console (only works in editor)
    SHEET_LOGGING: true,          // Log to a sheet in the container spreadsheet
    SCRIPT_PROPERTIES: false,     // Log to Script Properties (limited storage)
    EMAIL_ERRORS: false,          // Email critical errors (configure recipient)
    EMAIL_RECIPIENT: 'your-email@example.com'
  };

  const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
  };
  
  let currentLogLevel = LOG_LEVELS.INFO;
  
  /**
   * Formats a log message with timestamp and service info
   * @param {string} level - Log level (DEBUG, INFO, WARN, ERROR)
   * @param {string} service - Service name
   * @param {string} message - Log message
   * @param {any} data - Optional additional data
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
   * Gets the container spreadsheet ID from script properties or current binding
   * @returns {string|null} The container spreadsheet ID
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
      console.error('Failed to get container spreadsheet ID:', error);
      return null;
    }
  }

  /**
   * Gets or creates the logging sheet in the container spreadsheet
   * @returns {GoogleAppsScript.Spreadsheet.Sheet|null} The log sheet
   */
  function getLogSheet() {
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
      console.error('Failed to get/create log sheet:', error);
      return null;
    }
  }
  
  /**
   * Logs a message to the sheet
   * @param {string} level - Log level
   * @param {string} service - Service name
   * @param {string} message - Message
   * @param {any} data - Optional data
   */
  function logToSheet(level, service, message, data) {
    try {
      const logSheet = getLogSheet();
      if (!logSheet) return;
      
      const timestamp = new Date();
      const dataStr = data !== undefined ? JSON.stringify(data) : '';
      
      logSheet.appendRow([timestamp, level, service, message, dataStr]);
      
      // Auto-rotate logs if they get too long (keep last 1000 entries)
      const lastRow = logSheet.getLastRow();
      if (lastRow > 1001) { // Header + 1000 data rows
        logSheet.deleteRows(2, lastRow - 1001);
      }
    } catch (error) {
      console.error('Failed to log to sheet:', error);
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
   * @param {any} error - Error object or additional data
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
   * @param {string} service - Service name
   * @param {string} message - Message
   * @param {any} data - Optional additional data
   */
  function log(level, service, message, data) {
    const levelValue = LOG_LEVELS[level] || LOG_LEVELS.INFO;
    
    // Check if we should log this level
    if (levelValue < currentLogLevel) return;
    
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
  
  // Populate Common.Logger with the implementation
  // @ts-ignore - Common.Logger is defined in namespace declaration
  Common.Logger.debug = function(service, message, data) {
    log('DEBUG', service, message, data);
  };
  
  // @ts-ignore
  Common.Logger.info = function(service, message, data) {
    log('INFO', service, message, data);
  };
  
  // @ts-ignore
  Common.Logger.warn = function(service, message, data) {
    log('WARN', service, message, data);
  };
  
  // @ts-ignore
  Common.Logger.error = function(service, message, data) {
    log('ERROR', service, message, data);
  };
  
  // @ts-ignore
  Common.Logger.setLevel = function(level) {
    if (LOG_LEVELS[level.toUpperCase()] !== undefined) {
      currentLogLevel = level;
    }
  };
  
  // @ts-ignore
  Common.Logger.configure = function(config) {
    Object.assign(CONFIG, config);
  };
  
  // @ts-ignore
  Common.Logger.getLogs = function() {
    const logSheet = getLogSheet();
    if (!logSheet) return [];
    
    const lastRow = logSheet.getLastRow();
    if (lastRow <= 1) return [];
    
    return logSheet.getRange(2, 1, lastRow - 1, 5).getValues();
  };
  
  // @ts-ignore
  Common.Logger.clearLogs = function() {
    const logSheet = getLogSheet();
    if (logSheet && logSheet.getLastRow() > 1) {
      logSheet.getRange(2, 1, logSheet.getLastRow() - 1, 5).clearContent();
    }
  };
  
  // @ts-ignore
  Common.Logger.setContainerSpreadsheet = function(spreadsheetId) {
    try {
      const properties = PropertiesService.getScriptProperties();
      properties.setProperty('CONTAINER_SPREADSHEET_ID', spreadsheetId);
    } catch (error) {
      console.error('Failed to set container spreadsheet ID:', error);
    }
  };
})();