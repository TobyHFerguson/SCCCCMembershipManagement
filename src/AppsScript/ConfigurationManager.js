const ConfigurationManager = (function () {
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
    const bootStrap = bmPreFiddler.PreFiddler().getFiddler({sheetName: 'Bootstrap', createIfMissing: false}).getData();
    sheets = Object.fromEntries(bootStrap.map(row => [row.Reference, row]));
  }
  function getGroupEmails() {
    if (!groupEmails) {
      groupEmails = getFiddler('GroupEmails').getData();
    }
    return groupEmails
  }

  function initializeActionSpecs() {
    convertLinks_('Action Specs');
    // We use getDataWithFormulas_ because the Body of an ActionSpec may contain formulas with a URL.
    const actionSpecsAsArray = getDataWithFormulas_(getFiddler('ActionSpecs'))
    actionSpecs = Object.fromEntries(actionSpecsAsArray.map(spec => [spec.Type, spec]));
    for (const actionSpec of Object.values(actionSpecs)) {
      let match = actionSpec.Body.match(/=hyperlink\("(https:\/\/docs.google.com\/document\/d\/[^"]+)"/);
      if (match) {
        let url = match[1];
        actionSpec.Body = DocsService.convertDocToHtml(url);
      } 
    }

  }
  return {
    getActionSpecs,
    getGroupEmails,
    getFiddler
  }
})()