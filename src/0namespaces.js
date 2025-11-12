/// <reference path="./types/global.d.ts" />
// @ts-check
const Common = {
    Auth: {},
    Data: {
        Storage: {
            SpreadsheetManager: {}
        }
    },
    Logger: {}
};

const GroupSubscription = {};

const EmailChangeService = {
    name: 'Email Change Service',
    service: 'EmailChangeService'
}

const EmailService = { Menu: {} }
const DocsService = { Internal: {} };
// Ensure MembershipManagement exists without redeclaring in environments where
// another script may already declare it (GAS loads files into a single global scope).
if (typeof MembershipManagement === 'undefined') {
    var MembershipManagement = { Internal: {}, Utils: {} };
} else {
    MembershipManagement.Internal = MembershipManagement.Internal || {};
    MembershipManagement.Utils = MembershipManagement.Utils || {};
}
const DirectoryService = {
    name: 'Directory Service',
    service: 'DirectoryService'
};

const GroupManagementService = {
    name: 'Group Management Service',
    service: 'GroupManagementService'
};

// Ensure ProfileManagementService exists (guarded) - some environments reference it
if (typeof ProfileManagementService === 'undefined') {
    var ProfileManagementService = { name: 'Profile Management Service', service: 'ProfileManagementService' };
} else {
    ProfileManagementService = ProfileManagementService || {};
}

// Ensure VotingService exists in the global namespace (guarded)
if (typeof VotingService === 'undefined') {
    var VotingService = {};
} else {
    VotingService = VotingService || {};
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
