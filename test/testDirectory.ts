import chai = require('chai');
import Sinon = require('sinon');
const referee = require('@sinonjs/referee');
const assert = referee.assert;
import sinonChai = require('sinon-chai');
import {
  CurrentMember,
  MembersCollectionType,
  OrganizationOptions,
  SystemConfiguration,
  Transaction,
  UserType,
  UsersCollectionType,
} from '../src/Types';
import {Directory, Member, MemberCreationNotCompletedError} from '../src/Code';
const expect = chai.expect;
chai.use(sinonChai);

class Users implements UsersCollectionType {
  get(userKey: string) {
    return {};
  }
  insert(user: UserType) {
    return user;
  }
  list(optionalArgs: {}) {
    return {};
  }
  remove() {}
  update(resource: UserType, userKey: string) {
    return resource;
  }
}
class Members implements MembersCollectionType {
  insert(
    resource: GoogleAppsScript.AdminDirectory.Schema.Member,
    groupKey: string
  ) {
    return resource;
  }
  update(
    resource: GoogleAppsScript.AdminDirectory.Schema.Member,
    groupKey: string,
    memberKey: string
  ) {
    return resource;
  }
}
const orgOptions: OrganizationOptions = {
  orgUnitPath: '/test',
  domain: 'b.com',
  groups: '',
};
describe('Directory Tests', () => {
  describe('Basic Creation', () => {
    it('should create an instance', () => {
      const users = Sinon.createStubInstance(Users);
      const members = Sinon.createStubInstance(Members);
      const uut = new Directory({
        adminDirectory: {Users: users, Members: members},
        options: orgOptions,
      });
      expect(uut).to.not.be.null;
    });
  });
  describe('Method tests', () => {
    const currentMember: CurrentMember = {
      'First Name': 'John',
      'Last Name': 'Smith',
      'Email Address': 'a@b.com',
      'Phone Number': '1234',
      'In Directory': false,
      'Membership Type': '',
      Joined: new Date() + '',
      Expires: new Date() + '',
    };
    describe('addMember tests', () => {
      it('should add member to all SG - Club Membership group', () => {
        const usersStub = Sinon.createStubInstance(Users);
        const membersStub = Sinon.createStubInstance(Members);
        const uut = new Directory({
          adminDirectory: {Users: usersStub, Members: membersStub},
          options: orgOptions,
        });
        const member = uut.makeMember(currentMember);
        usersStub.insert.returns(member);
        const spy = Sinon.spy(uut, 'addMemberToGroup');
        uut.addMember(currentMember);
        expect(spy).to.be.calledOnce;
        expect(spy.args[0][1]).to.equal(
          'club_members@santacruzcountycycling.club'
        );
        const memberAdded = spy.args[0][0];
        delete memberAdded.changePasswordAtNextLogin;
        delete memberAdded.password;
        expect(memberAdded).to.deep.equal(member);
      });
    });
    describe('update member tests', () => {
      it('should update the all fields in the member', () => {
        const users = new Users();
        const member = Sinon.createStubInstance(Member);
        const members = Sinon.createStubInstance(Members);
        const uut = new Directory({
          adminDirectory: {
            Users: users,
            Members: members,
          },
          options: orgOptions,
        });
        const updateStub = Sinon.stub(users, 'update');
        updateStub.returns(member);
        uut.updateMember(member);
        expect(updateStub).to.have.been.calledOnceWithExactly(
          member,
          member.primaryEmail
        );
      });
      it('should put the members user key in the error message', () => {
        const users = new Users();
        const members = Sinon.createStubInstance(Members);
        const uut = new Directory({
          adminDirectory: {
            Users: users,
            Members: members,
          },
          options: orgOptions,
        });
        const updateStub = Sinon.stub(users, 'update');
        updateStub.throws('invalid user key: userKey');
        try {
          uut.updateMember(new Member(currentMember, orgOptions));
        } catch {}

        const actual = updateStub.exceptions[0].message;
        const expected = `invalid user key: john.smith@${orgOptions.domain}`;
        expect(actual).to.contain(expected);
      });
      it.skip('should retry when MemberCreationNotCompleted is thrown', () => {
        const users = new Users();
        const members = Sinon.createStubInstance(Members);
        const uut = new Directory({
          adminDirectory: {
            Users: users,
            Members: members,
          },
          options: orgOptions,
        });
        const updateStub = Sinon.stub(users, 'update');
        updateStub
          .onCall(0)
          .throws(
            new MemberCreationNotCompletedError(
              'User creation is not complete.'
            )
          );
        const member = new Member(currentMember, orgOptions);
        updateStub.onCall(1).returns(member);

        uut.updateMember(member);

        // expect(actual).to.be.deep.equal(member)

        expect(updateStub).to.have.thrown(Error);
      });
    });
    describe.skip('Attempt to figure out stubs and exceptions', () => {
      it('should behave differently on consecutive calls with certain argument', () => {
        const callback = Sinon.stub();
        callback
          .withArgs(42)
          .onFirstCall()
          .throws(Error)
          .onSecondCall()
          .returns(2);
        callback.returns(0);

        assert.equals(callback(1), 0);
        expect(callback(42)).to.throw(Error);
        // // assert.exception(callback(42));
        assert.equals(callback(1), 0);
        assert.equals(callback(42), 2);
        assert.equals(callback(1), 0);
        assert.equals(callback(42), 0);
      });
    });
    describe('getMembers() tests', () => {
      it('should return the users', () => {
        const users = Sinon.createStubInstance(Users);
        const members = Sinon.createStubInstance(Members);
        const member = Sinon.createStubInstance(Member);
        users.list.returns({users: [member]});
        const uut = new Directory({
          adminDirectory: {
            Users: users,
            Members: members,
          },
          options: orgOptions,
        });
        const actual = uut.getMembers();
        const expected = [new Member(member, orgOptions)];
        expect(actual).to.deep.equal(expected);
      });
      it('should throw the underlying error', () => {
        const users = Sinon.createStubInstance(Users);
        const members = Sinon.createStubInstance(Members);
        users.list.throws('this is an error');
        const uut = new Directory({
          adminDirectory: {
            Users: users,
            Members: members,
          },
          options: orgOptions,
        });
        uut.getMembers();
        expect(users.list).to.have.thrown('this is an error');
      });
      it('should extend the error to show the invalid org path', () => {
        const users = Sinon.createStubInstance(Users);
        const members = Sinon.createStubInstance(Members);
        users.list.throws('Invalid Input: INVALID_OU_ID');
        const uut = new Directory({
          adminDirectory: {
            Users: users,
            Members: members,
          },
          options: orgOptions,
        });
        try {
          uut.getMembers();
        } catch {}
        const expected = `Sinon-provided Invalid Input: INVALID_OU_ID: "${orgOptions.orgUnitPath}"`;
        const actual = users.list.exceptions[0].message;
        expect(actual).to.deep.equal(expected);
        // The below doesn't work - I think the typescript definitions for sinonChai are out of date :-()
        // expect(users.list).to.have.thrown(`Sinon-provided Invalid Input: INVALID_OU_ID: "${systemConfig.orgUnitPath}"`)
      });
    });
  });
});
