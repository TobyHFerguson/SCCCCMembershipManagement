DocsService.Menu = {
    create: () => {
        SpreadsheetApp.getUi().createMenu('Utilities')
        .addItem('Initialize Triggers', initializeTriggers.name)
            .addItem('testConvert', 'testConvert')
            .addItem('Convert Google Doc to HTML', 'showConversionDialog')
            .addToUi();
    }

}



function showConversionDialog() {
    DocsService.UI.showConversionDialog();
}

function testConvert() {
    var docURL = 'https://docs.google.com/document/d/1Pi-7YpzC4WDofRYwkPiMtUjFFLkspUtszhaN9kKzwI4';
    var htmlContent = DocsService.convertDocToHtml(docURL);
    var htmlOutput = HtmlService.createHtmlOutput(htmlContent)
        .setWidth(600)
        .setHeight(400);
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Converted HTML');
}