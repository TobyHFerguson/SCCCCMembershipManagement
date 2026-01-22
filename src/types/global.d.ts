/// <reference path="./membership.d.ts" />

/**
 * Global type definitions for the SCCCC Management system
 * Only truly shared types across multiple services should be defined here.
 */

// Export membership types globally for easier access
type ActionType = MembershipManagement.ActionType;
type Transaction = MembershipManagement.Transaction;
type ActionSchedule = MembershipManagement.ActionSchedule;
type ActionSpec = MembershipManagement.ActionSpec;
type ExpiredMember = MembershipManagement.ExpiredMember;
type ExpiredMembersQueue = MembershipManagement.ExpiredMembersQueue;

/**
 * AppLogger - Production-friendly logging utility for Google Apps Script
 * Named AppLogger (not Logger) to avoid conflict with GAS built-in Logger.
 * Pattern: IIFE-wrapped class with static methods (per gas-best-practices.md)
 */
declare class AppLogger {
    static debug(service: string, message: string, data?: any): void;
    static info(service: string, message: string, data?: any): void;
    static warn(service: string, message: string, data?: any): void;
    static error(service: string, message: string, data?: any): void;
    static configure(): void;
    static setLevel(level: string): void;
    static getLogs(): Array<[Date | string, string, string, string, string]>;
    static clearLogs(): void;
    static setContainerSpreadsheet(spreadsheetId: string): void;
}

// Core authentication types (used across services)
interface TokenDataType {
    Email: string;
    Token: string;
    Timestamp: Date;
    Used: boolean;
    Service?: string;
}

// System logging types
interface SystemLogEntry {
    Timestamp: Date;
    Level: string;
    Service: string;
    Message: string;
    Data: string;
}

// Fiddler-related types (used across multiple services)
interface FormResponse {
    timestamp: Date;
    'VOTING TOKEN': string;
    [key: string]: any;
}

interface Result {
    'Voter Email': string;
    [key: string]: any;
}

interface BootstrapData {
    Reference: string;
    id: string;
    sheetName: string;
    createIfMissing: boolean;
}

// System Logs data structure (for logging)
interface SystemLogEntry {
    Timestamp: Date;
    Level: string;
    Service: string;
    Message: string;
    Data: string;
}

/**
 * Represents a data management utility for a spreadsheet.
 * @template T The type of data objects managed by the Fiddler.
 */
interface Fiddler<T = any> {
    getData(): T[];
    setData(data: T[]): Fiddler<T>;
    dumpValues(): void;
    getSheet(): GoogleAppsScript.Spreadsheet.Sheet;
    getSpreadsheet(): GoogleAppsScript.Spreadsheet.Spreadsheet;
    findRow(criteria: Partial<T>): T | null;
    findRows(criteria: Partial<T>): T[];
    addRow(row: T): Fiddler<T>;
    updateRow(criteria: Partial<T>, updates: Partial<T>): boolean;
    removeRows(criteria: Partial<T>): number;
    getRowCount(): number;
    clearData(): Fiddler<T>;
    mapRows(mapper: (row: T) => T): Fiddler<T>;
    needFormulas(): Fiddler<T>;
    getFormulaData(): T[];
}

// Fiddler options interfaces
interface FiddlerOptions {
    id?: string;
    sheetName?: string;
    createIfMissing?: boolean;
}

interface FormResponsesOptions {
    id: string;
    sheetName: 'Form Responses 1';
    createIfMissing?: boolean;
}

interface BootStrapOptions {
    id: '1EF3swXKvLv6jPz0cxC7J1al8m0vk9cWOx5t9W0LEy2g';
    sheetName: 'Bootstrap';
    createIfMissing?: boolean;
}

interface ValidResultsOptions {
    id: string;
    sheetName: 'Validated Results';
    createIfMissing?: boolean;
}

interface InvalidResultsOptions {
    id: string;
    sheetName: 'Invalid Results';
    createIfMissing?: boolean;
}

interface ActiveMembersOptions {
    id: string;
    sheetName: 'ActiveMembers';
    createIfMissing?: boolean;
}

interface ExpiryScheduleOptions {
    id: string;
    sheetName: 'ExpirySchedule';
    createIfMissing?: boolean;
}

// Member data structure (for membership management)
interface Member {
    Status: string;
    Email: string;
    First: string;
    Last: string;
    Phone: string;
    Joined: Date;
    Expires: Date;
    Period: Number;
    'Directory Share Name': boolean;
    'Directory Share Email': boolean;
    'Directory Share Phone': boolean;
    'Renewed On': Date;
}

// ============================================================================
// Audit Classes (Flat Pattern - no namespace nesting)
// ============================================================================

/**
 * Audit Log Entry class - creates validated audit entries
 */
declare class AuditLogEntry {
    /** Timestamp of the event */
    Timestamp: Date;
    /** Type of business event (ActionType values or 'DeadLetter') */
    Type: string;
    /** Outcome of the operation */
    Outcome: string;
    /** Additional human-readable note */
    Note: string;
    /** Error message if applicable */
    Error: string;
    /** JSON-serialized detailed data */
    JSON: string;
    /** Optional unique identifier for deduplication */
    Id?: string;

    constructor(
        type: string,
        outcome: string,
        note?: string,
        error?: string,
        jsonData?: string,
        timestamp?: Date
    );

    /** Convert to array for spreadsheet persistence */
    toArray(): Array<Date | string>;

    /** Static factory method - never throws */
    static create(
        type: string,
        outcome: string,
        note?: string,
        error?: string,
        jsonData?: string,
        timestamp?: Date
    ): AuditLogEntry;

    /** Validate array of entries */
    static validateArray(
        entries: Array<AuditLogEntry | object>,
        context: string
    ): AuditLogEntry[];
}

/**
 * Parameters for creating an audit log entry
 */
interface AuditLogParams {
    type: string;
    outcome: 'success' | 'fail';
    note?: string;
    error?: string;
    jsonData?: any;
}

/**
 * Pure JavaScript audit logger - creates audit entries without side effects
 */
declare class AuditLogger {
    constructor(today?: Date);
    createLogEntry(params: AuditLogParams): AuditLogEntry;
    createLogEntries(paramsArray: AuditLogParams[]): AuditLogEntry[];
}

/**
 * Audit persistence class - writes to Audit sheet
 */
declare class AuditPersistence {
    static persistAuditEntries(auditEntries: AuditLogEntry[]): number;
}

// ============================================================================
// SpreadsheetManager (Flat Pattern - no namespace nesting)
// ============================================================================

/**
 * SpreadsheetManager class - Low-level spreadsheet access via bmPreFiddler
 */
declare class SpreadsheetManager {
    /**
     * Gets a fiddler based on the sheet name.
     */
    static getFiddler(sheetName: 'Tokens'): Fiddler<TokenDataType>;
    static getFiddler(sheetName: 'Elections'): Fiddler<VotingService.Election>;
    static getFiddler(sheetName: 'Form Responses 1'): Fiddler<FormResponse>;
    static getFiddler(sheetName: 'Validated Results'): Fiddler<Result>;
    static getFiddler(sheetName: 'Invalid Results'): Fiddler<Result>;
    static getFiddler(sheetName: 'Bootstrap'): Fiddler<BootstrapData>;
    static getFiddler(sheetName: 'SystemLogs'): Fiddler<SystemLogEntry>;
    static getFiddler(sheetName: 'ActiveMembers'): Fiddler<Member>;
    static getFiddler(sheetName: 'ActionSpecs'): Fiddler<MembershipManagement.ActionSpec>;
    static getFiddler(sheetName: 'ExpirySchedule'): Fiddler<MembershipManagement.ExpirySchedule>;
    static getFiddler(sheetName: 'ExpirationFIFO'): Fiddler<ExpiredMember>;
    static getFiddler(sheetName: 'Audit'): Fiddler<AuditLogEntry>;
    static getFiddler(sheetName: string): Fiddler<any>;

    /**
     * Clear cached fiddler(s). Call when external code may have modified the sheet.
     */
    static clearFiddlerCache(sheetName?: string): void;

    /**
     * Returns the data from a fiddler with formulas merged into it.
     */
    static getDataWithFormulas<T>(fiddler: Fiddler<T>): T[];

    /**
     * Converts links in a sheet to hyperlinks.
     */
    static convertLinks(sheetName: string): void;

    /**
     * Get a sheet directly by name (replaces fiddler for simpler access)
     */
    static getSheet(sheetName: string): GoogleAppsScript.Spreadsheet.Sheet;
}

// Common Data namespace - ValidatedMember and persistence
declare namespace Common {
    namespace Data {
        /**
         * ValidatedMember class with constructor validation
         */
        class ValidatedMember {
            Email: string;
            Status: string;
            First: string;
            Last: string;
            Phone: string;
            Joined: Date;
            Expires: Date;
            Period: number | null;
            'Directory Share Name': boolean;
            'Directory Share Email': boolean;
            'Directory Share Phone': boolean;
            'Renewed On': Date | null;
            
            constructor(
                email: string,
                status: string,
                first: string,
                last: string,
                phone: string,
                joined: Date,
                expires: Date,
                period: number | null,
                dirName: boolean,
                dirEmail: boolean,
                dirPhone: boolean,
                renewedOn: Date | null
            );
            
            /**
             * Convert to array for sheet persistence
             */
            toArray(): Array<string | Date | number | boolean | null>;
            
            /**
             * Static factory - never throws, returns null on failure
             */
            static fromRow(
                rowArray: Array<any>,
                headers: string[],
                rowNumber: number,
                errorCollector: { errors: string[], rowNumbers: number[] } | null
            ): ValidatedMember | null;
            
            /**
             * Batch validation with consolidated email alert
             */
            static validateRows(
                rows: Array<Array<any>>,
                headers: string[],
                context: string
            ): ValidatedMember[];
            
            /**
             * Column headers constant
             */
            static HEADERS: string[];
        }
        
        /**
         * Member persistence helper for selective writes
         */
        namespace MemberPersistence {
            /**
             * Write only changed cells to minimize version history noise
             */
            function writeChangedCells(
                sheet: GoogleAppsScript.Spreadsheet.Sheet,
                originalRows: Array<Array<any>>,
                modifiedMembers: ValidatedMember[],
                headers: string[]
            ): number;
            
            /**
             * Value equality that handles Dates and primitives
             */
            function valuesEqual(a: any, b: any): boolean;
        }
        
        namespace Storage {
            namespace SpreadsheetManager {
                // Most specific overloads first
                function getFiddler(sheetName: 'Tokens'): Fiddler<TokenDataType>;
                function getFiddler(sheetName: 'Elections'): Fiddler<VotingService.Election>;
                function getFiddler(sheetName: 'Form Responses 1'): Fiddler<FormResponse>;
                function getFiddler(sheetName: 'Validated Results'): Fiddler<Result>;
                function getFiddler(sheetName: 'Invalid Results'): Fiddler<Result>;
                function getFiddler(sheetName: 'Bootstrap'): Fiddler<BootstrapData>;
                function getFiddler(sheetName: 'SystemLogs'): Fiddler<SystemLogEntry>;
                function getFiddler(sheetName: 'ActiveMembers'): Fiddler<Member>;
                function getFiddler(sheetName: 'ActionSpecs'): Fiddler<MembershipManagement.ActionSpec>;
                function getFiddler(sheetName: 'ExpirySchedule'): Fiddler<MembershipManagement.ExpirySchedule>;
                function getFiddler(sheetName: 'ExpirationFIFO'): Fiddler<ExpiredMember>;
                function getFiddler(sheetName: 'Audit'): Fiddler<AuditLogEntry>;
                
                // Generic fallback
                function getFiddler(sheetName: string): Fiddler<any>;
                
                /**
                 * Get sheet directly via SpreadsheetApp (for native API access)
                 */
                function getSheet(sheetName: string): GoogleAppsScript.Spreadsheet.Sheet;
                
                function getDataWithFormulas<T>(fiddler: Fiddler<T>): T[];
                function convertLinks(sheetName: string): void;
                function clearFiddlerCache(sheetName: string): void;
            }
        }
        
        namespace Access {
            /**
             * Gets Bootstrap configuration data
             * @returns Array of Bootstrap configuration entries
             */
            function getBootstrapData(): BootstrapData[];
            
            /**
             * Gets all email addresses from active members
             * @returns Array of lowercase email addresses
             */
            function getEmailAddresses(): string[];
            
            /**
             * Gets all members
             * @returns Array of member objects
             */
            function getMembers(): Member[];
            
            /**
             * Gets action specifications with processed body content
             * @returns Object with action specs keyed by Type
             */
            function getActionSpecs(): Record<string, MembershipManagement.ActionSpec>;
            
            /**
             * Gets public groups configuration
             * @returns Array of public group objects
             */
            function getPublicGroups(): Array<{Name: string, Email: string}>;
            
            /**
             * Gets a specific member by email address
             * @param email - Member's email address (case insensitive)
             * @returns Member object or undefined if not found
             */
            function getMember(email: string): Member | undefined;
            
            /**
             * Updates a member's information
             * @param email - Current email address (case insensitive)
             * @param newMember - Updated member object
             * @returns True if update was successful
             */
            function updateMember(email: string, newMember: Member): boolean;
            
            /**
             * Checks if an email address belongs to a member
             * @param email - Email address to check (case insensitive)
             * @returns True if email belongs to a member
             */
            function isMember(email: string): boolean;
            
            /**
             * Gets all elections data
             * @returns Array of election objects
             */
            function getElections(): VotingService.Election[];
        }
    }
    
    // Logger instance (backward compat - points to AppLogger)
    const Logger: typeof AppLogger;
    
    // Configuration namespace
    namespace Config {
        // Feature Flags
        interface FeatureFlagConfig {
            name: string;
            defaultValue: boolean;
            description?: string;
        }
        
        namespace FeatureFlags {
            function isEnabled(flagName: string, defaultValue?: boolean): boolean;
            function setFlag(flagName: string, value: boolean): { success: boolean; error?: string };
            function deleteFlag(flagName: string): { success: boolean; error?: string };
            function getAllFlags(): Record<string, boolean>;
            function getSummary(): { enabled: string[]; disabled: string[]; total: number };
            function enableNewAuth(): { success: boolean; error?: string };
            function emergencyRollback(): { success: boolean; error?: string };
            function isNewAuthEnabled(): boolean;
            function isSPAModeEnabled(): boolean;
            function getKnownFlags(): Record<string, FeatureFlagConfig>;
        }
        
        // FeatureFlagsManager - Pure logic class
        class FeatureFlagsManager {
            static validateFlagName(flagName: string): { valid: boolean; error?: string };
            static parseBoolean(value: string | boolean | null | undefined, defaultValue: boolean): boolean;
            static formatForStorage(value: boolean): string;
            static shouldEnableFeature(flagValue: boolean, isProduction: boolean, forceEnabled?: boolean): boolean;
            static summarizeFlags(flags: Record<string, boolean>): { enabled: string[]; disabled: string[]; total: number };
        }
    }
    
    // Auth namespace
    namespace Auth {
        // Verification Code types
        interface VerificationCodeEntry {
            email: string;
            code: string;
            createdAt: string;
            expiresAt: string;
            attempts: number;
            used: boolean;
            service?: string;
        }
        
            /** Known verification error codes returned by verification APIs */
            type VerificationErrorCode =
                | 'NO_CODE'
                | 'EXPIRED'
                | 'AUTO_RESENT'
                | 'INVALID_FORMAT'
                | 'ALREADY_USED'
                | 'INCORRECT_CODE'
                | 'MAX_ATTEMPTS'
                | 'RATE_LIMITED'
                | 'EMAIL_FAILED';

            interface VerificationResult {
            /**
             * Result of a verification attempt.
             *
             * Note: `errorCode` may include the following values used by the system:
             *  - `NO_CODE` - No code entry was found for the email
             *  - `EXPIRED` - The existing code had expired
             *  - `AUTO_RESENT` - The server auto-generated and resent a new code; the `email` field contains the server-normalized canonical email
             *  - `INVALID_FORMAT`, `ALREADY_USED`, `INCORRECT_CODE`, `MAX_ATTEMPTS`, etc.
             */
            success: boolean;
            /** Canonical server-normalized email (present when AUTO_RESENT or on success) */
            email?: string;
            /** Human-friendly error message */
            error?: string;
            /** Machine-readable error code */
            errorCode?: VerificationErrorCode | string;
        }
        
        interface CodeGenerationResult {
            success: boolean;
            code?: string;
            error?: string;
            /** Machine-readable error code for generation failures */
            errorCode?: VerificationErrorCode | string;
        }
        
        interface RateLimitResult {
            allowed: boolean;
            remaining: number;
            retryAfter?: number;
        }
        
        // VerificationCode GAS layer
        namespace VerificationCode {
            function generateAndStore(email: string, service?: string): CodeGenerationResult;
            function verify(email: string, code: string): VerificationResult;
            function sendCodeEmail(email: string, code: string, serviceName: string): { success: boolean; error?: string };
            function requestCode(email: string, serviceName: string, service?: string): { success: boolean; error?: string };
            function clearCodes(email: string): void;
        }
        
        // VerificationCodeManager - Pure logic class
        class VerificationCodeManager {
            static generateCode(randomFn?: () => number): string;
            static validateCodeFormat(code: string): { valid: boolean; error?: string };
            static validateEmail(email: string): { valid: boolean; error?: string };
            static calculateExpiry(createdAt: Date, expiryMinutes?: number): Date;
            static isExpired(expiresAt: string, now?: Date): boolean;
            static isMaxAttemptsExceeded(attempts: number, maxAttempts?: number): boolean;
            static createEntry(email: string, code: string, now?: Date, service?: string): VerificationCodeEntry;
            static verifyCode(inputCode: string, entry: VerificationCodeEntry | null, now?: Date): VerificationResult;
            static checkGenerationRateLimit(existingEntries: VerificationCodeEntry[], now?: Date): RateLimitResult;
            static filterActiveEntries(entries: VerificationCodeEntry[], now?: Date): VerificationCodeEntry[];
            static getConfig(): { CODE_LENGTH: number; CODE_EXPIRY_MINUTES: number; MAX_VERIFICATION_ATTEMPTS: number; MAX_CODES_PER_EMAIL_PER_HOUR: number; RATE_LIMIT_WINDOW_MINUTES: number };
        }
    }
    
    // API namespace
    namespace Api {
        // API response types
        interface ApiResponse {
            success: boolean;
            data?: any;
            error?: string;
            errorCode?: string;
            meta?: {
                requestId: string;
                duration: number;
                action: string;
            };
        }
        
        interface ApiRequest {
            action: string;
            params?: Record<string, any>;
            token?: string;
        }
        
        interface ActionHandler {
            handler: (params: Record<string, any>, token: string) => ApiResponse;
            requiresAuth?: boolean;
            description?: string;
        }
        
        // ApiClient GAS layer
        namespace Client {
            function registerHandler(action: string, handler: ActionHandler['handler'], options?: { requiresAuth?: boolean; description?: string }): void;
            function handleRequest(request: ApiRequest): string;
            function listActions(): string;
            function getHandler(action: string): ActionHandler | undefined;
            function clearHandlers(): void;
        }
        
        // ClientManager - Pure logic class
        class ClientManager {
            static successResponse(data: any, meta?: object): ApiResponse;
            static errorResponse(error: string, errorCode?: string, meta?: object): ApiResponse;
            static validateRequest(request: any): { valid: boolean; error?: string };
            static validateRequiredParams(params: Record<string, any>, required: string[]): { valid: boolean; missing?: string[] };
            static sanitizeString(value: any, maxLength?: number): string;
            static sanitizeParams(params: Record<string, any>, schema?: Record<string, number>): Record<string, any>;
            static createRequestContext(action: string, requestId?: string): { action: string; requestId: string; startTime: number };
            static generateRequestId(): string;
            static getRequestDuration(context: { startTime: number }): number;
            static createMetaFromContext(context: { action: string; requestId: string; startTime: number }): object;
            static actionRequiresAuth(action: string, handlers: Record<string, ActionHandler>): boolean;
            static listActions(handlers: Record<string, ActionHandler>, includePrivate?: boolean): Array<{ action: string; requiresAuth: boolean; description?: string }>;
            static formatErrorForLogging(error: Error | string, request?: ApiRequest): object;
        }
    }
    
    // HomePage namespace - Service home page after authentication
    namespace HomePage {
        // Service information type
        interface ServiceInfo {
            id: string;
            name: string;
            description: string;
            icon: string;
        }
        
        // Home page data type
        interface HomePageData {
            email: string;
            services: ServiceInfo[];
            welcomeMessage: string;
        }
        
        // Validation result type
        interface ValidationResult {
            valid: boolean;
            error?: string;
            errorCode?: string;
        }
        
        // Manager class - Pure business logic for home page
        // Service definitions are derived from WebServices (defined in 1namespaces.js)
        class Manager {
            static _getWebServices(webServicesOverride?: object): object;
            static _extractServiceInfo(serviceId: string, serviceObj: object): ServiceInfo | null;
            static getAvailableServices(webServicesOverride?: object): ServiceInfo[];
            static getServiceById(serviceId: string, webServicesOverride?: object): ServiceInfo | null;
            static validateServiceId(serviceId: string, webServicesOverride?: object): ValidationResult;
            static generateWelcomeMessage(email: string): string;
            static buildHomePageData(email: string, webServicesOverride?: object): HomePageData;
            static requiresAdditionalAuth(serviceId: string): boolean;
            static getServiceCount(webServicesOverride?: object): number;
        }
    }
}

// Group management types
interface GroupByType {
    email: string;
    type: string;
}

interface GroupSettings {
    email: string;
    type: string;
    [key: string]: any;
}

// Google Apps Script Advanced Services
declare namespace GroupsSettings {
    namespace Groups {
        function get(groupEmail: string): any;
        function update(group: any, groupEmail: string): any;
    }
}

// WebService type - defines service metadata structure
// Additional service-specific properties like WebApp, Data, etc. are typed as object
interface WebServiceDefinition {
    name: string;
    service: string;
    description: string;
    icon: string;
    WebApp?: object;
    Data?: object;
    Trigger?: object;
    Internal?: object;
    Menu?: object;
    [key: string]: string | object | undefined;
}

// WebServices global definition
declare const WebServices: {
    DirectoryService: WebServiceDefinition;
    EmailChangeService: WebServiceDefinition;
    GroupManagementService: WebServiceDefinition;
    ProfileManagementService: WebServiceDefinition;
    VotingService: WebServiceDefinition;
    [key: string]: WebServiceDefinition;
};

// bmPreFiddler namespace - consolidated from fiddler.d.ts
declare namespace bmPreFiddler {
    class PreFiddlerService {
        // Specific overloads
        getFiddler(options: FormResponsesOptions): Fiddler<FormResponse>;
        getFiddler(options: BootStrapOptions): Fiddler<BootstrapData>;
        getFiddler(options: ValidResultsOptions): Fiddler<Result>;
        getFiddler(options: InvalidResultsOptions): Fiddler<Result>;
        getFiddler(options: ActiveMembersOptions): Fiddler<Member>;
        
        // Generic fallback
        getFiddler(options: FiddlerOptions): Fiddler<any>;
    }

    function PreFiddler(): PreFiddlerService;
}

/**
 * GroupManagementService types
 */
declare namespace GroupManagementService {
    // Data types
    interface PublicGroup {
        Name: string;
        Email: string;
    }

    interface GroupMember {
        email: string;
        delivery_settings: string;
    }

    interface GroupSubscription {
        groupName: string;
        groupEmail: string;
        deliveryValue: string;
        deliveryName: string;
    }

    interface SubscriptionUpdate {
        groupEmail: string;
        deliveryValue: string;
    }

    interface DeliveryOption {
        value: string;
        name: string;
        description: string;
    }

    interface SubscriptionAction {
        action: 'subscribe' | 'update' | 'unsubscribe';
        groupEmail: string;
        userEmail: string;
        deliveryValue?: string;
    }

    interface ValidationResult {
        valid: boolean;
        error?: string;
        errorCode?: string;
    }

    // Manager class - Pure business logic
    class Manager {
        static getDeliveryOptions(): Record<string, [string, string]>;
        static validateEmail(email: string): ValidationResult;
        static validateDeliveryValue(deliveryValue: string, deliveryOptions?: Record<string, [string, string]>): ValidationResult;
        static validateSubscriptionUpdate(update: SubscriptionUpdate, deliveryOptions?: Record<string, [string, string]>): ValidationResult;
        static validateSubscriptionUpdates(updates: SubscriptionUpdate[], deliveryOptions?: Record<string, [string, string]>): ValidationResult;
        static buildSubscription(group: PublicGroup, member: GroupMember | null, deliveryOptions?: Record<string, [string, string]>): GroupSubscription;
        static buildUserSubscriptions(groups: PublicGroup[], membersByGroup: Record<string, GroupMember | null>, deliveryOptions?: Record<string, [string, string]>): GroupSubscription[];
        static determineAction(update: SubscriptionUpdate, currentMember: GroupMember | null, userEmail: string): SubscriptionAction | null;
        static calculateActions(updates: SubscriptionUpdate[], currentMembersByGroup: Record<string, GroupMember | null>, userEmail: string): { actions: SubscriptionAction[]; skipped: number };
        static getDeliveryOptionsArray(deliveryOptions?: Record<string, [string, string]>): DeliveryOption[];
        static formatUpdateResult(successCount: number, failedCount: number, errors?: string[]): { success: boolean; message: string; details: { successCount: number; failedCount: number; errors?: string[] } };
        static normalizeEmail(email: string): string;
    }

    // Api namespace - GAS layer
    namespace Api {
        function handleGetSubscriptions(params: { _authenticatedEmail?: string }): Common.Api.ApiResponse;
        function handleUpdateSubscriptions(params: { _authenticatedEmail?: string; updates?: SubscriptionUpdate[] }): Common.Api.ApiResponse;
        function handleGetDeliveryOptions(): Common.Api.ApiResponse;
    }

    // WebApp namespace - doGet handler
    namespace WebApp {
        function doGet(e: GoogleAppsScript.Events.DoGet, userEmail: string, template: any): GoogleAppsScript.HTML.HtmlOutput;
        function updateUserSubscriptions(updatedSubscriptions: SubscriptionUpdate[], userToken: string): { success: boolean; message?: string };
    }

    // Functions
    function getUserGroupSubscription(userEmail: string): GroupSubscription[];
    function updateUserSubscriptions(updatedSubscriptions: SubscriptionUpdate[], userEmail: string): { success: boolean; message: string };
    function initApi(): void;
}

/**
 * ProfileManagementService types
 */
declare namespace ProfileManagementService {
    // Validation result interface
    interface ValidationResult {
        valid: boolean;
        error?: string;
        errorCode?: string;
    }

    // Forbidden field check result
    interface ForbiddenFieldCheckResult {
        hasViolation: boolean;
        field?: string;
        violationType?: 'update' | 'add';
    }

    // Profile update result
    interface ProfileUpdateResult {
        success: boolean;
        message: string;
        mergedProfile?: Record<string, any>;
    }

    // Profile field schema
    interface ProfileField {
        name: string;
        required: boolean;
        pattern?: string;
        patternDescription?: string;
        maxLength?: number;
    }

    // Manager class - Pure business logic
    class Manager {
        static getForbiddenFields(): string[];
        static getProfileFieldSchema(): Record<string, ProfileField>;
        static validateEmail(email: string): ValidationResult;
        static validateName(name: string, fieldName?: string): ValidationResult;
        static validatePhone(phone: string): ValidationResult;
        static checkForForbiddenUpdates(originalProfile: Record<string, any>, updatedProfile: Record<string, any>, forbiddenFields?: string[]): ForbiddenFieldCheckResult;
        static validateProfileUpdate(updatedProfile: Record<string, any>): ValidationResult;
        static mergeProfiles(originalProfile: Record<string, any>, updates: Record<string, any>): Record<string, any>;
        static processProfileUpdate(originalProfile: Record<string, any>, updatedProfile: Record<string, any>, forbiddenFields?: string[]): ProfileUpdateResult;
        static formatProfileForDisplay(profile: Record<string, any>): Record<string, any> | null;
        static getEditableFields(profile: Record<string, any>): Record<string, any> | null;
        static normalizeEmail(email: string): string;
        static formatUpdateResult(success: boolean, message: string): { success: boolean; message: string };
    }

    // Api namespace - GAS layer
    namespace Api {
        function handleGetProfile(params: { _authenticatedEmail?: string }): Common.Api.ApiResponse;
        function handleGetEditableFields(params: { _authenticatedEmail?: string }): Common.Api.ApiResponse;
        function handleUpdateProfile(params: { _authenticatedEmail?: string; updates?: Record<string, any> }): Common.Api.ApiResponse;
    }

    // WebApp namespace - doGet handler
    namespace WebApp {
        function doGet(e: GoogleAppsScript.Events.DoGet, userEmail: string, template: any): GoogleAppsScript.HTML.HtmlOutput;
    }

    // Legacy function (for backward compatibility)
    function updateProfile(userToken: string, updatedProfile: Record<string, any>): { success: boolean; message: string };
    function _checkForForbiddenUpdates(originalObject: Record<string, any>, updatedObject: Record<string, any>, forbiddenFields: string[]): void;
    function initApi(): void;
}

/**
 * DirectoryService types
 */
declare namespace DirectoryService {
    // Data types
    interface DirectoryEntry {
        First: string;
        Last: string;
        email: string;
        phone: string;
    }

    interface FilterOptions {
        searchTerm?: string;
        activeOnly?: boolean;
    }

    interface ValidationResult {
        valid: boolean;
        error?: string;
        errorCode?: string;
    }

    interface DirectoryStats {
        total: number;
        active: number;
        public: number;
    }

    // Manager class - Pure business logic
    class Manager {
        static filterActiveMembers(members: Member[]): Member[];
        static filterPublicMembers(members: Member[]): Member[];
        static transformToDirectoryEntry(member: Member): DirectoryEntry | null;
        static transformToDirectoryEntries(members: Member[]): DirectoryEntry[];
        static getDirectoryEntries(members: Member[]): DirectoryEntry[];
        static filterBySearchTerm(entries: DirectoryEntry[], searchTerm: string): DirectoryEntry[];
        static sortByName(entries: DirectoryEntry[]): DirectoryEntry[];
        static processDirectory(members: Member[], options?: FilterOptions): DirectoryEntry[];
        static validateSearchTerm(searchTerm: string): ValidationResult;
        static getDirectoryStats(members: Member[]): DirectoryStats;
    }

    // Api namespace - GAS layer
    namespace Api {
        function handleGetEntries(params: { _authenticatedEmail?: string; searchTerm?: string }): Common.Api.ApiResponse;
        function handleGetStats(params: { _authenticatedEmail?: string }): Common.Api.ApiResponse;
    }

    // WebApp namespace - doGet handler
    namespace WebApp {
        function doGet(e: GoogleAppsScript.Events.DoGet, userEmail: string, template: any): GoogleAppsScript.HTML.HtmlOutput;
    }

    // Functions
    function getDirectoryEntries(): DirectoryEntry[];
    function initApi(): void;
}

/**
 * EmailChangeService types
 */
declare namespace EmailChangeService {
    // Data types
    interface ValidationResult {
        valid: boolean;
        error?: string;
        errorCode?: string;
    }

    interface GroupMembershipInfo {
        groupEmail: string;
        oldEmail: string;
        newEmail: string;
        status: 'Pending' | 'Success' | 'Failed';
        error?: string;
        // Optional fields used in intermediate results and tests
        groupName?: string;
        success?: boolean;
    }

    interface VerificationData {
        newEmail: string;
        code: string;
        expiry: number;
        type: 'emailUpdate';
        oldEmail: string;
    }

    interface EmailUpdateResult {
        success: boolean;
        message: string;
        results?: GroupMembershipInfo[];
        successCount?: number;
        failedCount?: number;
    }

    interface VerificationConfig {
        CODE_LENGTH: number;
        EXPIRY_MINUTES: number;
    }

    // Manager class - Pure business logic
    class Manager {
        static getVerificationConfig(): VerificationConfig;
        static validateEmail(email: string): ValidationResult;
        static validateEmailChange(oldEmail: string, newEmail: string): ValidationResult;
        static validateVerificationCode(code: string): ValidationResult;
        static generateVerificationCode(randomFn?: () => number): string;
        static createVerificationEntry(oldEmail: string, newEmail: string, code: string, now?: Date): VerificationData;
        static verifyCode(inputCode: string, oldEmail: string, newEmail: string, storedData: VerificationData | null, now?: Date): ValidationResult;
        static transformGroupsToMembershipInfo(groups: Array<{email: string}>, oldEmail: string, newEmail: string): GroupMembershipInfo[];
        static updateMembershipResult(membership: GroupMembershipInfo, success: boolean, error?: string): GroupMembershipInfo;
        static aggregateResults(results: GroupMembershipInfo[]): EmailUpdateResult;
        static createUpdatedMemberRecord(originalMember: Record<string, any>, newEmail: string): Record<string, any> | null;
        static createChangeLogEntry(oldEmail: string, newEmail: string, date?: Date): {date: Date, from: string, to: string};
        static normalizeEmail(email: any): string;
        static buildVerificationEmailContent(code: string): {subject: string, body: string, htmlBody: string};
        static formatSendCodeResult(success: boolean, email: string, error?: string): {success: boolean, message: string, error?: string, errorCode?: string};
        static calculateBackoff(attempt: number, initialBackoffMs?: number): number;
        static getRetryAction(params: {attempt: number, maxRetries: number, error?: Error}): {action: 'retry'|'fail'|'initial', backoffMs?: number, errorMessage?: string};
        static createGroupUpdateResult(group: any, success: boolean, error?: string): {groupEmail: string, groupName: string, success: boolean, error: string | null};
        static aggregateGroupResults(results: Array<{success: boolean, error?: string}>): {successCount: number, failedCount: number, overallSuccess: boolean};
        static formatEmailChangeMessage(overallSuccess: boolean, oldEmail: string, newEmail: string, successCount: number, failedCount: number): string;
    }

    // Api namespace - GAS layer
    namespace Api {
        function handleSendVerificationCode(params: { _authenticatedEmail?: string; newEmail?: string }): Common.Api.ApiResponse;
        function handleVerifyAndGetGroups(params: { _authenticatedEmail?: string; newEmail?: string; verificationCode?: string }): Common.Api.ApiResponse;
        function handleChangeEmail(params: { _authenticatedEmail?: string; newEmail?: string; groups?: GroupMembershipInfo[] }): Common.Api.ApiResponse;
        function storeVerificationData(code: string, data: VerificationData): void;
        function getVerificationData(code: string): VerificationData | null;
        function deleteVerificationData(code: string): void;
        function sendVerificationEmail(email: string, content: {subject: string, body: string, htmlBody: string}): boolean;
        function changeEmailInSpreadsheets(oldEmail: string, newEmail: string): void;
        function logEmailChange(oldEmail: string, newEmail: string): void;
    }

    // WebApp namespace - doGet handler
    namespace WebApp {
        function doGet(e: GoogleAppsScript.Events.DoGet, userEmail: string, template: any): GoogleAppsScript.HTML.HtmlOutput;
    }

    // Internal namespace - Legacy functions
    namespace Internal {
        function _generateVerificationCode(): string;
        function storeVerificationData(newEmail: string, verificationCode: string, type: string, oldEmail: string): void;
        function getVerificationData(verificationCode: string): VerificationData | null;
        function deleteVerificationData(verificationCode: string): void;
        function sendVerificationEmail(email: string, code: string): boolean;
        function updateUserEmailInGroup(groupEmail: string, originalEmail: string, newEmail: string): { groupEmail: string; status: string; error: string | null };
        function changeEmailInSpreadsheets(oldEmail: string, newEmail: string, sheetRefs: string[]): void;
    }

    // Legacy functions (for backward compatibility)
    function handleSendVerificationCode(originalEmail: string, newEmail: string): string;
    function handleVerifyAndGetGroups(originalEmail: string, newEmail: string, verificationCode: string): GroupMembershipInfo[];
    function handleChangeEmailInGroupsUI(oldEmail: string, newEmail: string, groupData: GroupMembershipInfo[]): Array<{ groupEmail: string; status: string; error: string | null }>;
    function initApi(): void;
}

/**
 * VotingService types (extended for SPA migration)
 */
declare namespace VotingService {
    // Data types for API
    interface ProcessedElection {
        title: string;
        opens?: string;  // Formatted date string
        closes?: string;  // Formatted date string
        status: string;
        url?: string;
    }

    interface ValidationResult {
        valid: boolean;
        error?: string;
        errorCode?: string;
    }

    interface TokenValidationResult {
        valid: boolean;
        email?: string;
        error?: string;
        errorCode?: string;
    }

    interface VoteValidationResult {
        valid: boolean;
        email?: string;
        error?: string;
        errorCode?: string;
        duplicate?: boolean;
        tokenInvalid?: boolean;
    }

    interface ElectionStats {
        total: number;
        active: number;
        unopened: number;
        closed: number;
    }

    // Manager class - Pure business logic
    class Manager {
        static getElectionStates(): { UNOPENED: string; ACTIVE: string; CLOSED: string };
        static calculateElectionState(startDate: Date | string | null | undefined, endDate: Date | string | null | undefined, now?: Date): string;
        static validateEmail(email: string): ValidationResult;
        static normalizeEmail(email: string): string;
        static hasUserVoted(userEmail: string, voters: Array<{ Email: string }>): boolean;
        static validateElection(election: object): ValidationResult;
        static validateToken(token: string): ValidationResult;
        static validateTokenData(tokenData: object | null): TokenValidationResult;
        static isDuplicateVote(email: string, currentToken: string, allTokens: Array<{ Email: string; Token: string }>): boolean;
        static validateVote(tokenData: object | null, currentToken: string, allTokens: Array<{ Email: string; Token: string }>): VoteValidationResult;
        static buildElectionStatusMessage(state: string, hasVoted: boolean, ballotAccepting?: boolean): string;
        static processElectionForDisplay(election: object, userEmail: string, voters: Array<{ Email: string }>, ballotPublished?: boolean, ballotAccepting?: boolean, now?: Date): ProcessedElection;
        static extractFirstValues(namedValues: Record<string, any[] | any>): Record<string, any>;
        static extractElectionTitle(spreadsheetName: string, resultsSuffix?: string): string;
        static buildValidVoteEmailContent(electionTitle: string): { subject: string; body: string };
        static buildInvalidVoteEmailContent(electionTitle: string): { subject: string; body: string };
        static buildManualCountEmailContent(electionTitle: string, vote: object, tokenFieldName?: string): { subject: string; body: string };
        static buildElectionOpeningEmailContent(ballotTitle: string, editUrl: string): { subject: string; body: string };
        static buildElectionClosureEmailContent(ballotTitle: string, editUrl: string, manualCountRequired?: boolean): { subject: string; body: string };
        static buildElectionOfficerAddedEmailContent(title: string, editUrl: string, isSharedDrive?: boolean): { subject: string; body: string };
        static buildElectionOfficerRemovedEmailContent(title: string, isSharedDrive?: boolean): { subject: string; body: string };
        static calculateElectionStats(elections: Array<object>, now?: Date): ElectionStats;
        static formatActiveElectionsResponse(elections: ProcessedElection[], userEmail: string): { elections: ProcessedElection[]; userEmail: string; count: number };
        static calculateOfficerChanges(newOfficers: string[], currentOfficers: string[]): { toAdd: string[]; toRemove: string[] };
        static parseElectionOfficers(officersString: string): string[];
    }

    // Api namespace - GAS layer
    namespace Api {
        function handleGetActiveElections(params: { _authenticatedEmail?: string }): Common.Api.ApiResponse;
        function handleGetElectionStats(params: { _authenticatedEmail?: string }): Common.Api.ApiResponse;
        function handleGenerateBallotToken(params: { _authenticatedEmail?: string; electionTitle?: string }): Common.Api.ApiResponse;
    }

    // Initialize API handlers
    function initApi(): void;
}
