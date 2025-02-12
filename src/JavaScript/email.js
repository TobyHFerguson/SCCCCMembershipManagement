

function sendEmails(emailQueue, senderFun, actionSpecs, members) {
  const membersByEmail = members.reduce((acc, member) => { acc[member.Email] = member; return acc; }, {});
  if (!emailQueue || emailQueue.length === 0) { 
    return;
  }
  for (let i = emailQueue.length - 1; i >= 0; i--) {
    const email = emailQueue[i];
    const member = membersByEmail[email.Email];
    const spec = actionSpecs.find(spec => spec.Type === email.Type);
    if (spec) {
      senderFun({
        to: email.Email,
        subject: expandTemplate_(spec.Subject, member),
        htmlBody: expir(spec.Body, member)
      });
      emailQueue.splice(i, 1);
    }
  } 

}

/**
 * Sends scheduled emails based on the email schedule data.
 * 
 * This function retrieves the email schedule and email log data, sorts the schedule by date,
 * and sends emails that are scheduled to be sent on or before the current date and time.
 * After sending an email, it logs the email and updates the schedule.
 * 
 * The function performs the following steps:
 * 1. Retrieves and sorts the email schedule data.
 * 2. Retrieves the email log data.
 * 3. Iterates through the email schedule in reverse order.
 * 4. Sends emails that are scheduled for the current date or earlier.
 * 5. Logs the sent emails and updates the email schedule.
 * 
 * Note: The email schedule is sorted in reverse order, so the function starts processing
 * from the end where dates are more likely to be in the past.
 * 
 * @function
 */
function doScheduledActions(emailScheduleData, activeMembers, expiredMembers) {
  const today = midday();
  // Set the time to the start of the day
  const newSchedule = emailScheduleData.filter(scheduledAction => {
    const scheduledDate = midday(new Date(scheduledAction["Scheduled On"]));
    if (scheduledDate <= today) {
      performScheduledAction(scheduledAction, activeMembers, expiredMembers);
      return false;
    } else {
      return true;
    }
  })
  return newSchedule;
}


/**
 * Sends an email based on the scheduled action data.
 * 
 * This function sends an email using the data in the scheduled action object.
 * It uses the MailApp service to send the email and logs the email in the email log.
 * 
 * @param {Object} scheduledAction - The scheduled action object containing email data.
 */
function performScheduledAction(scheduledAction, activeMembers, expiredMembers) {
  if (scheduledAction.Type === 'Expiry4') {
    expiredMember(scheduledAction.Email, activeMembers, expiredMembers);
  }
  const email = {
    to: scheduledAction.Email,
    subject: scheduledAction.Subject,
    htmlBody: expandTemplate_(scheduledAction.Body, scheduledAction)
  };
  sendSingleEmail_(email);
}

/**
 * Expands a template string by replacing placeholders with corresponding values from a row object.
 * Placeholders are in the format {key}, where key is a property name in the row object.
 * Date fields specified in the dateFields array are converted to local date strings.
 *
 * @param {string} template - The template string containing placeholders.
 * @param {Object} row - The object containing values to replace placeholders.
 * @returns {string} - The expanded template string with placeholders replaced by corresponding values.
 */
function expandTemplate_(template, row) {
  const dateFields = ["Scheduled On", "Expires", "Joined", "Renewed On"]; // Add the names of fields that should be treated as dates
  return template.replace(/{([^}]+)}/g, (_, key) => {
    let value = row[key];
    if (dateFields.includes(key)) {
      value = new Date(value); // Convert to Date object if it's a date field
      return value.toLocaleDateString(); // Convert Date objects to local date string
    }
    return value || "";
  });
};




function testSendEmail() {
  const recipient = "test@example.com";
  const subject = "Test Subject";
  const body = "This is a test email body.";
  const options = {
    cc: "cc@example.com",
    bcc: "bcc@example.com",
    attachments: [Utilities.newBlob("Attachment content", "text/plain", "test.txt")]
  };
  MailApp.sendEmail(recipient, subject, body, options);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    sendEmails_: sendEmails
  };
}