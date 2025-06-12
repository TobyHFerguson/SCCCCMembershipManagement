

// Always arrive here with a validated token converted to the userEmail
VotingService.WebApp.doGet = function (e, userEmail) {
    return this._renderVotingOptions(userEmail)
}

VotingService.WebApp._renderVotingOptions = function (userEmail) {
    const voteDataForTemplate = this._getVotingDataForTemplate(userEmail);

    const htmlTemplate = HtmlService.createTemplateFromFile('services/VotingService/ActiveVotes.html');
    htmlTemplate.userEmail = userEmail;
    htmlTemplate.activeVotes = voteDataForTemplate;
    return htmlTemplate.evaluate();
}

VotingService.WebApp._getVotingDataForTemplate = function (userEmail) {
    const activeVotes = this._getActiveVotes();
    return activeVotes.map(vote => {
        return {
            title: vote[VOTE_TITLE_COLUMN_NAME],
            formUrl: this._getFormUrlWithTokenField(userEmail, vote)
        }
    });
}
VotingService.WebApp._getFormUrlWithTokenField = function (userEmail, vote) {
    const token = Common.Auth.TokenManager.generateToken(userEmail);
    Common.Auth.TokenStorage.storeToken(userEmail, token);
    const components = VotingService.parsePrefilledFormUrlComponents(vote[PREFILLED_URL_COLUMN_NAME]);
    const form = FormApp.openById(vote[FORM_ID_COLUMN_NAME]);
    return form.getPublishedUrl() + '?entry.' + components.entryTokenId + '=' + token;
}


VotingService.WebApp._getActiveVotes = function () {
    const data = Common.Data.Access.getVotingData();

    const today = new Date();
    const activeVotes = data.filter(vote => {
        const startDate = vote['Start Date'] ? new Date(vote['Start Date']) : null;
        const endDate = vote['End Date'] ? new Date(vote['End Date']) : null;
        return (startDate === null || startDate <= today) && (endDate === null || endDate >= today);
    });
    return activeVotes;
}