function onOpen() {
    MembershipManagement.Menu.create()
    makeUtilitiesMenu();
}

function onFormSubmit(e) {
    MembershipManagement.Trigger.onFormSubmit(e);
}