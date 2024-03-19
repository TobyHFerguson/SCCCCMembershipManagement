function runUnitTest() {
  const unit = new bmUnitTester.Unit({showErrorsOnly: true})
  const mf = Exports.MembershipFunctions
  unit.section(() => {
    const txn = {
      "First Name": "J",
      "Last Name": "K",
      "Email Address": "j.k@icloud.com",
      "Phone Number": "+14083869343"
    }
    const jd = new Date().toISOString().split('T')[0];
    let ed = new Date()
    ed.setFullYear(ed.getFullYear() + 1)
    ed = ed.toISOString().split('T')[0];
    const expected = {
      "primaryEmail": "J.K@santacruzcountycycling.club", "name": { "givenName": "J", "familyName": "K" }, "emails": [{ "address": "j.k@icloud.com", "type": "home" }], "phones": [{ "value": "+14083869343", "type": "mobile" }], "customSchemas": { "Club_Membership": { "expires": ed, "Join_Date": jd } }, "orgUnitPath": "/members", "recoveryEmail": "j.k@icloud.com", "recoveryPhone": "+14083869343"
    }
    let actual = new Exports.User(txn).getObject()
    unit.is(expected.emails, actual.emails)
    unit.is(expected.phones, actual.phones)
    unit.is(expected.customSchemas, actual.customSchemas)
    unit.is(expected, actual)
  },
    {
      description: "Unit Constructor",
      skip: false
    })
  unit.section(() => {
    const match = Exports.MembershipFunctions.internal.matchTransactionToMember
    const email = "email"
    const phone = "phone"
    let txn = { 'Email Address': email, 'Phone Number': phone}
    const member = { emails: [ {type : 'home', address: email }], phones: [ {type: 'mobile', value: phone}]}
    const expected = 1
    const actual = match(txn, member)
    unit.is(1, match(txn, member))
    unit.is(0, match({ 'Email Address': 'foo', 'Phone Number': 'bar'}, member))
    unit.is(-1, match({...txn, 'Email Address': 'foo'}, member))
    unit.is(-1, match({...txn, 'Phone Number': 'foo'}, member))
  }, 
  {description: "matcher tests",
})

  return unit.isGood()
}
// const ns = (() => {
//   const unit = new bmUnitTester.Unit()
//   const mf = new Exports.MembershipFunctions
//   unit.section(() => {
//     let user = mf.internal.createUserObject("J.K@santacruzcountycycling.club", "J", "K", "j.k@icloud.com", "+14083869343")
//     unit.is({}, user)
//   })
//   return {unit}
// })()
function testProcessPaidTransactions() {
  const dir = Exports.Directory;
  const mfs = Exports.MembershipFunctions;
  const transactionsFiddler = mfs.internal.getTransactionsFiddler()
  const transactions = transactionsFiddler.getData()
  mfs.processPaidTransactions(transactions, dir)
  transactions.forEach((t) => console.log(t))
  transactionsFiddler.dumpValues()
}

function testGetAllUsers() {
  const dir = Exports.Directory
  const unit = new bmUnitTester.Unit({ showErrorsOnly: true })
  unit.section(() => {
    let actual = dir.getAllUsers().filter((u) => u.primaryEmail === "toby.ferguson@santacruzcountycycling.club").length
    let expected = 1
    unit.is(expected, actual)
  })
}


function t() {
  Logger.log(Cob.fa());
  Logger.log(Cob.ca);
}

function t2() {
  const mf = Exports.MFs
  mf.internal.createUserObject()
}