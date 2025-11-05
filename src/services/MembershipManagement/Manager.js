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

  /**
   * Find membershipData indices for two identity objects and verify they share at least
   * one identity characteristic (email, phone, first, last).
   * identityA and identityB are objects with optional keys: email, phone, first, last
   * membershipData is the array of member rows to search.
   * Returns: { success: boolean, indices: [idxA, idxB], shareIdentity: boolean, message: string }
   */
  static findAndValidateIdentities(identityA, identityB, membershipData) {
    function norm(v) { return v ? String(v).trim().toLowerCase() : ''; }
    const a = {
      email: norm(identityA && identityA.email),
      phone: norm(identityA && identityA.phone),
      first: norm(identityA && identityA.first),
      last: norm(identityA && identityA.last)
    };
    const b = {
      email: norm(identityB && identityB.email),
      phone: norm(identityB && identityB.phone),
      first: norm(identityB && identityB.first),
      last: norm(identityB && identityB.last)
    };

    if (!membershipData || !Array.isArray(membershipData)) {
      return { success: false, indices: [-1, -1], shareIdentity: false, message: 'Invalid membershipData' };
    }

    const findIndexFor = (id) => membershipData.findIndex(m => {
      try {
        if (id.email && m.Email && String(m.Email).trim().toLowerCase() === id.email) return true;
        if (id.phone && m.Phone && String(m.Phone).trim().toLowerCase() === id.phone) return true;
        if (id.first && m.First && String(m.First).trim().toLowerCase() === id.first) return true;
        if (id.last && m.Last && String(m.Last).trim().toLowerCase() === id.last) return true;
      } catch (e) { /* ignore */ }
      return false;
    });

    const idxA = findIndexFor(a);
    const idxB = findIndexFor(b);

    if (idxA === -1 || idxB === -1) {
      return { success: false, indices: [idxA, idxB], shareIdentity: false, message: 'Could not resolve one or both selected rows to membershipData indices' };
    }

    const shareIdentity = (
      (a.email && b.email && a.email === b.email) ||
      (a.phone && b.phone && a.phone === b.phone) ||
      (a.first && b.first && a.first === b.first) ||
      (a.last && b.last && a.last === b.last)
    );

    return { success: true, indices: [idxA, idxB], shareIdentity, message: shareIdentity ? 'Resolved and share identity' : 'Resolved but do not share identity' };
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

  /**
   * Combine two member rows where one is an initial join and the other is a later join
   * selectedA and selectedB may be indices into membershipData, email strings, or member objects.
   * The earlier-joined row is treated as INITIAL and the later as LATEST.
   * Rules:
   *  - If LATEST.Joined <= INITIAL.Expires then
   *      LATEST.Expires = INITIAL.Expires + (LATEST.Period) years
   *  - LATEST.Joined = INITIAL.Joined
   *  - Remove the INITIAL entry from membershipData
   *
   * @param {number|string|Object} a - index, email, or member object for first selected row
   * @param {number|string|Object} b - index, email, or member object for second selected row
   * @param {Array<Object>} membershipData - the array of member rows (modified in place)
   * @returns {Object} - { success: boolean, message: string }
   */
  convertJoinToRenew(a, b, membershipData) {
    function resolveIndex(sel) {
      if (typeof sel === 'number') return sel;
      if (typeof sel === 'string' && sel.includes('@')) return membershipData.findIndex(m => m.Email === sel);
      if (sel && typeof sel === 'object') {
        // Try email first
        if (sel.Email) {
          const byEmail = membershipData.findIndex(m => m.Email === sel.Email);
          if (byEmail !== -1) return byEmail;
        }
        // Try phone
        if (sel.Phone) {
          const byPhone = membershipData.findIndex(m => m.Phone && String(m.Phone).trim() === String(sel.Phone).trim());
          if (byPhone !== -1) return byPhone;
        }
        // Try first+last
        if (sel.First || sel.Last) {
          const firstNorm = sel.First ? String(sel.First).trim().toLowerCase() : '';
          const lastNorm = sel.Last ? String(sel.Last).trim().toLowerCase() : '';
          const byName = membershipData.findIndex(m => {
            try {
              const mf = m.First ? String(m.First).trim().toLowerCase() : '';
              const ml = m.Last ? String(m.Last).trim().toLowerCase() : '';
              if (firstNorm && lastNorm) return mf === firstNorm && ml === lastNorm;
            } catch (e) { /* ignore */ }
            return false;
          });
          if (byName !== -1) return byName;
        }
      }
      return -1;
    }

    const idxA = resolveIndex(a);
    const idxB = resolveIndex(b);
    if (idxA < 0 || idxB < 0) {
      return { success: false, message: 'Could not resolve both selected rows to membershipData indices' };
    }

    if (idxA === idxB) return { success: false, message: 'Selections refer to the same row' };

    // Ensure we work with copies to avoid mutation surprises
    const rowA = { ...membershipData[idxA] };
    const rowB = { ...membershipData[idxB] };

    const dateA = MembershipManagement.Utils.dateOnly(rowA.Joined);
    const dateB = MembershipManagement.Utils.dateOnly(rowB.Joined);

    let INITIAL, LATEST, initialIdx, latestIdx;
    if (dateA <= dateB) {
      INITIAL = rowA; INITIAL.Joined = dateA; initialIdx = idxA;
      LATEST = rowB; LATEST.Joined = dateB; latestIdx = idxB;
    } else {
      INITIAL = rowB; INITIAL.Joined = dateB; initialIdx = idxB;
      LATEST = rowA; LATEST.Joined = dateA; latestIdx = idxA;
    }

    // Audit log: resolved rows
    try {
      console.log('convertJoinToRenew: resolved INITIAL and LATEST', {
        initialIdx,
        latestIdx,
        INITIAL: { Email: INITIAL.Email, Joined: INITIAL.Joined, Expires: INITIAL.Expires, Period: INITIAL.Period, 'Directory Share Name': INITIAL['Directory Share Name'], 'Directory Share Email': INITIAL['Directory Share Email'], 'Directory Share Phone': INITIAL['Directory Share Phone'], Migrated: INITIAL['Migrated'], 'Renewed On': INITIAL['Renewed On']  },
        LATEST: { Email: LATEST.Email, Joined: LATEST.Joined, Expires: LATEST.Expires, Period: LATEST.Period, 'Directory Share Name': LATEST['Directory Share Name'], 'Directory Share Email': LATEST['Directory Share Email'], 'Directory Share Phone': LATEST['Directory Share Phone'], Migrated: LATEST['Migrated'], 'Renewed On': LATEST['Renewed On'] }
      });
    } catch (logErr) {
      // logging should never block main flow
      console.log('convertJoinToRenew: logging error', logErr && logErr.toString ? logErr.toString() : logErr);
    }

    // Normalize Expires to Date
    const initialExpires = MembershipManagement.Utils.dateOnly(INITIAL.Expires || INITIAL['Expires']);
    const latestJoined = MembershipManagement.Utils.dateOnly(LATEST.Joined || LATEST['Joined']);

    // If LATEST.Joined <= INITIAL.Expires then extend latest expires by LATEST.Period years from INITIAL.Expires
    try {
      if (latestJoined <= initialExpires) {
        const periodYears = Number(LATEST.Period || LATEST['Period']) || 0;
        const newExpires = MembershipManagement.Utils.addYearsToDate(initialExpires, periodYears);
        const before = { ...membershipData[latestIdx] };
        LATEST.Expires = newExpires;
        LATEST.Migrated = MembershipManagement.Utils.dateOnly(INITIAL.Migrated || INITIAL['Migrated'] || '');
        LATEST['Renewed On'] = MembershipManagement.Utils.dateOnly(LATEST.Joined);

        // set LATEST.Joined to INITIAL.Joined (only when join falls within initial expires)
        LATEST.Joined = MembershipManagement.Utils.dateOnly(INITIAL.Joined);

        // Write LATEST back into membershipData at latestIdx
        membershipData[latestIdx] = { ...membershipData[latestIdx], ...LATEST };

        // Remove INITIAL entry
        const removeIdx = initialIdx;
        membershipData.splice(removeIdx, 1);

        try {
          console.log('convertJoinToRenew: merged rows', {
            mergedIntoIndex: latestIdx > removeIdx ? latestIdx - 1 : latestIdx,
            before,
            after: membershipData[latestIdx > removeIdx ? latestIdx - 1 : latestIdx]
          });
        } catch (logErr) {
          console.log('convertJoinToRenew: logging error after merge', logErr && logErr.toString ? logErr.toString() : logErr);
        }

        return { success: true, message: 'Rows merged successfully', mergedIntoIndex: latestIdx > removeIdx ? latestIdx - 1 : latestIdx };
      }

      // Condition not met: do not modify membershipData
      try {
        console.log('convertJoinToRenew: no merge - LATEST.Joined is after INITIAL.Expires', {
          INITIAL: { Email: INITIAL.Email, Expires: initialExpires },
          LATEST: { Email: LATEST.Email, Joined: latestJoined }
        });
      } catch (logErr) {
        console.log('convertJoinToRenew: logging error for no-merge case', logErr && logErr.toString ? logErr.toString() : logErr);
      }

      return { success: false, message: 'No merge performed: LATEST.Joined is after INITIAL.Expires' };
    } catch (err) {
      return { success: false, message: `Failed to merge rows: ${err && err.toString ? err.toString() : String(err)}` };
    }
  }


}

if (typeof module !== 'undefined' && module.exports) {
  //@ts-ignore
  module.exports = { MembershipManagement };
}