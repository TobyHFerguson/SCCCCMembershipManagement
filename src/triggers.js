



// Pure JavaScript functions
/**
 * Processes transaction data by updating membership information and handling email schedules. Always returns one empty row, thus ensuring that the headers aren't removed from the source spreadsheet
 *
 * @param {Array<Object>} transactions - Array of transaction objects.
 * @param {Array<Object>} membershipData - Array of membership data objects.
 * @param {Array<Object>} emailScheduleData - Array of email schedule data objects.
 * @param {Array<Object>} emailScheduleFormulas - Array of email schedule formula objects.
 * @param {Array<Object>} bulkGroupEmails - Array of bulk group email objects.
 * @returns {Object} An object containing processed rows and the updated transactions.
 * @returns {Array<Object>} return.processedRows - Array of processed transaction rows.
 * @returns {Array<Object>} return.result - Array of updated transactions.
 */
function processTransactionsData(transactions, membershipData, emailScheduleData, emailScheduleFormulas, bulkGroupEmails) {
  const headerRow = Object.keys(transactions[0]).reduce((acc, key) => {
    acc[key] = '';
    return acc;
  }, {});
  const emailToMemberMap = new Map(membershipData.map((member, index) => [member.Email, index]));
  const processedRows = [];
  for (let i = transactions.length - 1; i >= 0; i--) {
    const row = transactions[i];
    if (row["Payable Status"].toLowerCase().startsWith("paid")) {
      const matchIndex = emailToMemberMap.get(row["Email Address"]);
      if (matchIndex !== undefined) {
        const member = membershipData[matchIndex];
        const years = getPeriod(row);
        renewMember(member, years, emailScheduleData, emailScheduleFormulas);
      } else {
        addNewMember(row, emailScheduleData, emailScheduleFormulas, membershipData, bulkGroupEmails);
      }
      row.Timestamp = new Date();
      processedRows.push(row);
      transactions.splice(i, 1);
    }
  }
  const updatedTransactions = transactions.length === 0 ? [headerRow] : transactions;

  return { processedRows, updatedTransactions };
}



function getPeriod(row) {
  const yearsMatch = row.Payment.match(/(\d+)\s*year/);
  const years = yearsMatch ? parseInt(yearsMatch[1], 10) : 1;
  return years;
}

function addNewMember(row, emailScheduleData, emailScheduleFormulas, membershipData, bulkGroupEmails) {
  const newMember = {
    Email: row["Email Address"],
    First: row["First Name"],
    Last: row["Last Name"],
    Joined: new Date(),
    Period: getPeriod(row),
    Expires: calculateExpirationDate(getPeriod(row)),
    "Renewed On": '',
  };
  membershipData.push(newMember);
  addNewMemberToEmailSchedule(newMember, emailScheduleData, emailScheduleFormulas);
  addNewMemberToBulkGroups(bulkGroupEmails, newMember);
}

// JavaScript function
function addNewMemberToBulkGroups(bulkGroupEmails, newMember) {
  getGroupEmails_().forEach((groupEmail) => {
    bulkGroupEmails.push({
      "Group Email [Required]": groupEmail,
      "Member Email": newMember.Email,
      "Member Type": "USER",
      "Member Role": "MEMBER"
    });
  });
}

function addNewMemberToEmailSchedule(member, emailScheduleData, emailScheduleFormulas) {
  addMemberToEmailSchedule(member, emailScheduleData, emailScheduleFormulas, 'Join');
}

function addRenewedMemberToEmailSchedule(member, emailScheduleData, emailScheduleFormulas) {
  const email = member.Email;
  removeEmails(email, emailScheduleData, emailScheduleFormulas);
  addMemberToEmailSchedule(member, emailScheduleData, emailScheduleFormulas, 'Renewal');
}

/**
 * Removes all objects from the data & formula arrays whose Email property matches the given email address.
 * @param {string} email - The email address to match.
 * @param {Array} emailScheduleData - The array of objects.
 */
function removeEmails(email, emailScheduleData, emailScheduleFormulas) {
  for (let i = emailScheduleData.length - 1; i >= 0; i--) {
    if (emailScheduleData[i].Email === email) {
      emailScheduleData.splice(i, 1);
      emailScheduleFormulas.splice(i, 1);
    }
  }
}

function addMemberToEmailSchedule(member, emailScheduleData, emailScheduleFormulas, emailType) {
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
    emailScheduleData.push(newEntry);
    emailScheduleFormulas.push(newEntry);
  });
  log(logMessages.join('\n'));
}

/**
 * 
 * @param {*} member 
 * @param {number} period 
 * @param {} emailScheduleData 
 */
function renewMember(member, period, emailScheduleData, emailScheduleFormulas) {
  member.Period = period;
  member["Renewed On"] = new Date();
  member.Expires = calculateExpirationDate(period, member.Expires);
  addRenewedMemberToEmailSchedule(member, emailScheduleData, emailScheduleFormulas);
}

/**
 * Calculates an expiration date based on a period in years and an optional existing expiration date.
 * 
 * The value returned is the greater of period added to today or the existing expiration date.
 * @param {number} period - The period in years.
 * @param {Date} [expires] - the existing expiration date, if any
 * @returns {Date} - The expiration date
 */
function calculateExpirationDate(period, expires) {
  const today = new Date();
  const futureDate = new Date(today.setFullYear(today.getFullYear() + period));

  if (!expires) {
    return futureDate;
  }

  const expirationDate = new Date(expires);
  const futureExpirationDate = new Date(expirationDate.setFullYear(expirationDate.getFullYear() + period));

  return futureDate > futureExpirationDate ? futureDate : futureExpirationDate;
}

/**
 * Returns a new date with days added to it.
 * @param {Date} date 
 * @param {number} days 
 * @returns {Date}
 */
function addDaysToDate(date, days) {
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
