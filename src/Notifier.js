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

const Drafts = {
  joinSucces: "",
  joinFailure: "",
  renewalSuccess: "",
  renewalFailure: "",
  ambiguous: ""
}
class EmailNotifier extends Notifier {
  constructor(drafts, { test = true, mailer = GmailApp, domain = "santacruzcountycycling.club" }) {
    super()
    this.drafts
    this.test = test
    this.mailer = mailer
    this.domain = domain
  }
  getRecipient_(txn) {
    return this.test ? `membershiptest@${domain}` : txn["Email Address"]
  }
  makeSuccessBinding(txn, member) {
    return {
      timestamp: txn.Timestamp,
      orderID: txn["Payable Order ID"],
      primaryEmail: member.primaryEmail,
      fullName: member.fullName
    }
  }
  makeFailureBinding(txn, member, error) {
    body = this.makeSuccessBinding(txn, member)
    body.errorMessage = error.message
    return body
  }
  makeMessageObject(draft, binding) {

  }
  sendMail_(recipient, message) {
    this.mailer.sendMail(recipient, message.subject, message.txt,
      {
        htmlBody: message.html,
        // bcc: 'a.bcc@email.com',
        // cc: 'a.cc@email.com',
        from: `membership@${this.domain}`,
        // name: 'name of the sender',
        // replyTo: 'a.reply@email.com',
        noReply: true, // if the email should be sent from a generic no-reply email address (not available to gmail.com users)
        attachments: emailTemplate.attachments,
        inlineImages: emailTemplate.inlineImages
      })
  }
  joinSuccess(txn, member) {
    super.joinSuccess(txn, member)
    const binding = this.makeSuccessBinding(txn, member)
    const message = this.makeMessageObject(this.drafts.joinSuccess, binding)
    this.sendMail_(this.getRecipient_(txn), message)
  }

}



/**
  * Get a Gmail draft message by matching the subject line.
  * @param {string} subject_line to search for draft message
  * @return {object} containing the subject, plain and html message body and attachments
 */
function getGmailTemplateFromDrafts__(subject_line) {
  try {
    // get drafts
    const drafts = GmailApp.getDrafts();
    drafts.forEach((d) => { console.error(`Notifer: ggtfd_: ${d.getMessage().getSubject()}`)})
    // filter the drafts that match subject line
    const draft = drafts.filter(subjectFilter_(subject_line))[0];
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
      message: { subject: subject_line, text: msg.getPlainBody(), html: htmlBody },
      attachments: attachments, inlineImages: inlineImagesObj
    };
  } catch (e) {
    console.error(e.message)
    throw new Error(`Email Notifier - couldnt find draft with subject line: ${subject_line}`);
  }

  /**
   * Filter draft objects with the matching subject linemessage by matching the subject line.
   * @param {string} subject_line to search for draft message
   * @return {object} GmailDraft object
  */
  function subjectFilter_(subject_line) {
    return function (element) {
      if (element.getMessage().getSubject() === subject_line) {
        return element;
      }
    }
  }
}
