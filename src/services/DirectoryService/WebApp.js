const MAGIC_LINK_INPUT = 'services/DirectoryService/html/magicLinkInput.html'; // Name of the HTML file for input form
const DIRECTORY = 'services/DirectoryService/html/directory.html'; // Name of the HTML file for the directory
const SERVICE='DirectoryService'
DirectoryService.WebApp = {

    doGet: (e) => {
        const page = e.parameter.page;
        const token = e.parameter.token;

        if (page === 'request') {
            const template = HtmlService.createTemplateFromFile(MAGIC_LINK_INPUT);
            template.service = SERVICE;
            const output = template.evaluate()
                .setTitle('Request Access')
                .setSandboxMode(HtmlService.SandboxMode.IFRAME);
            return output;
        } else if (token) {
            const tokenData = Common.Auth.TokenStorage.getTokenData(token);

            if (tokenData && !tokenData.used) {
                Common.Auth.TokenStorage.markTokenAsUsed(token);
                const template = HtmlService.createTemplateFromFile(DIRECTORY);
                template.userEmail = tokenData.email; // Assign the email to a template variable
                const htmlOutput = template.evaluate()
                    .setTitle('SCCCC Directory')
                    .setSandboxMode(HtmlService.SandboxMode.IFRAME)
                    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
                return htmlOutput;
            } else {
                console
                return HtmlService.createHtmlOutput('<h1>Invalid or Used Link</h1><p>The access link is either invalid or has already been used.</p>');
            }
        } else {
            const html = '<h1>Welcome</h1><p><a href="' + ScriptApp.getService().getUrl() + '?page=request&service='+ SERVICE +'" target="_top">Request Access</a></p>';
            const htmlOutput = HtmlService.createHtmlOutput(html)
                .setTitle('Welcome')
                .setSandboxMode(HtmlService.SandboxMode.IFRAME)
                .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
            return htmlOutput;
        }
    },

    doPost: (e) => {
        // Handle POST requests if needed (currently not used)
    }
}