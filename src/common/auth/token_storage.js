Common.Auth.TokenStorage = {
    storeToken: (email, token) => {
        const newEntry = {
            Email: email,
            Token: token,
            Timestamp: new Date(),
            Used: false
        }
        const tokenFiddler = Common.Data.Storage.SpreadsheetManager.getFiddler('Tokens');
        const tokens = tokenFiddler.getData();
        tokens.push(newEntry)
        tokenFiddler.setData(tokens).dumpValues();
    },
    getTokenData:(token) => {
        const tokenFiddler = Common.Data.Storage.SpreadsheetManager.getFiddler('Tokens');
        const tokens = tokenFiddler.getData();
        const td = tokens.find((tokenData) => tokenData.Token === token)
        return td || null
    },
    markTokenAsUsed:(token)=> {
        const tokenFiddler = Common.Data.Storage.SpreadsheetManager.getFiddler('Tokens');
        const tokens = tokenFiddler.getData();
        const td = tokens.find((tokenData) => tokenData.Token === token)
        td.Used = true;
        tokenFiddler.setData(tokens).dumpValues();
    }
}

