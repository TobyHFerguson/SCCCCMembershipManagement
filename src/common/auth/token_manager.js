Common.Auth.TokenManager = {
    generateToken: () => {
        return Utilities.getUuid(); // Generate a unique UUID
    }, 
    getTokenData:(token) => {
        return Common.Auth.TokenStorage.getTokenData().find((tokenData) => tokenData.Token === token) || null;
    }
}