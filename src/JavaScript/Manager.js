
if (typeof require !== 'undefined') {
  (utils = require('./utils.js'));
}
class Manager {
  constructor(today = utils.getDateString()) {
    this._today = today;
    this._groupEmails = [];
  }

  today() {
    return this._today;
  }

  setGroupEmails(groupEmails) {
    this._groupEmails = groupEmails;
  }

  processExpirations(activeMembers, expiredMembers, actionSchedule, actionSpec, groupRemoveFun, sendEmailFun, groupEmails) {
    const actionSpecByType = Object.fromEntries(actionSpec.map(spec => [spec.Type, spec]));
    if (!actionSchedule || !Array.isArray(actionSchedule)) {
      return 0;
    }
    let numProcessed = 0;
    let membersToBeRemoved = [];
    for (let i = actionSchedule.length - 1; i >= 0; i--) {
      const sched = actionSchedule[i];
      const spec = actionSpecByType[sched.Type];
      const tdy = this._today;
      const schedDate = utils.getDateString(sched.Date);
      if (schedDate <= tdy) {
        let idx = activeMembers.findIndex(member => member.Email === sched.Email);
        if (idx != -1) {
          let member = activeMembers[idx];
          if (sched.Type === Manager.ActionType.Expiry4) {
            expiredMembers.push(member);
            membersToBeRemoved.push(idx);
            groupEmails.forEach(group => groupRemoveFun(group.Email, member.Email));
          }
          let message = {
            to: member.Email,
            subject: utils.expandTemplate(spec.Subject, member),
            htmlBody: utils.expandTemplate(spec.Body, member)
          };
          actionSchedule.splice(i, 1);
          sendEmailFun(message);
          numProcessed++;
        }
      }
    }
    membersToBeRemoved.sort((a, b) => b - a).forEach(idx => activeMembers.splice(idx, 1));
    return numProcessed;
  }

  migrateCEMembers(migrators, activeMembers, actionSchedule, actionSpecs, groupAddFun, sendEmailFun, groupEmails) {
    const actionSpec = actionSpecs.find(as => as.Type === Manager.ActionType.Migrate);
    let numMigrations = 0;
    const errors = [];
    migrators.forEach((m, i) => {
      const rowNum = i + 2;
      if (!m.Migrated) {
        try {
          console.log(`Migrating ${m.Email}, row ${rowNum}`);
          m.Migrated = this._today;
          activeMembers.push(m);
          actionSchedule.push(...this.createScheduleEntries_(m, actionSpecs));
          groupEmails.forEach(g => groupAddFun(g.Email, m.Email));
          let message = {
            to: m.Email,
            subject: utils.expandTemplate(actionSpec.Subject, m),
            htmlBody: utils.expandTemplate(actionSpec.Body, m)
          };
          sendEmailFun(message);
          numMigrations++;
          console.log(`Migrated ${m.Email}, row ${rowNum}`);
        } catch (error) {
          error.rowNum = rowNum;
          error.email = m.Email;
          errors.push(error);
        }
      }
    });
    if (errors.length > 0) {
      throw new AggregateError(errors, 'Errors occurred while migrating members');
    }
    return numMigrations;
  }

  processPaidTransactions(transactions, membershipData, groupAddFun, sendEmailFun, actionSpecs, actionSchedule, groupEmails) {
    if (!transactions || !transactions.length || !Array.isArray(actionSpecs)) return;

    let _actionSpec = Object.fromEntries(actionSpecs.map(spec => [spec.Type, spec]));

    const emailToMemberMap = membershipData.length ? Object.fromEntries(membershipData.map((member, index) => [member.Email, index])) : {};
    const errors = [];
    transactions.forEach((txn, i) => {
      try {
        if (!txn.Processed && txn["Payable Status"].toLowerCase().startsWith("paid")) {
          const matchIndex = emailToMemberMap[txn["Email Address"]];
          let message;
          if (matchIndex !== undefined) { // a renewing member
            console.log(`transaction on row ${i + 2} ${txn["Email Address"]} is a renewing member`);
            const member = membershipData[matchIndex];
            const years = Manager.getPeriod_(txn);
            this.renewMember_(member, years, actionSchedule, actionSpecs);
            message = {
              to: member.Email,
              subject: utils.expandTemplate(_actionSpec.Renew.Subject, member),
              htmlBody: utils.expandTemplate(_actionSpec.Renew.Body, member)
            };
          } else { // a joining member
            console.log(`transaction on row ${i + 2} ${txn["Email Address"]} is a new member`);
            const newMember = this.addNewMember_(txn, actionSchedule, actionSpecs, membershipData);
            groupEmails.forEach(g => groupAddFun(newMember.Email, g.Email));
            message = {
              to: newMember.Email,
              subject: utils.expandTemplate(_actionSpec.Join.Subject, newMember),
              htmlBody: utils.expandTemplate(_actionSpec.Join.Body, newMember)
            };
          }
          sendEmailFun(message);
          txn.Timestamp = this._today;
          txn.Processed = this._today;
        }
      } catch (error) {
        error.txnNum = i + 2;
        error.email = txn["Email Address"];
        errors.push(error);
      }
    });

    if (errors.length > 0) {
      throw new AggregateError(errors, 'Errors occurred while processing transactions');
    }
  }



  static getPeriod_(txn) {
    if (!txn.Payment) { return 1; }
    const yearsMatch = txn.Payment.match(/(\d+)\s*year/);
    const years = yearsMatch ? parseInt(yearsMatch[1], 10) : 1;
    return years;
  }

  renewMember_(member, period, actionSchedule, actionSpecs) {
    member.Period = period;
    member["Renewed On"] = this._today;
    member.Expires = this.calculateExpirationDate(period, member.Expires);
    this.addRenewedMemberToActionSchedule_(member, actionSchedule, actionSpecs);
  }

  addRenewedMemberToActionSchedule_(member, actionSchedule, actionSpecs) {
    const email = member.Email;
    Manager.removeEmails_(email, actionSchedule);
    const scheduleEntries = this.createScheduleEntries_(member, actionSpecs);
    actionSchedule.push(...scheduleEntries);
  }

  createScheduleEntries_(member, actionSpecs) {
    const scheduleEntries = [];
    actionSpecs.filter(spec => spec.Type.startsWith('Expiry')).forEach((spec) => scheduleEntries.push({ Date: utils.addDaysToDate(member.Expires, spec.Offset), Type: spec.Type, Email: member.Email }));
    return scheduleEntries;
  }

  static removeEmails_(email, actionSchedule) {
    for (let i = actionSchedule.length - 1; i >= 0; i--) {
      if (actionSchedule[i].Email === email) {
        actionSchedule.splice(i, 1);
      }
    }
  }

   calculateExpirationDate(period, expires=this._today) {
    return utils.getDateString(utils.addYearsToDate(expires, period));
  }

  addNewMember_(txn, actionSchedule, actionSpecs, membershipData) {
    const newMember = {
      Email: txn["Email Address"],
      First: txn["First Name"],
      Last: txn["Last Name"],
      Phone: txn.Phone || '',
      Joined: this._today,
      Period: Manager.getPeriod_(txn),
      Expires: this.calculateExpirationDate(Manager.getPeriod_(txn)),
      "Renewed On": '',
    };
    membershipData.push(newMember);
    this.addNewMemberToActionSchedule_(newMember, actionSchedule, actionSpecs);
    return newMember;
  }

  addNewMemberToActionSchedule_(member, actionSchedule, actionSpecs) {
    const scheduleEntries = this.createScheduleEntries_(member, actionSpecs);
    actionSchedule.push(...scheduleEntries);
  }


}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Manager;
}