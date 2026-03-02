// @ts-check
/// <reference path="../../types/global.d.ts" />

/**
 * GroupSync.Internal - GAS orchestration for group membership sync
 *
 * Reads data from sheets, calls AdminDirectory via GroupSubscription adapter,
 * executes or logs actions, and supports dry-run mode with audit logging.
 *
 * All AdminDirectory operations go through the GroupSubscription adapter.
 * Business logic lives in GroupSync.Manager (pure, testable).
 *
 * @namespace GroupSync.Internal
 */

/**
 * Get lowercase email addresses for all active members.
 * @returns {string[]} Array of lowercase email strings for active members
 */
GroupSync.Internal.getActiveEmails_ = function () {
    const members = DataAccess.getMembers();
    return members
        .filter(function (m) { return m.Status === 'Active'; })
        .map(function (m) { return m.Email.toLowerCase(); });
};

/**
 * Fetch actual membership state for the given group emails.
 * Calls GroupSubscription.listMembers() for each group; failures are logged
 * and skipped so partial results are returned rather than failing entirely.
 *
 * @param {string[]} groupEmails - Group email addresses to fetch
 * @returns {Map<string, ActualMember[]>} Map from group email to member list
 */
GroupSync.Internal.fetchActualState_ = function (groupEmails) {
    /** @type {Map<string, ActualMember[]>} */
    const result = new Map();
    for (const groupEmail of groupEmails) {
        try {
            const members = GroupSubscription.listMembers(groupEmail);
            result.set(groupEmail, members.map(function (m) {
                return { email: m.email.toLowerCase(), role: m.role };
            }));
        } catch (error) {
            AppLogger.error('GroupSync', 'Failed to fetch members for group ' + groupEmail + ': ' + error.message);
            // Partial results — continue with other groups
        }
    }
    return result;
};

/**
 * Execute sync actions against Google Groups via the GroupSubscription adapter.
 * Each action is wrapped in try-catch so failures don't abort the entire run.
 *
 * @param {SyncAction[]} actions - List of actions to execute
 * @returns {{ succeeded: SyncAction[], failed: Array<{action: SyncAction, error: string}> }}
 */
GroupSync.Internal.executeActions_ = function (actions) {
    /** @type {SyncAction[]} */
    const succeeded = [];
    /** @type {Array<{action: SyncAction, error: string}>} */
    const failed = [];

    for (const action of actions) {
        try {
            if (action.action === 'ADD') {
                GroupSubscription.subscribeMember(
                    { email: action.userEmail, role: action.targetRole },
                    action.groupEmail
                );
            } else if (action.action === 'REMOVE') {
                GroupSubscription.removeMember(action.groupEmail, action.userEmail);
            } else if (action.action === 'PROMOTE') {
                GroupSubscription.updateMember(
                    { email: action.userEmail, role: 'MANAGER' },
                    action.groupEmail
                );
            } else if (action.action === 'DEMOTE') {
                GroupSubscription.updateMember(
                    { email: action.userEmail, role: 'MEMBER' },
                    action.groupEmail
                );
            }
            succeeded.push(action);
        } catch (error) {
            AppLogger.error('GroupSync', 'Action ' + action.action + ' failed for ' + action.userEmail + ' in ' + action.groupEmail + ': ' + error.message);
            failed.push({ action: action, error: error.message });
        }
    }

    return { succeeded: succeeded, failed: failed };
};

/**
 * Main orchestration function for group membership sync.
 * Always runs a dry-run preview first and asks the user to confirm before executing.
 */
GroupSync.Internal.runSync_ = function () {
    AppLogger.configure();

    // 1. Read group definitions
    const definitions = DataAccess.getGroupDefinitions();

    // 2. Compute desired state
    const desiredState = GroupSync.Manager.computeDesiredState(definitions);

    // 3. Get group emails that need actual state
    const groupEmails = Array.from(desiredState.keys());

    // 4. Fetch actual state
    const actualState = GroupSync.Internal.fetchActualState_(groupEmails);

    // 5. Compute actions
    const result = GroupSync.Manager.computeActions(desiredState, actualState);

    // 6. Format planned actions and ask user to confirm before executing
    const summaryLines = GroupSync.Manager.formatActionsSummary(result);
    AppLogger.info('GroupSync', 'Dry run preview:\n' + summaryLines.join('\n'));

    const ui = SpreadsheetApp.getUi();
    const confirmed = ui.alert(
        'Sync Groups — Preview',
        summaryLines.join('\n') + '\n\nProceed with sync?',
        ui.ButtonSet.YES_NO
    );

    if (confirmed !== ui.Button.YES) {
        AppLogger.info('GroupSync', 'Sync cancelled by user');
        return;
    }

    // 7. Execute actions
    const execResult = GroupSync.Internal.executeActions_(result.actions);

    // 8. Create and persist audit entries for each executed action
    const auditEntries = execResult.succeeded.map(function (action) {
        return AuditLogEntry.create(
            'GroupSync',
            'success',
            action.action + ' ' + action.userEmail + ' in ' + action.groupName + ' (' + action.targetRole + ')',
            undefined,
            JSON.stringify({ groupEmail: action.groupEmail, action: action.action, userEmail: action.userEmail, targetRole: action.targetRole })
        );
    });
    execResult.failed.forEach(function (f) {
        auditEntries.push(AuditLogEntry.create(
            'GroupSync',
            'fail',
            f.action.action + ' ' + f.action.userEmail + ' in ' + f.action.groupName,
            f.error,
            JSON.stringify({ groupEmail: f.action.groupEmail, action: f.action.action, userEmail: f.action.userEmail })
        ));
    });

    if (auditEntries.length > 0) {
        AuditPersistence.persistAuditEntries(auditEntries);
    }

    // 9. Show results — errors separated from successes by a blank line
    AppLogger.info('GroupSync', 'Sync completed: ' + execResult.succeeded.length + ' succeeded, ' + execResult.failed.length + ' failed');

    const successLines = execResult.succeeded.map(function (action) {
        return action.action + ' ' + action.userEmail + ' in ' + action.groupName + ' (' + action.targetRole + ')';
    });
    const failLines = execResult.failed.map(function (f) {
        return 'FAILED: ' + f.action.action + ' ' + f.action.userEmail + ' in ' + f.action.groupName + ': ' + f.error;
    });

    let resultText = successLines.length > 0 ? successLines.join('\n') : 'No actions were executed.';
    if (failLines.length > 0) {
        resultText += '\n\n' + failLines.join('\n');
    }
    resultText += '\n\nSummary: ' + execResult.succeeded.length + ' succeeded, ' + execResult.failed.length + ' failed.';

    ui.alert('Group Sync Results', resultText, ui.ButtonSet.OK);
};
