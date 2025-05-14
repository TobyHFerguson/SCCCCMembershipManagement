const MAGIC_LINK_INPUT = 'services/DirectoryService/html/magicLinkInput.html'; // Name of the HTML file for input form


function doGet(e) {
    const service = e.parameter.service;
    if (!service) {
        return createTextResponse('No service parameter given. The url must have a service parameter!', 400);
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
        return createTextResponse('Invalid or Used Link - The access link is either invalid or has already been used.', 400);
    }
    if (!tokenData.Email) {
        throw new Error('tokenData.email === null')
    }
    Common.Auth.TokenStorage.markTokenAsUsed(token);
    switch (service) {
        case 'DirectoryService':
            return DirectoryService.WebApp.doGet(e, tokenData.Email);
            break;
        case 'EmailChangeService':
            return EmailChangeService.WebApp.doGet(e, tokenData.Email)
            break;
        default:
            return createTextResponse('Invalid service parameter.');
    }
}
function doPost(e) {
    return createTextResponse('doPost() unimplemented');
}

function createTextResponse(text) {
    return ContentService.createTextOutput(text).setMimeType(
        ContentService.MimeType.TEXT
    )
}

