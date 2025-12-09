const DIRECTORY = 'services/DirectoryService/html/directory.html'; // Name of the HTML file for the directory
const SERVICE = 'DirectoryService'
DirectoryService.WebApp = {
    /**
     * @deprecated This WebApp.doGet is no longer used in the SPA flow.
     * Directory service is accessed via API endpoints from the SPA home page.
     * This remains for backward compatibility with legacy magic link flow only.
     */
    doGet: (e, userEmail, template) => {
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