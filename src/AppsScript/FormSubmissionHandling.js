function onFormSubmit(e) {
  // Ensure a trigger exists (either high or low frequency)
  ensureTrigger();
  Logger.log("New form submission on row: " + e.range.getRow());
}

function checkPaymentStatus() {
  const now = new Date().getTime();
  let startTime = PropertiesService.getScriptProperties().getProperty('paymentCheckStartTime');
  startTime = startTime ? parseInt(startTime, 10) : now; // Initialize if it doesn't exist

  const elapsedTime = now - startTime;

  if (hasPendingPayments()) { // Still pending payments
    if (elapsedTime > 15 * 60 * 1000) { // 15 minutes - Back off to hourly
      Logger.log("Backing off to hourly checks.");
      deletePaymentCheckTrigger();
      createTrigger('checkPaymentStatus', 60); // Hourly
      PropertiesService.getScriptProperties().deleteProperty('paymentCheckStartTime'); // Reset start time for next backoff period
    } else if (elapsedTime > 5 * 60 * 1000) { // 5 minutes - Back off to 5-min checks
      Logger.log("Backing off to 5-minute checks.");
      deletePaymentCheckTrigger();
      createTrigger('checkPaymentStatus', 5); // 5-minutely
      PropertiesService.getScriptProperties().deleteProperty('paymentCheckStartTime'); // Reset start time for next backoff period
    }
  } else { // All payments processed
    deletePaymentCheckTrigger();
    PropertiesService.getScriptProperties().deleteProperty('paymentCheckStartTime'); // Clear start time
  }
}

function hasPendingPayments() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Payments");
  const lastUpdateTime = sheet.getLastUpdated();
  const lastProcessedTime = PropertiesService.getScriptProperties().getProperty('lastProcessedTime');

  if (lastProcessedTime && lastUpdateTime <= parseInt(lastProcessedTime, 10)) {
    Logger.log("No updates since last check.");
    return true; // Spreadsheet not updated, assume pending payments
  }

  const dataRange = sheet.getDataRange();
  const data = dataRange.getValues();
  PropertiesService.getScriptProperties().setProperty('lastProcessedTime', lastUpdateTime);
  return checkPendingPaymentsInData(data, lastUpdateTime);
}

function checkPendingPaymentsInData(data, lastUpdateTime) {
  for (let i = 1; i < data.length; i++) { // Skip header row
    const paymentStatus = data[i][2]; // Assuming the payment status is in the 3rd column
    if (paymentStatus !== "Paid") {
      return true;
    }
  }

  return false;
}

function ensureTrigger() {
  if (!PropertiesService.getScriptProperties().getProperty('paymentCheckTriggerId')) {
    const triggerId = createTrigger('checkPaymentStatus', 1); // Initial 1-minute trigger
    PropertiesService.getScriptProperties().setProperty('paymentCheckStartTime', new Date().getTime()); // Initialize start time
    PropertiesService.getScriptProperties().setProperty('paymentCheckTriggerId', triggerId);
  }
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
        ScriptApp.deleteTrigger(trigger);
        Logger.log("Payment check trigger deleted.");
        break;
      }
    }
    PropertiesService.getScriptProperties().deleteProperty('paymentCheckTriggerId');
  }
}