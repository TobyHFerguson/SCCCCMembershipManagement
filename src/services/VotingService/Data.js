//@ts-check
VotingService.Data = {
    getFiddler_: function () {
        return Common.Data.Storage.SpreadsheetManager.getFiddler('Elections');
    },
    /**
     * 
     * @returns {Election[]} - Returns an array of Election objects.
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
     * @param {Array<Election>} elections - Array of election objects to be stored in the Elections sheet.
     * Each object should have properties like Title, Form ID, Managers, Start Date, End Date, and Voters.
     */
    storeElectionData: function (elections) {
        this.getFiddler_().setData(elections).dumpValues();
    },
    hasVotedAlreadyInThisElection: function (email, election) {
        return this.getVoters_(election).some(voter => voter == email)
    },
    /**
     * 
     * @param {Election} election the election to be searched
     * @returns {string[]} voters an array of the emails of voters
     */
    getVoters_: function (election) {
        if (!election || !election.TriggerId) {
            return []
        }
        const fiddler = this.getFiddlerForValidResults(election.TriggerId)
        if (!fiddler) {
            return []
        }
        const voters = fiddler.getData().map(vote => vote['Voter Email']);
        return voters
    },
    /**
     * 
     * @param {string} triggerId The triggerId to be used
     * @returns {string}  the id of the results spreadsheet for this trigger, or undefined if it can't be found
     */
    getResultIdForTrigger_: function(triggerId) {
        const trigger = ScriptApp.getProjectTriggers().find(t => t.getUniqueId() === triggerId)
        if (!trigger) {
            return undefined
        }
        const resultsId = trigger.getTriggerSourceId()
        return resultsId;
    },
    /**
     * 
     * @param {string} triggerId the triggerId to be used
     * @returns A fiddler attached to the valid results sheet, or undefined
     */
    getFiddlerForValidResults: function(triggerId) {
         const resultsId = this.getResultIdForTrigger_(triggerId)
        if (!resultsId) {
            return undefined
        }
        // @ts-ignore
        const fiddler = bmPreFiddler.PreFiddler().getFiddler({ id: resultsId, sheetName: 'Validated Results', createIfMissing: true })
        return fiddler
    }

}
