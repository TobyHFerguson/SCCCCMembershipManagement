function runUnitTest() {
  const unit = new bmUnitTester.Unit({ showErrorsOnly: true })
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
    let txn = { 'Email Address': email, 'Phone Number': phone }
    const partial1 = { ...txn, 'Email Address': 'foo' }
    const partial2 = { ...txn, 'Phone Number': 'foo' }
    const nomatch = { 'Email Address': 'foo', 'Phone Number': 'bar' }
    const member = { emails: [{ type: 'home', address: email }], phones: [{ type: 'mobile', value: phone }] }
    unit.is({ full: true }, match(txn, member))
    unit.is(false, match(nomatch, member))
    unit.is({ full: false }, match(partial1, member))
    unit.is({ full: false }, match(partial2, member))
    let members = [member]
    unit.is(member, members.find((m) => match(txn, m)))
    unit.is(undefined, members.find((m) => match(nomatch, m)), {  neverUndefined: false})
    unit.is(member, members.find((m) => match(partial1, m)))
    unit.is(member, members.find((m) => match(partial2, m)))

  },
    {
      description: "matcher tests",
      skip: false
    })
  unit.section(() => {
    const result = { join: "", renew: "", partial: ""}
    const join = () => result.join = "joined"
    const renew = () => result.renew = "renewed"
    const partial = () => result.partial = "partial"
    const email = "email"
    const phone = "phone"
    let txn = { 'Email Address': email, 'Phone Number': phone, "Payable Status": "paid" }
    const partial1 = { ...txn, 'Email Address': 'foo' }
    const partial2 = { ...txn, 'Phone Number': 'foo' }
    const nomatch = { ...txn, 'Email Address': 'foo', 'Phone Number': 'bar' }
    const member = { emails: [{ type: 'home', address: email }], phones: [{ type: 'mobile', value: phone }] }
    mf.processPaidTransactions([txn], [member], join, renew, partial)
    unit.is("renewed", result.renew)
    mf.processPaidTransactions([partial1], [member], join, renew, partial)
    unit.is("partial", result.partial)
    mf.processPaidTransactions([partial2], [member], join, renew, partial)
    unit.is("partial", result.partial)
    mf.processPaidTransactions([nomatch], [member], join, renew, partial)
    unit.is("joined", result.join)
  },
    { description: "processPaidTransaction tests" })

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