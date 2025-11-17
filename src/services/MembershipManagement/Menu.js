MembershipManagement.Menu = {
    create: function () {
        const ui = SpreadsheetApp.getUi();
        ui.createMenu('Membership Management')
            .addItem('Process Transactions', processTransactions.name)
            .addItem('Process Expirations', processExpirations.name)
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
    MembershipManagement.processTransactions()
}
function processExpirations() {
    MembershipManagement.processExpirations()
}
function processMigrations() {
    MembershipManagement.processMigrations()
}

function findPossibleRenewalsFromMenu() {
    const activeMembers = Common.Data.Access.getMembers();
    const similarMemberPairs = MembershipManagement.Manager.findPossibleRenewals(activeMembers);
    console.log(similarMemberPairs);
    const msg = similarMemberPairs.map(p => `${p[0] + 2} & ${p[1] + 2}`).join('\n');
    SpreadsheetApp.getUi().alert(
        `The following row pairs look as if they might be a join when they should be a renewal.

        They have some identity data in common and the join date of one is before the expiry date of the other:

        ${msg}

    Review these pairs and merge as needed using the "Merge Selected Members" menu item.`,
        SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * Merge two selected member rows in the Active Members sheet using convertJoinToRenew
 * Selection rules:
 *  - User must select exactly 2 contiguous rows (same columns)
 *  - Each selected row must match at least one identity field in membership data: Email, Phone, First, Last
 */
function mergeSelectedMembers() {
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
            if (!range) { ui.alert('No selection', 'Please select exactly 2 rows to merge.', ui.ButtonSet.OK); return; }
            const rStart = range.getRow();
            const rEnd = range.getLastRow();
            for (let rr = rStart; rr <= rEnd; rr++) selectedRowNums.add(rr - 2); // Convert to 0-based with headers
        }

        if (selectedRowNums.size !== 2) { ui.alert('Invalid selection', 'Please select exactly 2 rows (they may be non-contiguous).', ui.ButtonSet.OK); return; }

        const iter = selectedRowNums.values();
        // Call convertJoinToRenew with member objects (Manager will resolve indices in membershipData)
        const result = MembershipManagement.convertJoinToRenew(iter.next().value, iter.next().value);
        if (!result.success) {
            ui.alert('Merge not performed', result.message, ui.ButtonSet.OK);
            return;
        }
        ui.alert('Merge successful', `Rows merged successfully. ${result.message}`, ui.ButtonSet.OK);
    } catch (error) {
        console.error('mergeSelectedMembers failed:', error);
        SpreadsheetApp.getUi().alert('Error', `Failed to merge selected members: ${error && error.message ? error.message : error}`, SpreadsheetApp.getUi().ButtonSet.OK);
        throw error;
    }
}