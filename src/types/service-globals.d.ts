// Lightweight shims for GAS global namespaces to ease incremental migration.
// These declare service globals as `any` so the type checker won't error
// while we convert files to guarded initializers. Remove or replace with
// proper types once migration completes.

declare var VotingService: any;
declare var ProfileManagementService: any;
declare var DirectoryService: any;
declare var EmailService: any;
declare var GroupManagementService: any;
declare var DocsService: any;
declare var EmailChangeService: any;
declare var MembershipManagement: any;
declare var Common: any;
declare var GroupSubscription: any;

export {};
