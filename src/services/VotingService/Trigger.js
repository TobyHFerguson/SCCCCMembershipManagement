// @ts-ignore
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
        if (sheet.getName() !== VotingService.Constants.REGISTRATION_SHEET_NAME) {
            console.log(`Edit detected in sheet: ${sheet.getName()}, but not in registration sheet (${VotingService.Constants.REGISTRATION_SHEET_NAME}).`);
            return; // Only process edits in the registration sheet
        }
        const editedRow = editedRange.getRow();
        const editedColumn = editedRange.getColumn();
        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        const formEditUrlColumnIndex = headers.indexOf(VotingService.Constants.FORM_EDIT_URL_COLUMN_NAME) + 1;
        const electionOfficersColumnIndex = headers.indexOf(VotingService.Constants.ELECTION_OFFICERS_COLUMN_NAME) + 1;
        const startColumnIndex = headers.indexOf('Start') + 1;
        const endColumnIndex = headers.indexOf('End') + 1;
        const triggerStatusColumnIndex = headers.indexOf(VotingService.Constants.TRIGGER_STATUS_COLUMN_NAME) + 1;
        const titleColumnIndex = headers.indexOf(VotingService.Constants.VOTE_TITLE_COLUMN_NAME) + 1;
        console.log(`Edit detected in row: ${editedRow}, column: ${editedColumn} in sheet: ${sheet.getName()}`);
        console.log(`Form edit URL column index: ${formEditUrlColumnIndex}, Election Officers column index: ${electionOfficersColumnIndex}, Trigger Status column index: ${triggerStatusColumnIndex}`);

        if (editedRow === 1) {
            throw Error('Column headings edited in Elections sheet')
        }
        const electionOfficers = sheet.getRange(editedRow, electionOfficersColumnIndex).getValue().split(',').map(email => email.trim());
        const editUrl = sheet.getRange(editedRow, formEditUrlColumnIndex).getValue();
        if (!editUrl) {
            // @ts-ignore - Logger is implemented in separate file
            Common.Logger.warn('VotingTrigger', `No valid Form ID found in row ${editedRow} - no processing will occur`);
            return; // Exit early if no URL to process
        }
        if (editedColumn === formEditUrlColumnIndex) {
            console.log(`Form ID edited in row: ${editedRow}`);

            if (editUrl) {
                console.log(`Creating a ballot from the source form: ${editUrl} in row: ${editedRow}`);
                try {
                    // @ts-ignore - Logger is implemented in separate file
                    Common.Logger.info('VotingTrigger', `Creating ballot form from source: ${editUrl} for row ${editedRow}`);
                    
                    const { title, url } = VotingService.createBallotForm(editUrl, electionOfficers);
                    sheet.getRange(editedRow, titleColumnIndex).setValue(title);
                    sheet.getRange(editedRow, formEditUrlColumnIndex).setValue(url);
                    
                    // @ts-ignore - Logger is implemented in separate file
                    Common.Logger.info('VotingTrigger', `Successfully created ballot form '${title}' for row ${editedRow}`, {
                        ballotUrl: url,
                        electionOfficers: electionOfficers
                    });
                    
                    // No UI alert during trigger - this would interrupt user workflow
                } catch (error) {
                    // @ts-ignore - Logger is implemented in separate file
                    Common.Logger.error('VotingTrigger', `Error creating ballot form for row ${editedRow}`, {
                        sourceUrl: editUrl,
                        error: error.message,
                        stack: error.stack
                    });
                    
                    // Clear the problematic URL so user knows it failed
                    sheet.getRange(editedRow, formEditUrlColumnIndex).clear();
                    
                    // Add error indicator in a safe way that doesn't interrupt workflow
                    try {
                        const errorNote = `Error: ${error.message.substring(0, 100)}...`;
                        sheet.getRange(editedRow, formEditUrlColumnIndex).setNote(errorNote);
                    } catch (noteError) {
                        // @ts-ignore - Logger is implemented in separate file
                        Common.Logger.warn('VotingTrigger', 'Could not set error note on cell', noteError);
                    }
                }
            }
        } else if (editedColumn === electionOfficersColumnIndex) {
            console.log(`Election Officers edited in row: ${editedRow}`);
            const title = sheet.getRange(editedRow, titleColumnIndex).getValue();
            // It is possible to enter both a Form URL and Election Officers quickly in the same edit and for two edit events to be called.
            // This edit event might be called before the formEditUrlColumnIndex edit event, in which case the editUrl might be the 'seed ballot' URL.
            // This can be detected by seeing if we have a form title yet!
            if (title) {
                try {
                    VotingService.setElectionOfficers(editUrl, electionOfficers);
                    // @ts-ignore - Logger is implemented in separate file
                    Common.Logger.info('VotingTrigger', `Updated Election Officers for '${title}' and sent notification emails`, {
                        title: title,
                        electionOfficers: electionOfficers
                    });
                } catch (error) {
                    // @ts-ignore - Logger is implemented in separate file
                    Common.Logger.error('VotingTrigger', `Error updating Election Officers for '${title}'`, error);
                }
            }
        } else if (editedColumn === startColumnIndex || editedColumn === endColumnIndex) {
            // @ts-ignore - Logger is implemented in separate file
            Common.Logger.info('VotingTrigger', `Date edited in row ${editedRow} - triggering election lifecycle management`);
            try {
                VotingService.manageElectionLifecycles();
                // @ts-ignore - Logger is implemented in separate file
                Common.Logger.info('VotingTrigger', 'Election lifecycle management completed successfully');
            } catch (error) {
                // @ts-ignore - Logger is implemented in separate file
                Common.Logger.error('VotingTrigger', 'Error in election lifecycle management', error);
            }
        }
    },

    /**
     * 
     * @param {GoogleAppsScript.Events.SheetsOnFormSubmit} e 
     * @returns 
     */
    ballotSubmitHandler: function (e) {
        console.log('Ballot submit handler triggered', e.namedValues);
        console.log('Trigger event', e.source.getId(), e.triggerUid);
        const spreadsheetId = e.source.getId();
        const vote = this.firstValues_(e.namedValues)

        const token = vote[VotingService.Constants.TOKEN_ENTRY_FIELD_TITLE];
        const tokenData = VotingService.Auth.consumeToken(token, spreadsheetId);
        const fiddler = VotingService.Data.getFiddlerForValidResults(spreadsheetId)

        if (!tokenData) {
            console.warn('Invalid vote: ', vote, ' - token not found');
            this.addInvalidVote_(vote, fiddler.getSheet().getParent());
            return;
        }
        // We have a tokenData object 
        const email = tokenData.Email;
        if (tokenData.Used) {
            console.warn('Invalid vote: ', vote, ' - token already used');
            this.addInvalidVote_(vote, fiddler.getSheet().getParent());
            this.sendInvalidVoteEmail_(email, this.getElectionTitle_(fiddler.getSheet().getParent()));
            return;
        }

        const allTokenData = VotingService.Auth.getAllTokens(spreadsheetId);
        const duplicates = allTokenData.filter(td => td.Token !== token).some(td => td.Email === email);
        if (duplicates) {
            console.warn(`Duplicate vote detected for email: ${email}. Vote will not be recorded.`);
            this.addInvalidVote_(vote, fiddler.getSheet().getParent());
            this.sendInvalidVoteEmail_(email, this.getElectionTitle_(fiddler.getSheet().getParent()));
            return;
        }

        // console.log('recording valid vote', vote);
        const votes = fiddler.getData();
        votes.push(vote);
        fiddler.setData(votes).dumpValues();
        this.sendValidVoteEmail_(email, this.getElectionTitle_(fiddler.getSheet().getParent()));
        return;

    },
    
    /**
     * @param {object} spreadsheet
     * @param {function():string} spreadsheet.getName 
     * @returns 
     */
    getElectionTitle_: function (spreadsheet) {
        let electionTitle = spreadsheet.getName();
        if (electionTitle.endsWith(VotingService.Constants.RESULTS_SUFFIX)) {
            electionTitle = electionTitle.slice(0, -VotingService.Constants.RESULTS_SUFFIX.length).trim(); // Remove ' - Results' from the name
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
            const invalidFiddler = bmPreFiddler.PreFiddler().getFiddler({ id: spreadsheet.getId(), sheetName: VotingService.Constants.INVALID_RESULTS_SHEET_NAME, createIfMissing: true });
            const votes = invalidFiddler.getData()
            votes.push(vote);
            invalidFiddler.setData(votes).dumpValues();
            this.setAllSheetsBackgroundToLightRed_(spreadsheet)
            const electionTitle = this.getElectionTitle_(spreadsheet)
            this.sendManualCountNeededEmail_(this.getSpreadsheetUsers_(spreadsheet).join(','), vote, electionTitle);
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
            body: `In election ${electionTitle} this vote ${vote[VotingService.Constants.TOKEN_ENTRY_FIELD_TITLE] ? 'is a duplicate' : 'has no token'} ${JSON.stringify(vote)}. A manual count will now be needed`.trim()
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