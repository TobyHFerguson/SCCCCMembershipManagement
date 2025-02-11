/**
 * @typedef {Object} Transaction
 * @property {string} "Email Address" - The email address.  // Use quotes!
 * @property {string} "First Name" - The first name. // Use quotes!
 * @property {string} "Last Name" - The last name. // Use quotes!
 * @property {string} "Payable Status" - The payable status. // Use quotes!
 * @property {string} "Payment" - The payment details. // Use quotes!
 * @property {Date} "Timestamp" - The timestamp. // Use quotes!
 */

/**
 * Represents a member object.
 * @typedef {Object} Member
 * @property {string} Email - The email address of the member.
 * @property {string} First - The first name of the member.
 * @property {string} Last - The last name of the member.
 * @property {Date} Joined - The date the member joined.
 * @property {number} Period - The membership period in years.
 * @property {Date} Expires - The expiration date of the membership.
 * @property {Date} [Renewed On] - The date the membership was last renewed.
 * @property {Date} [Migrated] - The date the member was migrated.
 */

/**
 * @typedef {Object} ActionSchedule
 * @property {Date} Date - The date of the action.
 * @property {string} Email - The member email concerned.
 * @property {ActionType} Type - The action to be taken.
 */

/**
 * Represents the specification linking an action type the corresponding email subject and body. The offset is the number of days relative to expiry to send the email. (negtive being before expiry, positive being after expiry)
 * A missing offset means the action is to be taken immediately.
 * @typedef {Object} ActionSpec
 * @property {ActionType} Type - The type of action.
 * @property {number} [Offset] - The offset in days from expiry for the action. No offset means immediate
 * @property {string} Subject - The subject of the email.
 * @property {string} Body - The body of the email.
 */

/**
 * typedef {Object} ScheduleEntry
 * @property {Date} date - The date of the action.
 * @property {string} email - The member email concerned.
 * @property {ActionType} action - The action to be taken.
 */

/**
 * @typedef {Object} EmailQueueEntry
 * @property {string} email - The member email concerned.
 * @property {ActionType} action - The action to be taken.
 */

/**
 * @typedef {EmailQueueEntry[]} EmailQueue - An array of email queue entries.
 */

/**
 * @typedef {Object} ExpiredMembersQueueEntry
 * @property {string} email - The member email concerned.
 */

/**
 * @typedef {ExpiredMembersQueueEntry[]} ExpiredMembersQueue - An array of expired members queue entries.
 */