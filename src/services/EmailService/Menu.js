EmailService.Menu = {
    create: () => {
        SpreadsheetApp.getUi().createMenu('EmailService')
            .addItem('Send email', 'showEmailDialog')
            .addToUi();
    }
}

function showEmailDialog() {
  EmailService.UI.showEmailDialog();
}