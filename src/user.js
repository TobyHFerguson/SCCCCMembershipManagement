class User {
  constructor(txn) {
    let givenName = txn['First Name'];
    let familyName = txn['Last Name'];
    let email = txn['Email Address'];
    let phone  = txn['Phone Number'];
    const name = (givenName || familyName) ? { givenName, familyName } : undefined
    const primaryEmail = `${givenName}.${familyName}@santacruzcountycycling.club`
    const orgUnitPath = "/members"
    const Join_Date = new Date();
    phone = phone.startsWith('+1') ? phone : '+1' + phone
    const expiryDate = new Date()
    expiryDate.setFullYear(expiryDate.getFullYear() + 1)

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
          "expires": expiryDate,
          Join_Date
        }
      },
      orgUnitPath,
      recoveryEmail: email,
      recoveryPhone: phone
    }
  }
  incrementExpirationDate() {
    let ed = new Date(this.object.customSchemas.Club_Membership.expires)
    ed.setFullYear(ed.getFullYear() + 1)
    this.object.customSchemas.Club_Membership.expires = ed
  }
  convertToYYYYMMDDFormat(date) {
    return new Date(date).toISOString().split('T')[0];
  }
  getObject() {
    const result = { ...this.object }
    result.customSchemas.Club_Membership.expires = this.convertToYYYYMMDDFormat(this.object.customSchemas.Club_Membership.expires)
    result.customSchemas.Club_Membership.Join_Date = this.convertToYYYYMMDDFormat(this.object.customSchemas.Club_Membership.Join_Date)
    return result
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