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
        const sheet = e.source.getActiveSheet();
        if (sheet.getName() === REGISTRATION_SHEET_NAME) {
            console.log(`Edit detected in registration sheet: ${sheet.getName()}`);
            VotingService.Trigger.handleRegistrationSheetEdit(e);
        }
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