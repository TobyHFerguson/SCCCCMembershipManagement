// Apps Script functions
function processTransactions() {
    convertLinks_('Transactions');
    const transactionsFiddler = getFiddler_('Transactions').needFormulas();
    const transactions = getDataWithFormulas(transactionsFiddler);
    if (transactions.length === 0) { return; }
  
    
    const bulkGroupFiddler = getFiddler_('Bulk Add Groups');
    const bulkGroupEmails = bulkGroupFiddler.getData();
    const emailScheduleFiddler = getFiddler_('Email Schedule');
    const emailScheduleData = emailScheduleFiddler.getData();
    const emailScheduleFormulas = emailScheduleFiddler.getFormulaData();
  
    const membershipFiddler = getFiddler_('Membership');
    const membershipData = membershipFiddler.getData();
    const processedTransactionsFiddler = getFiddler_('Processed Transactions');
    const processedTransactions = getDataWithFormulas(processedTransactionsFiddler);
    
    const { processedRows, updatedTransactions } = processTransactionsData(transactions, membershipData, emailScheduleData, emailScheduleFormulas, bulkGroupEmails);
    log('updatedTransactions', updatedTransactions);
    log('updatedTransactions.length', updatedTransactions.length);
    processedTransactions.push(...processedRows);
  
    bulkGroupFiddler.setData(bulkGroupEmails).dumpValues();
    const emails = combineArrays(emailScheduleFormulas, emailScheduleData);
    emailScheduleFiddler.setData(emails).dumpValues();
    membershipData.sort((a, b) => a.Email.localeCompare(b.Email));
    membershipFiddler.setData(membershipData).dumpValues();
    transactionsFiddler.setData(updatedTransactions).dumpValues();
    processedTransactionsFiddler.setData(processedTransactions).dumpValues();
  }

  function sendScheduledEmailsAppScript() {
    const emailScheduleFiddler = getFiddler_('Email Schedule');
    const emailScheduleData = emailScheduleFiddler.getData();
    let emailScheduleFormulas = emailScheduleFiddler.getFormulaData();
  
    const sentEmails = sendScheduledEmails(emailScheduleData, emailScheduleFormulas);
    if (sentEmails.length > 0) {
      const remainingEmails = combineArrays(emailScheduleFormulas, emailScheduleData);
      emailScheduleFiddler.setData(remainingEmails).dumpValues();
    }
  }