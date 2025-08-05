
// @ts-check
// Always arrive here with a validated token converted to the userEmail
/**
 * 
 * @param {GoogleAppsScript.Events.DoGet} e 
 * @param {string} userEmail 
 * @returns 
 */
VotingService.WebApp.doGet = function (e, userEmail) {
    return this._renderVotingOptions(userEmail)
}

/**
 * 
 * @param {string} userEmail - The email address of the user.
 * 
 * @description Renders the voting options for the user.
 * It retrieves the active elections and generates a prefilled URL for each election.
 * The prefilled URL includes a token field to ensure secure voting.
 * 
 * @throws {Error} If there is an issue retrieving the elections or generating the prefilled URLs.
 * @returns Google Apps HTML output for the voting options.
 */
VotingService.WebApp._renderVotingOptions = function (userEmail) {
    const electionDataForTemplate = this._getElectionsForTemplate(userEmail);

    const htmlTemplate = HtmlService.createTemplateFromFile('services/VotingService/ActiveVotes.html');
    htmlTemplate.userEmail = userEmail;
    console.log('Rendering voting options for user:', userEmail, 'with elections:', electionDataForTemplate);
    htmlTemplate.elections = electionDataForTemplate;
    return htmlTemplate.evaluate();
}
/**
 * Process the elections so that no URL (ID) is published for an inactive election.
 * @param {string} userEmail - The email address of the user.
 * @returns {Array<Election>} - Returns an array of Election objects with prefilled URLs for voting.    
 */
VotingService.WebApp._getElectionsForTemplate = function(userEmail) {
    const elections = VotingService.Data.getElectionData();

    const today = new Date();
    elections.forEach(election => {
        const startDate = election.Start ? new Date(election.Start) : null;
        const endDate = election.End ? new Date(election.End) : null;
        election.ID = (startDate === null || startDate <= today) && (endDate === null || today <= endDate) ? this._getFormUrlWithTokenField(userEmail, election) : null;
    });
    return elections;
},
/**
 * 
 * @param {string} userEmail - The email address of the user.
 * @param {Election} election - The election object containing the form ID.
 * @returns a prefilled ballot URL with a token field for the user.
 * 
 * @description Generates a prefilled URL for the voting form with a token field.
 * This URL is used to ensure that the user can vote securely and their vote is recorded.
 * It generates a token for the user and stores it in the TokenStorage.
 * The prefilled URL includes the token field to validate the user's vote.
 * 
 * @throws {Error} If there is an issue generating the prefilled URL or storing the token.
 */
VotingService.WebApp._getFormUrlWithTokenField = function (userEmail, election) {
    const token = Common.Auth.TokenManager.generateToken();
    Common.Auth.TokenStorage.storeToken(userEmail, token);
    const preFilledUrl = VotingService.createPrefilledUrlWithTitle(election.ID, TOKEN_ENTRY_FIELD_TITLE, token);
    return preFilledUrl
}

/**
 * 
 * @returns {Array<Election>} - Returns an array of active Election objects.
 * Each object contains properties like Title, Form ID, Organizers, Start Date, End Date, and Voters.
 */
VotingService.WebApp.getProcessedElections_ = function () {
    const elections = VotingService.Data.getElectionData();

    const today = new Date();
    elections.forEach(election => {
        const startDate = election.Start ? new Date(election.Start) : null;
        const endDate = election.End ? new Date(election.End) : null;
        election.ID = (startDate === null || startDate <= today) && (endDate === null || today <= endDate) ? election.ID : null;
    });
    return elections;
}