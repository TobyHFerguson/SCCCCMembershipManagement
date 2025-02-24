/**
 * @OnlyCurrentDoc - only edit this spreadsheet, and no other
 */
function processTransactionsOnFormSubmitEvent(event) {
  console.log('Processing Transactions on Form Submit Event');
  console.log('event.range.getRow()', event.range.getRow())
}
function processTransactionsOnEditEvent(event) {
  console.log('Processing Transactions on Edit Event', event);
}
 function processTransactions() {
  convertLinks_('Transactions');
  const transactionsFiddler = ConfigurationManager.getFiddler('Transactions').needFormulas();
  const transactions = getDataWithFormulas_(transactionsFiddler);
  if (transactions.length === 0) { return; }

  const membershipFiddler = ConfigurationManager.getFiddler('ActiveMembers');
  const expiryScheduleFiddler = ConfigurationManager.getFiddler('ExpirySchedule');

  const { manager, membershipData, expiryScheduleData } = initializeManagerData_(membershipFiddler, expiryScheduleFiddler);

  try {
    manager.processPaidTransactions(transactions, membershipData, expiryScheduleData);
  } catch (error) {
    if (error instanceof AggregateError) {
      error.errors.forEach(e => console.error(`Transaction on row ${e.txnNumber} ${e.email} had an error: ${e.message}\nStack trace: ${e.stack}`));
    } else {
      console.error(`Error: ${error.message}\nStack trace: ${error.stack}`);
    }
  }

  transactionsFiddler.setData(transactions).dumpValues();
  membershipFiddler.setData(membershipData).dumpValues();
  expiryScheduleFiddler.setData(expiryScheduleData).dumpValues();
}

function processMigrations() {
  const migratingMembersFiddler = ConfigurationManager.getFiddler('MigratingMembers').needFormulas();
  const migratingMembers = getDataWithFormulas_(migratingMembersFiddler);
  if (migratingMembers.length === 0) { return; }

  const membershipFiddler = ConfigurationManager.getFiddler('ActiveMembers');
  const expiryScheduleFiddler = ConfigurationManager.getFiddler('ExpirySchedule');

  const { manager, membershipData, expiryScheduleData } = initializeManagerData_(membershipFiddler, expiryScheduleFiddler);

  try {
    manager.migrateCEMembers(migratingMembers, membershipData, expiryScheduleData);
  } catch (error) {
    if (error instanceof AggregateError) {
      error.errors.forEach(e => console.error(`Transaction on row ${e.txnNumber} ${e.email} had an error: ${e.message}\nStack trace: ${e.stack}`));
    } else {
      console.error(`Error: ${error.message}\nStack trace: ${error.stack}`);
    }
  }

  migratingMembersFiddler.setData(migratingMembers).dumpValues();
  membershipFiddler.setData(membershipData).dumpValues();
  expiryScheduleFiddler.setData(expiryScheduleData).dumpValues();
}

function processExpirations() {
  const membershipFiddler = ConfigurationManager.getFiddler('ActiveMembers');
  const expiryScheduleFiddler = ConfigurationManager.getFiddler('ExpirySchedule');

  const { manager, membershipData,  expiryScheduleData } = initializeManagerData_(membershipFiddler, expiryScheduleFiddler);

  const numProcessed = manager.processExpirations(membershipData, expiryScheduleData);

  if (numProcessed === 0) return;

  membershipFiddler.setData(membershipData).dumpValues();
  expiryScheduleFiddler.setData(expiryScheduleData).dumpValues();
}

function initializeManagerData_(membershipFiddler, expiryScheduleFiddler,) {
  const membershipData = membershipFiddler.getData();
  const expiryScheduleData = expiryScheduleFiddler.getData();

  const manager = new Manager(ConfigurationManager.getActionSpecs(), ConfigurationManager.getGroupEmails(), getGroupAdder_(), getGroupRemover_(), getEmailSender_());

  return { manager, membershipData, expiryScheduleData };
}

function getGroupAdder_() {
  if (PropertiesService.getScriptProperties().getProperty('testGroupAdds') === 'true') {
    return (memberEmail, groupEmail) => utils.log(`Group Add: `, memberEmail, ' to ', groupEmail);
  } else {
    return (memberEmail, groupEmail) => addMemberToGroup_(memberEmail, groupEmail);
  }
}

function getGroupRemover_() {
  if (PropertiesService.getScriptProperties().getProperty('testGroupRemoves') === 'true') {
    return (memberEmail, groupEmail) => utils.log(`Group Remove: `, memberEmail, ' from ', groupEmail);
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
    utils.log(`Successfully added ${memberEmail} to ${groupEmail}`);
  } catch (e) {
    if (e.message && e.message.includes("Member already exists")) {
      utils.log(`Member ${memberEmail} already exists in ${groupEmail}`);
    } else {
      throw e;
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
    utils.log(`Successfully removed ${memberEmail} from ${groupEmail}`);
  } catch (e) {
    if (e.message && e.message.includes("Resource Not Found")) {
      utils.log(`Error: ${memberEmail} not found in ${groupEmail} - one or both of those resources do not exist. Check the addresses and try again`);
    } else if (e.message && e.message === 'API call to directory.members.delete failed with error: Missing required field: ') {
      throw new Error(`Removing member ${memberEmail} from group ${groupEmail} - one or both of those addresses are not valid email addresses.`);
    } else {
      throw e;
    }
  }
}

function getEmailSender_() {
  const testEmails = PropertiesService.getScriptProperties().getProperty('testEmails') === 'true';
  const domain = PropertiesService.getScriptProperties().getProperty('domain') || 'sc3.club';
  return (email) => {
    email.replyTo = `membership@${domain}`;
    if (testEmails) {
      utils.log('testEmails is set to true - logging only: ', email);
    } else {
      sendSingleEmail_(email);
    }
  };
}




function sendSingleEmail_(email) {
  utils.log(`Email Sent: :`, email);
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
  return combineArrays_(fiddler.getFormulaData(), fiddler.getData());
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
}


