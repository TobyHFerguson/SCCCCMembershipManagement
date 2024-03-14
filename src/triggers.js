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
  .addItem('Create Membership Report', 'createMembershipReport')
    .addItem('Process Transactions', 'processPaidTransactions')
    .addToUi()
}

function createMembershipReport() {
  const members = Exports.Directory.getAllUsers();
  let reportMembers = members.filter((m) => m.orgUnitPath.startsWith('/members')).map((m) => {
    try {
      // console.log(m)
      return {
        "primary": m.primaryEmail,
        "First": m.name.givenName,
        "Last": m.name.familyName,
        "Joined": m.customSchemas.Club_Membership.Join_Date,
        "Expires": m.customSchemas.Club_Membership.expires
      }
    } catch (err) {
      console.error(err.message)
      console.error(`error for member ${m}`)
    }
  })
  reportMembers.forEach((m) => console.log(m.primary))
  const membersFiddler = bmPreFiddler.PreFiddler().getFiddler({
      id: null,
      sheetName: 'MembershipReport',
      createIfMissing: true
    })
  membersFiddler.setData(reportMembers);
  membersFiddler.dumpValues()
}

