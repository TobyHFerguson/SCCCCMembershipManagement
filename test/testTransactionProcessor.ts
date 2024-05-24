import chai = require('chai');
import Sinon = require('sinon');
import sinonChai = require('sinon-chai');
const expect = chai.expect;
chai.use(sinonChai);
import {
  Directory,
  Member,
  MemberAlreadyExistsError,
  Notifier,
  TransactionProcessor,
} from '../src/Code';
import {Transaction, UserType} from '../src/Types';

describe('TransactionProcessor tests', () => {
  describe('member matching tests', () => {
    it('should match fully the same item', () => {
      const v = {email: 'email1', phone: 'phone1'};
      expect(TransactionProcessor.match(v, v)).to.deep.equal({full: true});
    });
    it('should not match different items', () => {
      const l = {email: 'email1', phone: 'phone1'};
      const r = {email: 'email2', phone: 'phone2'};
      expect(TransactionProcessor.match(l, r)).to.be.false;
    });
    it('should partially match when only the emails are different', () => {
      const l = {email: 'email1', phone: 'phone1'};
      const r = {email: 'email2', phone: 'phone1'};
      expect(TransactionProcessor.match(l, r)).to.deep.equal({full: false});
    });
    it('should partially match when only the phones are different', () => {
      const l = {email: 'email1', phone: 'phone1'};
      const r = {email: 'email1', phone: 'phone2'};
      expect(TransactionProcessor.match(l, r)).to.deep.equal({full: false});
    });
    it('should match if only one phone is present', () => {
      const l = {email: 'email1', phone: ''};
      const r = {email: 'email1', phone: 'phone2'};
      expect(TransactionProcessor.match(l, r)).to.deep.equal({full: true});
      expect(TransactionProcessor.match(r, l)).to.deep.equal({full: true});
    });
    it('should not match just because only one phone is present', () => {
      const l = {email: 'email1', phone: ''};
      const r = {email: 'email2', phone: 'phone2'};
      expect(TransactionProcessor.match(l, r)).to.be.false;
    });
  });
  describe('method tests', () => {
    const txn1: Transaction = {
      'Payable Order ID': '1',
      'Payable Status': 'paid',
      'Payable Transaction ID': '1',
      'First Name': 'fred',
      'Last Name': 'foo',
      Timestamp: new Date(),
      'In Directory': true,
      'Email Address': 'a@b.com',
      'Phone Number': '1234561234',
    };
    const sysConfig = {orgUnitPath: '/test', domain: 'sccc.club', groups: ''};
    it('addMember() should generate new email addresses when the same name has already been used', () => {
      const txn2: Transaction = {
        ...txn1,
        'Email Address': 'X@Y.com',
        'Phone Number': '4083869343',
      };
      const oldMember = new Member(txn1, sysConfig);
      const newMember = new Member(txn2, sysConfig);
      const stub = Sinon.createStubInstance(Directory);
      stub.getMembers.onCall(0).returns([oldMember]);
      stub.makeMember.returns(newMember);
      stub.addMember
        .onCall(0)
        .throws(new MemberAlreadyExistsError('member already exists'));
      const sut = new TransactionProcessor(stub, new Notifier());
      sut.processTransaction(txn2);
      expect(stub.getMembers).to.be.calledOnce;
      expect(stub.addMember).to.be.calledTwice;
    });
    it("renew() should use the 'Home Email' field when processing renewals", () => {
      const oldMember = new Member(txn1, sysConfig);
      oldMember.customSchemas.Club_Membership.expires = '2030-10-10';
      const renewal = {
        ...txn1,
        'Home Email': 'x@y.com',
        'Phone Number': '+14081230000',
        'In Directory': false,
        'First Name': 'Ginger',
        'Last Name': 'Rogers',
      };
      const expected = new Member(txn1, sysConfig);
      expected.emails = [
        {address: 'x@y.com', type: 'home'},
        {address: 'fred.foo@sccc.club', primary: true},
      ];
      expected.phones = [
        {
          value: '+14081230000',
          type: 'mobile',
        },
      ];
      expected.includeInGlobalAddressList = false;
      expected.name.familyName = 'Rogers';
      expected.name.fullName = 'Ginger Rogers';
      expected.name.givenName = 'Ginger';
      expected.customSchemas.Club_Membership.expires = '2031-10-10';

      const directoryStub = Sinon.createStubInstance(Directory);
      directoryStub.getMember.returns(oldMember);
      const sut = new TransactionProcessor(directoryStub, new Notifier());

      sut.renew(renewal);

      expect(directoryStub.updateMember).to.be.calledOnce;
      const actual = directoryStub.updateMember.args[0][0];
      expect(actual).to.deep.equal(expected);
    });
    it('has an updateUser() method that updates the user, but leaves the expiry date untouched', () => {
      const directoryStub = Sinon.createStubInstance(Directory);
      const notifierStub = Sinon.createStubInstance(Notifier);
      const sut = new TransactionProcessor(directoryStub, notifierStub);

      const inputUser:UserType = {};
      inputUser.emails = new Array({type: 'home', address: 'a@b.com'});
      inputUser.phones = new Array({type: 'mobile', value: '+14083869003'});
      inputUser.primaryEmail = 'x.y@santacruzcountycycling.club';
      inputUser.includeInGlobalAddressList = false;

      sut.updateUser(inputUser);

      const actual = directoryStub.updateMember.args[0][0]
      expect(actual).to.deep.equal(inputUser)


    })
  });
});
