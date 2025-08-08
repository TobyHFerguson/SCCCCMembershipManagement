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
        const formIdColumnIndex = headers.indexOf(FORM_ID_COLUMN_NAME) + 1;
        const resultsRecipientColumnIndex = headers.indexOf(MANAGERS_COLUMN_NAME) + 1;
        const triggerStatusColumnIndex = headers.indexOf(TRIGGER_STATUS_COLUMN_NAME) + 1;
        console.log(`Edit detected in row: ${editedRow}, column: ${editedColumn} in sheet: ${sheet.getName()}`);
        console.log(`Form ID column index: ${formIdColumnIndex}, Results Recipient column index: ${resultsRecipientColumnIndex}, Trigger Status column index: ${triggerStatusColumnIndex}`);

        if (editedColumn === formIdColumnIndex && editedRow > 1) {
            console.log(`Form ID edited in row: ${editedRow}`);
            const url = sheet.getRange(editedRow, formIdColumnIndex).getValue();
            const formId = VotingService.extractGasFormId(url);
            if (!formId) {
                throw new Error(`No valid Form ID found in row: ${editedRow}`);
            }
            const resultsRecipients = sheet.getRange(editedRow, resultsRecipientColumnIndex).getValue().split(',').map(email => email.trim());

            if (formId) {
                console.log(`Processing form ID: ${formId} in row: ${editedRow}`);
                const newFormId = VotingService.createBallotForm(formId, resultsRecipients);
                sheet.getRange(editedRow, formIdColumnIndex).setValue(newFormId);
                console.log(`Created ballot form with ID: ${newFormId} and updated sheet.`);
                try {
                    this.attachOnSubmitTrigger_(newFormId);
                    console.log(`Attached votingFormSubmitHandler trigger to form ID: ${newFormId}`);
                    if (triggerStatusColumnIndex > 0) {
                        sheet.getRange(editedRow, triggerStatusColumnIndex).setValue('Active');
                    }
                } catch (error) {
                    console.log(`Error attaching trigger to form ID: ${newFormId}: ${error}`);
                    if (triggerStatusColumnIndex > 0) {
                        sheet.getRange(editedRow, triggerStatusColumnIndex).setValue('Failed: ' + error);
                    }
                    throw error
                }
            }
        }
    },
    /**
     * Attaches the votingFormSubmitHandler trigger to the specified form ID.
     * This will handle form submissions and record votes.
     * 
     * @param {string} formId - the ID of the Google Form to attach the trigger to.
     * 
     * @throws {Error} If there is an issue attaching the trigger.
     */
    attachOnSubmitTrigger_: function (formId) {

        const form = VotingService.getForm(formId);
        const formDestinationType = form.getDestinationType();
        if (formDestinationType !== FormApp.DestinationType.SPREADSHEET) {
            throw new Error(`Form ID: ${formId} does not have a valid destination set. Please set a destination to a Google Sheet.`);
        }
        const spreadsheetId = form.getDestinationId(); // Ensure the form has a valid destination
        // remove any existing triggers for this form
        ScriptApp.getProjectTriggers().filter(trigger => trigger.getHandlerFunction() === 'votingFormSubmitHandler' && trigger.getTriggerSourceId() === formId)
            .forEach(trigger => {
                ScriptApp.deleteTrigger(trigger);
                console.log(`Deleted existing trigger for form ID: ${formId}`);
            });
        ScriptApp.newTrigger('votingFormSubmitHandler')
            .forForm(spreadsheetId)
            .onFormSubmit()
            .create();
        console.log(`Attached votingFormSubmitHandler trigger to form ID: ${formId}`);
    },
    
    votingFormSubmitHandler: function (e) {
        const formResponse = e.response;
        const itemResponses = formResponse.getItemResponses();
        const formSource = e.source;
        const formId = formSource.getId();
        if (formSource.getDestinationType() !== FormApp.DestinationType.SPREADSHEET) {
            console.log(`Form ID: ${formId} does not have a valid destination set.`);
            return; // Exit if the form does not have a valid destination
        }
        const responsesSpreadsheet = SpreadsheetApp.openById(formSource.getDestinationId());
        const responsesSheet = responsesSpreadsheet.getActiveSheet();

        const consolidatedSheet = responsesSpreadsheet.getSheetByName('Consolidated Responses');
        const responseRow = responsesSheet.getLastRow();
        const responseValues = responsesSheet.getRange(responseRow, 1, 1, responsesSheet.getLastColumn()).getValues()[0];
        const headers = responsesSheet.getRange(1, 1, 1, responsesSheet.getLastColumn()).getValues()[0];

        // Assuming you have a question in your form to collect the token (adjust the question title)
        const tokenQuestionTitle = 'Your Voting Token';
        let submittedToken = null;
        itemResponses.forEach(response => {
            if (response.getItem().getTitle() === tokenQuestionTitle) {
                submittedToken = response.getResponse();
            }
        });

        if (!submittedToken) {
            console.log(`No token submitted in form ID: ${formId}, response: ${formResponse.getId()}`);
            // Optionally mark as invalid in the form response sheet
            return;
        }

        const tokenData = Common.Auth.TokenManager.getTokenData(submittedToken);

        if (tokenData) {
            const voterEmail = tokenData.Email; // Assuming email is in the second column

            // Optional: Verify if the email is a registered member
            if (Common.Data.Access.isMember(voterEmail)) {
                this._recordVote(consolidatedSheet, voterEmail, responseValues);
                Common.Auth.TokenStorage.markTokenAsUsed(submittedToken);
                // this._replaceTokenWithEmail(responsesSheet, responseRow, headers, voterEmail, tokenQuestionTitle);
                console.log(`Valid vote recorded for ${voterEmail} in form ID: ${formId}`);
            } else {
                console.log(`Non-member email ${voterEmail} tried to vote in form ID: ${formId}`);
                // Optionally mark as invalid
            }
        } else {
            console.log(`Invalid token ${submittedToken} submitted in form ID: ${formId}`);
            // Optionally mark as invalid
        }
    },
    _recordVote: function (sheet, voterEmail, responseValues) {
        const timestamp = new Date();
        const voteData = [timestamp, voterEmail, ...responseValues];
        sheet.appendRow(voteData);
    },
    _replaceTokenWithEmail: function (sheet, row, headers, email, tokenQuestionTitle) {
        const tokenColumnIndex = headers.indexOf(tokenQuestionTitle) + 1;
        if (tokenColumnIndex > 0) {
            sheet.getRange(row, tokenColumnIndex).setValue(email);
        }
    }
}