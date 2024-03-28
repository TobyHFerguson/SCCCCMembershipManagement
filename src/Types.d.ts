interface Logger {
    joinSuccess(Transaction, Member)
    joinFailure(Transaction, Member, Error)
    renewalSuccess(Transaction, Member)
    joinFailure(Transaction, Member, Error)
    partial(Transaction, Member)
}

interface LogEntry {
    txn: string
    member: string
    error?: string
}




declare namespace bmUnitTester {
    type UnitResult = any;
    interface TestOptions {
        description?: string;
        neverUndefined?: boolean;
        showErrorsOnly?: boolean;
        skip?: boolean
    }
    interface UnitSection {
        test: () => void;
        options: TestOptions;
    }
    class Unit {
        constructor(TestOptions)
        isGood(): boolean
        section(test: () => void, options?: TestOptions): void;
        is(expect: any, actual: any, options?: TestOptions): UnitTest;
        not(expect: any, actual: any, options?: TestOptions): UnitTest;

    }
}

interface AdminDirectoryType {
    Users?: UsersCollection;
}

// Types to cover our use of GmailApp, GMailDraft, GmailMessage and GmailAttachment

// GmailApp
interface MailAppType {
    sendEmail(string, string, string, sendEmailOptions): MailAppType;
    getDrafts(): DraftType[];
}
interface sendEmailOptions {
    attachments: any[];
    bcc: string;
    cc: string;
    from: string;
    htmlBody: string;
    inlineImages: any;
    name: string;
    noReply: boolean;
    replyTo: string;

}

//GmailDraft
interface DraftType {
    getMessage(): MailMessage;
}

//GmailMessage
interface MailMessage {
    getSubject(): string;
    getAttachments(options: { includeInlineImages?: boolean, includeAttachments?: boolean }): MailAttachment[];
    getBody(): string;
    getPlainBody(): string;
}

//GmailAttachment
interface MailAttachment { getName(): string }


//
interface MailerOptions {
    test?: boolean;
    mailer: MailAppType;
    domain?: string;
    html?: boolean;
}



interface SubjectLines {
    joinSuccessSubject: string;
    joinFailureSubject: string;
    renewalSuccessSubject: string;
    renewalFailureSubject: string;
    ambiguous: string;
    expiryNotificationSubject: ?string;
    expirationSubject?: string;
}

export {
    AdminDirectoryType,
    bmUnitTester,
    DraftType,
    Logger,
    LogEntry,
    MailAppType,
    MailerOptions,
    SubjectLines,
    Transaction,
}