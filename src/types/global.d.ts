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

/**
 * FeatureFlags - Feature flag management for Google Apps Script
 * Pattern: IIFE-wrapped class with static methods (per gas-best-practices.md)
 */
declare class FeatureFlags {
    static isEnabled(flagName: string, defaultValue?: boolean): boolean;
    static setFlag(flagName: string, value: boolean): { success: boolean; error?: string };
    static deleteFlag(flagName: string): { success: boolean; error?: string };
    static getAllFlags(): Record<string, boolean>;
    static getSummary(): { enabled: string[]; disabled: string[]; total: number };
    static enableNewAuth(): { success: boolean; error?: string };
    static emergencyRollback(): { success: boolean; error?: string };
    static isNewAuthEnabled(): boolean;
    static isSPAModeEnabled(): boolean;
    static getKnownFlags(): Record<string, FeatureFlagConfig>;
}

/**
 * FeatureFlagsManager - Pure logic helper class for feature flag operations
 * Pattern: IIFE-wrapped class with static methods (per gas-best-practices.md)
 */
declare class FeatureFlagsManager {
    static validateFlagName(flagName: string): { valid: boolean; error?: string };
    static parseBoolean(value: string | boolean | null | undefined, defaultValue: boolean): boolean;
    static formatForStorage(value: boolean): string;
    static shouldEnableFeature(flagValue: boolean, isProduction: boolean, forceEnabled?: boolean): boolean;
    static summarizeFlags(flags: Record<string, boolean>): { enabled: string[]; disabled: string[]; total: number };
}

/**
 * Feature flag configuration interface
 */
interface FeatureFlagConfig {
    name: string;
    defaultValue: boolean;
    description?: string;
}

// ============================================================================
// Auth Classes (Flat Pattern - no namespace nesting)
// ============================================================================

/**
 * TokenManager - Multi-use token management for authenticated sessions
 * Pattern: IIFE-wrapped class with static methods (per gas-best-practices.md)
 */
declare class TokenManager {
    static generateToken(): string;
    static getMultiUseToken(email: string): string;
    static getEmailFromMUT(token: string): string | null;
    static consumeMUT(token: string): string | null;
    static updateTokenEmail(token: string, newEmail: string): boolean;
    static getTokenData(token: string): TokenDataType | null;
}

/**
 * TokenStorage - One-time token persistence via SpreadsheetManager
 * Pattern: IIFE-wrapped class with static methods (per gas-best-practices.md)
 */
declare class TokenStorage {
    static generateAndStoreToken(email: string): string;
    static getTokenData(): TokenDataType[];
    static consumeToken(token: string): TokenDataType | undefined;
    static deleteTokens(tokensToDelete: string[]): void;
}

/**
 * VerificationCodeEntry - Stored verification code data
 */
interface VerificationCodeEntry {
    email: string;
    code: string;
    createdAt: string;
    expiresAt: string;
    attempts: number;
    used: boolean;
    service?: string;
}

/**
 * VerificationResult - Result of verification attempt
 */
interface VerificationResult {
    success: boolean;
    email?: string;
    error?: string;
    errorCode?: string;
}

/**
 * CodeGenerationResult - Result of code generation
 */
interface CodeGenerationResult {
    success: boolean;
    code?: string;
    error?: string;
    errorCode?: string;
}

/**
 * RateLimitResult - Rate limiting check result
 */
interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    retryAfter?: number;
}

/**
 * VerificationCodeManager - Pure logic for verification code operations
 * Pattern: IIFE-wrapped class with static methods (per gas-best-practices.md)
 */
declare class VerificationCodeManager {
    static generateCode(randomFn?: () => number): string;
    static validateCodeFormat(code: string): { valid: boolean; error?: string };
    static validateEmail(email: string): { valid: boolean; error?: string };
    static calculateExpiry(createdAt: Date, expiryMinutes?: number): Date;
    static isExpired(expiresAt: string, now?: Date): boolean;
    static isMaxAttemptsExceeded(attempts: number, maxAttempts?: number): boolean;
    static createEntry(email: string, code: string, now?: Date, service?: string): VerificationCodeEntry;
    static verifyCode(inputCode: string, entry: VerificationCodeEntry, now?: Date): VerificationResult;
    static checkGenerationRateLimit(existingEntries: VerificationCodeEntry[], now?: Date): RateLimitResult;
    static filterActiveEntries(entries: VerificationCodeEntry[], now?: Date): VerificationCodeEntry[];
    static getConfig(): typeof VERIFICATION_CONFIG;
}

/**
 * VerificationCode - GAS layer for verification code storage
 * Pattern: IIFE-wrapped class with static methods (per gas-best-practices.md)
 */
declare class VerificationCode {
    static readonly _CACHE_PREFIX: string;
    static readonly _RATE_LIMIT_PREFIX: string;
    static getVerificationConfig(): typeof VERIFICATION_CONFIG;
    static generateAndStore(email: string, service?: string): CodeGenerationResult;
    static verify(email: string, code: string): VerificationResult;
    static sendCodeEmail(email: string, code: string, serviceName: string): { success: boolean; error?: string };
    static requestCode(email: string, serviceName: string, service?: string): { success: boolean; error?: string };
    static clearCodes(email: string): void;
    static clearRateLimitForEmail(email: string): boolean;
    static clearAllVerificationData(): { cleared: number; errors: number };
}

/**
 * Verification configuration type
 */
declare const VERIFICATION_CONFIG: {
    CODE_LENGTH: number;
    CODE_EXPIRY_MINUTES: number;
    MAX_VERIFICATION_ATTEMPTS: number;
    MAX_CODES_PER_EMAIL_PER_HOUR: number;
    RATE_LIMIT_WINDOW_MINUTES: number;
};

// ============================================================================
// API Client Classes (Flat Pattern - no namespace nesting)
// ============================================================================

/**
 * ApiClientManager - Pure logic for API request/response handling
 * Pattern: IIFE-wrapped class with static methods (per gas-best-practices.md)
 */
declare class ApiClientManager {
    static successResponse(data: any, meta?: any): ApiResponse;
    static errorResponse(error: string, errorCode?: string, meta?: any): ApiResponse;
    static validateRequest(request: any): { valid: boolean; error?: string };
    static validateRequiredParams(params: Record<string, any>, required: string[]): { valid: boolean; missing?: string[] };
    static sanitizeString(value: any, maxLength?: number): string;
    static createRequestId(): string;
    static createRequestContext(action: string | undefined, requestId: string | undefined): { action: string; requestId: string; startTime: number };
    static getRequestDuration(context: { startTime: number }): number;
    static createMetaFromContext(context: { action: string; requestId: string; startTime: number }): Record<string, any>;
    static actionRequiresAuth(action: string, handlers: Record<string, ActionHandler>): boolean;
    static listActions(handlers: Record<string, ActionHandler>, includePrivate?: boolean): Array<{ action: string; requiresAuth: boolean; description?: string }>;
    static formatErrorForLogging(error: Error | string, request?: any): Record<string, any>;
}

/**
 * ApiClient - GAS layer for handling API requests
 * Pattern: IIFE-wrapped class with static methods (per gas-best-practices.md)
 */
declare class ApiClient {
    static registerHandler(action: string, handler: (params: Record<string, any>, token?: string) => ApiResponse, options?: { requiresAuth?: boolean; description?: string }): void;
    static handleRequest(request: ApiRequest): string;
    static listActions(): string;
    static getHandler(action: string): ActionHandler | undefined;
}

// API types
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
    handler: (params: Record<string, any>, token?: string) => ApiResponse;
    requiresAuth: boolean;
    description?: string;
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
 * SpreadsheetManager class - Low-level spreadsheet access
 */
declare class SpreadsheetManager {
    /**
     * Converts links in a sheet to hyperlinks.
     */
    static convertLinks(sheetName: string): void;

    /**
     * Get a sheet directly by name from Bootstrap
     */
    static getSheet(sheetName: string): GoogleAppsScript.Spreadsheet.Sheet;

    /**
     * Get a sheet by spreadsheet ID and sheet name (for dynamic/external spreadsheets not in Bootstrap)
     * @param spreadsheetId - The spreadsheet ID to open
     * @param sheetName - The name of the sheet tab within the spreadsheet
     * @param createIfMissing - Whether to create the sheet if it doesn't exist (default: false)
     */
    static getSheetById(spreadsheetId: string, sheetName: string, createIfMissing?: boolean): GoogleAppsScript.Spreadsheet.Sheet;
}

/**
 * SheetAccess - Abstraction over spreadsheet operations
 * Provides consistent interface using native SpreadsheetApp API
 */
declare class SheetAccess {
    /**
     * Get data from a sheet as array of row objects
     */
    static getData(sheetName: string): any[];
    
    /**
     * Get data as 2D array (headers + rows)
     */
    static getDataAsArrays(sheetName: string): any[][];
    
    /**
     * Get data from sheet with RichText preserved for link columns
     * Returns objects where link columns have {text, url} structure
     */
    static getDataWithRichText(sheetName: string, richTextColumns?: string[]): any[];
    
    /**
     * Write data to a sheet (replaces all data)
     */
    static setData(sheetName: string, data: any[]): void;
    
    /**
     * Append rows to end of sheet
     */
    static appendRows(sheetName: string, rows: any[][]): void;
    
    /**
     * Update specific rows in a sheet
     */
    static updateRows(sheetName: string, rows: any[][], startRow: number): void;
    
    /**
     * Get raw Sheet object for advanced operations
     * Note: Prefer using higher-level methods when possible
     */
    static getSheet(sheetName: string): GoogleAppsScript.Spreadsheet.Sheet;

    // ========================================================================
    // *ById Methods - For dynamic/external spreadsheets not in Bootstrap
    // ========================================================================

    /**
     * Get a sheet by spreadsheet ID and sheet name (for dynamic spreadsheets not in Bootstrap)
     * @param spreadsheetId - The spreadsheet ID to open
     * @param sheetName - The name of the sheet tab within the spreadsheet
     * @param createIfMissing - Whether to create the sheet if it doesn't exist (default: false)
     */
    static getSheetById(spreadsheetId: string, sheetName: string, createIfMissing?: boolean): GoogleAppsScript.Spreadsheet.Sheet;

    /**
     * Get data as 2D array from a spreadsheet by ID (for dynamic spreadsheets not in Bootstrap)
     * @param spreadsheetId - The spreadsheet ID to open
     * @param sheetName - The name of the sheet tab within the spreadsheet
     */
    static getDataAsArraysById(spreadsheetId: string, sheetName: string): any[][];

    /**
     * Get data from a spreadsheet by ID as array of row objects (for dynamic spreadsheets not in Bootstrap)
     * @param spreadsheetId - The spreadsheet ID to open
     * @param sheetName - The name of the sheet tab within the spreadsheet
     */
    static getDataById(spreadsheetId: string, sheetName: string): any[];

    /**
     * Write data to a sheet by spreadsheet ID (for dynamic spreadsheets not in Bootstrap)
     * @param spreadsheetId - The spreadsheet ID to open
     * @param sheetName - The name of the sheet tab within the spreadsheet
     * @param data - Array of row objects
     * @param createIfMissing - Whether to create the sheet if it doesn't exist (default: false)
     */
    static setDataById(spreadsheetId: string, sheetName: string, data: any[], createIfMissing?: boolean): void;

    /**
     * Open a spreadsheet by ID and return it (for operations needing the full spreadsheet object)
     * Use sparingly - prefer specific *ById methods
     * @param spreadsheetId - The spreadsheet ID to open
     */
    static getSpreadsheetById(spreadsheetId: string): GoogleAppsScript.Spreadsheet.Spreadsheet;
}

/**
 * Plain object shape of ValidatedMember data (without class methods)
 * Use this for functions that return/accept member data as plain objects
 * rather than ValidatedMember class instances
 */
interface ValidatedMemberData {
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
}

/**
 * Transaction data from payment processor (e.g., JotForm, Square)
 * Used for processing new memberships and renewals
 */
interface TransactionData {
    'Email Address': string;
    'First Name': string;
    'Last Name': string;
    Phone?: string;
    Payment?: string;  // e.g., "1 year", "2 years"
    Directory?: string;  // e.g., "Share Name, Share Email, Share Phone"
    'Payable Status'?: string;  // e.g., "Paid", "Pending"
    Processed?: Date | string | null;  // Date when transaction was processed
    Timestamp?: Date | string | null;  // Transaction timestamp
}

// Flat ValidatedMember class (new pattern - replaces Common.Data.ValidatedMember)
declare class ValidatedMember {
    Email: string;
    Status: string;
    First: string;
    Last: string;
    Phone: string;
    Joined: Date;
    Expires: Date;
    Period: number | null;
    Migrated: Date | null;
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
        migrated: Date | null,
        dirName: boolean,
        dirEmail: boolean,
        dirPhone: boolean,
        renewedOn: Date | null | string
    );
    
    /** Convert to array for sheet persistence */
    toArray(): Array<string | Date | number | boolean | null>;
    
    /** Static factory - never throws, returns null on failure */
    static fromRow(
        rowArray: Array<any>,
        headers: string[],
        rowNumber: number,
        errorCollector: { errors: string[], rowNumbers: number[] } | null
    ): ValidatedMember | null;
    
    /** Batch validation with consolidated email alert */
    static validateRows(
        rows: Array<Array<any>>,
        headers: string[],
        context: string
    ): ValidatedMember[];
    
    /** Column headers constant */
    static HEADERS: string[];
}

// Flat ValidatedTransaction class (new pattern for transaction validation)
declare class ValidatedTransaction {
    'Email Address': string;
    'First Name': string;
    'Last Name': string;
    Phone: string;
    Payment: string;
    Directory: string;
    'Payable Status': string;
    Processed: Date | null;
    Timestamp: Date | null;
    
    /** 1-based sheet row index, set by fromRow() for write-back targeting */
    _sheetRowIndex?: number;
    /** Header-keyed snapshot of original cell values, set by fromRow() for change detection */
    _originalValues?: Record<string, any>;
    
    constructor(
        emailAddress: string,
        firstName: string,
        lastName: string,
        phone: string,
        payment: string,
        directory: string,
        payableStatus: string,
        processed: Date | string | null,
        timestamp: Date | string | null
    );
    
    /** Convert to array for sheet persistence */
    toArray(): Array<string | Date | null>;
    
    /** Static factory - never throws, returns null on failure */
    static fromRow(
        rowArray: Array<any>,
        headers: string[],
        rowNumber: number,
        errorCollector: { errors: string[], rowNumbers: number[] } | null
    ): ValidatedTransaction | null;
    
    /** Batch validation with consolidated email alert */
    static validateRows(
        rows: Array<Array<any>>,
        headers: string[],
        context: string
    ): ValidatedTransaction[];
    
    /**
     * Write back only changed cells using header-based column lookup.
     * Avoids row-shift bugs and column-order assumptions.
     */
    static writeChangedCells(
        sheet: GoogleAppsScript.Spreadsheet.Sheet,
        transactions: ValidatedTransaction[],
        sheetHeaders: string[]
    ): number;
    
    /** Column headers constant */
    static HEADERS: string[];
}

// Flat MemberPersistence class (new pattern - replaces Common.Data.MemberPersistence)
declare class MemberPersistence {
    /** Write only changed cells to minimize version history noise */
    static writeChangedCells(
        sheet: GoogleAppsScript.Spreadsheet.Sheet,
        originalRows: Array<Array<any>>,
        modifiedMembers: ValidatedMember[],
        headers: string[]
    ): number;
    
    /** Value equality that handles Dates and primitives */
    static valuesEqual(a: any, b: any): boolean;
}

// Flat DataAccess object (new pattern - replaces Common.Data.Access)
declare var DataAccess: {
    /** Gets Bootstrap configuration data */
    getBootstrapData: () => BootstrapData[];
    
    /** Gets all email addresses from active members */
    getEmailAddresses: () => string[];
    
    /** Gets all members */
    getMembers: () => ValidatedMember[];
    
    /** Gets action specifications with processed body content */
    getActionSpecs: () => {[k: string]: MembershipManagement.ActionSpec};
    
    /** Gets public groups configuration */
    getPublicGroups: () => Array<{Name: string, Email: string, Subscription: string}>;
    
    /** Gets a specific member by email address */
    getMember: (email: string) => ValidatedMember | undefined;
    
    /** Updates a member's information (accepts class instance or plain object) */
    updateMember: (email: string, newMember: ValidatedMember | ValidatedMemberData) => boolean;
    
    /** Checks if an email address belongs to a member */
    isMember: (email: string) => boolean;
    
    /** Gets all elections data */
    getElections: () => VotingService.Election[];
    
    /** Gets system logs */
    getSystemLogs: () => SystemLogEntry[];

    /** Gets all transactions as validated objects (read-only) */
    getTransactions: () => ValidatedTransaction[];

    /**
     * Gets transactions with write-context for selective cell writes.
     * Returns validated transactions plus the sheet and headers needed
     * for ValidatedTransaction.writeChangedCells().
     */
    getTransactionsForUpdate: () => {
        transactions: ValidatedTransaction[];
        headers: string[];
        sheet: GoogleAppsScript.Spreadsheet.Sheet;
    };
};

// Flat ServiceLogger class (new pattern - replaces Common.Logging.ServiceLogger)
declare class ServiceLogger {
    serviceName: string;
    userEmail: string;
    timestamp: Date;
    auditLogger: AuditLogger;
    
    constructor(serviceName: string, userEmail: string, timestamp?: Date);
    
    /** Log service access (getData call) */
    logServiceAccess(operation: string): AuditLogEntry;
    
    /** Log service operation (update, delete, etc.) */
    logOperation(
        operationType: string,
        outcome: 'success' | 'fail',
        note: string,
        error?: string,
        jsonData?: any
    ): AuditLogEntry;
    
    /** Log service error (unexpected failures during execution) */
    logError(operation: string, error: Error | string, additionalData?: any): AuditLogEntry;
    
    /** Create a custom audit entry without system logging */
    createAuditEntry(
        type: string,
        outcome: 'success' | 'fail',
        note: string,
        error?: string,
        jsonData?: any
    ): AuditLogEntry;
}

// Flat ServiceExecutionLogger object (new pattern - replaces Common.Logging.ServiceExecutionLogger)
declare const ServiceExecutionLogger: {
    /** Wrap a getData function with logging */
    wrapGetData(serviceName: string, email: string, getDataFn: () => any): any;
    
    /** Wrap an API handler function with logging */
    wrapApiHandler(
        serviceName: string,
        operationName: string,
        email: string,
        handlerFn: () => any,
        params?: any
    ): any;
    
    /** Persist audit entries to the Audit sheet (private) */
    _persistAuditEntries(auditEntries: AuditLogEntry[]): void;
};

// Group management types
interface GroupByType {
    email: string;
    type: string;
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
        function handleGetSubscriptions(params: { _authenticatedEmail?: string }): ApiResponse;
        function handleUpdateSubscriptions(params: { _authenticatedEmail?: string; updates?: SubscriptionUpdate[] }): ApiResponse;
        function handleGetDeliveryOptions(): ApiResponse;
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
        mergedProfile?: ValidatedMemberData;
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
        function handleGetProfile(params: { _authenticatedEmail?: string }): ApiResponse;
        function handleGetEditableFields(params: { _authenticatedEmail?: string }): ApiResponse;
        function handleUpdateProfile(params: { _authenticatedEmail?: string; updates?: Record<string, any> }): ApiResponse;
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
        function handleGetEntries(params: { _authenticatedEmail?: string; searchTerm?: string }): ApiResponse;
        function handleGetStats(params: { _authenticatedEmail?: string }): ApiResponse;
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
        function handleSendVerificationCode(params: { _authenticatedEmail?: string; newEmail?: string }): ApiResponse;
        function handleVerifyAndGetGroups(params: { _authenticatedEmail?: string; newEmail?: string; verificationCode?: string }): ApiResponse;
        function handleChangeEmail(params: { _authenticatedEmail?: string; newEmail?: string; groups?: GroupMembershipInfo[] }): ApiResponse;
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
        function handleGetActiveElections(params: { _authenticatedEmail?: string }): ApiResponse;
        function handleGetElectionStats(params: { _authenticatedEmail?: string }): ApiResponse;
        function handleGenerateBallotToken(params: { _authenticatedEmail?: string; electionTitle?: string }): ApiResponse;
    }

    // Initialize API handlers
    function initApi(): void;
}

// ============================================================================
// Global Variables - Additional runtime globals not covered above
// ============================================================================

// Properties Management (not a class, just a namespace object)
declare const Properties: any; // TODO: Add proper Properties type
