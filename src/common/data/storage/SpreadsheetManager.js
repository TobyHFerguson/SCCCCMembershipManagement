Common.Data.Storage = {}
Common.Data.Storage.SpreadsheetManager = (function () {
  let sheets;
  function _initializeSheets() {
    try {
      // @ts-ignore - Logger is implemented in separate file
      Common.Logger.info('SpreadsheetManager', 'Starting _initializeSheets - getting Bootstrap fiddler');
      
      // Use the container spreadsheet instead of hardcoded ID
      const bootStrap = bmPreFiddler.PreFiddler().getFiddler({sheetName: 'Bootstrap', createIfMissing: false }).getData();
      
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
        // @ts-ignore - Logger is implemented in separate file
        Common.Logger.info('SpreadsheetManager', `Getting fiddler for sheet: ${sheetName}`);
        
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
        
        const fiddler = bmPreFiddler.PreFiddler().getFiddler(sheets[sheetName]).needFormulas();
        
        // @ts-ignore - Logger is implemented in separate file
        Common.Logger.info('SpreadsheetManager', `Successfully created fiddler for ${sheetName}`);
        
        return fiddler;
      } catch (error) {
        // @ts-ignore - Logger is implemented in separate file
        Common.Logger.error('SpreadsheetManager', `Error getting fiddler for ${sheetName}`, error);
        throw error;
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