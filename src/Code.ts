import { error } from "console";
import {
  AdminDirectoryType,
  Binding, CurrentMember, DraftType, EmailConfigurationCollection, EmailConfigurationType, LogEntry, MailAppType, MailerOptions, MemberReport, Message, NotificationType, SendEmailOptions, SubjectLines, SystemConfiguration, Template, Transaction, UserType, UsersCollectionType, bmUnitTester
} from "./Types";


class Users implements UsersCollectionType {
  #users: UserType[] = [];
  constructor(users?: Member[]) {
    if (users) users.forEach(u => this.#users.push(u))
  }

  get(primaryEmail: string) {
    const found = this.#users.find((u) => u.primaryEmail === primaryEmail)
    return found ? found : {}
  }
  insert(user: UserType) {
    if (!user.primaryEmail) throw new Error("No primary key")
    if (this.get(user.primaryEmail)) { throw new Error("API call to directory.users.insert failed with error: Entity already exists.") }
    const newUser = JSON.parse(JSON.stringify(user))
    this.#users.push(newUser)
    return newUser
  }
  list(optionaArgs: object) {
    const users: UserType[] = JSON.parse(JSON.stringify(this.#users))
    const result = { users }
    return result
  }
  remove(primaryEmail: string) {
    let i = this.#users?.findIndex((u) => u.primaryEmail === primaryEmail);
    if (i === -1) throw new Error("Resource Not Found: userKey");
    this.#users?.splice(i, 1)
  }
  update(patch: UserType, primaryEmail: string) {
    let i = this.#users.findIndex((u) => u.primaryEmail === primaryEmail);
    if (i === -1) throw new Error("Resource Not Found: userKey");
    const oldUser = this.#users[i]
    const newUser = { ...oldUser, ...patch }
    this.#users.splice(i, 1, newUser)
    return JSON.parse(JSON.stringify(newUser))
  }
}

class Admin implements AdminDirectoryType {
  Users?: UsersCollectionType;
  constructor(users = new Users()) {
    this.Users = users
  }
}

class Directory {
  systemConfig: SystemConfiguration;
  #Users: UsersCollectionType;
  #Members: GoogleAppsScript.AdminDirectory.Collection.MembersCollection;

  constructor(systemConfig: SystemConfiguration, adminDirectory: AdminDirectoryType = AdminDirectory) {
    this.systemConfig = systemConfig;
    if (!adminDirectory.Users) throw new Error("Internal Error - adminDirectory.Users is undefined")
    this.#Users = adminDirectory.Users;
    if (!adminDirectory.Members) throw new Error("Internal Error - adminDirectory.Members is undefined")
    this.#Members = adminDirectory.Members;
  }

  /**
   * Identify whether member exists
   * @param {Member} member 
   * @returns true iff member is known
   */
  isKnownMember(member: Member) {
    return this.members.some((m) => m.primaryEmail === member.primaryEmail)
  }
  /**
   * 
   * @param {Member | Transaction | UserType} obj Object to be converted to Member
   * @returns new Member object
   */
  makeMember(obj: Member | Transaction | UserType) {
    return new Member(obj, this.systemConfig)
  }

  /**
   * Get all the members of the organization
   * @returns {Member[]} An array of members
   */
  get members(): Member[] {
    let users = [];
    let pageToken;
    let page;
    do {
      const listSpec = {
        customer: 'my_customer',
        orderBy: 'givenName',
        viewType: "admin_view",
        query: `orgUnitPath:${this.systemConfig.orgUnitPath}`,
        maxResults: 500,
        pageToken: pageToken,
        projection: "full"
      }
      try {
        page = this.#Users?.list(listSpec);
      } catch (err: any) {
        if (err.message.endsWith('Invalid Input: INVALID_OU_ID')) {
          err.message += `: "${this.systemConfig.orgUnitPath}"`
          throw err
        }
      }
      if (!page.users) {
        return [];
      }
      users = users.concat(page.users)
      pageToken = page.nextPageToken;
    } while (pageToken);
    return users.map(m => new Member(m, this.systemConfig));
  }

  /**
   * Update the stored copy of the member's expiration date
   * @param {Member} member The member whose expiration date is to be updated
   * @returns a copy of the updated member
   */
  updateMember(member: Member) {
    let { customSchemas } = member
    return Utils.retryOnError(() => this.makeMember(this.updateMember_(member, { customSchemas })), MemberCreationNotCompletedError)
  }

  updateMember_(member: Member, patch: UserType) {
    const key = member.primaryEmail;
    try {
      const newMember: UserType = this.#Users?.update(patch, key);
      return newMember;
    } catch (err: any) {
      if (err.message && err.message.includes("userKey")) {
        err.message = err.message.replace("userKey", key)
        throw (new MemberNotFoundError(err))
      } else if (err.message.includes("User creation is not complete.")) {
        throw new MemberCreationNotCompletedError(err)
      }
      throw new DirectoryError(err)
    }
  }

  /**
   * Return a copy of the given member, or throw if not found
   * @param {Member} member The member to be returned
   * @returns A copy of the member
   * @throws MemberNotFoundError if the user cannot be found
   */
  getMember(member: Member) {
    try {
      return this.makeMember(this.#Users.get(member.primaryEmail, { projection: "full", viewType: "admin_view" }))
    } catch (err: any) {
      if (err.message.endsWith("Resource Not Found: userKey")) throw new MemberNotFoundError(member.primaryEmail)
      throw new DirectoryError(err)
    }
  }
  /**
   * 
   * @param {Member} member The transaction to be used to add a member
   * @param {boolean} [wait = true] whether to wait for the transaction to complete
   * @returns {Member} the newly inserted member
   */
  addMember(member: Member, wait: boolean = true) {
    member.password = Math.random().toString(36);
    member.changePasswordAtNextLogin = true;
    try {
      const newMember = this.makeMember(this.#Users.insert(member));
      if (wait) {
        Utils.waitNTimesOnCondition(4000, () => this.isKnownMember(newMember))
      }
      console.info(`member ${member.name.fullName} was allocated this account name: ${member.primaryEmail}`)
      this.systemConfig.groups.split(',').forEach(group => this.addMemberToGroup(member, group))
      return newMember;
    } catch (err: any) {
      if (err.message.includes("API call to directory.users.insert failed with error: Entity already exists.")) {
        throw new MemberAlreadyExistsError(err)
      } else {
        if (err.message.endsWith('Invalid Input: primary_user_email')) {
          err.message += `: ${member.primaryEmail}`;
        }
        throw new DirectoryError(err)
      }
    }
  }
  addMemberToGroup(member: Member, groupKey: string) {
    const groupMember: GoogleAppsScript.AdminDirectory.Schema.Member = {
      kind: "admin#directory#member",
      email: member.homeEmail,
      role: "MEMBER",
      type: "EXTERNAL"
    }
    try {
      this.#Members.insert(groupMember, groupKey.trim())
    } catch (err: any) {
      if (!err.message.endsWith('Member already exists.')) throw err
    }
    console.info(`member ${member.name.fullName}'s home email (${member.homeEmail}) is in group ${groupKey}`)
  }
  /**
   * Delete the given member
   * @param {Member} member
   * @param {boolean} [wait = true] wait for deletion to finish before returning
   */
  deleteMember(member: Member, wait: boolean = true) {
    try {
      Utils.retryOnError(() => { this.#Users.remove(member.primaryEmail.toLowerCase()); console.log(`Member ${member.primaryEmail} deleted`); return true }, MemberCreationNotCompletedError)
      Utils.waitNTimesOnCondition(wait ? 400 : 1, () => !this.isKnownMember(member))
    }
    catch (err: any) {
      // Only throw the error if the user might still exist, otherwise ignore it since the user not existing is what we want!
      if (!err.message.endsWith("Resource Not Found: userKey")) throw new MemberNotFoundError(err)
    }
  }
}
export { Directory };
class LocalDirectory extends Directory {
  constructor(systemConfig: SystemConfiguration) {
    super(systemConfig, new Admin())
  }
}
export { LocalDirectory };
class DirectoryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "DirectoryError"
  }
}

class MemberAlreadyExistsError extends DirectoryError {
  constructor(message: string) {
    super(message)
    this.name = "MemberAlreadyExistsError"
  }
}

class MemberNotFoundError extends DirectoryError {
  constructor(message: string) {
    super(message);
    this.name = "MemberNotFoundError"
  }
}

class MemberCreationNotCompletedError extends DirectoryError {
  constructor(message: string) {
    super(message);
    this.name = "UserConstructionNotCompletedError"
  }
}

export class Templates {
  joinSuccess: Template;
  joinFailure: Template;
  renewalSuccess: Template;
  renewalFailure: Template;
  ambiguous: Template;
  expiryNotification?: Template;
  expiration?: Template;
  /**
   * 
   * @param {GmailDraft[]} drafts draft emails with {{}} templatized bodies
   * @param {SubjectLines} subjectLines lines
   */
  constructor(drafts: DraftType[], subjectLines: SubjectLines) {
    this.joinSuccess = getGmailTemplateFromDrafts_(drafts, subjectLines.joinSuccessSubject)
    this.joinFailure = getGmailTemplateFromDrafts_(drafts, subjectLines.joinFailureSubject)
    this.renewalSuccess = getGmailTemplateFromDrafts_(drafts, subjectLines.renewalSuccessSubject)
    this.renewalFailure = getGmailTemplateFromDrafts_(drafts, subjectLines.renewalFailureSubject)
    this.ambiguous = getGmailTemplateFromDrafts_(drafts, subjectLines.ambiguousSubject)
    if (subjectLines.expiryNotificationSubject) {
      this.expiryNotification = getGmailTemplateFromDrafts_(drafts, subjectLines.expiryNotificationSubject)
    }
    if (subjectLines.expirationSubject) {
      this.expiration = getGmailTemplateFromDrafts_(drafts, subjectLines.expirationSubject)
    }
  }
}

/**
  * Get a Gmail draft message by matching the subject line.
  * @param {GMailDraft[]} drafts
  * @param {string} subject_line to search for draft message
  * @return {Template} containing the draft message
  */
function getGmailTemplateFromDrafts_(drafts: DraftType[], subject_line: string): Template {
  // get drafts
  const draft = drafts.find(draft => draft.getMessage().getSubject() === subject_line);
  if (!draft) {
    throw new Error(`No drafts found that match subject line: "${subject_line}"`)
  }


  // get the message object
  const msg = draft.getMessage();

  // Handles inline images and attachments so they can be included in the merge
  // Based on https://stackoverflow.com/a/65813881/1027723
  // Gets all attachments and inline image attachments
  const allInlineImages = draft.getMessage().getAttachments({ includeInlineImages: true, includeAttachments: false });
  const attachments = draft.getMessage().getAttachments({ includeInlineImages: false });
  const htmlBody = msg.getBody();

  // Creates an inline image object with the image name as key 
  // (can't rely on image index as array based on insert order)
  const img_obj = allInlineImages.reduce((obj, i) => (obj[i.getName()] = i, obj), {});

  //Regexp searches for all img string positions with cid
  const imgexp = RegExp('<img.*?src="cid:(.*?)".*?alt="(.*?)"[^\>]+>', 'g');
  const matches = [...htmlBody.matchAll(imgexp)];

  //Initiates the allInlineImages object
  const inlineImagesObj = {};
  // built an inlineImagesObj from inline image matches
  matches.forEach(match => inlineImagesObj[match[1]] = img_obj[match[2]]);

  return {
    message: {
      subject: subject_line,
      text: msg.getPlainBody(),
      html: htmlBody
    },
    attachments: attachments,
    inlineImages: inlineImagesObj
  }
}


/**
 * Bind the message with the given token bindings
 * @see https://stackoverflow.com/a/378000/1027723
 * @param {Message} message All strings that form the message will have the {{}} tokens replaced
 * @param {object} binding object used to replace {{}} tokens
 * @return {Message} bound message
*/
function bindMessage_(message: object, binding: Binding): Message {
  // We have two templates one for plain text and the html body
  // Stringifing the object means we can do a global replace
  // across all the textual part of the object and then restore it.
  let template_string = JSON.stringify(message);

  // Token replacement
  template_string = template_string.replace(/{{[^{}]+}}/g, key => {
    return escapeData_(binding[key.replace(/[{}]+/g, "")] || "");
  });
  return JSON.parse(template_string);
}

/**
 * Escape cell data to make JSON safe
 * @see https://stackoverflow.com/a/9204218/1027723
 * @param {string} str to escape JSON special characters from
 * @return {string} escaped string
*/
function escapeData_(str: string): string {
  return str
    .replace(/[\\]/g, '\\\\')
    .replace(/[\"]/g, '\\\"')
    .replace(/[\/]/g, '\\/')
    .replace(/[\b]/g, '\\b')
    .replace(/[\f]/g, '\\f')
    .replace(/[\n]/g, '\\n')
    .replace(/[\r]/g, '\\r')
    .replace(/[\t]/g, '\\t');
};

class Fixture1 {
  txn1: Transaction;
  txn2: Transaction;
  badTxn: Transaction;
  directory: Directory;
  notifier?: Notifier;

  constructor(directory, notifier?) {
    if (!directory) throw new Error("directory must be provided")
    this.txn1 = {
      "First Name": "J",
      "Last Name": "K",
      "Email Address": "j.k@icloud.com",
      "Phone Number": "+14083869343",
      "Payable Status": "paid",
      "Payable Order ID": "1234",
      "Timestamp": "now",
      "Payable Transaction ID": "1",
      "In Directory": true
    }
    this.txn2 = {
      "First Name": "A",
      "Last Name": "B",
      "Email Address": "a.b@icloud.com",
      "Phone Number": "+14083869000",
      "Payable Status": "paid",
      "Payable Order ID": "2345",
      "Timestamp": "now",
      "Payable Transaction ID": "2",
      "In Directory": false
    }
    this.badTxn = {
      "First Name": "C",
      "Last Name": "D",
      "Email Address": "c.d@icloud.com",
      "Phone Number": "+14083869340",
      "Payable Status": "paid",
      "Payable Order ID": "923",
      "Timestamp": "now",
      "Payable Transaction ID": "2",
      "In Directory": true
    }
    this.directory = directory;
    this.notifier = notifier;
  }
}

function isMember(member: Transaction | Member | UserType | CurrentMember): member is Member {
  return (member as Transaction)["First Name"] === undefined &&
    (member as Member).generation !== undefined
}

function isUserType(member: Transaction | Member | UserType | CurrentMember): member is UserType {
  return (member as Transaction)["First Name"] === undefined &&
    (member as Member).generation === undefined
}

function isTransaction(txn: Transaction | Member | UserType | CurrentMember): txn is Transaction {
  let t = (txn as Transaction);
  return t["First Name"] !== undefined && t["Payable Order ID"] !== undefined;
}

function isCurrentMember(cm: Transaction | Member | UserType | CurrentMember): cm is CurrentMember {
  let c = (cm as CurrentMember);
  return c["First Name"] !== undefined && c["Payable Order ID"] === undefined;
}

export class Member implements UserType {
  domain: string;
  generation: number = 0;
  primaryEmail: string;
  name: { givenName: string, familyName: string, fullName: string }
  emails: { address: string, type?: string, primary?: boolean }[];
  phones: { value: string, type: string }[];
  customSchemas: { Club_Membership: { expires: string, Join_Date: string, membershipType: string } };
  orgUnitPath: string;
  recoveryEmail: string;
  recoveryPhone: string;
  includeInGlobalAddressList: boolean;
  password?: string;
  changePasswordAtNextLogin?: boolean;

  constructor(m: (Transaction | Member | UserType | CurrentMember), systemConfig: SystemConfiguration) {
    this.domain = systemConfig.domain
    if (isTransaction(m) || isCurrentMember(m)) {
      let givenName = m['First Name'];
      let familyName = m['Last Name'];
      let fullName = `${givenName} ${familyName}`
      let email = m['Email Address'];
      let phone = "" + m['Phone Number'];
      const name = { givenName, familyName, fullName }
      const primaryEmail = `${givenName}.${familyName}@${this.domain}`.toLowerCase()
      phone = phone.startsWith('+1') ? phone : '+1' + phone
      this.primaryEmail = primaryEmail
      this.name = name
      this.emails = [
        {
          address: email,
          type: "home"
        },
        {
          address: primaryEmail,
          primary: true
        }
      ]
      this.phones = [
        {
          value: phone,
          type: "mobile"
        }
      ]
      const Join_Date = isCurrentMember(m)? m.Joined : new Date();
      const expiryDate = isCurrentMember(m)? m.Expires: Member.incrementDateByOneYear(new Date())
      this.customSchemas = {
        Club_Membership: {
          expires: Member.convertToYYYYMMDDFormat_(expiryDate),
          Join_Date: Member.convertToYYYYMMDDFormat_(Join_Date),
          membershipType: isCurrentMember(m) ? m["Membership Type"] : 'Individual'
        }
      }
      this.orgUnitPath = systemConfig.orgUnitPath
      this.recoveryEmail = email
      this.recoveryPhone = phone
      this.includeInGlobalAddressList = m["In Directory"]
    } else {// Simply copy the values, deeply
      function deepCopy(v) { return v ? JSON.parse(JSON.stringify(v)) : "" }
      this.primaryEmail = deepCopy(m.primaryEmail).toLowerCase()
      this.name = deepCopy(m.name)
      this.emails = deepCopy(m.emails)
      this.phones = deepCopy(m.phones)
      this.customSchemas = deepCopy(m.customSchemas)
      this.orgUnitPath = deepCopy(m.orgUnitPath)
      this.recoveryEmail = deepCopy(m.recoveryEmail)
      this.recoveryPhone = deepCopy(m.recoveryPhone)
      this.includeInGlobalAddressList = m.includeInGlobalAddressList !== undefined ? m.includeInGlobalAddressList : true;
      if (isMember(m)) {
        this.generation = m.generation;
      }
    }
  }
  get report(): MemberReport {
    return {
      primary: this.primaryEmail,
      email: this.homeEmail,
      phone: this.phone,
      First: this.name.givenName,
      Last: this.name.familyName,
      Joined: this.customSchemas.Club_Membership.Join_Date,
      Expires: this.customSchemas.Club_Membership.expires
    }
  }
  get homeEmail() {
    const email = this.emails.find(e => e.type === "home")
    return email ? email.address : "EMAIL ADDRESS UNKNOWN"
  }
  get phone() {
    const phone = this.phones.find(e => e.type === "mobile");
    return phone ? phone.value : "PHONE UNKNOWN"
  }
  makePrimaryEmail_(given, family, generation, domain) {
    return `${given}.${family}${generation}@${domain}`.toLowerCase()
  }
  incrementGeneration() {
    this.generation += 1
    let pm = this.makePrimaryEmail_(this.name.givenName, this.name.familyName, "" + this.generation, this.domain)
    this.primaryEmail = pm
    this.emails.filter((e) => e.primary).forEach((e) => e.address = pm)
    return this
  }
  incrementExpirationDate() {
    let ed = Member.incrementDateByOneYear(this.customSchemas.Club_Membership.expires);
    this.customSchemas.Club_Membership.expires = Member.convertToYYYYMMDDFormat_(ed);
    return this
  }
  static incrementDateByOneYear(date: string | number | Date) {
    let d = new Date(date)
    d.setFullYear(d.getFullYear() + 1)
    return d
  }
  static convertToYYYYMMDDFormat_(date: Date) {
    return new Date(date).toISOString().split('T')[0];
  }
}

class Notifier implements NotificationType {
  joinSuccessLog = Array<LogEntry>();
  joinFailureLog = Array<LogEntry>();
  renewalSuccessLog = Array<LogEntry>();
  renewalFailureLog = Array<LogEntry>();
  partialsLog = Array<LogEntry>();


  /**
   * Notify anyone interested that a user has been added as a consequence of the transaction
   * @param {Transaction} txn The transaction that caused the join
   * @param {User} member The user that was joined
   */
  joinSuccess(txn: Transaction, member: Member) {
    this.joinSuccessLog.push({ txn, member })
  }
  joinFailure(txn: Transaction, member: Member, error: Error) {
    this.joinFailureLog.push({ txn, member, error })
  }
  renewalSuccess(txn: Transaction, member: Member) {
    this.renewalSuccessLog.push({ txn, member })
  }
  renewalFailure(txn: Transaction, member: Member, error: Error) {
    this.renewalFailureLog.push({ txn, member, error })
  }
  partial(txn: Transaction, member: Member) {
    this.partialsLog.push({ txn, member })
  }
  log() {
    function reportSuccess(l: LogEntry[], kind: string) {
      l.forEach((e: LogEntry) => console.log(`${e.member.primaryEmail} ${kind}`))
    }
    function reportFailure(l: LogEntry[], kind: string) {
      function addInfoToError(logEntry: LogEntry) {
        if (!logEntry.error) return;
        if (logEntry.error.message.endsWith('Invalid recovery phone.')) {
          logEntry.error.message += `: "${logEntry.txn["Phone Number"]}"`
        }
      }
      l.forEach((l) => {
        addInfoToError(l)
        console.error(`Txn ${l.txn["Payable Transaction ID"]} had ${kind} error: ${l.error}`)
      })
    }
    reportSuccess(this.joinSuccessLog, "joined")
    reportFailure(this.joinFailureLog, "join")
    reportSuccess(this.renewalSuccessLog, "renewed")
    reportFailure(this.renewalFailureLog, "renewal")
    this.partialsLog.forEach((p) => console.error(`ambiguous match: Txn[Email Address]: ${p.txn["Email Address"]} member.homeEmail: ${p.member.homeEmail} Txn[Phone Number]: ${p.txn["Phone Number"]} member.phone: ${p.member.phone}`)
    )
  }


}
export { Notifier };

class EmailNotifier extends Notifier {
  configs: EmailConfigurationCollection;
  options: MailerOptions;
  drafts: DraftType[];

  /**
   * 
   * @param drafts Draft[] drafts to be used
   * @param configs Configs 
   * @param options Mail Options
   */
  constructor(drafts: DraftType[], configs: EmailConfigurationCollection, options: MailerOptions) {
    super()
    this.drafts = drafts;
    this.options = { test: true, domain: "santacruzcountycycling.club", ...options };
    this.configs = configs;
  }

  joinSuccess(txn: Transaction, member: Member) {
    super.joinSuccess(txn, member)
    this.notifySuccess_(txn, member, this.configs.joinSuccess,)
  }
  joinFailure(txn: Transaction, member: Member, error: Error) {
    super.joinFailure(txn, member, error)
    this.notifyFailure_(txn, member, this.configs.joinFailure, error)
  }
  renewalSuccess(txn: Transaction, member: Member) {
    super.renewalSuccess(txn, member);
    this.notifySuccess_(txn, member, this.configs.renewSuccess)
  }
  renewalFailure(txn: Transaction, member: Member, error: Error) {
    super.renewalFailure(txn, member, error)
    this.notifySuccess_(txn, member, this.configs.renewFailure)
  }
  partial(txn: Transaction, member: Member) {
    super.partial(txn, member)
    this.notifyFailure_(txn, member, this.configs.ambiguousTransaction)
  }
  makeBccList(bcc: string) {
    return bcc.split(',').map(a => a.trim() + '@' + this.options.domain).join(',')
  }
  notifySuccess_(txn: Transaction, member: Member, config: EmailConfigurationType) {
    const binding = this.makeBinding_(txn, member)
    const message = this.makeMessageObject_(getGmailTemplateFromDrafts_(this.drafts, config["Subject Line"]), binding)
    this.sendMail_(this.getRecipient_(txn, config), message, { bcc: this.makeBccList(config["Bcc on Success"]) })
  }
  notifyFailure_(txn: Transaction, member: Member, config: EmailConfigurationType, error?: Error) {
    const binding = this.makeBinding_(txn, member, error)
    const message = this.makeMessageObject_(getGmailTemplateFromDrafts_(this.drafts, config["Subject Line"]), binding)
    this.sendMail_(this.getRecipient_(txn, config), message, { bcc: this.makeBccList(config["Bcc on Failure"]) })
  }

  makeBinding_(txn: Transaction, member: Member, error?: Error): Binding {
    const binding: Binding = {
      ...txn,
      ...member.report,
      ...(error ? { error: error } : {})
    }
    // The above code is transpiled into code that converts date strings into date objects - not what we want at all!

    Object.keys(binding).forEach(k => binding[k] += '')
    return binding
  }
  makeMessageObject_(template: Template, binding: Binding) {
    return bindMessage_(template.message, binding)
  }
  getRecipient_(txn: Transaction, config: EmailConfigurationType) {
    return this.options.test ? `toby.ferguson+TEST@${this.options.domain}` : config.To === 'home' ? txn["Email Address"] : `${config.To}@${this.options.domain}`
  }

  sendMail_(recipient, message, options?: SendEmailOptions) {
    const defaultOptions: SendEmailOptions = {
      htmlBody: message.html,
      //from: `membership@${this.options.domain}`,
      name: 'SCCC Membership',
      // replyTo: 'a.reply@email.com',
      noReply: true, // if the email should be sent from a generic no-reply email address (not available to gmail.com users)
      attachments: message.attachments,
      inlineImages: message.inlineImages
    }
    const finalOptions = { ...defaultOptions, ...options }
    this.options.mailer.sendEmail(recipient, message.subject, message.text, finalOptions)
  }


}
export { EmailNotifier }

class TransactionProcessor {
  directory: Directory;
  notifier: Notifier;

  /**
   * 
   * @param {Directory} directory 
   * @param {Notifier} notifier 
   */
  constructor(directory: Directory, notifier: Notifier = new Notifier()) {
    this.directory = directory;
    this.notifier = notifier;
  }
  processTransaction(txn: Transaction, matcher = this.matchTransactionToMember_) {
    if (txn['Payable Status'] === undefined || !txn['Payable Status'].startsWith('paid') || txn.Processed) return txn;

    try {
      let matching = this.directory.members.filter((m) => matcher(txn, m))
      if (matching.length === 0) { // Join
        Logger.log("TP.pt - join_");
        this.join_(txn);
      } else {
        if (matching.length > 1) {
          matching.forEach(m => {
            Logger.log("TP.pt - partial_")
            this.partial_(txn, m)
          })
        } else {
          const member = matching[0]
          const matched = matcher(txn, member)
          if (typeof matched === "boolean") throw new Error("Matching failure")
          if (matched.full) {
            Logger.log("TP.pt - renew_")
            this.renew_(txn, member)
          } else {
            Logger.log("TP.pt - partial_")
            this.partial_(txn, member)
          }
        }
      }
    } finally {
      return txn
    }
  }
  /**
   * @function matchTransactionToMember - return a value depending on whether the transaction matches a member
   * @param {Transaction} transaction
   * @param {Member} member
   * @return {{full: boolean} | boolean} - IF there's a match returns the object, with the full field indicating whether it was a full match or not; otherwise it returns false.
   */


  matchTransactionToMember_(txn: Transaction, member: Member): { full: boolean } | boolean {
    const left = { email: member.homeEmail, phone: member.phone };
    const right = { email: txn["Email Address"], phone: txn["Phone Number"] }
    const result = TransactionProcessor.match(left, right)
    return result
  }
  static match(left: { email: string, phone: string }, right: { email: string, phone: string }): { full: boolean } | boolean {
    const emailsMatch = left.email === right.email;
    const phonesMatch = left.phone === right.phone;
    const result = (emailsMatch && phonesMatch) ? { full: true } : (emailsMatch || phonesMatch) ? { full: false } : false
    return result
  }
  join_(txn: Transaction) {
    const member = this.directory.makeMember(txn)
    while (true) {
      try {
        this.directory.addMember(member)
        txn.Processed = new Date().toISOString().split("T")[0]
        this.notifier.joinSuccess(txn, member)
        return
      } catch (err: any) {
        if (err instanceof MemberAlreadyExistsError) {
          console.log('TP - join retry')
          member.incrementGeneration()
          continue
        } else {
          this.notifier.joinFailure(txn, member, err)
          return
        }
      }
    }
  }
  /**
   * Process a membership renewal. 
   * @param (Transaction) txn the transaction causing the renewal
   * @param (User) member the member that is renewing their membership
   */
  renew_(txn, member) {
    let updatedMember = this.directory.makeMember(member).incrementExpirationDate()
    try {
      this.directory.updateMember(updatedMember)
      txn.Processed = new Date()
      this.notifier.renewalSuccess(txn, updatedMember)
    } catch (err: any) {
      this.notifier.renewalFailure(txn, member, err)
    }
  }
  partial_(txn, member) {
    this.notifier.partial(txn, member)
  }
}
export { TransactionProcessor };
const Utils = (() => {
  return {
    retryOnError: (f, error, t = 250) => {
      while (true) {
        try {
          return f()
        } catch (err) {
          if (err instanceof error) {
            Utilities.sleep(t)
          }
          throw err
        }
      }
    },
    waitNTimesOnCondition: (n, c, t = 250) => {
      for (let i = 0; i < n; i++) {
        if (c()) {
          return true
        }
        Utilities.sleep(t)
      }
      return false
    }
  }
})()

// const test1 = (() => {
//     const SKIP = false
//     return {
//         test() {
//             return this.unitTest(true) && this.integrationTest(false)
//         },
//         unitTest(skip = false) {
//             return this.test_(new Admin, skip)
//         },
//         integrationTest(skip = true) {
//             return this.test_(AdminDirectory, skip)
//         },
//         test_(sdk, skip = true) {
//             const unit = new bmUnitTester.Unit({ showErrorsOnly: true })
//             testDirectory(new Directory(sdk), skip)
//             testCreateDeleteTests(new Directory(sdk), skip)
//             testUser(new Directory(sdk), skip)
//             testTPJoinSuccess(new Directory(sdk), new Notifier(), skip)
//             testPartialSuccess(new Directory(sdk), new Notifier(), skip)
//             testRenewalSuccess(new Directory(sdk), new Notifier(), skip)
//             TestTPJoinFailures(new Directory(sdk), new Notifier(), skip)
//             testRenewalFailure(new Directory(sdk), new Notifier(), skip)
//             return unit.isGood()


//             function testCreateDeleteTests(directory, skip = false) {
//                 cleanUp_(testCreateDeleteTests_, directory, "user create/delete tests", skip)
//             }

//             function testCreateDeleteTests_(directory, description, skip = false) {
//                 const f = new Fixture1(directory, new Notifier())
//                 unit.section(() => {
//                     const txns = [f.txn1];
//                     const directory = f.directory
//                     const notifier = f.notifier
//                     const uut = new TransactionProcessor(directory, notifier)
//                     uut.processTransactions(txns)
//                     const expected = directory.makeMember(f.txn1)
//                     unit.is(true, directory.isKnownMember(expected), { description: "Expecting txn1 member to have joined the Directory" })
//                     directory.deleteMember(expected)
//                     unit.is(false, directory.isKnownMember(expected), { description: "Expected member to have been deleted from the directory" })
//                 },
//                     {
//                         description,
//                         skip
//                     })
//             }
//             function testDirectory(directory, skip = false) {
//                 cleanUp_(testDirectory_, directory, "Google Directory test", skip)
//             }

//             function testDirectory_(directory, description, skip = false) {
//                 const fixture = new Fixture1(directory)
//                 unit.section(() => {
//                     const directory = fixture.directory
//                     let user = directory.makeMember(fixture.txn1)
//                     directory.addMember(user)
//                     const expected = directory.makeMember(fixture.txn1)
//                     unit.is(true, directory.isKnownMember(expected), { description: "Expected user to be in members" })
//                     const old = user.customSchemas.Club_Membership.expires
//                     const updatedUser = directory.getMember(user).incrementExpirationDate()
//                     directory.updateMember(updatedUser)
//                     unit.not(old, updatedUser.incrementExpirationDate().customSchemas.Club_Membership.expires, { description: "Expected old and new dates to differ" })
//                     expected.incrementExpirationDate()
//                     unit.is(true, directory.isKnownMember(expected), { description: "Expected updated user to be in members" })
//                     function unf() {
//                         try {
//                             directory.updateMember(directory.makeMember(fixture.txn2))
//                         } catch (err) {
//                             return err
//                         }
//                         return new Error("Expecting an error")
//                     }
//                     unit.is(true, unf() instanceof MemberNotFoundError, { description: "Expecting update of uknown user to throw UserNotFoundException" })
//                     directory.deleteMember(user)
//                     directory.deleteMember(user, false)
//                     unit.is(true, !directory.isKnownMember(expected), { description: "Expected deletion to be idempotent" })
//                 },
//                     {
//                         description,
//                         skip
//                     })
//             }



//             function cleanUp_(f, directory, ...args) {
//                 try {
//                     f(directory, ...args)
//                 } finally {
//                     directory.members.forEach((m, i, em) => directory.deleteMember(m, (i === em.length - 1)))
//                 }
//             }





//             function testUser(directory, skip = false) {
//                 const f = new Fixture1(directory)
//                 unit.section(() => {
//                     const uut = f.directory.makeMember(f.txn1)
//                     unit.is(uut.orgUnitPath, f.directory.orgUnitPath, { description: "Expecting orgUnitPath to be setup correctly" })
//                     unit.is(uut.primaryEmail.split('@')[1], f.directory.domain, { description: "Expecting domain to be setup correctly" })
//                 },
//                     {
//                         description: "User tests",
//                         skip
//                     })
//             }



//             function testTPJoinSuccess(directory: Directory, notifier: Notifier, skip = false) {
//                 cleanUp_(testTPJoinSuccess_, directory, notifier, "TransactionProcessor join tests", skip)
//             }
//             function testTPJoinSuccess_(directory: Directory, notifier: Notifier, description: string, skip = false) {
//                 const f = new Fixture1(directory, notifier)
//                 unit.section(() => {
//                     const txn3 = { ...f.txn1 }
//                     txn3["Phone Number"] = "+14083869399"
//                     txn3["Email Address"] = "foo@bar.com"
//                     const txns = [f.txn1, f.txn2, txn3]
//                     const directory = f.directory
//                     const notifier = f.notifier
//                     const uut = new TransactionProcessor(directory, notifier)
//                     uut.processTransactions(txns)
//                     let actualMembers = directory.members
//                     let expectedMembers = txns.map((t, i, ts) => {
//                         const nu = directory.makeMember(t); if (i < ts.length - 1) { return nu } else {
//                             nu.primaryEmail = `${t["First Name"]}.${t["Last Name"]}1@${directory.domain}`.toLowerCase();
//                             nu.emails.filter((e) => e.primary).forEach((e) => e.address = nu.primaryEmail)
//                             return nu
//                         }
//                     })
//                     unit.is(3, actualMembers.length, { description: "Expected to have 3 new members" })
//                     expectedMembers.forEach((m) => {
//                         let am = actualMembers.find((a) => a.primaryEmail === m.primaryEmail)
//                         unit.is(m.name, am?.name, { description: "Expected names to match" })
//                         unit.is(m.emails, am?.emails, { description: "Expected home emails to match" })
//                         unit.is(m.phones, am?.phones, { description: "Expected phones to match" })
//                         unit.is(m.customSchemas, am?.customSchemas, { description: "Expected custom schemas to match" })
//                     })
//                     txns.forEach((t, i, ts) => {
//                         const el = { txn: t, user: expectedMembers[i] }
//                         if (i === ts.length - 1) el.user.generation = 1;
//                         unit.is(el, notifier?.joinSuccessLog[i], { description: "Expected log entries to match" })
//                     })
//                     txns.forEach((t) => {
//                         unit.not(undefined, t.Processed, { neverUndefined: false, description: "Expected all transactions to have been processed" })
//                     })
//                 },
//                     {
//                         description,
//                         skip
//                     })
//             }


//             function TestTPJoinFailures(directory, notifier, skip = false) {
//                 cleanUp_(TestTPJoinFailures_, directory, "TransactionProcessor join failure tests", notifier, skip)
//             }
//             function TestTPJoinFailures_(directory, description, notifier, skip = false) {
//                 class BadUsers extends Users {
//                     badUserEmail: string;
//                     constructor(badUserEmail) {
//                         super()
//                         this.badUserEmail = badUserEmail
//                     }
//                     insert(user) {
//                         if (user.primaryEmail === this.badUserEmail) {
//                             const message = `bad user: ${user.primaryEmail} === ${this.badUserEmail}`
//                             console.error(message)
//                             throw new DirectoryError(message)
//                         }
//                         return super.insert(user)
//                     }
//                 }
//                 let f = new Fixture1(directory, notifier)
//                 const admin = new Admin(new BadUsers(directory.makeMember(f.badTxn).primaryEmail))
//                 f.directory = new Directory(admin)
//                 unit.section(() => {
//                     const txns = [f.badTxn, f.txn2]
//                     const goodMember = directory.makeMember(f.txn2)
//                     const badMember = directory.makeMember(f.badTxn)
//                     const uut = new TransactionProcessor(f.directory, f.notifier)
//                     uut.processTransactions(txns)
//                     unit.is(1, f.directory.members.length, { description: "Expect directory to have 1 member" })
//                     unit.is(true, f.directory.isKnownMember(goodMember), { description: "Expect goodMember to have become a member" })
//                     unit.is([{ txn: f.txn2, user: goodMember }], f.notifier?.joinSuccessLog, { description: "successful join notification is expected to be txn2" })
//                     unit.is(1, f.notifier?.joinFailureLog.length, { description: "one join failure expected" })
//                     f?.notifier?.joinFailureLog.forEach((l) => {
//                         unit.is(true, l.error instanceof Error)
//                         delete l.error
//                     })
//                     unit.is([{ txn: f.badTxn, user: badMember }], notifier.joinFailureLog, { description: "Join failure is expected to be badTxn" })
//                     unit.is(undefined, f.badTxn.Processed, { neverUndefined: false, description: "badTxn should not have been processed" })
//                     unit.is(true, new Date(f.txn2.Processed ? f.txn2.Processed : "") instanceof Date, { description: "myTxn2 should have a processing date" })
//                     unit.not(undefined, f.txn2.Processed, { neverUndefined: false, description: "txn2 should  have been processed" })
//                 }, {
//                     description,
//                     skip
//                 })
//             }

//             function testRenewalSuccess(directory: Directory, notifier: Notifier, skip = false) {
//                 cleanUp_(testRenewalSuccess_, directory, "Renewal Success Test", notifier, skip)
//             }
//             function testRenewalSuccess_(directory: Directory, description: string, notifier: Notifier, skip: boolean) {
//                 const f = new Fixture1(directory, notifier)
//                 unit.section(() => {
//                     // Copied from Test Directory
//                     const directory = f.directory
//                     let user = directory.makeMember(f.txn1)
//                     directory.addMember(user)
//                     //
//                     const notifier = f.notifier
//                     const txns = [f.txn1, f.txn2]
//                     const renewalTxn = txns[0]
//                     const renewingUser = f.directory.makeMember(renewalTxn)
//                     const joinTxn = txns[1]
//                     const joiningUser = f.directory.makeMember(joinTxn)
//                     const uut = new TransactionProcessor(directory, notifier)
//                     uut.processTransactions(txns)
//                     const updatedRenewingUser = f.directory.makeMember(renewalTxn)
//                     updatedRenewingUser.incrementExpirationDate()
//                     unit.is(true, directory.members.some((m) => m.primaryEmail = updatedRenewingUser.primaryEmail), { description: "The renewed user is expected to be a member of the Directory" })
//                     unit.is(true, directory.members.some((m) => m.primaryEmail = joiningUser.primaryEmail), { description: "The joining user is expected to be a member of the Directory" })

//                     unit.is([{ txn: renewalTxn, user: updatedRenewingUser }], notifier?.renewalSuccessLog, { description: "notification of renewal expected" })
//                     unit.not(undefined, renewalTxn.Processed, { description: "renewalTxn has been processed" })
//                     unit.is([{ txn: joinTxn, user: f.directory.makeMember(joinTxn) }], notifier?.joinSuccessLog, { description: "notification of join expected" })
//                     unit.not(undefined, joinTxn.Processed, { description: "joinTxn has been processed" })

//                 }, {
//                     description,
//                     skip
//                 })
//             }

//             function testRenewalFailure(directory: Directory, notifier: Notifier, skip = false) {
//                 cleanUp_(testRenewalFailure_, directory, "Renewal Failure Test", notifier, skip)
//             }
//             function testRenewalFailure_(directory: Directory, description: string, notifier: Notifier, skip: boolean) {
//                 class BadUsers extends Users {
//                     #badUser;
//                     constructor(badUser) {
//                         super()
//                         this.#badUser = badUser
//                     }
//                     update(patch, primaryEmail) {
//                         if (primaryEmail === this.#badUser.primaryEmail) {
//                             throw new DirectoryError(`Bad User: ${this.#badUser.primaryEmail}`)
//                         }
//                         return super.update(patch, primaryEmail)
//                     }
//                 }
//                 let f = new Fixture1(directory, notifier)
//                 const badUser = f.directory.makeMember(f.badTxn);
//                 const admin = new Admin(new BadUsers(badUser))
//                 f.directory = new Directory(admin)
//                 unit.section(() => {
//                     const renewalTxn = f.badTxn;
//                     const expectedMember = f.directory.makeMember(badUser)
//                     unit.is(badUser, expectedMember, { description: "users should be the same" })
//                     const txns = [renewalTxn];
//                     const uut = new TransactionProcessor(f.directory, f.notifier)
//                     uut.processTransactions(txns)
//                     unit.is(true, f.directory.isKnownMember(expectedMember), { description: "Expecting member to be untouched" })
//                     unit.is(undefined, renewalTxn.Processed, { description: "Expecting renewalTxn to not have been processed", neverUndefined: false })
//                     let rfl = notifier.renewalFailureLog
//                     if (rfl[0]) delete rfl[0].error
//                     unit.is(renewalTxn, rfl[0].txn, { description: "Expecting renewalTxn to be in the renewalFailureLog" })
//                     unit.is(expectedMember, rfl[0].member, { description: "Expecting expectedMember to be in the renewalFailureLog" })

//                 },
//                     {
//                         description,
//                         skip
//                     })
//             }

//             function testPartialSuccess(directory, notifier, skip = false) {
//                 cleanUp_(testPartialSuccess_, directory, "Partials", notifier, skip)
//             }
//             function testPartialSuccess_(directory: Directory, description: string, notifier: Notifier, skip: boolean) {
//                 const f = new Fixture1(directory, notifier)
//                 unit.section(() => {
//                     const joiningTxn = f.txn1
//                     let joiningMember = directory.makeMember(joiningTxn)
//                     const renewingTxn = JSON.parse(JSON.stringify(joiningTxn))
//                     renewingTxn["Phone Number"] = "+1234"
//                     const renewingMember = f.directory.makeMember(renewingTxn);
//                     const uut = new TransactionProcessor(f.directory, f.notifier)
//                     uut.processTransactions([joiningTxn]);
//                     unit.is(1, f.directory.members.length, { description: "something was added as a member" })
//                     unit.is(true, f.directory.isKnownMember(joiningMember), { description: "member added from joiningTxn" })
//                     uut.processTransactions([renewingTxn]);
//                     f.directory.members.forEach((m) => {
//                         m.phones.forEach((p) => unit.not(p.value, renewingMember.phones[0].value, { description: "Expecting directory member's phones not to include those from the renewing member" }))

//                     })
//                     unit.is(renewingTxn, f.notifier?.partialsLog[0].txn, { description: "Expecting renewalTxn to be in the partials log" })
//                     if (f.notifier) {
//                         const loggedUser = directory.makeMember(f.notifier.partialsLog[0].member)
//                         unit.is(joiningMember, loggedUser, { description: "Expecting joining member to be in the partials log" })
//                     }

//                 },
//                     {
//                         description,
//                         skip
//                     })
//             }

//         },
//         testAdmin(skip = false) {
//             const unit = new bmUnitTester.Unit({ showErrorsOnly: true })
//             const admin = new Admin(new Users)
//             const directory = new Directory(admin)
//             const f = new Fixture1(directory)
//             try {
//                 const member = directory.makeMember(f.txn1)
//                 const newMember = admin.Users?.insert(member)
//                 unit.section(() => {
//                     unit.is(newMember, member, { description: "New member should. be copy of old" })
//                 },
//                     { description: "test Admin", skip })
//             } finally {
//                 directory.members.forEach((m, i, mbrs) => directory.deleteMember(m, (i + 1 === mbrs.length)))
//             }
//         }
//     }
// })()

// const testEmailNotifier = (() => {
//     {
//         const testFixtures = (() => {
//             const sendMail: MailAppType = {
//                 sendEmail(recipient, subject, text, options) {
//                     console.log(`To: ${recipient}`)
//                     console.log(`From: ${options.from}`)
//                     console.log(`Reply-to: ${options.noReply}`)
//                     console.log(`subject: ${subject}`)
//                     console.log(`html: ${options.htmlBody}`),
//                         console.log(`text: ${text}`)
//                     return this
//                 },
//                 getDrafts() { return new Array<DraftType>() }
//             }
//             const txn1: Transaction = {
//                 "First Name": "J",
//                 "Last Name": "K",
//                 "Email Address": "j.k@icloud.com",
//                 "Phone Number": "+14083869343",
//                 "Payable Status": "paid",
//                 "Payable Order ID": "CC-TF-RNB6",
//                 "Timestamp": "timestamp"
//             }
//             return {
//                 unit: new bmUnitTester.Unit({ showErrorsOnly: true }),
//                 subject_lines: {
//                     joinSuccessSubject: "Thanks for joining SCCCC",
//                     joinFailureSubject: "Join Problem",
//                     renewalSuccessSubject: "Thanks for renewing your SCCCC membership",
//                     renewalFailureSubject: "Renew problem",
//                     ambiguousSubject: "Ambiguous transaction",
//                     expiryNotificationSubject: "Your membership will expire in {{N}} days",
//                     expirationSubject: "Your membership has expired"
//                 },
//                 txn1,
//                 member1: new Member(txn1, "/test", "@a.com"),
//                 error: new Error("this is the error message"),
//                 sendMail: sendMail
//             }
//         })()

//         function testTemplates() {
//             const templates = new Templates(GmailApp.getDrafts(), testFixtures.subject_lines)
//             testFixtures.unit.section(() => testFixtures.unit.is(templates.ambiguous.message.subject, testFixtures.subject_lines.ambiguousSubject, { description: "Expected a template created from the ambiguous subject line" }))
//             try {
//                 const templates = new Templates(GmailApp.getDrafts(), { ...testFixtures.subject_lines, joinSuccessSubject: "NO SUCH DRAFT" })
//                 console.error("Expected to see an error saying that the draft couldn't be found")
//             } catch { }
//         }

//         function testEmailNotificationJoinFailure(mailApp: MailAppType) {
//             const templates = new Templates(mailApp.getDrafts(), testFixtures.subject_lines)
//             // const notifier = new EmailNotifier(templates, { test: true, mailer: testFixtures.sendMail, bccOnSuccess: "a@b.com,c@d.com", bccOnFailure: "FAILURE (COPIED)", toOnFailure: "FAILURE" })
//             // notifier.joinFailure(testFixtures.txn1, testFixtures.member1, testFixtures.error)
//         }

//         function testEmailNotifier(mailApp: MailAppType) {
//             const templates = new Templates(mailApp.getDrafts(), testFixtures.subject_lines)
//             // const notifier = new EmailNotifier(templates, { test: true, mailer: testFixtures.sendMail, bccOnSuccess: "a@b.com,c@d.com", bccOnFailure: "FAILURE (COPIED)", toOnFailure: "FAILURE" })
//             // notifier.joinSuccess(testFixtures.txn1, testFixtures.member1)
//         }
//     }
// })()