if (typeof require !== 'undefined') {
  (utils = require('./utils.js'));
}
class Manager {
  constructor(actionSpecsArray, groupEmails, groupAddFun, groupRemoveFun, sendEmailFun, today) {
    if (!actionSpecsArray || actionSpecsArray.length === 0) {
      throw new Error('Manager requires a non-empty array of action specs');
    }
    if (!groupEmails || groupEmails.length === 0) { throw new Error('Manager requires a non-empty array of group emails'); }
    this._actionSpecs = Object.fromEntries(actionSpecsArray.map(spec => [spec.Type, spec]));
    this._groupEmails = groupEmails;
    this._groupAddFun = groupAddFun || (() => { });
    this._groupRemoveFun = groupRemoveFun || (() => { });
    this._sendEmailFun = sendEmailFun || (() => { });
    this._today = today || utils.getDateString()
  }

  today() {
    return this._today;
  }

  setGroupEmails(groupEmails) {
    this._groupEmails = groupEmails;
  }

  processExpirations(activeMembers, expiredMembers, actionSchedule) {
    if (!activeMembers || !activeMembers.length ) return 0;
    let numProcessed = 0;
    let membersToBeRemoved = [];
    for (let i = actionSchedule.length - 1; i >= 0; i--) {
      const sched = actionSchedule[i];
      const spec = this._actionSpecs[sched.Type];
      const tdy = new Date(this._today)
      const schedDate = new Date(utils.getDateString(sched.Date));
      if (schedDate <= tdy) {
        let idx = activeMembers.findIndex(member => member.Email === sched.Email);
        if (idx != -1) {
          let member = activeMembers[idx];
          if (sched.Type === utils.ActionType.Expiry4) {
            expiredMembers.push(member);
            membersToBeRemoved.push(idx);
            this._groupEmails.forEach(group => this._groupRemoveFun(member.Email, group.Email));
          }
          let message = {
            to: member.Email,
            subject: utils.expandTemplate(spec.Subject, member),
            htmlBody: utils.expandTemplate(spec.Body, member)
          };
          actionSchedule.splice(i, 1);
          this._sendEmailFun(message);
          numProcessed++;
        }
      }
    }
    membersToBeRemoved.sort((a, b) => b - a).forEach(idx => activeMembers.splice(idx, 1));
    return numProcessed;
  }

  migrateCEMembers(migrators, activeMembers, actionSchedule) { 
    const actionSpec = this._actionSpecs[utils.ActionType.Migrate];
    const requiredKeys = ['Email', 'First', 'Last', 'Phone', 'Joined', 'Period', 'Expires', 'Renewed On', 'Directory', 'Migrated'];
  
    let numMigrations = 0;
    const errors = [];
    migrators.forEach((mi, i) => {
      const rowNum = i + 2;
      if(!mi.Email) {
        console.log(`Skipping row ${rowNum}, no email address`);
        return;
      }
      if (activeMembers.some(activeMember => activeMember.Email === mi.Email)) {
        console.log(`Skipping ${mi.Email} on row ${rowNum}, already an active member`);
        return;
      }
      if (mi["Migrate Me"] && !mi.Migrated) {
        mi.Migrated = this._today;
        const newMember = { ...mi, Directory: mi.Directory ? 'Yes' : 'No' };
        // Delete unwanted keys
        Object.keys(newMember).forEach(key => {
          if (!requiredKeys.includes(key)) delete newMember[key];
        });
        try {
          console.log(`Migrating ${newMember.Email}, row ${rowNum}`);
          this._groupEmails.forEach(g => this._groupAddFun(newMember.Email, g.Email));
          let message = {
            to: newMember.Email,
            subject: utils.expandTemplate(actionSpec.Subject, newMember),
            htmlBody: utils.expandTemplate(actionSpec.Body, newMember)
          };
          this._sendEmailFun(message);
          activeMembers.push(newMember);
          actionSchedule.push(...this.createScheduleEntries_(newMember.Email, newMember.Expires));
          console.log(`Migrated ${newMember.Email}, row ${rowNum}`);
          numMigrations++;
        } catch (error) {
          error.rowNum = rowNum;
          error.email = mi.Email;
          errors.push(error);
        }
      }
    });
    if (errors.length > 0) {
      throw new AggregateError(errors, 'Errors occurred while migrating members');
    }
    return numMigrations;
  }

  processPaidTransactions(transactions, membershipData, actionSchedule) { 
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
            this.renewMember_(member, years, actionSchedule);
            message = {
              to: member.Email,
              subject: utils.expandTemplate(this._actionSpecs.Renew.Subject, member),
              htmlBody: utils.expandTemplate(this._actionSpecs.Renew.Body, member)
            };
          } else { // a joining member
            console.log(`transaction on row ${i + 2} ${txn["Email Address"]} is a new member`);
            const newMember = this.addNewMember_(txn, actionSchedule, membershipData);
            this._groupEmails.forEach(g => this._groupAddFun(newMember.Email, g.Email));
            message = {
              to: newMember.Email,
              subject: utils.expandTemplate(this._actionSpecs.Join.Subject, newMember),
              htmlBody: utils.expandTemplate(this._actionSpecs.Join.Body, newMember)
            };
          }
          this._sendEmailFun(message);
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

  renewMember_(member, period, actionSchedule,) {
    member.Period = period;
    member["Renewed On"] = this._today;
    member.Expires = this.calculateExpirationDate(period, member.Expires);
    this.addRenewedMemberToActionSchedule_(member, actionSchedule);
  }

  addRenewedMemberToActionSchedule_(member, actionSchedule) {
    const email = member.Email;
    Manager.removeEmails_(email, actionSchedule);
    const scheduleEntries = this.createScheduleEntries_(email, member.Expires);
    actionSchedule.push(...scheduleEntries);
  }

  createScheduleEntries_(email, expiryDate) {
    const scheduleEntries = [];
    Object.keys(this._actionSpecs).filter(type => type.startsWith('Expiry')).forEach((type) => {
      const spec = this._actionSpecs[type];
      const scheduleDate = utils.addDaysToDate(expiryDate, spec.Offset);
      const tdy = new Date(this._today);
      if (tdy >= scheduleDate) { return; }
      scheduleEntries.push({ Date: scheduleDate, Type: spec.Type, Email: email });
    });
    return scheduleEntries;
  }

  static removeEmails_(email, actionSchedule) {
    for (let i = actionSchedule.length - 1; i >= 0; i--) {
      if (actionSchedule[i].Email === email) {
        actionSchedule.splice(i, 1);
      }
    }
  }

  calculateExpirationDate(period, expires = this._today) {
    return utils.getDateString(utils.addYearsToDate(expires, period));
  }

  addNewMember_(txn, actionSchedule, membershipData) {
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
    this.addNewMemberToActionSchedule_(newMember, actionSchedule);
    return newMember;
  }

  addNewMemberToActionSchedule_(member, actionSchedule) {
    const scheduleEntries = this.createScheduleEntries_(member.Email, member.Expires);
    actionSchedule.push(...scheduleEntries);
  }


}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Manager;
}