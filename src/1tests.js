

function test() {
  const SKIP = false;
  // const sdk = Admin;
  const sdk = AdminDirectory;

  const unit = new bmUnitTester.Unit({ showErrorsOnly: true })
  /**
   * 
   * @param {Directory} directory - directory to be tested against
   * @param {string} description - the descripton to be used
   * @param {boolean} [skip=false] - whether to skip this test or not
   */
  function testDirectory_(directory, description, skip = false) {
    const fixture = new Fixture1(directory)
    unit.section(() => {
      const directory = fixture.directory
      let user = directory.makeMember(fixture.txn1)
      directory.addMemberFromTransaction(fixture.txn1)
      const expected = directory.makeMember(fixture.txn1)
      unit.is(true, directory.isKnownMember(expected), { description: "Expected user to be in members" })
      const old = user.customSchemas.Club_Membership.expires
      const updatedUser = directory.getMember(user).incrementExpirationDate()
      directory.updateMember(updatedUser)
      unit.not(old, updatedUser.incrementExpirationDate().customSchemas.Club_Membership.expires, { description: "Expected old and new dates to differ" })
      expected.incrementExpirationDate()
      unit.is(true, directory.isKnownMember(expected), { description: "Expected updated user to be in members" })
      function unf() {
        try {
          directory.updateMember(directory.makeMember(fixture.txn2))
        } catch (err) {
          return err
        }
        return new Error("Expecting an error")
      }
      unit.is(true, unf() instanceof MemberNotFoundError, { description: "Expecting update of uknown user to throw UserNotFoundException" })
      directory.deleteMember(user)
      directory.deleteMember(user, false)
      unit.is(true, !directory.isKnownMember(expected), { description: "Expected deletion to be idempotent" })
    },
      {
        description,
        skip
      })
  }

  function testDirectory(directory, description, skip = false) {
    cleanUp_(testDirectory_, directory, description, skip)
  }
  testDirectory(new Directory(sdk), "Google Directory test", SKIP)

  function cleanUp_(f, directory, description, skip) {
    try {
      f(directory, description, skip)
    } finally {
      directory.members.forEach((m, i, em) => directory.deleteMember(m, (i === em.length - 1)))
    }
  }
  function testCreateDeleteTests_(directory, description, skip = false) {
    const f = new Fixture1(directory, new Notifier())
    unit.section(() => {
      const txns = [f.txn1]
      const directory = f.directory
      const notifier = f.notifier
      const uut = new TransactionProcessor(directory, notifier)
      uut.processTransactions(txns)
      const expected = directory.makeMember(f.txn1)
      unit.is(true, directory.isKnownMember(expected), { description: "Expecting txn1 member to have joined the Directory" })
      directory.deleteMember(expected)
      unit.is(false, directory.isKnownMember(expected), { description: "Expected member to have been deleted from the directory" })
    },
      {
        description,
        skip
      })
  }
  function testCreateDeleteTests(directory, description, skip = false) {
    cleanUp_(testCreateDeleteTests_, directory, description, skip)
  }
  testCreateDeleteTests(new Directory(sdk), "user create/delete tests", SKIP)

  function testUser(directory, description, skip = false) {
    const f = new Fixture1(directory)
    unit.section(() => {
      const uut = f.directory.makeMember(f.txn1)
      unit.is(uut.orgUnitPath, f.directory.orgUnitPath, { description: "Expecting orgUnitPath to be setup correctly" })
      unit.is(uut.primaryEmail.split('@')[1], f.directory.domain, { description: "Expecting domain to be setup correctly" })
    },
      {
        description,
        skip
      })
  }

  testUser(new Directory(sdk), "User tests", SKIP)

  function initialTPJoinTests(directory, description, skip = false) {
    cleanUp_(initialTPJoinTests_, directory, description, skip)
  }
  function initialTPJoinTests_(directory, description, skip = false) {
    const f = new Fixture1(directory, new Notifier())
    unit.section(() => {
      const txn3 = { ...f.txn1 }
      txn3["Phone Number"] = "+14083869399"
      txn3["Email Address"] = "foo@bar.com"
      const txns = [f.txn1, f.txn2, txn3]
      const directory = f.directory
      const notifier = f.notifier
      const uut = new TransactionProcessor(directory, notifier)
      uut.processTransactions(txns)
      let actualMembers = directory.members
      let expectedMembers = txns.map((t, i, ts) => {
        const nu = directory.makeMember(t); if (i < ts.length - 1) { return nu } else {
          nu.primaryEmail = `${t["First Name"]}.${t["Last Name"]}1@${directory.domain}`.toLowerCase();
          nu.emails.filter((e) => e.primary).forEach((e) => e.address = nu.primaryEmail)
          return nu
        }
      })
      unit.is(3, actualMembers.length, { description: "Expected to have 3 new members" })
      expectedMembers.forEach((m) => {
        let am = actualMembers.find((a) => a.primaryEmail === m.primaryEmail)
        unit.is(m.name, am.name, { description: "Expected names to match" })
        unit.is(m.emails, am.emails, { description: "Expected home emails to match" })
        unit.is(m.phones, am.phones, { description: "Expected phones to match" })
        unit.is(m.customSchemas, am.customSchemas, { description: "Expected custom schemas to match" })
      })
      txns.forEach((t, i, ts) => {
        const el = { txn: t, user: expectedMembers[i] }
        if (i === ts.length - 1) el.user.generation_ = 1;
        unit.is(el, notifier.joinLog[i], { description: "Expected log entries to match" })
      })
      txns.forEach((t) => {
        unit.not(undefined, t.Processed, { neverUndefined: false, description: "Expected all transactions to have been processed" })
      })
    },
      {
      description,
      skip
    })

  }
  initialTPJoinTests(new Directory(sdk), "TransactionProcessor join tests", SKIP)


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
    const f = new Fixture1()
    const directory = f.directory
    const notifier = f.notifier
    const uut = new TransactionProcessor(directory, notifier)
    uut.processTransactions([txn1, txn2])
    unit.is(2, directory.members.filter((m) => m.name.givenName === "J").length, { description: "Expecting to be able to add multiple people with same names but different phones and emails" })
    unit.not([directory.makeMember(txn1), directory.makeMember(txn2)], directory.members, { description: "Expecting that the two members aren't the ones I started with" })
    unit.is(true, directory.members.some((m) => m.primaryEmail.split("@")[0].endsWith(1)), { description: "Expecting one of the members has had a suffix added to their email address" })
  },
    {
      description: "Test of the ability for multiple people with the same name to join",
      skip: true
    })
  unit.section(() => {

    class ED  {
      constructor(directory) {
        this.directory = directory
      }
      addMemberFromTransaction(txn) {
        if (txn.primaryEmail === badUser.primaryEmail) { throw new DirectoryError() }
        directory.addMemberFromTransaction(txn)
      }
    }

    const f = new Fixture1()
    const txns = [f.txn1, f.txn2]
    const badTxn = f.txn1
    const txn2 = f.txn2
    const directory = new ED()
    const notifier = f.notifier
    const uut = new TransactionProcessor(directory, notifier)
    uut.processTransactions(txns)
    const members = directory.members
    unit.is(1, members.length, { description: "Only one member expected" })
    unit.is([directory.makeMember(txn2)], members, { description: "Expect myTxn2 to have become a member" })
    unit.is([{ txn: txn2, user: directory.makeMember(txn2) }], notifier.joinLog, { description: "successful join notification is expected to be txn2" })
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
    const f = new Fixture1()
    const txns = [f.txn1, f.txn2]
    const renewalTxn = txns[0]
    const renewingUser = f.directory.makeMember(renewalTxn)
    const joinTxn = txns[1]
    const joiningUser = f.directory.makeMember(joinTxn)
    const directory = f.directory
    directory.members = [renewingUser]
    const notifier = f.notifier
    const uut = new TransactionProcessor(directory, notifier)
    uut.processTransactions(txns)
    const updatedRenewingUser = f.directory.makeMember(renewalTxn)
    updatedRenewingUser.incrementExpirationDate()
    unit.is(true, directory.members.some((m) => m.primaryEmail = updatedRenewingUser.primaryEmail), { description: "The renewed user is expected to be a member of the Directory" })
    unit.is(true, directory.members.some((m) => m.primaryEmail = joiningUser.primaryEmail), { description: "The joining user is expected to be a member of the Directory" })

    unit.is([{ txn: renewalTxn, user: updatedRenewingUser }], notifier.renewalSuccessLog, { description: "notification of renewal expected" })
    unit.not(undefined, renewalTxn.Processed, { description: "renewalTxn has been processed" })
    unit.is([{ txn: joinTxn, user: f.directory.makeMember(joinTxn) }], notifier.joinLog, { description: "notification of join expected" })
    unit.not(undefined, joinTxn.Processed, { description: "joinTxn has been processed" })

  }, {
    description: "Renewal Tests",
    skip: true
  })
  unit.section(() => {
    const f = new Fixture1()
    const renewalTxn = f.txn1
    const badUser = f.directory.makeMember(renewalTxn);
    const expectedMember = f.directory.makeMember(badUser)
    unit.is(badUser, expectedMember, { description: "users should be the same" })
    unit.not(badUser.incrementExpirationDate, expectedMember, { description: "users should be different" })
    const txns = [renewalTxn];
    class BadRenewalDirectory extends TestDirectory {
      updateMember(user) {
        if (user.primaryEmail === badUser.primaryEmail) { throw new Error() }
        super.updateMember(user)
      }
    }
    const directory = new BadRenewalDirectory()
    directory.members = [badUser]
    const notifier = f.notifier
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
    const f = new Fixture1()
    const t1 = f.txn1
    const t2 = JSON.parse(JSON.stringify(t1))
    const directory = f.directory
    const notifier = f.notifier
    const uut = new TransactionProcessor(directory, notifier)
    uut.processTransactions([t1]);
    t2["Phone Number"] = "+1234"
    uut.processTransactions([t2]);
    unit.is(1, directory.members.length, { description: "something was added as a member" })
    unit.is(f.directory.makeMember(t1), directory.members[0], { description: "t1 added as a member" })
    unit.is(true, directory.members.some((m) => m.phones[0].value === f.directory.makeMember(t1).phones[0].value), { description: "Expecting directory to contain the t1 user" })
    unit.is(false, directory.members.some((m) => m.phones[0].value === f.directory.makeMember(t2).phones[0].value), { description: "Expecting directory not to contain the t2 user" })
    unit.is([{ txn: t2, user: f.directory.makeMember(t1) }], notifier.partialsLog, { description: "Expecting to be notified about the partials" })
  },
    {
      description: "Partials",
      skip: true
    })
  return unit.isGood()
}
function runUnitTest() {
  unit.section(() => {
    const jd = new Date().toISOString().split('T')[0];
    let ed = new Date()
    ed.setFullYear(ed.getFullYear() + 1)
    ed = ed.toISOString().split('T')[0];
    const expected = {
      "primaryEmail": `J.K@${domain}`, "name": { "givenName": "J", "familyName": "K" }, "emails": [{ "address": "j.k@icloud.com", "type": "home" }], "phones": [{ "value": "+14083869343", "type": "mobile" }], "customSchemas": { "Club_Membership": { "expires": ed, "Join_Date": jd } }, "orgUnitPath": "/members", "recoveryEmail": "j.k@icloud.com", "recoveryPhone": "+14083869343"
    }
    const f = new Fixture1()
    let user = f.directory.makeMember(txn)
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
    let user2 = f.directory.makeMember(user)
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
