import chai = require('chai');
import { Member, Templates, EmailNotifier } from '../src/Code';
import { EmailConfigurationCollection, EmailConfigurationType, MailAppType, MailerOptions, SendEmailOptions, SystemConfiguration, Transaction } from '../src/Types';
const expect = chai.expect;

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
    sendEmail(recipient: string, subject: string, text: string, options: SendEmailOptions) {
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
        subject_lines
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
    it("should send an email to the member on success, and a copy to the bcc list", () => {
        const emailsSent = new Array();
        const mailer = new MyLocalMailer(emailsSent)
        
        
        const notifier = new EmailNotifier(mailer.getDrafts(), configs, {...options, mailer} );
        notifier.joinSuccess(testFixtures.txn1, testFixtures.member1)
        const expected = {
            From: undefined,
            noReply: true,
            To: "membershiptest@santacruzcountycycling.club",
            html: "",
            subject: "Thanks for joining SCCCC",
            text: "",
            bcc: `a@${options.domain},b@${options.domain}`
        }
        const actual = emailsSent[0]
        expect(1).to.deep.equal(emailsSent.length)
        expect(actual).to.deep.equal(expected);
    })
    it("should send an email to toOnFailure on failure, and to the bccOnfailure on failure", () => {
        const emailsSent = new Array();
        const mailer = new MyLocalMailer(emailsSent)
        configs.joinFailure = {...config, ...{"To": "FAILURE", "Bcc on Failure":"BCC", "Subject Line": "Join Problem"}};
        const notifier = new EmailNotifier(mailer.getDrafts(), configs, {...options, mailer} );
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
        const actual = emailsSent[0]
        expect(actual).to.deep.equal(expected)
    })
    it("should send an email to toOnFailure on partial", () => {
        const emailsSent = new Array();
        const mailer = new MyLocalMailer(emailsSent)
        configs.ambiguousTransaction = {...config, ...{To: "membership", "Bcc on Failure":"BCC", "Subject Line": "Ambiguous transaction"}}
        const notifier = new EmailNotifier(mailer.getDrafts(), configs, {...options, mailer} );
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