const MembershipFunctions = (() => {
  const internal = {}

  internal.getOrgUnitPath = (type) => { return type === "Board" ? "/privileged users" : "/members" }

  internal.getUserFiddler = () => {
    return bmPreFiddler.PreFiddler().getFiddler({
      id: null,
      sheetName: 'Users',
      createIfMissing: true
    })
  }

  internal.getTransactionsFiddler = () => {
    return bmPreFiddler.PreFiddler().getFiddler({
      id: null,
      sheetName: 'Transactions',
      createIfMissing: false
    })
  }

  internal.convertToYYYYMMDDFormat = (date) => {
    const offset = date.getTimezoneOffset();
    let myDate = new Date(date - (offset * 60 * 1000))
    return myDate.toISOString().split('T')[0];
  }

  /*
  Need to include this info for the user:
  Home email
  "emails": [
      {
        "address": "toby.h.ferguson@icloud.com",
        "type": "home"
      },
      {
        "address": "a.b@santacruzcountycycling.club",
        "primary": true
      }
    ],
  
  Mobile Phone
  
    "phones": [
      {
        "value": "+14083869343",
        "type": "mobile"
      }
    ],
  
  Expiry date
  
   "customSchemas": {
      "Club_Membership": {
        "expires": "2024-03-08",
        "Join_Date": "2024-02-01"
      }
    },
  See https://developers.google.com/admin-sdk/directory/reference/rest/v1/users/get to retrieve user objects and see how they're structured.
  A user object is defined: https://developers.google.com/admin-sdk/directory/reference/rest/v1/users#User 
  */
  internal.createUserObject = (primaryEmail, givenName, familyName, email, phone, joinDate = new Date(), orgUnitPath = "/members", expiryDate) => {
    phone += ""
    phone = phone.startsWith('+1') ? phone : '+1' + phone
    expiryDate = expiryDate ? expiryDate : new Date()
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);
    let name = (givenName || familyName) ? { givenName, familyName } : undefined
    return {
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
          "expires": internal.convertToYYYYMMDDFormat(expiryDate),
          "Join_Date": internal.convertToYYYYMMDDFormat(joinDate)
        }
      },
      orgUnitPath,
      recoveryEmail: email,
      recoveryPhone: phone
    }
  }

  internal.createUserFromTransaction = (txn, suffix = 0) => {
    suffix = suffix === 0 ? "" : "" + suffix
    return new Exports.User(`${txn["First Name"]}.${txn["Last Name"]}${suffix}@santacruzcountycycling.club`,
      txn["First Name"],
      txn["Last Name"],
      txn["Email Address"],
      txn["Phone Number"]
    )
  }
  internal.processMembershipUndecided = (member, txn) => {
    console.log("Partial match");
    console.log(`Member: ${member.primaryEmail} ${member.email} ${member.phone}`);
    console.log(`txn: ${txn['Email Address']} ${txn['Email Address']} ${txn['Phone Number']}`);
    txn.undecided = true;
  }

  internal.processMembershipRenew = (member, directory, internal, txn, processedDate) => {
    let expires = new Date(member.customSchemas.Club_Membership.expires);
    expires.setFullYear(expires.getFullYear() + 1);
    member.customSchemas.Club_Membership.expires = expires;
    try {
      directory.updateUser_(member, { customSchemas: { Club_Membership: { expires: internal.convertToYYYYMMDDFormat(expires) } } });
      txn.Processed = processedDate;
      console.log(`Member ${member.primaryEmail} has renewed until: ${member.customSchemas.Club_Membership.expires}`);
    } catch (err) {
      console.error(`Error while renewing member ${member.primaryEmail}: ${err.message}`);
      console.error(member);
    }
  }

  internal.processMembershipJoin = (directory, txn, internal) => {
    const join = (suffix) => {
      let user = internal.createUserFromTransaction(txn, suffix)
      try { directory.addUser_(user.getObject()) } catch (err) { console.error(user.getObject()); throw err }
      txn.Processed = new Date().toLocaleDateString()
    }
    let i = 0;
    while (true) {
      try {
        return join(i)
      } catch (err) {
        if (!err.message.endsWith('Entity already exists.')) {
          console.error(`Error while attempting to add new user from transaction ${txn}: ${err.message}`)
          throw err
        } else {
          i += 1
        }
      }
    }
  }

  /**
   * @function matchTransactionToMember - return a value depending on whether the transaction matches a member
   * @param {Transaction} transaction
   * @param {Member} member
   * @return {int} - -1 if partial match, 0 if no match, +1 if full match
   */
  internal.matchTransactionToMember = (txn, member) => {
    let homeEmails = member.emails.filter((e) => e.type === "home")
    let homeEmail = homeEmails[0].address
    let mobilePhone = (member.phones === undefined ? [{ value: null }] : member.phones).filter((p) => p.type === "mobile")[0].value
    let emailsMatch = homeEmail == txn["Email Address"]
    let phonesMatch = mobilePhone == txn["Phone Number"]
    return (emailsMatch && phonesMatch) ? 1 : (emailsMatch || phonesMatch) ? -1 : 0
  }
  /**
   * @typedef {Object} Transaction
   * @property {string} Timestamp - date of transaction
   * @property {string} Email Address - home address of user
   * @property {string} First Name
   * @property {string} Last Name
   * @property {string|Number} Phone Number - string will be E164 phone number; number needs to be converted
   * @property {string} Processed - date of processing - blank if not yet processed
   * @property {string} Payable Status - starts with 'paid' if transaction is paid
   * 
   */
  /**
   * 
   * @param {Transaction[]} transactions 
   * @param {Directory} directory 
   */
  const processPaidTransactions = (transactions, directory) => {
    let processedDate = new Date().toLocaleDateString();
    let members = directory.getAllUsers()

    // We filter only those transactions that have been paid and not processed
    let txns = transactions.filter((txn) => txn['Payable Status'].startsWith('paid') && !txn.Processed)
    // Now we step through the longer list (memberships), looking up a matching txn for each one, again making sure these are 
    // transactions that haven't yet been process.
    // If we find a txn then we update the Expires field of the member, and add the Processed timestamp to the corresponding txn
    members.forEach((member) => {
      txns.filter((txn) => txn['Payable Status'].startsWith('paid') && !txn.Processed).forEach((txn) => {
        let match = internal.matchTransactionToMember(txn, member)
        if (match === 1) { // Known member - renewal
          internal.processMembershipRenew(member, directory, internal, txn, processedDate);
        } else if (match === -1) { // problem with this user. Mark transaction for followup}
          internal.processMembershipUndecided(member, txn);
        }
      });
    });
    // Now we use any paid but unprocessed transactions which are not undecided to create new members, only adding them to the
    // spreadsheet iff they are successfully inserted into the org.
    let joinTxns = txns.filter((txn) => txn['Payable Status'].startsWith('paid') && !txn.Processed && !txn.undecided)
    joinTxns.forEach((txn) => {
      internal.processMembershipJoin(directory, txn, internal)
    })
    // For now just print out the errored users:
    txns.filter((txn) => txn['Payable Status'].startsWith('paid') && !txn.Processed && txn.undecided).forEach((txn) => {
      console.log("Txns which only partially matched")
      console.log(txn)
      delete txn.undecided
    }
    )
  }

  return {
    internal,
    processPaidTransactions
  }

})();


