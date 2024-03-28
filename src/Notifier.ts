import { Logger, } from './Types'
import { Transaction } from './TransactionProcessor';
import {Member} from './Member'

class Notifier implements Logger{
  joinSuccessLog = Array();
  joinFailureLog = Array();
  renewalSuccessLog = Array();
  renewalFailureLog = Array();
  partialsLog = Array();

 
  /**
   * Notify anyone interested that a user has been added as a consequence of the transaction
   * @param {Transaction} txn The transaction that caused the join
   * @param {User} user The user that was joined
   */
  joinSuccess(txn:Transaction, user:Member) {
    this.joinSuccessLog.push({ txn, user })
  }
  joinFailure(txn, user, err) {
    console.error(`Notifier.joinFailure()`)
    console.error(err.message)
    this.joinFailureLog.push({ txn, user, err })
  }
  renewalSuccess(txn, user) {
    this.renewalSuccessLog.push({ txn, user })
  }
  renewalFailure(txn, user, err) {
    console.error(`Notifier.renewalFailure()`)
    console.error(err.message)
    this.renewalFailureLog.push({ txn, user, err })
  }
  partial(txn, user) {
    this.partialsLog.push({ txn, user })
  }
  log() {
    function reportSuccess(l, kind) {
      l.forEach((e) => console.log(`${e.user.primaryEmail} ${kind}`))
    }
    function reportFailure(l, kind) {
      l.forEach((e) => console.error(`Txn ${e.txn["Payable Order ID"]} had ${kind} error: ${e.user.err}`))
    }
    reportSuccess(this.joinSuccessLog, "joined")
    reportFailure(this.joinFailureLog, "join")
    reportSuccess(this.renewalSuccessLog, "renewed")
    reportFailure(this.renewalFailureLog, "renewal")
    this.partialsLog.forEach((p) => console.log(`Txn ${p.txn["Payable Order ID"]} matched only one of phone or email against this member: ${p.user.primaryEmail}`))
  }

}


export { Notifier }