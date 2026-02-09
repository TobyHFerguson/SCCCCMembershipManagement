
// @ts-check
// Always arrive here with a validated token converted to the userEmail
/// <reference path="./Auth.d.ts" />
/// <reference path="./VotingService.d.ts" />

/**
 * @deprecated This WebApp.doGet is no longer used in the SPA flow.
 * Voting service is accessed via API endpoints from the SPA home page.
 * This remains for backward compatibility with legacy magic link flow only.
 * 
 * @param {GoogleAppsScript.Events.DoGet} e 
 * @param {string} userEmail
 * @param {GoogleAppsScript.HTML.HtmlTemplate} htmlTemplate
 * @returns 
 */
VotingService.WebApp.doGet = function (e, userEmail, htmlTemplate) {
    htmlTemplate.contentFileName = 'services/VotingService/ActiveVotes.html';
    return VotingService.WebApp._renderVotingOptions(userEmail, htmlTemplate);
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
    const electionDataForTemplate = VotingService.WebApp._getElectionsForTemplate(userEmail);

    htmlTemplate.userEmail = userEmail;
    htmlTemplate.elections = electionDataForTemplate;
    console.log('Rendering voting options for user:', userEmail, 'with elections:', electionDataForTemplate);

    const htmlOutput = htmlTemplate.evaluate().setTitle('SCCCC Voting Service');
    return htmlOutput;
}
/**
 * Process the elections so that no URL (ID) is published for an inactive election.
 * @param {string} userEmail - The email address of the user.
 * @returns {Array<VotingService.ProcessedElection>} - Returns an array of ProcessedElection objects with prefilled URLs for voting.    
 */
VotingService.WebApp._getElectionsForTemplate = function (userEmail) {
    const elections = VotingService.Data.getElectionData();
    console.log(`Raw elections data retrieved for user ${userEmail}:`, elections);
    
    // Filter out empty/invalid election rows (rows with empty Title, Start, or End)
    const validElections = elections.filter(election => {
        return election.Title && 
               election.Title.trim() !== '' && 
               election.Start && 
               election.End;
    });
    
    console.log(`Filtered to ${validElections.length} valid elections (from ${elections.length} total rows)`);
    
    /** @type {VotingService.ProcessedElection[]} */
    const processedElections = validElections.map(election => {
        const result = {};
        try {
            result.title = election.Title;
            // Convert Date objects to ISO strings for serialization via google.script.run
            result.opens = new Date(election.Start).toISOString();
            result.closes = new Date(election.End).toISOString();
            if (VotingService.Data.hasVotedAlreadyInThisElection(userEmail, election)) {
                result.status = "Inactive - you've already voted"
                return result; // Skip further processing if user has already voted
            }

            const ballot = VotingService.getBallot(election['Form Edit URL']);
            console.log(`ballot ${ballot.getTitle()} is published: ${ballot.isPublished()}`);
            console.log(`ballot ${ballot.getTitle()} is accepting responses: ${ballot.isAcceptingResponses()}`);
            switch (VotingService.getElectionState(election)) {
                case VotingService.Constants.ElectionState.UNOPENED:
                    result.status = "Inactive - election not open yet"
                    break;
                case VotingService.Constants.ElectionState.CLOSED:
                    result.status = "Inactive - election has closed"
                    break;
                case VotingService.Constants.ElectionState.ACTIVE:
                    if (!ballot.isPublished() || !ballot.isAcceptingResponses()) {
                        result.status = "Inactive - ballot is not accepting responses"
                    }
                    // Ballot is published
                    else {
                        result.url = VotingService.WebApp._getFormUrlWithTokenField(userEmail, election);
                        result.status = "Active";
                    }
                    break;
                default:
                    result.status = "Inactive - unknown status"
            }
        } catch (error) {
            console.error(`Error processing election  for user ${userEmail}:`, election, error);
            throw new Error(`Error processing election ${election.Title} for user ${userEmail}: ${error.message}`);
        }
        return result
    });
    /** @type {VotingService.ProcessedElection[]} */
    return processedElections;
}

/**
 * 
 * @param {string} userEmail - The email address of the user.
 * @param {ValidatedElection} election - The election object containing the form ID.
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
    const spreadsheetId = VotingService.getSpreadsheetIdFromElection(election);
    const token = VotingService.Auth.generateAndStoreToken(userEmail,spreadsheetId).Token;
    const preFilledUrl = VotingService.createPrefilledUrlWithTitle(election['Form Edit URL'], VotingService.Constants.TOKEN_ENTRY_FIELD_TITLE, token);
    return preFilledUrl
}