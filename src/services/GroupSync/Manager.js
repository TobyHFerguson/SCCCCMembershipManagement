// @ts-check
/// <reference path="../../types/global.d.ts" />

/**
 * GroupSync.Manager - Pure business logic for group membership sync
 *
 * Resolves nested group references in the GroupDefinitions sheet to flat lists
 * of individual email addresses, and computes the desired state for each
 * Google Group. 100% testable with Jest — no GAS dependencies.
 *
 * Sync scope rules (per tracking issue #432):
 *   auto        + Announcement → syncMembers=false, syncManagers=true
 *   manual      + Discussion   → syncMembers=false, syncManagers=false  (skipped)
 *   invitation  + Discussion   → syncMembers=true,  syncManagers=false (unless Managers non-empty)
 *   invitation  + Role         → syncMembers=true,  syncManagers=false (unless Managers non-empty)
 *   any         + Security     → skipped entirely
 *
 * @namespace GroupSync.Manager
 */

// Namespace extension (GroupSync is declared in 1namespaces.js for GAS runtime)
// @ts-ignore - Extending namespace
if (typeof GroupSync === 'undefined') GroupSync = {};

/**
 * @typedef {Object} ResolveResult
 * @property {string[]} emails - Deduplicated, sorted array of lowercase email addresses
 * @property {string[]} warnings - Cycle-detection or other resolution warnings
 * @property {boolean} usedMembersKeyword - True if the 'Members' keyword was encountered during resolution
 */

/**
 * @typedef {Object} ActualMember
 * @property {string} email - Member email address
 * @property {string} role - Role: 'MEMBER', 'MANAGER', or 'OWNER'
 */

/**
 * @typedef {Object} SyncAction
 * @property {string} groupEmail - Group email address
 * @property {string} groupName - Human-readable group name
 * @property {string} userEmail - User email address
 * @property {'ADD'|'REMOVE'|'PROMOTE'|'DEMOTE'} action - Action to perform
 * @property {'MEMBER'|'MANAGER'} targetRole - Target role after the action
 */

/**
 * @typedef {Object} SyncSummary
 * @property {number} groupsProcessed - Number of groups processed
 * @property {number} totalActions - Total number of actions
 * @property {number} adds - Number of ADD actions
 * @property {number} removes - Number of REMOVE actions
 * @property {number} promotes - Number of PROMOTE actions
 * @property {number} demotes - Number of DEMOTE actions
 */

/**
 * @typedef {Object} ComputeActionsResult
 * @property {SyncAction[]} actions - List of sync actions to perform
 * @property {string[]} warnings - Warnings from desired state resolution
 * @property {SyncSummary} summary - Counts of each action type
 */

/**
 * @typedef {Object} InvalidEmailEntry
 * @property {string} email - The normalized email address that is invalid
 * @property {'malformed email'|'non-active member'|'not a club member'} reason - Human-readable reason
 * @property {string} groupName - Name of the group definition where the entry was found
 * @property {string} field - Column where the entry was found: 'Members' or 'Managers'
 */

GroupSync.Manager = (function () {
  class Manager {
    /**
     * Normalize an email entry.
     * If the entry contains '@', return it lowercased and trimmed.
     * If it does not contain '@', append '@sc3.club', then lowercase and trim.
     *
     * @param {string} entry - Raw email entry
     * @returns {string} Normalized lowercase email address
     */
    static normalizeEmail(entry) {
      const trimmed = entry.trim();
      if (trimmed.includes('@')) {
        return trimmed.toLowerCase();
      }
      return (trimmed + '@sc3.club').toLowerCase();
    }

    /**
     * Returns true if the trimmed entry (case-insensitive) matches a Name in
     * the provided groupNameSet.
     *
     * @param {string} entry - Raw entry to test
     * @param {Set<string>} groupNameSet - Set of all group Names (lowercase)
     * @returns {boolean}
     */
    static isGroupReference(entry, groupNameSet) {
      return groupNameSet.has(entry.trim().toLowerCase());
    }

    /**
     * Returns true if the trimmed entry (case-insensitive) is 'Everyone' or 'Anyone'.
     *
     * @param {string} entry - Raw entry to test
     * @returns {boolean}
     */
    static isSpecialKeyword(entry) {
      const lower = entry.trim().toLowerCase();
      return lower === 'everyone' || lower === 'anyone';
    }

    /**
     * Split a comma-separated string into a trimmed, non-empty string array.
     * Returns [] if input is falsy or empty.
     *
     * @param {string} commaString - Comma-separated entry list
     * @returns {string[]}
     */
    static parseEntryList(commaString) {
      if (!commaString) return [];
      return commaString
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);
    }

    /**
     * Resolve an entry list to a deduplicated, sorted array of lowercase email addresses.
     *
     * Resolution rules per entry:
     * 1. 'Everyone' or 'Anyone' (case-insensitive) → skip (documentary keywords only;
     *     auto-group members are subscribed by MembershipManagement lifecycle,
     *     manual-group members self-subscribe)
     * 2. 'Members' (case-insensitive) → add all activeEmails to the result set
     * 3. Matches a group Name → recursively resolve that group's Members
     *    - If the group Name is already in `visited` → skip (cycle detected) + warning
     *    - Uses backtracking so the same group can be visited from independent branches
     * 4. Otherwise → treat as email (normalizeEmail)
     *
     * @param {string[]} entryList - Entries to resolve (output of parseEntryList)
     * @param {Array<{Name: string, Members: string, Managers: string}>} groupDefinitions - All group definitions
     * @param {string[]} activeEmails - Active member email addresses (resolved when 'Members' keyword is encountered)
     * @param {Set<string>} visited - Group Names currently being resolved (for cycle detection)
     * @returns {ResolveResult}
     */
    static resolveToEmails(entryList, groupDefinitions, activeEmails, visited) {
      /** @type {Set<string>} */
      const emailSet = new Set();
      /** @type {string[]} */
      const warnings = [];
      let usedMembersKeyword = false;

      // Build a lookup map: lowercase group name → group definition
      /** @type {Map<string, {Name: string, Members: string, Managers: string}>} */
      const groupByName = new Map();
      for (const gd of groupDefinitions) {
        groupByName.set(gd.Name.toLowerCase(), gd);
      }

      for (const entry of entryList) {
        const trimmed = entry.trim();
        if (!trimmed) continue;

        const lower = trimmed.toLowerCase();

        if (lower === 'everyone' || lower === 'anyone') {
          // Documentary keywords only — not resolved to emails.
          // 'Everyone' (auto groups): members subscribed by MembershipManagement lifecycle.
          // 'Anyone' (manual groups): members self-subscribe.
        } else if (lower === 'members') {
          // Resolves to all active club members
          usedMembersKeyword = true;
          for (const email of activeEmails) {
            emailSet.add(email.toLowerCase());
          }
        } else if (groupByName.has(lower)) {
          // Group reference
          if (visited.has(lower)) {
            warnings.push(`Cycle detected: skipping group '${trimmed}' (already in resolution path)`);
          } else {
            visited.add(lower);
            const referencedGroup = groupByName.get(lower);
            const childEntries = Manager.parseEntryList(referencedGroup.Members);
            const childResult = Manager.resolveToEmails(childEntries, groupDefinitions, activeEmails, visited);
            for (const email of childResult.emails) {
              emailSet.add(email);
            }
            for (const w of childResult.warnings) {
              warnings.push(w);
            }
            if (childResult.usedMembersKeyword) {
              usedMembersKeyword = true;
            }
            visited.delete(lower); // backtrack
          }
        } else {
          // Treat as email address
          emailSet.add(Manager.normalizeEmail(trimmed));
        }
      }

      return {
        emails: Array.from(emailSet).sort(),
        warnings,
        usedMembersKeyword,
      };
    }

    /**
     * Compute the desired membership state for each Google Group based on sync
     * scope rules.
     *
     * Returns a Map keyed by group email (lowercase). Only groups where at least
     * one dimension (members or managers) should be synced are included.
     * Security groups are always excluded.
     *
     * Sync scope rules:
     *   subscription='auto'       → syncMembers=false, syncManagers=true
     *   subscription='manual'     → syncMembers=false, syncManagers=false (skipped)
     *   subscription='invitation' → syncMembers=true, syncManagers=true only if Managers non-empty
     *   type='Security' (any sub) → skipped entirely
     *
     * @param {Array<{Name: string, Email: string, Aliases: string, Subscription: string, Type: string, Members: string, Managers: string}>} groupDefinitions - All group definitions
     * @param {string[]} activeEmails - Active member email addresses (passed to resolveToEmails for 'Members' keyword)
     * @returns {Map<string, DesiredGroupState>}
     */
    static computeDesiredState(groupDefinitions, activeEmails) {
      activeEmails = activeEmails || [];
      /** @type {Map<string, DesiredGroupState>} */
      const result = new Map();

      for (const group of groupDefinitions) {
        // Security groups are always excluded
        if (group.Type.trim().toLowerCase() === 'security') {
          continue;
        }

        const subscription = group.Subscription.trim().toLowerCase();
        let syncMembers = false;
        let syncManagers = false;

        if (subscription === 'auto') {
          syncMembers = false;
          syncManagers = true;
        } else if (subscription === 'manual') {
          syncMembers = false;
          syncManagers = false;
        } else if (subscription === 'invitation') {
          syncMembers = true;
          // Sync managers only if the Managers field is non-empty
          syncManagers = group.Managers.trim().length > 0;
        }

        // If nothing to sync, skip this group
        if (!syncMembers && !syncManagers) {
          continue;
        }

        const allWarnings = [];
        /** @type {string[]|null} */
        let desiredMembers = null;
        /** @type {string[]|null} */
        let desiredManagers = null;
        let usedMembersKeyword = false;

        if (syncMembers) {
          const membersResult = Manager.resolveToEmails(
            Manager.parseEntryList(group.Members),
            groupDefinitions,
            activeEmails,
            new Set()
          );
          desiredMembers = membersResult.emails;
          if (membersResult.usedMembersKeyword) {
            usedMembersKeyword = true;
          }
          for (const w of membersResult.warnings) allWarnings.push(w);
        }

        if (syncManagers) {
          const managersResult = Manager.resolveToEmails(
            Manager.parseEntryList(group.Managers),
            groupDefinitions,
            activeEmails,
            new Set()
          );
          desiredManagers = managersResult.emails;
          for (const w of managersResult.warnings) allWarnings.push(w);
        }

        const groupEmail = group.Email.toLowerCase().trim();

        // Compute desired aliases: parse Aliases field, normalize, filter to valid @sc3.club only
        const aliasEntries = Manager.parseEntryList(group.Aliases || '');
        /** @type {Set<string>} */
        const aliasSet = new Set();
        for (const entry of aliasEntries) {
          const normalized = Manager.normalizeEmail(entry);
          if (Manager.isValidEmail_(normalized) && normalized.endsWith('@sc3.club')) {
            aliasSet.add(normalized.toLowerCase());
          }
        }
        const desiredAliases = Array.from(aliasSet).sort();

        result.set(groupEmail, {
          groupEmail,
          groupName: group.Name,
          desiredMembers,
          desiredManagers,
          desiredAliases,
          warnings: allWarnings,
          usedMembersKeyword,
        });
      }

      return result;
    }
    /**
     * Compute the list of add/remove/promote/demote actions needed to reconcile
     * actual Google Group membership with the desired state.
     *
     * OWNERs are always sacred — they are never added, removed, promoted, or demoted.
     * All email comparisons are case-insensitive.
     *
     * @param {Map<string, DesiredGroupState>} desiredState - Output of computeDesiredState
     * @param {Map<string, ActualMember[]>} actualState - Actual membership keyed by lowercase group email
     * @returns {ComputeActionsResult}
     */
    static computeActions(desiredState, actualState) {
      /** @type {SyncAction[]} */
      const actions = [];
      /** @type {string[]} */
      const warnings = [];

      for (const [groupEmail, desired] of desiredState) {
        // Collect warnings from desired state
        for (const w of desired.warnings) {
          warnings.push(w);
        }

        // Get actual members for this group, normalized to lowercase
        const rawActual = actualState.get(groupEmail) || [];
        // Track OWNER emails — they are always sacred
        const ownerEmailSet = new Set(
          rawActual
            .filter(m => m.role === 'OWNER')
            .map(m => m.email.toLowerCase())
        );
        // Filter out OWNERs before diffing
        const actualNonOwners = rawActual
          .map(m => ({ email: m.email.toLowerCase(), role: m.role }))
          .filter(m => m.role !== 'OWNER');

        const actualByEmail = new Map(actualNonOwners.map(m => [m.email, m.role]));

        // ------------------------------------------------------------------
        // Member reconciliation (only when desiredMembers is not null)
        // ------------------------------------------------------------------
        if (desired.desiredMembers !== null) {
          const desiredMemberSet = new Set(desired.desiredMembers.map(e => e.toLowerCase()));

          // ADD: desired member not in actual (any role) at all, and not an OWNER
          for (const email of desiredMemberSet) {
            if (!actualByEmail.has(email) && !ownerEmailSet.has(email)) {
              actions.push({
                groupEmail: desired.groupEmail,
                groupName: desired.groupName,
                userEmail: email,
                action: 'ADD',
                targetRole: 'MEMBER',
              });
            }
          }

          // REMOVE: actual MEMBER not in desired members and not in desiredManagers
          // (members in desiredManagers will be promoted, not removed)
          const desiredManagerSetForRemove =
            desired.desiredManagers !== null
              ? new Set(desired.desiredManagers.map(e => e.toLowerCase()))
              : new Set();
          for (const [email, role] of actualByEmail) {
            if (role === 'MEMBER' && !desiredMemberSet.has(email) && !desiredManagerSetForRemove.has(email)) {
              actions.push({
                groupEmail: desired.groupEmail,
                groupName: desired.groupName,
                userEmail: email,
                action: 'REMOVE',
                targetRole: 'MEMBER',
              });
            }
          }
        }

        // ------------------------------------------------------------------
        // Manager reconciliation (only when desiredManagers is not null)
        // ------------------------------------------------------------------
        if (desired.desiredManagers !== null) {
          const desiredManagerSet = new Set(desired.desiredManagers.map(e => e.toLowerCase()));
          const desiredMemberSet =
            desired.desiredMembers !== null
              ? new Set(desired.desiredMembers.map(e => e.toLowerCase()))
              : null;

          // For each desired manager:
          for (const email of desiredManagerSet) {
            // OWNERs are sacred — skip
            if (ownerEmailSet.has(email)) continue;
            const currentRole = actualByEmail.get(email);
            if (currentRole === undefined) {
              // Not in actual at all → ADD as MANAGER
              actions.push({
                groupEmail: desired.groupEmail,
                groupName: desired.groupName,
                userEmail: email,
                action: 'ADD',
                targetRole: 'MANAGER',
              });
            } else if (currentRole === 'MEMBER') {
              // In actual as MEMBER → PROMOTE
              actions.push({
                groupEmail: desired.groupEmail,
                groupName: desired.groupName,
                userEmail: email,
                action: 'PROMOTE',
                targetRole: 'MANAGER',
              });
            }
            // currentRole === 'MANAGER' → no action needed
          }

          // For each actual MANAGER not in desired managers:
          for (const [email, role] of actualByEmail) {
            if (role === 'MANAGER' && !desiredManagerSet.has(email)) {
              if (desiredMemberSet !== null) {
                // Members are managed
                if (desiredMemberSet.has(email)) {
                  // Demote to regular member
                  actions.push({
                    groupEmail: desired.groupEmail,
                    groupName: desired.groupName,
                    userEmail: email,
                    action: 'DEMOTE',
                    targetRole: 'MEMBER',
                  });
                } else {
                  // Remove entirely
                  actions.push({
                    groupEmail: desired.groupEmail,
                    groupName: desired.groupName,
                    userEmail: email,
                    action: 'REMOVE',
                    targetRole: 'MEMBER',
                  });
                }
              } else {
                // Members not managed — demote rather than remove
                actions.push({
                  groupEmail: desired.groupEmail,
                  groupName: desired.groupName,
                  userEmail: email,
                  action: 'DEMOTE',
                  targetRole: 'MEMBER',
                });
              }
            }
          }
        }
      }

      // Build summary
      const summary = {
        groupsProcessed: desiredState.size,
        totalActions: actions.length,
        adds: actions.filter(a => a.action === 'ADD').length,
        removes: actions.filter(a => a.action === 'REMOVE').length,
        promotes: actions.filter(a => a.action === 'PROMOTE').length,
        demotes: actions.filter(a => a.action === 'DEMOTE').length,
      };

      return { actions, warnings, summary };
    }

    /**
     * Format the result of computeActions into human-readable lines for display.
     *
     * Warnings appear at the top.
     * Action lines follow.
     * Summary counts appear at the bottom.
     * When there are no actions, a "No changes needed" line is included.
     *
     * @param {ComputeActionsResult} result - Output of computeActions
     * @returns {string[]} Array of human-readable strings
     */
    static formatActionsSummary(result) {
      const lines = [];

      // Warnings at the top
      for (const w of result.warnings) {
        lines.push(`⚠️ WARNING: ${w}`);
      }

      // Actions
      if (result.actions.length === 0) {
        lines.push('No changes needed.');
      } else {
        for (const a of result.actions) {
          if (a.action === 'ADD') {
            lines.push(`ADD ${a.userEmail} → ${a.groupName} (${a.targetRole})`);
          } else if (a.action === 'REMOVE') {
            lines.push(`REMOVE ${a.userEmail} from ${a.groupName} (${a.targetRole})`);
          } else if (a.action === 'PROMOTE') {
            lines.push(`PROMOTE ${a.userEmail} → ${a.groupName} (${a.targetRole})`);
          } else if (a.action === 'DEMOTE') {
            lines.push(`DEMOTE ${a.userEmail} → ${a.groupName} (${a.targetRole})`);
          }
        }
      }

      // Summary counts at the bottom
      const s = result.summary;
      lines.push(
        `Summary: ${s.groupsProcessed} group(s) processed, ${s.totalActions} action(s) — ` +
          `${s.adds} add, ${s.removes} remove, ${s.promotes} promote, ${s.demotes} demote`
      );

      return lines;
    }

    /**
     * Basic email format validation.
     * Returns true if the email contains at least one non-whitespace/non-at-sign
     * character before the at-sign, a domain part, and a TLD.
     *
     * @param {string} email - Already-normalized (lowercased, trimmed) email address
     * @returns {boolean}
     */
    static isValidEmail_(email) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    /**
     * Scan raw group definitions for explicit email entries that are either
     * malformed or refer to a non-active club member.
     *
     * Only explicit individual email entries are checked — the 'Members',
     * 'Everyone', and 'Anyone' keywords and group-name references are all skipped.
     * Known group emails and their aliases are also skipped (they are not people).
     *
     * Validation rules applied to each explicit email after normalization:
     *   1. Malformed — the email does not match a basic address pattern.
     *   2. Non-active member — the email is found in allMemberEmailSet (i.e. the
     *      person is a known club member) but is NOT in activeEmailSet (their
     *      membership has lapsed or is otherwise inactive).
     *   3. Not a club member — the email is not in activeEmailSet at all (unknown
     *      to the Members sheet, or a known ex-member with lapsed membership).
     *
     * @param {Array<{Name: string, Email: string, Aliases: string, Subscription: string, Type: string, Members: string, Managers: string}>} groupDefinitions
     * @param {Set<string>} activeEmailSet - Lowercase emails of currently active members
     * @param {Set<string>} allMemberEmailSet - Lowercase emails of ALL members (any status)
     * @returns {InvalidEmailEntry[]}
     */
    static findInvalidMemberEmails(groupDefinitions, activeEmailSet, allMemberEmailSet) {
      // Build lookups for group names, group emails, and aliases so we can skip them
      const groupNameSet = new Set(groupDefinitions.map(g => g.Name.toLowerCase()));
      const groupEmailSet = new Set(
        groupDefinitions.map(g => g.Email.toLowerCase().trim()).filter(e => e)
      );
      const aliasSet = new Set();
      for (const g of groupDefinitions) {
        if (g.Aliases) {
          for (const alias of g.Aliases.split(',').map(a => a.trim().toLowerCase()).filter(a => a)) {
            aliasSet.add(alias);
          }
        }
      }

      /** @type {InvalidEmailEntry[]} */
      const results = [];
      /** @type {Set<string>} Avoid duplicate entries for the same email+group+field */
      const seen = new Set();

      for (const group of groupDefinitions) {
        for (const field of ['Members', 'Managers']) {
          const entries = Manager.parseEntryList(group[field]);
          for (const entry of entries) {
            const lower = entry.trim().toLowerCase();

            // Skip special keywords
            if (lower === 'members' || lower === 'everyone' || lower === 'anyone') continue;

            // Skip group-name references
            if (groupNameSet.has(lower)) continue;

            // This is an explicit email entry — normalize it
            const email = Manager.normalizeEmail(entry);

            // Skip known group emails and aliases (not individual people)
            if (groupEmailSet.has(email) || aliasSet.has(email)) continue;

            const key = email + '|' + group.Name + '|' + field;
            if (seen.has(key)) continue;
            seen.add(key);

            // Rule 1: malformed
            if (!Manager.isValidEmail_(email)) {
              results.push({ email, reason: 'malformed email', groupName: group.Name, field });
              continue;
            }

            // Rule 2: non-active member (in roster but not active)
            if (allMemberEmailSet.has(email) && !activeEmailSet.has(email)) {
              results.push({ email, reason: 'non-active member', groupName: group.Name, field });
              continue;
            }

            // Rule 3: not a club member at all (email not in the Members sheet)
            if (!activeEmailSet.has(email)) {
              results.push({ email, reason: 'not a club member', groupName: group.Name, field });
            }
          }
        }
      }

      return results;
    }

    /**
     * Return a new desired-state Map with a given set of email addresses removed
     * from every group's desiredMembers and desiredManagers lists.
     *
     * Groups whose state is unaffected are returned unchanged. The original Map
     * is never mutated.
     *
     * @param {Map<string, DesiredGroupState>} desiredState - Output of computeDesiredState
     * @param {Set<string>} emailsToRemove - Lowercase email addresses to exclude
     * @returns {Map<string, DesiredGroupState>}
     */
    static removeEmailsFromDesiredState(desiredState, emailsToRemove) {
      // Normalise the exclusion set to lowercase so comparisons are case-insensitive
      const lowerExclusions = new Set(
        Array.from(emailsToRemove).map(e => e.toLowerCase())
      );
      /** @type {Map<string, DesiredGroupState>} */
      const result = new Map();
      for (const [groupEmail, state] of desiredState) {
        result.set(groupEmail, {
          groupEmail: state.groupEmail,
          groupName: state.groupName,
          desiredMembers:
            state.desiredMembers === null
              ? null
              : state.desiredMembers.filter(e => !lowerExclusions.has(e.toLowerCase())),
          desiredManagers:
            state.desiredManagers === null
              ? null
              : state.desiredManagers.filter(e => !lowerExclusions.has(e.toLowerCase())),
          desiredAliases: state.desiredAliases || [],
          warnings: state.warnings,
          usedMembersKeyword: state.usedMembersKeyword,
        });
      }
      return result;
    }

    /**
     * Return a new actual-state Map with a given set of email addresses removed
     * from every group's member list. OWNERs are never removed regardless of
     * whether their email appears in emailsToRemove.
     *
     * Together with removeEmailsFromDesiredState this ensures that "ignored"
     * emails produce no diff actions at all — neither ADDs from the desired
     * side nor REMOVEs/DEMOTEs from the actual side.
     *
     * The original Map is never mutated.
     *
     * @param {Map<string, ActualMember[]>} actualState - Actual membership keyed by lowercase group email
     * @param {Set<string>} emailsToRemove - Email addresses to exclude (case-insensitive)
     * @returns {Map<string, ActualMember[]>}
     */
    static removeEmailsFromActualState(actualState, emailsToRemove) {
      const lowerExclusions = new Set(
        Array.from(emailsToRemove).map(e => e.toLowerCase())
      );
      /** @type {Map<string, ActualMember[]>} */
      const result = new Map();
      for (const [groupEmail, members] of actualState) {
        result.set(
          groupEmail,
          members.filter(m => m.role === 'OWNER' || !lowerExclusions.has(m.email.toLowerCase()))
        );
      }
      return result;
    }

    /**
     * Scan raw group definitions for alias entries that are either malformed or
     * belong to a non-sc3 domain.
     *
     * Validation rules applied to each alias after normalization:
     *   1. Malformed — the alias does not match a basic address pattern.
     *   2. Non-sc3 domain — the alias is valid but not in the @sc3.club domain.
     *
     * @param {Array<{Name: string, Aliases: string}>} groupDefinitions
     * @returns {InvalidAliasEntry[]}
     */
    static findInvalidAliases(groupDefinitions) {
      /** @type {InvalidAliasEntry[]} */
      const results = [];
      /** @type {Set<string>} Avoid duplicate entries for the same alias+group */
      const seen = new Set();

      for (const group of groupDefinitions) {
        const entries = Manager.parseEntryList(group.Aliases || '');
        for (const entry of entries) {
          const normalized = Manager.normalizeEmail(entry);
          const key = normalized + '|' + group.Name;
          if (seen.has(key)) continue;
          seen.add(key);

          if (!Manager.isValidEmail_(normalized)) {
            results.push({ alias: normalized, reason: 'malformed alias', groupName: group.Name });
            continue;
          }

          if (!normalized.endsWith('@sc3.club')) {
            results.push({ alias: normalized, reason: 'non-sc3 domain', groupName: group.Name });
          }
        }
      }

      return results;
    }

    /**
     * Compute the list of ADD/REMOVE alias actions needed to reconcile the
     * actual Google Group aliases with the desired state.
     *
     * All alias comparisons are case-insensitive.
     *
     * @param {Map<string, DesiredGroupState>} desiredState - Output of computeDesiredState
     * @param {Map<string, string[]>} actualAliasState - Actual aliases keyed by lowercase group email
     * @returns {ComputeAliasActionsResult}
     */
    static computeAliasActions(desiredState, actualAliasState) {
      /** @type {AliasAction[]} */
      const aliasActions = [];

      for (const [groupEmail, desired] of desiredState) {
        const actualRaw = actualAliasState.get(groupEmail) || [];
        const actualSet = new Set(actualRaw.map(a => a.toLowerCase()));
        const desiredSet = new Set((desired.desiredAliases || []).map(a => a.toLowerCase()));

        // ADD: desired alias not in actual
        for (const alias of desiredSet) {
          if (!actualSet.has(alias)) {
            aliasActions.push({ groupEmail: desired.groupEmail, groupName: desired.groupName, alias, action: 'ADD' });
          }
        }

        // REMOVE: actual alias not in desired
        for (const alias of actualSet) {
          if (!desiredSet.has(alias)) {
            aliasActions.push({ groupEmail: desired.groupEmail, groupName: desired.groupName, alias, action: 'REMOVE' });
          }
        }
      }

      const aliasSummary = {
        totalAliasActions: aliasActions.length,
        aliasAdds: aliasActions.filter(a => a.action === 'ADD').length,
        aliasRemoves: aliasActions.filter(a => a.action === 'REMOVE').length,
      };

      return { aliasActions, aliasSummary };
    }
  }

  return Manager;
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Manager: GroupSync.Manager };
}
