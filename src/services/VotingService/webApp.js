

// Always arrive here with a validated token converted to the userEmail
VotingService.WebApp.doGet = function (e, userEmail) {
    return this._renderVotingOptions(userEmail)
}

VotingService.WebApp._renderVotingOptions = function (userEmail) {
    const voteDataForTemplate = this._getVotingDataForTemplate(userEmail);

    const htmlTemplate = HtmlService.createTemplate(HtmlService.createHtmlOutputFromFile('services/VotingService/ActiveVotes.html').getContent());
    htmlTemplate.userEmail = userEmail;
    htmlTemplate.activeVotes = voteDataForTemplate;
    return htmlTemplate.evaluate();
}

VotingService.WebApp._getVotingDataForTemplate = function (userEmail) {
    const activeVotes = this._getActiveVotes();
    return activeVotes.map(vote => ({
        title: vote.title,
        formUrl: this._getFormUrlWithTokenField(userEmail, vote['Form ID'], TOKEN_ENTRY_FIELD_TITLE)
    }));
}
VotingService.WebApp._getFormUrlWithTokenField = function (userEmail, formId, tokenFieldTitle) {
    const token = Common.Auth.TokenManager.generateToken(userEmail);
    Common.Auth.TokenStorage.storeToken(token, userEmail);
    const form = FormApp.openById(formId);
    const items = form.getItems();
    for (const item of items) {
        if (item.getTitle() === tokenFieldTitle && item.getType() === FormApp.ItemType.TEXT) {
            return form.getPublishedUrl() + '&entry.' + item.getId() + '=' + token;
        }
    }
    // Handle case where token field isn't found (error message or default field?)
    throw new Error(`Token field "${tokenFieldTitle}" not found in form ID: ${formId}`);
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