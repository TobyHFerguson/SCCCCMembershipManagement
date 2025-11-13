// When running under Node (tests) require the utils module but do not overwrite
// an existing `MembershipManagement` namespace (it may be declared as const in 1namespaces.js).
if (typeof module !== 'undefined' && module.exports) {
  const mm = require('./utils.js');
  if (typeof MembershipManagement === 'undefined') {
    // expose on global for legacy code that expects a global symbol
    global.MembershipManagement = mm;
  } else {
    // merge Utils if missing to avoid replacing the whole namespace
    MembershipManagement.Utils = MembershipManagement.Utils || mm.Utils;
  }
  // Ensure the rest of the MembershipManagement module augments the namespace for tests
    try {
      // @ts-ignore - MembershipManagement.js augments the global namespace rather than exporting modules
      require('./MembershipManagement');
    } catch (e) {
      // ignore; test harness may load it separately
    }
}

MembershipManagement.Manager = class {
  constructor(actionSpecs, groups, groupManager, sendEmailFun, today) {
    if (!groups || groups.length === 0) { throw new Error('MembershipManager requires a non-empty array of group emails'); }
    this._actionSpecs = actionSpecs;
    this._groups = groups;
    this._groupAddFun = groupManager && groupManager.groupAddFun || (() => { });
    this._groupRemoveFun = groupManager && groupManager.groupRemoveFun || (() => { });
    this._groupEmailReplaceFun = groupManager && groupManager.groupEmailReplaceFun || (() => { });
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
    // Build MultiMap instances for robust index resolution (email -> Set<indices>, phone -> Set<indices>)
    // Only include currently Active members for renewal matching (matches previous behavior).
    const emailMap = new MembershipManagement.MultiMap();
    const phoneMap = new MembershipManagement.MultiMap();
    membershipData.forEach((m, idx) => {
      if (m.Status === 'Active') {
        if (m.Email) {
          emailMap.add(m.Email, idx);
        }
        if (m.Phone) {
          phoneMap.add(m.Phone, idx);
        }
      }
    });

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
        let skipFinalize = false;
        // Build a query-like member object from the transaction for matching
        const queryMember = {
          Email: txn["Email Address"],
          Phone: txn.Phone,
          First: txn["First Name"],
          Last: txn["Last Name"]
        };

        const match = MembershipManagement.Manager.findMemberIndex(queryMember, membershipData, emailMap, phoneMap);

        let message;
        if (match === null) {
          // No candidate found -> treat as new member
          console.log(`transaction on row ${i + 2} ${txn["Email Address"]} is a new member`);
          const newMember = this.addNewMember_(txn, expirySchedule, membershipData);
          // update maps with new index
          const newIndex = membershipData.length - 1;
          if (newMember.Email) {
            emailMap.add(newMember.Email, newIndex);
          }
          if (newMember.Phone) {
            phoneMap.add(newMember.Phone, newIndex);
          }
          this._groups.forEach(g => this._groupAddFun(newMember.Email, g.Email));
          message = {
            to: newMember.Email,
            subject: MembershipManagement.Utils.expandTemplate(this._actionSpecs.Join.Subject, newMember),
            htmlBody: MembershipManagement.Utils.expandTemplate(this._actionSpecs.Join.Body, newMember)
          };
        } else if (typeof match === 'number') {
          // Unambiguous renewing member
          console.log(`transaction on row ${i + 2} ${txn["Email Address"]} is a renewing member`);
          const member = membershipData[match];
          this.renewMember_(txn, member, expirySchedule);
          // If member's email/phone changed, update maps accordingly
          // (rare in renewals, but keep maps consistent)
          if (member.Email) {
            emailMap.add(member.Email, match);
          }
          if (member.Phone) {
            phoneMap.add(member.Phone, match);
          }
          message = {
            to: member.Email,
            subject: MembershipManagement.Utils.expandTemplate(this._actionSpecs.Renew.Subject, member),
            htmlBody: MembershipManagement.Utils.expandTemplate(this._actionSpecs.Renew.Body, member)
          };
        } else if (match instanceof Set) {
          // Ambiguous match: Policy B - DO NOT auto-add. Record ambiguity and notify director.
          const candidateRows = Array.from(match).map(idx => idx + 2);
          console.log(`transaction on row ${i + 2} ${txn["Email Address"]} is ambiguous; candidates: ${candidateRows.join(',')}`);
          // Record ambiguity (store spreadsheet row numbers for readers)
          if (!this._ambiguousTransactions) this._ambiguousTransactions = [];
          this._ambiguousTransactions.push({ txnRow: i + 2, txn: { ...txn }, candidates: candidateRows });

          // Notify membership director if configured
          try {
            const directorEmail = (PropertiesService && PropertiesService.getScriptProperties && PropertiesService.getScriptProperties().getProperty('MEMBERSHIP_DIRECTOR_EMAIL')) || null;
            const subject = `Ambiguous membership payment for ${txn["Email Address"] || ''}`;
            const body = `A payment could not be unambiguously matched to an existing member.\n\nTransaction row: ${i + 2}\nTransaction: ${JSON.stringify(txn)}\n\nCandidate rows: ${JSON.stringify(candidateRows)}\n\nPlease review and resolve by merging records or updating contact details.`;
            if (directorEmail) {
              this._sendEmailFun({ to: directorEmail, subject, htmlBody: body });
            } else {
              console.warn('MEMBERSHIP_DIRECTOR_EMAIL not set; ambiguous transaction notification not sent', { txnRow: i + 2, candidates: candidateRows });
            }
          } catch (notifyErr) {
            console.error('Failed to notify membership director about ambiguous transaction', notifyErr);
          }

          // Do not mark txn as processed; keep it pending
          skipFinalize = true;

          // Attempt to persist ambiguous transactions to a sheet so directors can triage later.
          try {
            const persistResult = this.persistAmbiguousTransactions();
            if (persistResult && persistResult.persisted) {
              console.log(`persistAmbiguousTransactions: persisted ${persistResult.count} ambiguous transactions`);
            } else {
              console.log('persistAmbiguousTransactions: no ambiguous transactions persisted', persistResult && persistResult.reason);
            }
          } catch (perr) {
            console.error('persistAmbiguousTransactions failed', perr && perr.toString ? perr.toString() : perr);
          }
        } else {
          // Unexpected match type - treat as error
          throw new Error('Unexpected match type from findMemberIndex');
        }

        // Send the per-member notification (join/renew) if present and not skipped
        if (!skipFinalize) {
          if (message) this._sendEmailFun(message);

          txn.Timestamp = this._today;
          txn.Processed = this._today;
          recordsChanged = true;
        } else {
          // Ambiguous transaction left unprocessed; ensure we report pending payments
          hasPendingPayments = true;
        }
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

  static getSimilarityMeasure(memberA, memberB) {
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
    //@ts-ignore
    return (a.email && b.email && a.email === b.email) * 4 + (a.phone && b.phone && a.phone === b.phone) * 2 + (a.name && b.name && a.name === b.name);
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

    if (!MembershipManagement.Manager.getSimilarityMeasure(a, b)) {
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
        if (MembershipManagement.Manager.getSimilarityMeasure(membershipData[i], membershipData[j])) {
          similarPairs.push([i, j]);
        }
      }
    }
    return similarPairs;
  }

  static buildMultiMaps(members) {
    const emailMap = new MembershipManagement.MultiMap();
    const phoneMap = new MembershipManagement.MultiMap();

    const normalizeEmail = e => e ? String(e).trim().toLowerCase() : '';
    const normalizePhone = p => p ? String(p).trim() : '';

    members.forEach((member, index) => {
      const e = normalizeEmail(member.Email);
      if (e) emailMap.add(e, index);
      const p = normalizePhone(member.Phone);
      if (p) phoneMap.add(p, index);
    });

    return { emailMap, phoneMap };
  }

  /**
 * Reconciles a new transaction (newMember) against the current membership data using a
 * robust, five-case decision tree and a similarity scoring system to ensure data integrity
 * during batch processing where keys may not be perfectly unique.
 * * **Decision Tree Logic (Applied in Order):**
 * * 1. **Case 5: No Match (Append New):** If zero candidates are found via initial email or phone lookup (allCandidates.size === 0), the submission is treated as a brand new member (returns null).
 * * 2. **Case 1: Unique Match (Safe Update):** If exactly one unique candidate is found across the combined set of email and phone matches (allCandidates.size === 1), it's considered a guaranteed match based on one unique ID (returns index).
 * * 3. **Case 2: Overlapping Match (Safe Update via Intersection):** If multiple candidates exist, but the intersection of the Email match set AND the Phone match set is exactly ONE unique index (intersection.size === 1), the match is confirmed as the same person used both their old email and old phone (returns index).
 * * 4. **Cases 3 & 4: Ambiguous/Scoring Resolution:** If the contact-based methods (1 & 2) fail, the script uses getSimilarityMeasure() on the remaining candidates to find the highest score.
 * - **Resolved (Case 3):** If exactly one candidate achieves the single highest, non-zero score, it's considered the most likely match (returns index).
 * - **Ambiguous (Case 4):** If the best score is zero, or if multiple candidates share the same highest score, the situation is considered ambiguous and unsafe to update (returns null).
 * @param {Object} newMember The submitted renewal data {Email, Phone, Name} (must have matching structure for getSimilarityMeasure).
 * @param {Array<Object>} membershipData The current array of all member records (the source of truth).
 * @param {MembershipManagement.MultiMap} emailMap MultiMap: Email -> Set<Indices>.
 * @param {MembershipManagement.MultiMap} phoneMap MultiMap: Phone -> Set<Indices>.
 * @returns {number | null | Set<number>} The index of the member to update when unambiguous,
 * null when no member can be found, or a Set of ambiguous indices when multiple candidates
 * are equally plausible and manual resolution is required.
 */
static findMemberIndex(newMember, membershipData, emailMap, phoneMap) {
    // Simplified, email-first resolution with phone fallback.
    // Name (first+last) is only used as a tie-breaker when multiple candidates exist for the same channel.
    const normalizeEmail = e => e ? String(e).trim().toLowerCase() : '';
    const normalizePhone = p => p ? String(p).trim() : '';
    const normalizeName = (member) => {
      if (!member) return '';
      const first = (member.First || member.first || member['First Name'] || '') + '';
      const last = (member.Last || member.last || member['Last Name'] || '') + '';
      return (first + ' ' + last).toLowerCase().replace(/[^a-z]/g, '').trim();
    };

    const newEmail = normalizeEmail(newMember.Email || newMember['Email Address'] || newMember.email);
    const newPhone = normalizePhone(newMember.Phone || newMember.phone || newMember['Phone']);
    const nameKey = normalizeName(newMember);

    const emailSet = newEmail ? (emailMap.get(newEmail) || new Set()) : new Set();
    const phoneSet = newPhone ? (phoneMap.get(newPhone) || new Set()) : new Set();

    // Email-first
    if (emailSet.size > 0) {
      if (emailSet.size === 1) return emailSet.values().next().value;
      // multiple email candidates -> try name disambiguation among email matches
      if (nameKey) {
        const matching = [...emailSet].filter(idx => normalizeName(membershipData[idx]) === nameKey);
        if (matching.length === 1) return matching[0];
        if (matching.length > 1) return new Set(matching);
      }
      return new Set([...emailSet]);
    }

    // No email match -> phone fallback
    if (phoneSet.size > 0) {
      if (phoneSet.size === 1) return phoneSet.values().next().value;
      if (nameKey) {
        const matching = [...phoneSet].filter(idx => normalizeName(membershipData[idx]) === nameKey);
        if (matching.length === 1) return matching[0];
        if (matching.length > 1) return new Set(matching);
      }
      return new Set([...phoneSet]);
    }

    // No candidates
    return null;
}

  /**
   * Return a copy of any ambiguous transactions recorded during processing.
   * Useful for UI or retrieval by administrative code.
   * @returns {Array<Object>} copy of ambiguous transactions (may be empty)
   */
  getAmbiguousTransactions() {
    return this._ambiguousTransactions ? this._ambiguousTransactions.slice() : [];
  }

  /**
   * Persist ambiguous transactions to a spreadsheet fiddler named by sheetName.
   * This is best-effort: if the fiddler is not configured the method will catch
   * the error and return a failure object rather than throwing.
   * @param {string} sheetName
   * @returns {{persisted: boolean, count?: number, reason?: string}}
   */
  persistAmbiguousTransactions(sheetName = 'AmbiguousTransactions') {
    try {
      if (!this._ambiguousTransactions || this._ambiguousTransactions.length === 0) {
        return { persisted: false, reason: 'no_ambiguous_transactions' };
      }
      // Prepare rows aligned with other fiddlers: an object-per-row map
      // Build rows with identity fields (Email, Phone, First, Last) for easier triage
      const rows = this._ambiguousTransactions.map(a => {
        return {
          'Txn Row': a.txnRow,
          'Email': a.txn && (a.txn['Email Address'] || a.txn.Email) || '',
          'Phone': a.txn && (a.txn.Phone || a.txn['Phone']) || '',
          'First': a.txn && (a.txn['First Name'] || a.txn.First) || '',
          'Last': a.txn && (a.txn['Last Name'] || a.txn.Last) || '',
          'Candidates': (a.candidates || []).join(','),
          'TxnJSON': JSON.stringify(a.txn || {})
        };
      });

      const fiddler = Common.Data.Storage.SpreadsheetManager.getFiddler(sheetName);
      fiddler.setData(rows).dumpValues();

      // Best-effort: highlight (green) the transaction cell(s) that contributed to the ambiguity
      try {
        const sheet = fiddler.getSheet();
        if (sheet) {
          // Load header to find column indices
          const headerValues = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
          const colIndex = name => {
            const idx = headerValues.findIndex(h => String(h || '').trim() === name);
            return idx >= 0 ? idx + 1 : -1;
          };

          const emailCol = colIndex('Email');
          const phoneCol = colIndex('Phone');
          const firstCol = colIndex('First');
          const lastCol = colIndex('Last');
          const candidatesCol = colIndex('Candidates');

          // Get active members to inspect candidate rows
          let members = [];
          try {
            members = Common.Data.Storage.SpreadsheetManager.getFiddler('ActiveMembers').getData() || [];
          } catch (e) {
            // If ActiveMembers fiddler not available, skip highlighting
            members = [];
          }

          // Iterate each ambiguous row and decide which fields to highlight
          for (let r = 0; r < this._ambiguousTransactions.length; r++) {
            const a = this._ambiguousTransactions[r];
            const sheetRow = r + 2; // data starts at row 2
            const txnEmail = a.txn && (a.txn['Email Address'] || a.txn.Email) ? String(a.txn['Email Address'] || a.txn.Email).trim().toLowerCase() : '';
            const txnPhone = a.txn && (a.txn.Phone || a.txn['Phone']) ? String(a.txn.Phone || a.txn['Phone']).trim() : '';
            const txnFirst = a.txn && (a.txn['First Name'] || a.txn.First) ? String(a.txn['First Name'] || a.txn.First).trim().toLowerCase() : '';
            const txnLast = a.txn && (a.txn['Last Name'] || a.txn.Last) ? String(a.txn['Last Name'] || a.txn.Last).trim().toLowerCase() : '';

            const candidateRows = (a.candidates || []).slice();
            const candidateIndices = candidateRows.map(rn => Number(rn) - 2).filter(idx => idx >= 0 && idx < members.length);

            // Determine matches among candidates
            let emailMatches = 0, phoneMatches = 0, firstMatches = 0, lastMatches = 0;
            const matchedByEmail = new Set();
            const matchedByPhone = new Set();
            for (let idx of candidateIndices) {
              const m = members[idx] || {};
              const me = m.Email ? String(m.Email).trim().toLowerCase() : '';
              const mp = m.Phone ? String(m.Phone).trim() : '';
              const mf = m.First ? String(m.First).trim().toLowerCase() : '';
              const ml = m.Last ? String(m.Last).trim().toLowerCase() : '';
              if (txnEmail && me && me === txnEmail) { emailMatches++; matchedByEmail.add(idx); }
              if (txnPhone && mp && mp === txnPhone) { phoneMatches++; matchedByPhone.add(idx); }
              if (txnFirst && mf && mf === txnFirst) { firstMatches++; }
              if (txnLast && ml && ml === txnLast) { lastMatches++; }
            }

            // Decide which cells to highlight
            const highlights = [];
            // If email matched more than one candidate -> email caused ambiguity
            if (txnEmail && emailMatches > 1) highlights.push(emailCol);
            // If phone matched more than one candidate -> phone caused ambiguity
            if (txnPhone && phoneMatches > 1) highlights.push(phoneCol);
            // Cross-channel conflict: email matches some candidate(s) and phone matches some other candidate(s) and they are not the exact same single candidate
            if (txnEmail && txnPhone && matchedByEmail.size > 0 && matchedByPhone.size > 0) {
              const intersection = [...matchedByEmail].filter(x => matchedByPhone.has(x));
              if (intersection.length === 0) {
                // both fields point to different candidates -> highlight both
                if (emailCol > 0) highlights.push(emailCol);
                if (phoneCol > 0) highlights.push(phoneCol);
              }
            }
            // Name-based ambiguity: if first or last match multiple candidates, highlight
            if (txnFirst && firstMatches > 1) highlights.push(firstCol);
            if (txnLast && lastMatches > 1) highlights.push(lastCol);

            // Apply green background for each highlighted cell
            for (const c of highlights) {
              if (c > 0) {
                try {
                  sheet.getRange(sheetRow, c).setBackground('#d9ead3');
                } catch (e) {
                  // best-effort
                }
              }
            }
          }
        }
      } catch (e) {
        // non-fatal: highlighting is optional
        console.warn('persistAmbiguousTransactions: highlighting failed', e && e.toString ? e.toString() : e);
      }

      return { persisted: true, count: rows.length };
    } catch (err) {
      console.error('persistAmbiguousTransactions: failed to persist ambiguous transactions', err && err.toString ? err.toString() : err);
      return { persisted: false, reason: err && err.toString ? err.toString() : String(err) };
    }
  }

}

if (typeof module !== 'undefined' && module.exports) {
  //@ts-ignore
  module.exports = { MembershipManagement };
}