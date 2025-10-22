/// <reference path="./VotingService.d.ts" />
/// <reference path="./Data.d.ts" />
/// <reference path="./Auth.d.ts" />
/// <reference path="./google-types.d.ts" />
// @ts-check

// Note: Constants are defined in Constants.js and accessed via VotingService.Constants

/**
 * Gets the ballot folder ID from ElectionConfiguration sheet
 * @returns {string} The Google Drive folder ID for storing ballot forms
 * @throws {Error} If the configuration is missing or invalid
 */
VotingService.getBallotFolderId = function () {
    try {
        // @ts-ignore - Common namespace is available at runtime
        const configFiddler = Common.Data.Storage.SpreadsheetManager.getFiddler('ElectionConfiguration');
        /** @type {any[]} */
        const config = configFiddler.getData();
        
        // Look for a ballot folder URL configuration
        /** @type {any} */
        const ballotFolderConfig = config.find(/** @param {any} row */ row => row.Key === 'BALLOT_FOLDER_URL' || row.Setting === 'BALLOT_FOLDER_URL');
        
        if (ballotFolderConfig && ballotFolderConfig.Value) {
            // Extract folder ID from Google Drive folder URL
            // URL format: https://drive.google.com/drive/folders/{FOLDER_ID}
            const folderUrl = ballotFolderConfig.Value;
            const folderIdMatch = folderUrl.match(/\/folders\/([a-zA-Z0-9-_]+)/);
            
            if (folderIdMatch) {
                return folderIdMatch[1];
            }
        }
    } catch (error) {
        /** @type {Error} */
        const err = error instanceof Error ? error : new Error(String(error));
        console.error('Failed to retrieve ballot folder ID from ElectionConfiguration:', err.message);
        throw new Error(`Ballot folder configuration not found. Please ensure the ElectionConfiguration sheet contains a row with Key='BALLOT_FOLDER_URL' and a valid Google Drive folder URL as the Value. Original error: ${err.message}`);
    }
    
    // If we get here, no valid configuration was found
    throw new Error('Ballot folder configuration missing. Please configure BALLOT_FOLDER_URL in the ElectionConfiguration sheet with a valid Google Drive folder URL (e.g., https://drive.google.com/drive/folders/YOUR_FOLDER_ID).');
}

/**
 * Safely gets the ballot folder ID with user-friendly error handling
 * @returns {string} The ballot folder ID
 * @throws {Error} User-friendly error message for configuration issues
 */
VotingService.getBallotFolderIdSafe = function() {
    try {
        return this.getBallotFolderId();
    } catch (error) {
        /** @type {Error} */
        const err = error instanceof Error ? error : new Error(String(error));
        
        // Check if this is a configuration error
        if (err.message.includes('configuration')) {
            throw new Error('The Voting Service is not properly configured. Please contact your system administrator to set up the ballot folder configuration in the ElectionConfiguration sheet.');
        }
        
        // Re-throw other errors as-is
        throw err;
    }
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
    /** @type {string[]} */
    const activeBallots = [];
    elections.forEach(election => {
        const ballotId = election[VotingService.Constants.FORM_EDIT_URL_COLUMN_NAME];
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
            case VotingService.Constants.ElectionState.UNOPENED:
                break;
            case VotingService.Constants.ElectionState.ACTIVE:
                // Active ballot
                activeBallots.push(ballotId);
                if (!ballot.isPublished()) {
                    // If the form is not published and the start date has passed, publish it.
                    // Trigger IDs can overflow a spreadsheet number, so store as a string.
                    election.TriggerId = this.openElection_(ballot, election);
                    console.log(`Opened election "${election.Title}" with ID "${ballotId}" as the start date has passed. Attached trigger ID: ${election.TriggerId} `);
                    changesMade = changesMade || true
                }
                break;
            case VotingService.Constants.ElectionState.CLOSED:
                if (ballot.isPublished() || election.TriggerId) {
                    this.closeElection_(this.getBallot(election[VotingService.Constants.FORM_EDIT_URL_COLUMN_NAME]), election);
                    console.log(`Closed election "${election.Title}" with ID "${ballotId}" as the end date has passed.`);
                    election.TriggerId = ''; // Clear the trigger ID after closing
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
        VotingService.Data.storeElectionData(elections);
    }
}

/**
 * Gets the state of an election
 * @param {VotingService.Election} election
 * @returns {VotingService.ElectionState} 
 */
VotingService.getElectionState = function (election) {
    console.log(`Getting election state for election: ${JSON.stringify(election)}`);
    if (!election || !election.Start || !election.End) {
        return VotingService.Constants.ElectionState.UNOPENED;
    }
    const today = new Date();
    const start = new Date(election.Start);
    const end = new Date(election.End);
    if (start <= today && today <= end) {
        return VotingService.Constants.ElectionState.ACTIVE;
    }
    if (end < today) {
        return VotingService.Constants.ElectionState.CLOSED;
    }
    return VotingService.Constants.ElectionState.UNOPENED;
};

/**
 * Gets spreadsheet ID from election
 * @param {VotingService.Election} election
 * @returns {string}
 */
VotingService.getSpreadsheetIdFromElection = function (election) {
    const ballot = this.getBallot(election[VotingService.Constants.FORM_EDIT_URL_COLUMN_NAME]);
    if (!ballot) {
        throw new Error(`Ballot with ID "${election[VotingService.Constants.FORM_EDIT_URL_COLUMN_NAME]}" not found for election "${election.Title}".`);
    }
    const destinationId = ballot.getDestinationId();
    if (!destinationId) {
        throw new Error(`Ballot with ID "${election[VotingService.Constants.FORM_EDIT_URL_COLUMN_NAME]}" does not have a destination spreadsheet set.`);
    }
    return destinationId;
}

/**
 * 
 * @param {VotingService.Ballot} ballot Ballot for which the election is being opened.
 * @param {VotingService.Election} election Election being opened.
 * @returns {string} The unique ID of the created trigger.
 * 
 * @description Opens the election by setting the ballot to accept responses and attaching the onSubmit trigger.
 * This is typically called when the election's start date has passed.
 * It updates the election's status and attaches the necessary trigger for handling form submissions.
 * 
 * @throws {Error} If there is an issue attaching the trigger or if the form does not have a valid destination.
 */
VotingService.openElection_ = function (ballot, election) {
    const electionOfficers = election[VotingService.Constants.ELECTION_OFFICERS_COLUMN_NAME]
    this.emailElectionOfficersAboutOpening_(electionOfficers, ballot);
    ballot.setPublished(true);
    return this.attachOnSubmitTrigger_(ballot)
}

/**
 *
 * @param {string} electionOfficers - comma-separated list of election officer emails
 * @param {VotingService.Ballot} ballot
 */
VotingService.emailElectionOfficersAboutOpening_ = function (electionOfficers, ballot) {
    const message = {
        to: electionOfficers,
        subject: `Election '${ballot.getTitle()}' is now open`,
        body: `The ${ballot.getTitle()} election is now open and accepting responses. You can view the form at: ${ballot.getEditUrl()}`
    };
    MailApp.sendEmail(message)
}

/**
 *
 * @param {VotingService.Ballot} ballot Ballot to which a trigger is to be attached.
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
 * @param {VotingService.Election} election - the election being closed.
 *
 * @description Closes the election by setting the ballot to not accept responses, emailing the election officers, and removing the onSubmit trigger.
 * This is typically called when the election's end date has passed.
 * It updates the election's status and cleans up the trigger.
 * 
 * @throws {Error} If there is an issue removing the trigger.
 */
VotingService.closeElection_ = function (ballot, election) {
    ballot.setPublished(false);
    this.removeOnSubmitTrigger_(election.TriggerId)
    VotingService.Auth.deleteAllTokens(VotingService.getSpreadsheetIdFromElection(election));
    const electionOfficers = election[VotingService.Constants.ELECTION_OFFICERS_COLUMN_NAME];
    this.emailElectionOfficersAboutClosure_(electionOfficers, ballot);
}

/**
 *
 * @param {string} electionOfficers - comma-separated list of election officer emails
 * @param {VotingService.Ballot} ballot
 */
VotingService.emailElectionOfficersAboutClosure_ = function (electionOfficers, ballot) {
    const closureMessage = { to: electionOfficers, ...this.getClosureMessage_(ballot) };
    MailApp.sendEmail(closureMessage);
}

/**
 *
 * @param {VotingService.Ballot} ballot
 * @returns {GoogleAppsScript.Mail.MailAdvancedParameters}
 */
VotingService.getClosureMessage_ = function (ballot) {
    if (this.manualCountingRequired_(ballot)) {
        return {
            subject: `Election '${ballot.getTitle()}' has closed - Manual Counting Required`,
            body: `The ${ballot.getTitle()} election has now closed. The form is no longer accepting responses. The results sheet contains invalid votes that must be manually counted. You can view the form at: ${ballot.getEditUrl()}`
        };
    }
    return {
        subject: `Election '${ballot.getTitle()}' has closed`,
        body: `The ${ballot.getTitle()} election has now closed. The form is no longer accepting responses. All votes are valid and you can use the Form Response graph as the results. You can view the form at: ${ballot.getEditUrl()}`
    };
}

/**
 *
 * @param {VotingService.Ballot} ballot
 * @returns {boolean}
 */
VotingService.manualCountingRequired_ = function (ballot) {
    const spreadsheet = SpreadsheetApp.openById(ballot.getDestinationId());
    const sheets = spreadsheet.getSheets();
    return sheets.find(sheet => sheet.getName() === VotingService.Constants.INVALID_RESULTS_SHEET_NAME) !== undefined;
}
/**
 * 
 * @param {string | undefined} triggerId - the trigger ID to remove.
 * @returns {boolean} - true if the trigger was successfully removed, false if it was not found.
 * 
 * @description Removes the onSubmit trigger associated with the given trigger ID.
 * This is useful for cleaning up triggers when an election ends or when a form is no longer needed.
 */
VotingService.removeOnSubmitTrigger_ = function (triggerId) {
    if (!triggerId) {
        console.warn(`VotingService.removeOnSubmitTrigger_: No trigger ID provided.`);
        return false;
    }
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
 * @typedef {Object} BallotFormResult
 * @property {string} title - The title of the ballot
 * @property {string} url - The edit URL of the ballot form
 */

/**
 * @memberof VotingService
 * @param {string} formId - The ID (ID or URL) of the Google Form to create a ballot from.
 * @param {string[]} electionOfficers - A list of email addresses to share the results spreadsheet with.
 * @returns {BallotFormResult} Object containing the ballot title and edit URL
 */
VotingService.createBallotForm = function (formId, electionOfficers) {
    const url = this.makePublishedCopyOfFormInFolder_(formId, this.getBallotFolderIdSafe());

    /** @type {GoogleAppsScript.Forms.Form} */
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
    form.setConfirmationMessage(VotingService.Constants.CONFIRMATION_MESSAGE);
    // Disable further votes
    form.setShowLinkToRespondAgain(false)
    // Don't allow viewing of results
    form.setPublishingSummary(false);

    // I'd like to disable autosave, but autosaving only applies to Google account holders, and must be done manually.

    // Add a token question to the form
    this.addTokenQuestion_(form)

    // create and share a results spreadsheet
    this.createResultsSpreadsheet_(url);
    this.setElectionOfficers(url, electionOfficers)

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
    /** @type {GoogleAppsScript.Forms.Form} */
    let form;
    try {
        form = FormApp.openByUrl(id)
    } catch {
        try {
            form = FormApp.openById(id)
        } catch (e) {
            /** @type {Error} */
            const error = e instanceof Error ? e : new Error(String(e));
            throw new Error(error.message + " Id was: '" + id + "'")
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
    const copiedFileId = sourceFile.makeCopy(sourceFile.getName(), destination).getId();
    
    // Check if we're in a Shared Drive by examining the destination folder's parents
    const isSharedDrive = !destination.getParents().hasNext();
    
    if (isSharedDrive) {
        console.log(`File created in Shared Drive - individual file sharing not supported. Election Officers must be managed at the Shared Drive level.`);
        // For Shared Drives, we can only set basic sharing settings
        try {
            DriveApp.getFileById(copiedFileId).setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        } catch (error) {
            /** @type {Error} */
            const err = error instanceof Error ? error : new Error(String(error));
            console.warn(`Could not set sharing for Shared Drive file: ${err.message}`);
        }
    } else {
        // For My Drive files, we can set full sharing settings
        DriveApp.getFileById(copiedFileId).setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW).setShareableByEditors(false);
    }

    const newForm = this.getBallot(copiedFileId);
    return newForm.getEditUrl();
}
/**
 * Adds a short text question for the token at the end of the form.
 *
 * @param {GoogleAppsScript.Forms.Form} form The Google Form to modify.
 */
VotingService.addTokenQuestion_ = function (form) {
    // Add a new short text item at the end of the form
    const tokenItem = form.addTextItem().setTitle(VotingService.Constants.TOKEN_ENTRY_FIELD_TITLE);
    tokenItem.setHelpText(VotingService.Constants.TOKEN_HELP_TEXT);

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
    
    // Get the form's file to determine its folder location
    const formFile = DriveApp.getFileById(form.getId());
    const formParents = formFile.getParents();
    
    // Create the spreadsheet in the same folder as the form
    const resultsSpreadsheet = SpreadsheetApp.create(`${formTitle} ${VotingService.Constants.RESULTS_SUFFIX}`);
    const spreadsheetFile = DriveApp.getFileById(resultsSpreadsheet.getId());
    
    // If the form has parent folders, move the spreadsheet to the first one
    if (formParents.hasNext()) {
        const targetFolder = formParents.next();
        targetFolder.addFile(spreadsheetFile);
        // Remove from the default location (root or My Drive)
        DriveApp.getRootFolder().removeFile(spreadsheetFile);
    }
    
    form.setDestination(FormApp.DestinationType.SPREADSHEET, resultsSpreadsheet.getId());
    console.log(`Created results spreadsheet for form ID: ${formId} with title: ${formTitle} in same folder as form`);
    return resultsSpreadsheet;
}

/**
 * Sets the editors for the ballot and its results spreadsheet.
 * @param {string} editUrl the ballot's edit URL
 * @param {string[]} electionOfficers list of electionOfficer email addresses to share the form with
 *
 * @description Sets the election officers of the ballot form and its results spreadsheet to the given list. Send election officers an email detailing their change of status.
 * For Shared Drive files, individual editor permissions may be limited by drive-level permissions.
 */
VotingService.setElectionOfficers = function (editUrl, electionOfficers = []) {
    /**
     * @template T
     * @param {Set<T>} setA 
     * @param {Set<T>} setB 
     * @returns {Set<T>} 
     */
    function difference(setA, setB) {
        return new Set([...setA].filter(item => !setB.has(item)))
    }
    const newElectionOfficers = new Set(electionOfficers.filter(m => m)); //newElectionOfficers only contains non-empty email addresses
    const form = this.getBallot(editUrl);
    const resultsSpreadsheet = SpreadsheetApp.openById(form.getDestinationId())
    
    // Check if we're working with Shared Drive files
    const formInSharedDrive = this.isInSharedDrive_(form);
    const spreadsheetInSharedDrive = this.isInSharedDrive_(resultsSpreadsheet);
    
    if (formInSharedDrive || spreadsheetInSharedDrive) {
        console.log(`Working with Shared Drive files. Election Officer permissions will be limited to what's allowed by the Shared Drive settings.`);
    }
    
    const formEditors = this.getEditorsExcludingOwner_(form);
    const resultsEditors = this.getEditorsExcludingOwner_(resultsSpreadsheet);
    // combine and deduplicate editors
    // Use a Set to automatically handle duplicates
    // This ensures that if an email is an editor on both the form and the results spreadsheet, it is only processed once.
    // This prevents sending multiple emails to the same person and avoids redundant add/remove operations.
    const oldElectionOfficers = new Set([...formEditors, ...resultsEditors]);


    const add = difference(newElectionOfficers, oldElectionOfficers);
    const remove = difference(oldElectionOfficers, newElectionOfficers);

    // Get here with election officers to actually share with!
    // election Officers are given editor rights to the form
    const formTitle = form.getTitle();
    add.forEach(email => {
        try {
            form.addEditor(email);
            resultsSpreadsheet.addEditor(email);
            this.sendElectionOfficerAddEmail_(email, formTitle, editUrl, formInSharedDrive || spreadsheetInSharedDrive);
            console.log(`Added '${email}' as election officer to '${formTitle}'`);
        } catch (error) {
            /** @type {Error} */
            const err = error instanceof Error ? error : new Error(String(error));
            if (formInSharedDrive || spreadsheetInSharedDrive) {
                console.log(`Note: Could not add '${email}' as editor to '${formTitle}' (Shared Drive limitation). They may need to be added at the Shared Drive level. Error: ${err.message}`);
                // Still send the notification email, but with different messaging
                this.sendElectionOfficerAddEmail_(email, formTitle, editUrl, true);
            } else {
                console.log(`Error adding '${email}' as election officer to '${formTitle}': ${err.message}`);
            }
        }
    })
    remove.forEach(email => {
        try {
            form.removeEditor(email);
            resultsSpreadsheet.removeEditor(email);
            this.sendElectionOfficerRemoveEmail_(email, formTitle, formInSharedDrive || spreadsheetInSharedDrive);
            console.log(`Removed '${email}' as election officer from  '${formTitle}'`);
        } catch (error) {
            /** @type {Error} */
            const err = error instanceof Error ? error : new Error(String(error));
            if (formInSharedDrive || spreadsheetInSharedDrive) {
                console.log(`Note: Could not remove '${email}' from '${formTitle}' (Shared Drive limitation). They may need to be removed at the Shared Drive level. Error: ${err.message}`);
                // Still send the notification email
                this.sendElectionOfficerRemoveEmail_(email, formTitle, true);
            } else {
                console.log(`Error removing '${email}' as election officer from '${formTitle}': ${err.message}`);
            }
        }
    })
}
/**
 * Checks if a file or form is located in a Shared Drive
 * @param {VotingService.Ballot | GoogleAppsScript.Spreadsheet.Spreadsheet} doc The document to check
 * @returns {boolean} True if the document is in a Shared Drive, false if in My Drive
 */
VotingService.isInSharedDrive_ = function (doc) {
    const file = DriveApp.getFileById(doc.getId());
    const parents = file.getParents();
    
    if (!parents.hasNext()) {
        // No parent folders means it's likely in a Shared Drive root
        return true;
    }
    
    // Check if any parent folder has no parent (indicating Shared Drive)
    while (parents.hasNext()) {
        const parent = parents.next();
        if (!parent.getParents().hasNext()) {
            return true;
        }
    }
    
    return false;
}

/**
 * 
 * @param {VotingService.Ballot | GoogleAppsScript.Spreadsheet.Spreadsheet} doc 
 * @returns 
 */
VotingService.getEditorsExcludingOwner_ = function (doc) {
    const file = DriveApp.getFileById(doc.getId());
    const ownerEmail = file.getOwner().getEmail();
    return doc.getEditors().map(e => e.getEmail()).filter(email => email !== ownerEmail);
}


/**
 * 
 * @param {string} email the email to send the message to
 * @param {string} title the title of the document that is being shared
 * @param {string} url the edit url of the document
 * @param {boolean} [isSharedDrive=false] whether the files are in a Shared Drive
 * 
 * @description Send a message to the given email letting them know that they've been given edit access to the document
 */
VotingService.sendElectionOfficerAddEmail_ = function (email, title, url, isSharedDrive = false) {
    const baseMessage = `You are now an Election Officer and have edit access to the Form '${title}' and its result sheet. It can be found at: ${url}`;
    const sharedDriveNote = isSharedDrive ? 
        `\n\nNote: These files are located in a Shared Drive. If you cannot edit them, please contact your Shared Drive administrator to ensure you have the appropriate permissions.` : '';
    
    const message = {
        to: email,
        subject: `Form '${title}' shared with you`,
        body: baseMessage + sharedDriveNote
    }
    MailApp.sendEmail(message)
}
/**
 * 
 * @param {string} email the email to send the message to
 * @param {string} title the title of the document
 * @param {boolean} [isSharedDrive=false] whether the files are in a Shared Drive
 * 
 * @description send a message to the given email telling them that they no longer have access to the given document
 */
VotingService.sendElectionOfficerRemoveEmail_ = function (email, title, isSharedDrive = false) {
    const baseMessage = `You are no longer an Election Officer and your edit access to the Form '${title}' and its result sheet has been removed`;
    const sharedDriveNote = isSharedDrive ? 
        `\n\nNote: These files are located in a Shared Drive. Access may also be controlled at the Shared Drive level.` : '';
    
    const message = {
        to: email,
        subject: `Document access removed`,
        body: baseMessage + sharedDriveNote,
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

/**
 * Provides information about managing Election Officers for ballots in Shared Drives
 * @param {string} editUrl the ballot's edit URL
 * @returns {{isSharedDrive: boolean, driveInfo: string, recommendations: string[]}}
 */
VotingService.getElectionOfficerManagementInfo = function (editUrl) {
    const form = this.getBallot(editUrl);
    const resultsSpreadsheet = SpreadsheetApp.openById(form.getDestinationId());
    
    const formInSharedDrive = this.isInSharedDrive_(form);
    const spreadsheetInSharedDrive = this.isInSharedDrive_(resultsSpreadsheet);
    const isSharedDrive = formInSharedDrive || spreadsheetInSharedDrive;
    
    const driveInfo = isSharedDrive ? 
        'Files are located in a Shared Drive where individual file permissions are limited.' :
        'Files are located in My Drive where individual file permissions can be managed directly.';
    
    const recommendations = [];
    
    if (isSharedDrive) {
        recommendations.push('Add Election Officers to the Shared Drive with Editor or Content Manager permissions');
        recommendations.push('Election Officers can then edit ballots and results spreadsheets');
        recommendations.push('Use the Shared Drive\'s member management interface to add/remove Election Officers');
        recommendations.push('Consider creating a dedicated folder within the Shared Drive for elections');
        recommendations.push('Individual file sharing is limited in Shared Drives - permissions are inherited from drive level');
    } else {
        recommendations.push('Election Officers can be added directly to individual ballot forms and results spreadsheets');
        recommendations.push('Use the setElectionOfficers function to manage access automatically');
        recommendations.push('Individual file permissions provide granular control over access');
        recommendations.push('Election Officers will receive email notifications when added or removed');
    }
    
    return {
        isSharedDrive,
        driveInfo,
        recommendations
    };
}

function runCreateResultsSpreadsheet() {
    const formId = '1zJi3Wt_AXZ3W5ML2wJ3zxYS923r-NTlBb863Ur-b_Ps'; // Replace with your actual form ID
    const resultsSpreadsheet = VotingService.createResultsSpreadsheet_(formId);
    VotingService.setElectionOfficers(formId, ["toby.ferguson@sc3.club"]);
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

/**
 * @param {string} ballotId
 * @returns {string | null}
 */
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
    const prefilledLink = VotingService.createPrefilledUrlWithTitle(formId, VotingService.Constants.TOKEN_ENTRY_FIELD_TITLE, '1234');
    console.log('prefilled Link: ', prefilledLink)
}
// To use the function, call it with your form's ID.
// Replace 'YOUR_FORM_ID_HERE' with the actual ID from your form's URL.
// The form ID is the long string of letters and numbers after '/d/' in the URL.
// Example: https://docs.google.com/forms/d/YOUR_FORM_ID_HERE/edit
function runAddTokenQuestion() {
    const form = VotingService.getBallot(TEST_FORM_ID);
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

function runGetElectionOfficerManagementInfo() {
    // Replace with an actual ballot edit URL
    const ballotUrl = TEST_FORM_ID;
    const info = VotingService.getElectionOfficerManagementInfo(ballotUrl);
    
    console.log('Election Officer Management Information:');
    console.log(`Is Shared Drive: ${info.isSharedDrive}`);
    console.log(`Drive Info: ${info.driveInfo}`);
    console.log('Recommendations:');
    info.recommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec}`);
    });
    
    return info;
}


function getTriggerIDForBallot() {
    const ballotId = 'https://docs.google.com/forms/d/1eQdwc9Qc95sZlBQFsFW6lZdiyHIxL7flfguq86LAAiA/edit';
    return VotingService.getTriggerIdForBallot_(ballotId);
}
