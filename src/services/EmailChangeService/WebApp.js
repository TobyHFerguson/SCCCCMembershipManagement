EmailChangeService.WebApp = {
    doGet: (e, userEmail, template) => {
        // We only get here when the previous token (and therefore email) were valid.
        template.contentFileName = "services/EmailChangeService/EmailChangeForm"
        template.originalEmail = userEmail; // Pass the token to the HTML template
        return template.evaluate().setTitle("SCCCC Email Change Form");
    }
}