const ExpirationManager  = require('../src/JavaScript/expirationManager');

describe('ExpirationManager', () => {
    const members = [{ Email: 1 }, { Email: 2 }];
    test('should do nothing if there are no members to expire', () => {
        const expiringMembers = [];
        const expectedMembers = [{ Email: 1 }, { Email: 2 }];
        const groupRemoveList = [];
        const emailSendList = [];

        const numProcessed = ExpirationManager.expireMembers(expiringMembers, members, groupRemoveList, emailSendList);
        expect(numProcessed).toEqual(0);
        expect([]).toEqual(expiringMembers);
        expect(expectedMembers).toEqual(members);
        expect([]).toEqual(groupRemoveList);
        expect([]).toEqual(emailSendList);
    });
    test('it should remove members from expiringMembers and membershipData and add them to groupRemoveList and emailSendList', () => {
        const expiringMembers = [{ Email: 1 }, { Email: 2 }];

        const groupRemoveList = [];
        const expectedGroupRemoveList = [{ Email: 2 }, { Email: 1 }];
        const emailSendList = [];
        const expectedEmailSendList = [{ Email: 2, Type: 'Expiry4' }, { Email: 1, Type: 'Expiry4' }];

        const numProcessed = ExpirationManager.expireMembers(expiringMembers, members, groupRemoveList, emailSendList);
        expect(numProcessed).toEqual(2);
        expect([]).toEqual(expiringMembers);
        expect(groupRemoveList).toEqual(expectedGroupRemoveList);
        expect(emailSendList).toEqual(expectedEmailSendList);
    });
    test('it should log an error if a member is not found in membershipData', () => {
        const expiringMembers = [{ Email: 3 }];
        const expectedExpireMembers = [{ Email: 3 }];
        const groupRemoveList = [];
        const emailSendList = [];
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        const numProcessed = ExpirationManager.expireMembers(expiringMembers, members, groupRemoveList, emailSendList);
        expect(numProcessed).toEqual(0);
        expect(consoleSpy).toHaveBeenCalledWith('Member 3 is supposed to be expiring but they\'re not found in membership data');
        consoleSpy.mockRestore();
        expect(expiringMembers).toEqual(expectedExpireMembers);
    });
    test('it should not remove members from membershipData if they are not found in membershipData', () => {
        const expiringMembers = [{ Email: 3 }];
        const members = [{ Email: 1 }, { Email: 2 }];
        const expectedMembers = [{ Email: 1 }, { Email: 2 }];
        const groupRemoveList = [];
        const emailSendList = [];
        const numProcessed = ExpirationManager.expireMembers(expiringMembers, members, groupRemoveList, emailSendList);

        expect(expiringMembers).toEqual([{ Email: 3 }]);
        expect(members).toEqual(expectedMembers);
        expect(groupRemoveList).toEqual([]);
        expect(emailSendList).toEqual([]);
    });
    test('it should add members to groupRemoveList and emailSendList even if those lists arent empty', () => {
        const expiringMembers = [{ Email: 1 }, { Email: 2 }];
        const expectedExpiringMembers = [];
        const membersList = [{ Email: 1 }, { Email: 2 }];
        const groupRemoveList = [{ Email: 3 }];
        const expectedGroupRemoveList = [{ Email: 3 }, { Email: 2 }, { Email: 1 }];
        const emailSendList = [{ Email: 3, Type: 'Expiry4' }];
        const expectedEmailSendList = [{ Email: 3, Type: 'Expiry4' }, { Email: 2, Type: 'Expiry4' }, { Email: 1, Type: 'Expiry4' }];

        const numProcessed = ExpirationManager.expireMembers(expiringMembers, membersList, groupRemoveList, emailSendList);
        expect(numProcessed).toEqual(2);
        expect(expiringMembers).toEqual(expectedExpiringMembers);
        expect(groupRemoveList).toEqual(expectedGroupRemoveList);
        expect(emailSendList).toEqual(expectedEmailSendList);
    });
});