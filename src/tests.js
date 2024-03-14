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
  const unit = new bmUnitTester.Unit({showErrorsOnly: true })
  unit.section(() => {
    let actual = dir.getAllUsers().filter((u) => u.primaryEmail === "toby.ferguson@santacruzcountycycling.club").length
    let expected = 1
    unit.is(expected, actual)
  })
}
function runUnitTest() {
  const unit = new bmUnitTester.Unit()
  const mf = Exports.MembershipFunctions
  unit.section(() => {
    const expected = {
      "primaryEmail": "J.K@santacruzcountycycling.club", "name": { "givenName": "J", "familyName": "K" }, "emails": [{ "address": "j.k@icloud.com", "type": "home" }], "phones": [{ "value": "+14083869343", "type": "mobile" }], "customSchemas": { "Club_Membership": { "expires": "2024-03-13", "Join_Date": "2024-03-13" } }, "orgUnitPath": "/members", "recoveryEmail": "j.k@icloud.com", "recoveryPhone": "+14083869343"
    }
    let actual = mf.internal.createUserObject("J.K@santacruzcountycycling.club", "J", "K", "j.k@icloud.com", "+14083869343")
    unit.is(expected, actual)
  })
  unit.section(() => {
    unit.is('foo', 'foo', { description: 'foo is foo' })
    unit.not('foo', 'bar', { description: 'foo is not bar' })
  },
    { description: 'sections can have descriptions',
    showErrorsOnly: true }
  )
  unit.section(() => {
    unit.is('foo', 'bar')
  }, {
    description: 'entire sections can be skipped',
    skip: true
  })
}
function runTest() {
  const i = Exports.MembershipFunctions.internal
  i.createUserObject("J.K@santacruzcountycycling.club", "J", "K", "j.k@icloud.com", "+14083869343")
}

function t() {
  Logger.log(Cob.fa());
  Logger.log(Cob.ca);
}

function t2() {
  const mf = Exports.MFs
  mf.internal.createUserObject()
}