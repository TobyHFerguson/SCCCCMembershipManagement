/**
 * @OnlyCurrentDoc - only edit this spreadsheet, and no other
 */
function sendScheduledEmails_() {
  const emailScheduleFiddler = getFiddler_('Email Schedule');
  const emailScheduleData = emailScheduleFiddler.getData();
  const emailScheduleFormulas = emailScheduleFiddler.getFormulaData();
  sortArraysByValue(emailScheduleData, emailScheduleFormulas, (a, b) => new Date(a["Scheduled On"]) - new Date(b["Scheduled On"]));
  const emailsToSend = createEmails(emailScheduleData);
  sendEmails_(emailsToSend);
  const combined = combineArrays(emailScheduleFormulas, emailScheduleData);
  const remainingEmails = combined.filter((_, i) => i >= emailsToSend.length);
  emailScheduleFiddler.setData(remainingEmails).dumpValues();
}

/**
 * Creates a set of functions to generate email messages based on provided specifications.
 *
 * @param {Array<Object>} emailSpecs - An array of email specification objects.
 * @param {string} emailSpecs[].Type - The type of the email.
 * @param {string} emailSpecs[].Subject - The subject template of the email.
 * @param {string} emailSpecs[].Body - The body template of the email.
 * @returns {Object} An object where each key is an email type and each value is a function that generates an email message.
 */
function makeCreateMessageFuns_(emailSpecs) {
  let result = emailSpecs.reduce((handlers, emailSpec) => {
    handlers[emailSpec.Type] = (member) => {
      const subject = expandTemplate(emailSpec.Subject, member);
      const htmlBody = expandTemplate(emailSpec.Body, member);
      return { to: member.Email, subject, htmlBody }
    };
    return handlers;
  }, {});
  log('makeCreateMessageFuns_', result);
  return result;
}

/**
 * Creates an object with functions to send emails based on the provided message creation functions.
 *
 * @param {Object} createMessageFuns - An object where keys are email types and values are functions that create email messages.
 * @returns {Object} An object where keys are email types and values are functions that send emails to members and return the message.
 */
function makeSendEmailFuns_(createMessageFuns) {
  const testEmails = PropertiesService.getScriptProperties().getProperty('testEmails');
  return (member, type) => {
    const createMessageFun = createMessageFuns[type];
    if (!createMessageFun) {
      log(`No createMessageFun found for type: ${type}`);
      return;
    }
    let message = createMessageFun(member);
    if (testEmails === 'true') {
      log(`Email not sent due to testEmails property: To=${member.Email}, Subject=${message.subject}, htmlBody=${message.htmlBody}`);
    } else {
      message = sendSingleEmail_(message);
      log(`Email sent: To=${member.Email}, Subject=${message.subject}`);
    }
    return message;
  }
}

function makeEmailSender_(emailSpecs) {
  const sendEmail = makeSendEmailFuns_(makeCreateMessageFuns_(emailSpecs));
  return (member, type) => { 
    log('makeEmailSender_', member, type);
    return sendEmail(member, type) };
}


function makeGroupJoiner_(groupEmails) {
  const testEmails = PropertiesService.getScriptProperties().getProperty('testEmails');
  return (member) => {
    if (!member.RenewedOn)
      groupEmails.forEach(groupEmail => {
        if (testEmails === 'true') {
          log(`Group membership not added to ${groupEmail} due to testEmails property: ${member.Email}`);
        } else {
          addMemberToGroup(groupEmail, member.Email)
        }
      }
      );
    return member;
  }
};

function makeTransactionProcessor_(membershipData, newMembers, newProcessedTransactions) {
  const membershipByEmail = membershipData.reduce((acc, member) => {let e = member.Email; acc[e] = member; return acc;}, {})
  return (txn) => {
    const email = txn['Email Address'];
    let member = membershipByEmail[email];
    if (!member) {
      member = {
        Email: txn["Email Address"],
        First: txn["First Name"],
        Last: txn["Last Name"],
        Joined: new Date(),
        Period: getPeriod(txn),
        Expires: calculateExpirationDate(getPeriod(txn)),
        RenewedOn: '',
      };
      newMembers.push(member);
    } else {
      const period = getPeriod(txn);
      member.Period = period;
      member.RenewedOn = new Date();
      member.Expires = calculateExpirationDate(period, member.Expires);
    }
    newProcessedTransactions.push(txn);
    return member;
  }
}

function lgr_(name) { return (item) => {log(name, item); return item;} };
function processTransactions() {
  convertLinks_('Transactions');
  const membershipFiddler = getFiddler_('Membership');
  const sendEmail = makeEmailSender_(getFiddler_('Email Specifications').getData());
  const newMembers = [];
  const newProcessedTransactions = []
  const membershipData = membershipFiddler.getData();
  const processTxn = makeTransactionProcessor_(membershipData, newMembers, newProcessedTransactions);
  const joinGroup = makeGroupJoiner_(getGroupEmails_());
  const newLogMessages = []


  const transactions = getFiddler_('Transactions')

  transactions.getData().map(txn => processTxn(txn))
  .map(lgr_('txn'))
    .map(member => joinGroup(member))
    .map(lgr_('member'))
    .map(member => sendEmail(member, member.RenewedOn ? 'Renewal' : 'Join'))
    .map(lgr_('message'))
    .map(message => newLogMessages.push(message));



  const newData = [...membershipData, ...newMembers];
  membershipFiddler.setData(newData).dumpValues();

  const emailLogFiddler = getFiddler_('Email Log');
  const logs = [...emailLogFiddler.getData(), ...newLogMessages]
  emailLogFiddler.setData(logs).dumpValues();

  const processedTransactionsFiddler = getFiddler_('Processed Transactions');
  const npt = [...processedTransactionsFiddler.getData(), ...newProcessedTransactions];
  processedTransactionsFiddler.setData(npt).dumpValues();

  const keepTransactions = PropertiesService.getScriptProperties().getProperty('keepTransactions');
  if (keepTransactions && keepTransactions === 'true') {
    log
  } else {
    log('transactions.getData(): ', transactions.getData())
    transactions.filterRows(_ => false).dumpValues();
  }
}

function addMembersToGroups_() {
  const bulkGroupFiddler = getFiddler_('Bulk Add Groups');
  bulkGroupFiddler.mapRows(row => { addMemberToGroup(row['Group Email [Required]'], row['Member Email']); return row; }).filterRows(_ => false).dumpValues();
}

function removeMembersFromGroups_() {
  const bulkGroupFiddler = getFiddler_('Bulk Remove Groups');
  bulkGroupFiddler.mapRows(row => { removeMemberFromGroup(row['Group Email [Required]'], row['Member Email']); return row; }).filterRows(_ => false).dumpValues();
}

function sendEmails_(emails) {
  log(`Number of emails to be sent: ${emails.length}`);

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
    .addItem('Send Emails', sendScheduledEmails.name)
    .addToUi();
}

function sendSingleEmail_(email, emailLog) {
  log(`Email Sent: :`, email);
  try {
    MailApp.sendEmail(email);
    return { Timestamp: new Date(), ...email };
  } catch (error) {
    log(`Failed to send email to ${email.to}: ${error.message}`);
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
  return bmPreFiddler.PreFiddler().getFiddler({ sheetName, createIfMissing });
}

