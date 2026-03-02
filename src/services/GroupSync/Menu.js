// @ts-check
/// <reference path="../../types/global.d.ts" />

/**
 * GroupSync.Menu — no separate top-level menu.
 * The "Sync Groups" item is added to the Membership Management menu.
 * This namespace is retained for structural consistency.
 *
 * @namespace GroupSync.Menu
 */

/**
 * Global function: run a group membership sync with dry-run confirmation.
 * Always previews planned actions first, then asks user to confirm before executing.
 * Called from the "Sync Groups" item in the Membership Management menu.
 */
function syncGroups() {
    AppLogger.configure();
    try {
        AppLogger.info('GroupSync', 'Menu item "Sync Groups" clicked');
        GroupSync.Internal.runSync_();
    } catch (error) {
        AppLogger.error('GroupSync', 'Sync failed: ' + error.message);
        SpreadsheetApp.getUi().alert(
            'Error',
            'Group sync failed: ' + error.message,
            SpreadsheetApp.getUi().ButtonSet.OK
        );
    }
}
