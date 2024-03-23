const MembershipFunctions = (() => {
  const internal = {}

  internal.getOrgUnitPath = (type) => { return type === "Board" ? "/privileged users" : "/members" }

  internal.getMemberFiddler = () => {
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
    date = new Date(date)
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
      directory.updateMember_(member, { customSchemas: { Club_Membership: { expires: internal.convertToYYYYMMDDFormat(expires) } } });
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
      try { directory.addUser_(user.getObject()) } catch (err) {
        if (!err.message.endsWith('Entity already exists.')) {
          console.error(`Error while attempting to add new user ${user.getObject()}`)
        };
        throw err
      }
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
    let result = (emailsMatch && phonesMatch) ? { full: true } : (emailsMatch || phonesMatch) ? { full: false } : false
    return result
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
  const processPaidTransactions = (transactions, members, join, renew, partial, matcher = internal.matchTransactionToMember,) => {
    // We filter only those transactions that have been paid and not processed
    let txns = transactions.filter((txn) => txn['Payable Status'].startsWith('paid') && !txn.Processed)

    // Now we step through the longer list (memberships), looking up a matching txn for each one, again making sure these are 
    // transactions that haven't yet been process.
    // If we find a txn then we update the Expires field of the member, and add the Processed timestamp to the corresponding txn
    txns.forEach((txn) => {
      let match = members.find((m) => matcher(txn, m)) // returns matched member, or undefined
      if (match) { //
        if (matcher(txn, match).full) {
          renew(txn, match)
        } else {
          partial(txn, match)
        }
      } else { // problem with this user. Mark transaction for followup}
        join(txn, match)
      }
    });
  }

  return {
    internal,
    processPaidTransactions
  }

})();


