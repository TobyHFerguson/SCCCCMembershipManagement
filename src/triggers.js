function onOpen() {
    MembershipManagement.Menu.create();
    DocsService.Menu.create();
    EmailService.Menu.create();
}

function onFormSubmit(e) {
    MembershipManagement.Trigger.onFormSubmit(e);
}