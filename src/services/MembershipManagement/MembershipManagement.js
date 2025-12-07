
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

  const { recordsChanged, hasPendingPayments, errors, auditEntries } = manager.processPaidTransactions(transactions, membershipData, expiryScheduleData);
  if (recordsChanged) {
    transactionsFiddler.setData(transactions).dumpValues();
    membershipFiddler.setData(membershipData).dumpValues();
    expiryScheduleFiddler.setData(expiryScheduleData).dumpValues();
  }
  
  // Persist audit log entries
  if (auditEntries && auditEntries.length > 0) {
    this.Internal.persistAuditEntries_(auditEntries);
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

  let auditEntries = [];
  const result = manager.migrateCEMembers(migratingMembers, membershipData, expiryScheduleData);
  auditEntries = result.auditEntries || [];
  
  // Log any errors that occurred during migration
  if (result.errors && result.errors.length > 0) {
    result.errors.forEach(e => console.error(`Migration error on row ${e.rowNum} ${e.email}: ${e.message}\nStack trace: ${e.stack}`));
  }
  
  if (PropertiesService.getScriptProperties().getProperty('MIGRATION_LOG_ONLY').toLowerCase() === 'true') {
    console.log(`logOnly - # newMembers added: ${membershipData.length - mdLength} - #expirySchedule entries added: ${expiryScheduleData.length - esdLength}`);
    return;
  }
  
  // Persist audit log entries
  if (auditEntries && auditEntries.length > 0) {
    this.Internal.persistAuditEntries_(auditEntries);
  }
  
  migratingMembersFiddler.setData(migratingMembers).dumpValues();
  membershipFiddler.setData(membershipData).dumpValues();
  expiryScheduleFiddler.setData(expiryScheduleData).dumpValues();
}

MembershipManagement.generateExpiringMembersList = function () {
  try {
    MembershipManagement.Utils.log('Starting membership expiration processing...');

    // Get all fiddlers once at the start (leverages per-execution caching)
    const membershipFiddler = Common.Data.Storage.SpreadsheetManager.getFiddler('ActiveMembers');
    const expiryScheduleFiddler = Common.Data.Storage.SpreadsheetManager.getFiddler('ExpirySchedule');
    const expirationFIFO = Common.Data.Storage.SpreadsheetManager.getFiddler('ExpirationFIFO');

    const { manager, membershipData, expiryScheduleData } = this.Internal.initializeManagerData_(membershipFiddler, expiryScheduleFiddler);
    const prefillFormTemplate = Common.Config.Properties.getProperty('PREFILL_FORM_TEMPLATE');
    if (!prefillFormTemplate) {
      throw new Error("PREFILL_FORM_TEMPLATE property is not set.");
    }
    const result = manager.generateExpiringMembersList(membershipData, expiryScheduleData, prefillFormTemplate);

    if (result.messages.length === 0) {
      MembershipManagement.Utils.log('No memberships required expiration processing');
      return;
    }
    // Map generator messages into FIFOItem objects and append to ExpirationFIFO
    const expirationQueue = expirationFIFO.getData() || [];

    const makeId = () => `${new Date().toISOString().replace(/[:.]/g, '')}-${Math.random().toString(16).slice(2, 8)}`;

    for (const msg of result.messages) {
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
        maxAttempts: undefined,
        dead: false
      };

      expirationQueue.push(item);
    }

    expirationFIFO.setData(expirationQueue).dumpValues();
    membershipFiddler.setData(membershipData).dumpValues();
    expiryScheduleFiddler.setData(expiryScheduleData).dumpValues();
    
    // Persist audit log entries
    if (result.auditEntries && result.auditEntries.length > 0) {
      this.Internal.persistAuditEntries_(result.auditEntries);
    }

    MembershipManagement.Utils.log(`Successfully appended ${expirationQueue.length} membership expiration plan(s) to FIFO`);
    
    // If we added items to the queue, kick off the consumer to start processing
    // Pass through already-fetched fiddlers to avoid redundant getFiddler calls
    if (result.messages.length > 0) {
      MembershipManagement.processExpirationFIFO({ 
        fiddlers: { expirationFIFO, membershipFiddler, expiryScheduleFiddler } 
      });
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
 * @param {Object} opts - Options object
 * @param {number} [opts.batchSize] - Maximum number of items to process
 * @param {boolean} [opts.dryRun] - If true, don't persist changes
 * @param {Object} [opts.fiddlers] - Pre-fetched fiddlers to reuse (avoids redundant getFiddler calls)
 */
MembershipManagement.processExpirationFIFO = function (opts = {}) {
  try {
    MembershipManagement.Utils.log('Starting Expiration FIFO consumer...');
    const batchSize = opts.batchSize || Common.Config.Properties.getNumberProperty('expirationBatchSize', 50);

    // GAS: Get fiddlers (leverages per-execution caching)
    const expirationFIFO = opts.fiddlers?.expirationFIFO || Common.Data.Storage.SpreadsheetManager.getFiddler('ExpirationFIFO');
    const membershipFiddler = opts.fiddlers?.membershipFiddler || Common.Data.Storage.SpreadsheetManager.getFiddler('ActiveMembers');
    const expiryScheduleFiddler = opts.fiddlers?.expiryScheduleFiddler || Common.Data.Storage.SpreadsheetManager.getFiddler('ExpirySchedule');
    const deadFiddler = opts.fiddlers?.deadFiddler || Common.Data.Storage.SpreadsheetManager.getFiddler('ExpirationDeadLetter');
    
    // GAS: Get queue and convert spreadsheet Date objects to ISO strings for pure function processing
    const rawQueue = expirationFIFO.getData() || [];
    /** @type {MembershipManagement.FIFOItem[]} */
    const queue = MembershipManagement.Utils.convertFIFOItemsFromSpreadsheet(rawQueue);
    
    if (!Array.isArray(queue) || queue.length === 0) {
      MembershipManagement.Utils.log('Expiration FIFO empty - nothing to process');
      try { MembershipManagement.Trigger._deleteTriggersByFunctionName('processExpirationFIFOTrigger'); } catch (e) { /* ignore */ }
      return { processed: 0, remaining: 0 };
    }

    // PURE: Select eligible items for current batch
    const now = new Date();
    const { eligibleItems, eligibleIndices } = MembershipManagement.Manager.selectBatchForProcessing(queue, batchSize, now);

    if (eligibleItems.length === 0) {
      MembershipManagement.Utils.log('No eligible FIFO entries to process at this time');
      try { MembershipManagement.Trigger._deleteTriggersByFunctionName('processExpirationFIFOTrigger'); } catch (e) { /* ignore */ }
      return { processed: 0, failed: 0, remaining: queue.length };
    }

    // GAS: Get configuration and initialize manager
    const scriptMaxAttempts = Common.Config.Properties.getNumberProperty('expirationMaxAttempts', 0)
                          || Common.Config.Properties.getNumberProperty('expirationMaxRetries', 0)
                          || Common.Config.Properties.getNumberProperty('maxAttempts', 0)
                          || Common.Config.Properties.getNumberProperty('maxRetries', 5);
    
    const init = this.Internal.initializeManagerData_(membershipFiddler, expiryScheduleFiddler);
    const manager = init.manager;

    // GAS: Get injected functions for side effects
    const sendEmailFun = this.Internal.getEmailSender_();
    const groupRemoveFun = this.Internal.getGroupRemover_();

    // PURE (with injected side effects): Process batch
    const result = manager.processExpiredMembers(eligibleItems, sendEmailFun, groupRemoveFun, { 
      batchSize, 
      maxAttempts: scriptMaxAttempts 
    });

    // Separate dead items from reattempt items
    const deadItems = result.failed.filter(item => item.dead);
    const reattemptItems = result.failed.filter(item => !item.dead);

    // PURE: Rebuild queue (remove succeeded/dead, keep retry items)
    const updatedQueue = MembershipManagement.Manager.rebuildQueue(
      queue,
      eligibleIndices,
      reattemptItems,
      deadItems
    );
    
    // PURE: Assign nextAttemptAt timestamps to items that will be in next batch
    const nextTriggerTime = new Date(now.getTime() + 60000).toISOString();
    const finalQueue = MembershipManagement.Manager.assignNextBatchTimestamps(
      updatedQueue,
      batchSize,
      now,
      nextTriggerTime
    );

    // GAS: Persist dead-letter items and updated queue
    if (!opts.dryRun) {
      // Persist audit log entries for DeadLetter events
      if (result.auditEntries && result.auditEntries.length > 0) {
        this.Internal.persistAuditEntries_(result.auditEntries);
      }
      
      if (deadItems.length > 0) {
        try {
          const existing = deadFiddler.getData() || [];
          // GAS: Convert ISO strings to Date objects for spreadsheet display
          const deadItemsForSheet = MembershipManagement.Utils.convertFIFOItemsToSpreadsheet(deadItems);
          deadFiddler.setData(existing.concat(deadItemsForSheet)).dumpValues();
          MembershipManagement.Utils.log(`Moved ${deadItems.length} items to ExpirationDeadLetter`);
        } catch (e) {
          console.error('Failed to persist dead-letter items', e && e.toString ? e.toString() : e);
        }
      }

      // GAS: Convert ISO strings to Date objects for spreadsheet display
      const finalQueueForSheet = MembershipManagement.Utils.convertFIFOItemsToSpreadsheet(finalQueue);
      expirationFIFO.setData(finalQueueForSheet).dumpValues();
    } else {
      MembershipManagement.Utils.log('Dry-run mode: not persisting queue or dead-letter items');
    }

    MembershipManagement.Utils.log(`Expiration FIFO: # ${queue.length} in queue, ${eligibleItems.length} in this batch, of which completed ${result.processed.length}, ${reattemptItems.length} to be retried, ${deadItems.length} marked dead, with ${finalQueue.length} still to be processed`);

    // GAS: Schedule continuation trigger if work remains
    if (!opts.dryRun) {
      if (finalQueue.length > 0) {
        try {
          // Find earliest eligible time among remaining items to optimize trigger scheduling
          // NOTE: finalQueue has no dead items (removed by rebuildQueue)
          const eligibleTimes = finalQueue
            .filter(item => item.nextAttemptAt) // Skip items without timestamp (not eligible yet)
            .map(item => new Date(item.nextAttemptAt));
          
          let minutesUntilNext = 1; // Default: check again in 1 minute
          
          if (eligibleTimes.length > 0) {
            const nextEligibleMs = Math.min(...eligibleTimes.map(d => d.getTime()));
            const msUntilNext = nextEligibleMs - now.getTime();
            minutesUntilNext = Math.max(1, Math.ceil(msUntilNext / 60000));
          }
          
          MembershipManagement.Utils.log(`Scheduling ${minutesUntilNext}-minute trigger for next eligible item`);
          MembershipManagement.Trigger._deleteTriggersByFunctionName('processExpirationFIFOTrigger');
          MembershipManagement.Trigger._createMinuteTrigger('processExpirationFIFOTrigger', minutesUntilNext);
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

    return { processed: result.processed.length, failed: reattemptItems.length, remaining: finalQueue.length };
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
  
  // Create audit logger if Audit.Logger is available
  const auditLogger = typeof Audit !== 'undefined' && Audit.Logger ? new Audit.Logger() : null;
  
  const manager = new MembershipManagement.Manager(
    Common.Data.Access.getActionSpecs(), 
    autoGroups, 
    groupManager, 
    this.getEmailSender_(),
    undefined,  // today (uses default)
    auditLogger
  );

  return { manager, membershipData, expiryScheduleData };
}

MembershipManagement.Internal.getGroupAdder_ = function () {
  if (Common.Config.Properties.getBooleanProperty('testGroupAdds', false)) {
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
  if (Common.Config.Properties.getBooleanProperty('testGroupRemoves', false)) {
    return (memberEmail, groupEmail) => MembershipManagement.Utils.log(`testGroupRemoves: true. Would have removed: `, memberEmail, ' from group:', groupEmail);
  } else {
    return (memberEmail, groupEmail) => this.removeMemberFromGroup_(memberEmail, groupEmail);
  }
}

MembershipManagement.Internal.getGroupEmailReplacer_ = function () {
  if (Common.Config.Properties.getBooleanProperty('testGroupEmailReplacements', false)) {
    return (originalEmail, newEmail) => {
      MembershipManagement.Utils.log(`testGroupEmailReplacements: true. Would have replaced: `, originalEmail, ' with:', newEmail);
      return { success: true, message: 'Test mode - no changes made.' };
    }
  } else {
    return (originalEmail, newEmail) => { 
      // Get all groups from PublicGroups spreadsheet
      const publicGroups = Common.Data.Access.getPublicGroups();
      const groupData = publicGroups.map(group => ({
        groupEmail: group.Email,
        oldEmail: originalEmail,
        newEmail: newEmail,
        status: 'Pending'
      }));
      
      // Use EmailChangeService to update groups (it also logs the change)
      // Note: EmailChangeService.handleChangeEmailInGroupsUI also updates ActiveMembers and ExpirySchedule sheets,
      // but since we're already handling those in the calling code, we only use it for group membership updates
      const results = EmailChangeService.handleChangeEmailInGroupsUI(originalEmail, newEmail, groupData);
      
      // Check for any failures
      const failures = results.filter(r => r.status === 'Failed');
      if (failures.length > 0) {
        const errMsg = failures.map(f => `${f.groupEmail}: ${f.error}`).join('; ');
        console.error(`getGroupEmailReplacer_: Errors changing email in groups: ${errMsg}`);
        return { success: false, message: `Errors updating groups: ${errMsg}` };
      }
      
      return { success: true, message: `Successfully updated email from ${originalEmail} to ${newEmail} in groups.` };
    };
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
    if (!e.message) throw e;
    if (e.message.includes("Resource Not Found")) {
      if (e.message.includes('Not Found: groupKey')) {
        const m = `Group ${groupEmail} is invalid. Check Public Groups Sheet to correct.`;
        Common.Logger.error('MembershipManagement', m)
        e.message = m;
        throw e;
      }
      Common.Logger.debug(`MembershipManagement`, `Member ${memberEmail} not found in ${groupEmail}, nothing to remove`);
      return;
    }
    e.message = `Error deleting ${memberEmail} from ${groupEmail}: ${e.message}`
    throw e;
  }
}

MembershipManagement.Internal.getEmailSender_ = function () {
  const testEmails = Common.Config.Properties.getBooleanProperty('testEmails', false);
  const domain = Common.Config.Properties.getProperty('domain', 'sc3.club');
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
    const domain = Common.Config.Properties.getProperty('domain', 'sc3.club');
    const testEmails = Common.Config.Properties.getBooleanProperty('testEmails', false);

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

/**
 * Persists audit log entries to the Audit sheet using the canonical helper
 * @param {Audit.LogEntry[]} auditEntries - Array of audit log entries to persist
 */
MembershipManagement.Internal.persistAuditEntries_ = function (auditEntries) {
  if (!auditEntries || auditEntries.length === 0) {
    return 0;
  }
  
  try {
    const auditFiddler = Common.Data.Storage.SpreadsheetManager.getFiddler('Audit');
    
    // Use the canonical persistence helper (enforces schema validation and deduplication)
    const numWritten = Audit.Persistence.persistAuditEntries(auditFiddler, auditEntries);
    
    MembershipManagement.Utils.log(`Persisted ${numWritten} audit log entries`);
    return numWritten;
  } catch (error) {
    // Log but don't throw - audit logging should not break main functionality
    console.error(`Failed to persist audit entries: ${error.message}`);
    return 0;
  }
}









