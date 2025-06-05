
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

const ProfileManagementService = {
    name: 'Profile Management Service',
    service: 'ProfileManagementService'
}

const VotingService = {
    name: 'Voting Service',
    service: 'VotingService',
    WebApp: {},
    Trigger: {}
};

const WebServices = {
    DirectoryService: DirectoryService,
    EmailChangeService: EmailChangeService,
    GroupManagementService: GroupManagementService,
    ProfileManagementService: ProfileManagementService,
    VotingService: VotingService,
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        DocsService,
        MembershipManagement,
        DirectoryService
    };
}