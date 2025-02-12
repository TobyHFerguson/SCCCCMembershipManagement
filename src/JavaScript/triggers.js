
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
      expiry4Spec = _actionSpec.Expiry4;
      if (new Date(member.Expires) <= new Date(addDaysToDate_(today(), expiry4Spec.Offset))) {
        expiredMembers.push(member);
        groupEmails.forEach(group => groupRemoveFun(group.Email, member.Email));
        const message = {
          to: member.Email,
          subject: expandTemplate_(expiry4Spec.Subject, member),
          htmlBody: expandTemplate_(expiry4Spec.Body, member)
        }
        sendEmailFun(message);

        activeMembers.splice(i, 1);
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
  function processPaidTransactions(transactions, membershipData, groupAddFun, sendEmailFun) {

    const emailToMemberMap = new Map(membershipData.map((member, index) => [member.Email, index]));
    transactions.forEach(txn => {
      if (!txn.Processed && txn["Payable Status"].toLowerCase().startsWith("paid")) {
        const matchIndex = emailToMemberMap.get(txn["Email Address"]);
        if (matchIndex !== undefined) {
          const member = membershipData[matchIndex];
          const years = getPeriod_(txn);
          renewMember_(member, years);
          sendEmailFun({ Email: member.Email, Type: ActionType.Renew });
        } else {
          const newMember = getNewMember(txn)
          membershipData.push(newMember);
          groupAddFun(newMember.Email)
          sendEmailFun({ Email: newMember.Email, Type: ActionType.Join });
        }
        txn.Timestamp = today();
        txn.Processed = today();
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
  function expandTemplate_(template, row) {
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
    const futureDate = new Date(today());
    futureDate.setFullYear(futureDate.getFullYear() + period);

    if (!expires) {
      return getDateString(futureDate);
    }

    const expirationDate = new Date(expires);
    const futureExpirationDate = new Date(expirationDate);
    futureExpirationDate.setFullYear(futureExpirationDate.getFullYear() + period);

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
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }




  return {
    processPaidTransactions,
    ActionType,
    today,
    addDaysToDate_,
    calculateExpirationDate_,
    setToday,
    processExpirations,
    setGroupEmails,
  };
})()

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Manager
}