if (typeof require !== 'undefined') {
    VotingService = {
        //@ts-ignore
        Trigger: {}
    };
}
// @ts-check

VotingService.Trigger = {
    handleRegistrationSheetEdit: function (e) {
        const editedRange = e.range;
        const sheet = editedRange.getSheet();
        if (sheet.getName() !== REGISTRATION_SHEET_NAME) {
            console.log(`Edit detected in sheet: ${sheet.getName()}, but not in registration sheet (${REGISTRATION_SHEET_NAME}).`);
            return; // Only process edits in the registration sheet
        }
        const editedRow = editedRange.getRow();
        const editedColumn = editedRange.getColumn();
        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        const formEditUrlColumnIndex = headers.indexOf(FORM_EDIT_URL_COLUMN_NAME) + 1;
        const editorsColumnIndex = headers.indexOf(EDITORS_COLUMN_NAME) + 1;
        const startColumnIndex = headers.indexOf('Start') + 1;
        const endColumnIndex = headers.indexOf('End') + 1;
        const triggerStatusColumnIndex = headers.indexOf(TRIGGER_STATUS_COLUMN_NAME) + 1;
        const titleColumnIndex = headers.indexOf(VOTE_TITLE_COLUMN_NAME) + 1;
        console.log(`Edit detected in row: ${editedRow}, column: ${editedColumn} in sheet: ${sheet.getName()}`);
        console.log(`Form edit URL column index: ${formEditUrlColumnIndex}, Editors column index: ${editorsColumnIndex}, Trigger Status column index: ${triggerStatusColumnIndex}`);

        if (editedRow === 1) {
            throw Error('Column headings edited in Elections sheet')
        }
        const editors = sheet.getRange(editedRow, editorsColumnIndex).getValue().split(',').map(email => email.trim());
        const editUrl = sheet.getRange(editedRow, formEditUrlColumnIndex).getValue();
        if (!editUrl) {
            SpreadsheetApp.getUi().alert(`No valid Form ID found in row: ${editedRow}. No further processing will occur for this row.`, SpreadsheetApp.getUi().ButtonSet.OK);
        }
        if (editedColumn === formEditUrlColumnIndex) {
            console.log(`Form ID edited in row: ${editedRow}`);

            if (editUrl) {
                console.log(`Creating a ballot from the source form: ${editUrl} in row: ${editedRow}`);
                try {
                    const { title, url } = VotingService.createBallotForm(editUrl, editors);
                    sheet.getRange(editedRow, titleColumnIndex).setValue(title);
                    sheet.getRange(editedRow, formEditUrlColumnIndex).setValue(url);
                    SpreadsheetApp.getUi().alert(`Created ballot form for '${title}' and alerted any editors via email.`, SpreadsheetApp.getUi().ButtonSet.OK);
                } catch (error) {
                    console.error(`Error creating ballot form for row ${editedRow}: ${error.message}`);
                    SpreadsheetApp.getUi().alert(`Failed to create ballot form for row ${editedRow}: \n\n ${error.message}`, SpreadsheetApp.getUi().ButtonSet.OK);
                    sheet.getRange(editedRow, formEditUrlColumnIndex).clear();
                }
            }
        } else if (editedColumn === editorsColumnIndex) {
            console.log(`Editors edited in row: ${editedRow}`);
            const title = sheet.getRange(editedRow, titleColumnIndex).getValue();
            // It is possible to enter both a Form URL and Editors quickly in the same edit and for two edit events to be called.
            // This edit event might be called before the formEditUrlColumnIndex edit event, in which case the editUrl might be the 'seed ballot' URL.
            // This can be detected by seeing if we have a form title yet!
            if (title) {
                VotingService.setEditors(editUrl, editors);
                SpreadsheetApp.getUi().alert(`Updated editors for '${title}', and sent them emails`, SpreadsheetApp.getUi().ButtonSet.OK);
            }
        } else if (editedColumn === startColumnIndex || editedColumn === endColumnIndex) {
            console.log(`Date edited in row: ${editedRow}`);
            SpreadsheetApp.getUi().alert(`Date edited in row: ${editedRow} - running election lifecycle management`, SpreadsheetApp.getUi().ButtonSet.OK);
            VotingService.manageElectionLifecycles();
        }
    },

    /**
     * 
     * @param {GoogleAppsScript.Events.SheetsOnFormSubmit} e 
     * @returns 
     */
    ballotSubmitHandler: function (e) {
        console.log('Ballot submit handler triggered', e.namedValues);
        const vote = this.firstValues_(e.namedValues)
        const fiddler = VotingService.Data.getFiddlerForValidResults(e.triggerUid)
        const votes = fiddler.getData();

        if (!this.voteIsValid_(vote, votes, Common.Auth.TokenManager.consumeMUT)) {
            this.addInvalidVote_(vote, fiddler.getSheet().getParent());
            return
        }

        // Get here with a valid vote

        delete vote[TOKEN_ENTRY_FIELD_TITLE]; // Remove the token field from the vote object
        console.log('recording valid vote', vote);
        votes.push(vote);
        fiddler.setData(votes).dumpValues();
        this.sendValidVoteEmail_(vote[VOTER_EMAIL_COLUMN_NAME], this.getElectionTitle_(fiddler.getSheet().getParent()));
        return

    },
    /**
     * 
     * @param {Vote} vote - the vote to be validated
     * @param {Vote[]} votes - the array of votes already recorded
     * @param {function} consumeMUT - function to consume the multi-use token
     * @returns {boolean} true if the vote is valid, false otherwise
     * 
     * @description Validates a vote by checking if the token is valid and not expired.
     * It also checks for duplicate votes based on the voter's email. 
     * In addition, it adds the voter's email to the vote object for recording.
     */
    voteIsValid_: function (vote, votes, consumeMUT) {
        console.log('Processing vote:', vote);
        vote[VOTER_EMAIL_COLUMN_NAME] = '';

        const email = consumeMUT(vote[TOKEN_ENTRY_FIELD_TITLE]);
        delete vote[TOKEN_ENTRY_FIELD_TITLE]

        if (!email) {
            console.warn('Invalid vote: ', vote, ' - token not found or expired');
            return false
        }

        vote[VOTER_EMAIL_COLUMN_NAME] = email; // Add the email to the vote object for recording
        const duplicates = votes.some(entry => entry[VOTER_EMAIL_COLUMN_NAME] === email);
        if (duplicates) {
            console.warn(`Duplicate vote detected for email: ${email}. Vote will not be recorded.`);
            return false
        }
        return true
    },
    /**
     * @param {object} spreadsheet
     * @param {function():string} spreadsheet.getName 
     * @returns 
     */
    getElectionTitle_: function (spreadsheet) {
        let electionTitle = spreadsheet.getName();
        if (electionTitle.endsWith(RESULTS_SUFFIX)) {
            electionTitle = electionTitle.slice(0, -RESULTS_SUFFIX.length).trim(); // Remove ' - Results' from the name
        }
        return electionTitle;
    },
    /**
     * 
     * @param {string} to comma separated list of emails to send the email to
     * @param {string} electionTitle the title of the election to include in the email
     * @description Sends an email to the specified recipients indicating that their vote has been recorded.
     * This email serves as a confirmation that the user's vote has been successfully recorded in the election.
     * It includes the election title for context.
     * 
     * @throws {Error} If there is an issue sending the email.  
     */
    sendValidVoteEmail_: function (to, electionTitle) {
        const message = {
            to: to,
            subject: `SCCCC Election '${electionTitle}' - Vote is valid`,
            body: `Your vote in the SCCCC election '${electionTitle}' has been successfully recorded and handled as a valid vote. Thank you for participating!`
        };
        MailApp.sendEmail(message);
        console.log('Vote recorded email sent:', message);
    },
    /**
     * 
     * @param {string} to email to send the email to
     * @param {string} electionTitle the title of the election to include in the email
     * @description Sends an email to the specified recipient indicating that their vote was invalid.
     * This email serves to inform the user that their vote was not counted .
     * It includes the election title for context and explains that a manual count will be conducted.
     * 
     * @throws {Error} If there is an issue sending the email.
     * 
     */
    sendInvalidVoteEmail_: function (to, electionTitle) {
        const message = {
            to: to,
            subject: `SCCCC Election '${electionTitle}' - Vote invalid`,
            body: `Your vote in the SCCCC election '${electionTitle}' was invalid (it either didn't have the necessary security token or was a duplicate vote). To ensure the integrity of the election process we will conduct a manual count, rejecting that vote. Thank you for your understanding!`.trim()
        };
        MailApp.sendEmail(message);
        console.log('Invalid Vote email sent:', message);
    },
    /**
     * 
     * @param {Vote} vote the invalid vote to be recorded
     * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} spreadsheet 
     */
    addInvalidVote_: function (vote, spreadsheet) {
        try {
            //@ts-ignore
            const invalidFiddler = bmPreFiddler.PreFiddler().getFiddler({ id: spreadsheet.getId(), sheetName: 'Invalid Results', createIfMissing: true });
            const votes = invalidFiddler.getData()
            votes.push(vote);
            invalidFiddler.setData(votes).dumpValues();
            this.setAllSheetsBackgroundToLightRed_(spreadsheet)
            const electionTitle = this.getElectionTitle_(spreadsheet)
            this.sendManualCountNeededEmail_(this.getSpreadsheetUsers_(spreadsheet).join(','), vote, electionTitle);
            this.sendInvalidVoteEmail_(vote[VOTER_EMAIL_COLUMN_NAME], electionTitle)
        } catch (error) {
            console.error(error.stack)
        }

    },
    /**
     * 
     * @param {string} to comma separated list of emails to send the email to
     * @param {Vote} vote the invalid vote to be recorded
     * @param {string} electionTitle the title of the election to include in the email
     * 
     * @description Sends an email to the specified recipients indicating that a manual count is needed for an invalid vote.
     * This email serves to notify the users that a manual count will be conducted due to an invalid vote.
     * It includes the election title and details of the invalid vote for context.
     * 
     * @throws {Error} If there is an issue sending the email.
     */
    sendManualCountNeededEmail_: function (to, vote, electionTitle) {
        const message = {
            to: to,
            subject: `Election '${electionTitle}' - manual count needed`,
            body: `In election ${electionTitle} this vote occurred with no token ${JSON.stringify(vote)}. A manual count will now be needed`.trim()
        }
        MailApp.sendEmail(message);
        console.warn('Manual count needed email sent:', message);
    },
    /**
     * 
     * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} spreadsheet 
     */
    setAllSheetsBackgroundToLightRed_(spreadsheet) {

        // Get all the sheets in the spreadsheet
        const sheets = spreadsheet.getSheets();

        // Define the light red color using a hex code
        const lightRed = "#FFD9D9";

        // Loop through each sheet
        sheets.forEach(function (sheet) {
            // Get the entire data range of the sheet
            const range = sheet.getDataRange();

            // Set the background color of the range
            range.setBackground(lightRed);
        });
    },
    /**
     * 
     * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} spreadsheet 
     * @returns 
     */
    getSpreadsheetUsers_(spreadsheet) {
        const fileId = spreadsheet.getId();
        const file = DriveApp.getFileById(fileId);
        const emails = file.getEditors().concat(file.getViewers()).map(user => user.getEmail());
        return emails
    },
    /**
    * Takes an object whose values are arrays and returns an object with the same keys,
     * but each value is the first element of the original array.
     * @param {Object} obj
     * @returns {Object}
     */
    firstValues_: function (obj) {
        const result = {};
        for (const key in obj) {
            if (Array.isArray(obj[key])) {
                result[key] = obj[key][0];
            } else {
                result[key] = obj[key];
            }
        }
        return result;
    },
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        Trigger: VotingService.Trigger
    };
}