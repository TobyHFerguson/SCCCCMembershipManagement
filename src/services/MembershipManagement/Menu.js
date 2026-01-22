MembershipManagement.Menu = {
    create: function () {
        const ui = SpreadsheetApp.getUi();
        ui.createMenu('Membership Management')
            .addItem('Process Transactions', processTransactions.name)
            .addItem('Process Expirations', generateExpiringMembersList.name)
            .addSeparator()
            .addItem('Find possible renewals', findPossibleRenewalsFromMenu.name)
            .addItem('Merge Selected Members', mergeSelectedMembers.name)
            .addSeparator()
            .addItem('Process Migrations', processMigrations.name)
            .addToUi();
    }
}


// For functions to be callable from the menu, they need to be in the global scope.
// This is a workaround to make them callable from the menu.
function processTransactions() {
    return Common.Utils.wrapMenuFunction(
        function() {
            AppLogger.info('MembershipManagement', 'Menu: Process Transactions - Starting');
            const result = MembershipManagement.processTransactions();
            
            // Create audit entry for menu operation
            const auditLogger = new AuditLogger();
            const auditEntry = auditLogger.createLogEntry({
                type: 'MenuProcessTransactions',
                outcome: 'success',
                note: `Processed ${result.processed || 0} transactions: ${result.joins || 0} joins, ${result.renewals || 0} renewals`,
                error: '',
                jsonData: { 
                    processed: result.processed || 0,
                    joins: result.joins || 0,
                    renewals: result.renewals || 0,
                    errors: result.errors ? result.errors.length : 0,
                    hasPendingPayments: result.hasPendingPayments || false
                }
            });
            MembershipManagement.Internal.persistAuditEntries_([auditEntry]);
            
            AppLogger.info('MembershipManagement', 'Menu: Process Transactions - Completed', {
                processed: result.processed || 0,
                joins: result.joins || 0,
                renewals: result.renewals || 0,
                errors: result.errors ? result.errors.length : 0
            });
            
            // Show user-friendly message
            if (result.processed > 0) {
                const msg = `Processed ${result.processed} transaction(s):\n` +
                           `  • ${result.joins} new member(s)\n` +
                           `  • ${result.renewals} renewal(s)`;
                if (result.errors && result.errors.length > 0) {
                    SpreadsheetApp.getUi().alert('Transactions Processed with Errors', 
                        msg + `\n  • ${result.errors.length} error(s) - check System Logs`, 
                        SpreadsheetApp.getUi().ButtonSet.OK);
                } else {
                    SpreadsheetApp.getUi().alert('Transactions Processed', msg, SpreadsheetApp.getUi().ButtonSet.OK);
                }
            } else if (result.errors && result.errors.length > 0) {
                SpreadsheetApp.getUi().alert('Transaction Errors', 
                    `No transactions processed successfully.\n${result.errors.length} error(s) - check System Logs`, 
                    SpreadsheetApp.getUi().ButtonSet.OK);
            }
            
            return result;
        },
        'Process Transactions'
    )();
}
function generateExpiringMembersList() {
    return Common.Utils.wrapMenuFunction(
        function() {
            AppLogger.info('MembershipManagement', 'Menu: Process Expirations - Starting');
            const result = MembershipManagement.generateExpiringMembersList();
            
            AppLogger.info('MembershipManagement', 'Menu: Process Expirations - Completed', {
                addedToQueue: result ? result.addedToQueue : 0,
                scheduleEntriesProcessed: result ? result.scheduleEntriesProcessed : 0
            });
            
            // Show user-friendly message
            if (result && result.addedToQueue > 0) {
                const expiryDetails = result.expiryTypeCounts ? 
                    Object.entries(result.expiryTypeCounts)
                        .map(([type, count]) => `  • ${type}: ${count}`)
                        .join('\n') : '';
                const msg = `Added ${result.addedToQueue} item(s) to expiration queue:\n${expiryDetails}`;
                SpreadsheetApp.getUi().alert('Expiration Processing Started', 
                    msg + '\n\nBackground processing will send emails shortly.',
                    SpreadsheetApp.getUi().ButtonSet.OK);
            } else {
                SpreadsheetApp.getUi().alert('No Expirations Due', 
                    'No memberships require expiration processing at this time.',
                    SpreadsheetApp.getUi().ButtonSet.OK);
            }
            
            return result;
        },
        'Process Expirations'
    )();
}
function processMigrations() {
    return Common.Utils.wrapMenuFunction(
        function() {
            AppLogger.info('MembershipManagement', '[processMigrations] Starting processMigrations');
            MembershipManagement.processMigrations();
            AppLogger.info('MembershipManagement', '[processMigrations] Completed');
        },
        'Process Migrations'
    )();
}

function findPossibleRenewalsFromMenu() {
    return Common.Utils.wrapMenuFunction(
        function() {
            AppLogger.info('MembershipManagement', 'Menu: Find Possible Renewals - Starting');
            
            const activeMembers = DataAccess.getMembers();
            const similarMemberPairs = MembershipManagement.Manager.findPossibleRenewals(activeMembers);
            const pairCount = (similarMemberPairs || []).length;
            
            // Create audit entry for this operation
            const auditLogger = new AuditLogger();
            const pairDetails = similarMemberPairs.map(p => ({ rowA: p[0] + 2, rowB: p[1] + 2 }));
            const auditEntry = auditLogger.createLogEntry({
                type: 'FindPossibleRenewals',
                outcome: 'success',
                note: `Found ${pairCount} possible renewal pair(s)`,
                error: '',
                jsonData: { pairCount, pairs: pairDetails }
            });
            MembershipManagement.Internal.persistAuditEntries_([auditEntry]);
            
            AppLogger.info('MembershipManagement', 'Menu: Find Possible Renewals - Completed', { 
                pairCount, 
                pairs: pairDetails 
            });
            
            if (similarMemberPairs.length === 0) {
                SpreadsheetApp.getUi().alert(
                    'No Possible Renewals Found',
                    'No member pairs were found that look like they might be a join when they should be a renewal.\n\nAll membership records appear to be unique.',
                    SpreadsheetApp.getUi().ButtonSet.OK);
                return;
            }
            
            const msg = similarMemberPairs.map(p => `${p[0] + 2} & ${p[1] + 2}`).join('\n');
            SpreadsheetApp.getUi().alert(
                `The following row pairs look as if they might be a join when they should be a renewal.

        They have some identity data in common and the join date of one is before the expiry date of the other:

        ${msg}

    Review these pairs and merge as needed using the "Merge Selected Members" menu item.`,
                SpreadsheetApp.getUi().ButtonSet.OK);
        },
        'Find Possible Renewals'
    )();
}

/**
 * Merge two selected member rows in the Active Members sheet using convertJoinToRenew
 * Selection rules:
 *  - User must select exactly 2 contiguous rows (same columns)
 *  - Each selected row must match at least one identity field in membership data: Email, Phone, First, Last
 */
function mergeSelectedMembers() {
    return Common.Utils.wrapMenuFunction(
        function() {
            AppLogger.info('MembershipManagement', 'Menu: Merge Selected Members - Starting');
            
            const ui = SpreadsheetApp.getUi();
            try {
                const ss = SpreadsheetApp.getActiveSpreadsheet();
                const sheet = ss.getActiveSheet();
                // Allow two rows to be selected; they may be contiguous or not.
                let selectedRowNums = new Set();
                if (ss.getActiveRangeList) {
                    const ranges = ss.getActiveRangeList().getRanges();
                    ranges.forEach(r => {
                        const rStart = r.getRow();
                        const rEnd = r.getLastRow();
                        for (let rr = rStart; rr <= rEnd; rr++) selectedRowNums.add(rr - 2);
                    });
                } else {
                    const range = sheet.getActiveRange();
                    if (!range) { 
                        ui.alert('No selection', 'Please select exactly 2 rows to merge.', ui.ButtonSet.OK); 
                        AppLogger.info('MembershipManagement', 'Menu: Merge Selected Members - Aborted (no selection)');
                        return; 
                    }
                    const rStart = range.getRow();
                    const rEnd = range.getLastRow();
                    for (let rr = rStart; rr <= rEnd; rr++) selectedRowNums.add(rr - 2); // Convert to 0-based with headers
                }

                if (selectedRowNums.size !== 2) { 
                    ui.alert('Invalid selection', 'Please select exactly 2 rows (they may be non-contiguous).', ui.ButtonSet.OK); 
                    AppLogger.info('MembershipManagement', 'Menu: Merge Selected Members - Aborted (invalid selection)', { selectedCount: selectedRowNums.size });
                    return; 
                }

                const iter = selectedRowNums.values();
                const rowA = iter.next().value;
                const rowB = iter.next().value;
                
                // Call convertJoinToRenew with member objects (Manager will resolve indices in membershipData)
                const result = MembershipManagement.convertJoinToRenew(rowA, rowB);
                
                if (!result.success) {
                    // Create audit entry for failed merge
                    const auditLogger = new AuditLogger();
                    const auditEntry = auditLogger.createLogEntry({
                        type: 'MergeSelectedMembers',
                        outcome: 'fail',
                        note: `Merge failed: ${result.message}`,
                        error: '',
                        jsonData: { rowA: rowA + 2, rowB: rowB + 2, reason: result.message }
                    });
                    MembershipManagement.Internal.persistAuditEntries_([auditEntry]);
                    
                    AppLogger.info('MembershipManagement', 'Menu: Merge Selected Members - Failed', { 
                        rowA: rowA + 2, 
                        rowB: rowB + 2, 
                        reason: result.message 
                    });
                    
                    ui.alert('Merge not performed', result.message, ui.ButtonSet.OK);
                    return;
                }
                
                // Create audit entry for successful merge
                const auditLogger = new AuditLogger();
                const auditEntry = auditLogger.createLogEntry({
                    type: 'MergeSelectedMembers',
                    outcome: 'success',
                    note: `Successfully merged rows ${rowA + 2} and ${rowB + 2} into row ${result.mergeDetails.resultRow}`,
                    error: '',
                    jsonData: result.mergeDetails || { 
                        rowA: rowA + 2, 
                        rowB: rowB + 2, 
                        message: result.message,
                        note: 'Legacy format - mergeDetails not available'
                    }
                });
                MembershipManagement.Internal.persistAuditEntries_([auditEntry]);
                
                AppLogger.info('MembershipManagement', 'Menu: Merge Selected Members - Completed', result.mergeDetails || { 
                    rowA: rowA + 2, 
                    rowB: rowB + 2, 
                    message: result.message 
                });
                
                ui.alert('Merge successful', `${result.message}`, ui.ButtonSet.OK);
            } catch (error) {
                // Create audit entry for error
                const auditLogger = new AuditLogger();
                const auditEntry = auditLogger.createLogEntry({
                    type: 'MergeSelectedMembers',
                    outcome: 'fail',
                    note: `Merge operation threw error: ${error.message}`,
                    error: error.message,
                    jsonData: { stack: error.stack }
                });
                MembershipManagement.Internal.persistAuditEntries_([auditEntry]);
                
                AppLogger.error('MembershipManagement', 'Menu: Merge Selected Members - Error', { error: error.message, stack: error.stack });
                SpreadsheetApp.getUi().alert('Error', `Failed to merge selected members: ${error && error.message ? error.message : error}`, SpreadsheetApp.getUi().ButtonSet.OK);
                throw error;
            }
        },
        'Merge Selected Members'
    )();
}