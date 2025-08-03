//@ts-check
VotingService.Data = {
    getFiddler_: ()=> {
        return Common.Data.Storage.SpreadsheetManager.getFiddler('VotingData');
    },
    /**
     * 
     * @returns {Array<Election>} - Returns an array of Election objects.
     * Each object contains properties like Title, Form ID, Organizers, Start Date, End Date, and Voters.
     * The data is retrieved from the VotingData sheet.
     * 
     * @description Retrieves the election data from the VotingData sheet.
     * This method abstracts the underlying storage mechanism, allowing for flexibility in implementation.
     * It fetches the data from the sheet and returns it as an array of Election objects.
     */
    getElectionData: () => {
        const votingData = this.getFiddler_().getData();
        return votingData;
    },
    /**
     * Sets the election data in the VotingData sheet.
     * This will overwrite the existing data in the sheet.
     * 
     * @param {Array<Election>} elections - Array of election objects to be stored in the VotingData sheet.
     * Each object should have properties like Title, Form ID, Managers, Start Date, End Date, and Voters.
     */
    setElectionData: (elections) => {
        this.getFiddler_().setData(elections).dumpValues();
    }
}
