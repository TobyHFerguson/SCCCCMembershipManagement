class TransactionProcessor {
  /**
   * 
   * @param {Directory} directory 
   * @param {Notifier} notifier 
   */
  constructor(directory, notifier) {
    this.directory = directory,
      this.notifier = notifier
  }
  processTransactions(txns) {
    txns.forEach((txn) => {
      const user = new Exports.User(txn)
      try {
        this.directory.addUser(user)
        txn.Processed = new Date().toISOString().split("T")[0]
        this.notifier.joinSuccess(txn, user)
      } catch (err) {
        this.notifier.joinFailure(txn, user, err)
      }
    });
  }
}