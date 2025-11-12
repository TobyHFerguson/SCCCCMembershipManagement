// Guarded initializer so this file can be safely loaded in any order
if (typeof EmailService === 'undefined') {
  // @ts-ignore - create namespace in GAS
  var EmailService = {};
}
EmailService.Menu = EmailService.Menu || {};

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