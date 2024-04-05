import chai = require('chai');
import Sinon = require('sinon');
import sinonChai = require("sinon-chai");
import { CurrentMember, MembersCollectionType, SystemConfiguration, Transaction, UserType, UsersCollectionType } from '../src/Types';
import { Directory, Member } from '../src/Code';
const expect = chai.expect;
chai.use(sinonChai);

class Users implements UsersCollectionType {
    get(userKey: string) {
        return {}
    }
    insert() { return {} }
    list(optionalArgs: {}) { return {} }
    remove() { }
    update(resource: UserType, userKey: string) { return resource; }
}
class Members implements MembersCollectionType {
    insert(resource: GoogleAppsScript.AdminDirectory.Schema.Member, groupKey: string) { return resource; }
    update(resource: GoogleAppsScript.AdminDirectory.Schema.Member, groupKey: string, memberKey: string) { return resource; }
}
const systemConfig: SystemConfiguration = {
    orgUnitPath: "/test",
    domain: "b.com",
    groups: ''
}
describe('Directory Tests', () => {

    describe('Basic Creation', () => {
        it('Should create a stub', () => {
            const users = Sinon.createStubInstance(Users);
            expect(Sinon.stub).to.not.be.null;
        })
        it('should create an instance', () => {
            const users = Sinon.createStubInstance(Users);
            const members = Sinon.createStubInstance(Members)
            const uut = new Directory(systemConfig, { Users: users, Members: members })
            expect(uut).to.not.be.null;
            it('')
        })
    })
    describe('Method tests', () => {
        const users = new Users();
        const members = Sinon.createStubInstance(Members)
        const uut = new Directory(systemConfig, { Users: users, Members: members })
        it('should update the users includeInGlobalAddressList field ', () => {
            const currentMember: CurrentMember = {
                "First Name": 'John',
                'Last Name': 'Smith',
                "Email Address": 'a@b.com',
                'Phone Number': '1234',
                "In Directory": false,
                "Membership Type": '',
                Joined: new Date(),
                Expires: new Date()
            }
            const member = new Member(currentMember, systemConfig)
            const updateStub = Sinon.stub(users, "update") 
            updateStub.returns(member);
            uut.updateMember(member)
            expect(updateStub).to.have.been.calledOnceWithExactly({customSchemas: member.customSchemas}, member.primaryEmail)
        })
    })
})