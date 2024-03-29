import { MailAppType, bmUnitTester, DraftType } from './Types'
import { EmailNotifier, Templates } from './EmailNotifier'
import {Member} from './Member'

const testFixtures = (() => {
  const sendMail:MailAppType = {
    sendEmail(recipient, subject, text, options){
      console.log(`To: ${recipient}`)
      console.log(`From: ${options.from}`)
      console.log(`Reply-to: ${options.noReply}`)
      console.log(`subject: ${subject}`)
      console.log(`html: ${options.htmlBody}`),
        console.log(`text: ${text}`)
      return this
    },
    getDrafts(){ return new Array<DraftType>() }
  }
  const txn1 = {
    "First Name": "J",
    "Last Name": "K",
    "Email Address": "j.k@icloud.com",
    "Phone Number": "+14083869343",
    "Payable Status": "paid",
    "Payable Order ID": "CC-TF-RNB6"
  }
  return {
    unit: new bmUnitTester.Unit({ showErrorsOnly: true }),
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
    member1: new Member(txn1, "/test", "@a.com"),
    error: new Error("this is the error message"),
    sendMail: sendMail
  }
})()

function testTemplates() {
  const templates = new Templates(GmailApp.getDrafts(), testFixtures.subject_lines)
  testFixtures.unit.section(() => testFixtures.unit.is(templates.ambiguous.message.subject, testFixtures.subject_lines.ambiguousSubject, { description: "Expected a template created from the ambiguous subject line" }))
  try {
    const templates = new Templates(GmailApp.getDrafts(), { ...testFixtures.subject_lines, joinSuccessSubject: "NO SUCH DRAFT" })
    console.error("Expected to see an error saying that the draft couldn't be found")
  } catch { }
}

function testEmailNotificationJoinFailure(mailApp: MailAppType) {
  const templates = new Templates(mailApp.getDrafts(), testFixtures.subject_lines)
  const notifier = new EmailNotifier(templates, { test: true, mailer: testFixtures.sendMail, bccOnSuccess: "a@b.com,c@d.com", bccOnFailure: "FAILURE (COPIED)", toOnFailure: "FAILURE"})
  notifier.joinFailure(testFixtures.txn1, testFixtures.member1, testFixtures.error)
}

function testEmailNotifier(mailApp: MailAppType) {
  const templates = new Templates(mailApp.getDrafts(), testFixtures.subject_lines)
  const notifier = new EmailNotifier(templates, { test: true, mailer: testFixtures.sendMail, bccOnSuccess: "a@b.com,c@d.com", bccOnFailure: "FAILURE (COPIED)", toOnFailure: "FAILURE" })
  notifier.joinSuccess(testFixtures.txn1, testFixtures.member1)
}

