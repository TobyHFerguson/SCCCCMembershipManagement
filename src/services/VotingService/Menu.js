// Guarded initializer so this file can be safely loaded in any order
if (typeof VotingService === 'undefined') {
    // @ts-ignore
    var VotingService = {};
}
VotingService.Menu = VotingService.Menu || {};

VotingService.Menu = {
    create: () => {
        SpreadsheetApp.getUi().createMenu('Voting Service')
            .addItem('Manage Election Lifecycles', 'manageElectionLifecycles')
            .addToUi();
    }
}