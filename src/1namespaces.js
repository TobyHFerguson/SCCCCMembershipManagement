
const Common = {
    Auth: {},
    Data: {},
};

const EmailService = { Menu: {} }
const DocsService = { Internal: {} };
const MembershipManagement = { Internal: {}, Utils: {} }
const DirectoryService = {};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        DocsService,
        MembershipManagement,
        DirectoryService
    };
}