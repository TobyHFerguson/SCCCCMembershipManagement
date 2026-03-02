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
 */

/**
 * @typedef {Object} ResolveResult
 * @property {string[]} emails - Deduplicated, sorted array of lowercase email addresses
 * @property {string[]} warnings - Cycle-detection or other resolution warnings
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
     * 2. Matches a group Name → recursively resolve that group's Members
     *    - If the group Name is already in `visited` → skip (cycle detected) + warning
     *    - Uses backtracking so the same group can be visited from independent branches
     * 3. Otherwise → treat as email (normalizeEmail)
     *
     * @param {string[]} entryList - Entries to resolve (output of parseEntryList)
     * @param {Array<{Name: string, Members: string, Managers: string}>} groupDefinitions - All group definitions
     * @param {Set<string>} visited - Group Names currently being resolved (for cycle detection)
     * @returns {ResolveResult}
     */
    static resolveToEmails(entryList, groupDefinitions, visited) {
      /** @type {Set<string>} */
      const emailSet = new Set();
      /** @type {string[]} */
      const warnings = [];

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
        } else if (groupByName.has(lower)) {
          // Group reference
          if (visited.has(lower)) {
            warnings.push(`Cycle detected: skipping group '${trimmed}' (already in resolution path)`);
          } else {
            visited.add(lower);
            const referencedGroup = groupByName.get(lower);
            const childEntries = Manager.parseEntryList(referencedGroup.Members);
            const childResult = Manager.resolveToEmails(childEntries, groupDefinitions, visited);
            for (const email of childResult.emails) {
              emailSet.add(email);
            }
            for (const w of childResult.warnings) {
              warnings.push(w);
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
     * @returns {Map<string, DesiredGroupState>}
     */
    static computeDesiredState(groupDefinitions) {
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

        if (syncMembers) {
          const membersResult = Manager.resolveToEmails(
            Manager.parseEntryList(group.Members),
            groupDefinitions,
            new Set()
          );
          desiredMembers = membersResult.emails;
          for (const w of membersResult.warnings) allWarnings.push(w);
        }

        if (syncManagers) {
          const managersResult = Manager.resolveToEmails(
            Manager.parseEntryList(group.Managers),
            groupDefinitions,
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
        });
      }

      return result;
    }
  }

  return Manager;
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Manager: GroupSync.Manager };
}
