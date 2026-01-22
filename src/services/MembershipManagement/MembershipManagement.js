
MembershipManagement.convertJoinToRenew = function (rowAIndex, rowBIndex) {
  // Use SpreadsheetApp + ValidatedMember for ActiveMembers
  const membershipSheet = Common.Data.Storage.SpreadsheetManager.getSheet('ActiveMembers');
  const allMembershipData = membershipSheet.getDataRange().getValues();
  const membershipHeaders = allMembershipData[0];
  const originalMembershipRows = allMembershipData.slice(1);
  const membershipData = Common.Data.ValidatedMember.validateRows(
    originalMembershipRows,
    membershipHeaders,
    'MembershipManagement.convertJoinToRenew'
  );
  
  const expiryFiddler = Common.Data.Storage.SpreadsheetManager.getFiddler('ExpirySchedule');
  const expiryScheduleData = expiryFiddler.getData();
  
  //@ts-ignore
  const autoGroups = Common.Data.Access.getPublicGroups().filter(group => group.Subscription.toLowerCase() === 'auto');
  const groupManager = {
    groupAddFun: MembershipManagement.Internal.getGroupAdder_(),
    groupRemoveFun: MembershipManagement.Internal.getGroupRemover_(),
    groupEmailReplaceFun: MembershipManagement.Internal.getGroupEmailReplacer_()
  }
  
  // Create audit logger if AuditLogger is available
  const auditLogger = typeof AuditLogger !== 'undefined' ? new AuditLogger() : null;
  
  const manager = new MembershipManagement.Manager(
    Common.Data.Access.getActionSpecs(), 
    autoGroups, 
    groupManager, 
    MembershipManagement.Internal.getEmailSender_(),
    undefined,  // today (uses default)
    auditLogger
  );
  
  const result = manager.convertJoinToRenew(rowAIndex, rowBIndex, membershipData, expiryScheduleData);
  if (result.success) {
    // Write ActiveMembers using selective cell updates
    const changeCount = Common.Data.MemberPersistence.writeChangedCells(
      membershipSheet,
      originalMembershipRows,
      membershipData,
      membershipHeaders
    );
    Common.Logger.info('MembershipManagement', `convertJoinToRenew: Updated ${changeCount} cells in ActiveMembers`);
    
    expiryFiddler.setData(expiryScheduleData).dumpValues();
  }
  return result
}

MembershipManagement.processTransactions = function () {
  Common.Data.Storage.SpreadsheetManager.convertLinks('Transactions');
  const transactionsFiddler = Common.Data.Storage.SpreadsheetManager.getFiddler('Transactions').needFormulas();
  const transactions = Common.Data.Storage.SpreadsheetManager.getDataWithFormulas(transactionsFiddler);
  if (transactions.length === 0) { 
    Common.Logger.info('MembershipManagement', 'No transactions to process');
    return { processed: 0, joins: 0, renewals: 0, hasPendingPayments: false, errors: [] }; 
  }

  // Use SpreadsheetApp + ValidatedMember for ActiveMembers
  const init = MembershipManagement.Internal.initializeManagerDataWithSpreadsheetApp_();
  const { manager, membershipData, expiryScheduleData, membershipSheet, originalMembershipRows, membershipHeaders, expiryScheduleFiddler } = init;

  const { recordsChanged, hasPendingPayments, errors, auditEntries } = manager.processPaidTransactions(transactions, membershipData, expiryScheduleData);
  if (recordsChanged) {
    transactionsFiddler.setData(transactions).dumpValues();
    
    // Write ActiveMembers using selective cell updates
    const changeCount = Common.Data.MemberPersistence.writeChangedCells(
      membershipSheet,
      originalMembershipRows,
      membershipData,
      membershipHeaders
    );
    Common.Logger.info('MembershipManagement', `processTransactions: Updated ${changeCount} cells in ActiveMembers`);
    
    expiryScheduleFiddler.setData(expiryScheduleData).dumpValues();
  }
  
  // Count operation types from audit entries
  const joins = auditEntries ? auditEntries.filter(e => e.Type === 'Join' && e.Outcome === 'success').length : 0;
  const renewals = auditEntries ? auditEntries.filter(e => e.Type === 'Renew' && e.Outcome === 'success').length : 0;
  const processed = joins + renewals;
  
  // Persist audit log entries
  if (auditEntries && auditEntries.length > 0) {
    MembershipManagement.Internal.persistAuditEntries_(auditEntries);
  }
  
  // Log comprehensive summary
  Common.Logger.info('MembershipManagement', 'Transaction processing completed', {
    processed,
    joins,
    renewals,
    errors: errors.length,
    hasPendingPayments
  });
  
  errors.forEach(e => Common.Logger.error('MembershipManagement', `Transaction on row ${e.txnNumber} ${e.email} had an error: ${e.message}`, { stack: e.stack }));
  return { processed, joins, renewals, hasPendingPayments, errors };
}

MembershipManagement.processMigrations = function () {
  const migratingMembersFiddler = Common.Data.Storage.SpreadsheetManager.getFiddler('MigratingMembers').needFormulas();
  const migratingMembers = Common.Data.Storage.SpreadsheetManager.getDataWithFormulas(migratingMembersFiddler);
  if (migratingMembers.length === 0) { return; }

  // Use SpreadsheetApp + ValidatedMember for ActiveMembers
  const init = MembershipManagement.Internal.initializeManagerDataWithSpreadsheetApp_();
  const { manager, membershipData, expiryScheduleData, membershipSheet, originalMembershipRows, membershipHeaders, expiryScheduleFiddler } = init;
  const mdLength = membershipData.length;
  const esdLength = expiryScheduleData.length;

  let auditEntries = [];
  const result = manager.migrateCEMembers(migratingMembers, membershipData, expiryScheduleData);
  auditEntries = result.auditEntries || [];
  
  // Log any errors that occurred during migration
  if (result.errors && result.errors.length > 0) {
    result.errors.forEach(e => Common.Logger.error('MembershipManagement', `Migration error on row ${e.rowNum} ${e.email}: ${e.message}`, { stack: e.stack }));
  }
  
  if (PropertiesService.getScriptProperties().getProperty('MIGRATION_LOG_ONLY').toLowerCase() === 'true') {
    Common.Logger.info('MembershipManagement', `logOnly - # newMembers added: ${membershipData.length - mdLength} - #expirySchedule entries added: ${expiryScheduleData.length - esdLength}`);
    return;
  }
  
  // Persist audit log entries
  if (auditEntries && auditEntries.length > 0) {
    MembershipManagement.Internal.persistAuditEntries_(auditEntries);
  }
  
  migratingMembersFiddler.setData(migratingMembers).dumpValues();
  
  // Write ActiveMembers using selective cell updates OR append new rows
  // Check if new members were added
  if (membershipData.length > originalMembershipRows.length) {
    // New members added - need to append rows
    const newMembers = membershipData.slice(originalMembershipRows.length);
    const newRows = newMembers.map(m => m.toArray());
    const startRow = membershipSheet.getLastRow() + 1;
    membershipSheet.getRange(startRow, 1, newRows.length, membershipHeaders.length).setValues(newRows);
    Common.Logger.info('MembershipManagement', `processMigrations: Appended ${newRows.length} new members to ActiveMembers`);
    
    // Update existing rows with selective cell updates
    const existingMembers = membershipData.slice(0, originalMembershipRows.length);
    const changeCount = Common.Data.MemberPersistence.writeChangedCells(
      membershipSheet,
      originalMembershipRows,
      existingMembers,
      membershipHeaders
    );
    Common.Logger.info('MembershipManagement', `processMigrations: Updated ${changeCount} cells in existing members`);
  } else {
    // Only updates to existing members - use selective cell updates
    const changeCount = Common.Data.MemberPersistence.writeChangedCells(
      membershipSheet,
      originalMembershipRows,
      membershipData,
      membershipHeaders
    );
    Common.Logger.info('MembershipManagement', `processMigrations: Updated ${changeCount} cells in ActiveMembers`);
  }
  
  expiryScheduleFiddler.setData(expiryScheduleData).dumpValues();
}

MembershipManagement.generateExpiringMembersList = function () {
  try {
    Common.Logger.info('MembershipManagement', 'Starting membership expiration processing...');

    // Use SpreadsheetApp + ValidatedMember for ActiveMembers
    const init = MembershipManagement.Internal.initializeManagerDataWithSpreadsheetApp_();
    const { manager, membershipData, expiryScheduleData, membershipSheet, originalMembershipRows, membershipHeaders, expiryScheduleFiddler } = init;
    
    // Get ExpirationFIFO fiddler
    const expirationFIFO = Common.Data.Storage.SpreadsheetManager.getFiddler('ExpirationFIFO');
    const prefillFormTemplate = Common.Config.Properties.getProperty('PREFILL_FORM_TEMPLATE');
    if (!prefillFormTemplate) {
      throw new Error("PREFILL_FORM_TEMPLATE property is not set.");
    }
    const result = manager.generateExpiringMembersList(membershipData, expiryScheduleData, prefillFormTemplate);

    if (result.messages.length === 0) {
      Common.Logger.info('MembershipManagement', 'No memberships required expiration processing');
      return { addedToQueue: 0, scheduleEntriesProcessed: 0 };
    }
    
    // Map generator messages into FIFOItem objects and append to ExpirationFIFO
    const expirationQueue = expirationFIFO.getData() || [];
    const initialQueueLength = expirationQueue.length;

    const makeId = () => `${new Date().toISOString().replace(/[:.]/g, '')}-${Math.random().toString(16).slice(2, 8)}`;
    
    // Count by expiry type for detailed logging
    const expiryTypeCounts = {};

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
      
      // Count expiry types (extract from subject like "Expiry1", "Expiry2", etc.)
      const expiryTypeMatch = msg.subject.match(/Expiry(\d)/);
      if (expiryTypeMatch) {
        const expiryType = expiryTypeMatch[0];
        expiryTypeCounts[expiryType] = (expiryTypeCounts[expiryType] || 0) + 1;
      }
    }

    expirationFIFO.setData(expirationQueue).dumpValues();
    
    // Write ActiveMembers using selective cell updates
    const changeCount = Common.Data.MemberPersistence.writeChangedCells(
      membershipSheet,
      originalMembershipRows,
      membershipData,
      membershipHeaders
    );
    Common.Logger.info('MembershipManagement', `generateExpiringMembersList: Updated ${changeCount} cells in ActiveMembers`);
    
    expiryScheduleFiddler.setData(expiryScheduleData).dumpValues();
    
    const addedToQueue = result.messages.length;
    const scheduleEntriesProcessed = result.scheduleEntriesProcessed || result.messages.length;
    
    // Create audit entry for this operation
    const auditLogger = new AuditLogger();
    const auditEntry = auditLogger.createLogEntry({
      type: 'ProcessExpirations',
      outcome: 'success',
      note: `Generated ${addedToQueue} expiration queue items from schedule`,
      error: '',
      jsonData: { addedToQueue, scheduleEntriesProcessed, expiryTypeCounts }
    });
    MembershipManagement.Internal.persistAuditEntries_([auditEntry]);

    // Log comprehensive summary
    Common.Logger.info('MembershipManagement', 'Expiration processing completed', {
      addedToQueue,
      scheduleEntriesProcessed,
      queueLengthBefore: initialQueueLength,
      queueLengthAfter: expirationQueue.length,
      expiryTypeCounts
    });
    
    // If we added items to the queue, schedule a trigger to start processing
    // CRITICAL: Do NOT call processExpirationFIFO synchronously here!
    // That would cause race conditions with existing triggers processing the same items.
    // Instead, delete any existing trigger and schedule a fresh one.
    if (result.messages.length > 0) {
      try {
        Common.Logger.info('MembershipManagement', 'Scheduling immediate processing trigger for queue items');
        MembershipManagement.Trigger._deleteTriggersByFunctionName('processExpirationFIFOTrigger');
        MembershipManagement.Trigger._createMinuteTrigger('processExpirationFIFOTrigger', 1);
      } catch (e) {
        Common.Logger.error('MembershipManagement', 'Failed to schedule expiration processing trigger', { error: String(e) });
        // CRITICAL: Try to create trigger even if delete failed - orphaned queue is worse than duplicate trigger
        try {
          MembershipManagement.Trigger._createMinuteTrigger('processExpirationFIFOTrigger', 1);
          Common.Logger.info('MembershipManagement', 'Trigger created on retry after delete failure');
        } catch (retryError) {
          Common.Logger.error('MembershipManagement', 'CRITICAL: Failed to create trigger on retry - queue may be orphaned!', { error: String(retryError) });
          // Send notification about orphaned queue
          try {
            MembershipManagement.Internal.sendOrphanedQueueNotification_(retryError, result.messages.length);
          } catch (notifyError) {
            Common.Logger.error('MembershipManagement', 'Failed to send orphaned queue notification', { error: String(notifyError) });
          }
        }
      }
    }
    
    return { addedToQueue, scheduleEntriesProcessed, expiryTypeCounts };
  } catch (error) {
    const errorMessage = `Membership expiration processing failed: ${error.message}`;
    Common.Logger.error('MembershipManagement', errorMessage, { stack: error.stack });

    // Send email notification to membership automation
    MembershipManagement.Internal.sendExpirationErrorNotification_(error);

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
    Common.Logger.info('MembershipManagement', 'Starting Expiration FIFO consumer...');
    const batchSize = opts.batchSize || Common.Config.Properties.getNumberProperty('expirationBatchSize', 50);

    // GAS: Get fiddlers (leverages per-execution caching)
    const expirationFIFO = opts.fiddlers?.expirationFIFO || Common.Data.Storage.SpreadsheetManager.getFiddler('ExpirationFIFO');
    const expiryScheduleFiddler = opts.fiddlers?.expiryScheduleFiddler || Common.Data.Storage.SpreadsheetManager.getFiddler('ExpirySchedule');
    const deadFiddler = opts.fiddlers?.deadFiddler || Common.Data.Storage.SpreadsheetManager.getFiddler('ExpirationDeadLetter');
    
    // Load or use pre-loaded membership data using SpreadsheetApp
    let membershipSheet, originalMembershipRows, membershipHeaders;
    if (opts.membershipData) {
      membershipSheet = opts.membershipData.sheet;
      originalMembershipRows = opts.membershipData.originalRows;
      membershipHeaders = opts.membershipData.headers;
    } else {
      membershipSheet = Common.Data.Storage.SpreadsheetManager.getSheet('ActiveMembers');
      const allMembershipData = membershipSheet.getDataRange().getValues();
      membershipHeaders = allMembershipData[0];
      originalMembershipRows = allMembershipData.slice(1);
    }
    
    // GAS: Get queue and convert spreadsheet Date objects to ISO strings for pure function processing
    const rawQueue = expirationFIFO.getData() || [];
    /** @type {MembershipManagement.FIFOItem[]} */
    const queue = MembershipManagement.Utils.convertFIFOItemsFromSpreadsheet(rawQueue);
    
    if (!Array.isArray(queue) || queue.length === 0) {
      Common.Logger.info('MembershipManagement', 'Expiration FIFO empty - nothing to process');
      try { MembershipManagement.Trigger._deleteTriggersByFunctionName('processExpirationFIFOTrigger'); } catch (e) { /* ignore */ }
      return { processed: 0, remaining: 0 };
    }

    // PURE: Select eligible items for current batch
    const now = new Date();
    const { eligibleItems, eligibleIndices } = MembershipManagement.Manager.selectBatchForProcessing(queue, batchSize, now);

    if (eligibleItems.length === 0) {
      Common.Logger.info('MembershipManagement', 'No eligible FIFO entries to process at this time');
      try { MembershipManagement.Trigger._deleteTriggersByFunctionName('processExpirationFIFOTrigger'); } catch (e) { /* ignore */ }
      return { processed: 0, failed: 0, remaining: queue.length };
    }

    // GAS: Get configuration and initialize manager with SpreadsheetApp data
    const scriptMaxAttempts = Common.Config.Properties.getNumberProperty('expirationMaxAttempts', 0)
                          || Common.Config.Properties.getNumberProperty('expirationMaxRetries', 0)
                          || Common.Config.Properties.getNumberProperty('maxAttempts', 0)
                          || Common.Config.Properties.getNumberProperty('maxRetries', 5);
    
    // Load membership data using SpreadsheetApp + ValidatedMember (if not already loaded)
    const membershipData = Common.Data.ValidatedMember.validateRows(
      originalMembershipRows,
      membershipHeaders,
      'MembershipManagement.processExpirationFIFO'
    );
    const expiryScheduleData = expiryScheduleFiddler.getData();
    
    //@ts-ignore
    const autoGroups = Common.Data.Access.getPublicGroups().filter(group => group.Subscription.toLowerCase() === 'auto');
    const groupManager = {
      groupAddFun: MembershipManagement.Internal.getGroupAdder_(),
      groupRemoveFun: MembershipManagement.Internal.getGroupRemover_(),
      groupEmailReplaceFun: MembershipManagement.Internal.getGroupEmailReplacer_()
    }
    
    // Create audit logger if AuditLogger is available
    const auditLogger = typeof AuditLogger !== 'undefined' ? new AuditLogger() : null;
    
    const manager = new MembershipManagement.Manager(
      Common.Data.Access.getActionSpecs(), 
      autoGroups, 
      groupManager, 
      MembershipManagement.Internal.getEmailSender_(),
      undefined,  // today (uses default)
      auditLogger
    );

    // GAS: Get injected functions for side effects
    const sendEmailFun = MembershipManagement.Internal.getEmailSender_();
    const groupRemoveFun = MembershipManagement.Internal.getGroupRemover_();

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
        MembershipManagement.Internal.persistAuditEntries_(result.auditEntries);
      }
      
      if (deadItems.length > 0) {
        try {
          const existing = deadFiddler.getData() || [];
          // GAS: Convert ISO strings to Date objects for spreadsheet display
          const deadItemsForSheet = MembershipManagement.Utils.convertFIFOItemsToSpreadsheet(deadItems);
          deadFiddler.setData(existing.concat(deadItemsForSheet)).dumpValues();
          Common.Logger.info('MembershipManagement', `Moved ${deadItems.length} items to ExpirationDeadLetter`);
        } catch (e) {
          Common.Logger.error('MembershipManagement', 'Failed to persist dead-letter items', { error: String(e) });
        }
      }

      // GAS: Convert ISO strings to Date objects for spreadsheet display
      const finalQueueForSheet = MembershipManagement.Utils.convertFIFOItemsToSpreadsheet(finalQueue);
      expirationFIFO.setData(finalQueueForSheet).dumpValues();
    } else {
      Common.Logger.info('MembershipManagement', 'Dry-run mode: not persisting queue or dead-letter items');
    }

    Common.Logger.info('MembershipManagement', `Expiration FIFO: # ${queue.length} in queue, ${eligibleItems.length} in this batch, of which completed ${result.processed.length}, ${reattemptItems.length} to be retried, ${deadItems.length} marked dead, with ${finalQueue.length} still to be processed`);

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
          
          Common.Logger.info('MembershipManagement', `Scheduling ${minutesUntilNext}-minute trigger for next eligible item`);
          MembershipManagement.Trigger._deleteTriggersByFunctionName('processExpirationFIFOTrigger');
          MembershipManagement.Trigger._createMinuteTrigger('processExpirationFIFOTrigger', minutesUntilNext);
        } catch (e) {
          Common.Logger.error('MembershipManagement', 'Error scheduling expiration FIFO trigger', { error: String(e) });
          // DEFENSIVE: If scheduling failed but queue has work, try to create a basic 1-minute trigger
          // Better to process slowly than leave queue orphaned
          try {
            MembershipManagement.Trigger._createMinuteTrigger('processExpirationFIFOTrigger', 1);
            Common.Logger.info('MembershipManagement', 'Created fallback 1-minute trigger after scheduling error');
          } catch (retryError) {
            Common.Logger.error('MembershipManagement', 'CRITICAL: Failed to create fallback trigger - queue orphaned!', { error: String(retryError) });
            // Send notification about orphaned queue
            try {
              MembershipManagement.Internal.sendOrphanedQueueNotification_(retryError, finalQueue.length);
            } catch (notifyError) {
              Common.Logger.error('MembershipManagement', 'Failed to send orphaned queue notification', { error: String(notifyError) });
            }
          }
        }
      } else {
        // No more work - remove any existing minute trigger
        try { MembershipManagement.Trigger._deleteTriggersByFunctionName('processExpirationFIFOTrigger'); } catch (e) { /* ignore */ }
      }
    } else {
      Common.Logger.info('MembershipManagement', 'Dry-run mode enabled: not scheduling or deleting triggers');
    }

    return { processed: result.processed.length, failed: reattemptItems.length, remaining: finalQueue.length };
  } catch (error) {
    const errorMessage = `Expiration FIFO consumer failed: ${error.message}`;
    Common.Logger.error('MembershipManagement', errorMessage, { stack: error.stack });
    
    // DEFENSIVE: On catastrophic failure, delete trigger to prevent infinite retry loop
    // Queue will need manual intervention, but at least we won't spam errors every minute
    if (!opts.dryRun) {
      try {
        Common.Logger.info('MembershipManagement', 'Deleting trigger due to catastrophic failure');
        MembershipManagement.Trigger._deleteTriggersByFunctionName('processExpirationFIFOTrigger');
      } catch (triggerError) {
        Common.Logger.error('MembershipManagement', 'Failed to delete trigger after catastrophic failure', { error: String(triggerError) });
      }
    }
    
    try { 
      MembershipManagement.Internal.sendCatastrophicFailureNotification_(error, opts.batchSize || 50); 
    } catch (e) { 
      Common.Logger.error('MembershipManagement', 'Failed to send error notification', { error: String(e) }); 
    }
    return { processed: 0, failed: 0, remaining: -1, error: errorMessage };
  }
}

// Top-level trigger wrapper which the ScriptApp trigger should call
function processExpirationFIFOTrigger() { return MembershipManagement.processExpirationFIFO(); }

/**
 * Initialize Manager with data loaded via SpreadsheetApp + ValidatedMember
 * @returns {{manager, membershipData: ValidatedMember[], expiryScheduleData, membershipSheet, originalMembershipRows, membershipHeaders}}
 */
MembershipManagement.Internal.initializeManagerDataWithSpreadsheetApp_ = function () {
  // Load ActiveMembers using SpreadsheetApp + ValidatedMember
  const membershipSheet = Common.Data.Storage.SpreadsheetManager.getSheet('ActiveMembers');
  const allMembershipData = membershipSheet.getDataRange().getValues();
  const membershipHeaders = allMembershipData[0];
  const originalMembershipRows = allMembershipData.slice(1);
  const membershipData = Common.Data.ValidatedMember.validateRows(
    originalMembershipRows,
    membershipHeaders,
    'MembershipManagement.initializeManagerData'
  );
  
  // Load ExpirySchedule using fiddler (not migrating this sheet in this phase)
  const expiryScheduleFiddler = Common.Data.Storage.SpreadsheetManager.getFiddler('ExpirySchedule');
  const expiryScheduleData = expiryScheduleFiddler.getData();
  
  //@ts-ignore
  const autoGroups = Common.Data.Access.getPublicGroups().filter(group => group.Subscription.toLowerCase() === 'auto');
  const groupManager = {
    groupAddFun: MembershipManagement.Internal.getGroupAdder_(),
    groupRemoveFun: MembershipManagement.Internal.getGroupRemover_(),
    groupEmailReplaceFun: MembershipManagement.Internal.getGroupEmailReplacer_()
  }
  
  // Create audit logger if AuditLogger is available
  const auditLogger = typeof AuditLogger !== 'undefined' ? new AuditLogger() : null;
  
  const manager = new MembershipManagement.Manager(
    Common.Data.Access.getActionSpecs(), 
    autoGroups, 
    groupManager, 
    MembershipManagement.Internal.getEmailSender_(),
    undefined,  // today (uses default)
    auditLogger
  );

  return { 
    manager, 
    membershipData, 
    expiryScheduleData,
    membershipSheet,
    originalMembershipRows,
    membershipHeaders,
    expiryScheduleFiddler
  };
}

/**
 * Legacy function - delegates to fiddler-based implementation
 * @deprecated Use initializeManagerDataWithSpreadsheetApp_ for new code
 */
MembershipManagement.Internal.initializeManagerData_ = function (membershipFiddler, expiryScheduleFiddler,) {
  const membershipData = membershipFiddler.getData();
  const expiryScheduleData = expiryScheduleFiddler.getData();
  //@ts-ignore
  const autoGroups = Common.Data.Access.getPublicGroups().filter(group => group.Subscription.toLowerCase() === 'auto');
  const groupManager = {
    groupAddFun: MembershipManagement.Internal.getGroupAdder_(),
    groupRemoveFun: MembershipManagement.Internal.getGroupRemover_(),
    groupEmailReplaceFun: MembershipManagement.Internal.getGroupEmailReplacer_()
  }
  
  // Create audit logger if AuditLogger is available
  const auditLogger = typeof AuditLogger !== 'undefined' ? new AuditLogger() : null;
  
  const manager = new MembershipManagement.Manager(
    Common.Data.Access.getActionSpecs(), 
    autoGroups, 
    groupManager, 
    MembershipManagement.Internal.getEmailSender_(),
    undefined,  // today (uses default)
    auditLogger
  );

  return { manager, membershipData, expiryScheduleData };
}

MembershipManagement.Internal.getGroupAdder_ = function () {
  if (Common.Config.Properties.getBooleanProperty('testGroupAdds', false)) {
    return (memberEmail, groupEmail) => Common.Logger.info('MembershipManagement', `testGroupAdds: true. Would have added: ${memberEmail} to group: ${groupEmail}`);
  } else {
    return (memberEmail, groupEmail) => MembershipManagement.Internal.addMemberToGroup_(memberEmail, groupEmail);
  }
}

/**
 * Get the group removal function
 * @returns function(memberEmail: string, groupEmail: string): void 
 */
MembershipManagement.Internal.getGroupRemover_ = function () {
  if (Common.Config.Properties.getBooleanProperty('testGroupRemoves', false)) {
    return (memberEmail, groupEmail) => Common.Logger.info('MembershipManagement', `testGroupRemoves: true. Would have removed: ${memberEmail} from group: ${groupEmail}`);
  } else {
    return (memberEmail, groupEmail) => MembershipManagement.Internal.removeMemberFromGroup_(memberEmail, groupEmail);
  }
}

MembershipManagement.Internal.getGroupEmailReplacer_ = function () {
  if (Common.Config.Properties.getBooleanProperty('testGroupEmailReplacements', false)) {
    return (originalEmail, newEmail) => {
      Common.Logger.info('MembershipManagement', `testGroupEmailReplacements: true. Would have replaced: ${originalEmail} with: ${newEmail}`);
      return { success: true, message: 'Test mode - no changes made.' };
    }
  } else {
    return (originalEmail, newEmail) => { return MembershipManagement.Internal.changeSubscribersEmailInAllGroups_(originalEmail, newEmail) };
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
      Common.Logger.error('MembershipManagement', `Error changing email in group ${groupEmail}`, { error: String(e) });
    }
  }
  if (errors.length > 0) {
    let errMsg = `Errors while updating ${originalEmail} to ${newEmail} in groups: ${errors.join('; ')}`;
    Common.Logger.error('MembershipManagement', errMsg);
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
    Common.Logger.info('MembershipManagement', `Successfully added ${memberEmail} to ${groupEmail}`);
  } catch (e) {
    if (e.message && e.message.includes("Member already exists")) {
      Common.Logger.info('MembershipManagement', `Member ${memberEmail} already exists in ${groupEmail}`);
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
    Common.Logger.info('MembershipManagement', `Successfully removed ${memberEmail} from ${groupEmail}`);
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
      Common.Logger.info('MembershipManagement', 'testEmails is set to true - logging only', { email });
    } else {
      MembershipManagement.Internal.sendSingleEmail_(email);
    }
  };
}

MembershipManagement.Internal.sendSingleEmail_ = function (email) {
  Common.Logger.info('MembershipManagement', 'Email Sent', { to: email.to, subject: email.subject });
  try {
    MailApp.sendEmail(email);
    return { Timestamp: new Date(), ...email };
  } catch (error) {
    Common.Logger.error('MembershipManagement', `Failed to send email to ${email.to}: ${error.message}`);
  }
}

/**
 * Send notification when queue is orphaned (no trigger created)
 * @param {Error} error - The error that caused trigger creation to fail
 * @param {number} queueSize - Number of items in orphaned queue
 */
MembershipManagement.Internal.sendOrphanedQueueNotification_ = function (error, queueSize) {
  try {
    const domain = Common.Config.Properties.getProperty('domain', 'sc3.club');
    const testEmails = Common.Config.Properties.getBooleanProperty('testEmails', false);

    const email = {
      to: `membership-automation@${domain}`,
      subject: `🚨 CRITICAL: Expiration Queue Orphaned - ${queueSize} Items Need Processing`,
      htmlBody: `
        <h2 style="color: #d32f2f;">🚨 CRITICAL: Queue Orphaned</h2>
        <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>Queue Size:</strong> ${queueSize} items waiting to be processed</p>
        <p><strong>Error:</strong> Failed to create processing trigger</p>
        <p><strong>Details:</strong> ${error.message}</p>
        
        <h3 style="color: #d32f2f;">IMMEDIATE ACTION REQUIRED</h3>
        <p>The expiration queue has items but NO TRIGGER exists to process them. Members will NOT receive expiration notifications until this is fixed.</p>
        
        <h4>Recovery Steps:</h4>
        <ol>
          <li>Open Apps Script editor for SCCCC Membership Management</li>
          <li>Check current trigger count: <code>ScriptApp.getProjectTriggers().length</code> (max is 20)</li>
          <li>If at quota limit, delete unused triggers</li>
          <li>Manually create trigger:
            <pre style="background: #f5f5f5; padding: 10px;">
MembershipManagement.Trigger._deleteTriggersByFunctionName('processExpirationFIFOTrigger');
MembershipManagement.Trigger._createMinuteTrigger('processExpirationFIFOTrigger', 1);</pre>
          </li>
          <li>Verify processing resumes by checking System Logs for "ProcessExpiredMember" entries</li>
        </ol>
        
        <h4>Root Cause Investigation:</h4>
        <ul>
          <li>Check trigger quota (max 20 per script)</li>
          <li>Verify script permissions are intact</li>
          <li>Check for GAS service disruptions: <a href="https://www.google.com/appsstatus">Apps Status Dashboard</a></li>
          <li>Review System Logs for additional error context</li>
        </ul>
        
        <p><strong>Stack Trace:</strong></p>
        <pre style="background: #f5f5f5; padding: 10px; font-size: 11px;">${error.stack}</pre>
        
        <p><em>This is an automated CRITICAL alert from the SCCCC Membership Management System.</em></p>
      `,
      noReply: true
    };

    if (testEmails) {
      Common.Logger.info('MembershipManagement', 'testEmails: true - Orphaned queue notification (test mode)', { email });
    } else {
      MailApp.sendEmail(email);
    }
  } catch (e) {
    Common.Logger.error('MembershipManagement', `Failed to send orphaned queue notification: ${e.message}`);
  }
}

/**
 * Send notification for catastrophic processing failures
 * @param {Error} error - The catastrophic error
 * @param {number} batchSize - Batch size being processed when failure occurred
 */
MembershipManagement.Internal.sendCatastrophicFailureNotification_ = function (error, batchSize) {
  try {
    const domain = Common.Config.Properties.getProperty('domain', 'sc3.club');
    const testEmails = Common.Config.Properties.getBooleanProperty('testEmails', false);

    const email = {
      to: `membership-automation@${domain}`,
      subject: `🚨 Expiration Processing Catastrophic Failure - Trigger Auto-Deleted`,
      htmlBody: `
        <h2 style="color: #d32f2f;">🚨 Catastrophic Processing Failure</h2>
        <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>Error:</strong> ${error.message}</p>
        <p><strong>Action Taken:</strong> Processing trigger has been automatically deleted to prevent error loops</p>
        
        <h3 style="color: #ff6f00;">What Happened</h3>
        <p>The expiration queue processor encountered a fatal error and threw an exception. To prevent infinite retry loops and error spam, the processing trigger has been automatically deleted. The queue will NOT be processed until you manually restart it after fixing the root cause.</p>
        
        <h4>Recovery Steps:</h4>
        <ol>
          <li>Investigate the root cause:
            <ul>
              <li><strong>Spreadsheet corruption:</strong> Check ExpirationFIFO sheet for data integrity</li>
              <li><strong>Permission loss:</strong> Verify script has necessary permissions (Mail, Groups, Drive)</li>
              <li><strong>Data format error:</strong> Check for malformed data in queue items</li>
              <li><strong>Quota exceeded:</strong> Check GAS quotas (email, API calls)</li>
            </ul>
          </li>
          <li>Fix the identified issue</li>
          <li>Check ExpirationFIFO sheet - may need manual cleanup</li>
          <li>Restart processing:
            <pre style="background: #f5f5f5; padding: 10px;">
MembershipManagement.Trigger._createMinuteTrigger('processExpirationFIFOTrigger', 1);</pre>
          </li>
          <li>Monitor System Logs to confirm processing resumes successfully</li>
        </ol>
        
        <h4>Context:</h4>
        <ul>
          <li><strong>Batch Size:</strong> ${batchSize} items per run</li>
          <li><strong>Time:</strong> ${new Date().toISOString()}</li>
          <li><strong>Environment:</strong> ${Session.getActiveUser().getEmail() || 'Unknown'}</li>
        </ul>
        
        <p><strong>Stack Trace:</strong></p>
        <pre style="background: #f5f5f5; padding: 10px; font-size: 11px;">${error.stack}</pre>
        
        <p><em>This is an automated CRITICAL alert from the SCCCC Membership Management System.</em></p>
      `,
      noReply: true
    };

    if (testEmails) {
      Common.Logger.info('MembershipManagement', 'testEmails: true - Catastrophic failure notification (test mode)', { email });
    } else {
      MailApp.sendEmail(email);
    }
  } catch (e) {
    Common.Logger.error('MembershipManagement', `Failed to send catastrophic failure notification: ${e.message}`);
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
      noReply: true
    };

    if (testEmails) {
      Common.Logger.info('MembershipManagement', 'testEmails is set to true - logging error notification only', { email });
    } else {
      MailApp.sendEmail(email);
      Common.Logger.info('MembershipManagement', `Error notification sent to membership-automation@${domain}`);
    }
  } catch (emailError) {
    // If we can't even send the error email, log it but don't throw
    Common.Logger.error('MembershipManagement', `CRITICAL: Failed to send expiration error notification: ${emailError.message}`);
    Common.Logger.error('MembershipManagement', `Failed to send error notification: ${emailError.message}`, { originalError: error.message });
  }
}

/**
 * Persists audit log entries to the Audit sheet using the canonical helper
 * @param {AuditLogEntry[]} auditEntries - Array of audit log entries to persist
 */
MembershipManagement.Internal.persistAuditEntries_ = function (auditEntries) {
  if (!auditEntries || auditEntries.length === 0) {
    return 0;
  }
  
  try {
    // Use the canonical persistence helper (enforces schema validation and deduplication)
    const numWritten = AuditPersistence.persistAuditEntries(auditEntries);
    
    Common.Logger.info('MembershipManagement', `Persisted ${numWritten} audit log entries`);
    return numWritten;
  } catch (error) {
    // Log but don't throw - audit logging should not break main functionality
    Common.Logger.error('MembershipManagement', `Failed to persist audit entries: ${error.message}`);
    return 0;
  }
}









