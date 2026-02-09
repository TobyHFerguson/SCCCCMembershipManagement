/// <reference path="./VotingService.d.ts" />
/// <reference path="./Auth.d.ts" />
/// <reference path
/// <reference path="../../types/global.d.ts" />
//@ts-check
VotingService.Data = {
    /**
     * @returns {ValidatedElection[]} - Returns an array of ValidatedElection objects.
     * Each object contains properties like Title, Start, End, Form Edit URL, Election Officers, and TriggerId.
     * The data is retrieved from the Elections sheet via DataAccess.
     * 
     * @description Retrieves the election data from the Elections sheet.
     * This method delegates to DataAccess.getElections() which returns typed ValidatedElection instances.
     * It abstracts the underlying storage mechanism, allowing for flexibility in implementation.
     */
    getElectionData: function () {
        return DataAccess.getElections();
    },
    /**
     * Sets the election data in the Elections sheet.
     * This will overwrite the existing data in the sheet.
     * 
     * @param {ValidatedElection[]} elections - Array of validated election objects to be stored in the Elections sheet.
     * Each object should have properties like Title, Form Edit URL, Election Officers, Start Date, End Date, and TriggerId.
     */
    storeElectionData: function (elections) {
        SheetAccess.setData('Elections', elections);
    },
    /**
     * Checks if a user has already voted in a specific election.
     * @param {string} email - The email of the user to check.
     * @param {ValidatedElection} election - The validated election to check against.
     * @returns {boolean} - True if the user has voted, false otherwise.
     */
    hasVotedAlreadyInThisElection: function (email, election) {
       if (!email || !election || !election['Form Edit URL']) {
            return false
        }
        const spreadsheetId = VotingService.getSpreadsheetIdFromElection(election);
        const tokenData = VotingService.Auth.getAllTokens(spreadsheetId);
        const voters = tokenData.map(token => token.Email);
        return voters.find(voterEmail => voterEmail.toLowerCase() === email.toLowerCase()) !== undefined;
    },

    
    /**
     * Get the Validated Results sheet for an election results spreadsheet
     * @param {string} spreadsheetId - The spreadsheet ID to access
     * @returns {GoogleAppsScript.Spreadsheet.Sheet|undefined} The Validated Results sheet, or undefined
     */
    getValidatedResultsSheet: function (spreadsheetId) {
        if (!spreadsheetId) {
            return undefined;
        }
        try {
            // Use SheetAccess.getSheetById with createIfMissing=true to get or create the sheet
            return SheetAccess.getSheetById(spreadsheetId, 'Validated Results', true);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            AppLogger.error('VotingService.Data', `Failed to get Validated Results sheet for ${spreadsheetId}: ${errorMessage}`);
            return undefined;
        }
    }

}
