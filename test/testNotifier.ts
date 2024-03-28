import chai = require('chai');
const expect = chai.expect;
import {Notifier} from '../src/Notifier'
import { MailAppType, DraftType, bmUnitTester } from '../src/Types';
import { Member } from '../src/Member';
import { Transaction } from '../src/TransactionProcessor';
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
    const txn1 =new Transaction("J", "K", "j.k@icloud.com", "+14083869343","paid","CC-TF-RNB6")
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
      member1: new Member(txn1, "/test", "@a.com"),
      error: new Error("this is the error message"),
      sendMail: sendMail
    }
  })()
describe('Notifier tests', () => {
    it('should log a success', () => {
        const notifier = new Notifier()
        notifier.joinSuccess(testFixtures.txn1, testFixtures.member1)
        const actual = notifier.joinSuccessLog
        expect(actual).to.deep.equal([{txn: testFixtures.txn1, user: testFixtures.member1}])
    })
})