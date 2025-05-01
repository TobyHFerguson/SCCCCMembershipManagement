MembershipManagement.Menu ||= {}
MembershipManagement.create = function () {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu('Membership Management')
        .addItem('Process Transactions', processTransactions.name)
        .addItem('Process Expirations', processExpirations.name)
        .addItem('Process Migrations', processMigrations.name)
        .addToUi();
}


function processTransactions() {
    MembershipManagement
}

function processExpirations() {
    MembershipManagement.processExpirations
}
function processMigrations() {
    MembershipManagement.processMigrations
}