# Election Registration Service

## Overview

The Election Registration Service provides a secure, read-only API for Election Administrators to verify if Election Officers are active club members without exposing the main membership management system.

## Purpose

This service was created to address the security requirement that Election Administrators should:
- **NOT** have access to the main system spreadsheet
- Only need read/write access to the Election Registration spreadsheet (separate, not included in this project)
- Be able to verify if Election Officers are club members

## API Endpoint

### `isMember(email)`

Checks if an email address belongs to an active club member.

**Parameters:**
- `email` (string): The email address to check

**Returns:**
```json
{
  "isMember": true
}
```
or
```json
{
  "isMember": false
}
```

**Security Features:**
- Only returns membership status (boolean)
- Does NOT expose any member data (name, phone, address, etc.)
- Email normalization (lowercase, trimmed)
- Input validation
- Only considers "Active" status members

## Usage Examples

### From Google Apps Script (Election Registration Spreadsheet)

```javascript
// Check if an election officer is a member
function verifyElectionOfficer(email) {
  var result = isMember(email);
  
  if (result.isMember) {
    Logger.log(email + " is an active club member");
    return true;
  } else {
    Logger.log(email + " is NOT an active club member");
    return false;
  }
}
```

### From a Custom Web App

The service can be accessed via the web endpoint:

```javascript
function sendMagicLink(email, service) {
  // service = 'ElectionRegistrationService'
  // This will send a magic link to access the service
}
```

## Integration with Election Registration

The Election Administrator can:

1. Create a separate Google Spreadsheet for Election Registration
2. Use the `isMember(email)` API to validate election officers
3. Maintain complete control over the Election Registration data
4. Have no access to the main membership database

## Example Spreadsheet Formula

In your Election Registration spreadsheet, you can create a formula to automatically verify members:

```
=IF(isMember(A2), "✓ Valid Member", "✗ Not a Member")
```

Where A2 contains the email address of the election officer.

## Testing

The service includes comprehensive unit tests covering:
- Valid active members
- Inactive members
- Non-existent members
- Email normalization (case, whitespace)
- Invalid input handling (null, empty, non-string)
- Security: ensures no member data is leaked beyond status

Run tests with:
```bash
npm test
```

## Implementation Notes

- The service follows the same pattern as other web services in the system (DirectoryService, ProfileManagementService)
- Minimal API surface to reduce security risks
- Read-only access to membership data
- No write capabilities to the main system

## Future Enhancements

Potential future features (not currently implemented):
- Batch member verification (check multiple emails at once)
- Webhook notifications when member status changes
- API rate limiting
- Audit logging for member checks
