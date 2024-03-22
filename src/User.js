class User {
  constructor(obj, orgUnitPath='/members', domain='santacruzcountycycling.club') {
    this.orgUnitPath = orgUnitPath
    this.domain=domain
    this.generation_ = 0
    if (obj.primaryEmail === undefined){
      const txn = obj
      let givenName = txn['First Name'];
      let familyName = txn['Last Name'];
      let email = txn['Email Address'];
      let phone = txn['Phone Number'];
      const name = (givenName || familyName) ? { givenName, familyName } : undefined
      const primaryEmail = `${givenName}.${familyName}@${domain}`.toLowerCase()
      const Join_Date = new Date();
      phone = phone.startsWith('+1') ? phone : '+1' + phone
      const expiryDate = new Date()
      expiryDate.setFullYear(expiryDate.getFullYear() + 1)
      this.primaryEmail = primaryEmail
      this.name = name
      this.emails = [
        {
          "address": email,
          "type": "home"
        },
      ],
        this.phones = [
          {
            "value": phone,
            "type": "mobile"
          }
        ],
        this.customSchemas = {
          "Club_Membership": {
            "expires": this.convertToYYYYMMDDFormat_(expiryDate),
            Join_Date: this.convertToYYYYMMDDFormat_(Join_Date)
          }
        },
        this.orgUnitPath = this.orgUnitPath,
        this.recoveryEmail = email,
        this.recoveryPhone = phone
    } else {// Simply copy the values, deeply
      function deepCopy(v) { return v ? JSON.parse(JSON.stringify(v)) : ""}
      this.primaryEmail = JSON.parse(JSON.stringify(obj.primaryEmail)).toLowerCase()
      this.name = JSON.parse(JSON.stringify(obj.name))
      this.emails = JSON.parse(JSON.stringify(obj.emails))
      this.phones = JSON.parse(JSON.stringify(obj.phones))
      this.customSchemas = JSON.parse(JSON.stringify(obj.customSchemas))
      this.orgUnitPath = deepCopy(obj.orgUnitPath)
      this.recoveryEmail = deepCopy(obj.recoveryEmail)
      this.recoveryPhone = deepCopy(obj.recoveryPhone) 
    }
  }

  incrementGeneration() {
    this.generation_ += 1
    this.primaryEmail = `${this.name.givenName}.${this.name.familyName}${this.generation_}@${this.domain}` 
    return this
  }
  incrementExpirationDate() {
    let ed = new Date(this.customSchemas.Club_Membership.expires)
    ed.setFullYear(ed.getFullYear() + 1)
    this.customSchemas.Club_Membership.expires = this.convertToYYYYMMDDFormat_(ed)
    return this
  }
  convertToYYYYMMDDFormat_(date) {
    return new Date(date).toISOString().split('T')[0];
  }
}


// { isMailboxSetup: true,
//   primaryEmail: 'ron@${domain}',
//   kind: 'admin#directory#user',
//   emails: 
//    [ { type: 'work', address: 'ron.r.olson@gmail.com' },
//      { primary: true, address: 'ron@${domain}' } ],
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