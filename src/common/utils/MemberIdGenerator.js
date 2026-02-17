/**
 * MemberIdGenerator - Generates unique, human-readable Member IDs
 * 
 * Format: SC3-XXXXX (prefix + 5 random unambiguous alphanumeric characters)
 * Charset excludes: 0, O, I, L, 1 (easily confused characters)
 * 
 * Security: IDs are purely random — not derived from member data.
 * Cannot be guessed from member info, nor can member info be recovered.
 * 
 * Layer: Layer 1 Infrastructure (pure logic, no GAS dependencies)
 */

/**
 * MemberIdGenerator class using flat IIFE-wrapped pattern
 * @class
 */
var MemberIdGenerator = (function() {
  /** Unambiguous charset: uppercase + digits, excluding 0OIL1 */
  const CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const ID_LENGTH = 5;
  const PREFIX = 'SC3-';

  class MemberIdGenerator {
    /**
     * Generate a new Member ID not present in existingIds
     * @param {Set<string>|string[]} existingIds - Already-used IDs to avoid collision
     * @param {number} [maxAttempts=100] - Max generation attempts before throwing
     * @returns {string} New unique ID like 'SC3-A7K3M'
     * @throws {Error} If unable to generate unique ID after maxAttempts
     */
    static generate(existingIds, maxAttempts = 100) {
      // Convert array to Set for O(1) lookup if needed
      const existingSet = existingIds instanceof Set ? existingIds : new Set(existingIds);

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        // Build 5-character random string from CHARSET
        let randomPart = '';
        for (let i = 0; i < ID_LENGTH; i++) {
          const randomIndex = Math.floor(Math.random() * CHARSET.length);
          randomPart += CHARSET[randomIndex];
        }

        const newId = PREFIX + randomPart;

        // Check for collision
        if (!existingSet.has(newId)) {
          return newId;
        }
      }

      // Should never happen at club scale
      throw new Error(`Unable to generate unique Member ID after ${maxAttempts} attempts`);
    }

    /**
     * Validate a Member ID format (SC3- prefix + 5 chars from allowed charset)
     * @param {string} id - ID to validate
     * @returns {boolean} True if format is valid
     */
    static isValid(id) {
      if (typeof id !== 'string') {
        return false;
      }

      // Check format with regex: SC3- prefix + exactly 5 chars from CHARSET
      const pattern = /^SC3-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}$/;
      return pattern.test(id);
    }

    /**
     * Get the allowed charset (for testing/documentation)
     * @returns {string}
     */
    static get CHARSET() {
      return CHARSET;
    }

    /**
     * Get the prefix (for testing/documentation)
     * @returns {string}
     */
    static get PREFIX() {
      return PREFIX;
    }
  }

  return MemberIdGenerator;
})();

// CommonJS export for Jest testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MemberIdGenerator };
}
