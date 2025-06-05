Common.Auth.TokenManager = {
    generateToken: () => {
        return Utilities.getUuid(); // Generate a unique UUID
    }, 
    getTokenData:(token) => {
        Common.Auth.TokenStorage.getTokenData().find((tokenData) => tokenData[0] === token) || null;
    }
}