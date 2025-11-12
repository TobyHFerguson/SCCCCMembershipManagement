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

// Service-specific globals are intentionally NOT declared here. Each service
// file should create its own guarded namespace. That avoids duplicate
// declarations when files are loaded in different orders in GAS.
// Ensure MembershipManagement exists without redeclaring in environments where
// another script may already declare it (GAS loads files into a single global scope).
if (typeof MembershipManagement === 'undefined') {
    var MembershipManagement = { Internal: {}, Utils: {} };
} else {
    MembershipManagement.Internal = MembershipManagement.Internal || {};
    MembershipManagement.Utils = MembershipManagement.Utils || {};
}

// ProfileManagementService is defined in its own module; do not redeclare here.

// VotingService may be created by its own file; ensure we don't redeclare it
if (typeof VotingService === 'undefined') {
    // leave undefined; individual service file will create it
}

// Build a safe map of available services without referencing undeclared
// identifiers directly (use typeof checks to avoid ReferenceError at runtime).
const WebServices = {
    DirectoryService: (typeof DirectoryService !== 'undefined') ? DirectoryService : undefined,
    EmailChangeService: (typeof EmailChangeService !== 'undefined') ? EmailChangeService : undefined,
    GroupManagementService: (typeof GroupManagementService !== 'undefined') ? GroupManagementService : undefined,
    ProfileManagementService: (typeof ProfileManagementService !== 'undefined') ? ProfileManagementService : undefined,
    VotingService: (typeof VotingService !== 'undefined') ? VotingService : undefined,
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        DocsService: (typeof DocsService !== 'undefined') ? DocsService : undefined,
        MembershipManagement: (typeof MembershipManagement !== 'undefined') ? MembershipManagement : undefined,
        DirectoryService: (typeof DirectoryService !== 'undefined') ? DirectoryService : undefined
    };
}
