
const PREFILLED_URL_COLUMN_NAME = 'Pre-filled Form URL';
const VOTE_TITLE_COLUMN_NAME = 'Vote Title';
const FORM_ID_COLUMN_NAME = 'Form ID';
const RESULTS_RECIPIENT_COLUMN_NAME = 'Results Recipient(s)'; // Can be comma-separated
const TRIGGER_STATUS_COLUMN_NAME = 'Trigger Status';
const VOTE_DATA_SHEET_ID = '1FN1vogIDDWdqghflOF6hNuDDW1cqFQpSGX8GhXLYyyw'; // Replace with your central vote data sheet ID
const REGISTRATION_SHEET_NAME = 'Vote Registrations'; // Update with your sheet name
const TOKEN_ENTRY_FIELD_TITLE = 'Your Voting Token'; // Adjust

// Helper to extract components from the pre-filled URL (used by handleSheetEdit and renderVotingOptions)
VotingService.parsePrefilledFormUrlComponents = function(url) {
  const result = {};
  // Extract formId
  const formIdMatch = url.match(/\/forms\/d\/e\/([a-zA-Z0-9_-]+)\/viewform/);
  if (formIdMatch && formIdMatch[1]) {
    result.formId = formIdMatch[1];
  } else {
    throw new Error(`Invalid pre-filled URL format: ${url}`);
  }

  // Extract entry.ID from query parameters
  const queryStringIndex = url.indexOf('?');
  if (queryStringIndex !== -1) {
    const queryString = url.substring(queryStringIndex + 1);
    // Split by '&' to get individual parameters
    const params = queryString.split('&');
    for (let i = 0; i < params.length; i++) {
      const param = params[i];
      // Look for a parameter that starts with 'entry.' and has an '=' sign
      if (param.startsWith('entry.') && param.includes('=')) {
        const parts = param.split('=');
        if (parts.length > 1) {
          // Extract the ID part (e.g., '851578578' from 'entry.851578578')
          result.entryTokenId = parts[0].substring('entry.'.length);
          // Assuming the first such entry is our token field, we can break
          break;
        }
      }
    }
  }
  return result;
}