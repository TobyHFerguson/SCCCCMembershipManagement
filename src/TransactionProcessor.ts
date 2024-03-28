import { Directory, MemberAlreadyExistsError } from './Directory';
import { Notifier } from './Notifier';

class Transaction {
  "First Name": string;
  "Last Name": string;
  "Email Address": string;
  "Phone Number": string;
  "Payable Status": string;
  "Processed"?: string;
}
class TransactionProcessor {
  directory: Directory;
  notifier: Notifier;

  /**
   * 
   * @param {Directory} directory 
   * @param {Notifier} notifier 
   */
  constructor(directory: Directory, notifier: Notifier = new Notifier()) {
    this.directory = directory;
    this.notifier = notifier;
  }
  processTransactions(transactions: Transaction[], matcher = this.matchTransactionToMember_) {
    const txns = transactions.filter((txn) => txn['Payable Status'] !== undefined && txn['Payable Status'].startsWith('paid') && !txn.Processed)
    txns.forEach((txn) => {
      let matching = this.directory.members.filter((m) => matcher(txn, m))
      if (matching.length === 0) { // Join
        Logger.log("TP.pt - join_");
        this.join_(txn);
      } else {
        if (matching.length > 1) {
          matching.forEach(m => {
            Logger.log("TP.pt - partial_")
            this.partial_(txn, m)
          })
        } else {
          const member = matching[0]
          const matched = matcher(txn, member)
          if (typeof matched === "boolean") throw new Error("Matching failure")
          if (matched.full) {
            Logger.log("TP.pt - renew_")
            this.renew_(txn, member)
          } else {
            Logger.log("TP.pt - partial_")
            this.partial_(txn, member)
          }
        }
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
    let member = this.directory.makeMember(txn)
    while (true) {
      try {
        this.directory.addMemberFromTransaction(member)
        txn.Processed = new Date().toISOString().split("T")[0]
        this.notifier.joinSuccess(txn, member)
        return
      } catch (err) {
        if (err instanceof MemberAlreadyExistsError) {
          console.log('TP - join retry')
          member.incrementGeneration()
          continue
        } else {
          console.log(`TP - join_ err`)
          this.notifier.joinFailure(txn, member, err)
          return
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
    let updatedMember = this.directory.makeMember(member).incrementExpirationDate()
    try {
      this.directory.updateMember(updatedMember)
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

export { Transaction, TransactionProcessor }