
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
    // Map generator messages into a human-readable FIFO row schema and append to ExpirationFIFO
    const expirationFIFO = Common.Data.Storage.SpreadsheetManager.getFiddler('ExpirationFIFO');
    const expirationQueue = expirationFIFO.getData() || [];

    const makeId = () => `${new Date().toISOString().replace(/[:.]/g, '')}-${Math.random().toString(16).slice(2, 8)}`;
    const nowIso = () => new Date().toISOString();

    for (const msg of newExpiredMembers) {
      // Try to enrich with member info from membershipData
      const member = membershipData.find(m => m.Email === msg.email) || {};
      const memberName = [member.First, member.Last].filter(Boolean).join(' ').trim();
      const expiryDate = member && member.Expires ? MembershipManagement.Utils.dateOnly(member.Expires).toISOString().split('T')[0] : '';

      /** @type {MembershipManagement.ExpiredMember} */
      const row = {
        id: makeId(),
        createdAt: nowIso(),
        status: 'pending',
        memberEmail: msg.email,
        memberName: memberName,
        expiryDate: expiryDate,
        actionType: msg.groups ? 'notify+remove' : 'notify-only',
        groups: msg.groups || '',
        // prefillUrl purposely omitted: email bodies are fully expanded by the generator
        emailTo: msg.email,
        emailSubject: msg.subject,
        emailBody: msg.htmlBody,
        attempts: 0,
        lastAttemptAt: '',
        lastError: '',
        nextRetryAt: '',
        maxRetries: '',
        note: ''
      };

      expirationQueue.push(row);
    }

    expirationFIFO.setData(expirationQueue).dumpValues();
    membershipFiddler.setData(membershipData).dumpValues();
    expiryScheduleFiddler.setData(expiryScheduleData).dumpValues();

    MembershipManagement.Utils.log(`Successfully appended ${newExpiredMembers.length} membership expiration plan(s) to FIFO`);
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
    const queue = expirationFIFO.getData() || [];
    if (!Array.isArray(queue) || queue.length === 0) {
      MembershipManagement.Utils.log('Expiration FIFO empty - nothing to process');
      // Ensure no leftover minute trigger
      try { MembershipManagement.Trigger._deleteTriggersByFunctionName('processExpirationFIFOTrigger'); } catch (e) { /* ignore */ }
      return { processed: 0, remaining: 0 };
    }

    // Select eligible entries (status not 'dead' and nextRetryAt is absent or in the past)
    const now = new Date();
    const eligibleIndices = [];
    for (let i = 0; i < queue.length && eligibleIndices.length < batchSize; i++) {
      const row = queue[i];
      if (!row) continue;
      if (row.status === 'dead') continue;
      if (row.nextRetryAt) {
        const next = new Date(row.nextRetryAt);
        if (isNaN(next.getTime())) {
          // malformed nextRetryAt - treat as eligible
        } else if (next > now) {
          continue; // not yet eligible
        }
      }
      eligibleIndices.push(i);
    }

    if (eligibleIndices.length === 0) {
      MembershipManagement.Utils.log('No eligible FIFO entries to process at this time');
      // ensure no leftover minute trigger
      try { MembershipManagement.Trigger._deleteTriggersByFunctionName('processExpirationFIFOTrigger'); } catch (e) { /* ignore */ }
      return { processed: 0, failed: 0, remaining: queue.length };
    }

    const batch = eligibleIndices.map(i => queue[i]);

    // Get scriptMaxRetries from Properties before building managerBatch
    const scriptMaxRetries = Number(PropertiesService.getScriptProperties().getProperty('expirationMaxRetries')) || Number(PropertiesService.getScriptProperties().getProperty('maxRetries')) || 5;

    // Normalize FIFO rows into the shape the Manager expects (email, subject, htmlBody)
    // and preserve the original FIFO id and maxRetries on each item so we can map failures back.
    const managerBatch = batch.map(item => {
      return Object.assign({}, item, {
        __fifoId: item.id,
        email: item.email || item.emailTo,
        subject: item.subject || item.emailSubject,
        htmlBody: item.htmlBody || item.emailBody,
        groups: item.groups,
        maxRetries: item.maxRetries !== undefined ? item.maxRetries : undefined
      });
    });

    // Initialize a manager instance so we can use its consumer implementation
    const membershipFiddler = Common.Data.Storage.SpreadsheetManager.getFiddler('ActiveMembers');
    const expiryScheduleFiddler = Common.Data.Storage.SpreadsheetManager.getFiddler('ExpirySchedule');
    const init = this.Internal.initializeManagerData_(membershipFiddler, expiryScheduleFiddler);
    const manager = init.manager;

    const sendEmailFun = this.Internal.getEmailSender_();
    const groupRemoveFun = this.Internal.getGroupRemover_();

    const result = manager.processExpiredMembers(managerBatch, sendEmailFun, groupRemoveFun, { batchSize, maxRetries: scriptMaxRetries });

    // Map failed manager items back into FIFO row schema so we can persist them.
    const nowIso = () => new Date().toISOString();

    // Build a map of failed items by fifo id for quick lookup.
    // The Manager is authoritative for retry/backoff and dead-letter decisions and MUST return `failedMeta`.
    // If the manager does not return `failedMeta` this is a programming error — surface it so it can be fixed.
    if (!result || !Array.isArray(result.failedMeta)) {
      throw new Error('Manager must return an array `failedMeta` describing failed items and bookkeeping');
    }
    const failedMap = {};
    const metaArr = result.failedMeta;
    metaArr.forEach(m => {
      const fid = m['__fifoId'] || m.id || null;
      const orig = batch.find(r => r.id === fid) || {};
      const attempts = m.attempts !== undefined ? m.attempts : (orig.attempts || 0) + 1;
      const row = {
        id: orig.id || fid || `${new Date().toISOString().replace(/[:.]/g, '')}-${Math.random().toString(16).slice(2, 8)}`,
        createdAt: orig.createdAt || m.createdAt || nowIso(),
        status: orig.status || 'pending',
        memberEmail: orig.memberEmail || m.memberEmail || m.email || orig.emailTo || '',
        memberName: orig.memberName || '',
        expiryDate: orig.expiryDate || '',
        actionType: orig.actionType || '',
        groups: m.groups !== undefined ? m.groups : (orig.groups || ''),
        emailTo: m.email,
        emailSubject: m.subject,
        emailBody: m.htmlBody,
        attempts: attempts,
        lastAttemptAt: m.lastAttemptAt || nowIso(),
        lastError: m.lastError || '',
        nextRetryAt: m.nextRetryAt || '',
        maxRetries: orig.maxRetries !== undefined ? orig.maxRetries : scriptMaxRetries,
        note: orig.note || ''
      };
      failedMap[row.id] = { row, dead: !!m.dead };
    });

    // Rebuild queue by replacing processed items with updated failed rows (or removing succeeded ones)
    const deadLetterRows = [];
    const updatedQueue = [];
    for (let i = 0; i < queue.length; i++) {
      if (eligibleIndices.includes(i)) {
        const orig = queue[i];
        const fid = orig.id;
        const failedEntry = failedMap[fid];
        if (failedEntry) {
          if (failedEntry.dead) {
            // move to dead letter
            const dlRow = Object.assign({}, failedEntry.row, { status: 'dead' });
            deadLetterRows.push(dlRow);
            // do not re-add to queue
          } else {
            updatedQueue.push(failedEntry.row);
          }
        } else {
          // success - do not re-add to queue (work completed)
        }
      } else {
        // untouched row - keep as-is
        updatedQueue.push(queue[i]);
      }
    }

    // Persist dead-letter rows and updated queue, unless running in dryRun mode
    if (!opts.dryRun) {
      if (deadLetterRows.length > 0) {
        try {
          const deadFiddler = Common.Data.Storage.SpreadsheetManager.getFiddler('ExpirationDeadLetter');
          const existing = deadFiddler.getData() || [];
          deadFiddler.setData(existing.concat(deadLetterRows)).dumpValues();
          MembershipManagement.Utils.log(`Moved ${deadLetterRows.length} rows to ExpirationDeadLetter`);
        } catch (e) {
          console.error('Failed to persist dead-letter rows', e && e.toString ? e.toString() : e);
        }
      }

      expirationFIFO.setData(updatedQueue).dumpValues();
    } else {
      MembershipManagement.Utils.log('Dry-run mode enabled: not persisting updated queue or dead-letter rows');
    }

    const failedCount = Object.values(failedMap).filter(x => !x.dead).length;
    MembershipManagement.Utils.log(`Expiration FIFO: processed ${eligibleIndices.length}, failed ${failedCount}, dead ${deadLetterRows.length}, remaining ${updatedQueue.length}`);

    // If there is more work, schedule a minute trigger to continue processing (unless dryRun)
    if (!opts.dryRun) {
      if (updatedQueue.length > 0) {
        try {
          MembershipManagement.Utils.log('Scheduling 1-minute consumer trigger to continue processing');
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

    return { processed: eligibleIndices.length, failed: failedCount, remaining: updatedQueue.length };
  } catch (error) {
    const errorMessage = `Expiration FIFO consumer failed: ${error.message}`;
    MembershipManagement.Utils.log(`ERROR: ${errorMessage}`);
    console.error(`${errorMessage}\nStack trace: ${error.stack}`);
    // Notify operators but do not re-throw (consumer runs from a trigger)
    try { this.Internal.sendExpirationErrorNotification_(error); } catch (e) { console.error('Failed to send expiration error notification', e); }
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









