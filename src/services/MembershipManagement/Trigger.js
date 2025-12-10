const BACKING_OFF_5_MIN_LOG = 'Backing off to 5-minute checks.';
const BACKING_OFF_HOURLY_LOG = 'Backing off to hourly checks.';
const CHECK_PAYMENT_STATUS_LOG = 'Running checkPaymentStatus.';
const COULD_NOT_GET_LAST_UPDATED_TIME_LOG = 'Could not get last updated time.';
const ERROR_DELETING_TRIGGER_LOG = 'Error deleting trigger: ';
const ERROR_GETTING_LAST_UPDATED_TIME_LOG = 'Error getting last updated time: ';
const LAST_UPDATED_LOG = 'Last updated: ';
const NEW_SUBMISSION_LOG = 'New form submission on row: ';
const NO_UPDATES_LOG = 'No updates since last check.';
const PAYMENTS_PENDING_LOG = 'Payments are still pending.';
const PAYMENTS_PROCESSED_LOG = 'All payments have been processed.';
const PAYMENT_SHEET_NAME = 'Transactions';
const PAYMENT_STATUS_FUNCTION = 'checkPaymentStatus';
const SPREADSHEET_ID_PROPERTY = 'spreadsheetId';
const TRIGGER_DELETED_LOG = 'Payment check trigger deleted.';
const TRIGGER_NOT_FOUND_LOG = 'Trigger not found, nothing to delete.';

const SHORTER_PERIOD = 3 * 60 * 1000; // 3 minutes - Back off to 5-min checks
const LONGER_PERIOD =  5 * 60 * 1000 // 6 minutes - Back off to hourly

function checkPaymentStatus() {
    console.log('checkPaymentStatus');
    MembershipManagement.Trigger._checkPaymentStatus();
}


MembershipManagement.Trigger = {

    onFormSubmit: function (e) {
        console.log(NEW_SUBMISSION_LOG, e.range.getRow());

        // Store the Spreadsheet ID
        const spreadsheetId = e.source.getId();
        PropertiesService.getScriptProperties().setProperty(SPREADSHEET_ID_PROPERTY, spreadsheetId);

        // Reset the payment check trigger to 1-minute and update the start time
        MembershipManagement.Trigger._deleteTriggersByFunctionName(PAYMENT_STATUS_FUNCTION);
        MembershipManagement.Trigger._createMinuteTrigger(PAYMENT_STATUS_FUNCTION, 1); // Initial 1-minute trigger
        const startTime = new Date();
        PropertiesService.getScriptProperties().setProperty('paymentCheckStartTime', startTime.toISOString()); // Reset start time
    },

    _checkPaymentStatus: function() {
        console.log(CHECK_PAYMENT_STATUS_LOG);
        const now = new Date();
        const startTime = MembershipManagement.Trigger._getTimeFromProperty('paymentCheckStartTime') || now;

        const elapsedTime = now.getTime() - startTime.getTime();

        if (MembershipManagement.Trigger._hasPendingPayments()) { // Still pending payments
            console.log(PAYMENTS_PENDING_LOG);
            if (elapsedTime > LONGER_PERIOD) { // 6 minutes - Back off to hourly 
                console.log(BACKING_OFF_HOURLY_LOG);
                MembershipManagement.Trigger._deleteTriggersByFunctionName(PAYMENT_STATUS_FUNCTION);
                MembershipManagement.Trigger._createHourlyTrigger(PAYMENT_STATUS_FUNCTION, 1); // Hourly
                PropertiesService.getScriptProperties().deleteProperty('paymentCheckStartTime'); // Clear start time
            } else if (elapsedTime > SHORTER_PERIOD) { // 3 minutes - Back off to 5-min checks
                console.log(BACKING_OFF_5_MIN_LOG);
                MembershipManagement.Trigger._deleteTriggersByFunctionName(PAYMENT_STATUS_FUNCTION);
                MembershipManagement.Trigger._createMinuteTrigger(PAYMENT_STATUS_FUNCTION, 5); // 5-minutely
            }
        } else { // All payments processed
            console.log(PAYMENTS_PROCESSED_LOG);
            MembershipManagement.Trigger._deleteTriggersByFunctionName(PAYMENT_STATUS_FUNCTION);
            PropertiesService.getScriptProperties().deleteProperty('paymentCheckStartTime'); // Clear start time
        }
    },

    _getTimeFromProperty: function(propertyName) {
        const time = PropertiesService.getScriptProperties().getProperty(propertyName);
        return time ? new Date(time) : null;
    },

    _hasPendingPayments: function() {
        const spreadsheetId = PropertiesService.getScriptProperties().getProperty(SPREADSHEET_ID_PROPERTY);
        const lastUpdateTime = MembershipManagement.Trigger._getLastSpreadsheetUpdateTime(spreadsheetId); // Use current time as last update time
        const lastProcessedTime = MembershipManagement.Trigger._getTimeFromProperty('lastProcessedTime');

        if (lastProcessedTime && lastUpdateTime <= lastProcessedTime) {
            console.log(NO_UPDATES_LOG);
            return true; // Spreadsheet not updated, assume pending payments
        }

        PropertiesService.getScriptProperties().setProperty('lastProcessedTime', new Date().toISOString());
        const { hasPendingPayments, errors } = MembershipManagement.processTransactions()
        errors.forEach(e => console.error(`Transaction on row ${e.txnNumber} ${e.email} had an error: ${e.message}\nStack trace: ${e.stack
            }`));
        return hasPendingPayments
    },



    _createMinuteTrigger: function(functionName, minutes) {
        console.log('_createMinuteTrigger', functionName, minutes);
        MembershipManagement.Trigger._deleteTriggersByFunctionName(functionName);
        const trigger = ScriptApp.newTrigger(functionName)
            .timeBased()
            .everyMinutes(minutes)
            .create();
        return trigger.getUniqueId();
    },

    _createHourlyTrigger: function(functionName, hours) {
        console.log('_createHourlyTrigger', functionName, hours);
        MembershipManagement.Trigger._deleteTriggersByFunctionName(functionName);
        const trigger = ScriptApp.newTrigger(functionName)
            .timeBased()
            .everyHours(hours)
            .create();
        return trigger.getUniqueId();
    },

    _deleteTriggersByFunctionName: function(functionName) {
        const triggers = ScriptApp.getProjectTriggers();
        for (const trigger of triggers) {
            if (trigger.getHandlerFunction() === functionName) {
                ScriptApp.deleteTrigger(trigger);
                console.log(TRIGGER_DELETED_LOG);
            }
        }
    },

    _getLastSpreadsheetUpdateTime: function(spreadsheetId) {
        spreadsheetId = spreadsheetId || SpreadsheetApp.getActiveSpreadsheet().getId()
        try {
            var file = DriveApp.getFileById(spreadsheetId);
            var lastUpdated = file.getLastUpdated();
            return lastUpdated;
        } catch (e) {
            console.log(ERROR_GETTING_LAST_UPDATED_TIME_LOG, e.toString());
            if (e.message.includes('Please wait a bit and try again')) {
                console.log('Not waiting - returning last updated time as now');
                return new Date(); // Return current time if the error is due to rate limiting
            }
            return null; // Return null if there's an error
        }
    },

    testGetLastUpdateTime() {
        var lastUpdated = MembershipManagement.Trigger._getLastSpreadsheetUpdateTime();

        if (lastUpdated) {
            console.log(LAST_UPDATED_LOG, lastUpdated);
        } else {
            console.log(COULD_NOT_GET_LAST_UPDATED_TIME_LOG);
        }
    }
}