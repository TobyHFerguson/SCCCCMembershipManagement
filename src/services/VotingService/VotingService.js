/// <reference path="./VotingService.d.ts" />
// @ts-check

const BALLOT_FOLDER_ID = '1ncuM7AyS9HtqtM842SUjHnhLG6_Pa_RB';
const VOTE_TITLE_COLUMN_NAME = 'Title';
const VOTER_EMAIL_COLUMN_NAME = 'Voter Email'
const FORM_EDIT_URL_COLUMN_NAME = 'Form Edit URL';
const EDITORS_COLUMN_NAME = 'Editors'; // Can be comma-separated
const TRIGGER_STATUS_COLUMN_NAME = 'Trigger Status';
const VOTE_DATA_SHEET_ID = '1FN1vogIDDWdqghflOF6hNuDDW1cqFQpSGX8GhXLYyyw'; // Replace with your central vote data sheet ID
const REGISTRATION_SHEET_NAME = 'Elections'; // Update with your sheet name
const RESULTS_SUFFIX = '- Results';
const TOKEN_ENTRY_FIELD_TITLE = 'VOTING TOKEN'; // Adjust
const TOKEN_HELP_TEXT = 'This question is used to validate your vote. Do not modify this field.';
const CONFIRMATION_MESSAGE = 'Your vote has been recorded successfully. You will be sent an email indicating how your vote was handled. Thank you for participating!';

// Helper to extract components from the pre-filled URL (used by handleSheetEdit and renderVotingOptions)
VotingService.getBallotFolderId = function () {
    const ffi = PropertiesService.getScriptProperties().getProperty('BALLOT_FOLDER_ID') || BALLOT_FOLDER_ID;
    return ffi;
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
    const activeBallots = [];
    elections.forEach(election => {
        const ballotId = election[FORM_EDIT_URL_COLUMN_NAME];
        if (!ballotId) {
            console.warn(`Election "${election.Title}" has no Form ID. Skipping lifecycle management for this election.`);
            return;
        }
        if (!election.Start || !election.End) {
            console.warn(`Election "${election.Title}" is missing a Start and/or an End date. Skipping lifecycle management for this election.`);
            return;
        }

        const ballot = VotingService.getBallot(ballotId);
        if (!ballot) {
            console.warn(`Ballot with ID "${ballotId}" not found for election "${election.Title}". Skipping lifecycle management.`);
            return;
        }
        switch (this.getElectionState(election)) {
            case ElectionState.UNOPENED:
                break;
            case ElectionState.ACTIVE:
                // Active ballot
                activeBallots.push(ballotId);
                if (!ballot.isPublished()) {
                    // If the form is not published and the start date has passed, publish it.
                    // Trigger IDs can overflow a spreadsheet number, so store as a string.
                    election.TriggerId = this.openElection_(ballot);
                    console.log(`Opened election "${election.Title}" with ID "${ballotId}" as the start date has passed. Attached trigger ID: ${election.TriggerId} `);
                    changesMade = changesMade || true
                }
                break;
            case ElectionState.CLOSED:
                if (ballot.isPublished() || election.TriggerId) {
                    this.closeElection_(this.getBallot(election[FORM_EDIT_URL_COLUMN_NAME]), election.TriggerId);
                    console.log(`Closed election "${election.Title}" with ID "${ballotId}" as the end date has passed.`);
                    election.TriggerId = null; // Clear the trigger ID after closing
                    changesMade = changesMade || true;
                }
                break;
            default:
                console.warn(`Unknown state for election "${election.Title}". Skipping lifecycle management.`);
                break;
        }

    });
    const activeTriggerIds = activeBallots.map(ballotId => VotingService.getTriggerIdForBallot_(ballotId)).filter(id => id !== null);
    VotingService.cleanUpOrphanedTriggers(activeTriggerIds);
    if (changesMade) {
        console.log('Changes made to elections during lifecycle management. Updating elections storage.');
        // @ts-ignore
        VotingService.Data.storeElectionData(elections);
    }
}

// @ts-ignore
const ElectionState = {
    UNOPENED: 'UNOPENED',
    ACTIVE: 'ACTIVE',
    CLOSED: 'CLOSED'
};

/**
 *
 * @param {VotingService.Election} election
 * @returns {ElectionState}
 */
VotingService.getElectionState = function (election) {
    console.log(`Getting election state for election: ${JSON.stringify(election)}`);
    if (!election || !election.Start || !election.End) {
        return ElectionState.UNOPENED;
    }
    const today = new Date();
    const start = new Date(election.Start);
    const end = new Date(election.End);
    if (start <= today && today <= end) {
        return ElectionState.ACTIVE;
    }
    if (end < today) {
        return ElectionState.CLOSED;
    }
    return ElectionState.UNOPENED;
};

/**
 * 
 * @param {VotingService.Ballot} ballot Ballot for which the election is being opened.
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
        .forSpreadsheet(ballot.getDestinationId())
        .onFormSubmit()
        .create();
    return trigger.getUniqueId();
}

/**
 * 
 * @param {string[]} activeTriggerIds 
 */
VotingService.cleanUpOrphanedTriggers = function (activeTriggerIds) {
    console.log(`Cleaning up orphaned triggers. Current trigger IDs: ${Array.from(activeTriggerIds).join(', ')}`);
    const allTriggers = ScriptApp.getProjectTriggers();
    allTriggers.forEach(trigger => {
        console.log(`Checking trigger with ID: ${trigger.getUniqueId()} and handler function: ${trigger.getHandlerFunction()}`);
        if (trigger.getHandlerFunction() === 'ballotSubmitHandler' && !activeTriggerIds.includes(trigger.getUniqueId())) {
            ScriptApp.deleteTrigger(trigger);
            console.log(`Deleted orphaned ballotSubmitHandler trigger with ID: ${trigger.getUniqueId()}`);
        }
    });
}

/**
 * 
 * @param {VotingService.Ballot} ballot - the ballot whose election is being closed.
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
    ballot.setPublished(false);
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

/**
 * @memberof VotingService
 * @param {string} formId - The ID (ID or URL) of the Google Form to create a ballot from.
 * @param {string[]} editors - A list of email addresses to share the results spreadsheet with.
 * @returns {object} The published URL of the new, public form.
 * @property {string} title - the title of the ballot
 * @property {string} url - the edit url of the ballot form
 */
VotingService.createBallotForm = function (formId, editors) {
    const url = this.makePublishedCopyOfFormInFolder_(formId, this.getBallotFolderId());

    const form = FormApp.openByUrl(url);

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
    this.createResultsSpreadsheet_(url);
    this.setEditors(url, editors)

    // unpublish the form
    form.setPublished(false);

    const title = form.getTitle()

    console.log(`Ballot form '${title}' created with url: ${url}`);

    return { title, url };
}

/**
 * Retrieves a ballot form by ID or URL.
 * @param {string} id
 * @returns {VotingService.Ballot}
 */
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

    // set the permissions so anyone can respond
    const newForm = this.getBallot(copiedFile.getId());
    const newPermission = {
        'role': 'reader',
        'type': 'anyone'
    };
    // Use the Drive API to grant public permission to the form file.
    // The 'reader' role allows people to view the form for responding.
    Drive.Permissions.create(newPermission, newForm.getId(), { sendNotificationEmail: false });
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
 * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet} The created results spreadsheet.
 */
VotingService.createResultsSpreadsheet_ = function (formId) {
    const form = this.getBallot(formId);
    const formTitle = form.getTitle();
    const resultsSpreadsheet = SpreadsheetApp.create(`${formTitle} ${RESULTS_SUFFIX}`);
    form.setDestination(FormApp.DestinationType.SPREADSHEET, resultsSpreadsheet.getId());
    console.log(`Created results spreadsheet for form ID: ${formId} with title: ${formTitle}`);
    return resultsSpreadsheet;
}

/**
 * Sets the editors for the ballot and its results spreadsheet.
 * @param {string} editUrl the ballot's edit URL
 * @param {string[]} editors list of editor emails to share the form with
 * 
 * @description Sets the editors of the ballot form and its results spreadsheet to the given list. Send editors an email detailing their change of status. 
 */
VotingService.setEditors = function (editUrl, editors = []) {
    const newEditors = new Set(editors.filter(m => m)); //newEditors only contains non-empty email addresses
    const form = this.getBallot(editUrl);
    const resultsSpreadsheet = SpreadsheetApp.openById(form.getDestinationId())
    const oldEditors = new Set([form, resultsSpreadsheet].flatMap(doc => doc.getEditors().map(e => e.getEmail())));
    const add = newEditors.difference(oldEditors);
    const remove = oldEditors.difference(newEditors)

    // Get here with editors to actually share with!
    const formTitle = form.getTitle();
    add.forEach(email => {
        try {
            form.addEditor(email);
            resultsSpreadsheet.addEditor(email);
            this.sendEditorAddEmail_(email, formTitle, editUrl);
            console.log(`Added '${email}' as editor to '${formTitle}'`);
        } catch (error) {
            console.log(`Error adding '${email}' as editor to '${formTitle}': ${error}`);
        }
    })
    remove.forEach(email => {
        try {
            form.removeEditor(email);
            resultsSpreadsheet.removeEditor(email);
            this.sendEditorRemoveEmail_(email, formTitle);
            console.log(`Removed '${email}' as editor from  '${formTitle}'`);
        } catch (error) {
            console.log(`Error removing '${email}' as editor from '${formTitle}': ${error}`);
        }
    })
}

/**
 * 
 * @param {string} email the email to send the message to
 * @param {string} title the title of the document that is being shared
 * @param {string} url the edit url of the document
 * 
 * @description Send a message to the given email letting them know that they've been given edit access to the document
 */
VotingService.sendEditorAddEmail_ = function (email, title, url) {
    const message = {
        to: email,
        subject: `Form '${title}' shared with you`,
        body: `You now have edit access to the Form '${title}' and its result sheet. It can be found at: ${url}`
    }
    MailApp.sendEmail(message)
}
/**
 * 
 * @param {string} email the email to send the message to
 * @param {string} title the title of the document
 * 
 * @description send a message to the given email telling them that they no longer have access to the given document
 */
VotingService.sendEditorRemoveEmail_ = function (email, title) {
    const message = {
        to: email,
        subject: `Document access removed`,
        body: `Your edit access to the Form '${title}' and its result sheet has been removed`,
    }
    MailApp.sendEmail(message)
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
    const resultsSpreadsheet = VotingService.createResultsSpreadsheet_(formId);
    VotingService.setEditors(formId, ["toby.ferguson@sc3.club"]);
    console.log(`Results spreadsheet created with ID: ${resultsSpreadsheet.getId()}`);
    console.log(`Results spreadsheet URL: ${resultsSpreadsheet.getUrl()}`);
}

/**
 * Creates a pre-filled URL for a given question in a form.
 *
 * This function first finds the correct Entry ID for the question by
 * creating a temporary pre-filled URL and then parsing it.
 *
 * @param {string} formId The ID of the Google Form. This could be a full edit URL or just the ID.
 * @param {string} questionTitle The title of the question to pre-fill.
 * @param {string} answer The answer to pre-fill in the question. Defaults to '1234'.
 * @return {string} A pre-filled URL for the form.
 */
VotingService.createPrefilledUrlWithTitle = function (formId, questionTitle, answer = '1234') {
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

VotingService.getTriggerIdForBallot_ = function (ballotId) {
    const ballot = VotingService.getBallot(ballotId);
    const triggerIds = ScriptApp.getProjectTriggers().filter(trigger =>
        trigger.getHandlerFunction() === 'ballotSubmitHandler').
        filter(trigger => trigger.getTriggerSourceId() === ballot.getDestinationId()).
        map(trigger => trigger.getUniqueId());
    if (triggerIds.length > 1) {
        console.warn(`Multiple triggers found for ballot ID: ${ballotId}. Using the first one.`);
    }
    return triggerIds.length > 0 ? triggerIds[0] : null;
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
    const formId = 'https://docs.google.com/forms/d/1x9UrFNSBZvnzeu-_MwHYIUvDlWuD8xfvxAg-ceAb5jI/edit';
    const { title, url } = VotingService.createBallotForm(formId, ["toby.ferguson@sc3.club"]);
    console.log(`Ballot form '${title}' created with URL: ${url}`);
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


function getTriggerIDForBallot() {
    const ballotId = 'https://docs.google.com/forms/d/1eQdwc9Qc95sZlBQFsFW6lZdiyHIxL7flfguq86LAAiA/edit';
    VotingService.getTriggerIdForBallot_(ballotId);
}
