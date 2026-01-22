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

// Audit namespace has been flattened to:
// - AuditLogEntry (src/common/audit/AuditLogEntry.js)
// - AuditLogger (src/common/audit/AuditLogger.js)  
// - AuditPersistence (src/common/audit/AuditPersistence.js)

const GroupSubscription = {};

const EmailChangeService = {
    name: 'Email Change Service',
    service: 'EmailChangeService',
    description: 'Update your email address across all SCCCC systems',
    icon: 'email'
}

const EmailService = { Menu: {} }
const DocsService = { Internal: {} };
const MembershipManagement = { Internal: {}, Utils: {} }
const DirectoryService = {
    name: 'Directory Service',
    service: 'DirectoryService',
    description: 'View the member directory with contact information',
    icon: 'directory'
};

const GroupManagementService = {
    name: 'Group Management Service',
    service: 'GroupManagementService',
    description: 'Manage your Google Group subscriptions',
    icon: 'groups'
};

const ProfileManagementService = {
    name: 'Profile Management Service',
    service: 'ProfileManagementService',
    description: 'Update your member profile and preferences',
    icon: 'profile'
}

// HomePageService - default service for generic access
const HomePageService = {
    name: 'SCCCC Services',
    service: 'HomePageService',
    description: 'Access SCCCC member services',
    icon: 'home'
};

// Extend VotingService if it already exists (from 0Constants.js), otherwise create it
if (typeof VotingService === 'undefined') {
    var VotingService = {};
}

// Add service properties to VotingService
Object.assign(VotingService, {
    name: 'Voting Service',
    service: 'VotingService',
    description: 'Participate in SCCCC elections',
    icon: 'voting',
    Data: VotingService.Data || {},
    WebApp: VotingService.WebApp || {},
    Trigger: VotingService.Trigger || {}
});

const WebServices = {
    HomePageService: HomePageService,
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