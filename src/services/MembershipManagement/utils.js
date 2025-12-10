
if (typeof require !== 'undefined') {
   // @ts-ignore - Utils object is populated below, this is just initialization for Node/Jest
   MembershipManagement = { Utils: {} };
}


  /**
   * Logs messages to the console if the script property 'logging' is true.
   * @param  {...any} args - The messages or objects to log.
   */
  MembershipManagement.Utils.log = function(...args)  {
    Common.Logger.info('MembershipManagement', ...args);
  };

  MembershipManagement.Utils.addDaysToDate = function(date, days = 0) {
    const result = MembershipManagement.Utils.dateOnly(date);
    result.setDate(result.getDate() + days);
    return result;
  };

  MembershipManagement.Utils.addYearsToDate = function(date, years = 0) {
    const result = MembershipManagement.Utils.dateOnly(date);
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
    referenceDate = MembershipManagement.Utils.dateOnly(referenceDate)
    expires = MembershipManagement.Utils.dateOnly(expires)
    const startDate = referenceDate < expires ? expires : referenceDate
    const result = MembershipManagement.Utils.addYearsToDate(startDate, period);
    return result
  };

/**
 * Compute the ISO timestamp for the next attempt using exponential backoff.
 * @param {number} attempts - number of attempts already made (1-based)
 * @param {number} [baseSeconds=60] - base delay in seconds for the first re-attempt
 * @param {number} [maxSeconds=86400] - maximum delay in seconds (defaults to 24h)
 * @returns {string} ISO timestamp for the next attempt
 */
MembershipManagement.Utils.computeNextAttemptAt = function(attempts, baseSeconds = 60, maxSeconds = 24 * 3600) {
  let a = Number(attempts) || 0;
  if (a < 1) a = 1;
  // exponential factor: attempt 1 -> 1, attempt 2 -> 2, attempt 3 -> 4, attempt 4 -> 8, ...
  const factor = Math.pow(2, a - 1);
  const seconds = Math.min(baseSeconds * factor, maxSeconds);
  return new Date(Date.now() + Math.round(seconds * 1000)).toISOString();
}

// Backward compatibility alias
MembershipManagement.Utils.computeNextRetryAt = MembershipManagement.Utils.computeNextAttemptAt;

/**
 * Convert an ISO timestamp string to a Date object for spreadsheet storage.
 * Empty strings remain empty strings (spreadsheet displays as blank).
 * When stored in a spreadsheet cell, the Date will display in the user's timezone.
 * @param {string} isoString - ISO timestamp string (e.g., "2025-11-21T10:30:00.000Z") or empty string
 * @returns {Date|string} Date object for spreadsheet storage, or empty string if input was empty
 */
MembershipManagement.Utils.isoToSpreadsheetDate = function(isoString) {
  if (!isoString || isoString === '') return '';
  return new Date(isoString);
}

/**
 * Convert a spreadsheet Date value to an ISO timestamp string for internal use.
 * Empty strings remain empty strings.
 * @param {Date|string|null|undefined} dateValue - Date object from spreadsheet or empty string
 * @returns {string} ISO timestamp string (e.g., "2025-11-21T10:30:00.000Z") or empty string
 */
MembershipManagement.Utils.spreadsheetDateToIso = function(dateValue) {
  if (!dateValue || dateValue === '') return '';
  if (dateValue instanceof Date) {
    return dateValue.toISOString();
  }
  // Handle case where spreadsheet might return string representation
  if (typeof dateValue === 'string') {
    const parsed = new Date(dateValue);
    return isNaN(parsed.getTime()) ? '' : parsed.toISOString();
  }
  return '';
}

/**
 * Convert FIFO items from ISO string dates (internal format) to spreadsheet Date objects.
 * Converts lastAttemptAt and nextAttemptAt fields.
 * @param {MembershipManagement.FIFOItem[]} items - Array of FIFO items with ISO string dates
 * @returns {MembershipManagement.FIFOItem[]} Array of FIFO items with Date objects for spreadsheet
 */
MembershipManagement.Utils.convertFIFOItemsToSpreadsheet = function(items) {
  return items.map(item => ({
    ...item,
    lastAttemptAt: MembershipManagement.Utils.isoToSpreadsheetDate(item.lastAttemptAt),
    nextAttemptAt: MembershipManagement.Utils.isoToSpreadsheetDate(item.nextAttemptAt)
  }));
}

/**
 * Convert FIFO items from spreadsheet Date objects to ISO strings (internal format).
 * Converts lastAttemptAt and nextAttemptAt fields.
 * @param {any[]} items - Array of FIFO items with spreadsheet Date objects
 * @returns {MembershipManagement.FIFOItem[]} Array of FIFO items with ISO string dates
 */
MembershipManagement.Utils.convertFIFOItemsFromSpreadsheet = function(items) {
  return items.map(item => ({
    ...item,
    lastAttemptAt: MembershipManagement.Utils.spreadsheetDateToIso(item.lastAttemptAt),
    nextAttemptAt: MembershipManagement.Utils.spreadsheetDateToIso(item.nextAttemptAt)
  }));
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
MembershipManagement.Utils.expandTemplate = function(template, row) {
  const dateFields = ["Scheduled On", "Expires", "Joined", "Renewed On"]; // Add the names of fields that should be treated as dates
  return template.replace(/{([^}]+)}/g, (_, key) => {
    let value = row[key];
    if (dateFields.includes(key)) {
      if (typeof value === 'string') {
        value = new Date(Date.parse(value));
      }

      value = MembershipManagement.Utils.dateOnly(value);
      return value.toLocaleDateString(); // Convert Date objects to local date and time string
    }
    return value || "";
  });
}

/**
 * 
 * @param {string | Date} date 
 * @returns {Date} a date object with the time set to 00:00:00
 */
MembershipManagement.Utils.dateOnly = function(date)  {
  if (!date) date = new Date();
  if (typeof date === 'string') date = new Date(date);
  const dateOnly = new Date(date.toISOString().split('T')[0] + "T00:00:00");
  return dateOnly;
}

/**
 * 
 * @param {Member} member 
 * @param {string} prefillFormTemplate 
 * @returns {Member} copy of member with Form key added whose value is the html link to the prefilled renewal form for this member
 */
MembershipManagement.Utils.addPrefillForm = function(member, prefillFormTemplate)  {
  const memberCopy = { ...member, Form: null }; // Create a shallow copy to avoid mutating the original member
  const memberAsQueryParams = Object.fromEntries(
    Object.entries(member).map(([k, v]) => [k, encodeURIComponent(v)])
  );
  const prefillFormUrl = MembershipManagement.Utils.expandTemplate(prefillFormTemplate, memberAsQueryParams);
  // Keep an HTML anchor for email bodies; the raw URL is redundant once the email body is built
  memberCopy.Form = `<a href="${prefillFormUrl}">renewal form</a>`;
  return memberCopy;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = MembershipManagement;
}