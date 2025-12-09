/**
 * HomePageService WebApp - handles the default entry point for SCCCC Services
 * This service provides the verification code request page that leads to the home page
 */

if (typeof HomePageService === 'undefined') HomePageService = {};

HomePageService.WebApp = {
    /**
     * Handle doGet request for HomePageService
     * Returns the verification code request page (when page=request) or home page (with valid token)
     * 
     * @param {GoogleAppsScript.Events.DoGet} e - The doGet event
     * @param {string} userEmail - The authenticated user's email
     * @param {GoogleAppsScript.HTML.HtmlTemplate} template - The template to evaluate
     * @returns {GoogleAppsScript.HTML.HtmlOutput} The rendered HTML output
     */
    doGet: function (e, userEmail, template) {
        // The home page is rendered client-side via the SPA architecture
        // This just needs to set up the initial HTML container
        // The actual home page rendering happens in _Header.html via navigateToHomePage()
        
        // This should not normally be called since page=request goes through the other path
        // But if called with a valid token, we bootstrap the home page
        template.contentFileName = 'common/html/serviceHomePage.html';
        template.userToken = Common.Auth.TokenManager.getMultiUseToken(userEmail);
        return template.evaluate().setTitle("SCCCC Services - Home");
    }
};
