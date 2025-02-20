if (typeof require !== 'undefined') {
    const { processTransactions, processExpirations, processMigrations } = require("./MembershipManagement");
}


function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Membership Management')
    .addItem('Process Transactions', processTransactions.name)
    .addItem('Process Expirations', processExpirations.name)
    .addItem('Process Migrations', processMigrations.name)
    .addToUi();
  ui.createMenu('Utilities')
    .addItem('testConvert', 'testConvert')
    .addItem('Convert Google Doc to HTML', 'showConversionDialog')
    .addItem('Send Email', 'showEmailDialog')
    .addToUi();
}

function testConvert() {
  var docURL = 'https://docs.google.com/document/d/1Pi-7YpzC4WDofRYwkPiMtUjFFLkspUtszhaN9kKzwI4/edit?usp=sharing';
  var htmlContent = DocsService.convertDocToHtml(docURL);
  var htmlOutput = HtmlService.createHtmlOutput(htmlContent)
    .setWidth(600)
    .setHeight(400);
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Converted HTML');
}
function showConversionDialog() {
  var html = HtmlService.createHtmlOutputFromFile('Html/ConversionDialog')
    .setWidth(400)
    .setHeight(200);
  SpreadsheetApp.getUi().showModalDialog(html, 'Enter Document URL');
}
function convertAndShowHtml(docURL) {
  var htmlContent = DocsService.convertDocToHtml(docURL);
  var htmlOutput = HtmlService.createHtmlOutput(htmlContent)
    .setWidth(600)
    .setHeight(400);
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Converted HTML');
}
function handleUserInput(form) {
  var docURL = form.docURL;
  convertAndShowHtml(docURL);
}
function showEmailDialog() {
  var actionSpecTypes = getActionSpecTypes();
  var template = HtmlService.createTemplateFromFile('Html/EmailDialog');
  template.actionSpecTypes = actionSpecTypes;
  var html = template.evaluate()
    .setWidth(400)
    .setHeight(300);
  SpreadsheetApp.getUi().showModalDialog(html, 'Send Email');
}
function sendEmail(form) {
  console.log('form: ', form);
  var emailAddress = form.emailAddress;
  console.log('selectedKeys', form.selectedKeys);
  var selectedKeys = Array.isArray(form.selectedKeys) ? form.selectedKeys : [form.selectedKeys]; // Ensure selectedKeys is always an array
  var actionSpecs = ConfigurationManager.getActionSpecs(); // Assuming this function returns the ActionSpecs object

  selectedKeys.forEach(function (key) {
    spec = actionSpecs[key];
    if (spec) {
      const member = {
        First: 'John',
        Last: 'Doe',
        Joined: '2020-01-01',
        Expires: '2021-01-01',
        Period: 1,
        Directory: 'Yes',
        Phone: '123-456-7890',
        'Renewed On': '2020-12-31',
        Migrated: '2020-01-01',
        Email: emailAddress
      };

      const message = {
        to: member.Email,
        subject: utils.expandTemplate(spec.Subject, member),
        htmlBody: utils.expandTemplate(spec.Body, member)
      };
      console.log(message);
      MailApp.sendEmail(message);
    }
  });
}
function getActionSpecTypes() {
  var actionSpecs = ConfigurationManager.getActionSpecs();
  const result = Object.keys(actionSpecs);
  console.log('getActionSpecTypes', result);
  return result;
}

