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





const _getGroupEmails = (() => {
  let cachedGroupEmails = null;
  return () => {
    if (cachedGroupEmails) return cachedGroupEmails;
    cachedGroupEmails = getFiddler_('Group Email Addresses').getData().map(row => row.Email);
    return cachedGroupEmails;
  };
})();

/**
 * Sends scheduled emails based on the email schedule data.
 * 
 * This function retrieves the email schedule and email log data, sorts the schedule by date,
 * and sends emails that are scheduled to be sent on or before the current date and time.
 * After sending an email, it logs the email and updates the schedule.
 * 
 * The function performs the following steps:
 * 1. Retrieves and sorts the email schedule data.
 * 2. Retrieves the email log data.
 * 3. Iterates through the email schedule in reverse order.
 * 4. Sends emails that are scheduled for the current date or earlier.
 * 5. Logs the sent emails and updates the email schedule.
 * 
 * Note: The email schedule is sorted in reverse order, so the function starts processing
 * from the end where dates are more likely to be in the past.
 * 
 * @function
 */
function sendScheduledEmails() {
  const emailScheduleFiddler = getFiddler_('Email Schedule');
  const emailScheduleData = emailScheduleFiddler.getData();
  let emailScheduleFormulas = emailScheduleFiddler.getFormulaData();

  sortArraysByValue(emailScheduleData, emailScheduleFormulas, (a, b) => new Date(b["Scheduled On"]) - new Date(a["Scheduled On"]));
  log('sendEmails() - emailScheduleData', emailScheduleData.filter(row => row.Type === 'Join'));
  log('sendEmails() - emailScheduleFormulas', emailScheduleFormulas.filter(row => row.Type === 'Join'));

  // The emailSchedule is in reverse sorted order and we start at the far end 
  // where the dates are more likely to be in the past.
  const now = new Date().getTime()
  const emailsToSend = [];
  for (let i = emailScheduleData.length - 1; i >= 0; i--) {
    const row = emailScheduleData[i];
    // We test and see if we've hit a future date - if so we can finish
    if (new Date(row["Scheduled On"]).getTime() > now) {
      break;
    } else {
      const Subject = expandTemplate(row.Subject, row);
      const Body = expandTemplate(row.Body, row);
      emailsToSend.push({ to: row.Email, subject: Subject, htmlBody: Body });
      emailScheduleData.splice(i, 1); // Remove the processed email
      emailScheduleFormulas.splice(i, 1); // Remove the processed email
    }
  }
  if (emailsToSend.length > 0) { // Only do work if there's work to do!
    sendEmails(emailsToSend);
    let emails = combineArrays(emailScheduleFormulas, emailScheduleData);
    log('emails:', emails.filter(row => row.Type === 'Join'));
    emailScheduleFiddler.setData(emails).dumpValues();
  }
}

/**
 * Expands a template string by replacing placeholders with corresponding values from a row object.
 * Placeholders are in the format {key}, where key is a property name in the row object.
 * Date fields specified in the dateFields array are converted to local date strings.
 *
 * @param {string} template - The template string containing placeholders.
 * @param {Object} row - The object containing values to replace placeholders.
 * @returns {string} - The expanded template string with placeholders replaced by corresponding values.
 */
function expandTemplate(template, row) {
  const dateFields = ["Scheduled On", "Expires", "Joined", "Renewed On"]; // Add the names of fields that should be treated as dates
  return template.replace(/{([^}]+)}/g, (_, key) => {
    let value = row[key];
    if (dateFields.includes(key)) {
      value = new Date(value); // Convert to Date object if it's a date field
      return value.toLocaleDateString(); // Convert Date objects to local date string
    }
    return value || "";
  });
};

function processTransactions() {
  convertLinks_('Transactions');
  const bulkGroupFiddler = getFiddler_('Bulk Add Groups');
  const bulkGroupEmails = bulkGroupFiddler.getData();
  const emailScheduleFiddler = getFiddler_('Email Schedule');
  const emailScheduleData = emailScheduleFiddler.getData();
  const emailScheduleFormulas = emailScheduleFiddler.getFormulaData();

  const membershipFiddler = getFiddler_('Membership');
  const membershipData = membershipFiddler.getData();
  const processedTransactionsFiddler = getFiddler_('Processed Transactions');
  const processedTransactions = getDataWithFormulas(processedTransactionsFiddler);
  const transactionsFiddler = getFiddler_('Transactions').needFormulas();
  const transactions = getDataWithFormulas(transactionsFiddler);
  const headerAndData1 = transactionsFiddler.getSheet().getRange(1, 1, 2, transactionsFiddler.getNumColumns()).getValues();
  const headerAndData1Copy = headerAndData1.map((row, index) => index === 1 ? row.map(() => '') : row);



  log('processTransactions() - emailScheduleData[Join]', emailScheduleData.filter(row => row.Type === 'Join'));
  log('processTransactions() - emailScheduleFormulas[Join]', emailScheduleFormulas.filter(row => row.Type === 'Join'));
  const numMemberCols = membershipFiddler.getNumColumns();
  const emailToMemberMap = new Map(numMemberCols ? membershipData.map((member, index) => [member.Email, index]) : []);
  const processedRows = [];
  for (i = transactions.length - 1; i >= 0; i--) { // reverse order so as to preserve index during deletion
    const row = transactions[i];
    if (row["Payable Status"].toLowerCase().startsWith("paid")) {
      const matchIndex = emailToMemberMap.get(row["Email Address"]);
      if (matchIndex !== undefined) { // member exists
        const member = membershipData[matchIndex];
        const years = getPeriod(row);
        renewMember(member, years, emailScheduleData, emailScheduleFormulas);
      } else { // new member
        addNewMember(row, emailScheduleData, emailScheduleFormulas, membershipData, bulkGroupEmails);
      }
      row.Timestamp = new Date();
      processedRows.push(row);
      transactions.splice(i, 1);
    }
  }
  processedTransactions.push(...processedRows);
  // log('Processed Rows:', processedRows);

  bulkGroupFiddler.setData(bulkGroupEmails).dumpValues();
  log('ProcessTransactions - emailSchedule.filter(row => row.Type === "Join"):', emailScheduleData.filter(row => row.Type === 'Join'));
  const emails = combineArrays(emailScheduleFormulas, emailScheduleData)
  emails.filter(email => email.Type === 'Join').forEach(row => log('row:', row));
  emailScheduleFiddler.setData(emails).dumpValues();
  membershipData.sort((a, b) => a.Email.localeCompare(b.Email));
  membershipFiddler.setData(membershipData).dumpValues();
  transactionsFiddler.setData(transactions.length === 0 ? headerAndData1Copy : transactions).dumpValues();
  processedTransactionsFiddler.setData(processedTransactions).dumpValues();
}

function getPeriod(row) {
  const yearsMatch = row.Payment.match(/(\d+)\s*year/);
  const years = yearsMatch ? parseInt(yearsMatch[1], 10) : 1;
  return years;
}

function addNewMember(row, emailScheduleData, emailScheduleFormulas, membershipData, bulkGroupEmails) {
  const newMember = {
    Email: row["Email Address"],
    First: row["First Name"],
    Last: row["Last Name"],
    Joined: new Date(),
    Period: getPeriod(row),
    Expires: calculateExpirationDate(getPeriod(row)),
    "Renewed On": '',
  };
  membershipData.push(newMember);
  addNewMemberToEmailSchedule(newMember, emailScheduleData, emailScheduleFormulas);
  addNewMemberToBulkGroups(bulkGroupEmails, newMember);
}

function addNewMemberToBulkGroups(bulkGroupEmails, newMember) {
  _getGroupEmails().forEach((groupEmail) => {
    bulkGroupEmails.push({
      "Group Email [Required]": groupEmail,
      "Member Email": newMember.Email,
      "Member Type": "USER",
      "Member Role": "MEMBER"
    });
  });
}

function addNewMemberToEmailSchedule(member, emailScheduleData, emailScheduleFormulas) {
  addMemberToEmailSchedule(member, emailScheduleData, emailScheduleFormulas, 'Join');
}

function addRenewedMemberToEmailSchedule(member, emailScheduleData, emailScheduleFormulas) {
  const email = member.Email;
  removeEmails(email, emailScheduleData, emailScheduleFormulas);
  addMemberToEmailSchedule(member, emailScheduleData, emailScheduleFormulas, 'Renewal');
}

/**
 * Removes all objects from the data & formula arrays whose Email property matches the given email address.
 * @param {string} email - The email address to match.
 * @param {Array} emailScheduleData - The array of objects.
 */
function removeEmails(email, emailScheduleData, emailScheduleFormulas) {
  for (let i = emailScheduleData.length - 1; i >= 0; i--) {
    if (emailScheduleData[i].Email === email) {
      emailScheduleData.splice(i, 1);
      emailScheduleFormulas.splice(i, 1);
    }
  }
}

function addMemberToEmailSchedule(member, emailScheduleData, emailScheduleFormulas, emailType) {
  const email = member.Email;
  const emailTypes = [emailType, 'Expiry 1', 'Expiry 2', 'Expiry 3', 'Expiry 4'];
  // These formulas all use the column heading to look up the value in the Membership sheet or the Emails sheet.
  // They are independent of row and column location, so rows and columns can be moved around without breaking the formulas.
  const joinLookupFormula = `=INDIRECT(ADDRESS(ROW(),XMATCH("Joined",$1:$1,0)))`
  const renewLookupFormula = `=INDIRECT(ADDRESS(ROW(),XMATCH("Renewed On",$1:$1,0)))`
  const membershipLookupFormula = `=INDEX(Membership!$A:$ZZZ,MATCH(INDIRECT(ADDRESS(ROW(),XMATCH("Email",$1:$1,0))),Membership!$A:$A,0),XMATCH(INDEX($1:$1,COLUMN()),Membership!$1:$1,0))`
  const emailLookupFormula = `=VLOOKUP(INDIRECT(ADDRESS(ROW(),XMATCH("Type",$1:$1,0))),Emails!$A$1:$C$7,XMATCH(INDEX($1:$1,COLUMN()),Emails!$1:$1,0),FALSE)`
  const scheduledOnLookupFormula = `=INDIRECT(ADDRESS(ROW(),XMATCH("Expires",$1:$1,0))) + VLOOKUP(INDIRECT(ADDRESS(ROW(),XMATCH("Type",$1:$1,0))),'Expiry Schedule'!$A:$B,2,FALSE)`
  const canonicalEntry = {
    "Scheduled On": scheduledOnLookupFormula,
    Type: '',
    Email: '',
    First: membershipLookupFormula,
    Last: membershipLookupFormula,
    Joined: membershipLookupFormula,
    Period: membershipLookupFormula,
    Expires: membershipLookupFormula,
    "Renewed On": membershipLookupFormula,
    Subject: emailLookupFormula,
    Body: emailLookupFormula
  }
  emailTypes.forEach(t => {
    const addOn = {
      Type: t,
      Email: email,
      ...(t === 'Join' ? { "Scheduled On": joinLookupFormula } : t === 'Renewal' ? { "Scheduled On": renewLookupFormula } : {}) // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax#spread_in_object_literals
    }
    const newEntry = {
      ...canonicalEntry,
      ...addOn
    };
    log('newEntry.Email', newEntry.Email, 'newEntry.Type:', newEntry.Type, 'newEntry["Scheduled On"]:', newEntry["Scheduled On"]);
    emailScheduleData.push(newEntry);
    emailScheduleFormulas.push(newEntry);
  });
}

/**
 * 
 * @param {*} member 
 * @param {number} period 
 * @param {} emailScheduleData 
 */
function renewMember(member, period, emailScheduleData, emailScheduleFormulas) {
  member.Period = period;
  member["Renewed On"] = new Date();
  member.Expires = calculateExpirationDate(period, member.Expires);
  addRenewedMemberToEmailSchedule(member, emailScheduleData, emailScheduleFormulas);
}

/**
 * Calculates an expiration date based on a period in years and an optional existing expiration date.
 * 
 * The value returned is the greater of period added to today or the existing expiration date.
 * @param {number} period - The period in years.
 * @param {Date} [expires] - the existing expiration date, if any
 * @returns {Date} - The expiration date
 */
function calculateExpirationDate(period, expires) {
  const today = new Date();
  const futureDate = new Date(today.setFullYear(today.getFullYear() + period));

  if (!expires) {
    return futureDate;
  }

  const expirationDate = new Date(expires);
  const futureExpirationDate = new Date(expirationDate.setFullYear(expirationDate.getFullYear() + period));

  return futureDate > futureExpirationDate ? futureDate : futureExpirationDate;
}

/**
 * Returns a new date with days added to it.
 * @param {Date} date 
 * @param {number} days 
 * @returns {Date}
 */
function addDaysToDate(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
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

  let spec = {}
  if (sheetMappings[sheetName]) {
    spec.sheetName = sheetMappings[sheetName].sheetName;
    spec.createIfMissing = sheetMappings[sheetName].createIfMissing;
  }

  return bmPreFiddler.PreFiddler().getFiddler(spec).needFormulas();
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


/**
 * Returns the data from a fiddler with formulas merged into it.
 * @param {fiddler} fiddler 
 * @returns {Array} - The merged data.
 */
function getDataWithFormulas(fiddler) {
  fiddler.needFormulas();
  return mergeObjects(fiddler.getData(), fiddler.getFormulaData(), fiddler.getColumnsWithFormulas());
}
/**
 * Merges two lists of objects based on a list of keys using spread syntax.
 * @param {Array} a - The first list of objects.
 * @param {Array} b - The second list of objects.
 * @param {Array} k - The list of keys.
 * @returns {Array} - The list of merged objects.
 */
function mergeObjects(a, b, k) {
  return a.map((objA, index) => {
    const objB = b[index];
    const mergedObj = { ...objA };
    k.forEach(key => {
      if (objB.hasOwnProperty(key)) {
        mergedObj[key] = objB[key];
      }
    });
    return mergedObj;
  });
}
/**
 * Logs messages to the console if the script property 'logging' is true.
 * @param  {...any} args - The messages or objects to log.
 */
function log(...args) {
  const logging = PropertiesService.getScriptProperties().getProperty('logging') === 'true';
  if (logging) {
    console.log(...args);
  }
}


function sendEmails(emails) {
  log(`Number of emails to be sent: ${emails.length}`);
  const emailLogFiddler = getFiddler_('Email Log');
  const emailLog = emailLogFiddler.getData();
  const testEmails = PropertiesService.getScriptProperties().getProperty('testEmails');
  if (testEmails === 'true') { // Use test path only if testEmails is explicitly set to true
    emails.forEach(email => log(`Email not sent due to testEmails property: To=${email.to}, Subject=${email.subject}, Body=${email.body}`));
  } else {
    emails.forEach(email => sendSingleEmail(email, emailLog));
    emailLogFiddler.setData(emailLog).dumpValues();
  }
}

function sendSingleEmail(email, emailLog) {
  log(`Email Sent: :`, email);
  try {
    MailApp.sendEmail(email);
  } catch (error) {
    log(`Failed to send email to ${email.to}: ${error.message}`);
  }
  emailLog.push({ Timestamp: new Date(), ...email });
}


function testSendEmail() {
  const recipient = "test@example.com";
  const subject = "Test Subject";
  const body = "This is a test email body.";
  const options = {
    cc: "cc@example.com",
    bcc: "bcc@example.com",
    attachments: [Utilities.newBlob("Attachment content", "text/plain", "test.txt")]
  };
  MailApp.sendEmail(recipient, subject, body, options);
}


function sortArraysByValue(arr1, arr2, compareFn) {
  if (arr1.length !== arr2.length) {
    throw new Error("Both arrays must have the same length");
  }
  const combined = arr1.map((value, index) => ({ value, index }));
  combined.sort((a, b) => compareFn(a.value !== undefined ? a.value : a, b.value !== undefined ? b.value : b));
  const sortedArr1 = combined.map(item => item.value);
  const sortedArr2 = combined.map(item => arr2[item.index]);
  arr1.splice(0, arr1.length, ...sortedArr1);
  arr2.splice(0, arr2.length, ...sortedArr2);
}

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
