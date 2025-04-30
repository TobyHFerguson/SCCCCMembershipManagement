

DocsService.showConversionDialog = function () {
    var html = HtmlService.createHtmlOutputFromFile('Html/ConversionDialog')
        .setWidth(400)
        .setHeight(200);
    SpreadsheetApp.getUi().showModalDialog(html, 'Enter Document URL');
}

DocsService.showHtmlContent = function(htmlContent) {
    var htmlOutput = HtmlService.createHtmlOutput(htmlContent)
        .setWidth(600)
        .setHeight(400);
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Converted HTML');
}