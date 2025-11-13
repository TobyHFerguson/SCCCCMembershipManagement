// Guarded initializer so this file can be safely loaded in any order
if (typeof DirectoryService === 'undefined') {
    // @ts-ignore - create namespace in GAS
    var DirectoryService = {};
}
DirectoryService.WebApp = DirectoryService.WebApp || {};

const DIRECTORY = 'services/DirectoryService/html/directory.html'; // Name of the HTML file for the directory
const SERVICE = 'DirectoryService'
DirectoryService.WebApp = {

    doGet: (e, userEmail, template) => {
        const service = e.parameter.service;
        if (service !== SERVICE) {
            return HtmlService.createHtmlOutput(`<h1>Invalid service. Was expecting ${DIRECTORY} but got ${service}</p>`);

        }
        template.contentFileName = DIRECTORY;
        template.userEmail = userEmail;
        template.directoryEntries = DirectoryService.getDirectoryEntries();
        console.log('Directory entries:', template.directoryEntries);
        const htmlOutput = template.evaluate()
            .setTitle('SCCCC Directory')
        return htmlOutput;
    },

    doPost: (e) => {
        // Handle POST requests if needed (currently not used)
    }
}