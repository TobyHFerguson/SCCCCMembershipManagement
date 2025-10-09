
if (typeof require !== 'undefined') {
  ElectionRegistrationService = {};
}

/**
 * Check if an email address belongs to an active club member.
 * This is a read-only operation that does not expose full member data.
 * 
 * @param {string} email - The email address to check
 * @returns {Object} - Object with isMember boolean property
 */
ElectionRegistrationService.isMember = function(email) {
  if (!email || typeof email !== 'string') {
    return { isMember: false };
  }
  
  email = email.toLowerCase().trim();
  const member = Common.Data.Access.getMember(email);
  
  // Only return whether the member exists and is active, no other data
  return { 
    isMember: !!(member && member.Status === 'Active')
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ElectionRegistrationService
  };
}
