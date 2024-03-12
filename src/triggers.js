function updatedRow(e) {
  console.log(`Column: ${e.range.getColumn()} Row ${e.range.getRow()}`)
  printRow(e.range.getRow())
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
  .addItem('Process Transactions', 'processPaidTransactions')
  .addToUi()
}

