/**
 * @OnlyCurrentDoc - only edit this spreadsheet, and no other
 */
function processExpirations() {
  const membershipFiddler = getFiddler_('Active Members');
  const membershipData = membershipFiddler.getData();
  const expiredMembersFiddler = getFiddler_('Expired Members');
  const expiredMembersData = expiredMembersFiddler.getData();
  const actionSpecs= getFiddler_('Action Specs').getData();
  const groupEmails = getFiddler_('Group Email Addresses').getData();
  
  const numProcessed = Manager.processExpirations(membershipData, expiredMembersData, actionSpecs, getGroupRemover_(), getEmailSender_(), groupEmails);

  if (numProcessed === 0) return;

  expiredMembersQueueFiddler.setData(expiredMembersData).dumpValues();
  membershipFiddler.setData(membershipData).dumpValues();

}
  



function getGroupAdder_() {
  if (PropertiesService.getScriptProperties().getProperty('testGroupAdds') === 'true') {
    return (member, group) => log(`Group Add: `, member, ' to ', group);
  } else {
    return (member, group) => addMemberToGroup_(member.Email, group.Email);
  }
}

function getGroupRemover_() {
  if (PropertiesService.getScriptProperties().getProperty('testGroupRemoves') === 'true') {
    return (member, group) => log(`Group Remove: `, member, ' from ', group);
  } else {
    return (member, group) => removeMemberFromGroup_(member.Email, group.Email);
  }
}

/**
 * Adds a single member to a Google Group using the Admin SDK API.
 *
 * @param {string} groupEmail The email address of the Google Group.
 * @param {string} memberEmail The email address of the member to add.
 * @customfunction
 */
function addMemberToGroup_(memberEmail, groupEmail) {
  try {
    AdminDirectory.Members.insert({ email: memberEmail, role: "MEMBER" }, groupEmail);
    Logger.log(`Successfully added ${memberEmail} to ${groupEmail}`);
  } catch (e) {
    if (e.message && e.message.includes("Member already exists")) {
      Logger.log(`Member ${memberEmail} already exists in ${groupEmail}`);
    } else {
      throw e
    }
  }
}

/**
* Removes a single member from a Google Group using the Admin SDK API.
*
* @param {string} groupEmail The email address of the Google Group.
* @param {string} memberEmail The email address of the member to remove.
* @customfunction
*/
function removeMemberFromGroup_(memberEmail, groupEmail) {
  try {
    AdminDirectory.Members.remove(groupEmail, memberEmail);
    Logger.log(`Successfully removed ${memberEmail} from ${groupEmail}`);
  } catch (e) {
    if (e.message && e.message.includes("Resource Not Found")) {
      Logger.log(`Error: ${memberEmail} not found in ${groupEmail} - one or both of those resources do not exist. Check the addresses and try again`);
    } else if (e.message && e.message === 'API call to directory.members.delete failed with error: Missing required field: ') {
      throw new Error(`Removing member ${memberEmail} from group ${groupEmail} - one or both of those addresses are not valid email addresses.`);
    } else {
      throw e
    }
  }
}


function getEmailSender_() {
  const testEmails = PropertiesService.getScriptProperties().getProperty('testEmails') === 'true';
  if (testEmails) {
    return (email) => log(`Email not sent due to testEmails property: To=${email.to}, Subject=${email.subject}, htmlBody=${email.htmlBody}`);
  } else {
    return (email) => sendSingleEmail_(email);
  }
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

