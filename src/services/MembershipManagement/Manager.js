if (typeof require !== 'undefined') {
   (MembershipManagement = require('./utils.js'));
}

MembershipManagement.Manager = class {
  constructor(actionSpecs, groups, groupAddFun, groupRemoveFun, sendEmailFun, today) {
    if (!groups || groups.length === 0) { throw new Error('MembershipManager requires a non-empty array of group emails'); }
    this._actionSpecs = actionSpecs;
    this._groups = groups;
    this._groupAddFun = groupAddFun || (() => { });
    this._groupRemoveFun = groupRemoveFun || (() => { });
    this._sendEmailFun = sendEmailFun || (() => { });
    this._today = MembershipManagement.Utils.dateOnly(today)
  }

  today() {
    return this._today;
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
        if (sched.Type === MembershipManagement.Utils.ActionType.Expiry4) {
          member.Status = 'Expired'
          this._groups.forEach(group => { this._groupRemoveFun(member.Email, group.Email); console.log(`Expiry4 - ${member.Email} removed from group ${group.Email}`) });
        }
        let message = {
          to: member.Email,
          subject: MembershipManagement.Utils.expandTemplate(spec.Subject, member),
          htmlBody: MembershipManagement.Utils.expandTemplate(spec.Body, member)
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

  migrateCEMembers(migrators, members, expirySchedule) {
    const actionSpec = this._actionSpecs[MembershipManagement.Utils.ActionType.Migrate];
    const requiredKeys = ['Email', 'First', 'Last', 'Phone', 'Joined', 'Period', 'Expires', 'Renewed On', 'Directory', 'Migrated', 'Status'];

    let numMigrations = 0;
    const errors = [];
    migrators.forEach((mi, i) => {
      const rowNum = i + 2;
      if (!mi.Email) {
        console.log(`Skipping row ${rowNum}, no email address`);
        return;
      }
      if (members.some(member => member.Status === 'Active' && member.Email === mi.Email)) {
        console.log(`Skipping ${mi.Email} on row ${rowNum}, already an active member`);
        return;
      }
      if (mi["Migrate Me"] && !mi.Migrated) {
        mi.Migrated = this._today;
        const newMember = { ...mi, Directory: mi.Directory ? 'Yes' : 'No' };
        // Delete unwanted keys
        try {
          if (mi.Status !== 'Active') {
            console.log(`Migrating Inactive member ${newMember.Email}, row ${rowNum} - no groups will be joined or emails sent`);
          } else {
            console.log(`Migrating Active member ${newMember.Email}, row ${rowNum} - joining groups and sending member an email`);
            Object.keys(newMember).filter(key => key.includes('@')).filter(k => newMember[k]).forEach(g => this._groupAddFun(newMember.Email, g));
            expirySchedule.push(...this.createScheduleEntries_(newMember.Email, newMember.Expires));
            let message = {
              to: newMember.Email,
              subject: MembershipManagement.Utils.expandTemplate(actionSpec.Subject, newMember),
              htmlBody: MembershipManagement.Utils.expandTemplate(actionSpec.Body, newMember)
            };
            this._sendEmailFun(message);
          }
          Object.keys(newMember).forEach(key => {
            if (!requiredKeys.includes(key)) delete newMember[key];
          });
          members.push(newMember);
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
          this.renewMember_(txn, member, expirySchedule);
          message = {
            to: member.Email,
            subject: MembershipManagement.Utils.expandTemplate(this._actionSpecs.Renew.Subject, member),
            htmlBody: MembershipManagement.Utils.expandTemplate(this._actionSpecs.Renew.Body, member)
          };
        } else { // a joining member
          console.log(`transaction on row ${i + 2} ${txn["Email Address"]} is a new member`);
          const newMember = this.addNewMember_(txn, expirySchedule, membershipData);
          this._groups.forEach(g => this._groupAddFun(newMember.Email, g.Email));
          message = {
            to: newMember.Email,
            subject: MembershipManagement.Utils.expandTemplate(this._actionSpecs.Join.Subject, newMember),
            htmlBody: MembershipManagement.Utils.expandTemplate(this._actionSpecs.Join.Body, newMember)
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

  renewMember_(txn, member, expirySchedule,) {
    member.Period = MembershipManagement.Manager.getPeriod_(txn);
    member["Renewed On"] = this._today;
    member.Expires = MembershipManagement.Utils.calculateExpirationDate(this._today, member.Expires, member.period);
    Object.assign(member, MembershipManagement.Manager.extractDirectorySharing_(txn));
    this.addRenewedMemberToActionSchedule_(member, expirySchedule);
  }

  addRenewedMemberToActionSchedule_(member, expirySchedule) {
    const email = member.Email;
    MembershipManagement.Manager.removeEmails_(email, expirySchedule);
    const scheduleEntries = this.createScheduleEntries_(email, member.Expires);
    expirySchedule.push(...scheduleEntries);
  }

  createScheduleEntries_(email, expiryDate) {
    const scheduleEntries = [];
    Object.keys(this._actionSpecs).filter(type => type.startsWith('Expiry')).forEach((type) => {
      const spec = this._actionSpecs[type];
      const scheduleDate = MembershipManagement.Utils.addDaysToDate(expiryDate, spec.Offset);
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


  static extractDirectorySharing_(txn) {
    return {
      "Directory Share Name": txn.Directory ? txn.Directory.toLowerCase().includes('share name') : false,
      "Directory Share Email": txn.Directory ? txn.Directory.toLowerCase().includes('share email') : false,
      "Directory Share Phone": txn.Directory ? txn.Directory.toLowerCase().includes('share phone') : false,
    }
  }
  addNewMember_(txn, expirySchedule, membershipData) {
    const newMember = {
      Email: txn["Email Address"],
      First: txn["First Name"],
      Last: txn["Last Name"],
      Phone: txn.Phone || '',
      Joined: this._today,
      Period: MembershipManagement.Manager.getPeriod_(txn),
      Expires: MembershipManagement.Utils.calculateExpirationDate(this._today, this._today, MembershipManagement.Manager.getPeriod_(txn)),
      "Renewed On": '',
      Status: "Active",
      ...MembershipManagement.Manager.extractDirectorySharing_(txn)
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
  module.exports = { MembershipManagement };
}