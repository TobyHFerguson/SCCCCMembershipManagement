class Notifier {
    constructor() {
        this.joinLog = []
        this.joinFailureLog = []
        this.renewalSuccessLog = []
        this.renewalFailureLog = []
        this.partialsLog = []
    }
    /**
     * Notify anyone interested that a user has been added as a consequence of the transaction
     * @param {Transaction} txn The transaction that caused the join
     * @param {User} user The user that was joined
     */
    joinSuccess(txn, user) {
        this.joinLog.push({txn, user})
    }
    joinFailure(txn, user, err) {
      this.joinFailureLog.push({ txn, user, err})
    }
    renewalSuccess(txn, user) {
      this.renewalSuccessLog.push({txn, user})
    }
    renewalFailure(txn, user, err) {
      this.renewalFailureLog.push({txn, user, err})
    }
    partial(txn, user) {
      this.partialsLog.push({txn, user})
    }
}