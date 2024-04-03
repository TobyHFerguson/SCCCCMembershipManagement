import chai = require('chai');
import { Member } from '../src/Code';
import { UserType, Transaction, SystemConfiguration } from '../src/Types';
import exp = require('constants');
const expect = chai.expect;

describe('Member tests', () => {
    const join = Member.convertToYYYYMMDDFormat_(new Date());
    const expires = Member.convertToYYYYMMDDFormat_(Member.incrementDateByOneYear(join))
    const expected: UserType = {
        primaryEmail: 'given.family@santacruzcountycycling.club',
        name: { familyName: 'family', givenName: 'given', fullName: 'given family' },
        emails: [{ type: 'home', address: 'a@b.com' }, { address: 'given.family@santacruzcountycycling.club', primary: true}],
        phones: [{ type: 'mobile', value: '+1234' }],
        customSchemas: { Club_Membership: { expires: expires, Join_Date: join } },
        orgUnitPath: '/test',
        recoveryEmail: 'a@b.com',
        recoveryPhone: '+1234',
        includeInGlobalAddressList: true,
    }
    const sysConfig:SystemConfiguration = {
        orgUnitPath: "/test",
        domain: "santacruzcountycycling.club",
        groups: 'g@sccc.club'
    }
    it('should be able to be constructed from a Transaction', () => {
        const txn: Transaction = {
            "First Name": "given",
            "Last Name": "family",
            "Email Address": "a@b.com",
            "Phone Number": "+1234",
            "Payable Status": "paid",
            "Payable Transaction ID": "CC-TF-RNB6",
            "Payable Order ID": "1234",
            "Timestamp": "2024-03-29",
            "In Directory": true
        }
        const actual = new Member(txn, sysConfig);
        expect(actual).to.deep.equal({...expected, ...{generation: 0, domain: sysConfig.domain}});
    }
    )
})