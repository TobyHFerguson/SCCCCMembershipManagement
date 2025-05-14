
const Common = {
    Auth: {},
    Data: {},
};

const EmailChangeService = {}
const EmailService = { Menu: {} }
const DocsService = { Internal: {} };
const MembershipManagement = { Internal: {}, Utils: {} }
const DirectoryService = {};

const Services = {
    DirectoryService: DirectoryService,
    EmailChangeService: EmailChangeService
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        DocsService,
        MembershipManagement,
        DirectoryService
    };
}