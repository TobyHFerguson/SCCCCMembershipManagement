const MAGIC_LINK_INPUT = 'services/DirectoryService/html/magicLinkInput.html'; // Name of the HTML file for input form


function doGet(e) {
    const service = e.parameter.service;
    if (!service) {
        return HtmlService.createHtmlOutput('<h1>No service parameter given. The url must have a service parameter!</p>');
    }
    const page = e.parameter.page;
    if (page === 'request') {
        const template = HtmlService.createTemplateFromFile(MAGIC_LINK_INPUT);
        template.service = service;
        const output = template.evaluate()
            .setTitle('Request Access')
            .setSandboxMode(HtmlService.SandboxMode.IFRAME);
        return output;
    }
    const token = e.parameter.token;
    const tokenData = Common.Auth.TokenStorage.getTokenData(token);
    if (!tokenData || tokenData.used) {
        return HtmlService.createHtmlOutput('<h1>Invalid or Used Link</h1><p>The access link is either invalid or has already been used.</p>');

    }
    Common.Auth.TokenStorage.markTokenAsUsed(token);
    switch (service) {
        case 'DirectoryService':
            return DirectoryService.WebApp.doGet(e, token.email);
            break;
        case 'EmailChangeService':
            return EmailChangeService.WebApp.doGet(e, token.email)
            break;
        default:
            return ContentService.createTextOutput('Invalid service parameter.').setMimeType(ContentService.MimeType.TEXT);
    }
}
function doPost(e) {
    return ContentService.createTextOutput('Post not implemented.').setMimeType(ContentService.MimeType.TEXT);

}
