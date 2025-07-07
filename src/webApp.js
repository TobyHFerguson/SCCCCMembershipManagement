const MAGIC_LINK_INPUT = 'common/auth/magicLinkInput.html'; // Name of the HTML file for input form
const _LAYOUT_FILE = 'common/html/_Layout.html'; // Name of the layout file

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

        const contentFileName = MAGIC_LINK_INPUT
        const template = HtmlService.createTemplateFromFile(_LAYOUT_FILE);
        template.breakpoints = {
            mobile: mobileBreakpoint,
            tabletMin: tabletMinBreakpoint,
            tabletMax: tabletMaxBreakpoint
        };
        template.contentFileName = contentFileName;
        template.include = _includeHtml; 
        template.service = service.service;
        template.serviceName = service.name
        const output = template.evaluate()
            .setTitle(`Request Access - ${contentFileName.replace('Content', '')}`)
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

/**
 * Helper function to include other HTML files within a template.
 * This function should be passed as a template variable (e.g., template.include = includeHtml;)
 * from doGet() to be accessible in the HTML.
 *
 * @param {string} filename The name of the HTML file (e.g., '_Header', '_Footer')
 * @returns {string} The evaluated HTML content of the included file.
 */
function _includeHtml(filename) {
  // HtmlService.createTemplateFromFile() processes the *included* file as a template too.
  const partialTemplate = HtmlService.createTemplateFromFile(filename);

  // When a helper function like 'includeHtml' is called from within an HTML template,
  // 'this' inside 'includeHtml' refers to the template object's context (i.e., 'template' from doGet).
  // We need to copy all variables from the parent template to the partial template
  // so that the partials can access variables like mobileBreakpoint, serviceName, etc.
  const data = this; 
  for (const key in data) {
    partialTemplate[key] = data[key];
  }

  return partialTemplate.evaluate().getContent(); // Get the string content
}
//TODO #138 - make this run at start up
// Don't forget your setInitialBreakpoints() function to set up Script Properties:
/*
function setInitialBreakpoints() {
  const scriptProperties = PropertiesService.getScriptProperties();
  if (!scriptProperties.getProperty('MOBILE_SCREEN_BREAKPOINT')) {
    scriptProperties.setProperty('MOBILE_SCREEN_BREAKPOINT', '430');
  }
  if (!scriptProperties.getProperty('TABLET_SCREEN_BREAKPOINT')) {
    scriptProperties.setProperty('TABLET_SCREEN_BREAKPOINT', '1023');
  }
  if (!scriptProperties.getProperty('SERVICE_NAME')) {
    scriptProperties.setProperty('SERVICE_NAME', 'Access Management');
  }
  Logger.log("Initial breakpoints and service name set.");
}
*/
