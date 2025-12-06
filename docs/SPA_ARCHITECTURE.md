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
