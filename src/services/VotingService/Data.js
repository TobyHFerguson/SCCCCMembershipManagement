/// <reference path="./VotingService.d.ts" />
/// <reference path="./Auth.d.ts" />
/// <reference path
/// <reference path="../../types/global.d.ts" />
//@ts-check
VotingService.Data = {
    /**
     * @returns {VotingService.Election[]} - Returns an array of Election objects.
     * Each object contains properties like Title, Form ID, Organizers, Start Date, End Date, and Voters.
     * The data is retrieved from the Elections sheet.
     * 
     * @description Retrieves the election data from the Elections sheet.
     * This method abstracts the underlying storage mechanism, allowing for flexibility in implementation.
     * It fetches the data from the sheet and returns it as an array of Election objects.
     */
    getElectionData: function () {
        const electionData = SheetAccess.getData('Elections');
        return electionData;
    },
    /**
     * Sets the election data in the Elections sheet.
     * This will overwrite the existing data in the sheet.
     * 
     * @param {Array<VotingService.Election>} elections - Array of election objects to be stored in the Elections sheet.
     * Each object should have properties like Title, Form ID, Managers, Start Date, End Date, and Voters.
     */
    storeElectionData: function (elections) {
        SheetAccess.setData('Elections', elections);
    },
    /**
     * Checks if a user has already voted in a specific election.
     * @param {string} email - The email of the user to check.
     * @param {VotingService.Election} election - The election to check against.
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
            const ss = SpreadsheetApp.openById(spreadsheetId);
            let sheet = ss.getSheetByName('Validated Results');
            if (!sheet) {
                // Create the sheet if it doesn't exist
                sheet = ss.insertSheet('Validated Results');
            }
            return sheet;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            AppLogger.error('VotingService.Data', `Failed to get Validated Results sheet for ${spreadsheetId}: ${errorMessage}`);
            return undefined;
        }
    }

}
