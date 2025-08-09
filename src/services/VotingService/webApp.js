
// @ts-check
// Always arrive here with a validated token converted to the userEmail
/**
 * 
 * @param {GoogleAppsScript.Events.DoGet} e 
 * @param {string} userEmail
 * @param {GoogleAppsScript.HTML.HtmlTemplate} htmlTemplate
 * @returns 
 */
VotingService.WebApp.doGet = function (e, userEmail, htmlTemplate) {
    const service = e.parameter.service;
    // @ts-ignore
    if (service !== VotingService.service) {
        // @ts-ignore
        return HtmlService.createHtmlOutput(`<h1>Invalid service. Was expecting ${VotingService.service} but got ${service}</p>`);

    }
    htmlTemplate.contentFileName = 'services/VotingService/ActiveVotes.html';
    return this._renderVotingOptions(userEmail, htmlTemplate);
}

/**
 * 
 * @param {string} userEmail - The email address of the user.
 * @param {GoogleAppsScript.HTML.HtmlTemplate} htmlTemplate - The HTML template to render.  
 * 
 * @description Renders the voting options for the user.
 * It retrieves the active elections and generates a prefilled URL for each election.
 * The prefilled URL includes a token field to ensure secure voting.
 * 
 * @throws {Error} If there is an issue retrieving the elections or generating the prefilled URLs.
 * @returns Google Apps HTML output for the voting options.
 */
VotingService.WebApp._renderVotingOptions = function (userEmail, htmlTemplate) {
    const electionDataForTemplate = this._getElectionsForTemplate(userEmail);

    htmlTemplate.userEmail = userEmail;
    htmlTemplate.elections = electionDataForTemplate;
    console.log('Rendering voting options for user:', userEmail, 'with elections:', electionDataForTemplate);

    const htmlOutput = htmlTemplate.evaluate().setTitle('SCCCC Voting Service');
    return htmlOutput;
}
/**
 * Process the elections so that no URL (ID) is published for an inactive election.
 * @param {string} userEmail - The email address of the user.
 * @returns {Array<ProcessedElection>} - Returns an array of ProcessedElection objects with prefilled URLs for voting.    
 */
VotingService.WebApp._getElectionsForTemplate = function (userEmail) {
    const elections = VotingService.Data.getElectionData();

    const processedElections = elections.map(election => {
        const result = {};
        try {
            result.title = election.Title;
            result.opens = election.Start;
            result.closes = election.End;
            if (election.Voters.includes(userEmail)) {
                result.status = "Inactive - you've already voted"
                return result; // Skip further processing if user has already voted
            }

            const ballot = VotingService.getBallot(election.ID);
            console.log(`ballot ${ballot.getTitle()} is published: ${ballot.isPublished()}`);
            console.log(`ballot ${ballot.getTitle()} is accepting responses: ${ballot.isAcceptingResponses()}`);
            if (!ballot.isPublished()) {
                result.status = "Inactive - election not open yet"
                return result; // Skip further processing if election has not started
            }
            // Ballot is published
            if (!ballot.isAcceptingResponses()) {
                result.status = "Inactive - election has closed"
                return result; // Skip further processing if election has ended
            }
            // Ballot is published and accepting responses
            result.url = this._getFormUrlWithTokenField(userEmail, election);
            result.status = "Active";
        } catch (error) {
            console.error(`Error processing election  for user ${userEmail}:`, election, error);
            throw new Error(`Error processing election ${election.Title} for user ${userEmail}: ${error.message}`);
        }
        return result
    });
    return processedElections;
}

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