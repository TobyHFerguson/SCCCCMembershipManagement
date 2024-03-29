import { Member } from './Code'


declare namespace bmPreFiddler {
    interface pf {
        getFiddler(options: {
            id: any;
            sheetName: string;
            createIfMissing: boolean;
        }): Fiddler;
    }
    function PreFiddler(): pf;
    interface Fiddler {
        getData(): object[];
        setData(obs: object[]): void;
        dumpValues(): {};
    }
}

interface NotificationType {
    joinSuccess(txn: Transaction, member: Member): void;
    joinFailure(txn: Transaction, member: Member, error: Error): void;
    renewalSuccess(txn: Transaction, member: Member): void;
    joinFailure(txn: Transaction, member: Member, error: Error): void;
    partial(txn: Transaction, member: Member): void;
}

interface LogEntry {
    txn: Transaction;
    member: Member;
    error?: Error;
}


interface Binding {
    timestamp: string;
    orderID: string;
    primaryEmail: string;
    givenName: string;
    familyName: string;
    expiry: string;
    error?: string;
}

interface Transaction {
    "First Name": string;
    "Last Name": string;
    "Email Address": string;
    "Phone Number": string;
    "Payable Order ID": string;
    "Payable Status": string;
    "Timestamp": string;
    "Processed"?: string;
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
interface EmailConfigurationType {
    "To": string;
    "Bcc on Success": string;
    "Bcc on Failure": string;
    "Subject Line": string;
}

interface EmailConfigurationCollection {
    joinSuccess: EmailConfigurationType;
    joinFailure: EmailConfigurationType;
    renewSuccess: EmailConfigurationType;
    renewFailure: EmailConfigurationType;
    ambiguousTransaction: EmailConfigurationType;
    expiryNotification: EmailConfigurationType;
    expired: EmailConfigurationType;
    deleted: EmailConfigurationType;
}
export {
    Binding,
    AdminDirectoryType,
    bmUnitTester,
    bmPreFiddler,
    DraftType,
    EmailConfigurationType,
    EmailConfigurationCollection,
    LogEntry,
    MailAppType,
    MailerOptions,
    NotificationType,
    SendEmailOptions,
    SubjectLines,
    Template,
    Transaction,
    UserType,
    UsersType,
    UsersCollectionType
}