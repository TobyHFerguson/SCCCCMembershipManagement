import chai = require('chai');
import {Member} from '../src/Code';
import {
  UserType,
  Transaction,
  SystemConfiguration,
  CurrentMember,
} from '../src/Types';
const expect = chai.expect;

describe('Member tests', () => {
  const join = Member.convertToYYYYMMDDFormat_(new Date());
  const expires = Member.convertToYYYYMMDDFormat_(
    Member.incrementDateByOneYear(join)
  );
  const expected: UserType = {
    primaryEmail: 'given.family@santacruzcountycycling.club',
    name: {familyName: 'family', givenName: 'given', fullName: 'given family'},
    emails: [
      {type: 'home', address: 'a@b.com'},
      {address: 'given.family@santacruzcountycycling.club', primary: true},
    ],
    phones: [{type: 'mobile', value: '+1234'}],
    customSchemas: {
      Club_Membership: {
        expires: expires,
        Join_Date: join,
        membershipType: 'Individual',
      },
    },
    orgUnitPath: '/test',
    recoveryEmail: 'a@b.com',
    recoveryPhone: '+1234',
    includeInGlobalAddressList: true,
  };
  const sysConfig: SystemConfiguration = {
    orgUnitPath: '/test',
    domain: 'santacruzcountycycling.club',
    groups: 'g@sccc.club',
  };
  const txn: Transaction = {
    'First Name': 'given',
    'Last Name': 'family',
    'Email Address': 'a@b.com',
    'Phone Number': '+1234',
    'Payable Status': 'paid',
    'Payable Transaction ID': 'CC-TF-RNB6',
    'Payable Order ID': '1234',
    Timestamp: new Date('2024-03-29'),
    'In Directory': true,
  };
  it('should be able to be constructed from a Transaction', () => {
    const actual = new Member(txn, sysConfig);
    expect({...actual}).to.deep.equal({
      ...expected,
      ...{generation: 0, domain: sysConfig.domain},
    });
  });
  it('should be able to be constructed from another Member instance', () => {
    const member = new Member(txn, sysConfig);
    const actual = new Member(member, sysConfig);
    expect(actual).to.deep.equal({
      ...expected,
      ...{generation: 0, domain: sysConfig.domain},
    });
  });
  it('should be able to be constructed from a UserType', () => {
    const actual = new Member(expected, sysConfig);
    expect(actual).to.deep.equal({
      ...expected,
      ...{generation: 0, domain: sysConfig.domain},
    });
  });
  it('should be able to be constructed from a CurrentMember', () => {
    const Joined = Member.convertToYYYYMMDDFormat_(new Date());
    const Expires = Member.convertToYYYYMMDDFormat_(
      Member.incrementDateByOneYear(Joined)
    );

    const currentMember: CurrentMember = {
      'First Name': 'given',
      'Last Name': 'family',
      'Email Address': 'a@b.com',
      'Phone Number': '+1234',
      'In Directory': true,
      Joined,
      Expires,
      'Membership Type': 'Family',
      Family: '',
    };
    const expectedClubMembership = {
      Club_Membership: {
        expires: Expires,
        Join_Date: Joined,
        membershipType: 'Family',
        family: 'family',
      },
    };
    const actual = new Member(currentMember, sysConfig);
    expect(actual).to.deep.equal({
      ...expected,
      ...{
        generation: 0,
        domain: sysConfig.domain,
        customSchemas: {...expectedClubMembership},
      },
    });
  });
  it('should make a report containing membershp type and family data', () => {
    const currentMember: CurrentMember = {
      'First Name': 'given',
      'Last Name': 'family',
      'Email Address': 'a@b.com',
      'Phone Number': '+1234',
      'In Directory': true,
      Joined: new Date(Member.convertToYYYYMMDDFormat_(new Date())),
      Expires: new Date(Member.convertToYYYYMMDDFormat_(new Date())),
      'Membership Type': 'Family',
      Family: '',
    };
    const member = new Member(currentMember, sysConfig);
    const actual = member.report;
    expect(actual['Membership Type']).to.equal('Family');
    expect(actual.Family).to.equal('family');
  });
});
