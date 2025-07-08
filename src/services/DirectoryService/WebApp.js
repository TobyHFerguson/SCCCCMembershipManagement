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
        const htmlOutput = template.evaluate()
            .setTitle('SCCCC Directory')
        return htmlOutput;
    },

    doPost: (e) => {
        // Handle POST requests if needed (currently not used)
    }
}