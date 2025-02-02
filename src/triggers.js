/**
 * @OnlyCurrentDoc - only edit this spreadsheet, and no other
 */


function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Membership Management')
    .addItem('Process Transactions', processTransactions.name)
    .addToUi();
}



const _getGroupEmails = (() => {
  let cachedGroupEmails = null;
  return () => {
    if (cachedGroupEmails) return cachedGroupEmails;
    cachedGroupEmails = getFiddler_('Group Email Addresses').getData().map(row => row.Email);
    return cachedGroupEmails;
  };
})();

function handleOnEditEvent(event) {
  const sheetName = event.range.getSheet().getName();
  switch (sheetName) {
    case 'Renewals':
      processRenewals();
      break;
    case 'Transactions':
      processTransactions();
      break;
    default:
      break;
  }
}

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

  const numMembers = membershipData.length;
  for (i = transactions.length - 1; i >= 0; i--) { // reverse order so as to preserve index during deletion
    const row = transactions[i]
    if (row["Payable Status"].toLowerCase().startsWith("paid")) {
      const matches = numMembers ? membershipFiddler.selectRows("Email", (value) => value === row["Email Address"]) : [];
      if (matches.length > 0) { // member exists
        matches.forEach((match) => {
          const member = membershipData[match];
          const years = getPeriod(row);
          renewMember(member, years, emailSchedule);
        });
      } else { // new member
        addNewMember(row, emailSchedule, membershipData, bulkGroupEmails);
      }
      row.Timestamp = new Date();
      processedTransactions.push(row);
      transactions.splice(i, 1)
      console.log(`row.Processed set to ${row.Processed}`);
    }
  }

  bulkGroupFiddler.setData(bulkGroupEmails).dumpValues();
  emailSchedule.sort((a, b) => new Date(a["Scheduled On"]) - new Date(b["Scheduled On"]));
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
  const membershipLookupFormula = '=IFERROR(VLOOKUP(INDIRECT("A"&ROW()), Membership!$A:$G, COLUMN(), FALSE), "")';
  const emailLookupFormula = '=vlookup(indirect("H"&row()),Emails!$A$1:$C$7, column() - 8, false)';
  const scheduledOnLookupFormula = `=IFERROR(INDIRECT("F"&ROW()) + iferror(vlookup(indirect("H"&row()), 'Expiry Schedule'!$A:$B, 2, FALSE), 0) , "")`
  const canonicalEntry = {
    Email: '',
    First: membershipLookupFormula,
    Last: membershipLookupFormula,
    Joined: membershipLookupFormula,
    Period: membershipLookupFormula,
    Expires: membershipLookupFormula,
    "Renewed On": membershipLookupFormula,
    Type: '',
    "Scheduled On": scheduledOnLookupFormula,
    Subject: emailLookupFormula,
    Body: emailLookupFormula
  }
  emailTypes.forEach(t => {
    const newEntry = {
      ...canonicalEntry,
      Email: email,
      Type: t,
    };
    console.log(`Adding ${newEntry} to emailSchedule`);
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
function getFiddler_(sheetName) {
  const sheetMappings = {
    'Bulk Add Groups': { sheetName: 'Bulk Add Groups', createIfMissing: true },
    'CE Members': { sheetName: 'CE Members', createIfMissing: true },
    'Email Schedule': { sheetName: 'Email Schedule', createIfMissing: true },
    'Group Email Addresses': { sheetName: 'Group Email Addresses', createIfMissing: false },
    'Membership': { sheetName: 'Membership', createIfMissing: true },
    'MembershipReport': { sheetName: 'MembershipReport', createIfMissing: true },
    'Processed Transactions': { sheetName: 'Processed Transactions', createIfMissing: true },
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