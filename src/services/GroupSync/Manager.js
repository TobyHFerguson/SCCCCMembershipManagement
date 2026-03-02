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
 * @typedef {Object} DesiredGroupState
 * @property {string} groupEmail - Lowercase group email address
 * @property {string} groupName - Human-readable group name
 * @property {string[]|null} desiredMembers - Resolved member emails, or null if members should not be synced
 * @property {string[]|null} desiredManagers - Resolved manager emails, or null if managers should not be synced
 * @property {string[]} warnings - Cycle-detection or resolution warnings
 * @property {boolean} usedMembersKeyword - True if the 'Members' keyword was used during member resolution
 */

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
     * @param {Array<{Name: string, Email: string, Subscription: string, Type: string, Members: string, Managers: string}>} groupDefinitions - All group definitions
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
        result.set(groupEmail, {
          groupEmail,
          groupName: group.Name,
          desiredMembers,
          desiredManagers,
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
  }

  return Manager;
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Manager: GroupSync.Manager };
}
