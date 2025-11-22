Common.Data.Storage = {}
Common.Data.Storage.SpreadsheetManager = (function () {
  let sheets;
  const __fiddlerCache = {}; // Per-execution cache for fiddler instances
  
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
          // We might be in a trigger context where getActiveSpreadsheet() doesn't work reliably
          // @ts-ignore - Logger is implemented in separate file
          Common.Logger.warn('SpreadsheetManager', 'Could not get active spreadsheet in current context', e);
        }
      }
      
      return containerId;
    } catch (error) {
      // @ts-ignore - Logger is implemented in separate file
      Common.Logger.error('SpreadsheetManager', 'Failed to get container spreadsheet ID', error);
      return null;
    }
  }
  
  function _initializeSheets() {
    try {
      // @ts-ignore - Logger is implemented in separate file
      Common.Logger.info('SpreadsheetManager', 'Starting _initializeSheets - getting Bootstrap fiddler');
      
      // Get the container spreadsheet ID to ensure we're accessing the correct spreadsheet
      const containerSpreadsheetId = getContainerSpreadsheetId();
      
      // @ts-ignore - Logger is implemented in separate file
      Common.Logger.info('SpreadsheetManager', 'Using container spreadsheet ID', {containerSpreadsheetId});
      
      // Use the container spreadsheet instead of current context
      const fiddlerConfig = containerSpreadsheetId 
        ? {id: containerSpreadsheetId, sheetName: 'Bootstrap', createIfMissing: false}
        : {sheetName: 'Bootstrap', createIfMissing: false};
        
      const bootStrap = bmPreFiddler.PreFiddler().getFiddler(fiddlerConfig).getData();
      
      // @ts-ignore - Logger is implemented in separate file
      Common.Logger.info('SpreadsheetManager', 'Successfully got Bootstrap data', {
        rowCount: bootStrap ? bootStrap.length : 0,
        sampleData: bootStrap ? bootStrap.slice(0, 2) : null
      });
      
      sheets = Object.fromEntries(bootStrap.map(row => [row.Reference, row]));
      
      // @ts-ignore - Logger is implemented in separate file
      Common.Logger.info('SpreadsheetManager', 'Successfully initialized sheets', {
        sheetNames: Object.keys(sheets)
      });
    } catch (error) {
      // @ts-ignore - Logger is implemented in separate file
      Common.Logger.error('SpreadsheetManager', 'Error in _initializeSheets', error);
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

  return {


    /**
  * Gets a fiddler based on the sheet name.
  * @param {String} sheetName - the name of the sheet.
  * @returns {Fiddler} - The fiddler.
  */
    getFiddler: (sheetName) => {
      try {
        // Check cache first
        const containerSpreadsheetId = getContainerSpreadsheetId();
        const cacheKey = `${containerSpreadsheetId || 'default'}::${sheetName}`;
        
        if (__fiddlerCache[cacheKey]) {
          // @ts-ignore - Logger is implemented in separate file
          Common.Logger.info('SpreadsheetManager', `Returning cached fiddler for sheet: ${sheetName}`);
          return __fiddlerCache[cacheKey];
        }
        
        // @ts-ignore - Logger is implemented in separate file
        Common.Logger.info('SpreadsheetManager', `Creating new fiddler for sheet: ${sheetName}`);
        
        if (!sheets) {
          // @ts-ignore - Logger is implemented in separate file
          Common.Logger.info('SpreadsheetManager', 'Initializing sheets from Bootstrap');
          _initializeSheets();
        }
        
        const sheet = sheets[sheetName];
        if (!sheet) {
          // @ts-ignore - Logger is implemented in separate file
          Common.Logger.error('SpreadsheetManager', `Sheet name ${sheetName} not found in Bootstrap`, {
            requestedSheet: sheetName,
            availableSheets: Object.keys(sheets)
          });
          throw new Error(`Sheet name ${sheetName} not found in Bootstrap`);
        }
        
        // @ts-ignore - Logger is implemented in separate file
        Common.Logger.info('SpreadsheetManager', `Found sheet configuration for ${sheetName}`, sheet);
        
        // Ensure we use the correct spreadsheet context
        const sheetConfig = sheets[sheetName];
        let fiddlerConfig;
        
        if (sheetConfig.id) {
          // If the sheet config has an ID, use it (external spreadsheet)
          fiddlerConfig = sheetConfig;
        } else {
          // If no ID in config, add container spreadsheet ID (local sheet)
          const containerSpreadsheetId = getContainerSpreadsheetId();
          fiddlerConfig = containerSpreadsheetId 
            ? {...sheetConfig, id: containerSpreadsheetId}
            : sheetConfig;
        }
        
        // @ts-ignore - Logger is implemented in separate file
        Common.Logger.info('SpreadsheetManager', `Using fiddler configuration for ${sheetName}`, fiddlerConfig);
        
        const fiddler = bmPreFiddler.PreFiddler().getFiddler(fiddlerConfig).needFormulas();
        
        // Cache the fiddler for reuse in this execution
        __fiddlerCache[cacheKey] = fiddler;
        
        // @ts-ignore - Logger is implemented in separate file
        Common.Logger.info('SpreadsheetManager', `Successfully created and cached fiddler for ${sheetName}`);
        
        return fiddler;
      } catch (error) {
        // @ts-ignore - Logger is implemented in separate file
        Common.Logger.error('SpreadsheetManager', `Error getting fiddler for ${sheetName}`, error);
        throw error;
      }
    },

    /**
     * Clear cached fiddler(s). Call when external code may have modified the sheet.
     * @param {string} [sheetName] - Specific sheet to clear, or omit to clear all
     */
    clearFiddlerCache: (sheetName) => {
      if (!sheetName) {
        // @ts-ignore - Logger is implemented in separate file
        Common.Logger.info('SpreadsheetManager', 'Clearing all cached fiddlers');
        for (const k in __fiddlerCache) delete __fiddlerCache[k];
        return;
      }
      
      const containerSpreadsheetId = getContainerSpreadsheetId();
      const cacheKey = `${containerSpreadsheetId || 'default'}::${sheetName}`;
      
      if (__fiddlerCache[cacheKey]) {
        // @ts-ignore - Logger is implemented in separate file
        Common.Logger.info('SpreadsheetManager', `Clearing cached fiddler for ${sheetName}`);
        delete __fiddlerCache[cacheKey];
      }
    },

    /**
      * Returns the data from a fiddler with formulas merged into it.
      * @template
     * @param {Fiddler<T>} fiddler 
     * @returns {T[]} - The merged data.
     */

    getDataWithFormulas: (fiddler) => {
      fiddler.needFormulas();
      return _combineArrays(fiddler.getFormulaData(), fiddler.getData());
    },



    /**
     * Converts links in a sheet to hyperlinks.
     * @param {String} sheetName - The name of the sheet.
     */
    convertLinks: (sheetName) => {
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
  }
})()