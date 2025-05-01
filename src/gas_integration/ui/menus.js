

function makeUtilitiesMenu() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Utilities')
    .addItem('testConvert', 'testConvert')
    .addItem('Convert Google Doc to HTML', 'showConversionDialog')
    .addItem('Send Email', 'showEmailDialog')
    .addToUi();
}

function showConversionDialog() {
    DocsService.showConversionDialog();
}

function testConvert() {
    var docURL = 'https://docs.google.com/document/d/1Pi-7YpzC4WDofRYwkPiMtUjFFLkspUtszhaN9kKzwI4/edit?usp=sharing';
    var htmlContent = DocsService.convertDocToHtml(docURL);
    var htmlOutput = HtmlService.createHtmlOutput(htmlContent)
      .setWidth(600)
      .setHeight(400);
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Converted HTML');
  }