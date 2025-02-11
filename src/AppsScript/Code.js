
/**
 * @OnlyCurrentDoc - only edit this spreadsheet, and no other
 */
function processEmailQueue() {
  const emailQueueFiddler = getFiddler_('Email Queue');
  const emailQueue = emailQueueFiddler.getData();
  const actionSpecsFiddler = getFiddler_('Action Specs');
  const actionSpecs = actionSpecsFiddler.getData();
  const membersFiddler = getFiddler_('Membership');
  const members = membersFiddler.getData();
  const sendFun = getEmailSender_();

  sendEmails(emailQueue, sendFun, actionSpecs, members);

  emailQueueFiddler.setData(emailQueue).dumpValues();
}
function getEmailSender_() {
  const testEmails = PropertiesService.getScriptProperties().getProperty('testEmails') === 'true';
  if (testEmails) {
    return (email) => log(`Email not sent due to testEmails property: To=${email.to}, Subject=${email.subject}, htmlBody=${email.htmlBody}`);
  } else {
    return (email) => sendSingleEmail_(email);
  }
}

function doActionSchedule() {
  const actionScheduleFiddler = getFiddler_('Action Schedule')
  const actionSchedule = actionScheduleFiddler.getData()
  const numActionsBefore = actionSchedule.length;
  const { emailQueue, expiredMembersQueue } = processActionSchedule(actionSchedule);
  if (numActionsBefore == actionSchedule.length) {
    return;
  }
  // Get here because queues have changed.
  if (emailQueue) {
    const emailQueueFiddler = getFiddler_('Email Queue');
    const emailQueueData = [...emailQueueFiddler.getData(), ...emailQueue]
    emailQueueFiddler.setData(emailQueueData).dumpValues();
  }
  if (expiredMembersQueue) {
    const expiredMembersQueueFiddler = getFiddler_('Expired Members Queue');
    const expiredMembersQueueData = [...expiredMembersQueueFiddler.getData(), ...expiredMembersQueue]
    expiredMembersQueueFiddler.setData(expiredMembersQueueData).dumpValues();
  }
  actionScheduleFiddler.setData(actionSchedule).dumpValues();
}


function processTransactions() {
  convertLinks_('Transactions');
  const transactionsFiddler = getFiddler_('Transactions').needFormulas();
  const transactions = getDataWithFormulas_(transactionsFiddler);
  if (transactions.length === 0) { return; }
  const transactionsHeaderRow = Object.keys(transactions[0]).reduce((acc, key) => {
    acc[key] = '';
    return acc;
  }, {});

  const actionScheduleFiddler = getFiddler_('Action Schedule');
  const actionSchedule = actionScheduleFiddler.getData();


  const membershipFiddler = getFiddler_('Membership');
  const membershipData = membershipFiddler.getData();


  const actionSpecs = getFiddler_('Action Specs').getData();

  const newMembers = processPaidTransactions(transactions, membershipData, actionSchedule, actionSpecs);

  const bulkGroupFiddler = getFiddler_('Group Add Emails');
  const groupAddEmails = [...bulkGroupFiddler.getData(), ...newMembers];
  bulkGroupFiddler.setData(groupAddEmails).dumpValues();

  transactionsFiddler.setData(transactions.length > 1 ? transactions : transactionsHeaderRow).dumpValues();

  membershipFiddler.setData(membershipData).dumpValues();

  actionScheduleFiddler.setData(actionSchedule).dumpValues();

}

function addMembersToGroups() {
  const bulkGroupFiddler = getFiddler_('Bulk Add Groups');
  bulkGroupFiddler.mapRows(row => { addMemberToGroup(row['Group Email [Required]'], row['Member Email']); return row; }).filterRows(_ => false).dumpValues();
}

function removeMembersFromGroups() {
  const bulkGroupFiddler = getFiddler_('Bulk Remove Groups');
  bulkGroupFiddler.mapRows(row => { removeMemberFromGroup(row['Group Email [Required]'], row['Member Email']); return row; }).filterRows(_ => false).dumpValues();
}

function sendEmails_(emails) {
  log(`Number of emails to be sent: ${emails.length}`);
  const emailLogFiddler = getFiddler_('Email Log');
  const testEmails = PropertiesService.getScriptProperties().getProperty('testEmails');
  if (testEmails === 'true') { // Use test path only if testEmails is explicitly set to true
    emails.forEach(email => log(`Email not sent due to testEmails property: To=${email.to}, Subject=${email.subject}, htmlBody=${email.htmlBody}`));
  } else {
    const emailsSent = emails.map(email => sendSingleEmail_(email));
    const emailLog = [...emailLogFiddler.getData(), ...emailsSent];
    emailLogFiddler.setData(emailLog).dumpValues();
  }
}


function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Membership Management')
    .addItem('Process Transactions', processTransactions.name)
    .addItem('Do Action Schedule', doActionSchedule.name)
    .addItem('Send Emails', executeScheduledActions.name)
    .addToUi();
}

function sendSingleEmail_(email, emailLog) {
  log(`Email Sent: :`, email);
  try {
    MailApp.sendEmail(email);
    return { Timestamp: new Date(), ...email };
  } catch (error) {
    console.error(`Failed to send email to ${email.to}: ${error.message}`);
  }
}
/**
* Returns the data from a fiddler with formulas merged into it.
* @param {fiddler} fiddler 
* @returns {Array} - The merged data.
*/
function getDataWithFormulas_(fiddler) {
  fiddler.needFormulas();
  return combineArrays(fiddler.getFormulaData(), fiddler.getData());
}







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
  return bmPreFiddler.PreFiddler().getFiddler({ sheetName, createIfMissing }).needFormulas();
}

