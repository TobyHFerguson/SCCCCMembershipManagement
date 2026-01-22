/// <reference path="../../types/global.d.ts" />

/**
 * @returns {Fiddler<VotingService.Election>}
 */
function getElectionsFiddler() {
    return Common.Data.Storage.SpreadsheetManager.getFiddler('Elections');
}

/**
 * @returns {Fiddler<TokenDataType>}
 */
function getTokensFiddler() {
    return Common.Data.Storage.SpreadsheetManager.getFiddler('Tokens');
}

/**
 * @returns {Fiddler<SystemLogEntry>}
 */
function getSystemLogsFiddler() {
    return Common.Data.Storage.SpreadsheetManager.getFiddler('SystemLogs');
}

Common.Data.Access = {
    getBootstrapData: () => {
        const bootStrapFiddler = Common.Data.Storage.SpreadsheetManager.getFiddler('Bootstrap');
        return bootStrapFiddler.getData();
    },
    getEmailAddresses: function () {
        // Use SpreadsheetApp with ValidatedMember
        const sheet = Common.Data.Storage.SpreadsheetManager.getSheet('ActiveMembers');
        const allData = sheet.getDataRange().getValues();
        const headers = allData[0];
        const rows = allData.slice(1);
        const members = Common.Data.ValidatedMember.validateRows(rows, headers, 'data_access.getEmailAddresses');
        const emails = members.map(member => member.Email.toLowerCase());
        return emails;
    },
    getMembers: () => {
        // Use SpreadsheetApp with ValidatedMember
        const sheet = Common.Data.Storage.SpreadsheetManager.getSheet('ActiveMembers');
        const allData = sheet.getDataRange().getValues();
        const headers = allData[0];
        const rows = allData.slice(1);
        const members = Common.Data.ValidatedMember.validateRows(rows, headers, 'data_access.getMembers');
        return members;
    },
    getActionSpecs: () => {
        Common.Data.Storage.SpreadsheetManager.convertLinks('Action Specs');
        // We use getDataWithFormulas_ because the Body of an ActionSpec may contain formulas with a URL.
        const actionSpecsAsArray = /** @type {MembershipManagement.ActionSpec[]} */ (Common.Data.Storage.SpreadsheetManager.getDataWithFormulas(Common.Data.Storage.SpreadsheetManager.getFiddler('ActionSpecs')))
        const actionSpecs = Object.fromEntries(actionSpecsAsArray.map(spec => [spec.Type, spec]));
        for (const actionSpec of Object.values(actionSpecs)) {
            let match = actionSpec.Body.match(/=hyperlink\("(https:\/\/docs.google.com\/document\/d\/[^"]+)"/);
            if (match) {
                let url = match[1];
                actionSpec.Body = DocsService.convertDocToHtml(url);
            }
        }
        return actionSpecs;
    },
    getPublicGroups: () => {
        const publicGroups = Common.Data.Storage.SpreadsheetManager.getFiddler('PublicGroups').getData();
        return publicGroups;
    },
    getMember: (email) => {
        email = email.toLowerCase();
        // Use SpreadsheetApp with ValidatedMember for single member lookup
        const sheet = Common.Data.Storage.SpreadsheetManager.getSheet('ActiveMembers');
        const allData = sheet.getDataRange().getValues();
        const headers = allData[0];
        const emailCol = headers.indexOf('Email');
        const rows = allData.slice(1);

        const rowIndex = rows.findIndex(row => 
            row[emailCol]?.toString().toLowerCase() === email
        );

        if (rowIndex === -1) return undefined;
        
        // Use fromRow to create ValidatedMember (returns null on failure)
        const member = Common.Data.ValidatedMember.fromRow(rows[rowIndex], headers, rowIndex + 2, null);
        return member || undefined;
    },
    updateMember: (email, newMember) => {
        email = email.toLowerCase();
        // Use SpreadsheetApp with selective cell updates via MemberPersistence
        const sheet = Common.Data.Storage.SpreadsheetManager.getSheet('ActiveMembers');
        const allData = sheet.getDataRange().getValues();
        const headers = allData[0];
        const originalRows = allData.slice(1);
        const emailCol = headers.indexOf('Email');
        
        // Find the member to update
        const rowIndex = originalRows.findIndex(row => 
            row[emailCol]?.toString().toLowerCase() === email
        );
        
        if (rowIndex === -1) {
            Common.Logger.warn('data_access', `updateMember: Member not found with email: ${email}`);
            return false;
        }
        
        // Write only changed cells for the specific row
        const original = originalRows[rowIndex];
        const modified = newMember.toArray();
        
        let changeCount = 0;
        for (let j = 0; j < modified.length; j++) {
            if (!Common.Data.MemberPersistence.valuesEqual(original[j], modified[j])) {
                // Write single cell that changed
                // Row index: rowIndex + 2 (skip header row, 1-based indexing)
                // Column index: j + 1 (1-based indexing)
                sheet.getRange(rowIndex + 2, j + 1).setValue(modified[j]);
                changeCount++;
            }
        }
        
        Common.Logger.info('data_access', `updateMember: Updated ${changeCount} cells for ${email}`);
        
        // Clear cache so subsequent reads get fresh data
        Common.Data.Storage.SpreadsheetManager.clearFiddlerCache('ActiveMembers');
        return true;
    },
    isMember:(email) => {
        email = email.toLowerCase();
        // Use SpreadsheetApp for quick email check
        const sheet = Common.Data.Storage.SpreadsheetManager.getSheet('ActiveMembers');
        const allData = sheet.getDataRange().getValues();
        const headers = allData[0];
        const emailCol = headers.indexOf('Email');
        const rows = allData.slice(1);
        
        return rows.some(row => row[emailCol]?.toString().toLowerCase() === email);
    },
    getElections: () => {
        const votingData = Common.Data.Storage.SpreadsheetManager.getFiddler('Elections').getData();
        return votingData;
    },
    getSystemLogs: () => {
        const systemLogs = Common.Data.Storage.SpreadsheetManager.getFiddler('SystemLogs').getData();
        return systemLogs;
    }
}