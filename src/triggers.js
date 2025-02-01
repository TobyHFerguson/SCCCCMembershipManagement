/**
 * @OnlyCurrentDoc - only edit this spreadsheet, and no other
 */


function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Membership Management')
    .addItem('Create Membership Report', createMembershipReport.name)
    .addItem('Process Transactions', processTransactions.name)
    .addItem('Check Expirations', checkExpirations.name)
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
    if (row["Payable Status"].toLowerCase().startsWith("paid") ) {
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
  const dates = [-30, -15, 0, 15].map(days => addDaysToDate(member.Expires, days));
  dates.unshift(new Date());
  const emailTypes = [emailType, 'Expiry 1', 'Expiry 2', 'Expiry 3', 'Expiry 4'];
  const membershipLookupFormula = '=IFERROR(VLOOKUP(INDIRECT("A"&ROW()), Membership!$A:$G, COLUMN(), FALSE), "")';
  const emailLookupFormula = '=vlookup(indirect("H"&row()),Emails!$A$1:$C$7, column() - 8, false)';
  const canonicalEntry = {
    Email: '',
    First: membershipLookupFormula,
    Last: membershipLookupFormula,
    Joined: membershipLookupFormula,
    Period: membershipLookupFormula,
    Expires: membershipLookupFormula,
    "Renewed On": membershipLookupFormula,
    Type: '',
    "Scheduled On": '',
    Subject: emailLookupFormula,
    Body: emailLookupFormula
  }
  dates.forEach((date, index) => {
    const newEntry = {
      ...canonicalEntry,
      Email: email,
      Type: emailTypes[index],
      "Scheduled On": date,
    };
    console.log(`Adding ${newEntry} to emailSchedule`);
    emailSchedule.push(newEntry);
  });
}

function renewMember(member, period, emailSchedule) {
  member.Period = period;
  member["Renewed On"] = new Date();
  member.Expires = calculateExpirationDate(period, member.Expires);
  addRenewedMemberToEmailSchedule(member, emailSchedule);
}

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
function addDaysToDate(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
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
function migrateCEMembers() {
  const notifier = getEmailNotifier_();
  const directory = getDirectory_();
  const ceFiddler = bmPreFiddler.PreFiddler().getFiddler({
    id: null,
    sheetName: 'CE Members',
    createIfMissing: false,
  });
  ceFiddler
    .mapRows(row => {
      const cm = row;
      if (!cm.Imported) {
        let newMember = directory.makeMember(cm);
        try {
          newMember = migrateMember_(cm);
          cm.Imported = ML.Member.convertToYYYYMMDDFormat_(new Date());
          notifier.importSuccess(cm, newMember);
        } catch (err) {
          notifier.importFailure(cm, newMember, err);
        }
      }
      delete row.password;
      return row;
    })
    .dumpValues();
  notifier.log();
}
function createMembershipReport() {
  const directory = getDirectory_();
  const reportMembers = directory.getMembers().map(m => {
    return m.report;
  });
  const membersFiddler = bmPreFiddler.PreFiddler().getFiddler({
    id: null,
    sheetName: 'MembershipReport',
    createIfMissing: true,
  });
  if (reportMembers !== undefined) membersFiddler.setData(reportMembers);
  membersFiddler.dumpValues();
}
function checkExpirations() {
  const expirationProcessor = new ML.ExpirationProcessor(
    getEmailConfiguration_(),
    getEmailNotifier_()
  );
  getDirectory_()
    .getMembers()
    .forEach(m => {
      return expirationProcessor.checkExpiration(m);
    });
}
function getEmailNotifier_() {
  const emailConfig = getEmailConfiguration_();
  const notifier = new ML.EmailNotifier(
    GmailApp,
    emailConfig,
    getSystemConfig_()
  );
  return notifier;
}
function getEmailConfiguration_() {
  return bmPreFiddler
    .PreFiddler()
    .getFiddler({
      id: null,
      sheetName: 'Email Configuration',
      createIfMissing: false,
    })
    .getData()
    .reduce((p, c) => {
      const t = c['Email Type'];
      p[t] = c;
      return p;
    }, {});
}
function updatedRow_(e) {
  console.log('Column: '.concat(e.range, ' Row ').concat(e.range.getRow()));
  // printRow(e.range.getRow())
}

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
function getDirectory_() {
  const directory = new ML.Directory({
    adminDirectory: AdminDirectory,
    options: getSystemConfig_(),
  });
  return directory;
}
let systemConfiguration;
function getSystemConfig_() {
  if (systemConfiguration) return systemConfiguration;
  const systemConfigFiddler = bmPreFiddler.PreFiddler().getFiddler({
    id: null,
    sheetName: 'System Configuration',
    createIfMissing: false,
  });
  systemConfiguration = systemConfigFiddler.getData()[0];
  systemConfiguration.groups = 'public_';
  return systemConfiguration;
}
function migrateMember_(currentMember) {
  const directory = getDirectory_();
  const nm = directory.makeMember(currentMember);
  try {
    return directory.addMember(nm);
  } catch (err) {
    if (err.message.endsWith('Entity already exists.')) {
      return directory.updateMember(nm);
    } else {
      throw err;
    }
  }
}
function testMigrateMember() {
  const currentMember = {
    'First Name': 'given',
    'Last Name': 'family',
    'Email Address': 'a@b.com',
    'Phone Number': '+14083869343',
    'In Directory': true,
    Joined: Member.convertToYYYYMMDDFormat_(new Date('2024-05-23')),
    Expires: Member.convertToYYYYMMDDFormat_(new Date('2025-05-23')),
    'Membership Type': 'Family',
  };
  migrateMember_(currentMember);
}
function addMemberToSG() {
  const directory = getDirectory_();
  const member = directory.getMember(
    'ginger.rogers@santacruzcountycycling.club'
  );
  directory.addMemberToGroup(
    member,
    'club_members@santacruzcountycycling.club'
  );
}


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