import { Notifier } from './Notifier'
import { MailAppType, MailerOptions, DraftType, SubjectLines, Template, SendEmailOptions } from './Types'
import { Member } from './Member'
import { Transaction } from './TransactionProcessor';



class Templates {
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




class EmailNotifier extends Notifier {
    templates: Templates;
    options: MailerOptions;
    /**
     * 
     * @param {Templates} templates 
     * @param {MailerOptions} options
     */
    constructor(templates: Templates, options: MailerOptions) {
        super()
        this.options = { test: true, domain: "santacruzcountycycling.club", ...options }
        this.templates = templates
    }

    joinSuccess(txn: Transaction, member: Member) {
        super.joinSuccess(txn, member)
        this.notifySuccess_(this.templates.joinSuccess, txn, member)
    }
    joinFailure(txn, member, error) {
        super.joinFailure(txn, member, error)
        this.notifyFailure_(this.templates.joinFailure, txn, member)
    }
    renewalSuccess(txn, member) {
        super.renewalSuccess(txn, member);
        this.notifySuccess_(this.templates.renewalSuccess, txn, member)
    }
    renewalFailure(txn, member, error) {
        super.renewalFailure(txn, member, error)
        this.notifySuccess_(this.templates.renewalFailure, txn, member)
    }
    partial(txn, member) {
        super.partial(txn, member)
        this.notifyFailure_(this.templates.ambiguous, txn, member)
    }
    notifySuccess_(template, txn, member, error?) {
        const binding = this.makeBinding_(txn, member, error)
        const message = this.makeMessageObject_(template, binding)
        this.sendMail_(this.getRecipient_(txn), message, { bcc: this.options.bccOnSuccess})
    }
    notifyFailure_(template, txn, member, error?) {
        const binding = this.makeBinding_(txn, member, error)
        const message = this.makeMessageObject_(template, binding)
        this.sendMail_(this.options.toOnFailure, message, { bcc: this.options.bccOnFailure})
    }
    makeBinding_(txn, member, error) {
        const binding = {
            timestamp: txn.Timestamp,
            orderID: txn["Payable Order ID"],
            primaryEmail: member.primaryEmail,
            givenName: member.name.givenName,
            familyName: member.name.familyName,
            expiry: member.customSchemas.Club_Membership.expires,
            error: error ? error.msg : ""
        }
        if (error) binding.error = error.msg
        return binding
    }
    makeMessageObject_(template, binding) {
        return bindMessage_(template.message, binding)
    }
    getRecipient_(txn) {
        return this.options.test ? `membershiptest@${this.options.domain}` : txn["Email Address"]
    }

    sendMail_(recipient, message, options?:SendEmailOptions) {
        const defaultOptions:SendEmailOptions = {
            htmlBody: message.html,
            // bcc: 'a.bcc@email.com',
            // cc: 'a.cc@email.com',
            from: `membership@${this.options.domain}`,
            // name: 'name of the sender',
            // replyTo: 'a.reply@email.com',
            noReply: true, // if the email should be sent from a generic no-reply email address (not available to gmail.com users)
            attachments: message.attachments,
            inlineImages: message.inlineImages
        }
        const finalOptions = {...defaultOptions, ...options}
        this.options.mailer.sendEmail(recipient, message.subject, message.text, finalOptions)
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

export { EmailNotifier, Templates }