
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
  function processPaidTransactions(transactions, membershipData) {

    const emailToMemberMap = new Map(membershipData.map((member, index) => [member.Email, index]));
    transactions.forEach(txn => {
      if (!txn.Processed && txn["Payable Status"].toLowerCase().startsWith("paid")) {
        const matchIndex = emailToMemberMap.get(txn["Email Address"]);
        if (matchIndex !== undefined) {
          const member = membershipData[matchIndex];
          const years = getPeriod_(txn);
          renewMember_(member, years);
        } else {
          const newMember = addNewMember_(txn)
          membershipData.push(newMember);
        }
        txn.Timestamp = today();
        txn.Processed = today();
      }
    })


  }



  function getPeriod_(txn) {
    if (!txn.Payment) { return 1; }
    const yearsMatch = txn.Payment.match(/(\d+)\s*year/);
    const years = yearsMatch ? parseInt(yearsMatch[1], 10) : 1;
    return years;
  }

  function addNewMember_(txn) {
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

    const result =  futureDate > futureExpirationDate ? futureDate : futureExpirationDate;
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
  };
})()

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Manager
}