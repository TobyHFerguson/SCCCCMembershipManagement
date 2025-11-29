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



// Common Data Storage namespace - only for truly shared data access
declare namespace Common {
    namespace Data {
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
                function getFiddler(sheetName: 'Audit'): Fiddler<Audit.LogEntry>;
                
                // Generic fallback
                function getFiddler(sheetName: string): Fiddler<any>;
                
                function getDataWithFormulas<T>(fiddler: Fiddler<T>): T[];
                function convertLinks(sheetName: string): void;
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
            function getPublicGroups(): any[];
            
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
    
    // Production logging utility
    interface Logger {
        info(service: string, message: string): void;
        warn(service: string, message: string): void;
        error(service: string, message: string, error?: any): void;
        debug(service: string, message: string): void;
        setLevel(level: string): void;
        configure(config: any): void;
        getLogs(): any[][];
        clearLogs(): void;
        setContainerSpreadsheet(spreadsheetId: string): void;
    }
    
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
        
        interface VerificationResult {
            success: boolean;
            email?: string;
            error?: string;
            errorCode?: string;
        }
        
        interface CodeGenerationResult {
            success: boolean;
            code?: string;
            error?: string;
            errorCode?: string;
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

// WebServices global definition
declare const WebServices: {
    DirectoryService: any;
    EmailChangeService: any;
    GroupManagementService: any;
    ProfileManagementService: any;
    VotingService: any;
    [key: string]: { name?: string; [key: string]: any };
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


