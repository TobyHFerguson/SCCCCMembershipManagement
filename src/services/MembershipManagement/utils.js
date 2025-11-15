
if (typeof require !== 'undefined') {
  // When running under Node tests, ensure MembershipManagement exists.
  // We don't populate the full shape here; module.exports at file end will export MembershipManagement.
  global.MembershipManagement = global.MembershipManagement || { Utils: {} };
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

  // --- Canonical ISO date helpers ---
  // Internal canonical representation: "YYYY-MM-DD" strings.
  // toIsoDateString accepts a Date or a YYYY-MM-DD string and returns a canonical YYYY-MM-DD string
  MembershipManagement.Utils.toIsoDateString = function(dateLike) {
    if (!dateLike) {
      const now = new Date();
      const y = now.getUTCFullYear();
      const m = now.getUTCMonth() + 1;
      const d = now.getUTCDate();
      return `${y.toString().padStart(4,'0')}-${m.toString().padStart(2,'0')}-${d.toString().padStart(2,'0')}`;
    }
    if (typeof dateLike === 'string') {
      const isoMatch = dateLike.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (isoMatch) return dateLike;
      // Deterministic fallback: parse via Date and use UTC components
      const parsed = new Date(dateLike);
      if (isNaN(parsed.getTime())) throw new Error(`Invalid date string: ${dateLike}`);
      const y = parsed.getUTCFullYear();
      const m = parsed.getUTCMonth() + 1;
      const d = parsed.getUTCDate();
      return `${y.toString().padStart(4,'0')}-${m.toString().padStart(2,'0')}-${d.toString().padStart(2,'0')}`;
    }
    if (dateLike instanceof Date) {
      const y = dateLike.getUTCFullYear();
      const m = dateLike.getUTCMonth() + 1;
      const d = dateLike.getUTCDate();
      return `${y.toString().padStart(4,'0')}-${m.toString().padStart(2,'0')}-${d.toString().padStart(2,'0')}`;
    }
    // Last resort: coerce and recurse
    const coerced = new Date(dateLike);
    if (isNaN(coerced.getTime())) throw new Error(`Invalid dateLike: ${dateLike}`);
    return MembershipManagement.Utils.toIsoDateString(coerced);
  };

  // Convert ISO string YYYY-MM-DD to a UTC-midnight Date object
  MembershipManagement.Utils.isoToDate = function(iso) {
    if (!iso) return new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) throw new Error(`Invalid ISO date: ${iso}`);
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    return new Date(Date.UTC(y, mo, d));
  };

  // addDaysToDate/addYearsToDate operate on inputs that can be Date or ISO string and return ISO strings
  MembershipManagement.Utils.addDaysToDate = function(dateLike, days = 0) {
    const iso = this.toIsoDateString(dateLike);
    const baseDate = this.isoToDate(iso);
    const epochDays = Math.floor(baseDate.getTime() / 86400000) + Number(days);
    const resultDate = new Date(epochDays * 86400000);
    return this.toIsoDateString(resultDate);
  };

  MembershipManagement.Utils.addYearsToDate = function(dateLike, years = 0) {
    const iso = this.toIsoDateString(dateLike);
    const baseDate = this.isoToDate(iso);
    const y = baseDate.getUTCFullYear() + Number(years);
    const mo = baseDate.getUTCMonth();
    const d = baseDate.getUTCDate();
    // Construct in UTC to avoid timezone shifts
    const resultDate = new Date(Date.UTC(y, mo, d));
    return this.toIsoDateString(resultDate);
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
    // Accept ISO date strings or Date objects and return a locale date string
    try {
      const d = (typeof date === 'string') ? MembershipManagement.Utils.isoToDate(date) : new Date(date);
      return d.toLocaleDateString();
    } catch (e) {
      return '' + date;
    }
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
    // Work in canonical ISO strings so comparisons are deterministic
    referenceDate = this.toIsoDateString(referenceDate)
    expires = this.toIsoDateString(expires)
    const startDate = (referenceDate < expires) ? expires : referenceDate
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
      // Accept ISO strings or Date objects. Convert to ISO then to a locale string for display.
      try {
        const iso = this.toIsoDateString(value);
        const d = this.isoToDate(iso);
        return d.toLocaleDateString();
      } catch (e) {
        return value || '';
      }
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
  memberCopy.Form = `<a href="${prefillFormUrl}">renewal form</a>`;
  return memberCopy;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = MembershipManagement;
}