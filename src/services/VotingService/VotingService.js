
const PREFILLED_URL_COLUMN_NAME = 'Pre-filled Form URL';
const VOTE_TITLE_COLUMN_NAME = 'Vote Title';
const FORM_ID_COLUMN_NAME = 'Form ID';
const RESULTS_RECIPIENT_COLUMN_NAME = 'Results Recipient(s)'; // Can be comma-separated
const TRIGGER_STATUS_COLUMN_NAME = 'Trigger Status';
const VOTE_DATA_SHEET_ID = '1FN1vogIDDWdqghflOF6hNuDDW1cqFQpSGX8GhXLYyyw'; // Replace with your central vote data sheet ID
const REGISTRATION_SHEET_NAME = 'Vote Registrations'; // Update with your sheet name
const TOKEN_ENTRY_FIELD_TITLE = 'VOTING TOKEN'; // Adjust
const TOKEN_HELP_TEXT = 'This question is used to validate your vote. Do not modify this field.';

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

/**
 * Adds a short text question for the token at the end of the form.
 *
 * @param {string} formId The ID of the Google Form to modify.
 */
VotingService.addTokenQuestion = function(formId) {
  // Open the form using its ID
  const form = FormApp.openById(formId);
  
  // Get all items (questions) in the form
  const items = form.getItems();
  
  // Determine the index for the new question (the last position)
  const lastIndex = items.length;
  
  // Add a new short text item at the end of the form
  const tokenItem = form.addTextItem().setTitle(TOKEN_ENTRY_FIELD_TITLE);
  tokenItem.setHelpText(TOKEN_HELP_TEXT);
  
  // Set the question to be required
  tokenItem.setRequired(true);

  console.log(`Added token question to form ID: ${formId}`);
  
}

/**
 * Creates a pre-filled URL for a given question in a form.
 *
 * This function first finds the correct Entry ID for the question by
 * creating a temporary pre-filled URL and then parsing it.
 *
 * @param {string} formId The ID of the Google Form.
 * @param {string} questionTitle The title of the question to pre-fill.
 * @param {string} answer The answer to pre-fill in the question. Defaults to '1234'.
 * @return {string} A pre-filled URL for the form.
 */
VotingService.createPrefilledUrlWithTitle = function(formId, questionTitle, answer = '1234') {
  const form = FormApp.openById(formId);
  
  // Find the question item by its title
  const items = form.getItems();
  let targetItem = null;
  
  for (let i = 0; i < items.length; i++) {
    if (items[i].getTitle() === questionTitle) {
      targetItem = items[i];
      break;
    }
  }
  
  if (!targetItem) {
    throw new Error('Question with title "' + questionTitle + '" not found.');
  }

  // Use a temporary response to generate a pre-filled URL and get the Entry ID
  const tempResponse = form.createResponse();
  const itemResponse = targetItem.asTextItem().createResponse('DUMMY_VALUE');
  tempResponse.withItemResponse(itemResponse);
  
  // Get the pre-filled URL and find the Entry ID
  const prefilledUrl = tempResponse.toPrefilledUrl();
  const entryIdMatch = prefilledUrl.match(/entry\.(\d+)=/);
  
  if (!entryIdMatch || entryIdMatch.length < 2) {
    throw new Error('Could not find the Entry ID for the question.');
  }
  
  const entryId = entryIdMatch[1];
  
  // Now, create the final URL with the correct Entry ID and the desired answer
  const finalPrefilledUrl = form.getPublishedUrl() + '?usp=pp_url' + '&entry.' + entryId + '=' + encodeURIComponent(answer);
  
  Logger.log('Generated Pre-filled Link: ' + finalPrefilledUrl);
  
  return finalPrefilledUrl;
}

// Example usage:
// Replace 'YOUR_FORM_ID_HERE' with your actual form ID.
function runCreatePrefilledUrl() {
  const formId = '1zJi3Wt_AXZ3W5ML2wJ3zxYS923r-NTlBb863Ur-b_Ps';
  const prefilledLink = VotingService.createPrefilledUrlWithTitle(formId, TOKEN_ENTRY_FIELD_TITLE, '1234');
  console.log('prefilled Link: ', prefilledLink)
}
// To use the function, call it with your form's ID.
// Replace 'YOUR_FORM_ID_HERE' with the actual ID from your form's URL.
// The form ID is the long string of letters and numbers after '/d/' in the URL.
// Example: https://docs.google.com/forms/d/YOUR_FORM_ID_HERE/edit
function runAddTokenQuestion() {
  const formId = '1zJi3Wt_AXZ3W5ML2wJ3zxYS923r-NTlBb863Ur-b_Ps'; 
  VotingService.addTokenQuestion(formId);
}