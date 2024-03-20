class TransactionProcessor {
    constructor(directory) {
        this.directory = directory
    }
    processTransactions(txns){
        txns.forEach((txn) =>
        this.directory.addUser(new Exports.User(txn)))
    }
}