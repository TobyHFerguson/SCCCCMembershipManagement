import chai = require('chai');
const expect = chai.expect;
import { MailApp,  Transaction, SystemConfiguration, CurrentMember } from '../src/Types';
import { Member, Notifier } from '../src/Code';
const testFixtures = (() => {
  const sendMail: MailApp = {
    sendEmail(recipient, subject, text, options) {
      console.log(`To: ${recipient}`)
      console.log(`From: ${options.from}`)
      console.log(`Reply-to: ${options.noReply}`)
      console.log(`subject: ${subject}`)
      console.log(`html: ${options.htmlBody}`),
        console.log(`text: ${text}`)
      return this
    },
    getDrafts() { return new Array<GoogleAppsScript.Gmail.GmailDraft>() }
  }
  const txn1: Transaction = {
    "First Name": "J",
    "Last Name": "K",
    "Email Address": "j.k@icloud.com",
    "Phone Number": "+14083869343",
    "Payable Status": "paid",
    "Payable Transaction ID": "CC-TF-RNB6",
    "Payable Order ID": "1234",
    "Timestamp": new Date("2024-03-29"),
    "In Directory": true
  }
  const sysConfig: SystemConfiguration = {
    orgUnitPath: "/test",
    domain: "santacruzcountycycling.club",
    groups: "email@a.com"
  }
  return {
    subject_lines: {
      joinSuccessSubject: "Thanks for joining SCCCC",
      joinFailureSubject: "Join Problem",
      renewalSuccessSubject: "Thanks for renewing your SCCCC membership",
      renewalFailureSubject: "Renew problem",
      ambiguousSubject: "Ambiguous transaction",
      expiryNotificationSubject: "Your membership will expire in {{N}} days",
      expirationSubject: "Your membership has expired"
    },
    txn1,
    member1: new Member(txn1, sysConfig),
    error: new Error("this is the error message"),
    sendMail: sendMail,
    sysConfig
  }
})()
describe('Notifier tests', () => {
  it('should log a success', () => {
    const notifier = new Notifier()
    notifier.joinSuccess(testFixtures.txn1, testFixtures.member1)
    const actual = notifier.joinSuccessLog
    expect(actual).to.deep.equal([{ input: testFixtures.txn1, member: testFixtures.member1 }])
  })
  it('should log a failure', () => {
    const notifier = new Notifier()
    notifier.joinFailure(testFixtures.txn1, testFixtures.member1, testFixtures.error)
    const actual = notifier.joinFailureLog
    expect(actual).to.deep.equal([{ input: testFixtures.txn1, member: testFixtures.member1, error: testFixtures.error }])
  })
  it('should log a partial', () => {
    const notifier = new Notifier()
    notifier.partial(testFixtures.txn1, testFixtures.member1)
    const actual = notifier.partialsLog
    expect(actual).to.deep.equal([{ input: testFixtures.txn1, member: testFixtures.member1 }])
  })
  it('should log an import', () => {
    const cm1: CurrentMember = {
      ...testFixtures.txn1,
      Joined: new Date(),
      Expires: new Date(),
      "In Directory": true,
      "Membership Type": "Family"
  
    }
    const myMember = new Member(cm1, testFixtures.sysConfig);
    const notifier = new Notifier()
    notifier.importSuccess(cm1, myMember)
  })
})