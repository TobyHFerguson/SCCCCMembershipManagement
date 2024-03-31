import { Notifier, TransactionProcessor, Directory, LocalDirectory, Templates, EmailNotifier, Member } from './Code'
import { EmailConfigurationCollection, SystemConfiguration, Transaction, bmPreFiddler } from './Types';

/**
 * @OnlyCurrentDoc - only edit this spreadsheet, and no other
 */
function processPaidTransactions() {
  const directory = getDirectory_()
  const subjectLineFiddler = bmPreFiddler.PreFiddler().getFiddler({
    id: null,
    sheetName: 'Email Configuration',
    createIfMissing: false
  })
  const emailConfig = <EmailConfigurationCollection>subjectLineFiddler.getData().reduce((p, c) => {
    const t = c["Email Type"]
    p[t] = c;
    return p;
  }, {}
  )
  const notifier = new EmailNotifier(GmailApp.getDrafts(), emailConfig, { mailer: GmailApp })
  convertLinks('Transactions');
  const transactionsFiddler = bmPreFiddler.PreFiddler().getFiddler({
    id: null,
    sheetName: 'Transactions',
    createIfMissing: false
  }).needFormulas();
  const keepFormulas = transactionsFiddler.getColumnsWithFormulas();
  const tp = new TransactionProcessor(directory, notifier)
  transactionsFiddler.mapRows((row, { rowFormulas }) => {
    tp.processTransaction(<Transaction>row);
    keepFormulas.forEach(f => row[f] = rowFormulas[f]);
    return row;
  })
  transactionsFiddler.dumpValues()
  notifier.log()
}

function createMembershipReport() {
  const directory = getDirectory_();
  const reportMembers = directory.members.map((m) => m.report)
  const membersFiddler = bmPreFiddler.PreFiddler().getFiddler({
    id: null,
    sheetName: 'MembershipReport',
    createIfMissing: true
  })
  if (reportMembers !== undefined) membersFiddler.setData(reportMembers);
  membersFiddler.dumpValues()
}

function updatedRow(e) {
  console.log(`Column: ${e.range.getColumn()} Row ${e.range.getRow()}`)
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
    .addItem('Create Membership Report', 'createMembershipReport')
    .addItem('Process Transactions', 'processPaidTransactions')
    .addToUi()
}

function convertLinks(sheetName: string) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return;
  const range = sheet.getDataRange();
  const rtvs = range.getRichTextValues();
  const values = range.getValues();
  const newValues = rtvs.map((row , r)=> {
    return row.map((column, c) => {
      if (!column) return null;
      const v = column.getText() ? column.getText() : values[r][c]
      return (column.getLinkUrl()) ? `=hyperlink("${column.getLinkUrl()}", "${v}")` : v;
    });
  });
  range.setValues(newValues);
  SpreadsheetApp.flush();
}

function getDirectory_() {
  const systemConfigFiddler = bmPreFiddler.PreFiddler().getFiddler({
    id: null,
    sheetName: 'System Configuration',
    createIfMissing: false
  })
  const systemConfiguration = <SystemConfiguration>systemConfigFiddler.getData()[0];
  const directory = new Directory(systemConfiguration)
  return directory;
}

function processPaidTransactionsTest() {
  const directory = new LocalDirectory({ orgUnitPath: "/test", domain: "santacruzcountycycling.club" })
  const notifier = new Notifier()
  const transactionsFiddler = bmPreFiddler.PreFiddler().getFiddler({
    id: "1Tm-lXtjaK2080u1dkoC902-TX0dtU5N2TVoQZG9JGdE",
    sheetName: 'Transactions',
    createIfMissing: false
  })
  const tp = new TransactionProcessor(directory, notifier)
  transactionsFiddler.mapRows(txn =>
    tp.processTransaction(<Transaction>txn))
  transactionsFiddler.dumpValues()
  notifier.log()
}

