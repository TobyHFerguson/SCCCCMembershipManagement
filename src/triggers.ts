import { Notifier, TransactionProcessor, Transaction, Directory, LocalDirectory } from './Code';
import { bmPreFiddler } from './Types';



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
  const notifier = new Notifier()
  const transactionsFiddler = bmPreFiddler.PreFiddler().getFiddler({
    id: "1Tm-lXtjaK2080u1dkoC902-TX0dtU5N2TVoQZG9JGdE",
    sheetName: 'Transactions',
    createIfMissing: false
  })
  const tp = new TransactionProcessor(directory, notifier)
  const txns = transactionsFiddler.getData().map(o => new Transaction(o["First Name"], o["Last Name"], o["Email Address"], o["Phone Number"], o["Payable Status"],  o["Payable Order ID"], o["Processed"]))
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
  const txns = transactionsFiddler.getData().map(o => new Transaction(o["First Name"], o["Last Name"], o["Email Address"], o["Phone Number"], o["Payable Status"],  o["Payable Order ID"], o["Processed"]))
  tp.processTransactions(txns)
  transactionsFiddler.dumpValues()
  notifier.log()
}

