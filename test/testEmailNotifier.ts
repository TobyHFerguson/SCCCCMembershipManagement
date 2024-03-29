import chai = require('chai');
const expect = chai.expect;
import { MailAppType, SendEmailOptions } from '../src/Types';
import { Member } from '../src/Member';
import { Transaction } from '../src/TransactionProcessor';
import { Templates, EmailNotifier } from '../src/EmailNotifier';

const subject_lines = {
    joinSuccessSubject: "Thanks for joining SCCCC",
    joinFailureSubject: "Join Problem",
    renewalSuccessSubject: "Thanks for renewing your SCCCC membership",
    renewalFailureSubject: "Renew problem",
    ambiguousSubject: "Ambiguous transaction",
    expiryNotificationSubject: "Your membership will expire in {{N}} days",
    expirationSubject: "Your membership has expired"
}

class MyLocalMailer implements MailAppType {
    log: object[];
    constructor(log: object[]) {
        this.log = log
    }
    sendEmail(recipient, subject, text, options: SendEmailOptions) {
        const o = {
            To: recipient,
            From: options.from,
            noReply: options.noReply,
            subject: subject,
            html: options.htmlBody,
            text: text,
            ...(options.bcc ? { bcc: options.bcc } : {}),
        }
        this.log.push(o)
        return this
    }
    getDrafts() {
        const drafts = Object.keys(subject_lines).map(k => {
            return {
                getMessage: () => {
                    return {
                        getSubject: () => subject_lines[k],
                        getAttachments: () => new Array(),
                        getBody: () => "",
                        getPlainBody: () => ""
                    }
                }
            }


        });
        return drafts;
    }
}
const testFixtures = (() => {



    const txn1 = new Transaction("J", "K", "j.k@icloud.com", "+14083869343", "paid", "CC-TF-RNB6")
    return {

        txn1,
        member1: new Member(txn1, "/test", "@a.com"),
        error: new Error("this is the error message"),
        subject_lines
    }
})()
describe("Email Notifier tests", () => {
    it("should send an email to the member on success, and a copy to the bcc list", () => {
        const emailsSent = new Array();
        const mailer = new MyLocalMailer(emailsSent)
        const templates = new Templates(mailer.getDrafts(), testFixtures.subject_lines)
        const notifier = new EmailNotifier(templates, { mailer, bccOnSuccess: "a@b.com,c@d.com", bccOnFailure: "FAILURE (COPIED)", toOnFailure: "FAILURE" })
        notifier.joinSuccess(testFixtures.txn1, testFixtures.member1)
        const expected = {
            From: "membership@santacruzcountycycling.club",
            noReply: true,
            To: "membershiptest@santacruzcountycycling.club",
            html: "",
            subject: "Thanks for joining SCCCC",
            text: "",
            bcc: "a@b.com,c@d.com"
        }
        const actual = emailsSent[0]
        expect(1).to.deep.equal(emailsSent.length)
        expect(expected).to.deep.equal(actual);
    })
    it("should send an email to toOnFailure on failure, and to the bccOnfailure on failure", () => {
        const emailsSent = new Array();
        const mailer = new MyLocalMailer(emailsSent)
        const templates = new Templates(mailer.getDrafts(), testFixtures.subject_lines)
        const notifier = new EmailNotifier(templates, { mailer ,bccOnSuccess: "a@b.com,c@d.com", bccOnFailure: "FAILURE (COPIED)", toOnFailure: "FAILURE"})
        notifier.joinFailure(testFixtures.txn1, testFixtures.member1, "failure")
        const expected = {
            From: "membership@santacruzcountycycling.club",
            noReply: true,
            To: "FAILURE",
            html: "",
            subject: "Join Problem",
            text: "",
            bcc: "FAILURE (COPIED)"
        }
        const actual = emailsSent[0]
        expect(actual).to.deep.equal(expected)
    })
    it("should send an email to toOnFailure on partial", () => {
        const emailsSent = new Array();
        const mailer = new MyLocalMailer(emailsSent)
        const templates = new Templates(mailer.getDrafts(), testFixtures.subject_lines)
        const notifier = new EmailNotifier(templates, { mailer, bccOnSuccess: "a@b.com,c@d.com", bccOnFailure: "", toOnFailure: "FAILURE" })
        notifier.partial(testFixtures.txn1, testFixtures.member1)
        const expected = {
            From: "membership@santacruzcountycycling.club",
            noReply: true,
            To: "FAILURE",
            html: "",
            subject: "Ambiguous transaction",
            text: ""
        }
        const actual = emailsSent[0]
        expect(actual).to.deep.equal(expected)
    })

})