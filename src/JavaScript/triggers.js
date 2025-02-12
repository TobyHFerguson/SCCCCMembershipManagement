const Manager = (function () {
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
  function getDateString(date = new Date()) {
    return new Date(date).toISOString().split('T')[0];
  }
  let _today = getDateString();
  function setToday(date) {
    _today = getDateString(date);
  }
  function today() {
    return _today;
  }
  let _groupEmails;
  function setGroupEmails(groupEmails) {
    _groupEmails = groupEmails;
  }



  function processExpirations(activeMembers, expiredMembers, actionSpecs, groupRemoveFun, sendEmailFun, groupEmails) {
    let _actionSpec = Object.fromEntries(actionSpecs.map(spec => [spec.Type, spec]));
    
    
    let numProcessed = 0;
    for (let i = activeMembers.length - 1; i >= 0; i--) {
      const member = activeMembers[i];
      const expires = new Date(member.Expires + 'T00:00:00Z'); // Ensure UTC
      expiry4Spec = _actionSpec.Expiry4;
      const expiry1Date = addDaysToDate_(expires, +_actionSpec.Expiry1.Offset);
      const expiry2Date = addDaysToDate_(expires, +_actionSpec.Expiry2.Offset);
      const expiry3Date = addDaysToDate_(expires, +_actionSpec.Expiry3.Offset);
      const expiry4Date = addDaysToDate_(expires, +_actionSpec.Expiry4.Offset);
      const tdy = new Date(today())
      let message;
      if (tdy >= new Date(expiry4Date)) {
        expiredMembers.push(member);
        activeMembers.splice(i, 1);
        groupEmails.forEach(group => groupRemoveFun(group.Email, member.Email));
        message = {
          to: member.Email,
          subject: expandTemplate(expiry4Spec.Subject, member),
          htmlBody: expandTemplate(expiry4Spec.Body, member)
        }
      } else if (tdy >= expiry3Date) {
        const expiry3Spec = _actionSpec.Expiry3;
        message = {
          to: member.Email,
          subject: expandTemplate(expiry3Spec.Subject, member),
          htmlBody: expandTemplate(expiry3Spec.Body, member)
        }
      } else if (tdy >= expiry2Date) {
        const expiry2Spec = _actionSpec.Expiry2;
        message = {
          to: member.Email,
          subject: expandTemplate(expiry2Spec.Subject, member),
          htmlBody: expandTemplate(expiry2Spec.Body, member)
        }
      } else if (tdy >= expiry1Date) {
        const expiry1Spec = _actionSpec.Expiry1;
        message = {
          to: member.Email,
          subject: expandTemplate(expiry1Spec.Subject, member),
          htmlBody: expandTemplate(expiry1Spec.Body, member)
        }
      }
      if (message) {
        sendEmailFun(message);
        numProcessed++
    }
  }
  return numProcessed
}
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
  function processPaidTransactions(transactions, membershipData, groupAddFun, sendEmailFun, actionSpecs) {
    if (!transactions || !transactions.length || !Array.isArray(actionSpecs)) return;

    let _actionSpec = Object.fromEntries(actionSpecs.map(spec => [spec.Type, spec]));

  const emailToMemberMap = membershipData.length ? Object.fromEntries(membershipData.map((member, index) => [member.Email, index])) : {};
  transactions.forEach(txn => {
    if (!txn.Processed && txn["Payable Status"].toLowerCase().startsWith("paid")) {
      const matchIndex = emailToMemberMap[txn["Email Address"]];
      let message
      if (matchIndex !== undefined) { // a renewing member
        const member = membershipData[matchIndex];
        const years = getPeriod_(txn);
        renewMember_(member, years);
        message = {
          to: member.Email,
          subject: expandTemplate(_actionSpec.Renew.Subject, member),
          htmlBody: expandTemplate(_actionSpec.Renew.Body, member)
        }
      } else { // a joining member
        const newMember = getNewMember(txn)
        membershipData.push(newMember);
        groupAddFun(newMember.Email)
        message = {
          to: newMember.Email,
          subject: expandTemplate(_actionSpec.Join.Subject, newMember),
          htmlBody: expandTemplate(_actionSpec.Join.Body, newMember)
        }
      }
      txn.Timestamp = today();
      txn.Processed = today();
      sendEmailFun(message);
    }
  })


}

/**
 * Expands a template string by replacing placeholders with corresponding values from a row object.
 * Placeholders are in the format {key}, where key is a property name in the row object.
 * Date fields specified in the dateFields array are converted to local date strings.
 *
 * @param {string} template - The template string containing placeholders.
 * @param {Object} row - The object containing values to replace placeholders.
 * @returns {string} - The expanded template string with placeholders replaced by corresponding values.
 */
function expandTemplate(template, row) {
  const dateFields = ["Scheduled On", "Expires", "Joined", "Renewed On"]; // Add the names of fields that should be treated as dates
  return template.replace(/{([^}]+)}/g, (_, key) => {
    let value = row[key];
    if (dateFields.includes(key)) {
      value = new Date(value); // Convert to Date object if it's a date field
      return value.toLocaleDateString(); // Convert Date objects to local date string
    }
    return value || "";
  });
};

function getPeriod_(txn) {
  if (!txn.Payment) { return 1; }
  const yearsMatch = txn.Payment.match(/(\d+)\s*year/);
  const years = yearsMatch ? parseInt(yearsMatch[1], 10) : 1;
  return years;
}

function getNewMember(txn) {
  const newMember = {
    Email: txn["Email Address"],
    First: txn["First Name"],
    Last: txn["Last Name"],
    Joined: today(),
    Period: getPeriod_(txn),
    Expires: calculateExpirationDate_(getPeriod_(txn)),
    "Renewed On": '',
  };

  return newMember
}


/**
 * 
 * @param {*} member 
 * @param {number} period 
 * @param {} actionSchedule 
 */
function renewMember_(member, period) {
  member.Period = period;
  member["Renewed On"] = today();
  member.Expires = calculateExpirationDate_(period, member.Expires);

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
  const futureDate = new Date(today() + 'T00:00:00Z'); // Ensure UTC
  futureDate.setUTCFullYear(futureDate.getUTCFullYear() + period);

  if (!expires) {
    return getDateString(futureDate);
  }

  const expirationDate = new Date(Date.parse(expires + 'T00:00:00Z') || expires); // Ensure UTC
  const futureExpirationDate = new Date(expirationDate);
  futureExpirationDate.setUTCFullYear(futureExpirationDate.getUTCFullYear() + period);

  const result = futureDate > futureExpirationDate ? futureDate : futureExpirationDate;
  return getDateString(result);
}

/**
 * Returns a new date with days added to it.
 * @param {Date} date 
 * @param {number} days 
 * @returns {Date}
 */
function addDaysToDate_(date, days = 0) {
  const result = new Date(date); // Ensure UTC
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/**
 * Returns a new date with years added to it.
 * @param {Date} date 
 * @param {number} years 
 * @returns {Date}
 */
function addYearsToDate(date, years = 0) {
  const result = new Date(date); // Ensure UTC
  result.setUTCFullYear(result.getUTCFullYear() + years);
  return result;
}



return {
  processPaidTransactions,
  ActionType,
  today,
  addDaysToDate_,
  addYearsToDate,
  calculateExpirationDate_,
  setToday,
  processExpirations,
  setGroupEmails,
  expandTemplate
};
}) ()

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Manager
}