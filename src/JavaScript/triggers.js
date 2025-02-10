

/**
 * @enum {string}
 * @readonly
 * @property {string} Join - Represents a new member joining.
 * @property {string} Renew - Represents a member renewing their membership.
 * @property {string} Migrate - Represents a member migrating.
 * @property {string} Expiry1 - Represents the first expiry notification.
 * @property {string} Expiry2 - Represents the second expiry notification.
 * @property {string} Expiry3 - Represents the third expiry notification.
 * @property {string} Expiry4 - Represents the fourth expiry notification.
 */
const ActionType = {
  Join: 'Join',
  Renew: 'Renew',
  Migrate: 'Migrate',
  Expiry1: 'Expiry1',
  Expiry2: 'Expiry2',
  Expiry3: 'Expiry3',
  Expiry4: 'Expiry4'
};
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    processPaidTransactions_,
    createScheduleEntries_,
    ActionType,
    today,
    addDaysToDate_,
    addRenewedMemberToActionSchedule_,
    calculateExpirationDate_
  };
}

function today(date = new Date()) {
  return new Date().setHours(12, 0, 0, 0);
}

/**
 * Represents a transaction object.
 * @typedef {Object} Transaction
 * @property {string} Email Address - The email address associated with the transaction.
 * @property {string} First Name- The first name of the person associated with the transaction.
 * @property {string} Last Name - The last name of the person associated with the transaction.
 * @property {string} Payable Status - The status of the transaction (e.g., "paid").
 * @property {string} Payment - The payment details of the transaction. This is a string such as '1 year'.
 * @property {Date} Timestamp - The timestamp when the transaction was processed.
 */
/**
 * Represents a member object.
 * @typedef {Object} Member
 * @property {string} Email - The email address of the member.
 * @property {string} First - The first name of the member.
 * @property {string} Last - The last name of the member.
 * @property {Date} Joined - The date the member joined.
 * @property {number} Period - The membership period in years.
 * @property {Date} Expires - The expiration date of the membership.
 * @property {Date} [Renewed On] - The date the membership was last renewed.
 * @property {Date} [Migrated] - The date the member was migrated.
 */

/**
 * @typedef {Object} ActionSchedule
 * @property {Date} Date - The date of the action.
 * @property {string} Email - The member email concerned.
 * @property {ActionType} Type - The action to be taken.
 */

/**
 * Represents the specification linking an action type the corresponding email subject and body. The offset is the number of days relative to expiry to send the email. (negtive being before expiry, positive being after expiry)
 * A missing offset means the action is to be taken immediately.
 * @typedef {Object} ActionSpec
 * @property {ActionType} Type - The type of action.
 * @property {number} [Offset] - The offset in days from expiry for the action. No offset means immediate
 * @property {string} Subject - The subject of the email.
 * @property {string} Body - The body of the email.
 */
// Pure JavaScript functions
/**
 * Processes transaction data by updating membership information and handling email schedules. Always returns one empty row, thus ensuring that the headers aren't removed from the source spreadsheet
 *
 * @param {Array<Transaction>} transactions - Array of transaction objects.
 * @param {Array<Member>} membershipData - Array of membership data objects.
 * @param {Array<ActionSchedule>} actionSchedule - Array of email schedule data objects.
 * @param {Array<ActionSpec>} actionSpecs - Array of email schedule formula objects.
 * @param {Array<Object>} bulkGroupEmails - Array of bulk group email objects.
 * @returns {Object} An object containing processed rows and the updated transactions.
 * @returns {Array<Object>} return.processedRows - Array of processed transaction rows.
 * @returns {Array<Object>} return.result - Array of updated transactions.
 */
function processPaidTransactions_(transactions, membershipData, actionSchedule, actionSpecs) {
  
  const emailToMemberMap = new Map(membershipData.map((member, index) => [member.Email, index]));
  const newMembers = [];
  transactions.forEach(txn => {
    if (!txn.Processed  && txn["Payable Status"].toLowerCase().startsWith("paid")) {
      const matchIndex = emailToMemberMap.get(txn["Email Address"]);
      if (matchIndex !== undefined) {
        const member = membershipData[matchIndex];
        const years = getPeriod(txn);
        renewMember(member, years, actionSchedule, actionSpecs);
      } else {
        const newMember = addNewMember(txn, actionSchedule, actionSpecs, membershipData)
        newMembers.push(newMember.Email);
      }
      txn.Timestamp = new Date();
      txn.Processed = true;
    }
  })


  return newMembers;
}



function getPeriod(txn) {
  if (!txn.Payment) {return 1;}
  const yearsMatch = txn.Payment.match(/(\d+)\s*year/);
  const years = yearsMatch ? parseInt(yearsMatch[1], 10) : 1;
  return years;
}

function addNewMember(txn, actionSchedule, actionSpecs, membershipData) {
  const newMember = {
    Email: txn["Email Address"],
    First: txn["First Name"],
    Last: txn["Last Name"],
    Joined: new Date(),
    Period: getPeriod(txn),
    Expires: calculateExpirationDate_(getPeriod(txn)),
    "Renewed On": '',
  };
  membershipData.push(newMember);
  addNewMemberToActionSchedule_(newMember, actionSchedule, actionSpecs);
  return newMember
}

function addNewMemberToActionSchedule_(member, actionSchedule, actionSpecs) {
  const scheduleEntries = createScheduleEntries_(member, ActionType.Join, actionSpecs) ;
  actionSchedule.push(...scheduleEntries);
}

function addRenewedMemberToActionSchedule_(member, actionSchedule, actionSpecs) {
  const email = member.Email;
  removeEmails(email, actionSchedule);
  const scheduleEntries = createScheduleEntries_(member, ActionType.Renew, actionSpecs);
  actionSchedule.push(...scheduleEntries);
}

/**
 * Removes all objects from the data & formula arrays whose Email property matches the given email address.
 * @param {string} email - The email address to match.
 * @param {Array} actionSchedule - The array of objects.
 */
function removeEmails(email, actionSchedule) {
  for (let i = actionSchedule.length - 1; i >= 0; i--) {
    if (actionSchedule[i].Email === email) {
      actionSchedule.splice(i, 1);
    }
  }
}

/**
 * typedef {Object} ScheduleEntry
 * @property {Date} date - The date of the action.
 * @property {string} email - The member email concerned.
 * @property {ActionType} action - The action to be taken.
 */
function createScheduleEntries_(member, type, actionSpecs) {
  const scheduleEntries = [];
  switch (type) {
    case ActionType.Join:
    case ActionType.Renew:
      scheduleEntries.push({ Date: today(), Type: type, Email: member.Email });
    case 'Migration':
      break;
  }
  actionSpecs.filter(spec => spec.Type.startsWith('Expiry')).forEach((spec) => scheduleEntries.push({ Date: addDaysToDate_(member.Expires, spec.Offset), Type: spec.Type, Email: member.Email }));
  return scheduleEntries;
}

function addMemberToEmailSchedule(member, actionSchedule, actionSpecs, emailType) {
  const email = member.Email;
  const emailTypes = [emailType, 'Expiry 1', 'Expiry 2', 'Expiry 3', 'Expiry 4'];
  // These formulas all use the column heading to look up the value in the Membership sheet or the Emails sheet.
  // They are independent of row and column location, so rows and columns can be moved around without breaking the formulas.
  const joinLookupFormula = `=INDIRECT(ADDRESS(ROW(),XMATCH("Joined",$1:$1,0)))`
  const renewLookupFormula = `=INDIRECT(ADDRESS(ROW(),XMATCH("Renewed On",$1:$1,0)))`
  const membershipLookupFormula = `=INDEX(Membership!$A:$ZZZ,MATCH(INDIRECT(ADDRESS(ROW(),XMATCH("Email",$1:$1,0))),Membership!$A:$A,0),XMATCH(INDEX($1:$1,COLUMN()),Membership!$1:$1,0))`
  const emailLookupFormula = `=VLOOKUP(INDIRECT(ADDRESS(ROW(),XMATCH("Type",$1:$1,0))),Emails!$A$1:$C$7,XMATCH(INDEX($1:$1,COLUMN()),Emails!$1:$1,0),FALSE)`
  const scheduledOnLookupFormula = `=INDIRECT(ADDRESS(ROW(),XMATCH("Expires",$1:$1,0))) + VLOOKUP(INDIRECT(ADDRESS(ROW(),XMATCH("Type",$1:$1,0))),'Expiry Schedule'!$A:$B,2,FALSE)`
  const canonicalEntry = {
    "Scheduled On": scheduledOnLookupFormula,
    Type: '',
    Email: '',
    First: membershipLookupFormula,
    Last: membershipLookupFormula,
    Joined: membershipLookupFormula,
    Period: membershipLookupFormula,
    Expires: membershipLookupFormula,
    "Renewed On": membershipLookupFormula,
    Subject: emailLookupFormula,
    Body: emailLookupFormula
  }
  const logMessages = [];
  emailTypes.forEach(t => {
    const addOn = {
      Type: t,
      Email: email,
      ...(t === 'Join' ? { "Scheduled On": joinLookupFormula } : t === 'Renewal' ? { "Scheduled On": renewLookupFormula } : {}) // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax#spread_in_object_literals
    }
    const newEntry = {
      ...canonicalEntry,
      ...addOn
    };
    logMessages.push(`newEntry.Email: ${newEntry.Email}, newEntry.Type: ${newEntry.Type}, newEntry["Scheduled On"]: ${newEntry["Scheduled On"]}`);
    actionSchedule.push(newEntry);
    emailScheduleFormulas.push(newEntry);
  });
  log(logMessages.join('\n'));
}

/**
 * 
 * @param {*} member 
 * @param {number} period 
 * @param {} actionSchedule 
 */
function renewMember(member, period, actionSchedule, actionSpecs) {
  member.Period = period;
  member["Renewed On"] = new Date();
  member.Expires = calculateExpirationDate_(period, member.Expires);
  addRenewedMemberToActionSchedule_(member, actionSchedule, actionSpecs);
}

/**
 * Calculates an expiration date based on a period in years and an optional existing expiration date.
 * 
 * The value returned is the greater of period added to today or the existing expiration date.
 * @param {number} period - The period in years.
 * @param {Date} [expires] - the existing expiration date, if any
 * @returns {Date} - The expiration date
 */
function calculateExpirationDate_(period, expires) {
  const today = new Date();
  const futureDate = new Date(today);
  futureDate.setFullYear(futureDate.getFullYear() + period);

  if (!expires) {
    return futureDate;
  }

  const expirationDate = new Date(expires);
  const futureExpirationDate = new Date(expirationDate);
  futureExpirationDate.setFullYear(futureExpirationDate.getFullYear() + period);

  return futureDate > futureExpirationDate ? futureDate : futureExpirationDate;
}

/**
 * Returns a new date with days added to it.
 * @param {Date} date 
 * @param {number} days 
 * @returns {Date}
 */
function addDaysToDate_(date, days=0) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function sortArraysByValue(arr1, arr2, compareFn) {
  if (arr1.length !== arr2.length) {
    throw new Error("Both arrays must have the same length");
  }
  const combined = arr1.map((value, index) => ({ value, index }));
  combined.sort((a, b) => compareFn(a.value !== undefined ? a.value : a, b.value !== undefined ? b.value : b));
  const sortedArr1 = combined.map(item => item.value);
  const sortedArr2 = combined.map(item => arr2[item.index]);
  arr1.splice(0, arr1.length, ...sortedArr1);
  arr2.splice(0, arr2.length, ...sortedArr2);
}

/**
 * Combines two arrays of objects by merging the properties of objects at the same index.
 * If a property in the first array's object is an empty string or undefined, the property from the second array's object is used.
 * 
 * @param {Array<Object>} arr1 - The first array of objects.
 * @param {Array<Object>} arr2 - The second array of objects.
 * @returns {Array<Object>} A new array of objects with combined properties.
 * @throws {Error} If the lengths of the two arrays are not equal.
 */
function combineArrays(arr1, arr2) {
  if (arr1.length !== arr2.length) {
    throw new Error("Both arrays must have the same length");
  }

  return arr1.map((item, index) => {
    const combinedItem = { ...arr2[index] };
    for (const key in item) {
      if (item[key] !== "" && item[key] !== undefined) {
        combinedItem[key] = item[key];
      }
    }
    return combinedItem;
  });
}
