const MAGIC_LINK_INPUT = 'common/auth/magicLinkInput.html'; // Name of the HTML file for input form


function doGet(e) {
    if (!e.parameter.service) {
        return createTextResponse('No service parameter given. The url must have a service parameter!', 400);
    }
    const service = WebServices[e.parameter.service];
    if (!service) {
        console.error('Got an invalid service: ', e.parameter.service)
        console.error('Available services: ', Object.keys(WebServices));
        return createTextResponse("We're sorry - an internal error occurred. We've notified the developers and theres nothing you can do but wait until they fix it")
    }
    const page = e.parameter.page;
    if (page === 'request') {
        const scriptProperties = PropertiesService.getScriptProperties();
        const mobileBreakpoint = scriptProperties.getProperty('MOBILE_BREAKPOINT') || '767';
        const tabletMinBreakpoint = scriptProperties.getProperty('TABLET_MIN_BREAKPOINT') || '768';
        const tabletMaxBreakpoint = scriptProperties.getProperty('TABLET_MAX_BREAKPOINT') || '1032';

        const template = HtmlService.createTemplateFromFile(MAGIC_LINK_INPUT);
        template.breakpoints = {
            mobile: mobileBreakpoint,
            tabletMin: tabletMinBreakpoint,
            tabletMax: tabletMaxBreakpoint
        };
        template.service = service.service;
        template.serviceName = service.name
        const output = template.evaluate()
            .setTitle('Request Access')
        return output;
    }
    const token = e.parameter.token;
    const tokenData = Common.Auth.TokenStorage.getTokenData(token);
    if (!tokenData || tokenData.Used) {
        return createTextResponse('Invalid or Used Link - The access link is either invalid or has already been used.', 400);
    }
    if (!tokenData.Email) {
        throw new Error('tokenData.email === null')
    }
    Common.Auth.TokenStorage.markTokenAsUsed(token);
    
    return service.WebApp.doGet(e, tokenData.Email);
}
function doPost(e) {
    return createTextResponse('doPost() unimplemented');
}

function createTextResponse(text) {
    return ContentService.createTextOutput(text).setMimeType(
        ContentService.MimeType.TEXT
    )
}

