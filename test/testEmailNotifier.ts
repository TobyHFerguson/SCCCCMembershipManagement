import chai = require('chai');
import Sinon = require('sinon');
import sinonChai = require('sinon-chai');
const expect = chai.expect;
chai.use(sinonChai);
import {EmailNotifier, Member} from '../src/Code';
import {
  CurrentMember,
  Draft,
  EmailConfigurationCollection,
  EmailConfigurationType,
  Message,
  MyMailApp,
  SubjectLines,
  SystemConfiguration,
  Transaction,
} from '../src/Types';

class MyMessage implements Message {
  to: string;
  subject: string;
  body: string;
  options?: GoogleAppsScript.Gmail.GmailAdvancedOptions;
  constructor(
    to: string,
    subject: string,
    body: string,
    options?: GoogleAppsScript.Gmail.GmailAdvancedOptions
  ) {
    this.to = to;
    this.subject = subject;
    this.body = body;
    this.options = options;
  }
  getTo() {
    return this.to;
  }
  getSubject(): string {
    return this.subject;
  }
  getBody(): string {
    return this.options && this.options.htmlBody ? this.options.htmlBody : '';
  }
  getPlainBody(): string {
    return this.body;
  }
  getAttachments() {
    return [];
  }
  getCc() {
    return this.options ? (this.options.cc ? this.options.cc : '') : '';
  }
  getFrom() {
    return this.options ? (this.options.from ? this.options.from : '') : '';
  }
  getBcc() {
    return this.options ? (this.options.bcc ? this.options.bcc : '') : '';
  }
  getReplyTo() {
    return '';
  }
}

class MyDraft implements Draft {
  message: Message;
  constructor(message: Message) {
    this.message = message;
  }
  getMessage(): Message {
    return this.message;
  }
  update(
    recipient: string,
    subject: string,
    body: string,
    options?: GoogleAppsScript.Gmail.GmailAdvancedOptions
  ): Draft {
    this.message = new MyMessage(recipient, subject, body, options);
    return this;
  }
}
class MyLocalMailer implements MyMailApp {
  sendEmail(
    recipient: string,
    subject: string,
    body: string,
    options: GoogleAppsScript.Gmail.GmailAdvancedOptions
  ): MyMailApp {
    return this;
  }
  getDrafts() {
    return new Array(new MyDraft(new MyMessage('to', 'subject', 'body')));
  }
}
const subject_lines = {
  joinSuccessSubject: 'Thanks for joining SCCCC',
  joinFailureSubject: 'Join Problem',
  renewalSuccessSubject: 'Thanks for renewing your SCCCC membership',
  renewalFailureSubject: 'Renew problem',
  ambiguousSubject: 'Ambiguous transaction',
  expirationNotificationSubject: 'Your membership will expire in {{N}} days',
  expiredNotificationSubject: 'Your membership has expired',
  importSuccessSubject: 'Your new SCCCC account has been created',
  importFailureSubject: 'Import Problem',
};

/**
 * The drafts are an object of the form: 
 */
const drafts = Object.keys(subject_lines).map((k) => {
  return new MyDraft(
    new MyMessage(
      '',
      (<{[key: string]: string}>subject_lines)[k],
      `${k}: PLAIN`,
      {htmlBody: `${k}: HTML`}
    )
  );
});
const testFixtures = (() => {
  const sysConfig: SystemConfiguration = {
    orgUnitPath: '/test',
    domain: 'santacruzcountycycling.club',
    groups: 'email@a.com',
  };

  const txn1: Transaction = {
    'First Name': 'J',
    'Last Name': 'K',
    'Email Address': 'j.k@icloud.com',
    'Phone Number': '+14083869343',
    'Payable Status': 'paid',
    'Payable Order ID': 'CC-TF-RNB6',
    "Payable Transaction ID": "1",
    "In Directory": true,
    Timestamp: new Date(),
  };
  const ce1: CurrentMember = {
    ...txn1,
    'Membership Type': 'Family',
    Expires: Member.convertToYYYYMMDDFormat_(new Date()),
    Joined: Member.convertToYYYYMMDDFormat_(new Date()),
  };
  return {
    txn1,
    ce1,
    member1: new Member(txn1, sysConfig),
    error: new Error('this is the error message'),
    subject_lines,
    sysConfig,
  };
})();
describe('Email Notifier tests', () => {
  let stub: Sinon.SinonStubbedInstance<MyLocalMailer>;
  beforeEach(() => {
    stub = Sinon.createStubInstance(MyLocalMailer);
    stub.getDrafts.returns(<never[]>drafts);
  });
  const config: EmailConfigurationType = {
    'Email Type': '',
    'Days before Expiry': '',
    Notes: '',
    To: 'home',
    'Bcc on Success': 'a,b',
    'Bcc on Failure': 'failure',
    'Subject Line': 'Thanks for joining SCCCC',
  };

  const emailConfigs: EmailConfigurationCollection = {
    joinSuccess: config,
    joinFailure: config,
    renewSuccess: config,
    renewFailure: config,
    ambiguousTransaction: config,
    expirationNotification: config,
    expired: config,
    deleted: config,
    importSuccess: config,
    importFailure: config,
  };
  const emailOptions = {
    test: false,
    domain: 'santacruzcountycycling.club',
    html: false,
  };
  it('should send an email to the member on joinSuccess, and a copy to the bcc list', () => {
    const notifier = new EmailNotifier(stub, emailConfigs, emailOptions);
    notifier.joinSuccess(testFixtures.txn1, testFixtures.member1);
    expect(stub.getDrafts).to.be.calledOnce;
    const options = {
      htmlBody: 'joinSuccessSubject: HTML',
      attachments: undefined,
      inlineImages: undefined,
      bcc: `a@${testFixtures.sysConfig.domain},b@${testFixtures.sysConfig.domain}`,
      name: 'SCCCC Membership',
      noReply: true,
    };
    expect(stub.sendEmail).to.be.calledWithMatch(
      testFixtures.txn1['Email Address'],
      subject_lines.joinSuccessSubject,
      'joinSuccessSubject: PLAIN',
      options
    );
  });
  it('when set to test it should send the email to the test address without any bcc', () => {
    const notifier = new EmailNotifier(stub, emailConfigs, {
      ...emailOptions,
      test: true,
    });
    notifier.joinSuccess(testFixtures.txn1, testFixtures.member1);
    expect(stub.getDrafts).to.be.calledOnce;
    expect(stub.sendEmail).to.be.calledWithMatch(
      'toby.ferguson+TEST@santacruzcountycycling.club',
      subject_lines.joinSuccessSubject,
      'joinSuccessSubject: PLAIN',
      {
        htmlBody: 'joinSuccessSubject: HTML',
        attachments: undefined,
        inlineImages: undefined,
        name: 'SCCCC Membership',
        noReply: true,
      }
    );
  });
  it('should send an email to OnFailure on joinFailure, and to the bccOnfailure on failure', () => {
    emailConfigs.joinFailure = {
      ...config,
      ...{
        To: 'onFailure',
        'Bcc on Failure': 'bccOnFailure',
        'Subject Line': 'Join Problem',
      },
    };
    const notifier = new EmailNotifier(stub, emailConfigs, emailOptions);
    notifier.joinFailure(
      testFixtures.txn1,
      testFixtures.member1,
      new Error('failure')
    );
    expect(stub.sendEmail).to.be.calledWithMatch(
      `onFailure@${testFixtures.sysConfig.domain}`,
      'Join Problem',
      'joinFailureSubject: PLAIN',
      {
        htmlBody: 'joinFailureSubject: HTML',
        attachments: undefined,
        inlineImages: undefined,
        bcc: `bccOnFailure@${testFixtures.sysConfig.domain}`,
        name: 'SCCCC Membership',
        noReply: true,
      }
    );
    // expect(actual).to.deep.equal(expected)
  });
  it('should send an email to onFailure and bcc ambiguousBCC on partial', () => {
    emailConfigs.ambiguousTransaction = {
      ...config,
      ...{
        To: 'onFailure',
        'Bcc on Failure': 'ambiguousBCC',
        'Subject Line': 'Ambiguous transaction',
      },
    };
    const notifier = new EmailNotifier(stub, emailConfigs, emailOptions);
    notifier.partial(testFixtures.txn1, testFixtures.member1);
    expect(stub.sendEmail).to.be.calledWithMatch(
      `onFailure@${testFixtures.sysConfig.domain}`,
      'Ambiguous transaction',
      'ambiguousSubject: PLAIN',
      {
        htmlBody: 'ambiguousSubject: HTML',
        attachments: undefined,
        inlineImages: undefined,
        bcc: `ambiguousBCC@${testFixtures.sysConfig.domain}`,
        name: 'SCCCC Membership',
        noReply: true,
      }
    );
  });
  it('should send an email to the member and the bcc on importSuccess', () => {
    emailConfigs.importSuccess = {
      ...config,
      ...{
        To: 'home',
        'Bcc on Success': 'membership',
        'Subject Line': subject_lines.importSuccessSubject,
      },
    };
    const notifier = new EmailNotifier(stub, emailConfigs, {...emailOptions});
    notifier.importSuccess(testFixtures.ce1, testFixtures.member1);
    expect(stub.sendEmail).to.be.calledWithMatch(
      testFixtures.ce1['Email Address'],
      'Your new SCCCC account has been created',
      'importSuccessSubject: PLAIN',
      {
        htmlBody: 'importSuccessSubject: HTML',
        attachments: undefined,
        inlineImages: undefined,
        bcc: `membership@${testFixtures.sysConfig.domain}`,
        name: 'SCCCC Membership',
        noReply: true,
      }
    );
  });
  it('should send an email to the failure address and the bcc on importFailure', () => {
    emailConfigs.importFailure = {
      ...config,
      ...{
        To: 'home',
        'Bcc on Success': 'membership',
        'Subject Line': 'Import Problem',
      },
    };
    const notifier = new EmailNotifier(stub, emailConfigs, {...emailOptions});
    notifier.importFailure(
      testFixtures.ce1,
      testFixtures.member1,
      new Error('Import Failure')
    );
    expect(stub.sendEmail).to.be.calledWithMatch(
      testFixtures.ce1['Email Address'],
      'Import Problem',
      'importFailureSubject: PLAIN',
      {
        htmlBody: 'importFailureSubject: HTML',
        attachments: undefined,
        inlineImages: undefined,
        bcc: `failure@${testFixtures.sysConfig.domain}`,
        name: 'SCCCC Membership',
        noReply: true,
      }
    );
  });
  it('should send an email to the member when an expiration is due, and a copy to the bcc list', () => {
    emailConfigs.expirationNotification = {
      ...config,
      ...{
        To: 'home',
        "Bcc on Success": 'expiration',
        'Subject Line': subject_lines.expirationNotificationSubject
      }
    }
    const notifier = new EmailNotifier(stub, emailConfigs, emailOptions);
    notifier.expirationNotification(testFixtures.member1, 3);
    expect(stub.getDrafts).to.be.calledOnce;
    const options = {
      htmlBody: 'expirationNotificationSubject: HTML',
      bcc: `expiration@${testFixtures.sysConfig.domain}`,
      attachments: undefined,
      inlineImages: undefined,
      name: 'SCCCC Membership',
      noReply: true,
    };
    expect(stub.sendEmail).to.be.calledWithMatch(
      testFixtures.txn1['Email Address'],
      subject_lines.expirationNotificationSubject.replace('{{N}}', '3'),
      'expirationNotificationSubject: PLAIN',
      options
    );
  })
  it('should send an email to the member when the membership has expired, and a copy to the bcc list', () => {
    emailConfigs.expired = {
      ...config,
      ...{
        To: 'home',
        "Bcc on Success": 'expired',
        'Subject Line': subject_lines.expiredNotificationSubject
      }
    }
    const notifier = new EmailNotifier(stub, emailConfigs, emailOptions);
    notifier.expiredNotification(testFixtures.member1);
    expect(stub.getDrafts).to.be.calledOnce;
    const options = {
      htmlBody: `expiredNotificationSubject: HTML`,
      bcc: `expired@${testFixtures.sysConfig.domain}`,
      attachments: undefined,
      inlineImages: undefined,
      name: 'SCCCC Membership',
      noReply: true,
    };
    expect(stub.sendEmail).to.be.calledWithMatch(
      testFixtures.txn1['Email Address'],
      subject_lines.expiredNotificationSubject,
      `expiredNotificationSubject: PLAIN`,
      options
    );
  })
  describe('string replacement tests', () => {
    it('should replace {{tokens}} with the proper values', () => {
      const s = '{{here}} is a {{value}}';
      const b = {here: 'There', value: 27};
      const expected = 'There is a 27';
      const actual = EmailNotifier.replaceTokens(s, b);
    });
  });
});
