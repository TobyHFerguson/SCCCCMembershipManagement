import chai = require('chai');
import Sinon = require('sinon');
const referee = require("@sinonjs/referee");
const assert = referee.assert;
import sinonChai = require('sinon-chai');
import {
  CurrentMember,
  MembersCollectionType,
  SystemConfiguration,
  Transaction,
  UserType,
  UsersCollectionType,
} from '../src/Types';
import { Directory, Member } from '../src/Code';
const expect = chai.expect;
chai.use(sinonChai);

class Users implements UsersCollectionType {
  get(userKey: string) {
    return {};
  }
  insert() {
    return {};
  }
  list(optionalArgs: {}) {
    return {};
  }
  remove() { }
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
const systemConfig: SystemConfiguration = {
  orgUnitPath: '/test',
  domain: 'b.com',
  groups: '',
};
describe('Directory Tests', () => {
  describe('Basic Creation', () => {
    it('Should create a stub', () => {
      const users = Sinon.createStubInstance(Users);
      expect(Sinon.stub).to.not.be.null;
    });
    it('should create an instance', () => {
      const users = Sinon.createStubInstance(Users);
      const members = Sinon.createStubInstance(Members);
      const uut = new Directory(systemConfig, { Users: users, Members: members });
      expect(uut).to.not.be.null;
      it('');
    });
  });
  describe('Method tests', () => {
    const users = new Users();
    const member = Sinon.createStubInstance(Member);
    const members = Sinon.createStubInstance(Members);
    const uut = new Directory(systemConfig, { Users: users, Members: members });
    it('should update the users includeInGlobalAddressList field ', () => {
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
      const member = new Member(currentMember, systemConfig);
      const updateStub = Sinon.stub(users, 'update');
      updateStub.returns(member);
      uut.updateMember(member);
      expect(updateStub).to.have.been.calledOnceWithExactly(
        member,
        member.primaryEmail
      );
    });
    it('should return the users', () => {
      const users = Sinon.createStubInstance(Users)
      const members = Sinon.createStubInstance(Members);
      const member = Sinon.createStubInstance(Member);
      users.list.returns({ users: [member] })
      const uut = new Directory(systemConfig, { Users: users, Members: members });
      const actual = uut.getMembers();
      const expected = [new Member(member, systemConfig)]
      expect(actual).to.deep.equal(expected)
    })
    it('should throw the underlying error', () => {
      const users = Sinon.createStubInstance(Users)
      const members = Sinon.createStubInstance(Members);
      users.list.throws('this is an error')
      const uut = new Directory(systemConfig, { Users: users, Members: members });
      uut.getMembers();
      expect(users.list).to.have.thrown('this is an error')
    })
    it('should extend the error to show the invalid org path', () => {
      const users = Sinon.createStubInstance(Users)
      const members = Sinon.createStubInstance(Members);
      users.list.throws('Invalid Input: INVALID_OU_ID')
      const uut = new Directory(systemConfig, { Users: users, Members: members });
      try { uut.getMembers(); }
      catch { }
      const expected = `Sinon-provided Invalid Input: INVALID_OU_ID: "${systemConfig.orgUnitPath}"`
      const actual = users.list.exceptions[0].message;
      expect(actual).to.deep.equal(expected);
      // The below doesn't work - I think the typescript definitions for sinonChai are out of date :-()
      // expect(users.list).to.have.thrown(`Sinon-provided Invalid Input: INVALID_OU_ID: "${systemConfig.orgUnitPath}"`)
    })
  });
});
