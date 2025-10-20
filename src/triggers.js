 // @ts-check
 function onOpen() {
    MembershipManagement.Menu.create();
    DocsService.Menu.create();
    EmailService.Menu.create();
    VotingService.Menu.create();
}

/**
 * 
 * @param {GoogleAppsScript.Events.FormsOnFormSubmit} e 
 */
function onFormSubmit(e) {
    withLock_((e) => {
        MembershipManagement.Trigger.onFormSubmit(e);
    })(e);
}

/**
 * 
 * @param {GoogleAppsScript.Events.SheetsOnEdit} e 
 */
function handleEditEvent(e) {
    withLock_((e) => {
        VotingService.Trigger.handleRegistrationSheetEdit(e);
    })(e);
}

/**
 * 
 * @param {GoogleAppsScript.Events.SheetsOnFormSubmit} e 
 */
function ballotSubmitHandler(e) {
    withLock_((e) => {
        VotingService.Trigger.ballotSubmitHandler(e);
    })(e);
}

function manageElectionLifecycles() {
    withLock_(() => {
        console.log('Managing election lifecycles');
        VotingService.manageElectionLifecycles();
    })();
}

/**
 * Gets the external Elections spreadsheet ID from Bootstrap configuration
 * @returns {string} The external Elections spreadsheet ID
 */
function getElectionsSpreadsheetId() {
    try {
        // Get Bootstrap configuration to find Elections spreadsheet ID
        const bootstrapData = Common.Data.Access.getBootstrapData();
        const electionsConfig = bootstrapData.find(row => row.Reference === 'Elections');
        
        if (!electionsConfig) {
            throw new Error('Elections configuration not found in Bootstrap data');
        }
        
        return electionsConfig.id;
    } catch (error) {
        console.error('Error getting Elections spreadsheet ID:', error);
        throw error;
    }
}

/**
 * Sets up edit triggers for external Elections spreadsheet
 * Uses Bootstrap configuration to determine the external spreadsheet ID
 * Creates an installable onEdit trigger from THIS project that monitors the external spreadsheet
 */
function setupElectionsTriggers() {
    try {
        console.log('Setting up triggers for external Elections spreadsheet...');
        
        const electionsSpreadsheetId = getElectionsSpreadsheetId();
        console.log(`Found Elections spreadsheet ID: ${electionsSpreadsheetId}`);
        
        // Remove any existing triggers for this function to avoid duplicates
        const existingTriggers = ScriptApp.getProjectTriggers();
        existingTriggers.forEach(trigger => {
            if (trigger.getHandlerFunction() === 'handleElectionsSheetEdit') {
                console.log(`Removing existing trigger: ${trigger.getUniqueId()}`);
                ScriptApp.deleteTrigger(trigger);
            }
        });
        
        // Verify access to the external Elections spreadsheet
        const electionsSpreadsheet = SpreadsheetApp.openById(electionsSpreadsheetId);
        console.log(`Verified access to Elections spreadsheet: ${electionsSpreadsheet.getName()}`);
        
        // Create installable edit trigger for the external Elections spreadsheet
        // The trigger function will be in THIS project but will monitor the external spreadsheet
        const trigger = ScriptApp.newTrigger('handleElectionsSheetEdit')
            .forSpreadsheet(electionsSpreadsheetId)
            .onEdit()
            .create();
        
        // Store the external spreadsheet ID in script properties for reference
        PropertiesService.getScriptProperties().setProperty('ELECTIONS_SPREADSHEET_ID', electionsSpreadsheetId);
        
        console.log(`Successfully created Elections edit trigger: ${trigger.getUniqueId()}`);
        console.log('Elections triggers setup complete!');
        
        return {
            success: true,
            spreadsheetId: electionsSpreadsheetId,
            spreadsheetName: electionsSpreadsheet.getName(),
            triggerId: trigger.getUniqueId()
        };
        
    } catch (error) {
        console.error('Error setting up Elections triggers:', error);
        throw error;
    }
}

/**
 * Manually process Elections spreadsheet changes
 * This function should be called when Elections data is modified
 * Can be called from a menu item or manually
 */
function processElectionsChanges() {
    try {
        console.log('Processing Elections spreadsheet changes...');
        
        const electionsSpreadsheetId = getElectionsSpreadsheetId();
        const electionsSpreadsheet = SpreadsheetApp.openById(electionsSpreadsheetId);
        const electionsSheet = electionsSpreadsheet.getSheetByName('Elections');
        
        if (!electionsSheet) {
            throw new Error('Elections sheet not found in external spreadsheet');
        }
        
        console.log('Running election lifecycle management...');
        VotingService.manageElectionLifecycles();
        
        console.log('Elections changes processed successfully');
        
        return {
            success: true,
            message: 'Elections changes processed'
        };
        
    } catch (error) {
        console.error('Error processing Elections changes:', error);
        throw error;
    }
}

/**
 * Handles edit events on the external Elections spreadsheet
 * This function is called automatically by the installable trigger when the external Elections spreadsheet is edited
 * @param {GoogleAppsScript.Events.SheetsOnEdit} e - The edit event from the external Elections spreadsheet
 */
function handleElectionsSheetEdit(e) {
    withLock_((e) => {
        try {
            console.log('Elections spreadsheet edit detected');
            const sheet = e.range.getSheet();
            const spreadsheetId = e.source.getId();
            
            // Verify this is the correct Elections spreadsheet and sheet
            const expectedElectionsSpreadsheetId = getElectionsSpreadsheetId();
            if (spreadsheetId !== expectedElectionsSpreadsheetId) {
                console.log(`Ignoring edit from unexpected spreadsheet: ${spreadsheetId}`);
                return;
            }
            
            if (sheet.getName() !== 'Elections') {
                console.log(`Ignoring edit from non-Elections sheet: ${sheet.getName()}`);
                return;
            }
            
            console.log(`Processing Elections sheet edit: Row ${e.range.getRow()}, Column ${e.range.getColumn()}`);
            
            // Call the existing VotingService handler with the real event
            VotingService.Trigger.handleRegistrationSheetEdit(e);
            
            console.log('Elections sheet edit processed successfully');
            
        } catch (error) {
            console.error('Error handling Elections sheet edit:', error);
            throw error;
        }
    })(e);
}

/**
 * A higher-order function that wraps another function with a lock,
 * try...catch, and finally block to ensure safe, concurrent-access execution.
 * * @param {Function} func The function to be wrapped.
 * @param {string} lockType The type of lock to acquire ('script', 'user', 'document').
 * @param {number} timeoutMillis The time to wait for the lock in milliseconds.
 * @returns {Function} A new, wrapped function.
 */
function withLock_(func, lockType = 'document', timeoutMillis = 30000) {
  // Return a new function that will execute the original function.
  return function() {
    let lock;
    
    // Acquire the correct lock type based on the input.
    if (lockType === 'script') {
      lock = LockService.getScriptLock();
    } else if (lockType === 'user') {
      lock = LockService.getUserLock();
    } else {
      // Default to 'document' lock
      lock = LockService.getDocumentLock();
    }

    try {
      lock.waitLock(timeoutMillis);

      if (lock.hasLock()) {
        // Use `apply` to call the original function with its original `this` context
        // and arguments. This makes the wrapper highly reusable.
        func.apply(this, arguments);
      } else {
        // Handle the case where the lock couldn't be acquired.
        Logger.log('Could not acquire lock. The resource is busy.');
        // You could also throw an error or handle it gracefully here.
      }
    } catch (e) {
      // Gracefully handle any errors from the wrapped function.
      Logger.log(`An error occurred: ${e.message}`);
      // Add your custom error handling logic, e.g., send an email.
    } finally {
      // Ensure the lock is always released.
      if (lock && lock.hasLock()) {
        lock.releaseLock();
      }
    }
  };
}