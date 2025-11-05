
MembershipManagement.convertJoinToRenew = function (rowAIndex, rowBIndex) {
  const membershipFiddler = Common.Data.Storage.SpreadsheetManager.getFiddler('ActiveMembers');
  const expiryFiddler = Common.Data.Storage.SpreadsheetManager.getFiddler('ExpirySchedule');
  const init = MembershipManagement.Internal.initializeManagerData_(membershipFiddler, expiryFiddler);
  const manager = init.manager;
  const membershipData = init.membershipData;
  const result = manager.convertJoinToRenew(rowAIndex, rowBIndex, membershipData);
  if (result.success) {
    membershipFiddler.setData(membershipData).dumpValues();
  }
  return result
}

MembershipManagement.processTransactions = function () {
  Common.Data.Storage.SpreadsheetManager.convertLinks('Transactions');
  const transactionsFiddler = Common.Data.Storage.SpreadsheetManager.getFiddler('Transactions').needFormulas();
  const transactions = Common.Data.Storage.SpreadsheetManager.getDataWithFormulas(transactionsFiddler);
  if (transactions.length === 0) { return; }

  const membershipFiddler = Common.Data.Storage.SpreadsheetManager.getFiddler('ActiveMembers');
  const expiryScheduleFiddler = Common.Data.Storage.SpreadsheetManager.getFiddler('ExpirySchedule');

  const { manager, membershipData, expiryScheduleData } = this.Internal.initializeManagerData_(membershipFiddler, expiryScheduleFiddler);

  const { recordsChanged, hasPendingPayments, errors } = manager.processPaidTransactions(transactions, membershipData, expiryScheduleData);
  if (recordsChanged) {
    transactionsFiddler.setData(transactions).dumpValues();
    membershipFiddler.setData(membershipData).dumpValues();
    expiryScheduleFiddler.setData(expiryScheduleData).dumpValues();
  }
  errors.forEach(e => console.error(`Transaction on row ${e.txnNumber} ${e.email} had an error: ${e.message}\nStack trace: ${e.stack}`));
  return { hasPendingPayments, errors };
}

MembershipManagement.processMigrations = function () {
  const migratingMembersFiddler = Common.Data.Storage.SpreadsheetManager.getFiddler('MigratingMembers').needFormulas();
  const migratingMembers = Common.Data.Storage.SpreadsheetManager.getDataWithFormulas(migratingMembersFiddler);
  if (migratingMembers.length === 0) { return; }

  const membershipFiddler = Common.Data.Storage.SpreadsheetManager.getFiddler('ActiveMembers');
  const expiryScheduleFiddler = Common.Data.Storage.SpreadsheetManager.getFiddler('ExpirySchedule');

  const { manager, membershipData, expiryScheduleData } = this.Internal.initializeManagerData_(membershipFiddler, expiryScheduleFiddler);
  const mdLength = membershipData.length;
  const esdLength = expiryScheduleData.length;

  try {
    manager.migrateCEMembers(migratingMembers, membershipData, expiryScheduleData);
  } catch (error) {
    if (error instanceof AggregateError) {
      error.errors.forEach(e => console.error(`Transaction on row ${e.txnNumber} ${e.email} had an error: ${e.message}\nStack trace: ${e.stack}`));
    } else {
      console.error(`Error: ${error.message}\nStack trace: ${error.stack}`);
    }
  }
  if (PropertiesService.getScriptProperties().getProperty('logOnly').toLowerCase() === 'true') {
    console.log(`logOnly - # newMembers added: ${membershipData.length - mdLength} - #expirySchedule entries added: ${expiryScheduleData.length - esdLength}`);
    return;
  }
  migratingMembersFiddler.setData(migratingMembers).dumpValues();
  membershipFiddler.setData(membershipData).dumpValues();
  expiryScheduleFiddler.setData(expiryScheduleData).dumpValues();
}

MembershipManagement.processExpirations = function () {
  try {
    MembershipManagement.Utils.log('Starting membership expiration processing...');

    const membershipFiddler = Common.Data.Storage.SpreadsheetManager.getFiddler('ActiveMembers');
    const expiryScheduleFiddler = Common.Data.Storage.SpreadsheetManager.getFiddler('ExpirySchedule');

    const { manager, membershipData, expiryScheduleData } = this.Internal.initializeManagerData_(membershipFiddler, expiryScheduleFiddler);

    const numProcessed = manager.processExpirations(membershipData, expiryScheduleData);

    if (numProcessed === 0) {
      MembershipManagement.Utils.log('No memberships required expiration processing');
      return;
    }

    membershipFiddler.setData(membershipData).dumpValues();
    expiryScheduleFiddler.setData(expiryScheduleData).dumpValues();

    MembershipManagement.Utils.log(`Successfully processed ${numProcessed} membership expirations`);
  } catch (error) {
    const errorMessage = `Membership expiration processing failed: ${error.message}`;
    MembershipManagement.Utils.log(`ERROR: ${errorMessage}`);
    console.error(`${errorMessage}\nStack trace: ${error.stack}`);

    // Send email notification to membership automation
    this.Internal.sendExpirationErrorNotification_(error);

    throw error; // Re-throw to ensure trigger system knows about the failure
  }
}

MembershipManagement.Internal.initializeManagerData_ = function (membershipFiddler, expiryScheduleFiddler,) {
  const membershipData = membershipFiddler.getData();
  const expiryScheduleData = expiryScheduleFiddler.getData();
  //@ts-ignore
  const autoGroups = Common.Data.Access.getPublicGroups().filter(group => group.Subscription.toLowerCase() === 'auto');
  const manager = new MembershipManagement.Manager(Common.Data.Access.getActionSpecs(), autoGroups, this.getGroupAdder_(), this.getGroupRemover_(), this.getEmailSender_());

  return { manager, membershipData, expiryScheduleData };
}

MembershipManagement.Internal.getGroupAdder_ = function () {
  if (PropertiesService.getScriptProperties().getProperty('testGroupAdds') === 'true') {
    return (memberEmail, groupEmail) => MembershipManagement.Utils.log(`testGroupAdds: true. Would have added: `, memberEmail, ' to group:', groupEmail);
  } else {
    return (memberEmail, groupEmail) => this.addMemberToGroup_(memberEmail, groupEmail);
  }
}

MembershipManagement.Internal.getGroupRemover_ = function () {
  if (PropertiesService.getScriptProperties().getProperty('testGroupRemoves') === 'true') {
    return (memberEmail, groupEmail) => MembershipManagement.Utils.log(`testGroupRemoves: true. Would have removed: `, memberEmail, ' from group:', groupEmail);
  } else {
    return (memberEmail, groupEmail) => this.removeMemberFromGroup_(memberEmail, groupEmail);
  }
}

/**
 * Adds a single member to a Google Group using the Admin SDK API.
 *
 * @param {string} groupEmail The email address of the Google Group.
 * @param {string} memberEmail The email address of the member to add.
 * @customfunction
 */
MembershipManagement.Internal.addMemberToGroup_ = function (memberEmail, groupEmail) {
  try {
    AdminDirectory.Members.insert({ email: memberEmail, role: "MEMBER" }, groupEmail);
    MembershipManagement.Utils.log(`Successfully added ${memberEmail} to ${groupEmail}`);
  } catch (e) {
    if (e.message && e.message.includes("Member already exists")) {
      MembershipManagement.Utils.log(`Member ${memberEmail} already exists in ${groupEmail}`);
    } else {
      throw e;
    }
  }
}

/**
 * Removes a single member from a Google Group using the Admin SDK API.
 *
 * @param {string} groupEmail The email address of the Google Group.
 * @param {string} memberEmail The email address of the member to remove.
 * @customfunction
 */
MembershipManagement.Internal.removeMemberFromGroup_ = function (memberEmail, groupEmail) {
  try {
    AdminDirectory.Members.remove(groupEmail, memberEmail);
    MembershipManagement.Utils.log(`Successfully removed ${memberEmail} from ${groupEmail}`);
  } catch (e) {
    if (e.message && e.message.includes("Resource Not Found")) {
      MembershipManagement.Utils.log(`Error: ${memberEmail} not found in ${groupEmail} - one or both of those resources do not exist. Check the addresses and try again`);
    } else if (e.message && e.message === 'API call to directory.members.delete failed with error: Missing required field: ') {
      throw new Error(`Removing member ${memberEmail} from group ${groupEmail} - one or both of those addresses are not valid email addresses.`);
    } else {
      throw e;
    }
  }
}

MembershipManagement.Internal.getEmailSender_ = function () {
  const testEmails = PropertiesService.getScriptProperties().getProperty('testEmails') === 'true';
  const domain = PropertiesService.getScriptProperties().getProperty('domain') || 'sc3.club';
  return (email) => {
    email.replyTo = `membership@${domain}`;
    if (testEmails) {
      MembershipManagement.Utils.log('testEmails is set to true - logging only: ', email);
    } else {
      this.sendSingleEmail_(email);
    }
  };
}

MembershipManagement.Internal.sendSingleEmail_ = function (email) {
  MembershipManagement.Utils.log(`Email Sent: :`, email);
  try {
    MailApp.sendEmail(email);
    return { Timestamp: new Date(), ...email };
  } catch (error) {
    console.error(`Failed to send email to ${email.to}: ${error.message}`);
  }
}

MembershipManagement.Internal.sendExpirationErrorNotification_ = function (error) {
  try {
    const domain = PropertiesService.getScriptProperties().getProperty('domain') || 'sc3.club';
    const testEmails = PropertiesService.getScriptProperties().getProperty('testEmails') === 'true';

    const email = {
      to: `membership-automation@${domain}`,
      subject: `🚨 Membership Expiration Processing Failed`,
      htmlBody: `
        <h3>Membership Expiration Processing Error</h3>
        <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>Error:</strong> ${error.message}</p>
        <p><strong>Stack Trace:</strong></p>
        <pre>${error.stack}</pre>
        
        <h4>Recommended Actions:</h4>
        <ul>
          <li>Check the production logs in the Container Spreadsheet</li>
          <li>Verify ActiveMembers and ExpirySchedule sheet integrity</li>
          <li>Check for any blocked email addresses in the system</li>
          <li>Review recent changes to membership processing logic</li>
        </ul>
        
        <p><em>This is an automated notification from the SCCCC Membership Management System.</em></p>
      `,
      replyTo: `membership@${domain}`
    };

    if (testEmails) {
      MembershipManagement.Utils.log('testEmails is set to true - logging error notification only: ', email);
    } else {
      MailApp.sendEmail(email);
      MembershipManagement.Utils.log(`Error notification sent to membership-automation@${domain}`);
    }
  } catch (emailError) {
    // If we can't even send the error email, log it but don't throw
    MembershipManagement.Utils.log(`CRITICAL: Failed to send expiration error notification: ${emailError.message}`);
    console.error(`Failed to send error notification: ${emailError.message}\nOriginal error: ${error.message}`);
  }
}









