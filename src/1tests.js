function test() {
  function deepCopy(obj) {
    return JSON.parse(JSON.stringify(obj))
  }
  const fixture1 = {
    txn1: {
      "First Name": "J",
      "Last Name": "K",
      "Email Address": "j.k@icloud.com",
      "Phone Number": "+14083869343",
      "Payable Status": "paid"
    },
    txn2: {
      "First Name": "A",
      "Last Name": "B",
      "Email Address": "a.b@icloud.com",
      "Phone Number": "+14083869000",
      "Payable Status": "paid"
    },
    badTxn: {
      "First Name": "J",
      "Last Name": "K",
      "Email Address": "j.k@icloud.com",
      "Phone Number": "+14083869343",
      "Payable Status": "paid"
    },
    domain: 'a.b',
    orgUnitPath: '/test'
  }
  const badUser = new User(fixture1.txn1)
  const unit = new bmUnitTester.Unit({ showErrorsOnly: true })
  unit.section(() => {
    const f = deepCopy(fixture1)
    const txns = [f.txn1]
    const directory = new Directory()
    const notifier = new Notifier()
    const uut = new TransactionProcessor(directory, notifier)
    uut.processTransactions(txns)
    const m1 = new User(f.txn1)
    unit.is([m1], directory.members, { description: "Expecting txn1 member to have joined the Directory" })
    directory.deleteUser(m1)
    unit.is([], directory.members, { description: "Expected member to have been deleted from the directory" })
  },
    { description: "user create/delete tests" })
  unit.section(() => {
    const f = deepCopy(fixture1)
    const uut = new User(f.txn1, f.orgUnitPath, f.domain)
    unit.is(uut.orgUnitPath, f.orgUnitPath, { description: "Expecting orgUnitPath to be setup correctly" })
    unit.is(uut.primaryEmail.split('@')[1], f.domain, { description: "Expecting domain to be setup correctly" })
  },
    {
      description: "User tests",
      skip: true
    })
  unit.section(() => {
    const f = deepCopy(fixture1)
    const txns = [f.txn1, f.txn2]
    const directory = new Directory()
    const notifier = new Notifier()
    const uut = new TransactionProcessor(directory, notifier)
    uut.processTransactions(txns)
    const members = directory.members
    unit.is(2, members.length, { description: "Expected to have 2 new members" })
    let expectedMembers = txns.map((t) => new User(t))
    unit.is(expectedMembers, members, { desription: "Expected new members to be made from the transactions" })
    let expectedLog = txns.map((t, i) => { return { txn: t, user: expectedMembers[i] } })
    unit.is(expectedLog, notifier.joinLog, { description: "Expected notification log to contain the transactions and the members" })
    txns.forEach((t) => {
      unit.not(undefined, t.Processed, { neverUndefined: false, description: "Expected both transactions to have been processed" })
    })
  }, {
    description: "Initial TransactionProcessor join tests",
    skip: true
  })
  unit.section(() => {
    const txn1 = {
      "First Name": "J",
      "Last Name": "K",
      "Email Address": "j.k@icloud.com",
      "Phone Number": "+14083869343",
      "Payable Status": "paid"
    }
    const txn2 = { ...txn1 }
    txn2["Email Address"] = "foo.bar@x.com"
    txn2["Phone Number"] = "1234"
    const directory = new Directory()
    const notifier = new Notifier()
    const uut = new TransactionProcessor(directory, notifier)
    uut.processTransactions([txn1, txn2])
    unit.is(2, directory.members.filter((m) => m.name.givenName === "J").length, { description: "Expecting to be able to add multiple people with same names but different phones and emails" })
    unit.not([new User(txn1), new User(txn2)], directory.members, { description: "Expecting that the two members aren't the ones I started with" })
    unit.is(true, directory.members.some((m) => m.primaryEmail.split("@")[0].endsWith(1)), { description: "Expecting one of the members has had a suffix added to their email address" })
  },
    {
      description: "Test of the ability for multiple people with the same name to join",
      skip: true
    })
  unit.section(() => {

    class ED extends Directory {
      addUser(user) {
        if (user.primaryEmail === badUser.primaryEmail) { throw new DirectoryError() }
        super.addUser(user)
      }
    }

    const f = deepCopy(fixture1)
    const txns = [f.txn1, f.txn2]
    const badTxn = f.txn1
    const txn2 = f.txn2
    const directory = new ED()
    const notifier = new Notifier()
    const uut = new TransactionProcessor(directory, notifier)
    uut.processTransactions(txns)
    const members = directory.members
    unit.is(1, members.length, { description: "Only one member expected" })
    unit.is([new User(txn2)], members, { description: "Expect myTxn2 to have become a member" })
    unit.is([{ txn: txn2, user: new User(txn2) }], notifier.joinLog, { description: "successful join notification is expected to be txn2" })
    unit.is(1, notifier.joinFailureLog.length, { description: "one join failure expected" })
    notifier.joinFailureLog.forEach((l) => {
      unit.is(true, l.err instanceof Error)
      delete l.err
    })
    unit.is([{ txn: badTxn, user: badUser }], notifier.joinFailureLog, { description: "Join failure is expected to be badTxn" })
    unit.is(undefined, badTxn.Processed, { neverUndefined: false, description: "badTxn should not have been processed" })
    unit.is(true, new Date(txn2.Processed) instanceof Date, { description: "myTxn2 should have a processing date" })
    unit.not(undefined, txn2.Processed, { neverUndefined: false, description: "txn2 should  have been processed" })
  }, {
    description: "TransactionProcessor join failure tests",
    neverUndefined: false,
    skip: true
  })
  unit.section(() => {
    const f = deepCopy(fixture1)
    const txns = [f.txn1, f.txn2]
    const renewalTxn = txns[0]
    const renewingUser = new User(renewalTxn)
    const joinTxn = txns[1]
    const joiningUser = new User(joinTxn)
    const directory = new Directory()
    directory.members = [renewingUser]
    const notifier = new Notifier()
    const uut = new TransactionProcessor(directory, notifier)
    uut.processTransactions(txns)
    const updatedRenewingUser = new User(renewalTxn)
    updatedRenewingUser.incrementExpirationDate()
    unit.is(true, directory.members.some((m) => m.primaryEmail = updatedRenewingUser.primaryEmail), { description: "The renewed user is expected to be a member of the Directory" })
    unit.is(true, directory.members.some((m) => m.primaryEmail = joiningUser.primaryEmail), { description: "The joining user is expected to be a member of the Directory" })

    unit.is([{ txn: renewalTxn, user: updatedRenewingUser }], notifier.renewalSuccessLog, { description: "notification of renewal expected" })
    unit.not(undefined, renewalTxn.Processed, { description: "renewalTxn has been processed" })
    unit.is([{ txn: joinTxn, user: new User(joinTxn) }], notifier.joinLog, { description: "notification of join expected" })
    unit.not(undefined, joinTxn.Processed, { description: "joinTxn has been processed" })

  }, {
    description: "Renewal Tests",
    skip: true
  })
  unit.section(() => {
    const f = deepCopy(fixture1)
    const renewalTxn = f.txn1
    const badUser = new User(renewalTxn);
    const expectedMember = new User(badUser)
    unit.is(badUser, expectedMember, { description: "users should be the same" })
    unit.not(badUser.incrementExpirationDate, expectedMember, { description: "users should be different" })
    const txns = [renewalTxn];
    class BadRenewalDirectory extends Directory {
      updateUser(user) {
        if (user.primaryEmail === badUser.primaryEmail) { throw new Error() }
        super.updateUser(user)
      }
    }
    const directory = new BadRenewalDirectory()
    directory.members = [badUser]
    const notifier = new Notifier()
    const uut = new TransactionProcessor(directory, notifier)
    uut.processTransactions(txns)
    unit.is([expectedMember], directory.members, { description: "Expecting member to be untouched" })
    unit.is(undefined, renewalTxn.Processed, { description: "Expecting renewalTxn to not have been processed", neverUndefined: false })
    let rfl = notifier.renewalFailureLog
    delete rfl[0].err
    unit.is([{ txn: renewalTxn, user: expectedMember }], rfl, { description: "Expecting renewalTxn and expectedMember to be in the renewalFailureLog" })
  },
    {
      description: "Renewal failure tests",
      skip: true
    })
  unit.section(() => {
    const f = deepCopy(fixture1)
    const t1 = f.txn1
    const t2 = deepCopy(t1)
    const directory = new Directory()
    const notifier = new Notifier()
    const uut = new TransactionProcessor(directory, notifier)
    uut.processTransactions([t1]);
    t2["Phone Number"] = "+1234"
    uut.processTransactions([t2]);
    unit.is(1, directory.members.length, { description: "something was added as a member" })
    unit.is(new User(t1), directory.members[0], { description: "t1 added as a member" })
    unit.is(true, directory.members.some((m) => m.phones[0].value === new User(t1).phones[0].value), { description: "Expecting directory to contain the t1 user" })
    unit.is(false, directory.members.some((m) => m.phones[0].value === new User(t2).phones[0].value), { description: "Expecting directory not to contain the t2 user" })
    unit.is([{ txn: t2, user: new User(t1) }], notifier.partialsLog, { description: "Expecting to be notified about the partials" })
  },
    {
      description: "Partials",
      skip: true
    })
  return unit.isGood()
}
function runUnitTest() {
  const txn = {
    "First Name": "J",
    "Last Name": "K",
    "Email Address": "j.k@icloud.com",
    "Phone Number": "+14083869343"
  }
  const unit = new bmUnitTester.Unit({ showErrorsOnly: true })
  const mf = MembershipFunctions
  unit.section(() => {
    let user = new User(txn)
    Directory.deleteUser(user)
    Utilities.sleep(5 * 1000)
    let newUser = Directory.addUser_(user)
    unit.is(`J.K@${domain}`, newUser.primaryEmail)
    while (true) {
      try {
        Directory.deleteUser(user)
        break
      }
      catch (err) {
        if (err.message.endsWith("User creation is not complete.")) {
          Utilities.sleep(5 * 1000)
        } else {
          throw err
        }
      }
    }
  },
    {
      description: "test make user",
      skip: true
    })
  unit.section(() => {
    const jd = new Date().toISOString().split('T')[0];
    let ed = new Date()
    ed.setFullYear(ed.getFullYear() + 1)
    ed = ed.toISOString().split('T')[0];
    const expected = {
      "primaryEmail": `J.K@${domain}`, "name": { "givenName": "J", "familyName": "K" }, "emails": [{ "address": "j.k@icloud.com", "type": "home" }], "phones": [{ "value": "+14083869343", "type": "mobile" }], "customSchemas": { "Club_Membership": { "expires": ed, "Join_Date": jd } }, "orgUnitPath": "/members", "recoveryEmail": "j.k@icloud.com", "recoveryPhone": "+14083869343"
    }
    let user = new User(txn)
    let actual = user
    unit.is(expected.emails, actual.emails)
    unit.is(expected.phones, actual.phones)
    unit.is(expected.customSchemas, actual.customSchemas)
    unit.is(expected, actual)
    user.incrementExpirationDate();
    ed = new Date(ed)
    ed.setFullYear(ed.getFullYear() + 1)
    ed = ed.toISOString().split('T')[0];
    unit.is(ed, user.customSchemas.Club_Membership.expires)
    let user2 = new User(user)
    unit.is(user, user2, { description: "Expected the copy constructor to make identical copies" })
    user2.incrementExpirationDate()
    unit.not(user, user2, { description: "Expected deep copies, not shallow copies" })
  },
    {
      description: "User Constructor",
      skip: true
    })
  unit.section(() => {
    const match = MembershipFunctions.internal.matchTransactionToMember
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
    unit.is(undefined, members.find((m) => match(nomatch, m)), { neverUndefined: false })
    unit.is(member, members.find((m) => match(partial1, m)))
    unit.is(member, members.find((m) => match(partial2, m)))

  },
    {
      description: "matcher tests",
      skip: true
    })
  unit.section(() => {
    const result = { join: "", renew: "", partial: "" }
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
    {
      description: "processPaidTransaction tests",
      skip: true
    })

  return unit.isGood()
}

// const ns = (() => {
//   const unit = new bmUnitTester.Unit()
//   const mf = new MembershipFunctions
//   unit.section(() => {
//     let user = mf.internal.createUserObject("J.K@santacruzcountycycling.club", "J", "K", "j.k@icloud.com", "+14083869343")
//     unit.is({}, user)
//   })
//   return {unit}
// })()
function testProcessPaidTransactions() {
  const dir = Directory;
  const mfs = MembershipFunctions;
  const transactionsFiddler = mfs.internal.getTransactionsFiddler()
  const transactions = transactionsFiddler.getData()
  mfs.processPaidTransactions(transactions, dir)
  transactions.forEach((t) => console.log(t))
  transactionsFiddler.dumpValues()
}

function testGetAllUsers() {
  const dir = Directory
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
  const mf = MFs
  mf.internal.createUserObject()
}