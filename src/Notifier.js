class Notifier {
  constructor() {
    this.joinLog = []
    this.joinFailureLog = []
    this.renewalSuccessLog = []
    this.renewalFailureLog = []
    this.partialsLog = []
  }
  /**
   * Notify anyone interested that a user has been added as a consequence of the transaction
   * @param {Transaction} txn The transaction that caused the join
   * @param {User} user The user that was joined
   */
  joinSuccess(txn, user) {
    this.joinLog.push({ txn, user })
  }
  joinFailure(txn, user, err) {
    console.error(`Notifier.joinFailure()`)
    console.error(err.message)
    this.joinFailureLog.push({ txn, user, err })
  }
  renewalSuccess(txn, user) {
    this.renewalSuccessLog.push({ txn, user })
  }
  renewalFailure(txn, user, err) {
    console.error(`Notifier.renewalFailure()`)
    console.error(err.message)
    this.renewalFailureLog.push({ txn, user, err })
  }
  partial(txn, user) {
    this.partialsLog.push({ txn, user })
  }
  log() {
    function reportSuccess(l, kind) {
      l.forEach((e) => console.log(`${e.user.primaryEmail} ${kind}`))
    }
    function reportFailure(l, kind) {
      l.forEach((e) => console.error(`Txn ${e.txn["Payable Order ID"]} had ${kind} error: ${e.user.err}`))
    }
    reportSuccess(this.joinLog, "joined")
    reportFailure(this.joinFailureLog, "join")
    reportSuccess(this.renewalSuccessLog, "renewed")
    reportFailure(this.renewalFailureLog, "renewal")
    this.partialsLog.forEach((p) => console.log(`Txn ${p.txn["Payable Order ID"]} matched only one of phone or email against this member: ${p.user.primaryEmail}`))
  }

}
/**
 * @typedef {object} Templates
 * @property {GmailMessage} joinSuccess
 * @property {GmailMessage} joinFailure
 * @property {GmailMessage} renewalSuccess
 * @property {GmailMessage} renewalFailure
 * @property {GmailMessage} ambiguous
 */
class Templates {
  /**
   * 
   * @param {GmailDraft[]} drafts draft emails with {{}} templatized bodies
   * @param {string} joinSuccessSubject subject line used to find joinSuccess draft
   * @param {string} joinFailureSubject subject line used to find joinFailure draft
   * @param {string} renewalSuccessSubject subject line used to find renewalSuccess draft
   * @param {string} renewalFailureSubject subject line used to find renewalFailure draft
   * @param {string} ambiguous subject line used to find draft for when transaction is ambiguously matched against a user
   */
  constructor(drafts, joinSuccessSubject, joinFailureSubject, renewalSuccessSubject, renewalFailureSubject, ambiguous) {
    this.joinSuccess = getGmailTemplateFromDrafts_(drafts, joinSuccessSubject)
    this.joinFailure = getGmailTemplateFromDrafts_(drafts, joinFailureSubject)
  }
}



/**
 * @typedef MailerOptions
 * @property {boolean} [test = true]
 * @property {GMailApp} [mailer = GMailApp]
 * @property {string} [domain = "santacruzcountycycling.club" ]
 * @property {boolean} [html = true] send as html
 */
class EmailNotifier extends Notifier {
  /**
   * 
   * @param {Templates} templates 
   * @param {MailerOptions} options
   */
  constructor(templates, options) {
    super()
    const localOptions = { test: true, mailer: GmailApp, domain: "santacruzcountycycling.club", html: true, ...options }
    this.templates = templates
    this.test = localOptions.test
    this.mailer = localOptions.mailer
    this.domain = localOptions.domain
    this.html = localOptions.html
  }
  getRecipient_(txn) {
    return this.test ? `membershiptest@${this.domain}` : txn["Email Address"]
  }
  makeSuccessBinding_(txn, member) {
    return {
      timestamp: txn.Timestamp,
      orderID: txn["Payable Order ID"],
      primaryEmail: member.primaryEmail,
      givenName: member.name.givenName,
      familyName: member.name.familyName,
      expiry: member.customSchemas.Club_Membership.expires
    }
  }
  makeFailureBinding_(txn, member, error) {
    const body = this.makeSuccessBinding_(txn, member)
    body.errorMessage = error.message
    return body
  }
  makeMessageObject_(template, binding) {
    return bindMessage_(template.message, binding)
  }
  sendMail_(recipient, message, html= true) {
    const options = {
      htmlBody: message.html,
      // bcc: 'a.bcc@email.com',
      // cc: 'a.cc@email.com',
      from: `membership@${this.domain}`,
      // name: 'name of the sender',
      // replyTo: 'a.reply@email.com',
      noReply: true, // if the email should be sent from a generic no-reply email address (not available to gmail.com users)
      attachments: message.attachments,
      inlineImages: message.inlineImages
    }
    if (!html) delete options.htmlBody
    this.mailer.sendMail(recipient, message.subject, message.text, options)
  }
  joinSuccess(txn, member) {
    super.joinSuccess(txn, member)
    const binding = this.makeSuccessBinding_(txn, member)
    const message = this.makeMessageObject_(this.templates.joinSuccess, binding)
    this.sendMail_(this.getRecipient_(txn), message, this.html)
  }
  joinFailure(txn, member, error) {
    super.joinSuccess(txn, member)
    const binding = this.makeFailureBinding_(txn, member, error)
    const message = this.makeMessageObject_(this.templates.joinFailure, binding)
    this.sendMail_(this.getRecipient_(txn), message, this.html)
  }
}

/**
 * @typedef {object} Message
 * @property {string} subject - subject line of message
 * @property {string} text - plain text body of message
 * @property {string} html - html version of text body
 * 
 */
/**
 * @typedef {object} Template - a template for a message
 * @property {Message} message
 * @property {GmailAttachment[]} attachments
 * @property {GmailAttachment[]} inlineImages - inline images in format that can be used with an html message
 */
/**
  * Get a Gmail draft message by matching the subject line.
  * @param {GMailDraft[]} drafts
  * @param {string} subject_line to search for draft message
  * @return {Template} containing the draft message
  */
function getGmailTemplateFromDrafts_(drafts, subject_line) {
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
function bindMessage_(message, binding) {
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
function escapeData_(str) {
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
