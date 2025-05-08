Common.Auth.TokenManager = {
    _generateToken: () => {
        return Utilities.getUuid(); // Generate a unique UUID
    }
}