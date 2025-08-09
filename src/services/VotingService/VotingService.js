// @ts-check

const BALLOT_FOLDER_ID = '1ncuM7AyS9HtqtM842SUjHnhLG6_Pa_RB';
const VOTE_TITLE_COLUMN_NAME = 'Title';
const FORM_ID_COLUMN_NAME = 'ID';
const MANAGERS_COLUMN_NAME = 'Managers'; // Can be comma-separated
const TRIGGER_STATUS_COLUMN_NAME = 'Trigger Status';
const VOTE_DATA_SHEET_ID = '1FN1vogIDDWdqghflOF6hNuDDW1cqFQpSGX8GhXLYyyw'; // Replace with your central vote data sheet ID
const REGISTRATION_SHEET_NAME = 'Elections'; // Update with your sheet name
const TOKEN_ENTRY_FIELD_TITLE = 'VOTING TOKEN'; // Adjust
const TOKEN_HELP_TEXT = 'This question is used to validate your vote. Do not modify this field.';
const CONFIRMATION_MESSAGE = 'Your vote has been recorded successfully. You will be sent an email indicating how your vote was handled. Thank you for participating!';
// Helper to extract components from the pre-filled URL (used by handleSheetEdit and renderVotingOptions)
VotingService.parsePrefilledFormUrlComponents = function (url) {
    const result = {};
    // Extract formId
    const formIdMatch = url.match(/\/forms\/d\/e\/([a-zA-Z0-9_-]+)\/viewform/);
    if (formIdMatch && formIdMatch[1]) {
        result.formId = formIdMatch[1];
    } else {
        throw new Error(`Invalid pre-filled URL format: ${url}`);
    }

    // Extract entry.ID from query parameters
    const queryStringIndex = url.indexOf('?');
    if (queryStringIndex !== -1) {
        const queryString = url.substring(queryStringIndex + 1);
        // Split by '&' to get individual parameters
        const params = queryString.split('&');
        for (let i = 0; i < params.length; i++) {
            const param = params[i];
            // Look for a parameter that starts with 'entry.' and has an '=' sign
            if (param.startsWith('entry.') && param.includes('=')) {
                const parts = param.split('=');
                if (parts.length > 1) {
                    // Extract the ID part (e.g., '851578578' from 'entry.851578578')
                    result.entryTokenId = parts[0].substring('entry.'.length);
                    // Assuming the first such entry is our token field, we can break
                    break;
                }
            }
        }
    }
    return result;
}

VotingService.getBallotFolderId = function () {
    const ffi = PropertiesService.getScriptProperties().getProperty('BALLOT_FOLDER_ID') || BALLOT_FOLDER_ID;
    return ffi;
}
/**
 * Extracts the Form ID from a Google Forms URL.
 * This function handles 'edit', 'viewform', and base URLs.
 *
 * @param {string} url The URL of the Google Form.
 * @return {string|null} The extracted Form ID if found, otherwise null.
 */
VotingService.extractGasFormId = function (url) {
    // Regex for the 'viewform' URL (public-facing)
    let match = url.match(/d\/e\/(.*?)\/viewform/);
    if (match && match.length > 1) {
        return match[1];
    }

    // Regex for the 'edit' URL (in the editor)
    match = url.match(/d\/(.*?)\/edit/);
    if (match && match.length > 1) {
        return match[1];
    }

    // Regex for the base URL (e.g., https://docs.google.com/forms/d/ID)
    match = url.match(/d\/(.*?)$/);
    if (match && match.length > 1) {
        // This regex is broad, so we'll check for a valid ID format.
        // A Google Form ID is typically a long alphanumeric string.
        // If there's a trailing slash or other characters, it won't be a valid ID.
        // You can add more checks if needed, but this handles the common case.
        const potentialId = match[1];
        if (potentialId.indexOf('/') === -1) {
            return potentialId;
        }
    }

    // If no patterns match, return null.
    return null;
}

/**
 * @description This function manages the lifecycle of elections by checking their start and end dates.
 * It opens elections that have started and closes those that have ended.
 * It also attaches or removes triggers as necessary.
 * 
 * @returns {void}
 */
VotingService.manageElectionLifecycles = function () {
    const elections = VotingService.Data.getElectionData();
    let changesMade = false;
    elections.forEach(election => {
        const ballotId = election.ID;
        if (!ballotId) {
            console.warn(`Election "${election.Title}" has no Form ID. Skipping lifecycle management.`);
            return;
        }

        const ballot = VotingService.getBallot(ballotId);
        if (!ballot) {
            console.warn(`Ballot with ID "${ballotId}" not found for election "${election.Title}". Skipping lifecycle management.`);
            return;
        }
        const today = new Date();
        if (!ballot.isPublished() && election.Start && new Date(election.Start) <= today) {
            // If the form is not published and the start date has passed, publish it.
            election.TriggerId = this.openElection_(ballot);
            console.log(`Opened election "${election.Title}" with ID "${ballotId}" as the start date has passed. Attached trigger ID: ${election.TriggerId} `);
            changesMade = changesMade || true
            return
        }

        if (ballot.isPublished() && ballot.isAcceptingResponses() && election.End && new Date(election.End) < today) {
            // If the form is published and the end date has passed, close it.
            this.closeElection_(this.getBallot(election.ID), election.TriggerId);
            console.log(`Closed election "${election.Title}" with ID "${ballotId}" as the end date has passed.`);
            election.TriggerId = null; // Clear the trigger ID after closing
            changesMade = changesMade || true;
            return
        }
    });
    if (changesMade) {
        console.log('Changes made to elections during lifecycle management. Updating elections storage.');
        VotingService.Data.storeElectionData(elections);
    }
}

/**
 * 
 * @param {GoogleAppsScript.Forms.Form} ballot Ballot for which the election is being opened.
 * @returns {string} The unique ID of the created trigger.
 * 
 * @description Opens the election by setting the ballot to accept responses and attaching the onSubmit trigger.
 * This is typically called when the election's start date has passed.
 * It updates the election's status and attaches the necessary trigger for handling form submissions.
 * 
 * @throws {Error} If there is an issue attaching the trigger or if the form does not have a valid destination.
 */
VotingService.openElection_ = function (ballot) {
    ballot.setPublished(true);
    return this.attachOnSubmitTrigger_(ballot)
}
/**
 * 
 * @param {GoogleAppsScript.Forms.Form} ballot Ballot to which a trigger is to be attached.
 * @returns {string} The unique ID of the created trigger.
 * 
 * @description Attaches the votingFormSubmitHandler trigger to the specified ballot form's underlying response spreadsheet.
 * This will handle form submissions and record votes.
 * 
 * @throws {Error} If there is an issue attaching the trigger, such as the form not having a valid destination.
 */
VotingService.attachOnSubmitTrigger_ = function (ballot) {
    const formDestinationType = ballot.getDestinationType();
    if (formDestinationType !== FormApp.DestinationType.SPREADSHEET) {
        throw new Error(`Ballot '${ballot.getTitle()}' does not have a valid destination set. Please set a destination to a Google Sheet.`);
    }
    const triggerFunctionName = 'ballotSubmitHandler'; // Ensure this matches the function name in triggers.js
    const trigger = ScriptApp.newTrigger(triggerFunctionName)
        .forForm(ballot.getDestinationId())
        .onFormSubmit()
        .create();
    return trigger.getUniqueId();
}

/**
 * 
 * @param {GoogleAppsScript.Forms.Form} ballot - the ballot whose election is being closed.
 * @param {string} triggerId - the ID of the trigger associated with this election.
 * @returns true if the election was successfully closed, false otherwise.
 * 
 * @description Closes the election by setting the ballot to not accept responses and removing the onSubmit trigger.
 * This is typically called when the election's end date has passed.
 * It updates the election's status and cleans up the trigger.
 * 
 * @throws {Error} If there is an issue removing the trigger.
 */
VotingService.closeElection_ = function (ballot, triggerId) {
    ballot.setAcceptingResponses(false);
    return this.removeOnSubmitTrigger_(triggerId)
}

/**
 * 
 * @param {string} triggerId - the trigger ID to remove.
 * @returns {boolean} - true if the trigger was successfully removed, false if it was not found.
 * 
 * @description Removes the onSubmit trigger associated with the given trigger ID.
 * This is useful for cleaning up triggers when an election ends or when a form is no longer needed.
 */
VotingService.removeOnSubmitTrigger_ = function (triggerId) {
    const triggers = ScriptApp.getProjectTriggers();
    const trigger = triggers.find(t => t.getUniqueId() === triggerId);
    if (trigger) {
        ScriptApp.deleteTrigger(trigger);
        console.log(`Deleted trigger with ID: ${triggerId}`);
        return true;
    } else {
        console.warn(`No trigger found with ID: ${triggerId}`);
        return false;
    }
}


function runExtractGasFormId() {
    const urls = [
        'https://docs.google.com/forms/d/1zJi3Wt_AXZ3W5ML2wJ3zxYS923r-NTlBb863Ur-b_Ps/edit',
        'https://docs.google.com/forms/d/e/1zJi3Wt_AXZ3W5ML2wJ3zxYS923r-NTlBb863Ur-b_Ps/viewform',
        'https://docs.google.com/forms/d/1zJi3Wt_AXZ3W5ML2wJ3zxYS923r-NTlBb863Ur-b_Ps/',
        'https://docs.google.com/forms/d/1zJi3Wt_AXZ3W5ML2wJ3zxYS923r-NTlBb863Ur-b_Ps',
        'https://docs.google.com/forms/d/1zJi3Wt_AXZ3W5ML2wJ3zxYS923r-NTlBb863Ur-b_Ps/edit?usp=sharing'
    ]
    urls.forEach(url => {
        const formId = VotingService.extractGasFormId(url);
        console.log(`Extracted Form ID from "${url}": ${formId}`);
    });
}

/**
 * 
 * @param {string} formId - The ID (ID or URL) of the Google Form to create a ballot from.
 * @param {Array<string>} managers - A list of email addresses to share the results spreadsheet with.
 * @return {string} The published URL of the new, public form.
 */
VotingService.createBallotForm = function (formId, managers) {
    const newFormId = this.makePublishedCopyOfFormInFolder_(formId, this.getBallotFolderId());

    const form = FormApp.openByUrl(newFormId);

    // Not a quiz
    form.setIsQuiz(false);
    // Dont collect email addresses

    // Responses Settings
    // Don't collect email addresses
    form.setCollectEmail(false);
    // No editing of responses
    form.setAllowResponseEdits(false);

    // Presentation Settings
    // Dont shuffle question order
    form.setShuffleQuestions(false);


    // After Submission settings
    // Configure confirmation message
    form.setConfirmationMessage(CONFIRMATION_MESSAGE);
    // Disable further votes
    form.setShowLinkToRespondAgain(false)
    // Don't allow viewing of results
    form.setPublishingSummary(false);

    // I'd like to disable autosave, but autosaving only applies to Google account holders, and must be done manually.

    // Add a token question to the form
    this.addTokenQuestion_(form)

    // create and share a results spreadsheet
    this.createResultsSpreadsheet_(newFormId, managers);

    // unpublish the form
    form.setPublished(false);

    console.log(`Ballot form created with ID: ${newFormId}`);

    return newFormId;
}

VotingService.getBallot = function (id) {
    let form;
    try {
        form = FormApp.openByUrl(id)
    } catch {
        try {
            form = FormApp.openById(id)
        } catch (e) {
            throw new Error(e.message + " Id was: '" + id + "'")
        }
    }
    return form
}
/**
 * Creates a published copy of a Google Form in the given folder
 *
 * @param {string} formId The ID of the Google Form to copy (ID or URL)
 * @param {string} destinationFolderId The ID of the folder to place the copy in.
 * @return {string} The published URL of the new, public form.
 */
VotingService.makePublishedCopyOfFormInFolder_ = function (formId, destinationFolderId) {
    // 1. Get the source form file from Drive.
    const sourceFormId = VotingService.getBallot(formId).getId();

    const sourceFile = DriveApp.getFileById(sourceFormId);

    // 2. Define the metadata for the new form copy.
    const destination = DriveApp.getFolderById(destinationFolderId);
    const copiedFile = sourceFile.makeCopy(sourceFile.getName(), destination);
    console.log('New Form: ', copiedFile.getName())

    // 7. Return the Url of the new, public form.
    const newForm = this.getBallot(copiedFile.getId());
    return newForm.getEditUrl();
}
/**
 * Adds a short text question for the token at the end of the form.
 *
 * @param {GoogleAppsScript.Forms.Form} form The Google Form to modify.
 */
VotingService.addTokenQuestion_ = function (form) {
    // Add a new short text item at the end of the form
    const tokenItem = form.addTextItem().setTitle(TOKEN_ENTRY_FIELD_TITLE);
    tokenItem.setHelpText(TOKEN_HELP_TEXT);

    // Set the question to be required
    tokenItem.setRequired(true);

}

/**
 * Creates a spreadsheet for the results of the voting form.
 *
 * @param {string} formId The ID of the Google Form for which to create the results spreadsheet.
 * @param {Array<string>} managers - A list of email addresses to share the results spreadsheet with.
 * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet} The created results spreadsheet.
 */
VotingService.createResultsSpreadsheet_ = function (formId, managers = []) {
    const form = this.getBallot(formId);
    const formTitle = form.getTitle();
    const resultsSpreadsheet = SpreadsheetApp.create(`${formTitle} - Results`);
    form.setDestination(FormApp.DestinationType.SPREADSHEET, resultsSpreadsheet.getId());
    managers.forEach(email => {
        try {
            resultsSpreadsheet.addViewer(email);
            console.log(`Shared results sheet with: ${email}`);
        } catch (error) {
            console.log(`Error sharing results sheet with ${email}: ${error}`);
            throw error;
        }
    })
    console.log(`Created results spreadsheet for form ID: ${formId} with title: ${formTitle}`);
    return resultsSpreadsheet;
}

/**
 * 
 * @param {string} formId The ID of the Google Form to collect responses for - either an ID or a full URL.
 * @param {boolean} active Whether to set the form to accept responses. Defaults to true.
 */
VotingService.collectResponses = function (formId, active = true) {
    // console.log(`Setting form ID: ${formId} to ${active ? 'accept' : 'not accept'} responses.`);
    const form = this.getBallot(formId);
    form.setAcceptingResponses(active);
}

function runCreateResultsSpreadsheet() {
    const formId = '1zJi3Wt_AXZ3W5ML2wJ3zxYS923r-NTlBb863Ur-b_Ps'; // Replace with your actual form ID
    const resultsSpreadsheet = VotingService.createResultsSpreadsheet_(formId, ["toby.ferguson@sc3.club"]);
    console.log(`Results spreadsheet created with ID: ${resultsSpreadsheet.getId()}`);
    console.log(`Results spreadsheet URL: ${resultsSpreadsheet.getUrl()}`);
}

/**
 * Creates a pre-filled URL for a given question in a form.
 *
 * This function first finds the correct Entry ID for the question by
 * creating a temporary pre-filled URL and then parsing it.
 *
 * @param {string} formId The ID of the Google Form. This could be a full URL or just the ID.
 * @param {string} questionTitle The title of the question to pre-fill.
 * @param {string} answer The answer to pre-fill in the question. Defaults to '1234'.
 * @return {string} A pre-filled URL for the form.
 */
VotingService.createPrefilledUrlWithTitle = function (formId, questionTitle, answer = '1234') {
    if (formId.startsWith('https://')) {
        formId = VotingService.extractGasFormId(formId);
    }
    const form = this.getBallot(formId);

    // Find the question item by its title
    const items = form.getItems();
    let targetItem = null;

    for (let i = 0; i < items.length; i++) {
        if (items[i].getTitle() === questionTitle) {
            targetItem = items[i];
            break;
        }
    }

    if (!targetItem) {
        throw new Error('Question with title "' + questionTitle + '" not found.');
    }

    // Use a temporary response to generate a pre-filled URL and get the Entry ID
    const tempResponse = form.createResponse();
    const itemResponse = targetItem.asTextItem().createResponse('DUMMY_VALUE');
    tempResponse.withItemResponse(itemResponse);

    // Get the pre-filled URL and find the Entry ID
    const prefilledUrl = tempResponse.toPrefilledUrl();
    const entryIdMatch = prefilledUrl.match(/entry\.(\d+)=/);

    if (!entryIdMatch || entryIdMatch.length < 2) {
        throw new Error('Could not find the Entry ID for the question.');
    }

    const entryId = entryIdMatch[1];

    // Now, create the final URL with the correct Entry ID and the desired answer
    const finalPrefilledUrl = form.getPublishedUrl() + '?usp=pp_url' + '&entry.' + entryId + '=' + encodeURIComponent(answer);

    console.log('Generated Pre-filled Link: ' + finalPrefilledUrl);

    return finalPrefilledUrl;
}

const TEST_FORM_ID = '1zJi3Wt_AXZ3W5ML2wJ3zxYS923r-NTlBb863Ur-b_Ps'; // Replace with your actual form ID
// Example usage:
// Replace 'YOUR_FORM_ID_HERE' with your actual form ID.
function runCreatePrefilledUrl() {
    const formId = TEST_FORM_ID;
    const prefilledLink = VotingService.createPrefilledUrlWithTitle(formId, TOKEN_ENTRY_FIELD_TITLE, '1234');
    console.log('prefilled Link: ', prefilledLink)
}
// To use the function, call it with your form's ID.
// Replace 'YOUR_FORM_ID_HERE' with the actual ID from your form's URL.
// The form ID is the long string of letters and numbers after '/d/' in the URL.
// Example: https://docs.google.com/forms/d/YOUR_FORM_ID_HERE/edit
function runAddTokenQuestion() {
    const form = this.getForm(TEST_FORM_ID);
    VotingService.addTokenQuestion_(form);
}

function runCreateBallotForm() {
    const formId = TEST_FORM_ID;
    const url = VotingService.createBallotForm(formId, ["toby.ferguson@sc3.club"]);
    console.log(`Ballot form created with URL: ${url}`);
}

function runGetForm() {
    const formId = "https://docs.google.com/forms/d/1zJi3Wt_AXZ3W5ML2wJ3zxYS923r-NTlBb863Ur-b_Ps";
    const form = VotingService.getBallot(formId);
    console.log(`Form Title: ${form.getTitle()}`);
    console.log(`Form ID: ${form.getId()}`);
    console.log(`Form URL: ${form.getPublishedUrl()}`);
}

function runCollectResponses() {
    const formId = TEST_FORM_ID;
    VotingService.collectResponses(formId, true);
    console.log(`Responses for form ID: ${formId} are now being collected.`);
}

function runManageElectionLifecycles() {
    VotingService.manageElectionLifecycles();
}