function onOpen() {
    MembershipManagement.Menu.create();
    DocsService.Menu.create();
    EmailService.Menu.create();
}

function onFormSubmit(e) {
    MembershipManagement.Trigger.onFormSubmit(e);
}


function onEdit(e) {
    const sheet = e.source.getActiveSheet();
    if (sheet.getName() === REGISTRATION_SHEET_NAME) {
        VotingService.Trigger.onEdit(e);
    }
}

function votingFormSubmitHandler(e) {
    VotingService.Trigger.onFormSubmit(e);
}
