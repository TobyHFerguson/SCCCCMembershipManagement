// Apps Script functions
function processTransactions() {
  convertLinks_('Transactions');
  const transactionsFiddler = getFiddler_('Transactions').needFormulas();
  const transactions = getDataWithFormulas_(transactionsFiddler);
  if (transactions.length === 0) { return; }


  const bulkGroupFiddler = getFiddler_('Bulk Add Groups');
  const bulkGroupEmails = bulkGroupFiddler.getData();
  const emailScheduleFiddler = getFiddler_('Email Schedule');
  const emailScheduleData = emailScheduleFiddler.getData();
  const emailScheduleFormulas = emailScheduleFiddler.getFormulaData();

  const membershipFiddler = getFiddler_('Membership');
  const membershipData = membershipFiddler.getData();
  const processedTransactionsFiddler = getFiddler_('Processed Transactions');
  const processedTransactions = getDataWithFormulas_(processedTransactionsFiddler);

  const { processedRows, updatedTransactions } = processTransactionsData(transactions, membershipData, emailScheduleData, emailScheduleFormulas, bulkGroupEmails);
  log('updatedTransactions', updatedTransactions);
  log('updatedTransactions.length', updatedTransactions.length);
  processedTransactions.push(...processedRows);

  bulkGroupFiddler.setData(bulkGroupEmails).dumpValues();
  const emails = combineArrays(emailScheduleFormulas, emailScheduleData);
  emailScheduleFiddler.setData(emails).dumpValues();
  membershipData.sort((a, b) => a.Email.localeCompare(b.Email));
  membershipFiddler.setData(membershipData).dumpValues();
  transactionsFiddler.setData(updatedTransactions).dumpValues();
  processedTransactionsFiddler.setData(processedTransactions).dumpValues();
}

function sendScheduledEmailsAppScript() {
  const emailScheduleFiddler = getFiddler_('Email Schedule');
  const emailScheduleData = emailScheduleFiddler.getData();
  const emailScheduleFormulas = emailScheduleFiddler.getFormulaData();
  sortArraysByValue(emailScheduleData, emailScheduleFormulas, (a, b) => new Date(a["Scheduled On"]) - new Date(b["Scheduled On"]));
  const numSentEmails = sendScheduledEmails(emailScheduleData);
  const remainingEmails = combineArrays(emailScheduleFormulas, emailScheduleData);
  remainingEmails.splice(0, numSentEmails);
  emailScheduleFiddler.setData(remainingEmails).dumpValues();
}

/**
* Returns the data from a fiddler with formulas merged into it.
* @param {fiddler} fiddler 
* @returns {Array} - The merged data.
*/
function getDataWithFormulas_(fiddler) {
  fiddler.needFormulas();
  return mergeObjects(fiddler.getData(), fiddler.getFormulaData(), fiddler.getColumnsWithFormulas());
}

/**
 * @OnlyCurrentDoc - only edit this spreadsheet, and no other
 */

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Membership Management')
    .addItem('Process Transactions', processTransactions.name)
    .addItem('Send Emails', sendScheduledEmails.name)
    .addToUi();
} ""





const getGroupEmails_ = (() => {
  let cachedGroupEmails = null;
  return () => {
    if (cachedGroupEmails) return cachedGroupEmails;
    cachedGroupEmails = getFiddler_('Group Email Addresses').getData().map(row => row.Email);
    return cachedGroupEmails;
  };
})();
/**
 * Converts links in a sheet to hyperlinks.
 * @param {String} sheetName - The name of the sheet.
 */
function convertLinks_(sheetName) {
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
}/**
 * Gets a fiddler based on the sheet name.
 * @param {String} sheetName - the anme of the sheet.
 * @returns {Fiddler} - The fiddler.
 */
function getFiddler_(sheetName, createIfMissing = true) {
  const sheetMappings = {
    'Bulk Add Groups': { sheetName: 'Bulk Add Groups', createIfMissing },
    'CE Members': { sheetName: 'CE Members', createIfMissing },
    'Email Log': { sheetName: 'Email Log', createIfMissing },
    'Email Schedule': { sheetName: 'Email Schedule', createIfMissing },
    'Group Email Addresses': { sheetName: 'Group Email Addresses', createIfMissing: false },
    'Membership': { sheetName: 'Membership', createIfMissing },
    'MembershipReport': { sheetName: 'MembershipReport', createIfMissing },
    'Processed Transactions': { sheetName: 'Processed Transactions', createIfMissing },
    'Transactions': { sheetName: 'Transactions', createIfMissing: false }
  };

  let spec = {};
  if (sheetMappings[sheetName]) {
    spec.sheetName = sheetMappings[sheetName].sheetName;
    spec.createIfMissing = sheetMappings[sheetName].createIfMissing;
  }

  return bmPreFiddler.PreFiddler().getFiddler(spec).needFormulas();
}

