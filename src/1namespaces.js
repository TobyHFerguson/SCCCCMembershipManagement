
const Common = {
    Auth: {},
    Data: {},
};

const GroupSubscription = {};

const EmailChangeService = {
    name: 'Email Change Service',
    service: 'EmailChangeService'
}

const EmailService = { Menu: {} }
const DocsService = { Internal: {} };
const MembershipManagement = { Internal: {}, Utils: {} }
const DirectoryService = {
    name: 'Directory Service',
    service: 'DirectoryService'
};

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