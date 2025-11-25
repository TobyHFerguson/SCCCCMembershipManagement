if (typeof require !== 'undefined') {
  (MembershipManagement = require('./utils.js'));
}

// @ts-check
MembershipManagement.Manager = class {
  constructor(actionSpecs, groups, groupManager, sendEmailFun, today, auditLogger) {
    if (!groups || groups.length === 0) { throw new Error('MembershipManager requires a non-empty array of group emails'); }
    this._actionSpecs = actionSpecs;
    this._groups = groups;
    this._groupAddFun = groupManager && groupManager.groupAddFun || (() => { });
    this._groupRemoveFun = groupManager && groupManager.groupRemoveFun || (() => { });
    this._groupEmailReplaceFun = groupManager && groupManager.groupEmailReplaceFun || (() => { });
    this._sendEmailFun = sendEmailFun || (() => { });
    this._today = MembershipManagement.Utils.dateOnly(today);
    this._auditLogger = auditLogger || null;
  }

  today() {
    return this._today;
  }

  /**
   * Generator: Create list of expiring members to be processed
   * This is a pure generator function that prepares work but does NOT cause business events.
   * Business events (email send, group removal) happen in processExpiredMembers (the consumer).
   * 
   * @param {Member[]} activeMembers 
   * @param {MembershipManagement.ExpirySchedule[]} expirySchedule 
   * @param {string} prefillFormTemplate 
   * @returns {{messages: MembershipManagement.ExpiredMembersQueue}} array of messages to be sent
   */
  generateExpiringMembersList(activeMembers, expirySchedule, prefillFormTemplate) {
    expirySchedule.forEach(sched => { sched.Date = MembershipManagement.Utils.dateOnly(new Date(sched.Date) )});
    expirySchedule.sort((a, b) => {
      const ta = a.Date.getTime();
      const tb = b.Date.getTime();
      if (tb - ta !== 0) {
        return tb - ta;
      }
      return a.Type.localeCompare(b.Type);
    });
    const schedulesToBeProcessed = expirySchedule.reduce((acc, sched, i) => { if (sched.Date <= new Date(this._today)) acc.push(i); return acc; }, []);
    schedulesToBeProcessed.sort((a, b) => b - a);
    
    if (!prefillFormTemplate) {
      console.error("Prefill form template is required");
      return { messages: [] };
    }
    // collect messages to allow generator/consumer separation
    const messages = /** @type {MembershipManagement.ExpiringMember[]} */ [];
    let processedCount = 0;
    let emailsSeen = new Set();
    let expired = new Set();
    for (let idx of schedulesToBeProcessed) {
      processedCount++;
      const sched = expirySchedule[idx];
      const spec = this._actionSpecs[sched.Type];
      console.log(`${sched.Type} - ${sched.Email}`);
      expirySchedule.splice(idx, 1);
      if (emailsSeen.has(sched.Email)) {
        console.log(`Skipping ${sched.Email} for ${sched.Type} - already processed`);
        continue;
      }
      emailsSeen.add(sched.Email);
      let memberIdx = activeMembers.findIndex(member => member.Email === sched.Email && member.Status === 'Active');
      if (memberIdx === -1) {
        console.log(`Skipping member ${sched.Email} - they're not an active member`);
      } else {
        let member = activeMembers[memberIdx];
        let expiredMember = {
          email: member.Email,
          subject: "",
          htmlBody: "",
          groups: null
        };
        if (sched.Type === MembershipManagement.Utils.ActionType.Expiry4) {
          member.Status = 'Expired'
          expiredMember.groups = this._groups.map(g => g.Email).join(',');
          expired.add(member.Email);
        }
    const mc = MembershipManagement.Utils.addPrefillForm(member, prefillFormTemplate);
    expiredMember.subject = MembershipManagement.Utils.expandTemplate(spec.Subject, mc);
    expiredMember.htmlBody = MembershipManagement.Utils.expandTemplate(spec.Body, mc);
        // collect messages for the consumer to send
        messages.push(expiredMember);
      }
    }
    
    for (let i = expirySchedule.length - 1; i >= 0; i--) {
        if (expired.has(expirySchedule[i].Email)) {
          expirySchedule.splice(i, 1);
        }
      }
    return { messages };
  }

  /**
   * Consumer: process FIFO items using provided emailSendFun and groupRemoveFun
   * @param {MembershipManagement.FIFOItem[]} fifoItems - Array of FIFO items with attempt bookkeeping
   * @param {function(GoogleAppsScript.Mail.MailAdvancedParameters): void} sendEmailFun
   * @param {function(string, string): void} groupRemoveFun
   * @param {object} opts
   * @returns {{processed: MembershipManagement.FIFOItem[], failed: MembershipManagement.FIFOItem[], auditEntries: any[]}}
   *
   * Returns:
   *  - processed: array of successfully completed FIFOItems
   *  - failed: array of failed FIFOItems with updated bookkeeping (attempts, lastError, nextAttemptAt, dead)
   *  - auditEntries: array of audit log entries for DeadLetter events
   *
   * Notes:
   *  - Manager is authoritative for attempt/backoff decisions
   *  - Updates attempts, lastAttemptAt, lastError, nextAttemptAt, and dead directly on item objects
   *  - Reduces groups in-place on partial success so progress is preserved across re-attempts
   */
  processExpiredMembers(fifoItems, sendEmailFun, groupRemoveFun, opts={}) {
    if (!Array.isArray(fifoItems)) {
      throw new Error('fifoItems must be an array');
    }
    if (typeof sendEmailFun !== 'function') {
      throw new Error('sendEmailFun must be a function');
    }
    if (typeof groupRemoveFun !== 'function') {
      throw new Error('groupRemoveFun must be a function');
    }
    
    const processed = [];
    const failed = [];
    const auditEntries = [];

    const defaultMaxAttempts = opts.maxAttempts !== undefined ? Number(opts.maxAttempts) : 5;
    const computeNext = typeof opts.computeNextAttemptAt === 'function' ? opts.computeNextAttemptAt : (MembershipManagement.Utils && MembershipManagement.Utils.computeNextAttemptAt ? MembershipManagement.Utils.computeNextAttemptAt : null);
    
    for (let i = 0; i < fifoItems.length; i++) {
      const item = fifoItems[i];
      
      // Compute effective maxAttempts: item value → opts value → default 5
      const effectiveMaxAttempts = item.maxAttempts ? Number(item.maxAttempts) : defaultMaxAttempts;
      
      try {
        // Only send email if both subject and htmlBody are present`
        if (item.subject && item.htmlBody) {
          const msg = {
            to: item.email,
            subject: item.subject,
            htmlBody: item.htmlBody
          };
          sendEmailFun(msg);
          // Indicate that the email was successfully sent
          item.subject = '';
          item.htmlBody = '';
        }
        
        if (item.groups) {
          const groups = item.groups.split(',');
          for (let j = groups.length - 1; j >= 0; j--) {
            // attempt to remove each group; if successful, remove it from the local list
            groupRemoveFun(item.email, groups[j]);
            // remove the group from the list and persist the reduction immediately so partial
            // progress is preserved if a later group removal fails.
            groups.splice(j, 1);
            item.groups = groups.join(',');
          }
        }
        
        // Generate audit log entry for successful processing
        if (this._auditLogger) {
          auditEntries.push(this._auditLogger.createLogEntry({
            type: 'ProcessExpiredMember',
            outcome: 'success',
            note: `Successfully processed expiration for ${item.email}`,
            jsonData: {
              email: item.email,
              id: item.id
            }
          })); 
        }
        
        processed.push(item);
      } catch (err) {
        // Attempt bookkeeping: increment attempts and set lastError/lastAttemptAt
        item.attempts = Number(item.attempts || 0) + 1;
        item.maxAttempts = effectiveMaxAttempts;
        item.lastAttemptAt = new Date().toISOString();
        item.lastError = err && err.toString ? err.toString() : String(err);

        // Decide dead-lettering vs re-attempt using this item's effective maxAttempts
        if (Number(item.attempts) >= Number(effectiveMaxAttempts)) {
          item.dead = true;
          item.nextAttemptAt = item.nextAttemptAt || '';
          
          // Generate audit log entry for DeadLetter
          if (this._auditLogger) {
            auditEntries.push(this._auditLogger.createLogEntry({
              type: 'DeadLetter',
              outcome: 'fail',
              note: `Failed to process expiration for ${item.email} after ${item.attempts} attempts`,
              error: item.lastError,
              jsonData: {
                email: item.email,
                attempts: item.attempts,
                lastError: item.lastError,
                id: item.id
              }
            }));
          }
        } else if (computeNext) {
          item.dead = false;
          try {
            item.nextAttemptAt = computeNext(item.attempts);
          } catch (e) {
            // computeNext threw; fallback to 1-minute retry
            item.nextAttemptAt = new Date(Date.now() + 60000).toISOString();
          }
        } else {
          item.dead = false;
          // No computeNext function available; retry in 1 minute
          item.nextAttemptAt = new Date(Date.now() + 60000).toISOString();
        }

        failed.push(item);
      }
    }
    return { processed, failed, auditEntries };
  }

  migrateCEMembers(migrators, members, expirySchedule) {
    const actionSpec = this._actionSpecs[MembershipManagement.Utils.ActionType.Migrate];
    const requiredKeys = ['Email', 'First', 'Last', 'Phone', 'Joined', 'Period', 'Expires', 'Renewed On', 'Directory', 'Migrated', 'Status'];

    let numMigrations = 0;
    const errors = [];
    const auditEntries = [];
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
          
          // Generate audit log entry
          if (this._auditLogger) {
            auditEntries.push(this._auditLogger.createLogEntry({
              type: 'Migrate',
              outcome: 'success',
              note: `Member migrated: ${newMember.Email} (Status: ${mi.Status})`
            }));
          }
        } catch (error) {
          error.rowNum = rowNum;
          error.email = mi.Email;
          errors.push(error);
          
          // Generate audit log entry for failure
          if (this._auditLogger) {
            auditEntries.push(this._auditLogger.createLogEntry({
              type: 'Migrate',
              outcome: 'fail',
              note: `Failed to migrate ${mi.Email}`,
              error: error.message || String(error),
              jsonData: {
                rowNum: rowNum,
                email: mi.Email,
                errorMessage: error.message,
                stack: error.stack
              }
            }));
          }
        }
      }
    });
    return { numMigrations, auditEntries, errors };
  }

  processPaidTransactions(transactions, membershipData, expirySchedule) {
    const activeMembers = membershipData.reduce((acc, m, i) => { if (m.Status === 'Active') { acc.push([m.Email, i]); } return acc }, [])
    const emailToActiveMemberIndexMap = Object.fromEntries(activeMembers);
    const errors = [];
    const auditEntries = [];
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
      const matchIndex = emailToActiveMemberIndexMap[txn["Email Address"]];
      try {
        let message;
        let actionType;
        if (matchIndex !== undefined) { // a renewing member
          console.log(`transaction on row ${i + 2} ${txn["Email Address"]} is a renewing member`);
          const member = membershipData[matchIndex];
          this.renewMember_(txn, member, expirySchedule);
          actionType = 'Renew';
          message = {
            to: member.Email,
            subject: MembershipManagement.Utils.expandTemplate(this._actionSpecs.Renew.Subject, member),
            htmlBody: MembershipManagement.Utils.expandTemplate(this._actionSpecs.Renew.Body, member)
          };
        } else { // a joining member
          console.log(`transaction on row ${i + 2} ${txn["Email Address"]} is a new member`);
          const newMember = this.addNewMember_(txn, expirySchedule, membershipData);
          this._groups.forEach(g => this._groupAddFun(newMember.Email, g.Email));
          actionType = 'Join';
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
        
        // Generate audit log entry
        if (this._auditLogger) {
          auditEntries.push(this._auditLogger.createLogEntry({
            type: actionType,
            outcome: 'success',
            note: `Member ${actionType === 'Join' ? 'joined' : 'renewed'}: ${txn["Email Address"]}`
          }));
        }
      } catch (error) {
        error.txnNum = i + 2;
        error.email = txn["Email Address"];
        errors.push(error);
        
        // Generate audit log entry for failure
        if (this._auditLogger) {
          auditEntries.push(this._auditLogger.createLogEntry({
            type: matchIndex !== undefined ? 'Renew' : 'Join',
            outcome: 'fail',
            note: `Failed to process transaction for ${txn["Email Address"]}`,
            error: error.message || String(error),
            jsonData: {
              txnNum: i + 2,
              email: txn["Email Address"],
              errorMessage: error.message,
              stack: error.stack
            }
          }));
        }
      }
    });
    return { recordsChanged, hasPendingPayments, errors, auditEntries };
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
    member.Expires = MembershipManagement.Utils.calculateExpirationDate(this._today, member.Expires, member.Period);
    Object.assign(member, MembershipManagement.Manager.extractDirectorySharing_(txn));
    this.addRenewedMemberToActionSchedule_(member, expirySchedule);
  }

  addRenewedMemberToActionSchedule_(member, expirySchedule) {
    const email = member.Email;
    this.removeMemberFromExpirySchedule_(email, expirySchedule);
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

  removeMemberFromExpirySchedule_(email, expirySchedule) {
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

  static isSimilarMember(memberA, memberB) {
    const normalize = v => v ? String(v).trim().toLowerCase() : '';
    const a = {
      email: normalize(memberA && memberA.Email),
      phone: normalize(memberA && memberA.Phone),
      name: normalize(memberA && memberA.First + ' ' + memberA && memberA.Last),
    };
    const b = {
      email: normalize(memberB && memberB.Email),
      phone: normalize(memberB && memberB.Phone),
      name: normalize(memberB && memberB.First + ' ' + memberB && memberB.Last),
    };

    // If they share any identity characteristics, they are similar
    let similarityIndex = 0;
    if (a.email && b.email && a.email === b.email) similarityIndex++;
    if (a.phone && b.phone && a.phone === b.phone) similarityIndex++;
    if (a.name && b.name && a.name === b.name) similarityIndex++;
    return 0 < similarityIndex && similarityIndex < 3;
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
   * @param {number} idxA - index for first selected row
   * @param {number} idxB - index for second selected row
   * @param {Array<Object>} membershipData - the array of member rows (modified in place)
   * @param {Array<Object>} expirySchedule - the expiry schedule array (modified in place)
   * @returns {Object} - { success: boolean, message: string }
   */
  convertJoinToRenew(idxA, idxB, membershipData, expirySchedule) {
    if (!(0 <= idxA && idxA < membershipData.length) || !(0 <= idxB && idxB < membershipData.length)) {
      return { success: false, message: `Invalid indices for membershipData: ${idxA}, ${idxB}` };
    }
    if (idxA === idxB) return { success: false, message: 'Selections refer to the same row' };

    const a = membershipData[idxA];
    const b = membershipData[idxB];

    if (!MembershipManagement.Manager.isSimilarMember(a, b)) {
      console.error('convertJoinToRenew: selected rows do not share identity', { idxA, idxB, a: { Email: a.Email, Phone: a.Phone, First: a.First, Last: a.Last }, b: { Email: b.Email, Phone: b.Phone, First: b.First, Last: b.Last } });
      return { success: false, message: 'Selected rows do not share any identity characteristic with one another (email, phone, first, or last name)' };
    }
    // Ensure we work with copies to avoid mutation surprises
    const rowA = { ...membershipData[idxA] };
    const rowB = { ...membershipData[idxB] };

    const dateA = MembershipManagement.Utils.dateOnly(rowA.Joined);
    const dateB = MembershipManagement.Utils.dateOnly(rowB.Joined);

    // Ensure we know which of the two rows is INITIAL and which is LATEST - we want to update LATEST and drop INITIAL
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
        INITIAL: { Email: INITIAL.Email, Joined: INITIAL.Joined, Expires: INITIAL.Expires, Period: INITIAL.Period, 'Directory Share Name': INITIAL['Directory Share Name'], 'Directory Share Email': INITIAL['Directory Share Email'], 'Directory Share Phone': INITIAL['Directory Share Phone'], Migrated: INITIAL['Migrated'], 'Renewed On': INITIAL['Renewed On'] },
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

        // Now we need to update expirySchedule entries for LATEST
        this.addRenewedMemberToActionSchedule_(LATEST, expirySchedule);

        // Now we need to delete the INITIAL entry from expirySchedule
        this.removeMemberFromExpirySchedule_(INITIAL.Email, expirySchedule);

        // change email in all groups if different
        if (INITIAL.Email !== LATEST.Email) {
          let result = this._groupEmailReplaceFun(INITIAL.Email, LATEST.Email);
          if (result && !result.success) {
            console.error(`Error changing email in groups: ${result.message}`);
          }
        }


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

        return { success: true, message: 'Rows merged successfully', initialEmail: INITIAL.Email, latestEmail: LATEST.Email };
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

  static findPossibleRenewals(membershipData) {
    function joinedBeforeExpired(a, b) {
      return ((new Date(a.Joined)) > (new Date(b.Joined)) && new Date(a.Joined) <= new Date(b.Expires)) || (new Date(b.Joined) > new Date(a.Joined) && new Date(b.Joined) <= new Date(a.Expires));
    }
    const similarPairs = [];
    for (let i = 0; i < membershipData.length; i++) {
      if (membershipData[i].Status !== 'Active') continue;
      for (let j = i + 1; j < membershipData.length; j++) {
        if (membershipData[j].Status !== 'Active') continue;
        if (!joinedBeforeExpired(membershipData[i], membershipData[j])) continue;
        if (MembershipManagement.Manager.isSimilarMember(membershipData[i], membershipData[j])) {
          similarPairs.push([i, j]);
        }
      }
    }
    return similarPairs;
  }

  /**
   * Pure function: Select items from queue eligible for processing in current batch
   * @param {MembershipManagement.FIFOItem[]} queue - Queue with ISO string dates
   * @param {number} batchSize - Maximum items to select
   * @param {Date} now - Current time for eligibility check
   * @returns {{eligibleItems: MembershipManagement.FIFOItem[], eligibleIndices: number[]}}
   */
  static selectBatchForProcessing(queue, batchSize, now) {
    const result = queue.reduce((acc, item, index) => {
      // Skip null/undefined items and dead items
      if (!item || item.dead) return acc;
      
      // Check if item is eligible (nextAttemptAt is in the past or empty)
      const next = new Date(item.nextAttemptAt);
      const isEligible = !item.nextAttemptAt || item.nextAttemptAt === '' || isNaN(next.getTime()) || next <= now;
      
      // Skip ineligible items or if batch is full
      if (!isEligible || acc.eligibleItems.length >= batchSize) return acc;
      
      // Add eligible item to batch
      return {
        eligibleItems: [...acc.eligibleItems, item],
        eligibleIndices: [...acc.eligibleIndices, index]
      };
    }, { eligibleItems: [], eligibleIndices: [] });
    return result;
  }

  /**
   * Pure function: Rebuild queue after processing, removing succeeded/dead items, keeping retry items
   * @param {MembershipManagement.FIFOItem[]} originalQueue - Original queue before processing
   * @param {number[]} processedIndices - Indices of items that were selected for processing
   * @param {MembershipManagement.FIFOItem[]} reattemptItems - Items that failed and need retry (with Manager-set nextAttemptAt)
   * @param {MembershipManagement.FIFOItem[]} deadItems - Items marked dead (for reference, not included in result)
   * @returns {MembershipManagement.FIFOItem[]} Updated queue
   */
  static rebuildQueue(originalQueue, processedIndices, reattemptItems, deadItems) {
    const reattemptMap = new Map(reattemptItems.map(item => [item.id, item]));
    const processedIndicesSet = new Set(processedIndices);
    
    const result = originalQueue
      .map((item, idx) => {
        if (!processedIndicesSet.has(idx)) {
          // Item was not selected for processing - keep as-is
          return item;
        }
        // Was selected for processing - check if it needs reattempt
        return reattemptMap.get(item.id) || null; // retry item or null (succeeded/dead)
      })
      .filter(item => item !== null);
    return result;
  }

  /**
   * Pure function: Assign nextAttemptAt timestamps to items that will be in next batch
   * Call this AFTER rebuildQueue to determine what the next batch will actually be
   * NOTE: Queue passed in has already had dead items removed by rebuildQueue
   * @param {MembershipManagement.FIFOItem[]} queue - Queue after rebuild (no dead items)
   * @param {number} batchSize - Batch size for next processing run
   * @param {Date} now - Current time for eligibility check
   * @param {string} nextTriggerTime - ISO string timestamp when next trigger will run
   * @returns {MembershipManagement.FIFOItem[]} Queue with nextAttemptAt set for next batch items
   */
  static assignNextBatchTimestamps(queue, batchSize, now, nextTriggerTime) {
    let nextBatchCount = 0;
    
    return queue.map(item => {
      // Check if item is currently eligible for next batch
      const next = new Date(item.nextAttemptAt);
      const isEligible = !item.nextAttemptAt || item.nextAttemptAt === '' || isNaN(next.getTime()) || next <= now;
      
      if (isEligible) {
        nextBatchCount++;
        if (nextBatchCount <= batchSize) {
          // This item will be in the next batch - set its nextAttemptAt
          return { ...item, nextAttemptAt: nextTriggerTime };
        }
      }
      
      // Not eligible or beyond batch size - return unchanged
      return item;
    });
  }

}

if (typeof module !== 'undefined' && module.exports) {
  //@ts-ignore
  module.exports = { MembershipManagement };
}