const MAGIC_LINK_INPUT = 'common/auth/magicLinkInput.html'; // Name of the HTML file for magic link input form
const VERIFICATION_CODE_INPUT = 'common/auth/verificationCodeInput.html'; // Name of the HTML file for verification code input
const _LAYOUT_FILE = 'common/html/_Layout.html'; // Name of the layout file

// @ts-check
/**
 * Main entry point for SCCCC Services web application.
 * Always returns the verification code request page which bootstraps the SPA.
 * No query parameters required - this is the single entry point.
 * 
 * @param {GoogleAppsScript.Events.DoGet} e 
 * @returns {GoogleAppsScript.HTML.HtmlOutput}
 */
function doGet(e) {
    const scriptProperties = PropertiesService.getScriptProperties();
    const mobileBreakpoint = scriptProperties.getProperty('MOBILE_BREAKPOINT') || '767';
    const tabletMinBreakpoint = scriptProperties.getProperty('TABLET_MIN_BREAKPOINT') || '768';
    const tabletMaxBreakpoint = scriptProperties.getProperty('TABLET_MAX_BREAKPOINT') || '1032';
    
    const template = HtmlService.createTemplateFromFile(_LAYOUT_FILE);
    template.breakpoints = {
        mobile: mobileBreakpoint,
        tabletMin: tabletMinBreakpoint,
        tabletMax: tabletMaxBreakpoint
    };
    template.include = _includeHtml;
    
    // Check feature flag to determine which auth flow to use
    const useNewAuth = Common.Config.FeatureFlags.isNewAuthEnabled();
    template.contentFileName = useNewAuth ? VERIFICATION_CODE_INPUT : MAGIC_LINK_INPUT;
    
    // Set empty service for SPA flow (service selected after authentication)
    template.service = '';
    
    // Log which auth flow is being used for monitoring
    if (!useNewAuth) {
        console.warn('[DEPRECATED] Using legacy Magic Link authentication flow. ' +
            'Call Common.Config.FeatureFlags.enableNewAuth() to use the new Verification Code flow.');
    }
    
    const output = template.evaluate()
        .setTitle('SCCCC Services - Request Verification Code')
    return output;
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
  // so that the partials can access variables like breakpoints, etc.
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
