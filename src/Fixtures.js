class Fixture1 {
    constructor(directory = new TestDirectory(), notifier = new Notifier) {
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
        "First Name": "J",
        "Last Name": "K",
        "Email Address": "j.k@icloud.com",
        "Phone Number": "+14083869343",
        "Payable Status": "paid"
      }
      this.domain = 'a.b';
      this.orgUnitPath = '/test';
      this.directory = directory;
      this.notifier = notifier;
    }
  }