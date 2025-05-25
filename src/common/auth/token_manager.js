Common.Auth.TokenManager = {
    generateToken: () => {
        return Utilities.getUuid(); // Generate a unique UUID
    }
}