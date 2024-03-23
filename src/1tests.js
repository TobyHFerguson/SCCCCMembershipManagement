
function testRenewalSuccess() {
  const directory = new Directory(Admin)
  const notifier = new Notifier()
  const f = new Fixture1(directory, notifier)
  const txns = [f.txn1, f.txn2]
  const renewalTxn = txns[0]
  const renewingUser = f.directory.makeMember(renewalTxn)
  const joinTxn = txns[1]
  const joiningUser = f.directory.makeMember(joinTxn)
  directory.addMemberFromTransaction(renewalTxn)
  const uut = new TransactionProcessor(directory, notifier)
  uut.processTransactions(txns)
  const updatedRenewingUser = f.directory.makeMember(renewalTxn)
  updatedRenewingUser.incrementExpirationDate()
}
function test() {
  const SKIP = false;
  const sdk = Admin;
  // const sdk = AdminDirectory;
  const unit = new bmUnitTester.Unit({ showErrorsOnly: true })
  testDirectory(new Directory(sdk), SKIP)
  testAdmin(new Directory(sdk), "test Admin", SKIP)
  testCreateDeleteTests(new Directory(sdk), SKIP)
  testUser(new Directory(sdk), SKIP)
  testTPJoinSuccess(new Directory(sdk), new Notifier(), SKIP)
  testPartialSuccess(new Directory(sdk), new Notifier(), SKIP)
  testRenewalSuccess(new Directory(sdk), new Notifier(), false)
  TestTPJoinFailures(new Directory(sdk), new Notifier(), SKIP)
  testRenewalFailure(new Directory(sdk), new Notifier(), SKIP)
  return unit.isGood()

  function testAdmin(directory, description, skip = false) {
      const f = new Fixture1(directory)
    const admin = directory.adminDirectory
    try {
    const member = directory.makeMember(f.txn1)
    const newMember = admin.Users.insert(member)
    unit.section(() => {
      unit.is(newMember, member, { description: "New member should. be copy of old" })
    },
      { description, skip })
      } finally {
        admin.Users.list().users.forEach((m) => admin.Users.remove(m.primaryEmail))
      }
  }
  function testCreateDeleteTests(directory, skip = false) {
    cleanUp_(testCreateDeleteTests_, directory, "user create/delete tests", skip)
  }

  function testCreateDeleteTests_(directory, description, skip = false) {
    const f = new Fixture1(directory, new Notifier())
    unit.section(() => {
      const txns = [f.txn1];
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
  function testDirectory(directory, skip = false) {
    cleanUp_(testDirectory_, directory, "Google Directory test", skip)
  }

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



  function cleanUp_(f, directory, ...args) {
    try {
      f(directory, ...args)
    } finally {
      directory.members.forEach((m, i, em) => directory.deleteMember(m, (i === em.length - 1)))
    }
  }





  function testUser(directory, skip = false) {
    const f = new Fixture1(directory)
    unit.section(() => {
      const uut = f.directory.makeMember(f.txn1)
      unit.is(uut.orgUnitPath, f.directory.orgUnitPath, { description: "Expecting orgUnitPath to be setup correctly" })
      unit.is(uut.primaryEmail.split('@')[1], f.directory.domain, { description: "Expecting domain to be setup correctly" })
    },
      {
        description: "User tests",
        skip
      })
  }



  function testTPJoinSuccess(directory, notifier, skip = false) {
    cleanUp_(testTPJoinSuccess_, directory, notifier, "TransactionProcessor join tests", skip)
  }
  function testTPJoinSuccess_(directory, notifier, description, skip = false) {
    const f = new Fixture1(directory, notifier)
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


  function TestTPJoinFailures(directory, notifier, skip = false) {
    cleanUp_(TestTPJoinFailures_, directory, "TransactionProcessor join failure tests", notifier, skip)
  }
  function TestTPJoinFailures_(directory, description, notifier, skip = false) {
    const f = new Fixture1(directory, notifier)
    const oldInsert = directory.adminDirectory.Users.insert;
    const badUser = f.directory.makeMember(f.badTxn)
    f.directory.adminDirectory.Users.insert = function (user) {
      if (user.primaryEmail === badUser.primaryEmail) {
        console.error(`bad user: ${user.primaryEmail} === ${badUser.primaryEmail}`)
        throw new DirectoryError()
      }
      const addedUser = oldInsert(user);
      console.error(`My Insert:`)
      console.error(addedUser)
      return addedUser
    }
    unit.section(() => {
      const txns = [f.badTxn, f.txn2]
      const directory = f.directory
      const notifier = f.notifier
      const txn2 = f.txn2
      const goodMember = directory.makeMember(txn2)
      const uut = new TransactionProcessor(directory, notifier)
      uut.processTransactions(txns)
      unit.is(1, directory.members.length, { description: "Expect directory to have 1 member" })
      unit.is(true, directory.isKnownMember(goodMember), { description: "Expect goodMember to have become a member" })
      unit.is([{ txn: txn2, user: goodMember }], notifier.joinLog, { description: "successful join notification is expected to be txn2" })
      unit.is(1, notifier.joinFailureLog.length, { description: "one join failure expected" })
      notifier.joinFailureLog.forEach((l) => {
        unit.is(true, l.err instanceof Error)
        delete l.err
      })
      unit.is([{ txn: f.badTxn, user: badUser }], notifier.joinFailureLog, { description: "Join failure is expected to be badTxn" })
      unit.is(undefined, f.badTxn.Processed, { neverUndefined: false, description: "badTxn should not have been processed" })
      unit.is(true, new Date(txn2.Processed) instanceof Date, { description: "myTxn2 should have a processing date" })
      unit.not(undefined, txn2.Processed, { neverUndefined: false, description: "txn2 should  have been processed" })
    }, {
      description,
      skip
    })
  }

  function testRenewalSuccess(directory, notifier, skip = false) {
    cleanUp_(testRenewalSuccess_, directory, "Renewal Success Test", notifier, skip)
  }
  function testRenewalSuccess_(directory, description, notifier, skip) {
    const f = new Fixture1(directory, notifier)
    unit.section(() => {
      // Copied from Test Directory
      const directory = f.directory
      let user = directory.makeMember(f.txn1)
      directory.addMemberFromTransaction(f.txn1)
      //
      const notifier = f.notifier
      const txns = [f.txn1, f.txn2]
      const renewalTxn = txns[0]
      const renewingUser = f.directory.makeMember(renewalTxn)
      const joinTxn = txns[1]
      const joiningUser = f.directory.makeMember(joinTxn)
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
      description,
      skip
    })
  }

  function testRenewalFailure(directory, notifier, skip = false) {
    cleanUp_(testRenewalFailure_, directory, "Renewal Failure Test", notifier, skip)
  }
  function testRenewalFailure_(directory, description, notifier, skip) {
    const f = new Fixture1(directory, notifier)
    const renewalTxn = f.txn1
    const badUser = f.directory.makeMember(renewalTxn);
    const oldUpdateMember = f.directory.updateMember;
    f.directory.updateMember = (user) => {
      if (user.primaryEmail === badUser.primaryEmail) { throw new Error() }
      oldUpdateMember.updateMember(user)
    }
    unit.section(() => {
      const expectedMember = f.directory.makeMember(badUser)
      unit.is(badUser, expectedMember, { description: "users should be the same" })
      unit.not(badUser.incrementExpirationDate, expectedMember, { description: "users should be different" })
      const txns = [renewalTxn];
      directory.members = [badUser]
      const notifier = f.notifier
      const uut = new TransactionProcessor(directory, notifier)
      uut.processTransactions(txns)
      unit.is([expectedMember], directory.members, { description: "Expecting member to be untouched" })
      unit.is(undefined, renewalTxn.Processed, { description: "Expecting renewalTxn to not have been processed", neverUndefined: false })
      let rfl = notifier.renewalFailureLog
      if (rfl[0]) delete rfl[0].err
      unit.is([{ txn: renewalTxn, user: expectedMember }], rfl, { description: "Expecting renewalTxn and expectedMember to be in the renewalFailureLog" })
    },
      {
        description,
        skip
      })
  }

  function testPartialSuccess(directory, notifier, skip = false) {
    cleanUp_(testPartialSuccess_, directory, "Partials", notifier, skip)
  }
  function testPartialSuccess_(directory, description, notifier, skip) {
    const f = new Fixture1(directory, notifier)
    unit.section(() => {
      const t1 = f.txn1
      const t2 = JSON.parse(JSON.stringify(t1))
      const directory = f.directory
      const notifier = f.notifier
      const uut = new TransactionProcessor(directory, notifier)
      uut.processTransactions([t1]);
      t2["Phone Number"] = "+1234"
      uut.processTransactions([t2]);
      unit.is(1, directory.members.length, { description: "something was added as a member" })
      unit.is(true, f.directory.isKnownMember(f.directory.makeMember(t1)), { description: "t1 added as a member" })
      unit.is(true, directory.members.some((m) => m.phones[0].value === f.directory.makeMember(t1).phones[0].value), { description: "Expecting directory to contain the t1 user" })
      unit.is(false, directory.members.some((m) => m.phones[0].value === f.directory.makeMember(t2).phones[0].value), { description: "Expecting directory not to contain the t2 user" })
      unit.is([{ txn: t2, user: f.directory.makeMember(t1) }], notifier.partialsLog, { description: "Expecting to be notified about the partials" })
    },
      {
        description,
        skip
      })
  }
} 