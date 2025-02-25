const PAYMENT_STATUS_FUNCTION = 'checkPaymentStatus';
const PAYMENT_SHEET_NAME = 'Payments';
const PAYMENT_STATUS_COLUMN_INDEX = 2; // Assuming the payment status is in the 3rd column
const PAID_STATUS = 'Paid';
const NO_UPDATES_LOG = 'No updates since last check.';
const NEW_SUBMISSION_LOG = 'New form submission on row: ';
const BACKING_OFF_HOURLY_LOG = 'Backing off to hourly checks.';
const BACKING_OFF_5_MIN_LOG = 'Backing off to 5-minute checks.';
const TRIGGER_DELETED_LOG = 'Payment check trigger deleted.';
const TRIGGER_NOT_FOUND_LOG = 'Trigger not found, nothing to delete.';
const ERROR_DELETING_TRIGGER_LOG = 'Error deleting trigger: ';

function onFormSubmit(e) {
  Logger.log(NEW_SUBMISSION_LOG + e.range.getRow());

  // Reset the payment check trigger to 1-minute and update the start time
  deletePaymentCheckTrigger();
  const triggerId = createTrigger(PAYMENT_STATUS_FUNCTION, 1); // Initial 1-minute trigger
  PropertiesService.getScriptProperties().setProperty('paymentCheckStartTime', new Date().getTime()); // Reset start time
  PropertiesService.getScriptProperties().setProperty('paymentCheckTriggerId', triggerId);
}

function checkPaymentStatus() {
  const now = new Date().getTime();
  let startTime = PropertiesService.getScriptProperties().getProperty('paymentCheckStartTime');
  startTime = startTime ? parseInt(startTime, 10) : now; // Initialize if it doesn't exist

  const elapsedTime = now - startTime;

  if (hasPendingPayments()) { // Still pending payments
    if (elapsedTime > 15 * 60 * 1000) { // 15 minutes - Back off to hourly
      Logger.log(BACKING_OFF_HOURLY_LOG);
      deletePaymentCheckTrigger();
      createTrigger(PAYMENT_STATUS_FUNCTION, 60); // Hourly
      PropertiesService.getScriptProperties().deleteProperty('paymentCheckStartTime'); // Clear start time
    } else if (elapsedTime > 5 * 60 * 1000) { // 5 minutes - Back off to 5-min checks
      Logger.log(BACKING_OFF_5_MIN_LOG);
      deletePaymentCheckTrigger();
      createTrigger(PAYMENT_STATUS_FUNCTION, 5); // 5-minutely
      PropertiesService.getScriptProperties().setProperty('paymentCheckStartTime', new Date().getTime()); // Reset start time for next backoff period
    }
  } else { // All payments processed
    deletePaymentCheckTrigger();
    PropertiesService.getScriptProperties().deleteProperty('paymentCheckStartTime'); // Clear start time
  }
}

function hasPendingPayments() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(PAYMENT_SHEET_NAME);
  const lastUpdateTime = sheet.getLastUpdated();
  const lastProcessedTime = PropertiesService.getScriptProperties().getProperty('lastProcessedTime');

  if (lastProcessedTime && lastUpdateTime <= parseInt(lastProcessedTime, 10)) {
    Logger.log(NO_UPDATES_LOG);
    return true; // Spreadsheet not updated, assume pending payments
  }

  const dataRange = sheet.getDataRange();
  const data = dataRange.getValues();
  PropertiesService.getScriptProperties().setProperty('lastProcessedTime', lastUpdateTime);
  return checkPendingPaymentsInData(data, lastUpdateTime);
}

function checkPendingPaymentsInData(data, lastUpdateTime) {
  for (let i = 1; i < data.length; i++) { // Skip header row
    const paymentStatus = data[i][PAYMENT_STATUS_COLUMN_INDEX];
    if (paymentStatus !== PAID_STATUS) {
      return true;
    }
  }

  return false;
}

function createTrigger(functionName, minutes) {
  const trigger = ScriptApp.newTrigger(functionName)
      .timeBased()
      .everyMinutes(minutes)
      .create();
  return trigger.getUniqueId();
}

function deletePaymentCheckTrigger() {
  const triggerId = PropertiesService.getScriptProperties().getProperty('paymentCheckTriggerId');
  if (triggerId) {
    const triggers = ScriptApp.getProjectTriggers();
    for (const trigger of triggers) {
      if (trigger.getUniqueId() === triggerId) {
        try {
          ScriptApp.deleteTrigger(trigger);
          Logger.log(TRIGGER_DELETED_LOG);
        } catch (e) {
          if (e.message.includes('Trigger not found')) {
            Logger.log(TRIGGER_NOT_FOUND_LOG);
          } else {
            Logger.log(ERROR_DELETING_TRIGGER_LOG + e.message);
          }
        }
        break;
      }
    }
    PropertiesService.getScriptProperties().deleteProperty('paymentCheckTriggerId');
  }
}