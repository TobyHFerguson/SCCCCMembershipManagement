// @ts-check
/// <reference path="../../types/global.d.ts" />

/**
 * DirectoryService.Manager - Pure business logic for directory management
 * 
 * This module contains all business logic for the member directory.
 * It is fully testable with Jest as it has no GAS dependencies.
 * 
 * Architecture follows GAS Layer Separation pattern:
 * - Manager: Pure logic (testable)
 * - GAS layer (WebApp.js, Api.js): Orchestration and GAS API calls
 * 
 * @namespace DirectoryService.Manager
 */

// Namespace declaration pattern (works in both GAS and Jest)
// @ts-ignore - Initializing namespace before adding properties
if (typeof DirectoryService === 'undefined') DirectoryService = {};

/**
 * @typedef {Object} DirectoryEntry
 * @property {string} First - First name
 * @property {string} Last - Last name
 * @property {string} email - Email address (empty if not shared)
 * @property {string} phone - Phone number (empty if not shared)
 */

/**
 * @typedef {Object} Member
 * @property {string} Status - Member status (e.g., 'Active')
 * @property {string} Email - Member email
 * @property {string} First - First name
 * @property {string} Last - Last name
 * @property {string} Phone - Phone number
 * @property {boolean} DirectoryShareName - Whether to share name in directory (mapped from 'Directory Share Name')
 * @property {boolean} DirectoryShareEmail - Whether to share email in directory (mapped from 'Directory Share Email')
 * @property {boolean} DirectorySharePhone - Whether to share phone in directory (mapped from 'Directory Share Phone')
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether validation passed
 * @property {string} [error] - Error message if validation failed
 * @property {string} [errorCode] - Machine-readable error code
 */

/**
 * @typedef {Object} FilterOptions
 * @property {string} [searchTerm] - Search term to filter by (matches name)
 * @property {boolean} [activeOnly] - Only include active members (default: true)
 */

/**
 * DirectoryService.Manager - Pure logic class for directory operations
 * All business logic is here and is fully testable with Jest.
 * 
 * @class
 */
DirectoryService.Manager = class {
  /**
   * Filter members to only include those who have opted into directory sharing
   * @param {Member[]} members - All members
   * @returns {Member[]} Members who have opted to share their name in the directory
   */
  static filterPublicMembers(members) {
    if (!Array.isArray(members)) {
      return [];
    }
    return members.filter(member => member && member['Directory Share Name']);
  }

  /**
   * Filter members to only include those with active status
   * @param {Member[]} members - All members
   * @returns {Member[]} Active members only
   */
  static filterActiveMembers(members) {
    if (!Array.isArray(members)) {
      return [];
    }
    return members.filter(member => member && member.Status === 'Active');
  }

  /**
   * Transform a member to a directory entry
   * Applies sharing preferences to hide email/phone as appropriate
   * @param {Member} member - The member to transform
   * @returns {DirectoryEntry} The directory entry
   */
  static transformToDirectoryEntry(member) {
    if (!member) {
      return null;
    }
    return {
      First: member.First || '',
      Last: member.Last || '',
      email: member['Directory Share Email'] ? (member.Email || '') : '',
      phone: member['Directory Share Phone'] ? (member.Phone || '') : ''
    };
  }

  /**
   * Transform members to directory entries
   * @param {Member[]} members - Members to transform
   * @returns {DirectoryEntry[]} Directory entries
   */
  static transformToDirectoryEntries(members) {
    if (!Array.isArray(members)) {
      return [];
    }
    return members
      .map(member => this.transformToDirectoryEntry(member))
      .filter(entry => entry !== null);
  }

  /**
   * Get directory entries from a list of members
   * Filters to active members who have opted to share their name
   * @param {Member[]} members - All members
   * @returns {DirectoryEntry[]} Directory entries for public, active members
   */
  static getDirectoryEntries(members) {
    const activeMembers = this.filterActiveMembers(members);
    const publicMembers = this.filterPublicMembers(activeMembers);
    return this.transformToDirectoryEntries(publicMembers);
  }

  /**
   * Filter directory entries by search term
   * Matches against First and Last name (case-insensitive)
   * @param {DirectoryEntry[]} entries - Directory entries
   * @param {string} searchTerm - Search term
   * @returns {DirectoryEntry[]} Filtered entries
   */
  static filterBySearchTerm(entries, searchTerm) {
    if (!Array.isArray(entries)) {
      return [];
    }
    if (!searchTerm || typeof searchTerm !== 'string') {
      return entries;
    }
    const term = searchTerm.trim().toLowerCase();
    if (term.length === 0) {
      return entries;
    }
    return entries.filter(entry => {
      const firstName = (entry.First || '').toLowerCase();
      const lastName = (entry.Last || '').toLowerCase();
      const fullName = `${firstName} ${lastName}`;
      return firstName.includes(term) || lastName.includes(term) || fullName.includes(term);
    });
  }

  /**
   * Sort directory entries by last name, then first name
   * @param {DirectoryEntry[]} entries - Directory entries
   * @returns {DirectoryEntry[]} Sorted entries
   */
  static sortByName(entries) {
    if (!Array.isArray(entries)) {
      return [];
    }
    return [...entries].sort((a, b) => {
      const lastCompare = (a.Last || '').localeCompare(b.Last || '');
      if (lastCompare !== 0) {
        return lastCompare;
      }
      return (a.First || '').localeCompare(b.First || '');
    });
  }

  /**
   * Process members to get sorted directory entries
   * This is the main entry point for directory data preparation
   * @param {Member[]} members - All members
   * @param {FilterOptions} [options] - Filter options
   * @returns {DirectoryEntry[]} Processed, sorted directory entries
   */
  static processDirectory(members, options = {}) {
    let entries = this.getDirectoryEntries(members);
    
    // Apply search filter if provided
    if (options.searchTerm) {
      entries = this.filterBySearchTerm(entries, options.searchTerm);
    }
    
    // Sort by name
    return this.sortByName(entries);
  }

  /**
   * Validate a search term
   * @param {string} searchTerm - Search term to validate
   * @returns {ValidationResult}
   */
  static validateSearchTerm(searchTerm) {
    if (searchTerm === null || searchTerm === undefined) {
      return { valid: true };
    }
    if (typeof searchTerm !== 'string') {
      return { 
        valid: false, 
        error: 'Search term must be a string', 
        errorCode: 'INVALID_SEARCH_TERM' 
      };
    }
    // Limit search term length to prevent abuse
    if (searchTerm.length > 100) {
      return { 
        valid: false, 
        error: 'Search term must be 100 characters or less', 
        errorCode: 'SEARCH_TERM_TOO_LONG' 
      };
    }
    return { valid: true };
  }

  /**
   * Get directory statistics
   * @param {Member[]} members - All members
   * @returns {{total: number, active: number, public: number}}
   */
  static getDirectoryStats(members) {
    if (!Array.isArray(members)) {
      return { total: 0, active: 0, public: 0 };
    }
    const activeMembers = this.filterActiveMembers(members);
    const publicMembers = this.filterPublicMembers(activeMembers);
    return {
      total: members.length,
      active: activeMembers.length,
      public: publicMembers.length
    };
  }
};

// Node.js export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    Manager: DirectoryService.Manager
  };
}
