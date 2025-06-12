function onOpen() {
    MembershipManagement.Menu.create();
    DocsService.Menu.create();
    EmailService.Menu.create();
}

function onFormSubmit(e) {
    MembershipManagement.Trigger.onFormSubmit(e);
}


function handleRegistrationSheetEdit(e) {
    const sheet = e.source.getActiveSheet();
    if (sheet.getName() === REGISTRATION_SHEET_NAME) {
        console.log(`Edit detected in registration sheet: ${sheet.getName()}`);
        VotingService.Trigger.handleRegistrationSheetEdit(e);
    }
}

function votingFormSubmitHandler(e) {
    console.log('Voting form submitted:', e);
    VotingService.Trigger.votingFormSubmitHandler(e);
}
