/**
 * @OnlyCurrentDoc - only edit this spreadsheet, and no other
 */


function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Membership Management')
    .addItem('Process Transactions', processTransactions.name)
    .addItem('Send Emails', sendEmails.name)
    .addToUi();
} ""

/**
 * Sets the Timestamp field of a row object to the current date and time.
 * @param {Object} row - The row object to update.
 */
function setTimestamp(row) {
  row.Timestamp = new Date();
}



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
function sendEmails() {
  const emailScheduleFiddler = getFiddler_('Email Schedule');
  const emailSchedule = emailScheduleFiddler.getData().sort((a, b) => new Date(b["Scheduled On"]) - new Date(a["Scheduled On"]));
  const emailLogFiddler = getFiddler_('Email Log'); // getFiddler_('Email Log');
  const emailLog = emailLogFiddler.getData();
  let numEmailsSent = 0;
  // The emailSchedule is in reverse sorted order and we start at the far end 
  // where the dates are more likely to be in the past.
  const now = new Date().getTime()
  for (let i = emailSchedule.length - 1; i >= 0; i--) {
    const row = emailSchedule[i];
    // We test and see if we've hit a future date - if so we can finish
    if (new Date(row["Scheduled On"]).getTime() > now) {
      break;
    } else {
      const Subject = expandTemplate(row.Subject, row);
      const Body = expandTemplate(row.Body, row);
      console.log(`Sending email to ${row.Email} with subject ${Subject} and body ${Body}`);
      MailApp.sendEmail(row.Email, Subject, Body);
      numEmailsSent++;
      setTimestamp(row);
      emailLog.push(row);
      emailSchedule.splice(i, 1); // Remove the processed email
    }
  }
  if (numEmailsSent > 0) { // Only do work if there's work to do!
    emailLogFiddler.setData(emailLog).dumpValues()
    emailScheduleFiddler.setData(emailSchedule).dumpValues();
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
  const emailSchedule = emailScheduleFiddler.getData();
  const membershipFiddler = getFiddler_('Membership');
  const membershipData = membershipFiddler.getData();
  const processedTransactionsFiddler = getFiddler_('Processed Transactions');
  const processedTransactions = getDataWithFormulas(processedTransactionsFiddler);
  const transactionsFiddler = getFiddler_('Transactions').needFormulas();
  const transactions = getDataWithFormulas(transactionsFiddler);

  const numMemberCols = membershipFiddler.getNumColumns();
  console.log(`numMemberCols: ${numMemberCols}`);
  const emailToMemberMap = new Map(numMemberCols ? membershipData.map((member, index) => [member.Email, index]) : []);
  const processedRows = [];
  for (i = transactions.length - 1; i >= 0; i--) { // reverse order so as to preserve index during deletion
    const row = transactions[i];
    if (row["Payable Status"].toLowerCase().startsWith("paid")) {
      const matchIndex = emailToMemberMap.get(row["Email Address"]);
      if (matchIndex !== undefined) { // member exists
        const member = membershipData[matchIndex];
        const years = getPeriod(row);
        renewMember(member, years, emailSchedule);
      } else { // new member
        addNewMember(row, emailSchedule, membershipData, bulkGroupEmails);
      }
      row.Timestamp = new Date();
      processedRows.push(row);
      transactions.splice(i, 1);
    }
  }
  processedTransactions.push(...processedRows);

  bulkGroupFiddler.setData(bulkGroupEmails).dumpValues();
  emailScheduleFiddler.setData(emailSchedule).dumpValues();
  membershipData.sort((a, b) => a.Email.localeCompare(b.Email));
  membershipFiddler.setData(membershipData).dumpValues();
  transactionsFiddler.removeAllRows().dumpValues();
  processedTransactionsFiddler.setData(processedTransactions).dumpValues();
}

function getPeriod(row) {
  const yearsMatch = row.Payment.match(/(\d+)\s*year/);
  const years = yearsMatch ? parseInt(yearsMatch[1], 10) : 1;
  return years;
}

function addNewMember(row, emailSchedule, membershipData, bulkGroupEmails) {
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
  addNewMemberToEmailSchedule(newMember, emailSchedule);
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

function addNewMemberToEmailSchedule(member, emailSchedule) {
  addMemberToEmailSchedule(member, emailSchedule, 'Join');
}

function addRenewedMemberToEmailSchedule(member, emailSchedule) {
  const email = member.Email;
  const index = emailSchedule.findIndex(item => item.Email === email);
  if (index !== -1) {
    for (let i = emailSchedule.length - 1; i >= 0; i--) {
      if (emailSchedule[i].Email === email) {
        emailSchedule.splice(i, 1);
      }
    }
  }
  addMemberToEmailSchedule(member, emailSchedule, 'Renewal');
}
function addMemberToEmailSchedule(member, emailSchedule, emailType) {
  const email = member.Email;
  const emailTypes = [emailType, 'Expiry 1', 'Expiry 2', 'Expiry 3', 'Expiry 4'];
  // These formulas all use the column heading to look up the value in the Membership sheet or the Emails sheet.
  // They are independent of row and column location, so rows and columns can be moved around without breaking the formulas.
  const joinLookupFormula = `=INDIRECT(ADDRESS(ROW(),XMATCH("Joined",$1:$1,0)))`
  const renewLookupFormula = `=INDIRECT(ADDRESS(ROW(),XMATCH("Renewed On",$1:$1,0)))`
  const membershipLookupFormula = `=IFERROR(INDEX(Membership!$A:$ZZZ,MATCH(INDIRECT(ADDRESS(ROW(),XMATCH("Email",$1:$1,0))),Membership!$A:$A,0),XMATCH(INDEX($1:$1,COLUMN()),Membership!$1:$1,0)),"")`
  const emailLookupFormula = `=IFERROR(VLOOKUP(INDIRECT(ADDRESS(ROW(),XMATCH("Type",$1:$1,0))),Emails!$A$1:$C$7,XMATCH(INDEX($1:$1,COLUMN()),Emails!$1:$1,0),FALSE),0)`
  const scheduledOnLookupFormula = `=IFERROR(INDIRECT(ADDRESS(ROW(),XMATCH("Expires",$1:$1,0))) + IFERROR(VLOOKUP(INDIRECT(ADDRESS(ROW(),XMATCH("Type",$1:$1,0))),'Expiry Schedule'!$A:$B,2,FALSE),0),"")`
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
    const newEntry = {
      ...canonicalEntry,
      Type: t,
      Email: email,
      ... (t === 'Join' || t === 'Renew' ? { "Scheduled On" : joinRenewLookupFormula } : {}) // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax#spread_in_object_literals
    };
    emailSchedule.push(newEntry);
  });
}

/**
 * 
 * @param {*} member 
 * @param {number} period 
 * @param {} emailSchedule 
 */
function renewMember(member, period, emailSchedule) {
  member.Period = period;
  member["Renewed On"] = new Date();
  member.Expires = calculateExpirationDate(period, member.Expires);
  addRenewedMemberToEmailSchedule(member, emailSchedule);
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

  return bmPreFiddler.PreFiddler().getFiddler(spec);
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