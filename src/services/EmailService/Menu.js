EmailService.Menu = {
    create: () => {
        SpreadsheetApp.getUi().createMenu('EmailService')
            .addItem('Send test email', 'showEmailDialog')
            .addToUi();
    }
}

function showEmailDialog() {
  EmailService.UI.showEmailDialog();
}