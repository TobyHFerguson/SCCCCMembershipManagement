
import {Transaction} from './Types'
import {Notifier} from './Notifier'
import {Directory} from './Directory'

export class Fixture1 {
  txn1: Transaction;
  txn2: Transaction;
  badTxn: Transaction;
  directory: Directory;
  notifier?: Notifier;

    constructor(directory, notifier?) {
      if (!directory) throw new Error("directory must be provided")
      this.txn1 = {
        "First Name": "J",
        "Last Name": "K",
        "Email Address": "j.k@icloud.com",
        "Phone Number": "+14083869343",
        "Payable Status": "paid"
      }
      this.txn2 = {
        "First Name": "A",
        "Last Name": "B",
        "Email Address": "a.b@icloud.com",
        "Phone Number": "+14083869000",
        "Payable Status": "paid"
      }
      this.badTxn = {
        "First Name": "C",
        "Last Name": "D",
        "Email Address": "c.d@icloud.com",
        "Phone Number": "+14083869340",
        "Payable Status": "paid"
      }
      this.directory = directory;
      this.notifier = notifier;
    }
  }