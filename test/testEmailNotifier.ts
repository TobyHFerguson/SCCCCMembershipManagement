import chai = require('chai');
import sinonChai = require("sinon-chai");
const expect = chai.expect;
chai.use(sinonChai);
import { EmailNotifier, Member } from '../src/Code';
import { DraftType, EmailConfigurationCollection, EmailConfigurationType, MailAppType, SendEmailOptions, SystemConfiguration, Transaction } from '../src/Types';
import Sinon = require('sinon');


const subject_lines = {
    joinSuccessSubject: "Thanks for joining SCCCC",
    joinFailureSubject: "Join Problem",
    renewalSuccessSubject: "Thanks for renewing your SCCCC membership",
    renewalFailureSubject: "Renew problem",
    ambiguousSubject: "Ambiguous transaction",
    expiryNotificationSubject: "Your membership will expire in {{N}} days",
    expirationSubject: "Your membership has expired"
}

const drafts = Object.keys(subject_lines).map(k => {
    return {
        getMessage: () => {
            return {
                getSubject: () => subject_lines[k],
                getAttachments: () => new Array(),
                getBody: () => `${k}: HTML`,
                getPlainBody: () => `${k}: PLAIN`
            }
        }
    }
})

class MyLocalMailer implements MailAppType {
        sendEmail(recipient: string, subject: string, text: string, options: SendEmailOptions) {
            return this
        }
        getDrafts() {
            return new Array()
        }
    }
const testFixtures = (() => {

    const sysConfig: SystemConfiguration = {
        orgUnitPath: "/test",
        domain: "santacruzcountycycling.club",
        groups: "email@a.com"
    }

    const txn1: Transaction = <Transaction>{
        "First Name": "J",
        "Last Name": "K",
        "Email Address": "j.k@icloud.com",
        "Phone Number": "+14083869343",
        "Payable Status": "paid",
        "Payable Order ID": "CC-TF-RNB6",
        "Timestamp": "timestamp"
    }
    return {

        txn1,
        member1: new Member(txn1, sysConfig),
        error: new Error("this is the error message"),
        subject_lines,
        sysConfig
    }
})()
describe("Email Notifier tests", () => {
    const config: EmailConfigurationType = {
        "To": "membershiptest",
        "Bcc on Success": "a,b",
        "Bcc on Failure": "failure",
        "Subject Line": "Thanks for joining SCCCC"
    }

    const config2: EmailConfigurationType = {
        To: "",
        "Bcc on Failure": "",
        "Bcc on Success": "",
        "Subject Line": ""
    }

    const configs: EmailConfigurationCollection = {
        joinSuccess: config,
        joinFailure: config2,
        renewSuccess: config2,
        renewFailure: config2,
        ambiguousTransaction: config2,
        expiryNotification: config2,
        expired: config2,
        deleted: config2,
    }
    const options = {
        test: false,
        domain: "santacruzcountycycling.club",
        html: false
    }
    const mailer = new MyLocalMailer()
    const stub = Sinon.stub(mailer);
    stub.getDrafts.returns(drafts)
    it("should send an email to the member on success, and a copy to the bcc list", () => {
        const notifier = new EmailNotifier(mailer.getDrafts(), configs, { ...options, mailer });
        notifier.joinSuccess(testFixtures.txn1, testFixtures.member1)
        expect(stub.getDrafts).to.be.calledOnce
        expect(stub.sendEmail).to.be.calledOnceWithExactly(`membershiptest@${testFixtures.sysConfig.domain}`, "Thanks for joining SCCCC", "joinSuccessSubject: PLAIN", {
            htmlBody: 'joinSuccessSubject: HTML',
            name: 'SCCC Membership',
            noReply: true,
            attachments: undefined,
            inlineImages: undefined,
            bcc: `a@${testFixtures.sysConfig.domain},b@${testFixtures.sysConfig.domain}`
        });
    })
    it.skip("should send an email to toOnFailure on failure, and to the bccOnfailure on failure", () => {
        configs.joinFailure = { ...config, ...{ "To": "FAILURE", "Bcc on Failure": "BCC", "Subject Line": "Join Problem" } };
        const notifier = new EmailNotifier(mailer.getDrafts(), configs, { ...options, mailer });
        notifier.joinFailure(testFixtures.txn1, testFixtures.member1, new Error("failure"))
        const expected = {
            From: undefined,
            noReply: true,
            To: `FAILURE@${options.domain}`,
            html: "",
            subject: "Join Problem",
            text: "",
            bcc: `BCC@${options.domain}`
        }
        // expect(actual).to.deep.equal(expected)
    })
    it.skip("should send an email to toOnFailure on partial", () => {
        const emailsSent = new Array();
        const mailer = new MyLocalMailer()
        configs.ambiguousTransaction = { ...config, ...{ To: "membership", "Bcc on Failure": "BCC", "Subject Line": "Ambiguous transaction" } }
        const notifier = new EmailNotifier(mailer.getDrafts(), configs, { ...options, mailer });
        notifier.partial(testFixtures.txn1, testFixtures.member1)
        const expected = {
            From: undefined,
            noReply: true,
            To: `membership@${options.domain}`,
            html: "",
            subject: "Ambiguous transaction",
            text: "",
            bcc: `BCC@${options.domain}`
        }
        const actual = emailsSent[0]
        expect(actual).to.deep.equal(expected)
    })

})