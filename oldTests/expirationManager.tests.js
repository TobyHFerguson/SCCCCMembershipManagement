ExpirationManager = require('../src/JavaScript/expirationManager');

describe('ExpirationManager', () => {

    let testcase;

    const initializeTestcase = () => ({
        pre: {
            expiringMembers: [],
            members: [],
            expiredMembers: [],
            groupRemoveList: [],
            emailSendList: []
        },
        post: {
            expiringMembers: [],
            members: [],
            expiredMembers: [],
            groupRemoveList: [],
            emailSendList: []
        }
    });

    const runTest = (pre, post, expectedNumProcessed, consoleMessage = null) => {
        testcase.pre = pre;
        testcase.post = post;

        if (consoleMessage) {
            consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        }

        const numProcessed = ExpirationManager.expireMembers(
            testcase.pre.expiringMembers,
            testcase.pre.members,
            testcase.pre.expiredMembers,
            testcase.pre.groupRemoveList,
            testcase.pre.emailSendList
        );

        expect(numProcessed).toEqual(expectedNumProcessed, "The number of processed members is incorrect");
        expect(testcase.pre.expiringMembers).toEqual(testcase.post.expiringMembers, "Expiring members list does not match expected output");
        expect(testcase.pre.members).toEqual(testcase.post.members, "Members list does not match expected output");
        expect(testcase.pre.expiredMembers).toEqual(testcase.post.expiredMembers, "Expired members list does not match expected output");
        expect(testcase.pre.groupRemoveList).toEqual(testcase.post.groupRemoveList, "Group remove list does not match expected output");
        expect(testcase.pre.emailSendList).toEqual(testcase.post.emailSendList, "Email send list does not match expected output");

        if (consoleMessage) {
            expect(consoleSpy).toHaveBeenCalledWith(consoleMessage);
            consoleSpy.mockRestore();
        }
    };

    beforeEach(() => {
        testcase = initializeTestcase();
    });

    test('should do nothing if there are no members to expire', () => {
        testcase.pre = {
            expiringMembers: [],
            members: [{ Email: 1 }, { Email: 2 }],
            expiredMembers: [{ Email: 1, First: 'John', Last: 'Doe', Joined: new Date(), Period: 1, Expires: new Date(), 'Renewed On': '' }],
            groupRemoveList: [],
            emailSendList: []
        };
        testcase.post = {
            expiringMembers: [],
            members: [{ Email: 1 }, { Email: 2 }],
            expiredMembers: [{ Email: 1, First: 'John', Last: 'Doe', Joined: new Date(), Period: 1, Expires: new Date(), 'Renewed On': '' }],
            groupRemoveList: [],
            emailSendList: []
        };
        runTest(testcase.pre, testcase.post, 0);
    });

    test('it should remove members from expiringMembers and membershipData and add them to groupRemoveList and emailSendList', () => {
        testcase.pre = {
            expiringMembers: [{ Email: 1 }, { Email: 2 }],
            members: [{ Email: 1, First: 'John', Last: 'Doe', Joined: new Date(), Period: 1, Expires: new Date(), 'Renewed On': '' }, { Email: 2, First: 'Jane', Last: 'Doe', Joined: new Date(), Period: 1, Expires: new Date(), 'Renewed On': '' }],
            expiredMembers: [],
            groupRemoveList: [],
            emailSendList: []
        };
        testcase.post = {
            expiringMembers: [],
            members: [],
            expiredMembers: [{ Email: 2 }, { Email: 1 }],
            groupRemoveList: [{ Email: 2 }, { Email: 1 }],
            emailSendList: [{ Email: 2, Type: 'Expiry4' }, { Email: 1, Type: 'Expiry4' }]
        };
        runTest(testcase.pre, testcase.post, 2);
    });

    test('it should log an error if a member is not found in membershipData', () => {
        testcase.pre = {
            expiringMembers: [{ Email: 3 }],
            members: [],
            expiredMembers: [],
            groupRemoveList: [],
            emailSendList: []
        };
        testcase.post = {
            expiringMembers: [],
            members: [],
            expiredMembers: [{ Email: 3 }],
            groupRemoveList: [{ Email: 3 }],
            emailSendList: [{ Email: 3, Type: 'Expiry4' }]
        };
        runTest(testcase.pre, testcase.post, 1, 'Member 3 is supposed to be expiring but they\'re not found in membership data');
    });

    test('it should not remove members from membershipData if they are not found in membershipData', () => {
        testcase.pre = {
            expiringMembers: [{ Email: 3 }],
            members: [{ Email: 1 }, { Email: 2 }],
            expiredMembers: [],
            groupRemoveList: [{ Email: 1 }, { Email: 2 }],
            emailSendList: []
        };
        testcase.post = {
            expiringMembers: [],
            members: [{ Email: 1 }, { Email: 2 }],
            expiredMembers: [{ Email: 3 }],
            groupRemoveList: [{ Email: 1 }, { Email: 2 }, { Email: 3 }],
            emailSendList: [{ Email: 3, Type: 'Expiry4' }]
        };
        runTest(testcase.pre, testcase.post, 1);
    });

    test('it should add members to groupRemoveList and emailSendList even if those lists arent empty', () => {
        testcase.pre = {
            expiringMembers: [{ Email: 1 }, { Email: 2 }],
            members: [{ Email: 1 }, { Email: 2 }],
            expiredMembers: [{ Email: 3 }],
            groupRemoveList: [],
            emailSendList: [{ Email: 3, Type: 'Expiry4' }]
        };
        testcase.post = {
            expiringMembers: [],
            members: [],
            expiredMembers: [{ Email: 3 }, { Email: 2 }, { Email: 1 }],
            groupRemoveList: [{ Email: 2 }, { Email: 1 }],
            emailSendList: [{ Email: 3, Type: 'Expiry4' }, { Email: 2, Type: 'Expiry4' }, { Email: 1, Type: 'Expiry4' }]
        };
        runTest(testcase.pre, testcase.post, 2);
    });
});
