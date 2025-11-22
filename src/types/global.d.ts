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
                function getFiddler(sheetName: 'ActiveMembers'): Fiddler<Member>;
                function getFiddler(sheetName: 'ActionSpecs'): Fiddler<MembershipManagement.ActionSpec>;
                function getFiddler(sheetName: 'ExpirySchedule'): Fiddler<MembershipManagement.ExpirySchedule>;
                function getFiddler(sheetName: 'ExpirationFIFO'): Fiddler<ExpiredMember>;
                
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

