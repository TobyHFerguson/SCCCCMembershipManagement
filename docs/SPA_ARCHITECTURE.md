# SPA Architecture Documentation

## Overview

The application uses a **data-driven Single Page Application (SPA)** architecture where:
- Server returns **JSON data only** (no HTML)
- Client renders **HTML from data** using JavaScript functions
- All navigation happens via **container replacement** (no page reloads)

This architecture solves fundamental browser security issues with `document.write()` and `innerHTML` script execution.

## Core Principles

### 1. Server Returns Data, Not HTML

**Server-side endpoints** (`webapp_endpoints.js`):
```javascript
function getServiceContent(email, service) {
  // Return pure JSON data
  return {
    serviceName: 'Service Name',
    serviceData: { /* service-specific data */ }
  };
}
```

**DO NOT** return HTML from server for SPA navigation. HTML is only returned for initial page load via `doGet()`.

### 2. Critical: Avoid Overwriting Api Objects

**MOST COMMON MISTAKE**: Using object literal syntax overwrites previously defined methods.

❌ **WRONG** - This pattern will break SPA rendering:
```javascript
// File starts correctly
ServiceName.Api = ServiceName.Api || {};
ServiceName.Api.getData = function(email) { return {...}; };  // ✓ Added

// Later in the same file - THIS OVERWRITES EVERYTHING!
ServiceName.Api = {
  handleSomeAction: function() { ... },
  anotherHandler: function() { ... }
};
// ❌ getData() is now GONE! Replaced by object literal.
```

✅ **CORRECT** - Add each method individually:
```javascript
// Initialize once
ServiceName.Api = ServiceName.Api || {};

// Add getData
ServiceName.Api.getData = function(email) {
  return { serviceName: 'Service', data: {...} };
};

// Add other methods individually - NOT as object literal
ServiceName.Api.handleSomeAction = function() { ... };
ServiceName.Api.anotherHandler = function() { ... };
```

**Why this matters**: The `webapp_endpoints.js` router checks for `webService.Api.getData`. If an object literal later in the file replaces the `Api` object, `getData()` disappears and the service shows "Service data not available".

**Real example from EmailChangeService**: `getData()` was defined on line 29, then completely removed when line 82 used `ServiceName.Api = { ... }` object literal syntax.

### 3. Client-Side Rendering

**All HTML generation happens in `_Header.html`** using renderer functions:

```javascript
function renderServiceName(data, container) {
  // 1. Set HTML structure
  container.innerHTML = `<div>...</div>`;
  
  // 2. Load external scripts dynamically (if needed)
  loadScript('https://cdn.example.com/library.js').then(() => {
    // 3. Initialize libraries with data
    initializeLibrary(data);
  });
}
```

### 4. Script Loading Rules

**CRITICAL**: Scripts in `innerHTML` don't execute. You MUST use dynamic loading:

❌ **WRONG** - Scripts won't execute:
```javascript
container.innerHTML = `
  <div>Content</div>
  <script src="https://cdn.example.com/lib.js"></script>
  <script>initLibrary();</script>
`;
```

✅ **CORRECT** - Dynamic script loading:
```javascript
container.innerHTML = `<div>Content</div>`;

loadScript('https://cdn.example.com/lib.js').then(() => {
  initLibrary(); // This executes!
});
```

### 4. Navigation Flow

```
User Action → google.script.run.getServiceContent(email, serviceId)
            ↓
Server returns: { serviceName: '...', data: {...} }
            ↓
Client: renderService(serviceId, data, container)
            ↓
Router calls: renderDirectoryService(data, container)
            ↓
1. container.innerHTML = HTML structure
2. loadScript() for external libraries
3. Initialize with data
```

## Container Width Management

### The `.container` Class System

**Background**: The base CSS framework in `_Header.html` defines a constrained `.container` class:
```css
.container {
    width: 25rem;  /* 400px - suitable for forms */
    padding: 1.25rem;
    background-color: white;
    /* ... other styles ... */
}
```

This narrow width works well for authentication forms, profile editors, and simple UIs. However, **data-heavy services like DirectoryService need much wider containers** to display tables effectively.

### Problem: Base CSS Applies to All Services

When a service renders, its content is placed inside the existing `.container` div. The base CSS `width: 25rem` applies automatically, constraining all content to 400px regardless of what the service needs.

### Solution: Service-Specific Container Classes

Services that need wider containers should add a specific class to the container element and provide overriding CSS:

**Pattern**:
```javascript
function renderWideService(data, container) {
    console.log('renderWideService called with data:', data);
    
    // 1. Add service-specific class to container
    container.classList.add('wide-service-container');
    
    // 2. Provide overriding CSS in innerHTML
    container.innerHTML = `
        <style>
            /* Override base .container width with higher specificity */
            .container.wide-service-container {
                width: 95% !important;
                max-width: none !important;
                min-width: 50rem !important;  /* 800px minimum */
            }
            
            /* Responsive overrides */
            html.is-tablet .container.wide-service-container {
                width: 90% !important;
                max-width: 60rem !important;
            }
            
            html.is-mobile-landscape .container.wide-service-container {
                width: 95% !important;
                overflow-x: auto;
            }
            
            html.is-mobile-portrait .container.wide-service-container {
                width: 100% !important;
                min-width: auto !important;
                padding: 0.5rem !important;
            }
        </style>
        <div class="service-content">
            <!-- Service content here -->
        </div>
    `;
    
    // 3. Continue with normal rendering...
}
```

**Why this works**:
- **Specificity**: `.container.wide-service-container` (two classes) beats `.container` (one class)
- **`!important`**: Ensures override even if base CSS has high specificity
- **Responsive**: Maintains framework's responsive behavior with class-based breakpoints
- **Cleanup**: When user navigates away, the service-specific class remains but content is replaced, so no conflicts

**When to use**:
- Services with wide tables (DirectoryService, reports)
- Services with side-by-side layouts requiring more horizontal space
- Services with wide forms or multi-column layouts

**When NOT to use**:
- Simple forms (profile editing, authentication)
- Vertical lists with narrow content
- Services that work fine at 400px width

### Real Example: DirectoryService

```javascript
function renderDirectoryService(data, container) {
    // Add service-specific class
    container.classList.add('directory-service-container');
    
    container.innerHTML = `
        <style>
            /* CRITICAL: Override base .container width for DirectoryService */
            .container.directory-service-container {
                width: 95% !important;
                max-width: none !important;
                min-width: 50rem !important;
            }
            
            html.is-tablet .container.directory-service-container {
                width: 90% !important;
                max-width: 60rem !important;
            }
            
            /* Mobile overrides... */
        </style>
        <div class="directory-container">
            <!-- DataTables table rendering here -->
        </div>
    `;
    
    // Load DataTables and render...
}
```

This gives DirectoryService a wide container (95% of viewport, minimum 800px) while other services remain at the standard 400px width.

## Implementation Guide

### Adding a New Service

**Step 1: Server-side API** (`webapp_endpoints.js`)

```javascript
function getServiceContent(email, service) {
  // Add your service
  if (service === 'YourService') {
    return {
      serviceName: 'Your Service',
      yourData: YourService.getData(email)
    };
  }
}
```

**Step 2: Client-side Renderer** (`_Header.html`)

```javascript
// Add renderer function
function renderYourService(data, container) {
  console.log('renderYourService called with:', data);
  
  // Load stylesheets
  loadStylesheet('https://cdn.example.com/style.css');
  
  // Set HTML structure
  container.innerHTML = `
    <style>
      /* Service-specific styles */
      .your-service { padding: 1rem; }
    </style>
    <div class="your-service">
      <h2>${escapeHtml(data.serviceName)}</h2>
      <div id="your-content"></div>
      <a href="#" onclick="window.navigateToHomePage(); return false;">
        ← Back to Services
      </a>
    </div>
  `;
  
  // Load and initialize external libraries if needed
  if (needsExternalLibrary) {
    Promise.all([
      loadScript('https://cdn.example.com/lib1.js'),
      loadScript('https://cdn.example.com/lib2.js')
    ]).then(() => {
      // Initialize with data
      initYourLibrary(data.yourData);
    }).catch(error => {
      console.error('Error loading scripts:', error);
      container.innerHTML += '<p style="color: red;">Error loading library</p>';
    });
  } else {
    // Or render directly if no external scripts needed
    renderYourContent(data.yourData);
  }
}

// Update router
function renderService(serviceId, data, container) {
  switch(serviceId) {
    case 'YourService':
      renderYourService(data, container);
      break;
    // ... other services
  }
}
```

**Step 3: Register in Router**

Update the switch statement in `renderService()` to include your new service.

## Code Quality Requirements

### Date Serialization (CRITICAL)

**Problem**: `google.script.run` cannot serialize JavaScript Date objects. When returned to client, they become `null`.

**Impact**: Silent data loss. Client receives `null` instead of dates, causing undefined behavior.

**Solution**: ALWAYS remove or convert Date objects before returning from `Service.Api.getData()`.

#### Pattern A: Format and Delete (Recommended for Display)

Use when dates are only for display (not for calculations on client).

```javascript
// In ProfileManagementService/Api.js
ProfileManagementService.Api.getData = function(token) {
  try {
    const session = Common.Auth.TokenStorage.validateToken(token);
    if (!session || !session.email) {
      return { 
        serviceName: 'Profile Management', 
        error: 'Invalid or expired session' 
      };
    }
    
    // Get profile with Date objects
    const profile = manager.getProfile(session.email);
    
    // Format dates to human-readable strings
    const displayProfile = { ...profile };
    displayProfile.JoinedFormatted = Utilities.formatDate(
      profile.Joined, 
      'America/Los_Angeles', 
      'MMMM dd, yyyy'
    );
    displayProfile.ExpiresFormatted = Utilities.formatDate(
      profile.Expires, 
      'America/Los_Angeles', 
      'MMMM dd, yyyy'
    );
    
    // CRITICAL: Delete original Date objects
    delete displayProfile.Joined;
    delete displayProfile.Expires;
    delete displayProfile['Renewed On'];  // If exists
    
    return { 
      serviceName: 'Profile Management', 
      profile: displayProfile, 
      email: session.email 
    };
  } catch (error) {
    Common.Logger.error('ProfileManagementService', 'Error in getData: ' + error.message);
    return { 
      serviceName: 'Profile Management', 
      error: error.message 
    };
  }
};
```

#### Pattern B: Convert to ISO Strings (For Client-Side Date Logic)

Use when client needs to perform date calculations or comparisons.

```javascript
// In VotingService/Api.js helper
function _getElectionsForTemplate() {
  const elections = getActiveElections();
  
  return elections.map(election => ({
    id: election.id,
    name: election.name,
    // Convert Date objects to ISO strings
    Start: election.Start.toISOString(),
    End: election.End.toISOString()
  }));
}

// Client can parse back to Date if needed
function renderVotingService(data, container) {
  const elections = data.elections || [];
  const now = new Date();
  
  elections.forEach(election => {
    const startDate = new Date(election.Start);  // Parse ISO string
    const isUpcoming = startDate > now;
    // ... render logic
  });
}
```

#### Anti-Pattern: Returning Date Objects

```javascript
// ❌ WRONG: Returns Date objects - will be null on client
Service.Api.getData = function(token) {
  const profile = {
    name: 'John Doe',
    joined: new Date('2024-01-15'),  // ❌ Will become null
    expires: new Date('2025-01-15')  // ❌ Will become null
  };
  return { serviceName: 'Profile', profile };
};

### Verification Code Auto-Resend Behavior (UX & Safety)

When a user submits a verification code that no longer exists (cache eviction) or has expired, the server will automatically generate and send a fresh verification code and return a friendly response. This prevents the UI from showing a technical "No verification code found" message and reduces user friction.

Key points:
- Server behavior: On `NO_CODE` or `EXPIRED` during verification, the server attempts to generate/store a fresh code and send it via email. If successful it returns:

```json
{ "success": false, "error": "Verification failed. A new verification code has been sent to your email.", "errorCode": "AUTO_RESENT", "email": "canonical@example.com" }
```

- Client behavior: The SPA client should detect `errorCode === 'AUTO_RESENT'`, update the displayed email with the server-provided canonical `email` (so the client uses the exact same cache key), show a friendly message, clear the code inputs, and restart the resend countdown timer.

- Rationale: CacheService entries are volatile and may be evicted or expired. Auto-resend is a pragmatic UX mitigation that keeps the flow moving without exposing technical details to the user.

- Tests: Add/maintain unit tests asserting that when verification fails with no code the server auto-resends (email sent, cache updated) and returns `AUTO_RESENT` plus canonical email.

Add this to the service authoring checklist when implementing verification flows.


// Client receives:
// { serviceName: 'Profile', profile: { name: 'John Doe', joined: null, expires: null } }
```

### Error Handling

**Principle**: Return errors as data, never throw from `Service.Api.getData()`.

**Why**: Uncaught exceptions break the entire SPA. Returning errors allows graceful client-side handling.

```javascript
// ✅ CORRECT: Comprehensive error handling
Service.Api.getData = function(token) {
  try {
    // Validate authentication
    const session = Common.Auth.TokenStorage.validateToken(token);
    if (!session || !session.email) {
      return { 
        serviceName: 'Your Service', 
        error: 'Invalid or expired session. Please sign in again.' 
      };
    }
    
    // Get data with business logic validation
    const data = manager.getData(session.email);
    if (!data) {
      return { 
        serviceName: 'Your Service', 
        error: 'No data available for your account.' 
      };
    }
    
    // Remove Date objects before return
    const safeData = removeDateObjects(data);
    
    return { 
      serviceName: 'Your Service', 
      yourData: safeData, 
      email: session.email 
    };
    
  } catch (error) {
    // Log server-side for debugging
    Common.Logger.error('YourService', 'Error in getData: ' + error.message);
    
    // Return user-friendly error
    return { 
      serviceName: 'Your Service', 
      error: 'An error occurred loading your data. Please try again.' 
    };
  }
};

// Client-side error handling
function renderYourService(data, container) {
  if (data.error) {
    container.innerHTML = `
      <div style="padding: 1rem;">
        <h2>${escapeHtml(data.serviceName || 'Service')}</h2>
        <div style="background: #f8d7da; color: #721c24; padding: 1rem; border-radius: 4px; margin: 1rem 0;">
          <strong>Error:</strong> ${escapeHtml(data.error)}
        </div>
        <a href="#" onclick="window.navigateToHomePage(); return false;">← Back to Services</a>
      </div>
    `;
    return;
  }
  
  // Render normal UI
  // ...
}
```

### Null Safety

**Principle**: ALL client-side code must handle missing/undefined data gracefully.

**Pattern**: Use `|| defaults` for every data access.

```javascript
// ✅ CORRECT: Null-safe data access
function renderYourService(data, container) {
  // Top-level defaults
  const serviceName = data.serviceName || 'Service';
  const items = data.items || [];
  const config = data.config || {};
  const userName = data.userName || 'Unknown User';
  
  // Nested defaults in config
  const pageSize = config.pageSize || 10;
  const sortOrder = config.sortOrder || 'asc';
  
  // Defaults in loops
  const itemsHtml = items.map(item => {
    const name = item.name || 'Unnamed';
    const description = item.description || '';
    const count = item.count || 0;
    const tags = item.tags || [];
    
    return `
      <div class="item">
        <h3>${escapeHtml(name)}</h3>
        <p>${escapeHtml(description)}</p>
        <span>Count: ${count}</span>
        <div>Tags: ${tags.map(t => escapeHtml(t || '')).join(', ')}</div>
      </div>
    `;
  }).join('');
  
  container.innerHTML = `
    <div>
      <h2>${escapeHtml(serviceName)}</h2>
      <p>Welcome, ${escapeHtml(userName)}</p>
      ${itemsHtml}
    </div>
  `;
}

// ❌ WRONG: No defaults - will crash on missing data
function renderYourService(data, container) {
  // Crashes if data.items is undefined
  const itemsHtml = data.items.map(item => {
    // Crashes if item.name is undefined
    return `<div>${item.name}</div>`;
  }).join('');
  
  container.innerHTML = `<div>${itemsHtml}</div>`;
}
```

### Form Validation

**Principle**: Validate trimmed values, not raw input. Users can submit whitespace.

```javascript
// ✅ CORRECT: Trim before validation
function initializeYourForm() {
  const nameInput = document.getElementById('name');
  const emailInput = document.getElementById('email');
  const submitButton = document.getElementById('submit');
  
  function allFieldsValid() {
    const nameValid = nameInput.value.trim() !== '';
    const emailValid = emailInput.value.trim() !== '' && 
                       emailInput.value.includes('@');
    
    return nameValid && emailValid;
  }
  
  function checkChanges() {
    // Check if values changed from original
    const changed = (
      nameInput.value !== originalName ||
      emailInput.value !== originalEmail
    );
    
    const isValid = allFieldsValid();
    
    // Submit requires BOTH changed AND valid
    submitButton.disabled = !(changed && isValid);
  }
  
  // Add listeners
  nameInput.addEventListener('input', checkChanges);
  emailInput.addEventListener('input', checkChanges);
  
  // Initial state
  checkChanges();
}

// ❌ WRONG: Allows whitespace-only submission
function allFieldsValid() {
  return nameInput.value !== '' && emailInput.value !== '';
  // User can submit '   ' (spaces only)
}

// ❌ WRONG: Submit enabled if changed, even if invalid
function checkChanges() {
  const changed = nameInput.value !== originalName;
  submitButton.disabled = !changed;  // Missing validity check
}
```

### JSDoc Standards

**Requirement**: Document Date handling, serialization constraints, and error returns.

```javascript
/**
 * Get service data for authenticated user
 * 
 * CRITICAL: This function MUST NOT return any Date objects.
 * google.script.run cannot serialize Date objects - they become null on client.
 * All dates are formatted to strings via Utilities.formatDate() and original
 * Date properties are deleted before return.
 * 
 * @param {string} token - Authentication token from sessionStorage
 * @returns {Object} Service data object containing:
 *   - serviceName {string} - Display name of service
 *   - yourData {Object} - Business data (all dates as formatted strings)
 *   - email {string} - Authenticated user email
 *   - error {string} - Error message if operation failed (mutually exclusive with data)
 * 
 * @example
 * // Success case
 * { 
 *   serviceName: 'Your Service', 
 *   yourData: { items: [...], dateFormatted: 'January 15, 2024' },
 *   email: 'user@example.com'
 * }
 * 
 * @example
 * // Error case
 * { 
 *   serviceName: 'Your Service', 
 *   error: 'Invalid session' 
 * }
 */
Service.Api.getData = function(token) {
  try {
    // Implementation
  } catch (error) {
    Common.Logger.error('YourService', 'Error in getData: ' + error.message);
    return { serviceName: 'Your Service', error: error.message };
  }
};
```

### Common Anti-Patterns

#### 1. Object Literal Overwrites Methods

```javascript
// ❌ WRONG: This DESTROYS getData if it was already defined
Service.Api = {
  getData: function(token) { /* ... */ }
};
// If getData was defined earlier, it's now GONE

// ✅ CORRECT: Extend namespace without overwriting
if (typeof Service.Api === 'undefined') Service.Api = {};
Service.Api.getData = function(token) { /* ... */ };
```

#### 2. Missing Try-Catch in getData

```javascript
// ❌ WRONG: Uncaught exceptions break SPA
Service.Api.getData = function(token) {
  const data = manager.getData(email);  // Throws if email invalid
  return { serviceName: 'Service', data };
};

// ✅ CORRECT: All exceptions caught and returned as data
Service.Api.getData = function(token) {
  try {
    const data = manager.getData(email);
    return { serviceName: 'Service', data };
  } catch (error) {
    return { serviceName: 'Service', error: error.message };
  }
};
```

#### 3. No Null Safety in Renderer

```javascript
// ❌ WRONG: Crashes if data.items is undefined
function renderService(data, container) {
  container.innerHTML = data.items.map(i => `<div>${i.name}</div>`).join('');
}

// ✅ CORRECT: Handles missing data gracefully
function renderService(data, container) {
  const items = data.items || [];
  container.innerHTML = items.map(i => `<div>${escapeHtml(i.name || '')}</div>`).join('');
}
```

#### 4. Scripts in innerHTML

```javascript
// ❌ WRONG: Scripts in innerHTML don't execute
container.innerHTML = `
  <div id="chart"></div>
  <script src="https://cdn.example.com/chart.js"></script>
  <script>
    initChart();  // Never runs!
  </script>
`;

// ✅ CORRECT: Load scripts dynamically
container.innerHTML = `<div id="chart"></div>`;
loadScript('https://cdn.example.com/chart.js').then(() => {
  initChart();  // Runs after script loads
});
```

### Pre-PR Quality Checklist

Before opening a PR that modifies SPA services:

- [ ] **Tests Pass**: `npm test` shows 100% pass rate
- [ ] **Error Handling**: All `Service.Api.getData()` methods have try-catch
- [ ] **Date Safety**: No Date objects in returned data (formatted and deleted)
- [ ] **Null Safety**: All renderers use `|| defaults` for data access  
- [ ] **Form Validation**: Checks `.trim() !== ''` not just `!== ''`
- [ ] **Submit Logic**: Buttons check `changed && valid` not just `changed`
- [ ] **JSDoc**: Includes CRITICAL Date serialization notes
- [ ] **Manual Testing**: Tested on desktop, tablet, mobile-portrait, mobile-landscape
- [ ] **Console Clean**: No errors during normal operation
- [ ] **Error Display**: Error states show gracefully (no white screen)
- [ ] **No Anti-Patterns**: No object literal overwrites, no scripts in innerHTML

## Utility Functions

### loadScript(src)

Dynamically loads external JavaScript files. Returns a Promise.

- **Checks for duplicates**: Won't load same script twice
- **Appends to `<head>`**: Scripts execute properly
- **Promise-based**: Chain with `.then()` for initialization

```javascript
loadScript('https://cdn.example.com/library.js')
  .then(() => {
    // Library is ready
    window.Library.init();
  })
  .catch(error => {
    console.error('Failed to load library:', error);
  });
```

### loadStylesheet(href)

Dynamically loads external CSS files.

- **Checks for duplicates**: Won't load same stylesheet twice
- **Appends to `<head>`**: Styles apply immediately
- **Synchronous**: No promise needed

```javascript
loadStylesheet('https://cdn.example.com/style.css');
```

### escapeHtml(str)

Escapes HTML to prevent XSS attacks. ALWAYS use when inserting user data.

```javascript
const safe = escapeHtml(userInput);
container.innerHTML = `<div>${safe}</div>`;
```

## Service Examples

### DirectoryService (DataTables)

```javascript
function renderDirectoryService(data, container) {
  // Load stylesheets
  loadStylesheet('https://cdn.datatables.net/1.11.5/css/jquery.dataTables.min.css');
  loadStylesheet('https://cdn.datatables.net/responsive/2.2.9/css/responsive.dataTables.min.css');
  
  // Set HTML structure
  container.innerHTML = `
    <div class="directory-container">
      <h2>SCCCC Directory</h2>
      <table id="data-table" class="display">
        <thead>
          <tr><th>First</th><th>Last</th><th>Email</th><th>Phone</th></tr>
        </thead>
        <tbody></tbody>
      </table>
      <a href="#" onclick="window.navigateToHomePage(); return false;">
        ← Back to Services
      </a>
    </div>
  `;
  
  // Load scripts and initialize
  Promise.all([
    loadScript('https://code.jquery.com/jquery-3.6.0.min.js'),
    loadScript('https://cdn.datatables.net/1.11.5/js/jquery.dataTables.min.js'),
    loadScript('https://cdn.datatables.net/responsive/2.2.9/js/dataTables.responsive.min.js')
  ]).then(() => {
    const tableData = data.directoryEntries.map(entry => [
      entry.First || '',
      entry.Last || '',
      entry.email || entry.Email || '',
      entry.phone || entry.Phone || ''
    ]);
    
    window.jQuery('#data-table').DataTable({
      data: tableData,
      responsive: true,
      pageLength: 25,
      order: [[1, 'asc'], [0, 'asc']]
    });
  });
}
```

### Simple Service (No External Libraries)

```javascript
function renderSimpleService(data, container) {
  container.innerHTML = `
    <style>
      .simple-service { padding: 1rem; }
      .item { padding: 0.5rem; border: 1px solid #ddd; margin: 0.5rem 0; }
    </style>
    <div class="simple-service">
      <h2>${escapeHtml(data.serviceName)}</h2>
      ${data.items.map(item => `
        <div class="item">
          <strong>${escapeHtml(item.name)}</strong>
          <p>${escapeHtml(item.description)}</p>
        </div>
      `).join('')}
      <a href="#" onclick="window.navigateToHomePage(); return false;">
        ← Back to Services
      </a>
    </div>
  `;
}
```

## Browser Compatibility Notes

### Why Scripts in innerHTML Don't Execute

**Security Feature**: Browsers prevent script execution from `innerHTML` to mitigate XSS attacks.

**Affected:**
- `<script src="...">` tags
- `<script>inline code</script>` tags
- Event handlers in HTML strings (use `addEventListener` instead)

**Solution**: Dynamic script creation via `createElement('script')` and `appendChild()`.

### Script Loading Order

When loading multiple dependencies:

```javascript
// Sequential loading
loadScript('lib1.js').then(() => {
  return loadScript('lib2-depends-on-lib1.js');
}).then(() => {
  initialize();
});

// Parallel loading
Promise.all([
  loadScript('lib1.js'),
  loadScript('lib2.js')
]).then(() => {
  initialize();
});
```

## Debugging Tips

### Enable Console Logging

Each renderer should log:
```javascript
console.log('renderServiceName called with:', data);
console.log('Scripts loaded, initializing...');
console.log('Initialization complete');
```

### Common Issues

**Issue**: "Library is not defined"
- **Cause**: Script not loaded before use
- **Fix**: Ensure initialization is inside `.then()` callback

**Issue**: "Data is empty"
- **Cause**: Server not returning expected data structure
- **Fix**: Check `getServiceContent()` return value

**Issue**: "Styles not applying"
- **Cause**: CSS loaded after HTML rendered
- **Fix**: Load stylesheets before or with HTML, they apply immediately

**Issue**: "Back to Services doesn't work"
- **Cause**: `window.navigateToHomePage` not defined
- **Fix**: Ensure `_Header.html` is loaded (should always be present)

## Migration Checklist

When migrating a service to SPA architecture:

- [ ] Update server endpoint to return JSON data only
- [ ] Create client-side renderer function
- [ ] Use `loadScript()` for external libraries
- [ ] Use `loadStylesheet()` for external CSS
- [ ] Use `escapeHtml()` for user data
- [ ] Add to `renderService()` switch statement
- [ ] Test with browser console open
- [ ] Verify "Back to Services" navigation works
- [ ] Check responsive behavior on mobile/tablet

## Best Practices

1. **Always escape user data**: Use `escapeHtml()` to prevent XSS
2. **Log abundantly during development**: Remove or reduce in production
3. **Handle loading errors**: Always add `.catch()` to Promise chains
4. **Check for script duplicates**: `loadScript()` does this automatically
5. **Keep renderers focused**: One service = one renderer function
6. **Use semantic HTML**: Proper heading hierarchy, ARIA labels
7. **Include navigation**: Every service should have "Back to Services" link
8. **Test on all breakpoints**: Mobile portrait/landscape, tablet, desktop

## Files Modified

- `src/webapp_endpoints.js` - Server-side data endpoints
- `src/common/html/_Header.html` - Client-side renderers and utilities
- `src/common/html/serviceHomePage.html` - Home page (template only for doGet)
- Individual service files (for data retrieval, not rendering)

## References

- Home page renderer: `renderHomePage()` in `_Header.html`
- Service router: `renderService()` in `_Header.html`
- Example: `renderDirectoryService()` in `_Header.html`
- Utilities: `loadScript()`, `loadStylesheet()`, `escapeHtml()` in `_Header.html`
