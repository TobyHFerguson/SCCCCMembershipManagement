// @ts-check
/// <reference path="../../types/global.d.ts" />

/**
 * HomePageManager - Pure business logic for the service home page
 * 
 * This module contains all business logic for the authenticated home page
 * that displays available services after verification code authentication.
 * It is fully testable with Jest as it has no GAS dependencies.
 * 
 * Architecture follows GAS Layer Separation pattern:
 * - Manager: Pure logic (testable)
 * - GAS layer: Orchestration and GAS API calls
 * 
 * @namespace Common.HomePage.Manager
 */

// Namespace declaration pattern (works in both GAS and Jest)
if (typeof Common === 'undefined') Common = {};
if (typeof Common.HomePage === 'undefined') Common.HomePage = {};

/**
 * @typedef {Object} ServiceInfo
 * @property {string} id - Service identifier (e.g., 'GroupManagementService')
 * @property {string} name - Human-readable service name (e.g., 'Group Management Service')
 * @property {string} description - Brief description of the service
 * @property {string} icon - CSS class for the service icon (optional)
 */

/**
 * @typedef {Object} HomePageData
 * @property {string} email - Authenticated user email
 * @property {ServiceInfo[]} services - List of available services
 * @property {string} welcomeMessage - Welcome message to display
 */

/**
 * Common.HomePage.Manager - Pure logic class for home page operations
 * All business logic is here and is fully testable with Jest.
 * 
 * @class
 */
Common.HomePage.Manager = class {
  /**
   * Service definitions with metadata
   * @type {Object.<string, {name: string, description: string, icon: string}>}
   */
  static SERVICE_DEFINITIONS = {
    DirectoryService: {
      name: 'Directory Service',
      description: 'View the member directory with contact information',
      icon: 'directory'
    },
    EmailChangeService: {
      name: 'Email Change Service',
      description: 'Update your email address across all SCCCC systems',
      icon: 'email'
    },
    GroupManagementService: {
      name: 'Group Management Service',
      description: 'Manage your mailing list subscriptions',
      icon: 'groups'
    },
    ProfileManagementService: {
      name: 'Profile Management Service',
      description: 'Update your member profile and preferences',
      icon: 'profile'
    },
    VotingService: {
      name: 'Voting Service',
      description: 'Participate in SCCCC elections',
      icon: 'voting'
    }
  };

  /**
   * Get all available services as ServiceInfo array
   * @returns {ServiceInfo[]} Array of service information
   */
  static getAvailableServices() {
    return Object.entries(this.SERVICE_DEFINITIONS).map(([id, info]) => ({
      id,
      name: info.name,
      description: info.description,
      icon: info.icon
    }));
  }

  /**
   * Get service info by ID
   * @param {string} serviceId - The service identifier
   * @returns {ServiceInfo|null} Service info or null if not found
   */
  static getServiceById(serviceId) {
    if (!serviceId || typeof serviceId !== 'string') {
      return null;
    }
    const info = this.SERVICE_DEFINITIONS[serviceId];
    if (!info) {
      return null;
    }
    return {
      id: serviceId,
      name: info.name,
      description: info.description,
      icon: info.icon
    };
  }

  /**
   * Validate a service ID
   * @param {string} serviceId - The service identifier to validate
   * @returns {{valid: boolean, error?: string, errorCode?: string}}
   */
  static validateServiceId(serviceId) {
    if (!serviceId || typeof serviceId !== 'string') {
      return {
        valid: false,
        error: 'Service ID is required',
        errorCode: 'MISSING_SERVICE_ID'
      };
    }
    if (!this.SERVICE_DEFINITIONS[serviceId]) {
      return {
        valid: false,
        error: `Unknown service: ${serviceId}`,
        errorCode: 'UNKNOWN_SERVICE'
      };
    }
    return { valid: true };
  }

  /**
   * Generate welcome message for user
   * @param {string} email - User's email address
   * @returns {string} Welcome message
   */
  static generateWelcomeMessage(email) {
    if (!email || typeof email !== 'string') {
      return 'Welcome to SCCCC Services';
    }
    return `Welcome, ${email}`;
  }

  /**
   * Build complete home page data
   * @param {string} email - Authenticated user email
   * @returns {HomePageData} Complete home page data
   */
  static buildHomePageData(email) {
    return {
      email: email || '',
      services: this.getAvailableServices(),
      welcomeMessage: this.generateWelcomeMessage(email)
    };
  }

  /**
   * Check if a service requires additional authentication
   * Some services might require re-authentication for sensitive operations
   * @param {string} serviceId - The service identifier
   * @returns {boolean} Whether the service requires additional auth
   */
  static requiresAdditionalAuth(serviceId) {
    // Currently, no services require additional auth beyond the initial verification
    // This is a placeholder for future security enhancements
    return false;
  }

  /**
   * Get service count
   * @returns {number} Total number of available services
   */
  static getServiceCount() {
    return Object.keys(this.SERVICE_DEFINITIONS).length;
  }
};

// Node.js export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    Manager: Common.HomePage.Manager
  };
}
