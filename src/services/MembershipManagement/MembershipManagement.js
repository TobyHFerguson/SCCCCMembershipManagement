
MembershipManagement.convertJoinToRenew = function (rowAIndex, rowBIndex) {
  const membershipFiddler = Common.Data.Storage.SpreadsheetManager.getFiddler('ActiveMembers');
  const expiryFiddler = Common.Data.Storage.SpreadsheetManager.getFiddler('ExpirySchedule');
  const init = MembershipManagement.Internal.initializeManagerData_(membershipFiddler, expiryFiddler);
  const manager = init.manager;
  const membershipData = init.membershipData;
  const expiryScheduleData = init.expiryScheduleData;
  const result = manager.convertJoinToRenew(rowAIndex, rowBIndex, membershipData, expiryScheduleData);
  if (result.success) {
    membershipFiddler.setData(membershipData).dumpValues();
    expiryFiddler.setData(expiryScheduleData).dumpValues();
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

MembershipManagement.generateExpiringMembersList = function () {
  try {
    MembershipManagement.Utils.log('Starting membership expiration processing...');

    const membershipFiddler = Common.Data.Storage.SpreadsheetManager.getFiddler('ActiveMembers');
    const expiryScheduleFiddler = Common.Data.Storage.SpreadsheetManager.getFiddler('ExpirySchedule');


    const { manager, membershipData, expiryScheduleData } = this.Internal.initializeManagerData_(membershipFiddler, expiryScheduleFiddler);
    const prefillFormTemplate = PropertiesService.getScriptProperties().getProperty('PREFILL_FORM_TEMPLATE');
    if (!prefillFormTemplate) {
      throw new Error("PREFILL_FORM_TEMPLATE property is not set.");
    }
    const newExpiredMembers = manager.generateExpiringMembersList(membershipData, expiryScheduleData, prefillFormTemplate);

    if (newExpiredMembers.length === 0) {
      MembershipManagement.Utils.log('No memberships required expiration processing');
      return;
    }
    // Map generator messages into FIFOItem objects and append to ExpirationFIFO
    const expirationFIFO = Common.Data.Storage.SpreadsheetManager.getFiddler('ExpirationFIFO');
    const expirationQueue = expirationFIFO.getData() || [];

    const makeId = () => `${new Date().toISOString().replace(/[:.]/g, '')}-${Math.random().toString(16).slice(2, 8)}`;

    for (const msg of newExpiredMembers) {
      /** @type {MembershipManagement.FIFOItem} */
      const item = {
        id: makeId(),
        email: msg.email,
        subject: msg.subject,
        htmlBody: msg.htmlBody,
        groups: msg.groups || '',
        attempts: 0,
        lastAttemptAt: '',
        lastError: '',
        nextAttemptAt: '',
        dead: false
      };

      expirationQueue.push(item);
    }

    expirationFIFO.setData(expirationQueue).dumpValues();
    membershipFiddler.setData(membershipData).dumpValues();
    expiryScheduleFiddler.setData(expiryScheduleData).dumpValues();

    MembershipManagement.Utils.log(`Successfully appended ${newExpiredMembers.length} membership expiration plan(s) to FIFO`);
    
    // If we added items to the queue, kick off the consumer to start processing
    if (newExpiredMembers.length > 0) {
      MembershipManagement.processExpirationFIFO();
    }
  } catch (error) {
    const errorMessage = `Membership expiration processing failed: ${error.message}`;
    MembershipManagement.Utils.log(`ERROR: ${errorMessage}`);
    console.error(`${errorMessage}\nStack trace: ${error.stack}`);

    // Send email notification to membership automation
    this.Internal.sendExpirationErrorNotification_(error);

    throw error; // Re-throw to ensure trigger system knows about the failure
  }
}

/**
 * Consumer: process up to batchSize entries from the ExpirationFIFO sheet.
 * This function is intended to be called by a time-based trigger (minute-based) while work remains.
 * It will reschedule itself (create a 1-minute trigger) if more work remains after processing the batch.
 */
MembershipManagement.processExpirationFIFO = function (opts = {}) {
  try {
    MembershipManagement.Utils.log('Starting Expiration FIFO consumer...');
    const batchSize = opts.batchSize || Number(PropertiesService.getScriptProperties().getProperty('expirationBatchSize')) || 50;

    const expirationFIFO = Common.Data.Storage.SpreadsheetManager.getFiddler('ExpirationFIFO');
    /** @type {any[]} */
    const rawQueue = expirationFIFO.getData() || [];
    
    // Convert spreadsheet Date objects to ISO strings for internal processing
    /** @type {MembershipManagement.FIFOItem[]} */
    const queue = rawQueue.map(item => ({
      ...item,
      lastAttemptAt: MembershipManagement.Utils.spreadsheetDateToIso(item.lastAttemptAt),
      nextAttemptAt: MembershipManagement.Utils.spreadsheetDateToIso(item.nextAttemptAt)
    }));
    
    if (!Array.isArray(queue) || queue.length === 0) {
      MembershipManagement.Utils.log('Expiration FIFO empty - nothing to process');
      try { MembershipManagement.Trigger._deleteTriggersByFunctionName('processExpirationFIFOTrigger'); } catch (e) { /* ignore */ }
      return { processed: 0, remaining: 0 };
    }

    // Select eligible entries (not dead and nextAttemptAt is absent or in the past)
    const now = new Date();
    const eligibleItems = [];
    const eligibleIndices = [];
    
    for (let i = 0; i < queue.length && eligibleItems.length < batchSize; i++) {
      const item = queue[i];
      if (!item || item.dead) continue;
      
      if (item.nextAttemptAt) {
        const next = new Date(item.nextAttemptAt);
        if (!isNaN(next.getTime()) && next > now) continue; // not yet eligible
      }
      
      eligibleItems.push(item);
      eligibleIndices.push(i);
    }

    if (eligibleItems.length === 0) {
      MembershipManagement.Utils.log('No eligible FIFO entries to process at this time');
      try { MembershipManagement.Trigger._deleteTriggersByFunctionName('processExpirationFIFOTrigger'); } catch (e) { /* ignore */ }
      return { processed: 0, failed: 0, remaining: queue.length };
    }

    // Get scriptMaxAttempts from Properties (with backward compatibility for old property names)
    const scriptMaxAttempts = Number(PropertiesService.getScriptProperties().getProperty('expirationMaxAttempts')) 
                          || Number(PropertiesService.getScriptProperties().getProperty('expirationMaxRetries')) 
                          || Number(PropertiesService.getScriptProperties().getProperty('maxAttempts')) 
                          || Number(PropertiesService.getScriptProperties().getProperty('maxRetries')) 
                          || 5;    // Initialize manager
    const membershipFiddler = Common.Data.Storage.SpreadsheetManager.getFiddler('ActiveMembers');
    const expiryScheduleFiddler = Common.Data.Storage.SpreadsheetManager.getFiddler('ExpirySchedule');
    const init = this.Internal.initializeManagerData_(membershipFiddler, expiryScheduleFiddler);
    const manager = init.manager;

    const sendEmailFun = this.Internal.getEmailSender_();
    const groupRemoveFun = this.Internal.getGroupRemover_();

    // Process batch - Manager updates bookkeeping directly on items
    const result = manager.processExpiredMembers(eligibleItems, sendEmailFun, groupRemoveFun, { 
      batchSize, 
      maxAttempts: scriptMaxAttempts 
    });

    // Separate dead items from reattempt items
    const deadItems = result.failed.filter(item => item.dead);
    const reattemptItems = result.failed.filter(item => !item.dead);

    // Rebuild queue: replace processed items with reattempt items, remove succeeded/dead items
    const processedIds = new Set([...result.processed.map(i => i.id), ...deadItems.map(i => i.id)]);
    const reattemptMap = new Map(reattemptItems.map(item => [item.id, item]));
    
    const updatedQueue = queue.map((item, idx) => {
      if (!eligibleIndices.includes(idx)) return item; // untouched
      
      const reattemptItem = reattemptMap.get(item.id);
      if (reattemptItem) return reattemptItem; // failed, needs reattempt
      
      return null; // succeeded or dead - remove
    }).filter(item => item !== null);

    // Persist dead-letter items and updated queue
    if (!opts.dryRun) {
      if (deadItems.length > 0) {
        try {
          const deadFiddler = Common.Data.Storage.SpreadsheetManager.getFiddler('ExpirationDeadLetter');
          const existing = deadFiddler.getData() || [];
          // Convert ISO strings to Date objects for spreadsheet display
          const deadItemsForSheet = deadItems.map(item => ({
            ...item,
            lastAttemptAt: MembershipManagement.Utils.isoToSpreadsheetDate(item.lastAttemptAt),
            nextAttemptAt: MembershipManagement.Utils.isoToSpreadsheetDate(item.nextAttemptAt)
          }));
          deadFiddler.setData(existing.concat(deadItemsForSheet)).dumpValues();
          MembershipManagement.Utils.log(`Moved ${deadItems.length} items to ExpirationDeadLetter`);
        } catch (e) {
          console.error('Failed to persist dead-letter items', e && e.toString ? e.toString() : e);
        }
      }

      // Convert ISO strings to Date objects for spreadsheet display
      const updatedQueueForSheet = updatedQueue.map(item => ({
        ...item,
        lastAttemptAt: MembershipManagement.Utils.isoToSpreadsheetDate(item.lastAttemptAt),
        nextAttemptAt: MembershipManagement.Utils.isoToSpreadsheetDate(item.nextAttemptAt)
      }));
      expirationFIFO.setData(updatedQueueForSheet).dumpValues();
    } else {
      MembershipManagement.Utils.log('Dry-run mode: not persisting queue or dead-letter items');
    }

    MembershipManagement.Utils.log(`Expiration FIFO: processed ${result.processed.length}, reattempt ${reattemptItems.length}, dead ${deadItems.length}, remaining ${updatedQueue.length}`);

    // Schedule continuation trigger if work remains
    if (!opts.dryRun) {
      if (updatedQueue.length > 0) {
        try {
          MembershipManagement.Utils.log('Scheduling 1-minute trigger to continue processing');
          MembershipManagement.Trigger._deleteTriggersByFunctionName('processExpirationFIFOTrigger');
          MembershipManagement.Trigger._createMinuteTrigger('processExpirationFIFOTrigger', 1);
        } catch (e) {
          console.error('Error scheduling expiration FIFO trigger', e && e.toString ? e.toString() : String(e));
        }
      } else {
        // No more work - remove any existing minute trigger
        try { MembershipManagement.Trigger._deleteTriggersByFunctionName('processExpirationFIFOTrigger'); } catch (e) { /* ignore */ }
      }
    } else {
      MembershipManagement.Utils.log('Dry-run mode enabled: not scheduling or deleting triggers');
    }

    return { processed: result.processed.length, failed: reattemptItems.length, remaining: updatedQueue.length };
  } catch (error) {
    const errorMessage = `Expiration FIFO consumer failed: ${error.message}`;
    MembershipManagement.Utils.log(`ERROR: ${errorMessage}`);
    console.error(`${errorMessage}\nStack trace: ${error.stack}`);
    try { this.Internal.sendExpirationErrorNotification_(error); } catch (e) { console.error('Failed to send error notification', e); }
    return { processed: 0, failed: 0, remaining: -1, error: errorMessage };
  }
}

// Top-level trigger wrapper which the ScriptApp trigger should call
function processExpirationFIFOTrigger() { return MembershipManagement.processExpirationFIFO(); }

MembershipManagement.Internal.initializeManagerData_ = function (membershipFiddler, expiryScheduleFiddler,) {
  const membershipData = membershipFiddler.getData();
  const expiryScheduleData = expiryScheduleFiddler.getData();
  //@ts-ignore
  const autoGroups = Common.Data.Access.getPublicGroups().filter(group => group.Subscription.toLowerCase() === 'auto');
  const groupManager = {
    groupAddFun: this.getGroupAdder_(),
    groupRemoveFun: this.getGroupRemover_(),
    groupEmailReplaceFun: this.getGroupEmailReplacer_()
  }
  const manager = new MembershipManagement.Manager(Common.Data.Access.getActionSpecs(), autoGroups, groupManager, this.getEmailSender_());

  return { manager, membershipData, expiryScheduleData };
}

MembershipManagement.Internal.getGroupAdder_ = function () {
  if (PropertiesService.getScriptProperties().getProperty('testGroupAdds') === 'true') {
    return (memberEmail, groupEmail) => MembershipManagement.Utils.log(`testGroupAdds: true. Would have added: `, memberEmail, ' to group:', groupEmail);
  } else {
    return (memberEmail, groupEmail) => this.addMemberToGroup_(memberEmail, groupEmail);
  }
}

/**
 * Get the group removal function
 * @returns function(memberEmail: string, groupEmail: string): void 
 */
MembershipManagement.Internal.getGroupRemover_ = function () {
  if (PropertiesService.getScriptProperties().getProperty('testGroupRemoves') === 'true') {
    return (memberEmail, groupEmail) => MembershipManagement.Utils.log(`testGroupRemoves: true. Would have removed: `, memberEmail, ' from group:', groupEmail);
  } else {
    return (memberEmail, groupEmail) => this.removeMemberFromGroup_(memberEmail, groupEmail);
  }
}

MembershipManagement.Internal.getGroupEmailReplacer_ = function () {
  if (PropertiesService.getScriptProperties().getProperty('testGroupEmailReplacements') === 'true') {
    return (originalEmail, newEmail) => {
      MembershipManagement.Utils.log(`testGroupEmailReplacements: true. Would have replaced: `, originalEmail, ' with:', newEmail);
      return { success: true, message: 'Test mode - no changes made.' };
    }
  } else {
    return (originalEmail, newEmail) => { return this.changeSubscribersEmailInAllGroups_(originalEmail, newEmail) };
  }
}

/**
 * 
 * @param {string} originalEmail 
 * @param {string} newEmail 
 * @returns {{success: boolean, message: string}}
 */
MembershipManagement.Internal.changeSubscribersEmailInAllGroups_ = function (originalEmail, newEmail) {
  let errors = []
  const groups = GroupSubscription.listGroupsFor(originalEmail);
  for (var i = 0; i < groups.length; i++) {
    var groupEmail = groups[i].email;
    try {
      GroupSubscription.changeMembersEmail(groupEmail, originalEmail, newEmail);
    } catch (e) {
      errors.push(`group ${groupEmail}: ${e && e.toString ? e.toString() : e}`);
      console.error(`changeSubscribersEmailInAllGroups: error changing email in group ${groupEmail}`, e && e.toString ? e.toString() : e);
    }
  }
  if (errors.length > 0) {
    let errMsg = `Errors while updating ${originalEmail} to ${newEmail} in groups: ${errors.join('; ')}`;
    console.error(`changeSubscribersEmailInAllGroups: ${errMsg}`);
    return { success: false, message: errMsg };
  }
  return { success: true, message: `Successfully updated email from ${originalEmail} to ${newEmail} in all groups.` };
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
    // ignore "Resource Not Found" errors when the member is not in the group
    if (e.message && !e.message.includes("Resource Not Found")) {
      e.message = `group email: ${groupEmail} - ${e.message}`
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









