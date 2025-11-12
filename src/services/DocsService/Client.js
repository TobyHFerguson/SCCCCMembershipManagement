
// Guarded initializer so this file can be safely loaded in any order
if (typeof DocsService === 'undefined') {
  // @ts-ignore - create namespace in GAS
  var DocsService = {};
}
DocsService.Client = DocsService.Client || {};

DocsService.Client = {
  handleUserInput: (form) => {
    console.log('DocsService.Client.handleUserInput called');
    var docURL = form.docURL;
    var htmlContent = DocsService.convertDocToHtml(docURL);
    DocsService.UI.showHtmlContent(htmlContent);
  }
}

function DocsService_Client_handleUserInput(form) {
  console.log('DocsService_Client_handleUserInput called');
  return DocsService.Client.handleUserInput(form);
}