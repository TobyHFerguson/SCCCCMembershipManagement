
const Utils = (function () {
  /**
   * Logs messages to the console if the script property 'logging' is true.
   * @param  {...any} args - The messages or objects to log.
   */
  function log(...args) {
    const logging = PropertiesService.getScriptProperties().getProperty('logging') === 'true';
    if (logging) {
      console.log(...args);
    }
  }

  /**
   * Adds a specified number of years and days to a given date.
   * @param {Date} date - The date to which years and days will be added.
   * @param {number} years - The number of years to add.
   * @param {number} days - The number of days to add.
   * @returns {string} - The new date with the years and days added.
   */
  function addToDate(date, years = 0, days = 0) {
    const newDate = new Date(date);
    newDate.setFullYear(newDate.getFullYear() + years);
    newDate.setDate(newDate.getDate() + days);
    return getDateString(newDate);
  }
  /**
   * Returns a new date with days added to it.
   * @param {Date} date 
   * @param {number} days 
   * @returns {Date}
   */
  function addDaysToDate(date, days = 0) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return getDateString(result);
  }
  /**
   * Adds a specified number of years to a given date.
   * @param {Date} [date=new Date()] - The date to which years will be added.
   * @param {number} [years=0] - The number of years to add.
   * @returns {Date} - The new date with the years added.
   */
  function addYearsToDate(date = new Date(), years = 0) {
    const newDate = new Date(date);
    newDate.setFullYear(newDate.getFullYear() + years);
    return getDateString(newDate);
  }

  /**
   * Returns a string representation of a given date with no time component.
   * @param {Date} [date=new Date()] - The date to convert to a string.
   * @returns {string} - The date string in 'YYYY-MM-DD' format.
   */
  function getDateString(date = new Date()) {
    date = new Date(date);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
    const futureDate = addToDate(today, period);

    if (!expires) {
      return futureDate;
    }

    const expirationDate = new Date(expires);
    const futureExpirationDate = addToDate(expirationDate, period);

    let result = futureDate > futureExpirationDate ? futureDate : futureExpirationDate;
    result = getDateString(result);
    return result;
  }
  return {
    log,
    addDaysToDate,
    addYearsToDate,
    getDateString,
    calculateExpirationDate: calculateExpirationDate
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Utils;
}