const {ElectionRegistrationService} = require('../src/services/ElectionRegistrationService/ElectionRegistration');

// Mock the Common.Data.Access module
global.Common = {
    Data: {
        Access: {
            getMember: jest.fn()
        }
    }
};

describe('ElectionRegistrationService.isMember', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should return isMember true for an active member', () => {
        Common.Data.Access.getMember.mockReturnValue({
            Email: 'test@example.com',
            Status: 'Active',
            First: 'John',
            Last: 'Doe'
        });

        const result = ElectionRegistrationService.isMember('test@example.com');
        expect(result).toEqual({ isMember: true });
        expect(Common.Data.Access.getMember).toHaveBeenCalledWith('test@example.com');
    });

    it('should return isMember false for a non-active member', () => {
        Common.Data.Access.getMember.mockReturnValue({
            Email: 'test@example.com',
            Status: 'Inactive',
            First: 'John',
            Last: 'Doe'
        });

        const result = ElectionRegistrationService.isMember('test@example.com');
        expect(result).toEqual({ isMember: false });
    });

    it('should return isMember false for a non-existent member', () => {
        Common.Data.Access.getMember.mockReturnValue(undefined);

        const result = ElectionRegistrationService.isMember('nonexistent@example.com');
        expect(result).toEqual({ isMember: false });
    });

    it('should normalize email to lowercase', () => {
        Common.Data.Access.getMember.mockReturnValue({
            Email: 'test@example.com',
            Status: 'Active'
        });

        const result = ElectionRegistrationService.isMember('TEST@EXAMPLE.COM');
        expect(result).toEqual({ isMember: true });
        expect(Common.Data.Access.getMember).toHaveBeenCalledWith('test@example.com');
    });

    it('should trim whitespace from email', () => {
        Common.Data.Access.getMember.mockReturnValue({
            Email: 'test@example.com',
            Status: 'Active'
        });

        const result = ElectionRegistrationService.isMember('  test@example.com  ');
        expect(result).toEqual({ isMember: true });
        expect(Common.Data.Access.getMember).toHaveBeenCalledWith('test@example.com');
    });

    it('should return isMember false for invalid email (null)', () => {
        const result = ElectionRegistrationService.isMember(null);
        expect(result).toEqual({ isMember: false });
        expect(Common.Data.Access.getMember).not.toHaveBeenCalled();
    });

    it('should return isMember false for invalid email (empty string)', () => {
        const result = ElectionRegistrationService.isMember('');
        expect(result).toEqual({ isMember: false });
        expect(Common.Data.Access.getMember).not.toHaveBeenCalled();
    });

    it('should return isMember false for invalid email (non-string)', () => {
        const result = ElectionRegistrationService.isMember(123);
        expect(result).toEqual({ isMember: false });
        expect(Common.Data.Access.getMember).not.toHaveBeenCalled();
    });

    it('should not expose member data beyond status check', () => {
        Common.Data.Access.getMember.mockReturnValue({
            Email: 'test@example.com',
            Status: 'Active',
            First: 'John',
            Last: 'Doe',
            Phone: '555-1234',
            Address: '123 Main St'
        });

        const result = ElectionRegistrationService.isMember('test@example.com');
        
        // Verify only isMember is returned
        expect(Object.keys(result)).toEqual(['isMember']);
        expect(result.isMember).toBe(true);
        
        // Verify no other member data is exposed
        expect(result.First).toBeUndefined();
        expect(result.Last).toBeUndefined();
        expect(result.Phone).toBeUndefined();
        expect(result.Address).toBeUndefined();
    });
});
