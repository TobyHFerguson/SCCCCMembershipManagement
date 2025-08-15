function onOpen() {
    MembershipManagement.Menu.create();
    DocsService.Menu.create();
    EmailService.Menu.create();
    VotingService.Menu.create();
}

/**
 * 
 * @param {GoogleAppsScript.Events.FormsOnFormSubmit} e 
 */
function onFormSubmit(e) {
    MembershipManagement.Trigger.onFormSubmit(e);
}

/**
 * 
 * @param {GoogleAppsScript.Events.SheetsOnEdit} e 
 */
function handleEditEvent(e) {
    const sheet = e.source.getActiveSheet();
    if (sheet.getName() === REGISTRATION_SHEET_NAME) {
        console.log(`Edit detected in registration sheet: ${sheet.getName()}`);
        VotingService.Trigger.handleRegistrationSheetEdit(e);
    }
}

/**
 * 
 * @param {GoogleAppsScript.Events.SheetsOnFormSubmit} e 
 */
function ballotSubmitHandler(e) {
    VotingService.Trigger.ballotSubmitHandler(e);
}

function manageElectionLifecycles() {
    console.log('Managing election lifecycles');
    VotingService.manageElectionLifecycles();
}
