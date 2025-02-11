const { GroupManager } = require('../src/JavaScript/groupManager');

describe('GroupManager', () => {
    describe('addMembersToGroups', () => {
        const members = [{ Email: 1 }, { Email: 2 }];
        const groupEmails = [{ Group: 1 }, { Group: 2 }];
        test('should add members to groups correctly with valid input', () => {
            const result = []
            const groupAddFun = (member, group) => { result.push({ groupEmail: group.Group, memberEmail: member.Email }) };

            const expectedResult = [
                { groupEmail: 1, memberEmail: 2 },
                { groupEmail: 2, memberEmail: 2 },
                { groupEmail: 1, memberEmail: 1 },
                { groupEmail: 2, memberEmail: 1 }
            ];
            expect(GroupManager).toBeDefined();
            GroupManager.addMembersToGroups(members, groupEmails, groupAddFun);
            expect(result).toEqual(expectedResult);
        });
        test('should accumulate errors thrown and process as many as possible', () => {
            const result = []
            const expectedResult = [
                { groupEmail: 1, memberEmail: 2 },
                { groupEmail: 2, memberEmail: 1 },
            ]
            const groupAddFun = (member, group) => {
                if (member.Email === group.Group) {
                    throw new Error(`Error adding ${member} to ${groupGroup}`);
                }
                result.push({ groupEmail: group.Group, memberEmail: member.Email });
            };
            try {
                GroupManager.addMembersToGroups(members, groupEmails, groupAddFun);
            } catch (e) {
                expect(e.errors.length).toBe(2);
                expect(result).toEqual(expectedResult);
                expect(members.length).toBe(2);
            }
        });
    });
    describe('removeMembersFromGroups', () => {
        const members = [{ Email: 1 }, { Email: 2 }];
        const groupEmails = [{ Group: 1 }, { Group: 2 }];
        test('should remove members from groups correctly with valid input', () => {
            const result = []
            const groupRemoveFun = (member, group) => { result.push({ groupEmail: group.Group, memberEmail: member.Email }) };

            const expectedResult = [
                { groupEmail: 1, memberEmail: 2 },
                { groupEmail: 2, memberEmail: 2 },
                { groupEmail: 1, memberEmail: 1 },
                { groupEmail: 2, memberEmail: 1 }
            ];
            expect(GroupManager).toBeDefined();
            GroupManager.removeMembersFromGroups(members, groupEmails, groupRemoveFun);
            expect(result).toEqual(expectedResult);
        });
        test('should accumulate errors thrown and process as many as possible', () => {
            const result = []
            const expectedResult = [
                { groupEmail: 1, memberEmail: 2 },
                { groupEmail: 2, memberEmail: 1 },
            ]
            const groupRemoveFun = (member, group) => {
                if (member.Email === group.Group) {
                    throw new Error(`Error removing ${member} from ${groupGroup}`);
                }
                result.push({ groupEmail: group.Group, memberEmail: member.Email });
            };
            try {
                GroupManager.removeMembersFromGroups(members, groupEmails, groupRemoveFun);
            } catch (e) {
                expect(e.errors.length).toBe(2);
                expect(result).toEqual(expectedResult);
                expect(members.length).toBe(2);
            }
        });
    })
    describe('errors dont affect the list', () => {
        const members = [{ Email: 1 }, { Email: 2 }];
        const groupEmails = [{ Group: 1 }, { Group: 2 }];
        test('should not affect the list if  errors are thrown', () => {
            const result = []
            const groupAddFun = (member, group) => { throw new Error() };

            const expectedResult = [
                { groupEmail: 1, memberEmail: 2 },
                { groupEmail: 2, memberEmail: 2 },
                { groupEmail: 1, memberEmail: 1 },
                { groupEmail: 2, memberEmail: 1 }
            ];
            expect(GroupManager).toBeDefined();
            try {
                GroupManager.addMembersToGroups(members, groupEmails, groupAddFun);
            } catch (e) {
                expect(members.length).toBe(2);
            }
        });
    })
});
