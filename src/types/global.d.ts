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
 * Common - Legacy namespace object for backward compatibility
 * Tests can assign properties to this object (e.g., Common.Logger, Common.Data)
 */
declare var Common: {
    Logger?: any;
    Data?: any;
    Api?: any;
    Auth?: any;
    Config?: any;
    [key: string]: any;
};

/**
 * AppLogger - Production-friendly logging utility for Google Apps Script
 * Named AppLogger (not Logger) to avoid conflict with GAS built-in Logger.
 * Pattern: IIFE-wrapped class with static methods (per gas-best-practices.md)
 * Declared as `var` (not `class`) so tests can assign to `global.AppLogger`
 * without 'Property does not exist on typeof globalThis' errors.
 * Methods that tests don't always mock are optional (?) to allow partial mocks.
 */
declare var AppLogger: {
    debug(service: string, message: string, data?: any): void;
    info(service: string, message: string, data?: any): void;
    warn(service: string, message: string, data?: any): void;
    error(service: string, message: string, data?: any): void;
    configure?(): void;
    setLevel?(level: string): void;
    getLogs?(): Array<[Date | string, string, string, string, string]>;
    clearLogs?(): void;
    setContainerSpreadsheet?(spreadsheetId: string): void;
};

/**
 * FeatureFlags - Feature flag management for Google Apps Script
 * Pattern: IIFE-wrapped class with static methods (per gas-best-practices.md)
 * Declared as `var` (not `class`) so tests can assign to `global.FeatureFlags`
 */
declare var FeatureFlags: {
    isEnabled(flagName: string, defaultValue?: boolean): boolean;
    setFlag(flagName: string, value: boolean): { success: boolean; error?: string };
    deleteFlag(flagName: string): { success: boolean; error?: string };
    getAllFlags(): Record<string, boolean>;
    getSummary(): { enabled: string[]; disabled: string[]; total: number };
    enableNewAuth(): { success: boolean; error?: string };
    emergencyRollback(): { success: boolean; error?: string };
    isNewAuthEnabled(): boolean;
    isSPAModeEnabled(): boolean;
    getKnownFlags(): Record<string, FeatureFlagConfig>;
};

/**
 * FeatureFlagsManager - Pure logic helper class for feature flag operations
 * Pattern: IIFE-wrapped class with static methods (per gas-best-practices.md)
 * Declared as `var` (not `class`) so tests can assign to `global.FeatureFlagsManager`
 */
declare var FeatureFlagsManager: {
    validateFlagName(flagName: string): { valid: boolean; error?: string };
    parseBoolean(value: string | boolean | null | undefined, defaultValue: boolean): boolean;
    formatForStorage(value: boolean): string;
    shouldEnableFeature(flagValue: boolean, isProduction: boolean, forceEnabled?: boolean): boolean;
    summarizeFlags(flags: Record<string, boolean>): { enabled: string[]; disabled: string[]; total: number };
};

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
 * Declared as `var` (not `class`) so tests can assign to `global.TokenManager`
 */
declare var TokenManager: {
    generateToken(): string;
    getMultiUseToken(email: string): string;
    getEmailFromMUT(token: string): string | null;
    consumeMUT(token: string): string | null;
    updateTokenEmail(token: string, newEmail: string): boolean;
    getTokenData(token: string): TokenDataType | null;
};

/**
 * TokenStorage - One-time token persistence via SpreadsheetManager
 * Pattern: IIFE-wrapped class with static methods (per gas-best-practices.md)
 * Declared as `var` (not `class`) so tests can assign to `global.TokenStorage`
 */
declare var TokenStorage: {
    generateAndStoreToken(email: string): string;
    getTokenData(): TokenDataType[];
    consumeToken(token: string): TokenDataType | undefined;
    deleteTokens(tokensToDelete: string[]): void;
};

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
 * Declared as `var` (not `class`) so tests can assign to `global.VerificationCodeManager`
 */
declare var VerificationCodeManager: {
    generateCode(randomFn?: () => number): string;
    validateCodeFormat(code: string): { valid: boolean; error?: string };
    validateEmail(email: string): { valid: boolean; error?: string };
    calculateExpiry(createdAt: Date, expiryMinutes?: number): Date;
    isExpired(expiresAt: string, now?: Date): boolean;
    isMaxAttemptsExceeded(attempts: number, maxAttempts?: number): boolean;
    createEntry(email: string, code: string, now?: Date, service?: string): VerificationCodeEntry;
    verifyCode(inputCode: string, entry: VerificationCodeEntry, now?: Date): VerificationResult;
    checkGenerationRateLimit(existingEntries: VerificationCodeEntry[], now?: Date): RateLimitResult;
    filterActiveEntries(entries: VerificationCodeEntry[], now?: Date): VerificationCodeEntry[];
    getConfig(): typeof VERIFICATION_CONFIG;
};

/**
 * VerificationCode - GAS layer for verification code storage
 * Pattern: IIFE-wrapped class with static methods (per gas-best-practices.md)
 * Declared as `var` (not `class`) so tests can assign to `global.VerificationCode`
 */
declare var VerificationCode: {
    readonly _CACHE_PREFIX: string;
    readonly _RATE_LIMIT_PREFIX: string;
    getVerificationConfig(): typeof VERIFICATION_CONFIG;
    generateAndStore(email: string, service?: string): CodeGenerationResult;
    verify(email: string, code: string): VerificationResult;
    sendCodeEmail(email: string, code: string, serviceName: string): { success: boolean; error?: string };
    requestCode(email: string, serviceName: string, service?: string): { success: boolean; error?: string };
    clearCodes(email: string): void;
    clearRateLimitForEmail(email: string): boolean;
    clearAllVerificationData(): { cleared: number; errors: number };
};

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
 * Declared as `var` (not `class`) so tests can assign to `global.ApiClientManager`
 */
declare var ApiClientManager: {
    successResponse(data: any, meta?: any): ApiResponse;
    errorResponse(error: string, errorCode?: string, meta?: any): ApiResponse;
    validateRequest(request: any): { valid: boolean; error?: string };
    validateRequiredParams(params: Record<string, any>, required: string[]): { valid: boolean; missing?: string[] };
    sanitizeString(value: any, maxLength?: number): string;
    createRequestId(): string;
    createRequestContext(action: string | undefined, requestId: string | undefined): { action: string; requestId: string; startTime: number };
    getRequestDuration(context: { startTime: number }): number;
    createMetaFromContext(context: { action: string; requestId: string; startTime: number }): Record<string, any>;
    actionRequiresAuth(action: string, handlers: Record<string, ActionHandler>): boolean;
    listActions(handlers: Record<string, ActionHandler>, includePrivate?: boolean): Array<{ action: string; requiresAuth: boolean; description?: string }>;
    formatErrorForLogging(error: Error | string, request?: any): Record<string, any>;
};

/**
 * ApiClient - GAS layer for handling API requests
 * Pattern: IIFE-wrapped class with static methods (per gas-best-practices.md)
 * Declared as `var` (not `class`) so tests can assign to `global.ApiClient`
 */
declare var ApiClient: {
    registerHandler(action: string, handler: (params: Record<string, any>, token?: string) => ApiResponse, options?: { requiresAuth?: boolean; description?: string }): void;
    handleRequest(request: ApiRequest): string;
    listActions(): string;
    getHandler(action: string): ActionHandler | undefined;
};

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

/**
 * Voting token data structure
 */
interface VotingTokenData {
    Email: string;
    Token: string;
    Timestamp: Date;
    Used: boolean;
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
 * Declared as `var` (not `class`) so tests can assign to `global.AuditLogEntry`
 */
declare var AuditLogEntry: {
    new(
        type: string,
        outcome: string,
        note?: string,
        error?: string,
        jsonData?: string,
        timestamp?: Date
    ): AuditLogEntry;

    /** Static factory method - never throws */
    create(
        type: string,
        outcome: string,
        note?: string,
        error?: string,
        jsonData?: string,
        timestamp?: Date
    ): AuditLogEntry;

    /** Validate array of entries */
    validateArray(
        entries: Array<AuditLogEntry | object>,
        context: string
    ): AuditLogEntry[];
};

interface AuditLogEntry {
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

    /** Convert to array for spreadsheet persistence */
    toArray(): Array<Date | string>;
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
 * Declared as `var` (not `class`) so tests can assign to `global.AuditLogger`
 */
declare var AuditLogger: {
    new(today?: Date): AuditLogger;
};

interface AuditLogger {
    createLogEntry(params: AuditLogParams): AuditLogEntry;
    createLogEntries(paramsArray: AuditLogParams[]): AuditLogEntry[];
}

/**
 * Audit persistence class - writes to Audit sheet
 * Declared as `var` (not `class`) so tests can assign to `global.AuditPersistence`
 */
declare var AuditPersistence: {
    persistAuditEntries(auditEntries: AuditLogEntry[]): number;
};

// ============================================================================
// SpreadsheetManager (Flat Pattern - no namespace nesting)
// ============================================================================

/**
 * SpreadsheetManager class - Low-level spreadsheet access
 * Declared as `var` (not `class`) so tests can assign to `global.SpreadsheetManager`
 */
declare var SpreadsheetManager: {
    /**
     * Converts links in a sheet to hyperlinks.
     */
    convertLinks(sheetName: string): void;

    /**
     * Get a sheet directly by name from Bootstrap
     */
    getSheet(sheetName: string): GoogleAppsScript.Spreadsheet.Sheet;

    /**
     * Get a sheet by spreadsheet ID and sheet name (for dynamic/external spreadsheets not in Bootstrap)
     * @param spreadsheetId - The spreadsheet ID to open
     * @param sheetName - The name of the sheet tab within the spreadsheet
     * @param createIfMissing - Whether to create the sheet if it doesn't exist (default: false)
     */
    getSheetById(spreadsheetId: string, sheetName: string, createIfMissing?: boolean): GoogleAppsScript.Spreadsheet.Sheet;
};

/**
 * SheetAccess - Abstraction over spreadsheet operations
 * Provides consistent interface using native SpreadsheetApp API
 * Declared as `var` (not `class`) so tests can assign to `global.SheetAccess`
 */
declare var SheetAccess: {
    /**
     * Get data from a sheet as array of row objects
     */
    getData(sheetName: string): any[];

    /**
     * Get data as 2D array (headers + rows)
     */
    getDataAsArrays(sheetName: string): any[][];

    /**
     * Get data from sheet with RichText preserved for link columns
     * Returns objects where link columns have {text, url} structure
     */
    getDataWithRichText(sheetName: string, richTextColumns?: string[]): any[];

    /**
     * Write data to a sheet (replaces all data)
     */
    setData(sheetName: string, data: any[]): void;

    /**
     * Append rows to end of sheet
     */
    appendRows(sheetName: string, rows: any[][]): void;

    /**
     * Update specific rows in a sheet
     */
    updateRows(sheetName: string, rows: any[][], startRow: number): void;

    /**
     * Get raw Sheet object for advanced operations
     * Note: Prefer using higher-level methods when possible
     */
    getSheet(sheetName: string): GoogleAppsScript.Spreadsheet.Sheet;

    // ========================================================================
    // *ById Methods - For dynamic/external spreadsheets not in Bootstrap
    // ========================================================================

    /**
     * Get a sheet by spreadsheet ID and sheet name (for dynamic spreadsheets not in Bootstrap)
     * @param spreadsheetId - The spreadsheet ID to open
     * @param sheetName - The name of the sheet tab within the spreadsheet
     * @param createIfMissing - Whether to create the sheet if it doesn't exist (default: false)
     */
    getSheetById(spreadsheetId: string, sheetName: string, createIfMissing?: boolean): GoogleAppsScript.Spreadsheet.Sheet;

    /**
     * Get data as 2D array from a spreadsheet by ID (for dynamic spreadsheets not in Bootstrap)
     * @param spreadsheetId - The spreadsheet ID to open
     * @param sheetName - The name of the sheet tab within the spreadsheet
     */
    getDataAsArraysById(spreadsheetId: string, sheetName: string): any[][];

    /**
     * Get data from a spreadsheet by ID as array of row objects (for dynamic spreadsheets not in Bootstrap)
     * @param spreadsheetId - The spreadsheet ID to open
     * @param sheetName - The name of the sheet tab within the spreadsheet
     */
    getDataById(spreadsheetId: string, sheetName: string): any[];

    /**
     * Write data to a sheet by spreadsheet ID (for dynamic spreadsheets not in Bootstrap)
     * @param spreadsheetId - The spreadsheet ID to open
     * @param sheetName - The name of the sheet tab within the spreadsheet
     * @param data - Array of row objects
     * @param createIfMissing - Whether to create the sheet if it doesn't exist (default: false)
     */
    setDataById(spreadsheetId: string, sheetName: string, data: any[], createIfMissing?: boolean): void;

    /**
     * Open a spreadsheet by ID and return it (for operations needing the full spreadsheet object)
     * Use sparingly - prefer specific *ById methods
     * @param spreadsheetId - The spreadsheet ID to open
     */
    getSpreadsheetById(spreadsheetId: string): GoogleAppsScript.Spreadsheet.Spreadsheet;
};

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
    'Member ID'?: string | null;  // Member ID in format SC3-XXXXX (optional, null for new members)
}

// Flat ValidatedMember class (new pattern - replaces Common.Data.ValidatedMember)
// Declared as `var` (not `class`) so tests can assign to `global.ValidatedMember`
declare var ValidatedMember: {
    new(
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
    ): ValidatedMember;

    /** Static factory - never throws, returns null on failure */
    fromRow(
        rowArray: Array<any>,
        headers: string[],
        rowNumber: number,
        errorCollector: { errors: string[], rowNumbers: number[] } | null
    ): ValidatedMember | null;

    /** Batch validation with consolidated email alert */
    validateRows(
        rows: Array<Array<any>>,
        headers: string[],
        context: string
    ): ValidatedMember[];

    /** Column headers constant */
    HEADERS: string[];
};

interface ValidatedMember {
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

    /** Convert to array for sheet persistence */
    toArray(): Array<string | Date | number | boolean | null>;
}

/**
 * Plain object shape of ValidatedMember data (without class methods)
 * Use this for functions that return/accept member data as plain objects
 * rather than ValidatedMember class instances
 *
 * Excludes 'Migrated' (server-managed) and 'toArray()' (class method)
 */
type ValidatedMemberData = Omit<ValidatedMember, 'toArray' | 'Migrated'>;

// Flat ValidatedTransaction class (new pattern for transaction validation)
// Declared as `var` (not `class`) so tests can assign to `global.ValidatedTransaction`
declare var ValidatedTransaction: {
    new(
        emailAddress: string,
        firstName: string,
        lastName: string,
        phone: string,
        payment: string,
        directory: string,
        payableStatus: string,
        processed: Date | string | null,
        timestamp: Date | string | null
    ): ValidatedTransaction;

    /** Static factory - never throws, returns null on failure */
    fromRow(
        rowArray: Array<any>,
        headers: string[],
        rowNumber: number,
        errorCollector: { errors: string[], rowNumbers: number[] } | null
    ): ValidatedTransaction | null;

    /** Batch validation with consolidated email alert */
    validateRows(
        rows: Array<Array<any>>,
        headers: string[],
        context: string
    ): ValidatedTransaction[];

    /**
     * Write back only changed cells using header-based column lookup.
     * Avoids row-shift bugs and column-order assumptions.
     */
    writeChangedCells(
        sheet: GoogleAppsScript.Spreadsheet.Sheet,
        transactions: ValidatedTransaction[],
        sheetHeaders: string[]
    ): number;

    /** Column headers constant */
    HEADERS: string[];
};

interface ValidatedTransaction {
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

    /** Convert to array for sheet persistence */
    toArray(): Array<string | Date | null>;
}

// Flat ValidatedBootstrap class (type-safe Bootstrap configuration rows)
// Declared as `var` (not `class`) so tests can assign to `global.ValidatedBootstrap`
declare var ValidatedBootstrap: {
    new(reference: string, id: string | null | undefined, sheetName: string, createIfMissing: boolean | string): ValidatedBootstrap;

    /** Static factory - never throws, returns null on failure */
    fromRow(
        rowArray: Array<any>,
        headers: string[],
        rowNumber: number,
        errorCollector?: { errors: string[], rowNumbers: number[] }
    ): ValidatedBootstrap | null;

    /** Batch validation with consolidated email alert */
    validateRows(
        rows: Array<Array<any>>,
        headers: string[],
        context: string
    ): ValidatedBootstrap[];

    /** Column headers constant */
    HEADERS: string[];
};

interface ValidatedBootstrap {
    Reference: string;
    id: string;
    sheetName: string;
    createIfMissing: boolean;

    /** Convert to array for serialization/testing (NOT for sheet persistence) */
    toArray(): Array<string | boolean>;
}

// Flat ValidatedPublicGroup class (type-safe PublicGroups rows)
// Declared as `var` (not `class`) so tests can assign to `global.ValidatedPublicGroup`
declare var ValidatedPublicGroup: {
    new(name: string, email: string, subscription: string): ValidatedPublicGroup;

    /** Static factory - never throws, returns null on failure */
    fromRow(
        rowArray: Array<any>,
        headers: string[],
        rowNumber: number,
        errorCollector?: { errors: string[], rowNumbers: number[] }
    ): ValidatedPublicGroup | null;

    /** Batch validation with consolidated email alert */
    validateRows(
        rows: Array<Array<any>>,
        headers: string[],
        context: string
    ): ValidatedPublicGroup[];

    /** Column headers constant */
    HEADERS: string[];
};

interface ValidatedPublicGroup {
    Name: string;
    Email: string;
    Subscription: string;

    /** Convert to array for serialization/testing (NOT for sheet persistence) */
    toArray(): string[];
}

// Flat ValidatedElectionConfig class (type-safe ElectionConfiguration rows)
// Declared as `var` (not `class`) so tests can assign to `global.ValidatedElectionConfig`
declare var ValidatedElectionConfig: {
    new(key: string | null, setting: string | null, value: string): ValidatedElectionConfig;

    /** Static factory - never throws, returns null on failure */
    fromRow(
        rowArray: Array<any>,
        headers: string[],
        rowNumber: number,
        errorCollector?: { errors: string[], rowNumbers: number[] }
    ): ValidatedElectionConfig | null;

    /** Batch validation with consolidated email alert */
    validateRows(
        rows: Array<Array<any>>,
        headers: string[],
        context: string
    ): ValidatedElectionConfig[];

    /** Column headers constant */
    HEADERS: string[];
};

interface ValidatedElectionConfig {
    Key: string;
    Setting: string;
    Value: string;

    /** Convert to array for serialization/testing (NOT for sheet persistence) */
    toArray(): string[];
}

// Flat ValidatedElection class (new pattern for election validation)
// Declared as `var` (not `class`) so tests can assign to `global.ValidatedElection`
declare var ValidatedElection: {
    new(
        title: string,
        start: Date | string | null,
        end: Date | string | null,
        formEditUrl: string,
        electionOfficers: string,
        triggerId: string
    ): ValidatedElection;

    /** Static factory - never throws, returns null on failure */
    fromRow(
        rowArray: Array<any>,
        headers: string[],
        rowNumber: number,
        errorCollector?: { errors: string[], rowNumbers: number[] }
    ): ValidatedElection | null;

    /** Batch validation with consolidated email alert */
    validateRows(
        rows: Array<Array<any>>,
        headers: string[],
        context: string
    ): ValidatedElection[];

    /** Column headers constant */
    HEADERS: string[];
};

interface ValidatedElection {
    Title: string;
    Start: Date | null;
    End: Date | null;
    'Form Edit URL': string;
    'Election Officers': string;
    TriggerId: string;

    /** Convert to array for serialization/testing (NOT for sheet persistence) */
    toArray(): Array<string | Date | null>;
}

// Flat ValidatedActionSpec class (new pattern for action spec validation)
// Declared as `var` (not `class`) so tests can assign to `global.ValidatedActionSpec`
declare var ValidatedActionSpec: {
    /**
     * Constructor
     * @param type - Action type (required, must be one of known ActionTypes)
     * @param subject - Email subject line (required)
     * @param body - Email body (required, may be string or RichText object)
     * @param offset - Days offset for expiry actions (optional)
     */
    new(
        type: string,
        subject: string,
        body: string | { text: string; url: string },
        offset?: number | null
    ): ValidatedActionSpec;

    /**
     * Static factory method - creates ValidatedActionSpec from row data
     * Never throws - returns null on validation failure
     */
    fromRow(
        rowArray: Array<any>,
        headers: Array<string>,
        rowNumber: number,
        errorCollector?: { errors: string[]; rowNumbers: number[] }
    ): ValidatedActionSpec | null;

    /**
     * Batch validation with consolidated error reporting
     */
    validateRows(
        rows: Array<Array<any>>,
        headers: Array<string>,
        context: string
    ): ValidatedActionSpec[];

    /** Column headers constant */
    HEADERS: string[];
};

interface ValidatedActionSpec {
    /** Action type (e.g., 'Join', 'Renew', 'Expiry1', etc.) */
    Type: string;

    /** Email subject line template */
    Subject: string;

    /** Email body template (may be string or RichText object with {text, url}) */
    Body: string | { text: string; url: string };

    /** Days offset for expiry actions (optional) */
    Offset: number | null;

    /** Convert to array format for spreadsheet persistence */
    toArray(): Array<string | number | null | { text: string; url: string }>;
}

// Flat ValidatedFIFOItem class (new pattern for FIFO item validation)
// Declared as `var` (not `class`) so tests can assign to `global.ValidatedFIFOItem`
declare var ValidatedFIFOItem: {
    /**
     * Constructor
     * @param id - Unique identifier (required)
     * @param email - Member email (required, validated format)
     * @param subject - Email subject (required, non-empty)
     * @param htmlBody - Email HTML body (required, non-empty)
     * @param groups - Comma-separated group emails (optional)
     * @param attempts - Number of attempts (required, >= 0)
     * @param lastAttemptAt - Last attempt timestamp ISO string (optional)
     * @param lastError - Last error message (optional)
     * @param nextAttemptAt - Next attempt timestamp ISO string (optional)
     * @param maxAttempts - Max attempts override (optional)
     * @param dead - Dead letter flag (optional, defaults to false)
     */
    new(
        id: string,
        email: string,
        subject: string,
        htmlBody: string,
        groups: string,
        attempts: number,
        lastAttemptAt: string,
        lastError: string,
        nextAttemptAt: string,
        maxAttempts?: number | null,
        dead?: boolean
    ): ValidatedFIFOItem;

    /**
     * Static factory method - creates ValidatedFIFOItem from row data
     * Never throws - returns null on validation failure
     * Uses header-based lookup for column-order independence
     */
    fromRow(
        rowArray: Array<any>,
        headers: Array<string>,
        rowNumber: number,
        errorCollector?: { errors: string[]; rowNumbers: number[] }
    ): ValidatedFIFOItem | null;

    /**
     * Batch validation with consolidated error reporting
     */
    validateRows(
        rows: Array<Array<any>>,
        headers: Array<string>,
        context: string
    ): ValidatedFIFOItem[];

    /** Column headers constant */
    HEADERS: string[];
};

interface ValidatedFIFOItem {
    /** Unique identifier */
    id: string;

    /** Member email */
    email: string;

    /** Email subject */
    subject: string;

    /** Email HTML body */
    htmlBody: string;

    /** Comma-separated group emails (optional) */
    groups: string;

    /** Number of attempts */
    attempts: number;

    /** Last attempt timestamp ISO string */
    lastAttemptAt: string;

    /** Last error message */
    lastError: string;

    /** Next attempt timestamp ISO string */
    nextAttemptAt: string;

    /** Max attempts override (optional) */
    maxAttempts: number | null;

    /** Dead letter flag */
    dead: boolean;

    /** Convert to array format for serialization/testing (NOT for sheet persistence) */
    toArray(): Array<string | number | boolean | null>;
}

// MemberPersistence - Static-only utility class
// Declared as `var` (not `class`) so tests can assign to `global.MemberPersistence`
declare var MemberPersistence: {
    /** Write only changed cells to minimize version history noise */
    writeChangedCells(
        sheet: GoogleAppsScript.Spreadsheet.Sheet,
        originalRows: Array<Array<any>>,
        modifiedMembers: ValidatedMember[],
        headers: string[]
    ): number;

    /** Value equality that handles Dates and primitives */
    valuesEqual(a: any, b: any): boolean;

    /** Write only changed cells for a single member */
    writeSingleMemberChanges(
        sheet: GoogleAppsScript.Spreadsheet.Sheet,
        originalRow: Array<any>,
        modifiedMember: ValidatedMember,
        headers: string[],
        rowNumber: number
    ): boolean;
}

// Flat DataAccess object (new pattern - replaces Common.Data.Access)
declare var DataAccess: {
    /** Gets Bootstrap configuration data as validated objects */
    getBootstrapData: () => ValidatedBootstrap[];

    /** Gets all email addresses from active members */
    getEmailAddresses: () => string[];

    /** Gets all members */
    getMembers: () => ValidatedMember[];

    /**
     * Gets active members with write-context for selective cell writes.
     * Returns validated members plus the sheet, originalRows, and headers needed
     * for MemberPersistence.writeChangedCells().
     */
    getActiveMembersForUpdate: () => {
        members: ValidatedMember[];
        sheet: GoogleAppsScript.Spreadsheet.Sheet;
        originalRows: any[][];
        headers: string[];
    };

    /** Gets action specifications with processed body content */
    getActionSpecs: () => { [k: string]: ValidatedActionSpec };

    /** Gets public groups configuration as validated objects */
    getPublicGroups: () => ValidatedPublicGroup[];

    /** Gets a specific member by email address */
    getMember: (email: string) => ValidatedMember | undefined;

    /** Updates a member's information (accepts class instance or plain object) */
    updateMember: (email: string, newMember: ValidatedMember | ValidatedMemberData) => boolean;

    /** Checks if an email address belongs to a member */
    isMember: (email: string) => boolean;

    /** Gets all elections data */
    /**
     * Get all elections as validated objects (read-only accessor).
     * Wraps SheetAccess + ValidatedElection.validateRows at the typed domain boundary.
     */
    getElections: () => ValidatedElection[];

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

    /** Gets ExpirationFIFO items as validated objects (read-only) */
    getExpirationFIFO: () => ValidatedFIFOItem[];

    /** Gets expiry schedule data (read accessor) */
    getExpirySchedule: () => MembershipManagement.ExpirySchedule[];

    /** Gets election configuration entries as validated objects (read-only) */
    getElectionConfiguration: () => ValidatedElectionConfig[];
};

// Flat ServiceLogger class (new pattern - replaces Common.Logging.ServiceLogger)
// Declared as `var` (not `class`) so tests can assign to `global.ServiceLogger`
declare var ServiceLogger: {
    new(serviceName: string, userEmail: string, timestamp?: Date): ServiceLogger;
};

interface ServiceLogger {
    serviceName: string;
    userEmail: string;
    timestamp: Date;
    auditLogger: AuditLogger;

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
        Subscription: string;
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

    // Profile display data (returned by formatProfileForDisplay)
    // The Api layer adds *Formatted string fields after calling formatProfileForDisplay()
    interface ProfileDisplayData {
        First: string;
        Last: string;
        Phone: string;
        Email: string;
        Status: string;
        Joined: Date | null;
        Expires: Date | null;
        'Renewed On': Date | null;
        Period: number | string;
        'Directory Share Name': boolean;
        'Directory Share Phone': boolean;
        'Directory Share Email': boolean;
        // Added by Api layer after date formatting (GAS Utilities.formatDate)
        JoinedFormatted?: string;
        ExpiresFormatted?: string;
        RenewedOnFormatted?: string;
    }

    // Editable profile fields (returned by getEditableFields)
    interface EditableProfileFields {
        First: string;
        Last: string;
        Phone: string;
        'Directory Share Name': boolean;
        'Directory Share Phone': boolean;
        'Directory Share Email': boolean;
    }

    // Manager class - Pure business logic
    class Manager {
        static getForbiddenFields(): string[];
        static getProfileFieldSchema(): Record<string, ProfileField>;
        static validateEmail(email: string): ValidationResult;
        static validateName(name: string, fieldName?: string): ValidationResult;
        static validatePhone(phone: string): ValidationResult;
        static checkForForbiddenUpdates(originalProfile: ValidatedMember, updatedProfile: Partial<ValidatedMemberData>, forbiddenFields?: string[]): ForbiddenFieldCheckResult;
        static validateProfileUpdate(updatedProfile: Partial<ValidatedMemberData>): ValidationResult;
        static mergeProfiles(originalProfile: ValidatedMember, updates: Partial<ValidatedMemberData>): ValidatedMemberData;
        static processProfileUpdate(originalProfile: ValidatedMember, updatedProfile: Partial<ValidatedMemberData>, forbiddenFields?: string[]): ProfileUpdateResult;
        static formatProfileForDisplay(profile: ValidatedMember | ValidatedMemberData): ProfileDisplayData | null;
        static getEditableFields(profile: ValidatedMember | ValidatedMemberData): EditableProfileFields | null;
        static normalizeEmail(email: string): string;
        static formatUpdateResult(success: boolean, message: string): { success: boolean; message: string };
    }

    // Api namespace - GAS layer
    namespace Api {
        function handleGetProfile(params: { _authenticatedEmail?: string }): ApiResponse;
        function handleGetEditableFields(params: { _authenticatedEmail?: string }): ApiResponse;
        function handleUpdateProfile(params: { _authenticatedEmail?: string; updates?: Partial<ValidatedMemberData> }): ApiResponse;
    }

    // WebApp namespace - doGet handler
    namespace WebApp {
        function doGet(e: GoogleAppsScript.Events.DoGet, userEmail: string, template: any): GoogleAppsScript.HTML.HtmlOutput;
    }

    // Legacy function (for backward compatibility)
    function updateProfile(userToken: string, updatedProfile: Partial<ValidatedMemberData>): { success: boolean; message: string };
    function _checkForForbiddenUpdates(originalObject: ValidatedMember, updatedObject: ValidatedMember, forbiddenFields: string[]): void;
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
        static transformGroupsToMembershipInfo(groups: Array<{ email: string }>, oldEmail: string, newEmail: string): GroupMembershipInfo[];
        static updateMembershipResult(membership: GroupMembershipInfo, success: boolean, error?: string): GroupMembershipInfo;
        static aggregateResults(results: GroupMembershipInfo[]): EmailUpdateResult;
        static createUpdatedMemberRecord(originalMember: ValidatedMember, newEmail: string): ValidatedMemberData | null;
        static createChangeLogEntry(oldEmail: string, newEmail: string, date?: Date): { date: Date, from: string, to: string };
        static normalizeEmail(email: string): string;
        static buildVerificationEmailContent(code: string): { subject: string, body: string, htmlBody: string };
        static formatSendCodeResult(success: boolean, email: string, error?: string): { success: boolean, message: string, error?: string, errorCode?: string };
        static calculateBackoff(attempt: number, initialBackoffMs?: number): number;
        static getRetryAction(params: { attempt: number, maxRetries: number, error?: Error }): { action: 'retry' | 'fail' | 'initial', backoffMs?: number, errorMessage?: string };
        static createGroupUpdateResult(group: any, success: boolean, error?: string): { groupEmail: string, groupName: string, success: boolean, error: string | null };
        static aggregateGroupResults(results: Array<{ success: boolean, error?: string }>): { successCount: number, failedCount: number, overallSuccess: boolean };
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
        function sendVerificationEmail(email: string, content: { subject: string, body: string, htmlBody: string }): boolean;
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
        opens?: Date | string;  // Date from Manager.processElectionForDisplay, ISO string from deprecated webApp.js
        closes?: Date | string;  // Date from Manager.processElectionForDisplay, ISO string from deprecated webApp.js
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
        static validateElection(election: { Title?: string }): ValidationResult;
        static validateToken(token: string): ValidationResult;
        static validateTokenData(tokenData: VotingTokenData | null): TokenValidationResult;
        static isDuplicateVote(email: string, currentToken: string, allTokens: Array<{ Email: string; Token: string }>): boolean;
        static validateVote(tokenData: VotingTokenData | null, currentToken: string, allTokens: Array<{ Email: string; Token: string }>): VoteValidationResult;
        static buildElectionStatusMessage(state: string, hasVoted: boolean, ballotAccepting?: boolean): string;
        static processElectionForDisplay(election: ValidatedElection, userEmail: string, voters: Array<{ Email: string }>, ballotPublished?: boolean, ballotAccepting?: boolean, now?: Date): ProcessedElection;
        static extractFirstValues(namedValues: Record<string, any[] | any>): Record<string, any>;
        static extractElectionTitle(spreadsheetName: string, resultsSuffix?: string): string;
        static buildValidVoteEmailContent(electionTitle: string): { subject: string; body: string };
        static buildInvalidVoteEmailContent(electionTitle: string): { subject: string; body: string };
        static buildManualCountEmailContent(electionTitle: string, vote: Record<string, any>, tokenFieldName?: string): { subject: string; body: string };
        static buildElectionOpeningEmailContent(ballotTitle: string, editUrl: string): { subject: string; body: string };
        static buildElectionClosureEmailContent(ballotTitle: string, editUrl: string, manualCountRequired?: boolean): { subject: string; body: string };
        static buildElectionOfficerAddedEmailContent(title: string, editUrl: string, isSharedDrive?: boolean): { subject: string; body: string };
        static buildElectionOfficerRemovedEmailContent(title: string, isSharedDrive?: boolean): { subject: string; body: string };
        static calculateElectionStats(elections: ValidatedElection[], now?: Date): ElectionStats;
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
declare var Properties: {
    getProperty(propertyName: string, defaultValue?: string | null): string | null;
    getNumberProperty(propertyName: string, defaultValue?: number): number;
    getBooleanProperty(propertyName: string, defaultValue?: boolean): boolean;
    setCodeInternalProperty(propertyName: string, value: string): void;
    deleteCodeInternalProperty(propertyName: string): void;
    clearCache(): void;
    getAllUserProperties(): { [key: string]: string };
};
