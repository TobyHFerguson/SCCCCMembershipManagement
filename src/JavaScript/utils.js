
const utils = (function() {

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

  function getDateString(date = new Date()) {
    return new Date(date).toISOString().split('T')[0];
  }

  function addDaysToDate(date, days = 0) {
    const result = new Date(date); // Ensure UTC
    result.setUTCDate(result.getUTCDate() + days);
    return result;
  }

  function addYearsToDate(date, years = 0) {
    const result = new Date(date); // Ensure UTC
    result.setUTCFullYear(result.getUTCFullYear() + years);
    return result;
  }
  const ActionType = {
    Join: 'Join',
    Renew: 'Renew',
    Migrate: 'Migrate',
    Expiry1: 'Expiry1',
    Expiry2: 'Expiry2',
    Expiry3: 'Expiry3',
    Expiry4: 'Expiry4'
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

  
  return {
    log,
    getDateString,
    ActionType,
    addDaysToDate,
    addYearsToDate,
    expandTemplate
  };
  
})();
if (typeof module !== 'undefined' && module.exports) {
  module.exports = utils
}