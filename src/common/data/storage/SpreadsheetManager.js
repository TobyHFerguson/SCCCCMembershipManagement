Common.Data.Storage = {}
Common.Data.Storage.SpreadsheetManager = (function () {
  let sheets;
  function _initializeSheets() {
    const bootStrap = bmPreFiddler.PreFiddler().getFiddler({id: '1EF3swXKvLv6jPz0cxC7J1al8m0vk9cWOx5t9W0LEy2g', sheetName: 'Bootstrap', createIfMissing: false }).getData();
    sheets = Object.fromEntries(bootStrap.map(row => [row.Reference, row]));
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
      if (!sheets) {
        _initializeSheets();
      }
      const sheet = sheets[sheetName];
      if (!sheet) {
        throw new Error(`Sheet name ${sheetName} not found in Bootstrap`);
      }
      return bmPreFiddler.PreFiddler().getFiddler(sheets[sheetName]).needFormulas();
    },






    /**
      * Returns the data from a fiddler with formulas merged into it.
     * @param {fiddler} fiddler 
     * @returns {Array} - The merged data.
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