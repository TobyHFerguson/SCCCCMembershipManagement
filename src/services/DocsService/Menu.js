DocsService.Menu = {
    create: () => {
        SpreadsheetApp.getUi().createMenu('Utilities')
        .addItem('Initialize Triggers', initializeTriggers.name)
            .addItem('testConvert', 'testConvert')
            .addItem('Merge Selected Members', 'mergeSelectedMembers')
            .addItem('Convert Google Doc to HTML', 'showConversionDialog')
            .addToUi();
    }

}



function showConversionDialog() {
    DocsService.UI.showConversionDialog();
}

function testConvert() {
    var docURL = 'https://docs.google.com/document/d/1Pi-7YpzC4WDofRYwkPiMtUjFFLkspUtszhaN9kKzwI4';
    var htmlContent = DocsService.convertDocToHtml(docURL);
    var htmlOutput = HtmlService.createHtmlOutput(htmlContent)
        .setWidth(600)
        .setHeight(400);
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Converted HTML');
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
                for (let rr = rStart; rr <= rEnd; rr++) selectedRowNums.add(rr);
            });
        } else {
            const range = sheet.getActiveRange();
            if (!range) { ui.alert('No selection', 'Please select exactly 2 rows to merge.', ui.ButtonSet.OK); return; }
            const rStart = range.getRow();
            const rEnd = range.getLastRow();
            for (let rr = rStart; rr <= rEnd; rr++) selectedRowNums.add(rr);
        }

        if (selectedRowNums.size !== 2) { ui.alert('Invalid selection', 'Please select exactly 2 rows (they may be non-contiguous).', ui.ButtonSet.OK); return; }

        const headerRange = sheet.getRange(1, 1, 1, sheet.getLastColumn());
        const headers = headerRange.getValues()[0].map(h => String(h).trim().toLowerCase());
    const emailCol = headers.indexOf('email');
    const phoneCol = headers.indexOf('phone');
    const firstCol = headers.indexOf('first');
    const lastNameCol = headers.indexOf('last');

        if (emailCol === -1 && phoneCol === -1 && firstCol === -1 && lastNameCol === -1) {
            ui.alert('Missing columns', 'Active Members sheet must contain one of these columns: Email, Phone, First, Last', ui.ButtonSet.OK);
            return;
        }

        // Read the two selected rows' values and build member-like objects
        const lastCol = sheet.getLastColumn();
        const selectedRows = Array.from(selectedRowNums).sort((a, b) => a - b);
        const rowValues = selectedRows.map(r => sheet.getRange(r, 1, 1, lastCol).getValues()[0]);

        const buildMemberFromRow = (rowArr) => {
            const obj = {};
            headers.forEach((h, ci) => {
                const val = rowArr[ci];
                switch (h) {
                    case 'email': obj.Email = val ? String(val).trim() : ''; break;
                    case 'phone': obj.Phone = val ? String(val).trim() : ''; break;
                    case 'first': obj.First = val ? String(val).trim() : ''; break;
                    case 'last': obj.Last = val ? String(val).trim() : ''; break;
                    case 'joined': obj.Joined = val instanceof Date ? MembershipManagement.Utils.dateOnly(val) : val; break;
                    case 'period': obj.Period = val; break;
                    case 'expires': obj.Expires = val instanceof Date ? MembershipManagement.Utils.dateOnly(val) : val; break;
                    default: obj[h] = val; break;
                }
            });
            return obj;
        };

        const members = rowValues.map(rv => buildMemberFromRow(rv));

        // Load membership data and manager
        const membershipFiddler = Common.Data.Storage.SpreadsheetManager.getFiddler('ActiveMembers');
        const expiryFiddler = Common.Data.Storage.SpreadsheetManager.getFiddler('ExpirySchedule');
        const init = MembershipManagement.Internal.initializeManagerData_(membershipFiddler, expiryFiddler);
        const manager = init.manager;
        const membershipData = init.membershipData;

        // Validate the two member objects share at least one identity characteristic
        const normalize = v => v ? String(v).trim().toLowerCase() : '';
        const a = members[0];
        const b = members[1];
        const shareIdentity = (
            (normalize(a.Email) && normalize(b.Email) && normalize(a.Email) === normalize(b.Email)) ||
            (normalize(a.Phone) && normalize(b.Phone) && normalize(a.Phone) === normalize(b.Phone)) ||
            (normalize(a.First) && normalize(b.First) && normalize(a.First) === normalize(b.First)) ||
            (normalize(a.Last) && normalize(b.Last) && normalize(a.Last) === normalize(b.Last))
        );

        if (!shareIdentity) {
            ui.alert('Not the same person', 'The two selected rows do not share any identity field (Email, Phone, First, or Last). Merge aborted.', ui.ButtonSet.OK);
            return;
        }

        // Call convertJoinToRenew with member objects (Manager will resolve indices in membershipData)
        const result = manager.convertJoinToRenew(members[0], members[1], membershipData);
        if (!result.success) {
            ui.alert('Merge not performed', result.message, ui.ButtonSet.OK);
            return;
        }
    // Persist changes back to sheet and notify
    membershipFiddler.setData(membershipData).dumpValues();
    ui.alert('Merge successful', `Rows merged successfully. ${result.message}`, ui.ButtonSet.OK);
    } catch (error) {
        console.error('mergeSelectedMembers failed:', error);
        SpreadsheetApp.getUi().alert('Error', `Failed to merge selected members: ${error && error.message ? error.message : error}`, SpreadsheetApp.getUi().ButtonSet.OK);
        throw error;
    }
}