/**
 * Integration test for MembershipManagement.assignMemberIds
 * 
 * This test verifies that assignMemberIds correctly:
 * 1. Reads members via DataAccess.getActiveMembersForUpdate()
 * 2. Generates unique Member IDs for members without one
 * 3. Writes changes using MemberPersistence.writeChangedCells()
 * 4. Is idempotent (safe to run multiple times)
 */

const ns = require('../src/1namespaces.js');

// Mock dependencies
global.Properties = /** @type {any} */ ({
    getProperty: jest.fn((key, defaultValue) => defaultValue),
    getNumberProperty: jest.fn((key, defaultValue) => defaultValue),
    getBooleanProperty: jest.fn((key, defaultValue) => defaultValue),
});

global.Common = global.Common || {};
global.Common.Data = global.Common.Data || {};
global.Common.Data.Storage = global.Common.Data.Storage || {};
global.Common.Config = global.Common.Config || {};
global.Common.Config.Properties = global.Properties;

// Mock AppLogger
global.AppLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    configure: jest.fn()
};

// Mock SpreadsheetApp UI for alert
const mockAlert = jest.fn();
const mockUi = {
    alert: mockAlert
};
global.SpreadsheetApp = {
    getUi: jest.fn(() => mockUi)
};

// Load MemberIdGenerator
const { MemberIdGenerator } = require('../src/common/utils/MemberIdGenerator.js');
global.MemberIdGenerator = MemberIdGenerator;

// Load ValidatedMember
const { ValidatedMember } = require('../src/common/data/ValidatedMember.js');
global.ValidatedMember = ValidatedMember;

// Load MemberPersistence
const { MemberPersistence } = require('../src/common/data/MemberPersistence.js');
global.MemberPersistence = MemberPersistence;

// Mock DataAccess
const mockSheet = {
    getRange: jest.fn((row, col) => ({
        setValue: jest.fn(),
        setNumberFormat: jest.fn()
    }))
};

global.DataAccess = {
    getActiveMembersForUpdate: jest.fn()
};

// Load MembershipManagement
global.MembershipManagement = global.MembershipManagement || ns.MembershipManagement || {};
require('../src/services/MembershipManagement/MembershipManagement.js');

describe('MembershipManagement.assignMemberIds', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockAlert.mockClear();
    });

    it('should exist as a function', () => {
        expect(typeof global.MembershipManagement.assignMemberIds).toBe('function');
    });

    it('should assign Member IDs to members without one', () => {
        const headers = ['Status', 'Email', 'First', 'Last', 'Phone', 'Joined', 'Expires', 'Period', 'Migrated', 'Member ID', 'Directory Share Name', 'Directory Share Email', 'Directory Share Phone', 'Renewed On'];
        
        // Create members: first has ID, second doesn't, third doesn't
        // Constructor: email, status, first, last, phone, joined, expires, period, migrated, dirName, dirEmail, dirPhone, renewedOn, memberId
        const member1 = new ValidatedMember(
            'test1@example.com', 'Active', 'John', 'Doe', '555-1234',
            new Date('2024-01-01'), new Date('2025-01-01'), 12,
            null, true, false, false, null, 'SC3-AAAAA'
        );
        
        const member2 = new ValidatedMember(
            'test2@example.com', 'Active', 'Jane', 'Smith', '555-5678',
            new Date('2024-01-01'), new Date('2025-01-01'), 12,
            null, true, false, false, null, null // No Member ID
        );
        
        const member3 = new ValidatedMember(
            'test3@example.com', 'Active', 'Bob', 'Johnson', '555-9999',
            new Date('2024-01-01'), new Date('2025-01-01'), 12,
            null, true, false, false, null, '' // Empty Member ID
        );
        
        const members = [member1, member2, member3];
        const originalRows = members.map(m => headers.map(h => m[h]));
        
        global.DataAccess.getActiveMembersForUpdate.mockReturnValue({
            members,
            sheet: mockSheet,
            originalRows,
            headers
        });
        
        // Call the function
        global.MembershipManagement.assignMemberIds();
        
        // Verify that Member IDs were assigned to members 2 and 3
        expect(member2['Member ID']).toBeTruthy();
        expect(member3['Member ID']).toBeTruthy();
        expect(MemberIdGenerator.isValid(member2['Member ID'])).toBe(true);
        expect(MemberIdGenerator.isValid(member3['Member ID'])).toBe(true);
        
        // Verify member1's ID was not changed
        expect(member1['Member ID']).toBe('SC3-AAAAA');
        
        // Verify IDs are unique
        expect(member2['Member ID']).not.toBe(member3['Member ID']);
        expect(member2['Member ID']).not.toBe(member1['Member ID']);
        
        // Verify UI alert was called
        expect(SpreadsheetApp.getUi).toHaveBeenCalled();
        expect(mockAlert).toHaveBeenCalledWith(expect.stringContaining('Assigned Member IDs to 2 members'));
        
        // Verify AppLogger was called
        expect(AppLogger.info).toHaveBeenCalledWith(
            'MembershipManagement',
            expect.stringContaining('Assigned 2 Member IDs')
        );
    });

    it('should be idempotent (skip members with existing IDs)', () => {
        const headers = ['Status', 'Email', 'First', 'Last', 'Phone', 'Joined', 'Expires', 'Period', 'Migrated', 'Member ID', 'Directory Share Name', 'Directory Share Email', 'Directory Share Phone', 'Renewed On'];
        
        // All members already have IDs
        // Constructor: email, status, first, last, phone, joined, expires, period, migrated, dirName, dirEmail, dirPhone, renewedOn, memberId
        const member1 = new ValidatedMember(
            'test1@example.com', 'Active', 'John', 'Doe', '555-1234',
            new Date('2024-01-01'), new Date('2025-01-01'), 12,
            null, true, false, false, null, 'SC3-AAAAA'
        );
        
        const member2 = new ValidatedMember(
            'test2@example.com', 'Active', 'Jane', 'Smith', '555-5678',
            new Date('2024-01-01'), new Date('2025-01-01'), 12,
            null, true, false, false, null, 'SC3-BBBBB'
        );
        
        const members = [member1, member2];
        const originalRows = members.map(m => headers.map(h => m[h]));
        
        global.DataAccess.getActiveMembersForUpdate.mockReturnValue({
            members,
            sheet: mockSheet,
            originalRows,
            headers
        });
        
        // Call the function
        global.MembershipManagement.assignMemberIds();
        
        // Verify IDs were not changed
        expect(member1['Member ID']).toBe('SC3-AAAAA');
        expect(member2['Member ID']).toBe('SC3-BBBBB');
        
        // Verify UI alert indicates no work was done
        expect(mockAlert).toHaveBeenCalledWith('All members already have Member IDs — nothing to do.');
        
        // Verify AppLogger was NOT called (no changes made)
        expect(AppLogger.info).not.toHaveBeenCalled();
    });

    it('should prevent collisions with existing IDs', () => {
        const headers = ['Status', 'Email', 'First', 'Last', 'Phone', 'Joined', 'Expires', 'Period', 'Migrated', 'Member ID', 'Directory Share Name', 'Directory Share Email', 'Directory Share Phone', 'Renewed On'];
        
        // Create members with one existing ID
        // Constructor: email, status, first, last, phone, joined, expires, period, migrated, dirName, dirEmail, dirPhone, renewedOn, memberId
        const member1 = new ValidatedMember(
            'test1@example.com', 'Active', 'John', 'Doe', '555-1234',
            new Date('2024-01-01'), new Date('2025-01-01'), 12,
            null, true, false, false, null, 'SC3-AAAAA'
        );
        
        const member2 = new ValidatedMember(
            'test2@example.com', 'Active', 'Jane', 'Smith', '555-5678',
            new Date('2024-01-01'), new Date('2025-01-01'), 12,
            null, true, false, false, null, null
        );
        
        const members = [member1, member2];
        const originalRows = members.map(m => headers.map(h => m[h]));
        
        global.DataAccess.getActiveMembersForUpdate.mockReturnValue({
            members,
            sheet: mockSheet,
            originalRows,
            headers
        });
        
        // Call the function
        global.MembershipManagement.assignMemberIds();
        
        // Verify new ID doesn't collide with existing ID
        expect(member2['Member ID']).not.toBe('SC3-AAAAA');
        expect(member2['Member ID']).toBeTruthy();
        expect(MemberIdGenerator.isValid(member2['Member ID'])).toBe(true);
    });
});
