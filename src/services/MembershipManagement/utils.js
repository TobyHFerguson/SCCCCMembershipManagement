
if (typeof require !== 'undefined') {
   // @ts-ignore - Utils object is populated below, this is just initialization for Node/Jest
   MembershipManagement = { Utils: {} };
}

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
 * @returns {Array<Record<string, any>>} Array of FIFO items with Date objects replacing ISO string timestamps for spreadsheet (JUSTIFIED: FIFOItem has string timestamps but spreadsheet version has Date objects; no SpreadsheetFIFOItem type exists)
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
     * @param {ValidatedMember | Record<string, any>} row - Member or object containing values to replace placeholders (JUSTIFIED: union needed for migration/legacy objects with dynamic columns)
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

/**
 * Build a PREFILL_FORM_TEMPLATE URL from a Google Forms pre-filled link.
 *
 * The operator obtains the pre-filled link by using the Form editor's
 * "Get pre-filled link" feature, typing the Members-sheet column names
 * (First, Last, Phone, Member ID) as the answers for the corresponding
 * form questions.
 *
 * This function:
 * 1. Finds entry parameters whose decoded values match those marker answers
 * 2. Replaces each marker value with the corresponding template field
 *    (e.g. First → {First})
 * 3. Drops every other entry parameter (static checkboxes, agreements, etc.)
 * 4. Returns the cleaned URL ready for PREFILL_FORM_TEMPLATE
 *
 * @param {string} prefillUrl - Pre-filled URL from Google Forms
 * @returns {string} Template URL with {First}, {Last}, {Phone}, {Member ID} placeholders
 * @throws {Error} If no entry parameters found or a required marker is missing
 */
MembershipManagement.Utils.buildPrefillFormTemplate = function(prefillUrl) {
  /** @type {Record<string, string>} */
  var MARKER_TO_TEMPLATE = {
    'First': '{First}',
    'Last': '{Last}',
    'Phone': '{Phone}',
    'Member ID': '{Member ID}'
  };

  var qIndex = prefillUrl.indexOf('?');
  if (qIndex === -1) {
    throw new Error('No entry parameters found in URL');
  }

  var baseUrl = prefillUrl.substring(0, qIndex);
  var queryString = prefillUrl.substring(qIndex + 1);
  var params = queryString.split('&');

  // Collect non-entry params (like usp=pp_url) and entry params separately
  /** @type {string[]} */
  var nonEntryParts = [];
  /** @type {{raw: string, entryKey: string, decodedValue: string}[]} */
  var entryParams = [];

  for (var i = 0; i < params.length; i++) {
    var param = params[i];
    if (param.startsWith('entry.')) {
      var eqIdx = param.indexOf('=');
      if (eqIdx !== -1) {
        var entryKey = param.substring(0, eqIdx);
        var rawValue = param.substring(eqIdx + 1);
        // Decode: handle both + (space) and %XX encoding
        var decoded = decodeURIComponent(rawValue.replace(/\+/g, ' '));
        entryParams.push({ raw: param, entryKey: entryKey, decodedValue: decoded });
      }
    } else {
      nonEntryParts.push(param);
    }
  }

  if (entryParams.length === 0) {
    throw new Error('No entry parameters found in URL');
  }

  // Match markers and build template entries in original URL order
  /** @type {string[]} */
  var templateParts = [];
  /** @type {Set<string>} */
  var foundMarkers = new Set();

  for (var j = 0; j < entryParams.length; j++) {
    var entry = entryParams[j];
    if (MARKER_TO_TEMPLATE.hasOwnProperty(entry.decodedValue)) {
      templateParts.push(entry.entryKey + '=' + MARKER_TO_TEMPLATE[entry.decodedValue]);
      foundMarkers.add(entry.decodedValue);
    }
    // Non-marker entries are silently dropped
  }

  // Verify all markers were found
  var markerNames = Object.keys(MARKER_TO_TEMPLATE);
  /** @type {string[]} */
  var missing = [];
  for (var k = 0; k < markerNames.length; k++) {
    if (!foundMarkers.has(markerNames[k])) {
      missing.push(markerNames[k]);
    }
  }
  if (missing.length > 0) {
    throw new Error('Missing marker answers in URL: ' + missing.join(', ') +
      '. When creating the pre-filled link, type these exact values as answers: First, Last, Phone, Member ID');
  }

  // Reassemble URL: base + non-entry params + template entries
  var allQueryParts = nonEntryParts.concat(templateParts);
  return baseUrl + '?' + allQueryParts.join('&');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = MembershipManagement;
}