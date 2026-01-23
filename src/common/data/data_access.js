/// <reference path="../../types/global.d.ts" />

/**
 * DataAccess Module
 * 
 * Purpose: High-level data access functions for member data and other shared data.
 * Uses SpreadsheetManager for sheet access and ValidatedMember for type-safe member data.
 * 
 * Layer: Layer 1 Infrastructure (can use AppLogger)
 * 
 * Usage:
 *   const members = DataAccess.getMembers();
 *   const member = DataAccess.getMember(email);
 * 
 * Pattern: Flat object literal (per gas-best-practices.md)
 */

/**
 * @returns {Fiddler<VotingService.Election>}
 */
function getElectionsFiddler() {
    return SpreadsheetManager.getFiddler('Elections');
}

/**
 * @returns {Fiddler<TokenDataType>}
 */
function getTokensFiddler() {
    return SpreadsheetManager.getFiddler('Tokens');
}

/**
 * @returns {Fiddler<SystemLogEntry>}
 */
function getSystemLogsFiddler() {
    return SpreadsheetManager.getFiddler('SystemLogs');
}

/**
 * DataAccess object - provides high-level data access functions
 */
// @ts-ignore - TypeScript sees identical types as different due to ActionSpec resolution order
var DataAccess = {
    getBootstrapData: () => {
        const bootStrapFiddler = SpreadsheetManager.getFiddler('Bootstrap');
        return bootStrapFiddler.getData();
    },
    getEmailAddresses: function () {
        // Use SpreadsheetApp with ValidatedMember
        const sheet = SpreadsheetManager.getSheet('ActiveMembers');
        const allData = sheet.getDataRange().getValues();
        const headers = allData[0];
        const rows = allData.slice(1);
        const members = ValidatedMember.validateRows(rows, headers, 'data_access.getEmailAddresses');
        const emails = members.map(member => member.Email.toLowerCase());
        return emails;
    },
    getMembers: () => {
        // Use SpreadsheetApp with ValidatedMember
        const sheet = SpreadsheetManager.getSheet('ActiveMembers');
        const allData = sheet.getDataRange().getValues();
        const headers = allData[0];
        const rows = allData.slice(1);
        const members = ValidatedMember.validateRows(rows, headers, 'data_access.getMembers');
        return members;
    },
    getActionSpecs: () => {
        SpreadsheetManager.convertLinks('Action Specs');
        // We use getDataWithFormulas_ because the Body of an ActionSpec may contain formulas with a URL.
        const actionSpecsAsArray = /** @type {MembershipManagement.ActionSpec[]} */ (SpreadsheetManager.getDataWithFormulas(SpreadsheetManager.getFiddler('ActionSpecs')))
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
        const publicGroups = SpreadsheetManager.getFiddler('PublicGroups').getData();
        return publicGroups;
    },
    getMember: (email) => {
        email = email.toLowerCase();
        // Use SpreadsheetApp with ValidatedMember for single member lookup
        const sheet = SpreadsheetManager.getSheet('ActiveMembers');
        const allData = sheet.getDataRange().getValues();
        const headers = allData[0];
        const emailCol = headers.indexOf('Email');
        const rows = allData.slice(1);

        const rowIndex = rows.findIndex(row => 
            row[emailCol]?.toString().toLowerCase() === email
        );

        if (rowIndex === -1) return undefined;
        
        // Use fromRow to create ValidatedMember (returns null on failure)
        const member = ValidatedMember.fromRow(rows[rowIndex], headers, rowIndex + 2, null);
        return member || undefined;
    },
    updateMember: (email, newMember) => {
        email = email.toLowerCase();
        // Use SpreadsheetApp with selective cell updates via MemberPersistence
        const sheet = SpreadsheetManager.getSheet('ActiveMembers');
        const allData = sheet.getDataRange().getValues();
        const headers = allData[0];
        const originalRows = allData.slice(1);
        const emailCol = headers.indexOf('Email');
        
        // Find the member to update
        const rowIndex = originalRows.findIndex(row => 
            row[emailCol]?.toString().toLowerCase() === email
        );
        
        if (rowIndex === -1) {
            AppLogger.warn('data_access', `updateMember: Member not found with email: ${email}`);
            return false;
        }
        
        // Write only changed cells for the specific row
        const original = originalRows[rowIndex];
        const modified = newMember.toArray();
        
        let changeCount = 0;
        for (let j = 0; j < modified.length; j++) {
            if (!MemberPersistence.valuesEqual(original[j], modified[j])) {
                // Write single cell that changed
                // Row index: rowIndex + 2 (skip header row, 1-based indexing)
                // Column index: j + 1 (1-based indexing)
                sheet.getRange(rowIndex + 2, j + 1).setValue(modified[j]);
                changeCount++;
            }
        }
        
        AppLogger.info('data_access', `updateMember: Updated ${changeCount} cells for ${email}`);
        
        // Clear cache so subsequent reads get fresh data
        SpreadsheetManager.clearFiddlerCache('ActiveMembers');
        return true;
    },
    isMember:(email) => {
        email = email.toLowerCase();
        // Use SpreadsheetApp for quick email check
        const sheet = SpreadsheetManager.getSheet('ActiveMembers');
        const allData = sheet.getDataRange().getValues();
        const headers = allData[0];
        const emailCol = headers.indexOf('Email');
        const rows = allData.slice(1);
        
        return rows.some(row => row[emailCol]?.toString().toLowerCase() === email);
    },
    getElections: () => {
        const votingData = SpreadsheetManager.getFiddler('Elections').getData();
        return votingData;
    },
    getSystemLogs: () => {
        const systemLogs = SpreadsheetManager.getFiddler('SystemLogs').getData();
        return systemLogs;
    }
};