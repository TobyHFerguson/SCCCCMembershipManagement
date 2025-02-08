/**
 * @OnlyCurrentDoc - only edit this spreadsheet, and no other
 */
const testEmails = PropertiesService.getScriptProperties().getProperty('testEmails');

function processFullyExpiredMembers() {
  const emailSpecs = getFiddler_('Email Specifications').getData().reduce((acc, emailSpec) => {let t = emailSpec.Type;  acc[t] = emailSpec; return acc}, {});

  const membershipFiddler = getFiddler_('Membership');
  membershipFiddler.getData().map(member => {
    if (pastExpiration_(member.Expires, emailSpecs.Expiry_4.Offset)) {
      return sendExpiry4Email_(member, emailSpecs.Expiry_4.Subject, emailSpecs.Expiry_4.Body);
    }
  }).map(lgr_('message'));

  // getAllGroupEmails_().forEach(groupEmail => { removeMemberFromGroup(groupEmail, member.Email) });

}

function pastExpiration_(expirationDate, offset) {
  const currentDate = getDay(new Date());
  const lastDay = getDay(addDaysToDate(expirationDate, offset));
  const result = currentDate >=lastDay
  return result;
}

function sendExpiry4Email_(member, Subject, Body) {
  const subject = expandTemplate(Subject, member);
  const htmlBody = expandTemplate(Body, member);
  return sendSingleEmail_({ to: member.Email, subject, htmlBody });
}

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

/**
 * Creates a set of functions to generate email messages based on provided specifications.
 *
 * @param {Array<Object>} emailSpecs - An array of email specification objects.
 * @param {string} emailSpecs[].Type - The type of the email.
 * @param {string} emailSpecs[].Subject - The subject template of the email.
 * @param {string} emailSpecs[].Body - The body template of the email.
 * @returns {Object} An object where each key is an email type and each value is a function that takes a member object and returns an email message object.
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
 * Creates a function to send emails based on the provided message creation functions.
 *
 * @param {Object} createMessageFuns - An object where keys are email types and values are functions that create email messages.
 * @returns {Function} A function that sends an email to a member based on the specified type.
 * The returned function takes two parameters:
 *   @param {Object} member - The member to whom the email will be sent. Should have an `Email` property.
 *   @param {string} type - The type of email to send. Should correspond to a key in `createMessageFuns`.
 * The return function returns:
 *   @returns {Object} The message object that was sent.
 */
function makeSendEmailFuns_(createMessageFuns) {
  return (member, type) => {
    const createMessageFun = createMessageFuns[type];
    if (!createMessageFun) {
      log(`No createMessageFun found for type: ${type}`);
      return;
    }
    const message = createMessageFun(member);
    let sentMessage
    if (testEmails === 'true') {
      log(`Email sent: To=${member.Email}, Subject=${sentMessage.subject}`);
    } else {
      sentMessage = sendSingleEmail_(message); // Send the email and update the message object with any additional information
      log(`Email sent: To=${member.Email}, Subject=${message.subject}`);
    }
    return message;
  }
}

/**
 * Creates an email sender function based on the provided email specifications.
 *
 * @param {Object} emailSpecs - The specifications for the email.
 * @returns {Function} A function that sends an email to a member of a specified type.
 */
function makeEmailSender_(emailSpecs) {
  const sendEmail = makeSendEmailFuns_(makeCreateMessageFuns_(emailSpecs));
  return (member, type) =>
    log('makeEmailSender_', member, type) || sendEmail(member, type);
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
  const membershipByEmail = membershipData.reduce((acc, member) => { let e = member.Email; acc[e] = member; return acc; }, {})
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

function lgr_(name) { return (item) => { log(name, item); return item; } };



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
  log(`Email Sent: To=${email.to}, Subject=${email.subject}, Body=${email.htmlBody}`);
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

