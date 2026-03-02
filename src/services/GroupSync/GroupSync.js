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
 * Get lowercase email addresses for ALL members regardless of status.
 * Used to detect non-active members referenced explicitly in group definitions.
 * @returns {string[]} Array of lowercase email strings for all members
 */
GroupSync.Internal.getAllMemberEmails_ = function () {
    const members = DataAccess.getMembers();
    return members.map(function (m) { return m.Email.toLowerCase(); });
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
 *
 * @param {boolean} [dryRun=false] - When true, previews planned actions but does not execute them.
 *     In dry-run mode the Members-keyword confirmation dialog is suppressed; the preview report
 *     already indicates which groups use the Members keyword.
 */
GroupSync.Internal.runSync_ = function (dryRun) {
    AppLogger.configure();

    const ui = SpreadsheetApp.getUi();

    // 1. Read group definitions
    const definitions = DataAccess.getGroupDefinitions();

    // 2. Get active member emails (for 'Members' keyword resolution)
    const activeEmails = GroupSync.Internal.getActiveEmails_();

    // 2b. Get all member emails (for non-active member detection)
    const allMemberEmails = GroupSync.Internal.getAllMemberEmails_();

    // 3. Validate explicit emails in definitions — detect malformed or non-active members
    const activeEmailSet = new Set(activeEmails);
    const allMemberEmailSet = new Set(allMemberEmails);
    const invalidEntries = GroupSync.Manager.findInvalidMemberEmails(
        definitions, activeEmailSet, allMemberEmailSet
    );

    /** @type {Set<string>} */
    let emailsToExclude = new Set();

    if (invalidEntries.length > 0) {
        const lines = invalidEntries.map(function (e) {
            return '\u2022 ' + e.email + ' in "' + e.groupName + '" (' + e.field + '): ' + e.reason;
        });
        const message =
            'The following email addresses in Group Definitions are invalid:\n\n' +
            lines.join('\n') +
            '\n\nContinue with these addresses ignored, or Cancel to abort?';
        const response = ui.alert('Invalid Email Addresses Found', message, ui.ButtonSet.OK_CANCEL);
        if (response !== ui.Button.OK) {
            AppLogger.info('GroupSync', 'Sync cancelled by user due to invalid email addresses');
            return;
        }
        emailsToExclude = new Set(invalidEntries.map(function (e) { return e.email.toLowerCase(); }));
        AppLogger.warn('GroupSync', 'Proceeding with ' + emailsToExclude.size + ' invalid email(s) excluded: ' + Array.from(emailsToExclude).join(', '));
    }

    // 4. Compute desired state
    let desiredState = GroupSync.Manager.computeDesiredState(definitions, activeEmails);

    // 5. Remove invalid emails from desired state if user chose to continue
    if (emailsToExclude.size > 0) {
        desiredState = GroupSync.Manager.removeEmailsFromDesiredState(desiredState, emailsToExclude);
    }

    // 6. Get group emails that need actual state
    const groupEmails = Array.from(desiredState.keys());

    // 7. Fetch actual state
    const actualState = GroupSync.Internal.fetchActualState_(groupEmails);

    // 8. Compute actions
    const result = GroupSync.Manager.computeActions(desiredState, actualState);

    // 9. Collect groups that used the Members keyword
    /** @type {string[]} */
    const membersKeywordGroups = [];
    for (const state of desiredState.values()) {
        if (state.usedMembersKeyword) {
            membersKeywordGroups.push(state.groupName);
        }
    }

    // 10. Format planned actions and ask user to confirm before executing
    const summaryLines = GroupSync.Manager.formatActionsSummary(result);

    // Prepend Members keyword notice to the dry-run report when applicable
    if (membersKeywordGroups.length > 0) {
        const notice = '\u26a0\ufe0f Members keyword: the following group(s) will be populated with ALL active members (' +
            activeEmails.length + ' members):\n  - ' + membersKeywordGroups.join('\n  - ') + '\n';
        summaryLines.unshift(notice);
    }

    AppLogger.info('GroupSync', 'Dry run preview:\n' + summaryLines.join('\n'));

    // 11. If any groups use the Members keyword and this is a live run, confirm with user first
    if (!dryRun && membersKeywordGroups.length > 0) {
        const membersConfirmed = ui.alert(
            'Confirm: Populate Groups with ALL Members',
            'The following groups will be populated with ALL active members (' + activeEmails.length + ' members):\n\n' +
            '  - ' + membersKeywordGroups.join('\n  - ') +
            '\n\nDo you want to continue?',
            ui.ButtonSet.YES_NO
        );
        if (membersConfirmed !== ui.Button.YES) {
            AppLogger.info('GroupSync', 'Sync cancelled by user (Members keyword confirmation)');
            return;
        }
    }

    // 12. Show dry-run preview + ask user to confirm before executing
    const confirmed = ui.alert(
        'Sync Groups \u2014 Preview',
        summaryLines.join('\n') + '\n\nProceed with sync?',
        ui.ButtonSet.YES_NO
    );

    if (confirmed !== ui.Button.YES) {
        AppLogger.info('GroupSync', 'Sync cancelled by user');
        return;
    }

    if (dryRun) {
        AppLogger.info('GroupSync', 'Dry run completed \u2014 no changes made');
        return;
    }

    // 13. Execute actions
    const execResult = GroupSync.Internal.executeActions_(result.actions);

    // 14. Create and persist audit entries for each executed action
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

    // 15. Show results — errors separated from successes by a blank line
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
