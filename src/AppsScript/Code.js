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

  const actionScheduleFiddler = getFiddler_('Action Schedule');
  const actionSchedule = actionScheduleFiddler.getData();
  
  const numProcessed = Manager.processExpirations(membershipData, expiredMembersData, actionSchedule, actionSpecs, getGroupRemover_(), getEmailSender_(), groupEmails);

  if (numProcessed === 0) return;

  expiredMembersQueueFiddler.setData(expiredMembersData).dumpValues();
  membershipFiddler.setData(membershipData).dumpValues();
  actionScheduleFiddler.setData(actionSchedule).dumpValues();

}
  



function getGroupAdder_() {
  if (PropertiesService.getScriptProperties().getProperty('testGroupAdds') === 'true') {
    return (memberEmail, groupEmail) => log(`Group Add: `, memberEmail, ' to ', groupEmail);
  } else {
    return (memberEmail, groupEmail) => addMemberToGroup_(memberEmail, groupEmail);
  }
}

function getGroupRemover_() {
  if (PropertiesService.getScriptProperties().getProperty('testGroupRemoves') === 'true') {
    return (memberEmail, groupEmail) => log(`Group Remove: `, memberEmail, ' from ', groupEmail);
  } else {
    return (memberEmail, groupEmail) => removeMemberFromGroup_(memberEmail, groupEmail);
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


  const membershipFiddler = getFiddler_('Active Members');
  const membershipData = membershipFiddler.getData();

  const actionSpecs = getFiddler_('Action Specs').getData();

  const actionScheduleFiddler = getFiddler_('Action Schedule')
  const actionScheduleData = actionScheduleFiddler.getData();

  const groupEmails = getFiddler_('Group Email Addresses').getData();
 Manager.processPaidTransactions(transactions, membershipData, getGroupAdder_(), getEmailSender_(), actionSpecs, actionScheduleData, groupEmails);



  transactionsFiddler.setData(transactions).dumpValues();

  membershipFiddler.setData(membershipData).dumpValues();

  actionScheduleFiddler.setData(actionScheduleData).dumpValues();

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
   * Combines two arrays of objects by merging the properties of objects at the same index.
   * If a property in the first array's object is an empty string or undefined, the property from the second array's object is used.
   * 
   * @param {Array<Object>} arr1 - The first array of objects.
   * @param {Array<Object>} arr2 - The second array of objects.
   * @returns {Array<Object>} A new array of objects with combined properties.
   * @throws {Error} If the lengths of the two arrays are not equal.
   */
function combineArrays(arr1, arr2) {
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

