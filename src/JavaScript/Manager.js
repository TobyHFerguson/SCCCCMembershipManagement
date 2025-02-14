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



  function processExpirations(activeMembers, expiredMembers, actionSchedule, actionSpec, groupRemoveFun, sendEmailFun, groupEmails) {
    const actionSpecByType = Object.fromEntries(actionSpec.map(spec => [spec.Type, spec]));
    if (!actionSchedule || !Array.isArray(actionSchedule)) {
      return 0;
    }
    let numProcessed = 0
    let membersToBeRemoved = []
    for (i = actionSchedule.length - 1; i >= 0; i--) {
      const sched = actionSchedule[i];
      const spec = actionSpecByType[sched.Type];
      const tdy = today();
      const schedDate = getDateString(sched.Date);
      if (schedDate <= tdy) {
        let idx = activeMembers.findIndex(member => member.Email === sched.Email);
        if (idx != -1) {
          let member = activeMembers[idx];
          if (sched.Type === ActionType.Expiry4) {
            expiredMembers.push(member);
            membersToBeRemoved.push(idx);
            groupEmails.forEach(group => groupRemoveFun(group.Email, member.Email));
          }
          let message = {
            to: member.Email,
            subject: expandTemplate(spec.Subject, member),
            htmlBody: expandTemplate(spec.Body, member)
          }
          actionSchedule.splice(i, 1);
          sendEmailFun(message);
          numProcessed++;
        }
      }
    }
    membersToBeRemoved.sort((a, b) => b - a).forEach(idx => activeMembers.splice(idx, 1));
    return numProcessed
  }

  function migrateCEMembers(migrators, activeMembers, actionSchedule, actionSpecs, groupAddFun, sendEmailFun, groupEmails) {
    const actionSpec = actionSpecs.find(as => as.Type === ActionType.Migrate)

    migrators.forEach((m, i) => {
      if (!m.Migrated) {
        console.log(`Migrating ${m.Email}, row ${i+2}`)
        m.Migrated = today()
        activeMembers.push(m)
        actionSchedule.push(...createScheduleEntries_(m, actionSpecs))
        groupEmails.forEach(g => groupAddFun(g.Email, m.Email))
        let message = {
          to: m.Email,
          subject: expandTemplate(actionSpec.Subject, m),
          htmlBody: expandTemplate(actionSpec.Body, m)
        }
        sendEmailFun(message)
        console.log(`Migrated ${m.Email}, row ${i+2}`)
      }
    })
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
  function processPaidTransactions(transactions, membershipData, groupAddFun, sendEmailFun, actionSpecs, actionSchedule, groupEmails) {
    if (!transactions || !transactions.length || !Array.isArray(actionSpecs)) return;

    let _actionSpec = Object.fromEntries(actionSpecs.map(spec => [spec.Type, spec]));

    const emailToMemberMap = membershipData.length ? Object.fromEntries(membershipData.map((member, index) => [member.Email, index])) : {};
    const errors = [];
    transactions.forEach((txn, i) => {
      try {
        if (!txn.Processed && txn["Payable Status"].toLowerCase().startsWith("paid")) {
          const matchIndex = emailToMemberMap[txn["Email Address"]];
          let message;
          if (matchIndex !== undefined) { // a renewing member
            console.log(`transaction on row ${i + 2} ${txn["Email Address"]} is a renewing member`)
            const member = membershipData[matchIndex];
            const years = getPeriod_(txn);
            renewMember_(member, years, actionSchedule, actionSpecs);
            message = {
              to: member.Email,
              subject: expandTemplate(_actionSpec.Renew.Subject, member),
              htmlBody: expandTemplate(_actionSpec.Renew.Body, member)
            };
          } else { // a joining member
            console.log(`transaction on row ${i + 2} ${txn["Email Address"]} is a new member`)
            const newMember = addNewMember_(txn, actionSchedule, actionSpecs, membershipData);
            groupEmails.forEach(g => groupAddFun(newMember.Email, g.Email));
            message = {
              to: newMember.Email,
              subject: expandTemplate(_actionSpec.Join.Subject, newMember),
              htmlBody: expandTemplate(_actionSpec.Join.Body, newMember)
            };
          }
          sendEmailFun(message);
          txn.Timestamp = today();
          txn.Processed = today();
        }
      } catch (error) {
        error.txnNum = i + 2;
        error.email = txn["Email Address"];
        errors.push(error);
      }
    });

    if (errors.length > 0) {
      throw new AggregateError(errors, 'Errors occurred while processing transactions');
    }
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




  /**
   * 
   * @param {*} member 
   * @param {number} period 
   * @param {} actionSchedule 
   */
  function renewMember_(member, period, actionSchedule, actionSpecs) {
    member.Period = period;
    member["Renewed On"] = today();
    member.Expires = calculateExpirationDate(period, member.Expires);
    addRenewedMemberToActionSchedule_(member, actionSchedule, actionSpecs);
  }

  function addRenewedMemberToActionSchedule_(member, actionSchedule, actionSpecs) {
    const email = member.Email;
    removeEmails_(email, actionSchedule);
    const scheduleEntries = createScheduleEntries_(member, actionSpecs);
    actionSchedule.push(...scheduleEntries);
  }

  function createScheduleEntries_(member, actionSpecs) {
    const scheduleEntries = [];
    actionSpecs.filter(spec => spec.Type.startsWith('Expiry')).forEach((spec) => scheduleEntries.push({ Date: addDaysToDate(member.Expires, spec.Offset), Type: spec.Type, Email: member.Email }));
    return scheduleEntries;
  }
  /**
   * Removes all objects from the data & formula arrays whose Email property matches the given email address.
   * @param {string} email - The email address to match.
   * @param {Array} actionSchedule - The array of objects.
   */
  function removeEmails_(email, actionSchedule) {
    for (let i = actionSchedule.length - 1; i >= 0; i--) {
      if (actionSchedule[i].Email === email) {
        actionSchedule.splice(i, 1);
      }
    }
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

  function addNewMember_(txn, actionSchedule, actionSpecs, membershipData) {
    const newMember = {
      Email: txn["Email Address"],
      First: txn["First Name"],
      Last: txn["Last Name"],
      Phone: txn.Phone || '',
      Joined: today(),
      Period: getPeriod_(txn),
      Expires: calculateExpirationDate(getPeriod_(txn)),
      "Renewed On": '',
    };
    membershipData.push(newMember);
    addNewMemberToActionSchedule_(newMember, actionSchedule, actionSpecs);
    return newMember
  }

  function addNewMemberToActionSchedule_(member, actionSchedule, actionSpecs) {
    const scheduleEntries = createScheduleEntries_(member, actionSpecs);
    actionSchedule.push(...scheduleEntries);
  }
  /**
   * Returns a new date with days added to it.
   * @param {Date} date 
   * @param {number} days 
   * @returns {Date}
   */
  function addDaysToDate(date, days = 0) {
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

  function fun(arg) {
    if (arg === 'help') {
      console.log('help');
    } else if (arg === 'other') {
      console.log('other');
    }
  }


  return {
    migrateCEMembers,
    fun,
    processPaidTransactions,
    ActionType,
    today,
    addDaysToDate,
    addYearsToDate,
    calculateExpirationDate,
    setToday,
    processExpirations,
    setGroupEmails,
    expandTemplate,
    addRenewedMemberToActionSchedule_
  };
})()

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Manager
}