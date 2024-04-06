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
import {Transaction} from '../src/Types';

describe('TransactionProcessor tests', () => {
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
  it('should generate new email addresses when the same name has already been used', () => {
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
    const txn2: Transaction = {
      ...txn1,
      'Email Address': 'X@Y.com',
      'Phone Number': '4083869343',
    };
    const sysConfig = {orgUnitPath: '/test', domain: 'b.com', groups: ''};
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
});
