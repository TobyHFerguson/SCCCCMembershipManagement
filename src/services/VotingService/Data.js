/// <reference path="./VotingService.d.ts" />
/// <reference path="./Auth.d.ts" />
/// <reference path
/// <reference path="../../common/data/storage/SpreadsheetManager.d.ts" />
/// <reference path="../../fiddler.d.ts" />
//@ts-check
VotingService.Data = {
    /**
     * @returns {Fiddler<VotingService.Election>} Fiddler instance for the Elections sheet.
     */
    getFiddler_: function () {
        return Common.Data.Storage.SpreadsheetManager.getFiddler('Elections');
    },

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
        const electionData = this.getFiddler_().getData();
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
        this.getFiddler_().setData(elections).dumpValues();
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
     * 
     * @param {string} spreadsheetId the spreadsheetId to be used
     * @returns A fiddler attached to the valid results sheet, or undefined
     */
    getFiddlerForValidResults: function (spreadsheetId) {
        if (!spreadsheetId) {
            return undefined
        }
        const fiddler = bmPreFiddler.PreFiddler().getFiddler({ id: spreadsheetId, sheetName: 'Validated Results', createIfMissing: true })
        return fiddler
    }

}
