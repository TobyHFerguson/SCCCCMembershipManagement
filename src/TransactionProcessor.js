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
  processTransactions(transactions, matcher = this.matchTransactionToMember_) {
    const txns = transactions.filter((txn) => txn['Payable Status'] !== undefined && txn['Payable Status'].startsWith('paid') && !txn.Processed)
    txns.forEach((txn) => {
      let match = this.directory.members.find((m) => matcher(txn, m))
      if (match) { //
        if (matcher(txn, match).full) {
          Logger.log("TP.pt - renew_")
          this.renew_(txn, match)
        } else {
          Logger.log("TP.pt - partial_")
          this.partial_(txn, match)
        }
      } else { // problem with this user. Mark transaction for followup}
        Logger.log("TP.pt - join_")
        this.join_(txn)
      }
    });
  }
  /**
   * @function matchTransactionToMember - return a value depending on whether the transaction matches a member
   * @param {Transaction} transaction
   * @param {Member} member
   * @return {int} - -1 if partial match, 0 if no match, +1 if full match
   */
  matchTransactionToMember_(txn, member) {
    let homeEmails = member.emails.filter((e) => e.type === "home")
    let homeEmail = homeEmails[0].address
    let mobilePhone = (member.phones === undefined ? [{ value: null }] : member.phones).filter((p) => p.type === "mobile")[0].value
    let emailsMatch = homeEmail == txn["Email Address"]
    let phonesMatch = mobilePhone == txn["Phone Number"]
    let result = (emailsMatch && phonesMatch) ? { full: true } : (emailsMatch || phonesMatch) ? { full: false } : false
    return result
  }
  join_(txn) {
    let member = new User(txn)
    while (true) {
      try {
        this.directory.addUser(member)
        txn.Processed = new Date().toISOString().split("T")[0]
        this.notifier.joinSuccess(txn, member)
        break
      } catch (err) {
        if (err instanceof UserAlreadyExistsError) {
          console.log('TP - join retry')
          member.incrementGeneration()
        } else {
          console.log(`TP - join_ err`)
          this.notifier.joinFailure(txn, member, err)
          break
        }
      }
    }
  }
  /**
   * Process a membership renewal. 
   * @param (Transaction) txn the transaction causing the renewal
   * @param (User) member the member that is renewing their membership
   */
  renew_(txn, member) {
    let updatedMember = new User(member).incrementExpirationDate()
    try {
      this.directory.updateUser(updatedMember)
      txn.Processed = new Date()
      this.notifier.renewalSuccess(txn, updatedMember)
    } catch (err) {
      this.notifier.renewalFailure(txn, member, err)
    }
  }
  partial_(txn, member) {
    this.notifier.partial(txn, member)
  }
}