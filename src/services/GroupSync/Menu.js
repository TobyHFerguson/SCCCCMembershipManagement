// @ts-check
/// <reference path="../../types/global.d.ts" />

/**
 * GroupSync.Menu - Sheets custom menu for group membership sync
 *
 * Registers "Group Sync" menu with two items:
 *   - Sync Groups: executes actual sync
 *   - Sync Groups (Dry Run): shows planned actions without executing
 *
 * @namespace GroupSync.Menu
 */
GroupSync.Menu = {
    create: function () {
        SpreadsheetApp.getUi().createMenu('Group Sync')
            .addItem('Sync Groups', 'syncGroups')
            .addItem('Sync Groups (Dry Run)', 'syncGroupsDryRun')
            .addToUi();
    }
};

/**
 * Global function: execute a live group membership sync.
 * Called from the "Sync Groups" menu item.
 */
function syncGroups() {
    AppLogger.configure();
    try {
        AppLogger.info('GroupSync', 'Menu item "Sync Groups" clicked');
        GroupSync.Internal.runSync_(false);
    } catch (error) {
        AppLogger.error('GroupSync', 'Sync failed: ' + error.message);
        SpreadsheetApp.getUi().alert(
            'Error',
            'Group sync failed: ' + error.message,
            SpreadsheetApp.getUi().ButtonSet.OK
        );
    }
}

/**
 * Global function: execute a dry-run group membership sync.
 * Called from the "Sync Groups (Dry Run)" menu item.
 */
function syncGroupsDryRun() {
    AppLogger.configure();
    try {
        AppLogger.info('GroupSync', 'Menu item "Sync Groups (Dry Run)" clicked');
        GroupSync.Internal.runSync_(true);
    } catch (error) {
        AppLogger.error('GroupSync', 'Dry run failed: ' + error.message);
        SpreadsheetApp.getUi().alert(
            'Error',
            'Dry run failed: ' + error.message,
            SpreadsheetApp.getUi().ButtonSet.OK
        );
    }
}
