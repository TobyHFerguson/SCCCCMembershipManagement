/// <reference path="./types/global.d.ts" />
// @ts-check
const Common = {
    Auth: {},
    Data: {
        Storage: {
            SpreadsheetManager: {}
        }
    },
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

// Extend VotingService if it already exists (from 0Constants.js), otherwise create it
if (typeof VotingService === 'undefined') {
    var VotingService = {};
}

// Add service properties to VotingService
Object.assign(VotingService, {
    name: 'Voting Service',
    service: 'VotingService',
    Data: VotingService.Data || {},
    WebApp: VotingService.WebApp || {},
    Trigger: VotingService.Trigger || {}
});

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