MembershipManagement.Menu = {
    create: function () {
        const ui = SpreadsheetApp.getUi();
        ui.createMenu('Membership Management')
            .addItem('Process Transactions', processTransactions.name)
            .addItem('Process Expirations', processExpirations.name)
            .addItem('Process Migrations', processMigrations.name)
            .addToUi();
    }
}


// For functions to be callable from the menu, they need to be in the global scope.
// This is a workaround to make them callable from the menu.
function processTransactions() {
    MembershipManagement.processTransactions()
}
function processExpirations() {
    MembershipManagement.processExpirations()
}
function processMigrations() {
    MembershipManagement.processMigrations()
}