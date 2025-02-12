const { calculateExpirationDate } = require('./JavaScript/utils');

if (typeof require !== 'undefined') {
    (Utils = require('./JavaScript/utils'));
}

const Manager = (function (){
    function getPeriod(txn) {
        if (!txn.Payment) {return 1;}
        const yearsMatch = txn.Payment.match(/(\d+)\s*year/);
        const years = yearsMatch ? parseInt(yearsMatch[1], 10) : 1;
        return years;
      }

      function getNewMember(txn) {
        const period = getPeriod(txn)
        const newMember = {
          Email: txn["Email Address"],
          First: txn["First Name"],
          Last: txn["Last Name"],
          Joined: Utils.getDateString(),
          Period: period,
          Expires: Utils.calculateExpirationDate(period),
          "Renewed On": '',
        };
        return newMember
      }
      function renewMember(member, period) {
        member.Period = period;
        member["Renewed On"] = Utils.getDateString();
        member.Expires = Utils.calculateExpirationDate(period, member.Expires);
      }
    const processPaidTransactions = function(transactions, activeMembers) {
        const emailToMemberMap = new Map(activeMembers.map((member, index) => [member.Email, index]));
        let numProcessed = 0;
        transactions.forEach(txn => {
          if (!txn.Processed  && txn["Payable Status"].toLowerCase().startsWith("paid")) {
            const matchIndex = emailToMemberMap.get(txn["Email Address"]);
            if (matchIndex !== undefined) {
              const member = activeMembers[matchIndex];
              const years = getPeriod(txn);
              renewMember(member, years);
            } else {
              const newMember = getNewMember(txn)
              activeMembers.push(newMember);
            }
            txn.Timestamp = Utils.getDateString();
            txn.Processed = Utils.getDateString();
            numProcessed++;
          }
        })
        return numProcessed;
    }

    return {
        processPaidTransactions
    }
})();

if (typeof module !== 'undefined') {
    module.exports = Manager;
}