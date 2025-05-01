const SpreadsheetManager = (function () {
  let sheets;
  /**
* Gets a fiddler based on the sheet name.
* @param {String} sheetName - the name of the sheet.
* @returns {Fiddler} - The fiddler.
*/
  function getFiddler(sheetName) {
    if (!sheets) {
      initializeSheets();
    }
    const sheet = sheets[sheetName];
    if (!sheet) {
      throw new Error(`Sheet name ${sheetName} not found in Bootstrap`);
    }
    return bmPreFiddler.PreFiddler().getFiddler(sheets[sheetName]).needFormulas();
  }

  let actionSpecs, groupEmails;

  function getActionSpecs() {
    if (!actionSpecs) {
      initializeActionSpecs();
    }
    return actionSpecs;
  }

  function initializeSheets() {
    const bootStrap = bmPreFiddler.PreFiddler().getFiddler({ sheetName: 'Bootstrap', createIfMissing: false }).getData();
    sheets = Object.fromEntries(bootStrap.map(row => [row.Reference, row]));
  }
  function getGroupEmails() {
    if (!groupEmails) {
      groupEmails = getFiddler('GroupEmails').getData();
    }
    return groupEmails
  }

  function initializeActionSpecs() {
    convertLinks('Action Specs');
    // We use getDataWithFormulas_ because the Body of an ActionSpec may contain formulas with a URL.
    const actionSpecsAsArray = getDataWithFormulas(getFiddler('ActionSpecs'))
    actionSpecs = Object.fromEntries(actionSpecsAsArray.map(spec => [spec.Type, spec]));
    for (const actionSpec of Object.values(actionSpecs)) {
      let match = actionSpec.Body.match(/=hyperlink\("(https:\/\/docs.google.com\/document\/d\/[^"]+)"/);
      if (match) {
        let url = match[1];
        actionSpec.Body = DocsService.convertDocToHtml(url);
      }
    }
  }

  /**
    * Returns the data from a fiddler with formulas merged into it.
   * @param {fiddler} fiddler 
   * @returns {Array} - The merged data.
   */

  function getDataWithFormulas(fiddler) {
    fiddler.needFormulas();
    return combineArrays_(fiddler.getFormulaData(), fiddler.getData());
  }

  function getDataWithFormulasUNUSED(fiddler) {
    const data = fiddler.getData();
    const formulas = fiddler.getFormulas();
    const dataWithFormulas = data.map((row, rowIndex) => {
      return row.map((cell, colIndex) => {
        if (formulas[rowIndex][colIndex]) {
          return formulas[rowIndex][colIndex];
        }
        return cell;
      });
    });
    return dataWithFormulas;
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
  function combineArrays_(arr1, arr2) {
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

  /**
   * Converts links in a sheet to hyperlinks.
   * @param {String} sheetName - The name of the sheet.
   */
  function convertLinks(sheetName) {
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
  return {
    getActionSpecs,
    getGroupEmails,
    getFiddler,
    getDataWithFormulas,
    convertLinks
  }
})()