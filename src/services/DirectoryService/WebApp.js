DirectoryService.WebApp = {

    doGet: (e) => {
        console.log('doGet called with parameters:', e.parameter);
        console.log('Request URL:', e.parameter.requestUrl);
        const page = e.parameter.page;
        const token = e.parameter.token;

        if (page === 'request') {
            console.log('Requesting access via email');
            return HtmlService.createTemplateFromFile(MAGIC_LINK_INPUT)
                .evaluate()
                .setTitle('Request Access')
                .setSandboxMode(HtmlService.SandboxMode.IFRAME);
        } else if (token) {
            console.log('Token received:', token);
            const tokenData = getTokenData(token);

            if (tokenData && !tokenData.used) {
                console.log('Token is valid and not used. Email:', tokenData.email);
                markTokenAsUsed(tokenData);
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
            console.log('No token provided. Displaying welcome message.');
            // const html = '<h1>Welcome</h1><p><a href="' + ScriptApp.getService().getUrl() + '?page=request"  target="_self">Request Access</a></p>';
            const html = '<h1>Welcome</h1><p><a href="' + ScriptApp.getService().getUrl() + '?page=request" target="_top">Request Access</a></p>';
            console.log('HTML:', html);
            const htmlOutput = HtmlService.createHtmlOutput(html)
                .setTitle('Welcome')
                .setSandboxMode(HtmlService.SandboxMode.IFRAME)
                .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
            console.log('HTML Output:', htmlOutput);
            return htmlOutput;
        }
    },

    doPost: (e) => {
        // Handle POST requests if needed (currently not used)
    }
}