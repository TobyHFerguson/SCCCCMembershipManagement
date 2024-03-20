class Notifier {
    constructor() {
        this.joinLog = []
    }
    /**
     * Notify anyone interested that a user has been added as a consequence of the transaction
     * @param {Transaction} txn The transaction that caused the join
     * @param {User} user The user that was joined
     */
    processJoin(txn, user) {
        this.joinLog.push(`${user.primaryEmail} joined`)
    }
}