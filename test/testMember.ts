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
    phones: [{type: 'mobile', value: '+11234567890'}],
    customSchemas: {
      Club_Membership: {
        expires: expires,
        Join_Date: join,
        membershipType: 'Individual',
      },
    },
    orgUnitPath: '/test',
    recoveryEmail: 'a@b.com',
    recoveryPhone: '+11234567890',
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
    'Phone Number': '1234567890',
    'Payable Status': 'paid',
    'Payable Transaction ID': 'CC-TF-RNB6',
    'Payable Order ID': '1234',
    Timestamp: new Date('2024-03-29'),
    'In Directory': true,
  };
  const renewal: Transaction = {
    ...txn,
    'Home Email': 'x@y.com',
  };
  const Joined = Member.convertToYYYYMMDDFormat_(new Date());
  const Expires = Member.convertToYYYYMMDDFormat_(
    Member.incrementDateByOneYear(Joined)
  );

  const currentMember: CurrentMember = {
    'First Name': 'given',
    'Last Name': 'family',
    'Email Address': 'a@b.com',
    'Phone Number': '1234567890',
    'In Directory': true,
    Joined,
    Expires,
    'Membership Type': 'Family',
    Family: '',
  };
  describe('Constructor tests', () => {
    it("should use the 'Home Email' field when set", () => {
      const actual = new Member(renewal, sysConfig);
      const expecting = {
        ...expected,
        ...{
          emails: [
            {type: 'home', address: renewal['Home Email']},
            {
              address: 'given.family@santacruzcountycycling.club',
              primary: true,
            },
          ],
        },
        ...{recoveryEmail: renewal['Home Email']},
        ...{generation: 0, domain: sysConfig.domain},
      };
      expect({...actual}).to.deep.equal(expecting);
    });
    it('should be able to be constructed from a Transaction', () => {
      const actual = new Member(txn, sysConfig);
      expect({...actual}).to.deep.equal({
        ...expected,
        ...{generation: 0, domain: sysConfig.domain},
      });
    });
    it('Member.inGlobalAddressList should be a boolean', () => {
      const txnWithNoInDirectory = {
        ...txn,
      };
      txnWithNoInDirectory['In Directory'] = <boolean>(<unknown>'');
      const actual = new Member(txnWithNoInDirectory, sysConfig);
      expect(actual.includeInGlobalAddressList).to.not.equal('');
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
  });

  describe('method tests', () => {
    it('should make a report containing membershp type and family data', () => {
      const member = new Member(currentMember, sysConfig);
      const actual = member.report;
      expect(actual['Membership Type']).to.equal('Family');
      expect(actual.Family).to.equal('family');
    });
    it('should only add a +1 when the phone number doesnt begin with a +', () => {
      let actual = new Member(currentMember, sysConfig);
      expect(actual.phone).to.equal('+1' + currentMember['Phone Number']);
      currentMember['Phone Number'] = '+1' + currentMember['Phone Number'];
      actual = new Member(currentMember, sysConfig);
      expect(actual.phone).to.equal(currentMember['Phone Number']);
    });
    it('member.report.Expires should return date in YYYY-MM-DD format', () => {
      const expected = Expires;
      const actual = new Member(currentMember, sysConfig).report.Expires;
      expect(actual).to.equal(expected);
    });
    it('incrementExpirationDate should increment the expiration date', () => {
      const uut = new Member(txn, sysConfig);
      const previousYear = Number(uut.getExpires().split('-')[0]);
      uut.incrementExpirationDate();
      const nextYear = Number(uut.getExpires().split('-')[0]);
      expect(nextYear - previousYear).to.equal(1);
    });
  });
});
