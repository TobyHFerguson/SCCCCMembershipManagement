const DIRECTORY = 'services/DirectoryService/html/directory.html'; // Name of the HTML file for the directory
const SERVICE = 'DirectoryService'
DirectoryService.WebApp = {

    doGet: (e, userEmail) => {
        const service = e.parameter.service;
        if (service !== SERVICE) {
            return HtmlService.createHtmlOutput(`<h1>Invalid service. Was expecting ${DIRECTORY} but got ${service}</p>`);

        }
        const template = HtmlService.createTemplateFromFile(DIRECTORY);
        template.userEmail = userEmail;
        const htmlOutput = template.evaluate()
            .setTitle('SCCCC Directory')
            .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
        return htmlOutput;
    },

    doPost: (e) => {
        // Handle POST requests if needed (currently not used)
    }
}