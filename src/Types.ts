import { Transaction } from "./TransactionProcessor"

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
        is(expect: any, actual: any, options?: TestOptions): UnitResult;
        not(expect: any, actual: any, options?: TestOptions): UnitResult;

    }
}

// Types to cover the AdminDirectory SDK
interface UserNameType {
    familyName?: string | undefined;
    fullName?: string | undefined;
    givenName?: string | undefined;
}
interface UserType {
    changePasswordAtNextLogin?: boolean | undefined;
    customSchemas?: object | undefined;
    emails?: object[] | undefined;
    name?: UserNameType | undefined;
    orgUnitPath?: string | undefined;
    password?: string | undefined;
    phones?: object[] | undefined;
    primaryEmail?: string | undefined;
    recoveryEmail?: string | undefined;
    recoveryPhone?: string | undefined;

}
interface UsersType {
    users?: UserType[];
}
interface UsersCollectionType {
    get(userKey: string): UserType;
    get(userKey: string, options: object): UserType;
    insert(user): UserType;
    list(optionalArgs: object): UsersType;
    remove(userKey: string): void;
    update(resource: UserType, userKey: string): UserType;
}
interface AdminDirectoryType {
    Users?: UsersCollectionType;
}

// Types to cover our use of GmailApp, GMailDraft, GmailMessage and GmailAttachment

// GmailApp
interface MailAppType {
    sendEmail(recipient: string, subject: string, body: string, options: SendEmailOptions): MailAppType;
    getDrafts(): DraftType[];
}
interface SendEmailOptions {
    attachments?: any[] | undefined;
    bcc?: string | undefined;
    cc?: string | undefined;
    from?: string | undefined;
    htmlBody?: string | undefined;
    inlineImages?: string | undefined;
    name?: string | undefined;
    noReply?: boolean | undefined;
    replyTo?: string | undefined;

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
    bccOnSuccess: string;
    toOnFailure: string;
    bccOnFailure: string;
}



interface SubjectLines {
    joinSuccessSubject: string;
    joinFailureSubject: string;
    renewalSuccessSubject: string;
    renewalFailureSubject: string;
    ambiguousSubject: string;
    expiryNotificationSubject?: string;
    expirationSubject?: string;
}

interface Template {
    message: { subject: string, text: string, html: string };
    attachments: object[];
    inlineImages: object;
}

export {
    AdminDirectoryType,
    bmUnitTester,
    DraftType,
    Logger,
    LogEntry,
    MailAppType,
    MailerOptions,
    SendEmailOptions,
    SubjectLines,
    Template,
    UserType,
    UsersType,
    UsersCollectionType
}