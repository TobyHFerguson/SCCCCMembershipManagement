import { Notifier, TransactionProcessor, Directory, LocalDirectory, Templates, EmailNotifier } from './Code'
import { EmailConfigurationCollection, Transaction, bmPreFiddler } from './Types';



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

function createMembershipReport() {
  const directory = new Directory()
  const reportMembers = directory.members.map((m) => {
    try {
      // console.log(m)
      return {
        "primary": m.primaryEmail,
        "First": m.name.givenName,
        "Last": m.name.familyName,
        "Joined": m.customSchemas.Club_Membership.Join_Date,
        "Expires": m.customSchemas.Club_Membership.expires
      }
    } catch (err:any) {
      console.error(err.message)
      console.error(`error for member ${m}`)
      return {}
    }
  }).filter(m => m.primary)
  reportMembers.forEach((m) => console.log(m?.primary))
  const membersFiddler = bmPreFiddler.PreFiddler().getFiddler({
    id: null,
    sheetName: 'MembershipReport',
    createIfMissing: true
  })
  if (reportMembers !== undefined ) membersFiddler.setData(reportMembers);
  membersFiddler.dumpValues()
}

function processPaidTransactions() {
  const directory = new Directory()
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
  const notifier = new EmailNotifier(GmailApp.getDrafts(), emailConfig, {mailer: GmailApp})
  const transactionsFiddler = bmPreFiddler.PreFiddler().getFiddler({
    id: "1Tm-lXtjaK2080u1dkoC902-TX0dtU5N2TVoQZG9JGdE",
    sheetName: 'Transactions',
    createIfMissing: false
  })
  const tp = new TransactionProcessor(directory, notifier)
  const txns = <Transaction[]>transactionsFiddler.getData()
  tp.processTransactions(txns)
  transactionsFiddler.dumpValues()
  notifier.log()
}

function processPaidTransactionsTest() {
  const directory = new LocalDirectory()
  const notifier = new Notifier()
  const transactionsFiddler = bmPreFiddler.PreFiddler().getFiddler({
    id: "1Tm-lXtjaK2080u1dkoC902-TX0dtU5N2TVoQZG9JGdE",
    sheetName: 'Transactions',
    createIfMissing: false
  })
  const tp = new TransactionProcessor(directory, notifier)
  const txns = <Transaction[]>transactionsFiddler.getData()
  tp.processTransactions(txns)
  transactionsFiddler.dumpValues()
  notifier.log()
}

