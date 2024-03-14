class User {
  constructor(primaryEmail, givenName, familyName, email, phone, joinDate = new Date(), orgUnitPath = "/members", expiryDate) {
    function convertToYYYYMMDDFormat(date) {
      const offset = date.getTimezoneOffset();
      let myDate = new Date(date - (offset * 60 * 1000))
      return myDate.toISOString().split('T')[0];
    }
    phone += ""
    phone = phone.startsWith('+1') ? phone : '+1' + phone
    expiryDate = expiryDate ? expiryDate : new Date()
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);
    let name = (givenName || familyName) ? { givenName, familyName } : undefined
    this.object = {
      primaryEmail,
      name,
      "emails": [
        {
          "address": email,
          "type": "home"
        },
      ],
      "phones": [
        {
          "value": phone,
          "type": "mobile"
        }
      ],
      "customSchemas": {
        "Club_Membership": {
          "expires": convertToYYYYMMDDFormat(expiryDate),
          "Join_Date": convertToYYYYMMDDFormat(joinDate)
        }
      },
      orgUnitPath,
      recoveryEmail: email,
      recoveryPhone: phone
    }
  }
  getObject() {
    return this.object
  }

}


// { isMailboxSetup: true,
//   primaryEmail: 'ron@santacruzcountycycling.club',
//   kind: 'admin#directory#user',
//   emails: 
//    [ { type: 'work', address: 'ron.r.olson@gmail.com' },
//      { primary: true, address: 'ron@santacruzcountycycling.club' } ],
//   lastLoginTime: '2024-02-02T23:54:59.000Z',
//   isEnrolledIn2Sv: false,
//   isAdmin: false,
//   customerId: 'C01meax52',
//   isDelegatedAdmin: false,
//   id: '106959647238571895652',
//   languages: [ { languageCode: 'en', preference: 'preferred' } ],
//   suspended: false,
//   includeInGlobalAddressList: true,
//   changePasswordAtNextLogin: false,
//   phones: [ { value: '4082183189', type: 'work' } ],
//   agreedToTerms: true,
//   orgUnitPath: '/members/board members',
//   name: { givenName: 'ron', familyName: 'olson', fullName: 'ron olson' },
//   ipWhitelisted: false,
//   customSchemas: { Club_Membership: { Join_Date: '2013-07-18', expires: '2025-12-31' } },
//   archived: false,
//   etag: '"BvGfkzKoKVD0NM7VdXdzkXDD-nHLkyMjheL_9Z5X0H0/JItoAr5SvcLf4KCOhE2m7oSIII8"',
//   isEnforcedIn2Sv: false,
//   creationTime: '2024-02-02T23:54:03.000Z' }