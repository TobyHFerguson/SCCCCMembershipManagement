import chai = require('chai');
import {TransactionProcessor} from '../src/Code';
const expect = chai.expect;

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
});
