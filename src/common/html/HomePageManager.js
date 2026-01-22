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
 * Service definitions are sourced from WebServices (defined in 1namespaces.js)
 * to ensure a single source of truth for service metadata.
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
 * Service definitions are derived from WebServices to ensure single source of truth.
 * In GAS environment, WebServices is defined in 1namespaces.js.
 * In Jest environment, WebServices can be mocked or the Manager uses injected services.
 * 
 * @class
 */
Common.HomePage.Manager = class {
  /**
   * Get WebServices object (allows dependency injection for testing)
   * @private
   * @param {Record<string, {name: string, description?: string, icon?: string}>} [webServicesOverride] - Optional WebServices override for testing
   * @returns {Record<string, {name: string, description?: string, icon?: string}>} WebServices object
   */
  static _getWebServices(webServicesOverride) {
    if (webServicesOverride) {
      return webServicesOverride;
    }
    // In GAS environment, WebServices is a global
    if (typeof WebServices !== 'undefined') {
      return WebServices;
    }
    // Fallback for Jest - return empty object (tests should provide mock)
    return {};
  }

  /**
   * Extract service info from a service definition object
   * @private
   * @param {string} serviceId - The service identifier
   * @param {{name: string, description?: string, icon?: string}} serviceObj - The service object from WebServices
   * @returns {ServiceInfo|null} Service info or null if invalid
   */
  static _extractServiceInfo(serviceId, serviceObj) {
    // Require serviceObj and a non-empty name property
    if (!serviceObj || !serviceObj.name) {
      return null;
    }
    return {
      id: serviceId,
      name: serviceObj.name, // Already validated as truthy above
      description: serviceObj.description || '',
      icon: serviceObj.icon || 'profile'
    };
  }

  /**
   * Get all available services as ServiceInfo array
   * Services are derived from WebServices defined in 1namespaces.js
   * @param {Record<string, {name: string, description?: string, icon?: string}>} [webServicesOverride] - Optional WebServices override for testing
   * @returns {ServiceInfo[]} Array of service information
   */
  static getAvailableServices(webServicesOverride) {
    const webServices = this._getWebServices(webServicesOverride);
    const services = [];
    
    for (const [serviceId, serviceObj] of Object.entries(webServices)) {
      // Skip HomePageService - it shouldn't appear as a tile on the home page
      if (serviceId === 'HomePageService') {
        continue;
      }
      
      const info = this._extractServiceInfo(serviceId, serviceObj);
      if (info) {
        services.push(info);
      }
    }
    
    return services;
  }

  /**
   * Get service info by ID
   * @param {string} serviceId - The service identifier
   * @param {Record<string, {name: string, description?: string, icon?: string}>} [webServicesOverride] - Optional WebServices override for testing
   * @returns {ServiceInfo|null} Service info or null if not found
   */
  static getServiceById(serviceId, webServicesOverride) {
    if (!serviceId || typeof serviceId !== 'string') {
      return null;
    }
    const webServices = this._getWebServices(webServicesOverride);
    const serviceObj = webServices[serviceId];
    if (!serviceObj) {
      return null;
    }
    return this._extractServiceInfo(serviceId, serviceObj);
  }

  /**
   * Validate a service ID
   * @param {string} serviceId - The service identifier to validate
   * @param {Record<string, {name: string, description?: string, icon?: string}>} [webServicesOverride] - Optional WebServices override for testing
   * @returns {{valid: boolean, error?: string, errorCode?: string}}
   */
  static validateServiceId(serviceId, webServicesOverride) {
    if (!serviceId || typeof serviceId !== 'string') {
      return {
        valid: false,
        error: 'Service ID is required',
        errorCode: 'MISSING_SERVICE_ID'
      };
    }
    const webServices = this._getWebServices(webServicesOverride);
    if (!webServices[serviceId]) {
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
   * @param {Record<string, {name: string, description?: string, icon?: string}>} [webServicesOverride] - Optional WebServices override for testing
   * @returns {HomePageData} Complete home page data
   */
  static buildHomePageData(email, webServicesOverride) {
    return {
      email: email || '',
      services: this.getAvailableServices(webServicesOverride),
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
   * @param {Record<string, {name: string, description?: string, icon?: string}>} [webServicesOverride] - Optional WebServices override for testing
   * @returns {number} Total number of available services
   */
  static getServiceCount(webServicesOverride) {
    return this.getAvailableServices(webServicesOverride).length;
  }
};

// Node.js export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    Manager: Common.HomePage.Manager
  };
}
