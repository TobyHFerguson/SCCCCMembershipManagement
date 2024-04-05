import chai = require('chai');
import Sinon = require('sinon');
import sinonChai = require("sinon-chai");
const expect = chai.expect;
chai.use(sinonChai);
import { EmailNotifier, Member } from '../src/Code';
import { CurrentMember, EmailConfigurationCollection, EmailConfigurationType, MailApp, SystemConfiguration, Transaction } from '../src/Types';


const subject_lines = {
    joinSuccessSubject: "Thanks for joining SCCCC",
    joinFailureSubject: "Join Problem",
    renewalSuccessSubject: "Thanks for renewing your SCCCC membership",
    renewalFailureSubject: "Renew problem",
    ambiguousSubject: "Ambiguous transaction",
    expiryNotificationSubject: "Your membership will expire in {{N}} days",
    expirationSubject: "Your membership has expired",
    importSuccessSubject: 'Your new SCCCC account has been created',
    importFailureSubject: 'Import Problem'
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

class MyLocalMailer implements MailApp {
    sendEmail(recipient: string, subject: string, body: string, options: GoogleAppsScript.Gmail.GmailAdvancedOptions): MailApp {
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
    const ce1: CurrentMember = {
        ...txn1,
        "Membership Type": "Family",
        "Expires": new Date(),
        "Joined": new Date(),
    }
    return {

        txn1,
        ce1,
        member1: new Member(txn1, sysConfig),
        error: new Error("this is the error message"),
        subject_lines,
        sysConfig
    }
})()
describe("Email Notifier tests", () => {
    let stub: Sinon.SinonStubbedInstance<MyLocalMailer>;
    beforeEach(() => {
        stub = Sinon.createStubInstance(MyLocalMailer)
        stub.getDrafts.returns(drafts);
    })
    const config: EmailConfigurationType = {
        "To": "home",
        "Bcc on Success": "a,b",
        "Bcc on Failure": "failure",
        "Subject Line": "Thanks for joining SCCCC"
    }

    const emailConfigs: EmailConfigurationCollection = {
        joinSuccess: config,
        joinFailure: config,
        renewSuccess: config,
        renewFailure: config,
        ambiguousTransaction: config,
        expiryNotification: config,
        expired: config,
        deleted: config,
        importSuccess: config,
        importFailure: config
    }
    const emailOptions = {
        test: false,
        domain: "santacruzcountycycling.club",
        html: false
    }
    it("should send an email to the member on success, and a copy to the bcc list", () => {
        const notifier = new EmailNotifier(stub, emailConfigs, emailOptions);
        notifier.joinSuccess(testFixtures.txn1, testFixtures.member1)
        expect(stub.getDrafts).to.be.calledOnce
        expect(stub.sendEmail).to.be.calledOnceWithExactly(testFixtures.txn1['Email Address'], subject_lines.joinSuccessSubject, "joinSuccessSubject: PLAIN", {
            htmlBody: 'joinSuccessSubject: HTML',
            name: 'SCCC Membership',
            noReply: true,
            attachments: undefined,
            inlineImages: undefined,
            bcc: `a@${testFixtures.sysConfig.domain},b@${testFixtures.sysConfig.domain}`
        });
    })
    it("when set to test it should send the email to the test address without any bcc", () => {
        const notifier = new EmailNotifier(stub, emailConfigs, { ...emailOptions, test: true });
        notifier.joinSuccess(testFixtures.txn1, testFixtures.member1)
        expect(stub.getDrafts).to.be.calledOnce
        expect(stub.sendEmail).to.be.calledOnceWithExactly('toby.ferguson+TEST@santacruzcountycycling.club', subject_lines.joinSuccessSubject, "joinSuccessSubject: PLAIN", {
            htmlBody: 'joinSuccessSubject: HTML',
            name: 'SCCC Membership',
            noReply: true,
            attachments: undefined,
            inlineImages: undefined
        });
    })
    it("should send an email to OnFailure on failure, and to the bccOnfailure on failure", () => {
        emailConfigs.joinFailure = { ...config, ...{ "To": "onFailure", "Bcc on Failure": "bccOnFailure", "Subject Line": "Join Problem" } };
        const notifier = new EmailNotifier(stub, emailConfigs, emailOptions);
        notifier.joinFailure(testFixtures.txn1, testFixtures.member1, new Error("failure"))
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
        emailConfigs.ambiguousTransaction = { ...config, ...{ To: "onFailure", "Bcc on Failure": "ambiguousBCC", "Subject Line": "Ambiguous transaction" } }
        const notifier = new EmailNotifier(stub, emailConfigs, emailOptions);
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
    it('should send an email to the member and the bcc on importSuccess', () => {
        emailConfigs.importSuccess = { ...config, ...{ To: 'home', "Bcc on Success": "membership", "Subject Line": "Your new SCCCC account has been created" } }
        const notifier = new EmailNotifier(stub, emailConfigs, { ...emailOptions });
        notifier.importSuccess(testFixtures.ce1, testFixtures.member1)
        expect(stub.sendEmail).to.be.calledOnceWithExactly(testFixtures.ce1['Email Address'], "Your new SCCCC account has been created", "importSuccessSubject: PLAIN", {
            htmlBody: 'importSuccessSubject: HTML',
            name: 'SCCC Membership',
            noReply: true,
            attachments: undefined,
            inlineImages: undefined,
            bcc: `membership@${testFixtures.sysConfig.domain}`
        })
    })
    it('should send an email to the failure address and the bcc on importFailure', () => {
        emailConfigs.importFailure = { ...config, ...{ To: 'home', "Bcc on Success": "membership", "Subject Line": "Import Problem" } }
        const notifier = new EmailNotifier(stub, emailConfigs, { ...emailOptions });
        notifier.importFailure(testFixtures.ce1, testFixtures.member1, new Error("Import Failure"))
        expect(stub.sendEmail).to.be.calledOnceWithExactly(testFixtures.ce1['Email Address'], "Import Problem", "importFailureSubject: PLAIN", {
            htmlBody: 'importFailureSubject: HTML',
            name: 'SCCC Membership',
            noReply: true,
            attachments: undefined,
            inlineImages: undefined,
            bcc: `failure@${testFixtures.sysConfig.domain}`
        })
    })
})