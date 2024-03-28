

import {bmUnitTester} from './Types'
import {Notifier} from './Notifier'
import {Fixture1} from './Fixtures'
import {Admin} from './Admin'
import {Directory, DirectoryError, MemberNotFoundError} from './Directory'
import {Users} from './Admin'
import {Member} from './Member'
const SKIP = false

function test() {
  return unitTest(SKIP) && integrationTest(true)
}
function unitTest(skip = false) {
  return test_(new Admin, skip)
}
function integrationTest(skip = true) {
  return test_(AdminDirectory, skip)
}
function test_(sdk, skip = true) {
  const unit = new bmUnitTester.Unit({ showErrorsOnly: true })
  testDirectory(new Directory(sdk), skip)
  testCreateDeleteTests(new Directory(sdk), skip)
  testUser(new Directory(sdk), skip)
  testTPJoinSuccess(new Directory(sdk), new Notifier(), skip)
  testPartialSuccess(new Directory(sdk), new Notifier(), skip)
  testRenewalSuccess(new Directory(sdk), new Notifier(), skip)
  TestTPJoinFailures(new Directory(sdk), new Notifier(), skip)
  testRenewalFailure(new Directory(sdk), new Notifier(), skip)
  return unit.isGood()


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



  function testTPJoinSuccess(directory:Directory, notifier:Notifier, skip = false) {
    cleanUp_(testTPJoinSuccess_, directory, notifier, "TransactionProcessor join tests", skip)
  }
  function testTPJoinSuccess_(directory:Directory, notifier:Notifier, description:string, skip = false) {
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
        unit.is(m.name, am?.name, { description: "Expected names to match" })
        unit.is(m.emails, am?.emails, { description: "Expected home emails to match" })
        unit.is(m.phones, am?.phones, { description: "Expected phones to match" })
        unit.is(m.customSchemas, am?.customSchemas, { description: "Expected custom schemas to match" })
      })
      txns.forEach((t, i, ts) => {
        const el = { txn: t, user: expectedMembers[i] }
        if (i === ts.length - 1) el.user.generation = 1;
        unit.is(el, notifier?.joinSuccessLog[i], { description: "Expected log entries to match" })
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
    class BadUsers extends Users {
      badUserEmail: string;
      constructor(badUserEmail) {
        super()
        this.badUserEmail = badUserEmail
      }
      insert(user) {
        if (user.primaryEmail === this.badUserEmail) {
          const message = `bad user: ${user.primaryEmail} === ${this.badUserEmail}`
          console.error(message)
          throw new DirectoryError(message)
        }
        return super.insert(user)
      }
    }
    let f = new Fixture1(directory, notifier)
    const admin = new Admin(new BadUsers(directory.makeMember(f.badTxn).primaryEmail))
    f.directory = new Directory(admin)
    unit.section(() => {
      const txns = [f.badTxn, f.txn2]
      const goodMember = directory.makeMember(f.txn2)
      const badMember = directory.makeMember(f.badTxn)
      const uut = new TransactionProcessor(f.directory, f.notifier)
      uut.processTransactions(txns)
      unit.is(1, f.directory.members.length, { description: "Expect directory to have 1 member" })
      unit.is(true, f.directory.isKnownMember(goodMember), { description: "Expect goodMember to have become a member" })
      unit.is([{ txn: f.txn2, user: goodMember }], f.notifier?.joinSuccessLog, { description: "successful join notification is expected to be txn2" })
      unit.is(1, f.notifier?.joinFailureLog.length, { description: "one join failure expected" })
      f?.notifier?.joinFailureLog.forEach((l) => {
        unit.is(true, l.err instanceof Error)
        delete l.err
      })
      unit.is([{ txn: f.badTxn, user: badMember }], notifier.joinFailureLog, { description: "Join failure is expected to be badTxn" })
      unit.is(undefined, f.badTxn.Processed, { neverUndefined: false, description: "badTxn should not have been processed" })
      unit.is(true, new Date(f.txn2.Processed) instanceof Date, { description: "myTxn2 should have a processing date" })
      unit.not(undefined, f.txn2.Processed, { neverUndefined: false, description: "txn2 should  have been processed" })
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

      unit.is([{ txn: renewalTxn, user: updatedRenewingUser }], notifier?.renewalSuccessLog, { description: "notification of renewal expected" })
      unit.not(undefined, renewalTxn.Processed, { description: "renewalTxn has been processed" })
      unit.is([{ txn: joinTxn, user: f.directory.makeMember(joinTxn) }], notifier?.joinSuccessLog, { description: "notification of join expected" })
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
    class BadUsers extends Users {
      badUser: Member;
      constructor(badUser) {
        super()
        this.users.push(badUser)
        this.badUser = badUser
      }
      update(patch, primaryEmail) {
        if (primaryEmail === this.badUser.primaryEmail) {
          throw new DirectoryError(`Bad User: ${this.badUser.primaryEmail}`)
        }
        return super.update(patch, primaryEmail)
      }
    }
    let f = new Fixture1(directory, notifier)
    const badUser = f.directory.makeMember(f.badTxn);
    const admin = new Admin(new BadUsers(badUser))
    f.directory = new Directory(admin)
    unit.section(() => {
      const renewalTxn = f.badTxn;
      const expectedMember = f.directory.makeMember(badUser)
      unit.is(badUser, expectedMember, { description: "users should be the same" })
      const txns = [renewalTxn];
      const uut = new TransactionProcessor(f.directory, f.notifier)
      uut.processTransactions(txns)
      unit.is(true, f.directory.isKnownMember(expectedMember), { description: "Expecting member to be untouched" })
      unit.is(undefined, renewalTxn.Processed, { description: "Expecting renewalTxn to not have been processed", neverUndefined: false })
      let rfl = notifier.renewalFailureLog
      if (rfl[0]) delete rfl[0].err
      unit.is(renewalTxn, rfl[0].txn, { description: "Expecting renewalTxn to be in the renewalFailureLog" })
      unit.is(expectedMember, rfl[0].user, { description: "Expecting expectedMember to be in the renewalFailureLog" })

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
      const joiningTxn = f.txn1
      let joiningMember = directory.makeMember(joiningTxn)
      const renewingTxn = JSON.parse(JSON.stringify(joiningTxn))
      renewingTxn["Phone Number"] = "+1234"
      const renewingMember = f.directory.makeMember(renewingTxn);
      const uut = new TransactionProcessor(f.directory, f.notifier)
      uut.processTransactions([joiningTxn]);
      unit.is(1, f.directory.members.length, { description: "something was added as a member" })
      unit.is(true, f.directory.isKnownMember(joiningMember), { description: "member added from joiningTxn" })
      uut.processTransactions([renewingTxn]);
      f.directory.members.forEach((m) => {
        m.phones.forEach((p) => unit.not(p.value, renewingMember.phones[0].value, { description: "Expecting directory member's phones not to include those from the renewing member" }))

      })
      unit.is(renewingTxn, f.notifier?.partialsLog[0].txn, { description: "Expecting renewalTxn to be in the partials log" })
      const loggedUser = directory.makeMember(f.notifier?.partialsLog[0].user)
      unit.is(joiningMember, loggedUser, { description: "Expecting joining member to be in the partials log" })

    },
      {
        description,
        skip
      })
  }

}
function testAdmin(skip = false) {
  const unit = new bmUnitTester.Unit({ showErrorsOnly: true })
  const admin = new Admin(new Users)
  const directory = new Directory(admin)
  const f = new Fixture1(directory)
  try {
    const member = directory.makeMember(f.txn1)
    const newMember = admin.Users?.insert(member)
    unit.section(() => {
      unit.is(newMember, member, { description: "New member should. be copy of old" })
    },
      { description: "test Admin", skip })
  } finally {
    directory.members.forEach((m, i, mbrs) => directory.deleteMember(m, (i + 1 === mbrs.length)))
  }
}