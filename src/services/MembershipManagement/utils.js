
if (typeof require !== 'undefined') {
   MembershipManagement = { Utils: {} };
}


  /**
   * Logs messages to the console if the script property 'logging' is true.
   * @param  {...any} args - The messages or objects to log.
   */
  MembershipManagement.Utils.log = function(...args)  {
    const logging = PropertiesService.getScriptProperties().getProperty('logging') === 'true';
    if (logging) {
      console.log(...args);
    }
  };

  MembershipManagement.Utils.addDaysToDate = function(date, days = 0) {
    const result = this.dateOnly(date);
    result.setDate(result.getDate() + days);
    return result;
  };

  MembershipManagement.Utils.addYearsToDate = function(date, years = 0) {
    const result = this.dateOnly(date);
    result.setFullYear(result.getFullYear() + years);
    return result;
  };
  MembershipManagement.Utils.ActionType = {
    Join: 'Join',
    Renew: 'Renew',
    Migrate: 'Migrate',
    Expiry1: 'Expiry1',
    Expiry2: 'Expiry2',
    Expiry3: 'Expiry3',
    Expiry4: 'Expiry4'
  };

  

  MembershipManagement.Utils.toLocaleDateString = function(date) {
    return new Date(date).toLocaleDateString()
  };


  /**
   * Calculates the expiration date based on a reference date and an expiration period.
   *
   * @param {Date} referenceDate - The reference date to start from. (normaly set to today())
   * @param {Date} expires - The expiration date to compare against.
   * @param {number} [period=1] - The number of years to add to the later of the reference date or expiration date.
   * @returns {Date} The calculated expiration date.
   * @throws {Error} If no reference date or expiration date is provided.
   */
  MembershipManagement.Utils.calculateExpirationDate = function(referenceDate, expires, period = 1) {
    if (!referenceDate) throw new Error('No reference date provided')
    if (!expires) throw new Error('No expiration date provided')
    referenceDate = this.dateOnly(referenceDate)
    expires = this.dateOnly(expires)
    const startDate = referenceDate < expires ? expires : referenceDate
    const result = this.addYearsToDate(startDate, period);
    return result
  };





/**
     * Expands a template string by replacing placeholders with corresponding values from a row object.
     * Placeholders are in the format {key}, where key is a property name in the row object.
     * Date fields specified in the dateFields array are converted to local date strings.
     *
     * @param {string} template - The template string containing placeholders.
     * @param {Object} row - The object containing values to replace placeholders.
     * @returns {string} - The expanded template string with placeholders replaced by corresponding values.
     */
MembershipManagement.Utils.expandTemplate = function(template, row) {
  const dateFields = ["Scheduled On", "Expires", "Joined", "Renewed On"]; // Add the names of fields that should be treated as dates
  return template.replace(/{([^}]+)}/g, (_, key) => {
    let value = row[key];
    if (dateFields.includes(key)) {
      if (typeof value === 'string') {
        value = new Date(Date.parse(value));
      }

      value = this.dateOnly(value);
      return value.toLocaleDateString(); // Convert Date objects to local date and time string
    }
    return value || "";
  });
}

MembershipManagement.Utils.dateOnly = function(date)  {
  if (!date) date = new Date();
  if (typeof date === 'string') date = new Date(date);
  const dateOnly = new Date(date.toISOString().split('T')[0] + "T00:00:00");
  return dateOnly;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = MembershipManagement;
}