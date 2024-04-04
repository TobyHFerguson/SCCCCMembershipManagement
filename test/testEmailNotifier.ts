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

    const configs: EmailConfigurationCollection = {
        joinSuccess: config,
        joinFailure: config,
        renewSuccess: config,
        renewFailure: config,
        ambiguousTransaction: config,
        expiryNotification: config,
        expired: config,
        deleted: config,
    }
    const options = {
        test: false,
        domain: "santacruzcountycycling.club",
        html: false
    }
    const mailer = new MyLocalMailer()
    it("should send an email to the member on success, and a copy to the bcc list", () => {
        const stub = Sinon.stub(mailer);
        stub.getDrafts.returns(drafts)
        const notifier = new EmailNotifier(stub.getDrafts(), configs, { ...options, mailer: stub });
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
    it("should send an email to OnFailure on failure, and to the bccOnfailure on failure", () => {
        const stub = Sinon.stub(mailer);
        stub.getDrafts.returns(drafts);
        configs.joinFailure = { ...config, ...{ "To": "onFailure", "Bcc on Failure": "bccOnFailure", "Subject Line": "Join Problem" } };
        const notifier = new EmailNotifier(stub.getDrafts(), configs, { ...options, mailer:stub });
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
        expect(stub.sendEmail).to.be.calledOnceWithExactly(`onFailure@${testFixtures.sysConfig.domain}`, "Join Problem", "joinFailureSubject: PLAIN", {
            htmlBody: 'joinFailureSubject: HTML',
            name: 'SCCC Membership',
            noReply: true,
            attachments: undefined,
            inlineImages: undefined,
            bcc: `bccOnFailure@${testFixtures.sysConfig.domain}`
        })
        // expect(actual).to.deep.equal(expected)
    })
    it("should send an email to onFailure and bcc ambiguousBCC on partial", () => {
        const stub = Sinon.stub(mailer);
        stub.getDrafts.returns(drafts);
        configs.ambiguousTransaction = { ...config, ...{ To: "onFailure", "Bcc on Failure": "ambiguousBCC", "Subject Line": "Ambiguous transaction" } }
        const notifier = new EmailNotifier(stub.getDrafts(), configs, { ...options, mailer:stub });
        notifier.partial(testFixtures.txn1, testFixtures.member1)
        expect(stub.sendEmail).to.be.calledOnceWithExactly(`onFailure@${testFixtures.sysConfig.domain}`, "Ambiguous transaction", "ambiguousSubject: PLAIN", {
            htmlBody: 'ambiguousSubject: HTML',
            name: 'SCCC Membership',
            noReply: true,
            attachments: undefined,
            inlineImages: undefined,
            bcc: `ambiguousBCC@${testFixtures.sysConfig.domain}`
        })
    })

})