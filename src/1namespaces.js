
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

const GroupManagementService = {
    name: 'Group Management Service',
    service: 'GroupManagementService'
};

const VotingService = {
    name: 'Voting Service',
    service: 'VotingService',
    Trigger: {}
};

const WebServices = {
    DirectoryService: DirectoryService,
    EmailChangeService: EmailChangeService,
    GroupManagementService: GroupManagementService,
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        DocsService,
        MembershipManagement,
        DirectoryService
    };
}