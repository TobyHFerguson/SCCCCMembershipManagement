function onFormSubmit(e) {
  const newRow = e.range.getRow();
  let submissionRows = PropertiesService.getScriptProperties().getProperty('submissionRows');
  submissionRows = submissionRows ? JSON.parse(submissionRows) : [];
  submissionRows.push(newRow);
  PropertiesService.getScriptProperties().setProperty('submissionRows', JSON.stringify(submissionRows));

  // Ensure a trigger exists (either high or low frequency)
  ensureTrigger();
  Logger.log("New form submission on row: " + newRow);
}

function checkPaymentStatus() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Payments");
  let submissionRows = PropertiesService.getScriptProperties().getProperty('submissionRows');
  submissionRows = submissionRows ? JSON.parse(submissionRows) : [];

  const now = new Date().getTime();
  let startTime = PropertiesService.getScriptProperties().getProperty('paymentCheckStartTime');
  startTime = startTime ? parseInt(startTime, 10) : now; // Initialize if it doesn't exist

  for (let i = 0; i < submissionRows.length; i++) {
    const row = submissionRows[i];
    const paymentStatus = sheet.getRange(row, 3).getValue();

    if (paymentStatus === "Paid") {
      Logger.log("Payment received for row: " + row);
      submissionRows.splice(i, 1);
      i--;
    }
  }

  PropertiesService.getScriptProperties().setProperty('submissionRows', JSON.stringify(submissionRows));
  PropertiesService.getScriptProperties().setProperty('paymentCheckStartTime', startTime); // Update start time

  const elapsedTime = now - startTime;

  if (submissionRows.length > 0) { // Still pending payments

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

function ensureTrigger() {
  if (!PropertiesService.getScriptProperties().getProperty('paymentCheckTriggerExists')) {
    const triggerId = createTrigger('checkPaymentStatus', 1); // Initial 1-minute trigger
    PropertiesService.getScriptProperties().setProperty('paymentCheckTriggerExists', true);
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
    PropertiesService.getScriptProperties().deleteProperty('paymentCheckTriggerExists');
    PropertiesService.getScriptProperties().deleteProperty('paymentCheckTriggerId');
  }
}