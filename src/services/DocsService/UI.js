// Guarded initializer so this file can be safely loaded in any order
if (typeof DocsService === 'undefined') {
    // @ts-ignore - create namespace in GAS
    var DocsService = {};
}
DocsService.UI = DocsService.UI || {};

DocsService.UI = {

    showConversionDialog: () => {
        var html = HtmlService.createHtmlOutputFromFile('services/DocsService/ConversionDialog')
            .setWidth(400)
            .setHeight(200);
        SpreadsheetApp.getUi().showModalDialog(html, 'Enter Document URL');
    },

    showHtmlContent: (htmlContent) => {
        var htmlOutput = HtmlService.createHtmlOutput(htmlContent)
            .setWidth(600)
            .setHeight(400);
        SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Converted HTML');
    }
}