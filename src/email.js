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
function sendScheduledEmails(emailScheduleData) {
  const today = new Date()
  const emailsToSend = emailScheduleData.filter(row => new Date(row["Scheduled On"]) <= today).map(row => {
    const Subject = expandTemplate(row.Subject, row);
    const Body = expandTemplate(row.Body, row);
    return { to: row.Email, subject: Subject, htmlBody: Body }
  })
  sendEmails(emailsToSend);
  return emailsToSend.length
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
function expandTemplate(template, row) {
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

function sendEmails(emails) {
  log(`Number of emails to be sent: ${emails.length}`);
  const emailLogFiddler = getFiddler_('Email Log');
  const emailLog = emailLogFiddler.getData();
  const testEmails = PropertiesService.getScriptProperties().getProperty('testEmails');
  if (testEmails === 'true') { // Use test path only if testEmails is explicitly set to true
    emails.forEach(email => log(`Email not sent due to testEmails property: To=${email.to}, Subject=${email.subject}, Body=${email.body}`));
  } else {
    emails.forEach(email => sendSingleEmail(email, emailLog));
    emailLogFiddler.setData(emailLog).dumpValues();
  }
}

function sendSingleEmail(email, emailLog) {
  log(`Email Sent: :`, email);
  try {
    MailApp.sendEmail(email);
  } catch (error) {
    log(`Failed to send email to ${email.to}: ${error.message}`);
  }
  emailLog.push({ Timestamp: new Date(), ...email });
}


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
