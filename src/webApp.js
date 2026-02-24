// @ts-check
/**
 * Main entry point for SCCCC Services web application.
 * Serves the static SPA app.html page.
 * 
 * @param {GoogleAppsScript.Events.DoGet} e 
 * @returns {GoogleAppsScript.HTML.HtmlOutput | GoogleAppsScript.Content.TextOutput}
 */
function doGet(e) {
    // Deployment verification endpoint — returns JSON, no auth required
    if (e && e.parameter && e.parameter.verify === '1') {
        const result = verifyAll();
        return ContentService.createTextOutput(JSON.stringify(result))
            .setMimeType(ContentService.MimeType.JSON);
    }

    // Responsive CSS diagnostic page — served via static pipeline (no template processing)
    if (e && e.parameter && e.parameter.page === 'responsive-test') {
        return HtmlService.createHtmlOutputFromFile('common/html/responsiveTest')
            .setTitle('SCCCC - Responsive CSS Test');
    }

    // Main SPA — static HTML page
    AppLogger.configure();
    AppLogger.info('WebApp', 'doGet() called');
    return HtmlService.createHtmlOutputFromFile('common/html/app')
        .setTitle('SCCCC Services');
}
function doPost(e) {
    return createTextResponse('doPost() unimplemented');
}

function createTextResponse(text) {
    return ContentService.createTextOutput(text).setMimeType(
        ContentService.MimeType.TEXT
    )
}

