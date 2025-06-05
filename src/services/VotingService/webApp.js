const MAGIC_LINK_SERVICE_URL = ScriptApp.getService().getUrl(); // The URL of this web app
const VOTE_REGISTRATION_SHEET_ID = 'YOUR_VOTE_REGISTRATION_SPREADSHEET_ID'; // Replace
const TOKEN_STORAGE_SHEET_ID = 'YOUR_TOKEN_STORAGE_SHEET_ID';   // Replace
const TOKEN_ENTRY_FIELD_TITLE = 'Your Voting Token'; // Adjust

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
    const activeVotes = this._getActiveVoteOptions();
    return activeVotes.map(vote => ({
        title: vote.title,
        formUrl: this._getFormUrlWithTokenField(userEmail, vote.formId, TOKEN_ENTRY_FIELD_TITLE)
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


VotingService.WebApp._getActiveVoteOptions = function () {
    const ss = SpreadsheetApp.openById(VOTE_REGISTRATION_SHEET_ID);
    const sheet = ss.getActiveSheet();
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const titleColIndex = headers.indexOf('Vote Title');
    const formIdColIndex = headers.indexOf('Voting Form ID');
    const startDateColIndex = headers.indexOf('Start Date');
    const endDateColIndex = headers.indexOf('End Date');

    const activeVotes = [];
    const today = new Date();

    for (let i = 1; i < data.length; i++) {
        const startDate = data[i][startDateColIndex] ? new Date(data[i][startDateColIndex]) : null;
        const endDate = data[i][endDateColIndex] ? new Date(data[i][endDateColIndex]) : null;
        const formId = data[i][formIdColIndex];
        const title = data[i][titleColIndex];

        if (formId && title &&
            (startDate === null || startDate <= today) &&
            (endDate === null || endDate >= today)) {
            activeVotes.push({ title: title, formId: formId });
        }
    }
    return activeVotes;
}