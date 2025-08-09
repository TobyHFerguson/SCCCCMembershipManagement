function onOpen() {
    MembershipManagement.Menu.create();
    DocsService.Menu.create();
    EmailService.Menu.create();
}

function onFormSubmit(e) {
    MembershipManagement.Trigger.onFormSubmit(e);
}


function handleEditEvent(e) {
    const sheet = e.source.getActiveSheet();
    if (sheet.getName() === REGISTRATION_SHEET_NAME) {
        console.log(`Edit detected in registration sheet: ${sheet.getName()}`);
        VotingService.Trigger.handleRegistrationSheetEdit(e);
    }
}

function ballotSubmitHandler(e) {
    console.log('Voting form submitted:', e);
    VotingService.Trigger.ballotSubmitHandler(e);
}

function manageElectionLifecycles() {
    console.log('Managing election lifecycles');
    VotingService.manageElectionLifecycles();
}
