 // @ts-check
 function onOpen() {
    // Initialize Logger with container spreadsheet for cross-spreadsheet logging
    try {
        const containerSpreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
        // @ts-ignore - Logger is implemented in separate file
        AppLogger.setContainerSpreadsheet(containerSpreadsheetId);
    } catch (error) {
        console.error('Failed to initialize Logger container:', error);
    }
    
    // Auto-setup all triggers if not already configured

    
    MembershipManagement.Menu.create();
    DocsService.Menu.create();
    EmailService.Menu.create();
    VotingService.Menu.create();
}

/**
 * Initialize All triggers for the system
 */
function initializeTriggers() {
    AppLogger.configure()
      try {
        const properties = PropertiesService.getScriptProperties();
        const electionsTriggerId = properties.getProperty('ELECTIONS_TRIGGER_ID');
        const formSubmitTriggerId = properties.getProperty('FORM_SUBMIT_TRIGGER_ID');
        if (!electionsTriggerId || !formSubmitTriggerId) {
            AppLogger.info('', 'System triggers not found - setting up automatically...');
            const result = setupAllTriggers();
            
            // Store trigger IDs for future reference
            properties.setProperty('ELECTIONS_TRIGGER_ID', result.editTriggerId);
            properties.setProperty('FORM_SUBMIT_TRIGGER_ID', result.formSubmitTriggerId);

            AppLogger.info('', 'System triggers auto-configured on deployment');
        } else {
            AppLogger.info('', 'System triggers already configured');
        }
    } catch (error) {
        AppLogger.warn('', 'Could not auto-setup system triggers:', error);
        // Continue without failing - triggers can be set up manually later
    }
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
        AppLogger.info('Triggers', 'Managing election lifecycles');
        VotingService.manageElectionLifecycles();
    })();
}

/**
 * Processes membership expirations - called daily by trigger at 6:00 AM
 * Uses Logger for production visibility and sends error notifications to membership-automation
 */
function processMembershipExpirations() {
    withLock_(() => {
        try {
            // Initialize Logger with container spreadsheet for cross-spreadsheet logging
            const containerSpreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
            // @ts-ignore - Logger is implemented in separate file
            AppLogger.setContainerSpreadsheet(containerSpreadsheetId);
            
            // @ts-ignore - Logger is implemented in separate file
            AppLogger.info('Triggers', 'Starting daily membership expiration processing');
            
            // Call the main expiration processing function
            MembershipManagement.generateExpiringMembersList();
            
            // @ts-ignore - Logger is implemented in separate file
            AppLogger.info('Triggers', 'Daily membership expiration processing completed successfully');
            
        } catch (error) {
            // @ts-ignore - Logger is implemented in separate file
            AppLogger.error('Triggers', 'Daily membership expiration processing failed', error);
            console.error(`Daily membership expiration processing failed: ${error.message}\nStack trace: ${error.stack}`);
            throw error; // Re-throw to ensure trigger system records the failure
        }
    })();
}

/**
 * Gets the external Elections spreadsheet ID from Bootstrap configuration
 * @returns {string} The external Elections spreadsheet ID
 */
function getElectionsSpreadsheetId() {
    AppLogger.configure();
    try {
        // @ts-ignore - Logger is implemented in separate file
        AppLogger.info('Triggers', 'Starting getElectionsSpreadsheetId - attempting to get Bootstrap data');
        
        // Get Bootstrap configuration to find Elections spreadsheet ID
        const bootstrapData = Common.Data.Access.getBootstrapData();
        
        // @ts-ignore - Logger is implemented in separate file
        AppLogger.info('Triggers', 'Successfully retrieved Bootstrap data', {rowCount: bootstrapData ? bootstrapData.length : 0});
        
        const electionsConfig = bootstrapData.find(row => row.Reference === 'Elections');
        
        if (!electionsConfig) {
            // @ts-ignore - Logger is implemented in separate file
            AppLogger.error('Triggers', 'Elections configuration not found in Bootstrap data', {
                availableReferences: bootstrapData.map(row => row.Reference)
            });
            throw new Error('Elections configuration not found in Bootstrap data');
        }
        
        // @ts-ignore - Logger is implemented in separate file
        AppLogger.info('Triggers', 'Found Elections configuration', {
            electionsId: electionsConfig.id,
            electionsConfig: electionsConfig
        });
        
        return electionsConfig.id;
    } catch (error) {
        // @ts-ignore - Logger is implemented in separate file
        AppLogger.error('Triggers', 'Error getting Elections spreadsheet ID', error);
        throw error;
    }
}

/**
 * Legacy function for backward compatibility - now calls setupAllTriggers
 * @deprecated Use setupAllTriggers() instead
 */
function setupElectionsTriggers() {
    return setupAllTriggers();
}

/**
 * Sets up all installable triggers for the system:
 * 1. External Elections spreadsheet edit trigger and daily calendar trigger
 * 2. Container spreadsheet form submission trigger for membership payments
 * Uses Bootstrap configuration to determine the external spreadsheet ID
 */
function setupAllTriggers() {
    AppLogger.configure();
    try {
        AppLogger.info('Triggers', 'Setting up all system triggers...');
        
        const electionsSpreadsheetId = getElectionsSpreadsheetId();
        AppLogger.info('Triggers', `Found Elections spreadsheet ID: ${electionsSpreadsheetId}`);
        
        // Remove any existing triggers for these functions to avoid duplicates
        const existingTriggers = ScriptApp.getProjectTriggers();
        existingTriggers.forEach(trigger => {
            if (trigger.getHandlerFunction() === 'handleElectionsSheetEdit' || 
                trigger.getHandlerFunction() === 'processElectionsChanges' ||
                trigger.getHandlerFunction() === 'onFormSubmit' ||
                trigger.getHandlerFunction() === 'processMembershipExpirations') {
                console.log(`Removing existing trigger: ${trigger.getUniqueId()} for ${trigger.getHandlerFunction()}`);
                ScriptApp.deleteTrigger(trigger);
            }
        });
        
        // Verify access to the external Elections spreadsheet
        const electionsSpreadsheet = SpreadsheetApp.openById(electionsSpreadsheetId);
        console.log(`Verified access to Elections spreadsheet: ${electionsSpreadsheet.getName()}`);
        
        // Create installable edit trigger for the external Elections spreadsheet
        // The trigger function will be in THIS project but will monitor the external spreadsheet
        const editTrigger = ScriptApp.newTrigger('handleElectionsSheetEdit')
            .forSpreadsheet(electionsSpreadsheetId)
            .onEdit()
            .create();
        
        // Create daily calendar trigger for election lifecycle management
        // This runs in the context of THIS project (container spreadsheet) which has Bootstrap access
        const calendarTrigger = ScriptApp.newTrigger('processElectionsChanges')
            .timeBased()
            .everyDays(1)
            .atHour(0) // 00:00 (midnight)
            .create();
        
        // Create membership form submission trigger for the container spreadsheet
        // This handles new membership payment submissions in the Transactions sheet
        const containerSpreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
        const formSubmitTrigger = ScriptApp.newTrigger('onFormSubmit')
            .forSpreadsheet(containerSpreadsheetId)
            .onFormSubmit()
            .create();
        
        // Create daily membership expiration processing trigger
        // This runs at 6:00 AM daily to process membership expirations
        const membershipExpirationTrigger = ScriptApp.newTrigger('processMembershipExpirations')
            .timeBased()
            .everyDays(1)
            .atHour(6) // 06:00 (6:00 AM)
            .create();
        
        // Store the spreadsheet IDs in script properties for reference
        PropertiesService.getScriptProperties().setProperty('ELECTIONS_SPREADSHEET_ID', electionsSpreadsheetId);
        PropertiesService.getScriptProperties().setProperty('CONTAINER_SPREADSHEET_ID', containerSpreadsheetId);
        
        console.log(`Successfully created Elections edit trigger: ${editTrigger.getUniqueId()}`);
        console.log(`Successfully created daily calendar trigger: ${calendarTrigger.getUniqueId()}`);
        console.log(`Successfully created membership form submit trigger: ${formSubmitTrigger.getUniqueId()}`);
        console.log(`Successfully created membership expiration trigger: ${membershipExpirationTrigger.getUniqueId()}`);
        console.log('All triggers setup complete!');
        
        return {
            success: true,
            electionsSpreadsheetId: electionsSpreadsheetId,
            electionsSpreadsheetName: electionsSpreadsheet.getName(),
            containerSpreadsheetId: containerSpreadsheetId,
            editTriggerId: editTrigger.getUniqueId(),
            calendarTriggerId: calendarTrigger.getUniqueId(),
            formSubmitTriggerId: formSubmitTrigger.getUniqueId(),
            membershipExpirationTriggerId: membershipExpirationTrigger.getUniqueId()
        };
        
    } catch (error) {
        // @ts-ignore - Logger is implemented in separate file  
        AppLogger.error('Triggers', 'Error setting up triggers', error);
        throw error;
    }
}

/**
 * Manually process Elections spreadsheet changes
 * This function should be called when Elections data is modified
 * Can be called from a menu item or manually
 */
function processElectionsChanges() {
    AppLogger.configure();
    try {
        AppLogger.info('Triggers', 'Processing Elections spreadsheet changes...');
        
        const electionsSpreadsheetId = getElectionsSpreadsheetId();
        const electionsSpreadsheet = SpreadsheetApp.openById(electionsSpreadsheetId);
        const electionsSheet = electionsSpreadsheet.getSheetByName('Elections');
        
        if (!electionsSheet) {
            throw new Error('Elections sheet not found in external spreadsheet');
        }
        
        AppLogger.info('Triggers', 'Running election lifecycle management...');
        VotingService.manageElectionLifecycles();
        
        AppLogger.info('Triggers', 'Elections changes processed successfully');
        
        return {
            success: true,
            message: 'Elections changes processed'
        };
        
    } catch (error) {
        // @ts-ignore - Logger is implemented in separate file
        AppLogger.error('Triggers', 'Error processing Elections changes', error);
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
            // @ts-ignore - Logger is implemented in separate file
            AppLogger.info('Triggers', 'Elections spreadsheet edit detected');
            const sheet = e.range.getSheet();
            const spreadsheetId = e.source.getId();
            
            // Verify this is the correct Elections spreadsheet and sheet
            const expectedElectionsSpreadsheetId = getElectionsSpreadsheetId();
            if (spreadsheetId !== expectedElectionsSpreadsheetId) {
                console.log(`Ignoring edit from unexpected spreadsheet: ${spreadsheetId} (expected: ${expectedElectionsSpreadsheetId})`);
                return;
            }
            
            if (sheet.getName() !== 'Elections') {
                console.log(`Ignoring edit from non-Elections sheet: ${sheet.getName()}`);
                return;
            }
            
            // @ts-ignore - Logger is implemented in separate file
            AppLogger.info('Triggers', `Processing Elections sheet edit: Row ${e.range.getRow()}, Column ${e.range.getColumn()}`);
            
            try {
                // Call the existing VotingService handler with the real event
                VotingService.Trigger.handleRegistrationSheetEdit(e);
                
                // @ts-ignore - Logger is implemented in separate file
                AppLogger.info('Triggers', 'Elections sheet edit processed successfully');
            } catch (handlerError) {
                // @ts-ignore - Logger is implemented in separate file
                AppLogger.error('Triggers', 'Error in Elections sheet handler - operation failed', handlerError);
                throw handlerError; // Re-throw to be caught by outer catch
            }
            
        } catch (error) {
            // @ts-ignore - Logger is implemented in separate file
            AppLogger.error('Triggers', 'Error handling Elections sheet edit', error);
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
    // Setup the logger
    AppLogger.configure();
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
        AppLogger.warn('Could not acquire lock. The resource is busy.');
        // You could also throw an error or handle it gracefully here.
      }
    } catch (e) {
      // Gracefully handle any errors from the wrapped function.
      AppLogger.error(`An error occurred: ${e.message}`);
      // Add your custom error handling logic, e.g., send an email.
    } finally {
      // Ensure the lock is always released.
      if (lock && lock.hasLock()) {
        lock.releaseLock();
      }
    }
  };
}