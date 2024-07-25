/**
 * @OnlyCurrentDoc - only edit this spreadsheet, and no other
 */
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
  processPaidTransactions_('Transactions');
}
function processRenewals() {
  const directory = getDirectory_();
  const notifier = getEmailNotifier_();
  const sheetName = 'Renewals';
  convertLinks_(sheetName);
  const fiddler = bmPreFiddler
    .PreFiddler()
    .getFiddler({
      id: null,
      sheetName: sheetName,
      createIfMissing: false,
    })
    .needFormulas();
  const keepFormulas = fiddler.getColumnsWithFormulas();
  const tp = new ML.TransactionProcessor(directory, notifier);
  fiddler.mapRows((row, _a) => {
    const rowFormulas = _a.rowFormulas;
    if (row.Processed) return row;
    tp.renew(row);
    keepFormulas.forEach(f => {
      return (row[f] = rowFormulas[f]);
    });
    delete row.password;
    return row;
  });
  fiddler.dumpValues();
  notifier.log();
}
function processPaidTransactions_(sheetName) {
  const directory = getDirectory_();
  const notifier = getEmailNotifier_();
  convertLinks_(sheetName);
  const transactionsFiddler = bmPreFiddler
    .PreFiddler()
    .getFiddler({
      id: null,
      sheetName: sheetName,
      createIfMissing: false,
    })
    .needFormulas();
  const keepFormulas = transactionsFiddler.getColumnsWithFormulas();
  const tp = new ML.TransactionProcessor(directory, notifier);
  transactionsFiddler.mapRows((row, _a) => {
    const rowFormulas = _a.rowFormulas;
    tp.processTransaction(row);
    keepFormulas.forEach(f => {
      return (row[f] = rowFormulas[f]);
    });
    delete row.password;
    return row;
  });
  transactionsFiddler.dumpValues();
  notifier.log();
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
/**
 * Creates the menu item "Mail Merge" for user to run scripts on drop-down.
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  // ui.createMenu('Mail Merge')
  //     .addItem('Send Emails', 'sendEmails')
  //     .addToUi();
  ui.createMenu('Membership Management')
    .addItem('Create Membership Report', createMembershipReport.name)
    .addItem('Process Transactions', processTransactions.name)
    .addItem('Process Renewals', processRenewals.name)
    .addItem('Migrate CE Members', migrateCEMembers.name)
    .addItem('Check Expirations', checkExpirations.name)
    .addToUi();
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
