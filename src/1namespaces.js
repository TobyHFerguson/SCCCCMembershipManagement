/// <reference path="./types/global.d.ts" />
// @ts-check

/**
 * Namespace declarations for GAS runtime
 * 
 * NOTE: Many namespaces have been flattened to IIFE-wrapped classes per gas-best-practices.md
 * The Common.* structure below provides backward compatibility during the migration.
 * New code should use flat class names directly (e.g., ServiceLogger, not Common.Logging.ServiceLogger)
 * 
 * Flattened namespaces (Phase -1 complete):
 * - Audit.* → AuditLogEntry, AuditLogger, AuditPersistence
 * - Common.Data.ValidatedMember → ValidatedMember
 * - Common.Data.MemberPersistence → MemberPersistence
 * - Common.Data.Access → DataAccess
 * - Common.Data.Storage.SpreadsheetManager → SpreadsheetManager
 * - SheetAccess - Abstraction layer for spreadsheet operations (wraps SpreadsheetManager/Fiddler)
 * - Common.Logging.ServiceLogger → ServiceLogger
 * - Common.Logging.ServiceExecutionLogger → ServiceExecutionLogger
 * - Common.Config.FeatureFlags → FeatureFlags, FeatureFlagsManager
 * - Common.Auth.* → TokenManager, TokenStorage, VerificationCode, VerificationCodeManager
 * - Common.Api.* → ApiClient, ApiClientManager
 * 
 * NOTE: Common namespace REMOVED - all classes now flat (use ApiResponse, not Common.Api.ApiResponse)
 */

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