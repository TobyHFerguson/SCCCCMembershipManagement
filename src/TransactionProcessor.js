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
            this.directory.addUser(user)
            this.notifier.processJoin(txn, user)
        });
    }
}