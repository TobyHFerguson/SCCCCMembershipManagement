

const getUserFiddler_ = () => {
  return bmPreFiddler.PreFiddler().getFiddler({
    id: null,
    sheetName: 'Users',
    createIfMissing: true
  })
}

const getMembersFiddler_ = () => {
  return bmPreFiddler.PreFiddler().getFiddler({
    id: null,
    sheetName: 'MembershipReport',
    createIfMissing: true
  })
}
const getTransactionsFiddler_ = () => {
  return bmPreFiddler.PreFiddler().getFiddler({
    id: null,
    sheetName: 'Transactions',
    createIfMissing: false
  })
}

function convertToYYYYMMDDFormat(date) {
  const offset = date.getTimezoneOffset();
  let myDate = new Date(date - (offset * 60 * 1000))
  return myDate.toISOString().split('T')[0];
}
const memberFromTxn = (txn) => {
  const today = new Date();
  const expires = new Date();
  expires.setFullYear(today.getFullYear() + 1)
  const member = {
    Email: txn['Email Address'],
    First: txn['First Name'],
    Last: txn['Last Name'],
    Phone: `+1${txn['Phone Number']}`,
    Joined: today.toLocaleDateString(),
    Expires: convertToYYYYMMDDFormat(expires),
    OrgID: `${txn['First Name']}.${txn['Last Name']}@santacruzcountycycling.club`,
    Type: "Member"
  }
  return member
}

// Need to figure out best way to construct the original users.
// Need to include this info for the user:
// Home email
// "emails": [
//     {
//       "address": "toby.h.ferguson@icloud.com",
//       "type": "home"
//     },
//     {
//       "address": "a.b@santacruzcountycycling.club",
//       "primary": true
//     }
//   ],
//
// Mobile Phone
//
//   "phones": [
//     {
//       "value": "+14083869343",
//       "type": "mobile"
//     }
//   ],
//
// Expiry date
//
//  "customSchemas": {
//     "Club_Membership": {
//       "expires": "2024-03-08",
//       "Join_Date": "2024-02-01"
//     }
//   },
// See https://developers.google.com/admin-sdk/directory/reference/rest/v1/users/get to retrieve user objects and see how they're structured.
// A user object is defined: https://developers.google.com/admin-sdk/directory/reference/rest/v1/users#User
const createUserObject_ = (primaryEmail, givenName, familyName, email, phone, joinDate = new Date(), orgUnitPath = "/members", expiryDate) => {
  phone += ""
  phone = phone.startsWith('+1') ? phone : '+1'+phone
  expiryDate = expiryDate ? expiryDate : new Date()
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
        "expires": convertToYYYYMMDDFormat(expiryDate),
        "Join_Date": convertToYYYYMMDDFormat(joinDate)
      }
    },
    orgUnitPath,
    recoveryEmail: email,
    recoveryPhone: phone
  }
}

function createUserFromTransaction(txn, suffix="") {
  return createUserObject_(`${txn["First Name"]}.${txn["Last Name"]}${suffix}@santacruzcountycycling.club`,
    txn["First Name"],
    txn["Last Name"],
    txn["Email Address"],
    txn["Phone Number"]
  )
}
function testCreateUser() {
  let user = createUserObject_("J.K@santacruzcountycycling.club", "J", "K", "j.k@icloud.com", "+14083869343", "/members")
  addUser_(user)
}

/**
 * @matchTransactionToMember - return a value depending on whether the transaction matches a member
 * @return {int} - -1 if partial match, 0 if no match, +1 if full match
 */
function matchTransactionToMember(txn, member) {
  let homeEmails = member.emails.filter((e) => e.type === "home")
  let homeEmail = homeEmails[0].address
  let mobilePhone = (member.phones === undefined ? [{ value: null }] : member.phones).filter((p) => p.type === "mobile")[0].value
  let emailsMatch = homeEmail == txn["Email Address"]
  let phonesMatch = mobilePhone == txn["Phone Number"]
  return (emailsMatch && phonesMatch) ? 1 : (emailsMatch || phonesMatch) ? -1 : 0
}
const processPaidTransactions = () => {
  let processedDate = new Date().toLocaleDateString();
  // get all the transaction and membership data
  let members = getAllUsers()
  let transactionFiddler = getTransactionsFiddler_();

  // We filter only those transactions that have been paid and not processed
  let txns = transactionFiddler.getData().filter((txn) => txn['Payable Status'].startsWith('paid') && !txn.Processed)
  txns.forEach((t) => console.log(t))
  // Now we step through the longer list (memberships), looking up a matching txn for each one, again making sure these are 
  // transactions that haven't yet been process.
  // If we find a txn then we update the Expires field of the member, and add the Processed timestamp to the corresponding txn
  try {
    members.forEach((member) => {
      txns.filter((txn) => txn['Payable Status'].startsWith('paid') && !txn.Processed).forEach((txn) => {
        let match = matchTransactionToMember(txn, member)
        if (match === 1) { // Known member - renewal
          let expires = new Date(member.customSchemas.Club_Membership.expires)
          expires.setFullYear(expires.getFullYear() + 1);
          member.customSchemas.Club_Membership.expires = expires
          updateUser_(member, { customSchemas: { Club_Membership: { expires: convertToYYYYMMDDFormat(expires) } } })
          txn.Processed = processedDate
          console.log(`Member ${member.primaryEmail} has renewed until: ${member.customSchemas.Club_Membership.expires}`)
        } else if (match === -1) { // problem with this user. Mark transaction for followup}
          console.log("Partial match")
          console.log(`Member: ${member.primaryEmail} ${member.email} ${member.phone}`)
          console.log(`txn: ${txn['Email Address']} ${txn['Email Address']} ${txn['Phone Number']}`)
          txn.undecided = true
        }
      });
    });
  } catch (err) {
    console.error(`Error while renewing member ${member.primaryEmail}: ${err.message}`)
    console.error(member)
  }
  // Now we use any paid but unprocessed transactions which are not undecided to create new members, only adding them to the
  // spreadsheet iff they are successfully inserted into the org.
  let joinTxns = txns.filter((txn) => txn['Payable Status'].startsWith('paid') && !txn.Processed && !txn.undecided)
  joinTxns.forEach((txn) => {
    let user = createUserFromTransaction(txn)
    try {
      addUser_(user)
      txn.Processed = processedDate
    } catch (err) {
      if (!err.message.endsWith('Entity already exists.')) {
        console.error(`Error while attempting to add new user ${user.primaryEmail}: ${err.message}`)
        throw err
      } else {
        for (const x of Array(10).keys()) {
          user = createUserFromTransaction(txn, x+1)
          try {
            addUser_(user)
            txn.Processed = processedDate
            break
          } catch (e) {
            if (!e.message.endsWith('Entity already exists.')) {
              throw e
            } else {
              continue
            }
          }
        }
      }
    }
  })
  // For now just print out the errored users:
  txns.filter((txn) => txn['Payable Status'].startsWith('paid') && !txn.Processed && txn.undecided).forEach((txn) => {
    console.log("Txns which only partially matched")
    console.log(txn)
    delete txn.undecided
  }
  )

  // Now store the transactions - any that weren't processed will be tried again.
  transactionFiddler.dumpValues();

}

const createMembershipReport = () => {
  const membersFiddler = getMembersFiddler_();
  const members = getAllUsers();
  let reportMembers = members.filter((m) => m.orgUnitPath.startsWith('/members')).map((m) => {
    try {
      console.log(m)
      return {
        "primary": m.primaryEmail,
        "First": m.name.givenName,
        "Last": m.name.familyName,
        "Joined": m.customSchemas.Club_Membership.Join_Date,
        "Expires": m.customSchemas.Club_Membership.expires
      }
    } catch (err) {
      console.log(err.message)
      console.log(`error for member ${m}`)
    }
  })
  reportMembers.forEach((m) => console.log(m.primary))
  membersFiddler.setData(reportMembers);
  membersFiddler.dumpValues()
}
const printHeaders = () => {
  let x = getUserFiddler_().getHeaders()
  x
}


const printRow = (rowNum = 2) => {
  getUserFiddler_().filterRows((rows, properties) => properties.rowOffset === rowNum - 2).getData().forEach(v => console.log(v));

}

const readSheet = () => {
  getUserFiddler_().getData().forEach(v => console.log(v))
}

const getOrgUnitPath_ = (type) => { return type === "Board" ? "/privileged users" : "/members" }



const updateUsers = (rowNum) => {
  const membership = getUserFiddler_();
  membership.mapRows((row, properties) => {
    const thisRow = (rowNum === undefined) || (properties.rowOffset === rowNum - 2)
    if (!thisRow) return row;
    try {
      updateUser_(createUserObjectFromRow_(row))
      row.Timestamp = new Date().toLocaleDateString()
    } catch (err) {
      console.error(`${row.OrgID} could not be updated: ${err.message}`);
    }
    return row;
  });
}

const provisionUsers = () => {
  const membership = getUserFiddler_();
  membership.mapRows((row, properties) => {
    if (!row.Timestamp) {
      try {
        addUser_(createUserObjectFromRow_(row))
        row.Timestamp = new Date().toISOString()
      } catch (err) {
        console.error(`${row.OrgID} could not be created: ${err.message}`);
      }
    }
    return row;
  })
  membership.dumpValues();
}

const deleteUsers = (rowNum) => {
  getUserFiddler_().filterRows((row, properties) => {
    const thisRow = (rowNum === undefined) || (properties.rowOffset === rowNum - 2)
    console.log(`thisRow: ${thisRow}`)
    const action = row.Action.toLowerCase()
    console.log(`Delete row ${properties.rowOffset + 2}? ${thisRow && action === "delete"}`)
    if (!(thisRow && action === "delete")) return true;
    try {
      deleteUser_(createUserObjectFromRow_(row))
      return false; // Indicates that row should be deleted from membership
    }
    catch (err) {
      console.log(`Deletion of ${row.OrgID} Failed with error ${err.message}`)
    }
    return true;
  }).dumpValues()
}

const testUpdateUsers = () => updateUsers(2);
const testDeleteUsers = () => deleteUsers(2)



