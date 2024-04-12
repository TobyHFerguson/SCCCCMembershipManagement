import chai = require('chai');
import {Member} from '../src/Code';
import {
  UserType,
  Transaction,
  SystemConfiguration,
  CurrentMember,
  OrganizationOptions,
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
  const orgOptions: OrganizationOptions = {
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
      const actual = new Member(renewal, orgOptions);
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
        ...{generation: 0, domain: orgOptions.domain},
      };
      expect({...actual}).to.deep.equal(expecting);
    });
    it('should be able to be constructed from a Transaction', () => {
      const actual = new Member(txn, orgOptions);
      expect({...actual}).to.deep.equal({
        ...expected,
        ...{generation: 0, domain: orgOptions.domain},
      });
    });
    it('Member.inGlobalAddressList should be a boolean', () => {
      const txnWithNoInDirectory = {
        ...txn,
      };
      txnWithNoInDirectory['In Directory'] = <boolean>(<unknown>'');
      const actual = new Member(txnWithNoInDirectory, orgOptions);
      expect(actual.includeInGlobalAddressList).to.not.equal('');
    });
    it('should be able to be constructed from another Member instance', () => {
      const member = new Member(txn, orgOptions);
      const actual = new Member(member, orgOptions);
      expect(actual).to.deep.equal({
        ...expected,
        ...{generation: 0, domain: orgOptions.domain},
      });
    });
    it('should be able to be constructed from a UserType', () => {
      const actual = new Member(expected, orgOptions);
      expect(actual).to.deep.equal({
        ...expected,
        ...{generation: 0, domain: orgOptions.domain},
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
      const actual = new Member(currentMember, orgOptions);
      expect(actual).to.deep.equal({
        ...expected,
        ...{
          generation: 0,
          domain: orgOptions.domain,
          customSchemas: {...expectedClubMembership},
        },
      });
    });
  });

  describe('method tests', () => {
    it('should make a report containing membershp type and family data', () => {
      const member = new Member(currentMember, orgOptions);
      const actual = member.report;
      expect(actual['Membership Type']).to.equal('Family');
      expect(actual.Family).to.equal('family');
    });
    it('should only add a +1 when the phone number doesnt begin with a +', () => {
      let actual = new Member(currentMember, orgOptions);
      expect(actual.phone).to.equal('+1' + currentMember['Phone Number']);
      currentMember['Phone Number'] = '+1' + currentMember['Phone Number'];
      actual = new Member(currentMember, orgOptions);
      expect(actual.phone).to.equal(currentMember['Phone Number']);
    });
    it('member.report.Expires should return date in YYYY-MM-DD format', () => {
      const expected = Expires;
      const actual = new Member(currentMember, orgOptions).report.Expires;
      expect(actual).to.equal(expected);
    });
    it('incrementExpirationDate should increment the expiration date', () => {
      const uut = new Member(txn, orgOptions);
      const previousYear = Number(uut.getExpires().split('-')[0]);
      uut.incrementExpirationDate();
      const nextYear = Number(uut.getExpires().split('-')[0]);
      expect(nextYear - previousYear).to.equal(1);
    });
  });
});
