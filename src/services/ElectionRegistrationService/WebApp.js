const ELECTION_REGISTRATION_SERVICE = 'ElectionRegistrationService'

ElectionRegistrationService.WebApp = {
    /**
     * Handle GET requests for the Election Registration Service
     * This service provides a simple API to check if an email belongs to a club member
     */
    doGet: (e, userEmail, template) => {
        const service = e.parameter.service;
        if (service !== ELECTION_REGISTRATION_SERVICE) {
            return HtmlService.createHtmlOutput(`<h1>Invalid service. Was expecting ${ELECTION_REGISTRATION_SERVICE} but got ${service}</h1>`);
        }

        // For now, return a simple information page
        // The actual isMember API is called via the endpoint
        template.contentFileName = 'services/ElectionRegistrationService/ElectionRegistrationInfo.html';
        template.userEmail = userEmail;
        const htmlOutput = template.evaluate()
            .setTitle('SCCCC Election Registration Service');
        return htmlOutput;
    },

    doPost: (e) => {
        // Handle POST requests if needed (currently not used)
    }
}
