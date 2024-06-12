import chai = require('chai');
import {Member} from '../src/Code';
import {
  UserType,
  Transaction,
  SystemConfiguration,
  CurrentMember,
  OrganizationOptions,
  Renewal,
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
    phones: [{type: 'mobile', value: '(123) 456-7890'}],
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
    'Phone Number': '(123) 456-7890',
    'Payable Status': 'paid',
    'Payable Transaction ID': 'CC-TF-RNB6',
    'Payable Order ID': '1234',
    Timestamp: new Date('2024-03-29'),
    'In Directory': true,
  };
  const renewal: Renewal = {
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
    'Phone Number': '(123) 456-7890',
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
    it('should never generate a phone number if the given number is empty', () => {
      const txn1 = {
        ...txn,
        ...{'Phone Number': ''},
      };
      const expected1 = {
        ...expected,
        ...{generation: 0, domain: orgOptions.domain},
        ...{phones: [{type: 'mobile', value: ''}]},
        ...{recoveryPhone: ''},
      };
      const actual = new Member(txn1, orgOptions);
      expect({...actual}).to.deep.equal(expected1);
    });
  });

  describe('method tests', () => {
    it('should make a report containing membershp type and family data', () => {
      const member = new Member(currentMember, orgOptions);
      const actual = member.report;
      expect(actual['Membership Type']).to.equal('Family');
      expect(actual.Family).to.equal('family');
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

  describe('ancillary Tests', () => {
    describe('phone number tests', () => {
      it('should convert a US phone number into an international number', () => {
        const phoneNumber = '(408) 123 1234'
        const expected = '+14081231234'
        const actual = Member.usToInternational(phoneNumber)
        expect(actual).to.equal(expected);
      })
    })
  })
});
