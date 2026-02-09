/// <reference path="../../types/global.d.ts" />

/**
 * DataAccess Module
 * 
 * Purpose: High-level data access functions for member data and other shared data.
 * Uses SheetAccess for sheet access and ValidatedMember for type-safe member data.
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
 * DataAccess object - provides high-level data access functions
 */
// @ts-ignore - TypeScript sees identical types as different due to ActionSpec resolution order
var DataAccess = {
    getBootstrapData: () => {
        const allData = SheetAccess.getDataAsArrays('Bootstrap');
        if (allData.length === 0) { return []; }
        const headers = allData[0];
        const rows = allData.slice(1);
        if (rows.length === 0) { return []; }
        return ValidatedBootstrap.validateRows(rows, headers, 'DataAccess.getBootstrapData');
    },
    /**
     * Get active members with write-context for selective cell writes.
     * Returns validated members plus the sheet, originalRows, and headers needed
     * for MemberPersistence.writeChangedCells().
     *
     * Usage:
     *   const { members, sheet, originalRows, headers } = DataAccess.getActiveMembersForUpdate();
     *   // ... Manager modifies members in place ...
     *   MemberPersistence.writeChangedCells(sheet, originalRows, members, headers);
     *
     * @returns {{members: ValidatedMember[], sheet: GoogleAppsScript.Spreadsheet.Sheet, originalRows: any[][], headers: string[]}}
     */
    getActiveMembersForUpdate: function() {
        const sheet = SheetAccess.getSheet('ActiveMembers');
        const allData = sheet.getDataRange().getValues();
        const headers = allData[0];
        const originalRows = allData.slice(1);
        const members = ValidatedMember.validateRows(
            originalRows, headers, 'DataAccess.getActiveMembersForUpdate');
        return { members, sheet, originalRows, headers };
    },
    getEmailAddresses: function () {
        // Delegate to getMembers for consistency
        return DataAccess.getMembers().map(member => member.Email.toLowerCase());
    },
    getMembers: () => {
        // Delegate to getActiveMembersForUpdate for single validation path
        return DataAccess.getActiveMembersForUpdate().members;
    },
    getActionSpecs: () => {
        // Use getDataWithRichText to read native RichText links directly
        // IMPORTANT: Body column contains RichText links, not formulas
        const allData = SheetAccess.getDataWithRichText('ActionSpecs', ['Body']);
        if (allData.length === 0) { return {}; }
        
        // Extract headers and rows
        const headers = Object.keys(allData[0]);
        const rows = allData.map(obj => headers.map(h => obj[h]));
        
        // Validate rows using ValidatedActionSpec
        const validatedSpecs = ValidatedActionSpec.validateRows(rows, headers, 'DataAccess.getActionSpecs');
        
        // Convert validated specs array to object keyed by Type
        const actionSpecs = Object.fromEntries(validatedSpecs.map(spec => [spec.Type, spec]));
        
        // Process Body field: convert Google Docs URLs to HTML
        for (const actionSpec of Object.values(actionSpecs)) {
            // Check if Body is a RichText object {text, url}
            const body = actionSpec.Body;
            // @ts-ignore - TypeScript doesn't understand that body !== null before 'in' operator
            if (body && typeof body === 'object' && body !== null && 'url' in body) {
                /** @type {{text: string, url: string}} */
                const bodyObj = body; // Explicit type assertion
                if (bodyObj.url) {
                    // If it's a Google Docs URL, convert to HTML
                    if (bodyObj.url.includes('docs.google.com/document/d/')) {
                        actionSpec.Body = DocsService.convertDocToHtml(bodyObj.url);
                    } else {
                        // For other links, just use the text
                        actionSpec.Body = bodyObj.text;
                    }
                }
            }
            // If Body is still a string and contains hyperlink formula, parse it (backward compatibility)
            else if (typeof actionSpec.Body === 'string' && actionSpec.Body.includes('=hyperlink(')) {
                let match = actionSpec.Body.match(/=hyperlink\("(https:\/\/docs.google.com\/document\/d\/[^"]+)"/);
                if (match) {
                    let url = match[1];
                    actionSpec.Body = DocsService.convertDocToHtml(url);
                }
            }
        }
        return actionSpecs;
    },
    getPublicGroups: () => {
        const allData = SheetAccess.getDataAsArrays('PublicGroups');
        if (allData.length === 0) { return []; }
        const headers = allData[0];
        const rows = allData.slice(1);
        if (rows.length === 0) { return []; }
        return ValidatedPublicGroup.validateRows(rows, headers, 'DataAccess.getPublicGroups');
    },
    getMember: (email) => {
        email = email.toLowerCase();
        // Use SheetAccess with ValidatedMember for single member lookup
        const allData = SheetAccess.getDataAsArrays('ActiveMembers');
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
        // Use SheetAccess with selective cell updates via MemberPersistence
        const sheet = SheetAccess.getSheet('ActiveMembers');
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
        
        return true;
    },
    isMember:(email) => {
        email = email.toLowerCase();
        // Use SheetAccess for quick email check
        const allData = SheetAccess.getDataAsArrays('ActiveMembers');
        const headers = allData[0];
        const emailCol = headers.indexOf('Email');
        const rows = allData.slice(1);
        
        return rows.some(row => row[emailCol]?.toString().toLowerCase() === email);
    },
    /**
     * Get all elections as validated objects (read-only accessor).
     * Wraps SheetAccess + ValidatedElection.validateRows at the typed domain boundary.
     *
     * @returns {ValidatedElection[]} Array of valid ValidatedElection instances
     */
    getElections: () => {
        const allData = SheetAccess.getDataAsArrays('Elections');
        if (allData.length === 0) { return []; }
        const headers = allData[0];
        const rows = allData.slice(1);
        if (rows.length === 0) { return []; }
        return ValidatedElection.validateRows(rows, headers, 'DataAccess.getElections');
    },
    getSystemLogs: () => {
        return SheetAccess.getData('SystemLogs');
    },
    /**
     * Get all transactions as validated objects (read-only accessor).
     * Wraps SheetAccess + ValidatedTransaction.validateRows at the typed domain boundary.
     *
     * @returns {ValidatedTransaction[]} Array of valid ValidatedTransaction instances
     */
    getTransactions: () => {
        const allData = SheetAccess.getDataAsArrays('Transactions');
        if (allData.length === 0) { return []; }
        const headers = allData[0];
        const rows = allData.slice(1);
        if (rows.length === 0) { return []; }
        return ValidatedTransaction.validateRows(rows, headers, 'DataAccess.getTransactions');
    },
    /**
     * Get transactions with write-context for selective cell writes.
     * Returns validated transactions plus the sheet and headers needed
     * for ValidatedTransaction.writeChangedCells().
     *
     * Usage:
     *   const { transactions, headers, sheet } = DataAccess.getTransactionsForUpdate();
     *   // ... Manager modifies transactions in place ...
     *   ValidatedTransaction.writeChangedCells(sheet, transactions, headers);
     *
     * @returns {{transactions: ValidatedTransaction[], headers: string[], sheet: GoogleAppsScript.Spreadsheet.Sheet}}
     */
    getTransactionsForUpdate: () => {
        const sheet = SheetAccess.getSheet('Transactions');
        const allData = sheet.getDataRange().getValues();
        const headers = allData.length > 0 ? allData[0] : [];
        const rows = allData.length > 1 ? allData.slice(1) : [];
        const transactions = rows.length > 0
            ? ValidatedTransaction.validateRows(rows, headers, 'DataAccess.getTransactionsForUpdate')
            : [];
        return { transactions, headers, sheet };
    },
    /**
     * Get ExpirationFIFO items as validated objects (read-only accessor).
     * Wraps SheetAccess + ValidatedFIFOItem.validateRows at the typed domain boundary.
     *
     * @returns {ValidatedFIFOItem[]} Array of valid ValidatedFIFOItem instances
     */
    getExpirationFIFO: () => {
        const allData = SheetAccess.getDataAsArrays('ExpirationFIFO');
        if (allData.length === 0) { return []; }
        const headers = allData[0];
        const rows = allData.slice(1);
        if (rows.length === 0) { return []; }
        return ValidatedFIFOItem.validateRows(rows, headers, 'DataAccess.getExpirationFIFO');
    },
    /**
     * Get expiry schedule data (read accessor).
     * Returns raw objects from the ExpirySchedule sheet.
     *
     * @returns {MembershipManagement.ExpirySchedule[]} Array of expiry schedule entries
     */
    getExpirySchedule: () => {
        return /** @type {MembershipManagement.ExpirySchedule[]} */ (SheetAccess.getData('ExpirySchedule'));
    },
    /**
     * Get election configuration entries as validated objects (read-only accessor).
     * Wraps SheetAccess + ValidatedElectionConfig.validateRows at the typed domain boundary.
     *
     * @returns {ValidatedElectionConfig[]} Array of valid ValidatedElectionConfig instances
     */
    getElectionConfiguration: () => {
        const allData = SheetAccess.getDataAsArrays('ElectionConfiguration');
        if (allData.length === 0) { return []; }
        const headers = allData[0];
        const rows = allData.slice(1);
        if (rows.length === 0) { return []; }
        return ValidatedElectionConfig.validateRows(rows, headers, 'DataAccess.getElectionConfiguration');
    }
};

// Node.js module export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DataAccess };
}