function showMissingRwgpsMembersSheetDialog_() {
  const membersPageUrl = 'https://ridewithgps.com/clubs/47-santa-cruz-county-cycling-club/members';
  const dialog = HtmlService.createHtmlOutput(
    '<p>The <strong>RWGPS Members</strong> sheet was not found.</p>' +
    '<p>Create it by downloading the members spreadsheet from the club\'s Ride with GPS account:</p>' +
    `<p><a href="${membersPageUrl}" target="_blank">Open the club members page</a></p>`
  ).setWidth(420).setHeight(170);

  SpreadsheetApp.getUi().showModalDialog(dialog, 'RWGPS Members Sheet Required');
}

function extractUnmatchedAndExpired() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rwgpsSheet = ss.getSheetByName("RWGPS Members");

  if (!rwgpsSheet) {
    showMissingRwgpsMembersSheetDialog_();
    return;
  }

  const rwgpsData = rwgpsSheet.getDataRange().getValues();
  if (rwgpsData.length < 2) return;

  const headers = rwgpsData[0];

  // Helper: Find 0-based column index by header name (case-insensitive)
  function getHeaderIndex(headerList, targetName) {
    const target = targetName.toLowerCase().trim();
    return headerList.findIndex(h => String(h).toLowerCase().trim() === target);
  }

  const statusIdx = getHeaderIndex(headers, 'Match Status');
  const firstNameIdx = getHeaderIndex(headers, 'First name');
  const lastNameIdx = getHeaderIndex(headers, 'Last name');

  if (statusIdx === -1) {
    Logger.log("Could not find 'Match Status' column on 'RWGPS Members' sheet. Run reconcileRwgpsMembers first.");
    return;
  }
  if (firstNameIdx === -1 || lastNameIdx === -1) {
    Logger.log("Could not find 'First name' or 'Last name' column on 'RWGPS Members' sheet.");
    return;
  }

  // Filter rows where Match Status indicates unmatched, flagged, or expired/inactive
  const targetRows = [];

  for (let i = 1; i < rwgpsData.length; i++) {
    const row = rwgpsData[i];
    const status = String(row[statusIdx] || '').toLowerCase();

    // Include unmatched, flagged, or inactive/expired statuses
    const isUnmatchedOrExpired =
      status.includes('unmatched') ||
      status.includes('flagged') ||
      status.includes('inactive') ||
      status.includes('expired');

    if (isUnmatchedOrExpired) {
      targetRows.push(row);
    }
  }

  targetRows.sort((a, b) => {
    const lastNameOrder = String(a[lastNameIdx] || '').localeCompare(String(b[lastNameIdx] || ''), undefined, { sensitivity: 'base' });
    if (lastNameOrder !== 0) return lastNameOrder;
    return String(a[firstNameIdx] || '').localeCompare(String(b[firstNameIdx] || ''), undefined, { sensitivity: 'base' });
  });

  // Create or reset the output sheet
  const targetSheetName = "Unmatched & Expired RWGPS";
  let outputSheet = ss.getSheetByName(targetSheetName);

  if (outputSheet) {
    outputSheet.clear(); // Clear existing content if sheet already exists
  } else {
    outputSheet = ss.insertSheet(targetSheetName);
  }

  // Write headers and filtered rows
  outputSheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");

  if (targetRows.length > 0) {
    outputSheet.getRange(2, 1, targetRows.length, headers.length).setValues(targetRows);
    outputSheet.autoResizeColumns(1, headers.length);
  }

  Logger.log(`Extracted ${targetRows.length} rows to sheet '${targetSheetName}'.`);
}

function reconcileRwgpsMembers() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const membersSheet = ss.getSheetByName("Members");
  const rwgpsSheet = ss.getSheetByName("RWGPS Members");

  if (!rwgpsSheet) {
    showMissingRwgpsMembersSheetDialog_();
    return;
  }

  if (!membersSheet) {
    Logger.log("Sheet 'Members' not found.");
    return;
  }

  // Helper: Find 0-based column index by header name (case-insensitive)
  function getHeaderIndex(headers, targetName) {
    const target = targetName.toLowerCase().trim();
    return headers.findIndex(h => String(h).toLowerCase().trim() === target);
  }

  const membersData = membersSheet.getDataRange().getValues();
  const rwgpsData = rwgpsSheet.getDataRange().getValues();

  if (membersData.length < 2 || rwgpsData.length < 2) return;

  const memHeaders = membersData[0];
  const rwgpsHeaders = rwgpsData[0];

  // Headers for 'Members' sheet: Email, First, Last, Status
  const memEmailIdx = getHeaderIndex(memHeaders, 'Email');
  const memFirstIdx = getHeaderIndex(memHeaders, 'First');
  const memLastIdx = getHeaderIndex(memHeaders, 'Last');
  const memStatusIdx = getHeaderIndex(memHeaders, 'Status');

  // Headers for 'RWGPS Members' sheet: Email, First name, Last name
  const rwgpsEmailIdx = getHeaderIndex(rwgpsHeaders, 'Email');
  const rwgpsFirstIdx = getHeaderIndex(rwgpsHeaders, 'First name');
  const rwgpsLastIdx = getHeaderIndex(rwgpsHeaders, 'Last name');

  if (memFirstIdx === -1 || memLastIdx === -1) {
    Logger.log("Could not find 'First' or 'Last' columns on Members sheet.");
    return;
  }

  if (rwgpsFirstIdx === -1 || rwgpsLastIdx === -1) {
    Logger.log("Could not find 'First name' or 'Last name' columns on RWGPS Members sheet.");
    return;
  }

  // Sanitizes string: removes spaces, punctuation, and converts to lowercase
  const sanitize = str => String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const clubEntryNames = new Set(['santacruzcyclingclub', 'tobedetermined']);

  // Common public domains to ignore
  const PUBLIC_DOMAINS = new Set([
    'gmail', 'yahoo', 'hotmail', 'outlook', 'icloud', 'me', 'comcast',
    'sbcglobal', 'att', 'verizon', 'aol', 'msn', 'live', 'charter', 'cox', 'proton'
  ]);

  // Helper to extract email domain without TLD (e.g., 'scccc@pennellos.com' -> 'pennellos')
  const getEmailDomain = emailStr => {
    const parts = String(emailStr || '').toLowerCase().split('@');
    if (parts.length < 2) return '';
    const domain = parts[1].split('.')[0].replace(/[^a-z0-9]/g, '');
    return PUBLIC_DOMAINS.has(domain) ? '' : domain;
  };

  // 1. Pre-scan Members to track which Emails & Names have ANY Active record
  const activeEmails = new Set();
  const activeNameKeys = new Set();

  for (let i = 1; i < membersData.length; i++) {
    const row = membersData[i];
    const email = sanitize(row[memEmailIdx]);
    const firstName = sanitize(row[memFirstIdx]);
    const lastName = sanitize(row[memLastIdx]);
    const rawStatus = memStatusIdx !== -1 ? String(row[memStatusIdx]).trim() : '';

    if (rawStatus.toLowerCase() === 'active') {
      if (email) activeEmails.add(email);
      if (firstName && lastName) activeNameKeys.add(`${firstName}|${lastName}`);
    }
  }

  // 2. Build Lookup Maps for Main Members
  // Prefer active records if duplicates exist during map population
  const emailMap = new Map();
  const domainMap = new Map();   // Maps private surname domains to members
  const nameMap = new Map();     // Maps sanitized "first|last" to members
  const lastNameMap = new Map(); // Maps sanitized last name to an array of members

  for (let i = 1; i < membersData.length; i++) {
    const row = membersData[i];
    const email = sanitize(row[memEmailIdx]);
    const firstName = sanitize(row[memFirstIdx]);
    const lastName = sanitize(row[memLastIdx]);
    const memDomain = getEmailDomain(row[memEmailIdx]);
    const rawStatus = memStatusIdx !== -1 ? String(row[memStatusIdx]).trim() : '';
    const isActive = rawStatus.toLowerCase() === 'active';

    const memberRef = {
      rowIndex: i + 1,
      originalEmail: row[memEmailIdx],
      originalName: `${row[memFirstIdx]} ${row[memLastIdx]}`.trim(),
      firstName: firstName,
      lastName: lastName,
      memDomain: memDomain,
      status: rawStatus,
      isActive: isActive
    };

    // Store exact email match (prefer active entry if duplicate exists)
    if (email && (!emailMap.has(email) || isActive)) {
      emailMap.set(email, memberRef);
    }

    // If member email is on a private domain AND that domain matches their surname
    if (memDomain && lastName && (memDomain.includes(lastName) || lastName.includes(memDomain))) {
      if (!domainMap.has(memDomain) || isActive) {
        domainMap.set(memDomain, memberRef);
      }
    }

    // Store first and last name combination match (prefer active entry if duplicate exists)
    if (firstName && lastName) {
      const nameKey = `${firstName}|${lastName}`;
      if (!nameMap.has(nameKey) || isActive) {
        nameMap.set(nameKey, memberRef);
      }
    }

    // Store last name array match for final fallback check
    if (lastName) {
      if (!lastNameMap.has(lastName)) {
        lastNameMap.set(lastName, []);
      }
      lastNameMap.get(lastName).push(memberRef);
    }
  }

  // 3. Pass 1: Run High-Confidence Matches (Steps 1–3) and Track Claimed Members
  const rwgpsMatches = new Array(rwgpsData.length - 1).fill(null);
  const matchedMemberRowIndexes = new Set(); // Tracks row indexes of Members already matched

  for (let j = 1; j < rwgpsData.length; j++) {
    const idx = j - 1;
    const row = rwgpsData[j];
    const rawEmail = row[rwgpsEmailIdx];
    const email = sanitize(rawEmail);
    const rwgpsDomain = getEmailDomain(rawEmail);
    const rwgpsFirst = sanitize(row[rwgpsFirstIdx]);
    const rwgpsLast = sanitize(row[rwgpsLastIdx]);
    const rwgpsNameKey = `${rwgpsFirst}|${rwgpsLast}`;

    if (clubEntryNames.has(`${rwgpsFirst}${rwgpsLast}`)) continue;

    let match = null;
    let matchType = "";

    // Step 1: Check Exact Email Match
    if (email && emailMap.has(email)) {
      match = emailMap.get(email);
      matchType = "Exact Email";
    }
    // Step 2: Check Private Domain Match
    else if (rwgpsDomain && domainMap.has(rwgpsDomain)) {
      match = domainMap.get(rwgpsDomain);
      matchType = "Probable Match: Private Domain";
    }
    // Step 3: Check First and Last Name Match
    else if (rwgpsFirst && rwgpsLast && nameMap.has(rwgpsNameKey)) {
      match = nameMap.get(rwgpsNameKey);
      matchType = "Probable Match: Name Only";
    }

    if (match) {
      rwgpsMatches[idx] = { match, matchType };
      matchedMemberRowIndexes.add(match.rowIndex);
    }
  }

  // 4. Pass 2: Fallback — Last Name Match (Strictly for unassigned RWGPS & unassigned Members)
  const statusOutput = [];
  const matchDetailsOutput = [];

  for (let j = 1; j < rwgpsData.length; j++) {
    const idx = j - 1;
    const row = rwgpsData[j];
    const rawEmail = row[rwgpsEmailIdx];
    const rwgpsFirst = sanitize(row[rwgpsFirstIdx]);
    const rwgpsLast = sanitize(row[rwgpsLastIdx]);

    if (clubEntryNames.has(`${rwgpsFirst}${rwgpsLast}`)) {
      statusOutput.push(['Club Entry']);
      matchDetailsOutput.push(['Club-level entry; not an individual member.']);
      continue;
    }

    let status = "Flagged: Unmatched";
    let detail = "No match found in Members sheet";

    let matchObj = rwgpsMatches[idx];

    // Step 4: If no match from Pass 1, check for available Surname-only match
    if (!matchObj && rwgpsLast && lastNameMap.has(rwgpsLast)) {
      // Filter candidates to only those Members who have NOT matched anyone yet
      const availableCandidates = lastNameMap.get(rwgpsLast).filter(m => !matchedMemberRowIndexes.has(m.rowIndex));

      if (availableCandidates.length === 1) {
        const candidate = availableCandidates[0];
        matchObj = { match: candidate, matchType: "Possible Match: Last Name Only" };
        matchedMemberRowIndexes.add(candidate.rowIndex);
      } else if (availableCandidates.length > 1) {
        status = "Flagged: Multiple Surname Matches";
        detail = `Found ${availableCandidates.length} unassigned members with last name "${row[rwgpsLastIdx]}": ` +
                 availableCandidates.map(m => `${m.originalName} (Row ${m.rowIndex})`).join(', ');
      }
    }

    if (matchObj) {
      const { match, matchType } = matchObj;

      // Determine if person has ANY active record across duplicate entries
      const hasActiveRecord = match.isActive ||
              (match.email && activeEmails.has(match.email)) ||
                              (match.firstName && match.lastName && activeNameKeys.has(`${match.firstName}|${match.lastName}`));

      if (hasActiveRecord) {
        if (matchType === "Exact Email") {
          status = "Exact Match (Email)";
          detail = `Matched: ${match.originalName} (Row ${match.rowIndex})`;
        } else if (matchType === "Probable Match: Private Domain") {
          status = "Probable Match: Private Domain";
          detail = `Matched: ${match.originalName} (Row ${match.rowIndex}) — shared surname domain (@${getEmailDomain(rawEmail)})`;
        } else if (matchType === "Probable Match: Name Only") {
          status = "Probable Match: Name Only";
          detail = `Matched: ${match.originalName} (Row ${match.rowIndex}) — different email (${rawEmail || 'None'})`;
        } else {
          status = "Possible Match: Last Name Only";
          detail = `Possible Match: ${match.originalName} (Row ${match.rowIndex}) — shared last name "${row[rwgpsLastIdx]}"`;
        }
      } else {
        status = `Matched: Inactive Member (${match.status || 'Expired'})`;
        detail = `Matched ${match.originalName} (Row ${match.rowIndex}) — Status: "${match.status || 'Expired'}" (No Active records found)`;
      }
    }

    statusOutput.push([status]);
    matchDetailsOutput.push([detail]);
  }

  // 5. Write results back to RWGPS Members sheet
  let matchStatusColIdx = getHeaderIndex(rwgpsHeaders, 'Match Status');
  let matchDetailsColIdx = getHeaderIndex(rwgpsHeaders, 'Match Details');

  if (matchStatusColIdx === -1) {
    matchStatusColIdx = rwgpsHeaders.length;
    rwgpsSheet.getRange(1, matchStatusColIdx + 1).setValue("Match Status");
  }
  if (matchDetailsColIdx === -1) {
    matchDetailsColIdx = rwgpsHeaders.length + (matchStatusColIdx === rwgpsHeaders.length ? 1 : 0);
    rwgpsSheet.getRange(1, matchDetailsColIdx + 1).setValue("Match Details");
  }

  rwgpsSheet.getRange(2, matchStatusColIdx + 1, statusOutput.length, 1).setValues(statusOutput);
  rwgpsSheet.getRange(2, matchDetailsColIdx + 1, matchDetailsOutput.length, 1).setValues(matchDetailsOutput);
}

function checkRWGPSClubAccount() {
  const rwgpsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('RWGPS Members');
  if (!rwgpsSheet) {
    showMissingRwgpsMembersSheetDialog_();
    return;
  }

  reconcileRwgpsMembers();
  extractUnmatchedAndExpired();
}