VotingService.Menu = {
    create: () => {
        SpreadsheetApp.getUi().createMenu('Voting Service')
            .addItem('Manage Election Lifecycles', 'manageElectionLifecycles')
            .addToUi();
    }
}