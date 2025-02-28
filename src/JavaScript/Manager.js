if (typeof require !== 'undefined') {
  (utils = require('./utils.js'));
}
class Manager {
  constructor(actionSpecs, groupEmails, groupAddFun, groupRemoveFun, sendEmailFun, today) {
    if (!groupEmails || groupEmails.length === 0) { throw new Error('Manager requires a non-empty array of group emails'); }
    this._actionSpecs = actionSpecs;
    this._groupEmails = groupEmails;
    this._groupAddFun = groupAddFun || (() => { });
    this._groupRemoveFun = groupRemoveFun || (() => { });
    this._sendEmailFun = sendEmailFun || (() => { });
    this._today = utils.dateOnly(today)
  }

  today() {
    return this._today;
  }

  setGroupEmails(groupEmails) {
    this._groupEmails = groupEmails;
  }

  processExpirations(activeMembers, expirySchedule) {
    expirySchedule.forEach(sched => { sched.Date = new Date(sched.Date) });
    expirySchedule.sort((a, b) => {
      if (b.Date - a.Date !== 0) {
        return b.Date - a.Date;
      }
      return a.Type.localeCompare(b.Type);
    });
    const schedulesToBeProcessed = expirySchedule.reduce((acc, sched, i) => { if (sched.Date <= new Date(this._today)) acc.push(i); return acc; }, []);
    schedulesToBeProcessed.sort((a, b) => b - a);
    let emailsSeen = new Set();
    for (let idx of schedulesToBeProcessed) {
      const sched = expirySchedule[idx];
      const spec = this._actionSpecs[sched.Type];
      console.log(`${sched.Type} - ${sched.Email}`);
      expirySchedule.splice(idx, 1);
      if (emailsSeen.has(sched.Email)) {
        console.log(`Skipping ${sched.Email} for ${sched.Type} - already processed`);
        continue;
      }
      emailsSeen.add(sched.Email);
      let memberIdx = activeMembers.findIndex(member => member.Email === sched.Email && member.Status !== 'Expired');
      if (memberIdx === -1) {
        console.log(`Skipping member ${sched.Email} - they're not an active member`);
      } else {
        let member = activeMembers[memberIdx];
        if (sched.Type === utils.ActionType.Expiry4) {
          member.Status = 'Expired'
          this._groupEmails.forEach(group => {this._groupRemoveFun(member.Email, group.Email); console.log(`Expiry4 - ${member.Email} removed from group ${group.Email}`)});
        }
        let message = {
          to: member.Email,
          subject: utils.expandTemplate(spec.Subject, member),
          htmlBody: utils.expandTemplate(spec.Body, member)
        };
        this._sendEmailFun(message);
        console.log(`${sched.Type} - ${member.Email} - Email sent`);
      }
    }
    for (let i = expirySchedule.length - 1; i >= 0; i--) {
      if (emailsSeen.has(expirySchedule[i].Email)) {
        expirySchedule.splice(i, 1);
      }
    }
    return schedulesToBeProcessed.length;
  }

  migrateCEMembers(migrators, activeMembers, expirySchedule) {
    const actionSpec = this._actionSpecs[utils.ActionType.Migrate];
    const requiredKeys = ['Email', 'First', 'Last', 'Phone', 'Joined', 'Period', 'Expires', 'Renewed On', 'Directory', 'Migrated'];

    let numMigrations = 0;
    const errors = [];
    migrators.forEach((mi, i) => {
      const rowNum = i + 2;
      if (!mi.Email) {
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
          expirySchedule.push(...this.createScheduleEntries_(newMember.Email, newMember.Expires));
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

  processPaidTransactions(transactions, membershipData, expirySchedule) {
    const activeMembers = membershipData.reduce((acc, m, i) => { if (m.Status === 'Active') { acc.push([m.Email, i]); } return acc }, [])
    const emailToActiveMemberIndexMap = Object.fromEntries(activeMembers);
    const errors = [];
    let recordsChanged = false;
    let hasPendingPayments = false;
    transactions.forEach((txn, i) => {
      if (txn.Processed) { // skip it if it's already been processed
        return;
      }
      if (!txn["Payable Status"] || !txn["Payable Status"].toLowerCase().startsWith("paid")) {
        hasPendingPayments = true; // if any transaction is not marked as paid, we have pending payments
        return
      }
      // We get here with a transaction that is not processed but is marked as paid. Process it.
      try {
        const matchIndex = emailToActiveMemberIndexMap[txn["Email Address"]];
        let message;
        if (matchIndex !== undefined) { // a renewing member
          console.log(`transaction on row ${i + 2} ${txn["Email Address"]} is a renewing member`);
          const member = membershipData[matchIndex];
          const years = Manager.getPeriod_(txn);
          this.renewMember_(member, years, expirySchedule);
          message = {
            to: member.Email,
            subject: utils.expandTemplate(this._actionSpecs.Renew.Subject, member),
            htmlBody: utils.expandTemplate(this._actionSpecs.Renew.Body, member)
          };
        } else { // a joining member
          console.log(`transaction on row ${i + 2} ${txn["Email Address"]} is a new member`);
          const newMember = this.addNewMember_(txn, expirySchedule, membershipData);
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
        recordsChanged = true;
      } catch (error) {
        error.txnNum = i + 2;
        error.email = txn["Email Address"];
        errors.push(error);
      }
    });
    return { recordsChanged, hasPendingPayments, errors };
  }



  static getPeriod_(txn) {
    if (!txn.Payment) { return 1; }
    const yearsMatch = txn.Payment.match(/(\d+)\s*year/);
    const years = yearsMatch ? parseInt(yearsMatch[1], 10) : 1;
    return years;
  }

  renewMember_(member, period, expirySchedule,) {
    member.Period = period;
    member["Renewed On"] = this._today;
    member.Expires = utils.calculateExpirationDate(this._today, member.Expires, period);
    this.addRenewedMemberToActionSchedule_(member, expirySchedule);
  }

  addRenewedMemberToActionSchedule_(member, expirySchedule) {
    const email = member.Email;
    Manager.removeEmails_(email, expirySchedule);
    const scheduleEntries = this.createScheduleEntries_(email, member.Expires);
    expirySchedule.push(...scheduleEntries);
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

  static removeEmails_(email, expirySchedule) {
    for (let i = expirySchedule.length - 1; i >= 0; i--) {
      if (expirySchedule[i].Email === email) {
        expirySchedule.splice(i, 1);
      }
    }
  }


  addNewMember_(txn, expirySchedule, membershipData) {
    const newMember = {
      Email: txn["Email Address"],
      First: txn["First Name"],
      Last: txn["Last Name"],
      Phone: txn.Phone || '',
      Joined: this._today,
      Period: Manager.getPeriod_(txn),
      Expires: utils.calculateExpirationDate(this._today, this._today, Manager.getPeriod_(txn)),
      "Renewed On": '',
      Status: "Active"
    };
    membershipData.push(newMember);
    this.addNewMemberToActionSchedule_(newMember, expirySchedule);
    return newMember;
  }

  addNewMemberToActionSchedule_(member, expirySchedule) {
    const scheduleEntries = this.createScheduleEntries_(member.Email, member.Expires);
    expirySchedule.push(...scheduleEntries);
  }


}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Manager;
}