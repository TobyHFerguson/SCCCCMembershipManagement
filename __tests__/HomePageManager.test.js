// @ts-check
/**
 * Test suite for Common.HomePage.Manager
 * Tests the pure business logic for the service home page
 * 
 * Table of Contents:
 * 1. getAvailableServices - Get list of all services
 * 2. getServiceById - Get specific service info
 * 3. validateServiceId - Validate service identifiers
 * 4. generateWelcomeMessage - Generate user welcome message
 * 5. buildHomePageData - Build complete home page data
 * 6. requiresAdditionalAuth - Check additional auth requirements
 * 7. getServiceCount - Get total service count
 */

const { Manager } = require('../src/common/html/HomePageManager');

describe('Common.HomePage.Manager', () => {
  // Service IDs that should be available
  const EXPECTED_SERVICES = [
    'DirectoryService',
    'EmailChangeService',
    'GroupManagementService',
    'ProfileManagementService',
    'VotingService'
  ];

  describe('getAvailableServices', () => {
    it('should return an array of services', () => {
      const services = Manager.getAvailableServices();
      expect(Array.isArray(services)).toBe(true);
      expect(services.length).toBeGreaterThan(0);
    });

    it('should return all expected services', () => {
      const services = Manager.getAvailableServices();
      const serviceIds = services.map(s => s.id);
      
      EXPECTED_SERVICES.forEach(expectedId => {
        expect(serviceIds).toContain(expectedId);
      });
    });

    it('should return exactly 5 services', () => {
      const services = Manager.getAvailableServices();
      expect(services.length).toBe(5);
    });

    it('should return services with required properties', () => {
      const services = Manager.getAvailableServices();
      
      services.forEach(service => {
        expect(service).toHaveProperty('id');
        expect(service).toHaveProperty('name');
        expect(service).toHaveProperty('description');
        expect(service).toHaveProperty('icon');
        expect(typeof service.id).toBe('string');
        expect(typeof service.name).toBe('string');
        expect(typeof service.description).toBe('string');
        expect(typeof service.icon).toBe('string');
      });
    });

    it('should return services with non-empty properties', () => {
      const services = Manager.getAvailableServices();
      
      services.forEach(service => {
        expect(service.id.length).toBeGreaterThan(0);
        expect(service.name.length).toBeGreaterThan(0);
        expect(service.description.length).toBeGreaterThan(0);
        expect(service.icon.length).toBeGreaterThan(0);
      });
    });
  });

  describe('getServiceById', () => {
    it('should return service info for valid service ID', () => {
      EXPECTED_SERVICES.forEach(serviceId => {
        const service = Manager.getServiceById(serviceId);
        expect(service).not.toBeNull();
        expect(service.id).toBe(serviceId);
        expect(service.name).toBeDefined();
        expect(service.description).toBeDefined();
      });
    });

    it('should return null for invalid service ID', () => {
      expect(Manager.getServiceById('InvalidService')).toBeNull();
      expect(Manager.getServiceById('nonexistent')).toBeNull();
    });

    it('should return null for null/undefined input', () => {
      expect(Manager.getServiceById(null)).toBeNull();
      expect(Manager.getServiceById(undefined)).toBeNull();
    });

    it('should return null for non-string input', () => {
      expect(Manager.getServiceById(123)).toBeNull();
      expect(Manager.getServiceById({})).toBeNull();
      expect(Manager.getServiceById([])).toBeNull();
    });

    it('should return correct service info for DirectoryService', () => {
      const service = Manager.getServiceById('DirectoryService');
      expect(service.name).toBe('Directory Service');
      expect(service.description).toContain('directory');
      expect(service.icon).toBe('directory');
    });

    it('should return correct service info for GroupManagementService', () => {
      const service = Manager.getServiceById('GroupManagementService');
      expect(service.name).toBe('Group Management Service');
      expect(service.description).toContain('Google Group');
      expect(service.icon).toBe('groups');
    });

    it('should return correct service info for ProfileManagementService', () => {
      const service = Manager.getServiceById('ProfileManagementService');
      expect(service.name).toBe('Profile Management Service');
      expect(service.description).toContain('profile');
      expect(service.icon).toBe('profile');
    });

    it('should return correct service info for EmailChangeService', () => {
      const service = Manager.getServiceById('EmailChangeService');
      expect(service.name).toBe('Email Change Service');
      expect(service.description).toContain('email');
      expect(service.icon).toBe('email');
    });

    it('should return correct service info for VotingService', () => {
      const service = Manager.getServiceById('VotingService');
      expect(service.name).toBe('Voting Service');
      expect(service.description).toContain('election');
      expect(service.icon).toBe('voting');
    });
  });

  describe('validateServiceId', () => {
    it('should return valid for all expected services', () => {
      EXPECTED_SERVICES.forEach(serviceId => {
        const result = Manager.validateServiceId(serviceId);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
        expect(result.errorCode).toBeUndefined();
      });
    });

    it('should return invalid for unknown service', () => {
      const result = Manager.validateServiceId('UnknownService');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unknown service');
      expect(result.errorCode).toBe('UNKNOWN_SERVICE');
    });

    it('should return invalid for null/undefined', () => {
      const nullResult = Manager.validateServiceId(null);
      expect(nullResult.valid).toBe(false);
      expect(nullResult.errorCode).toBe('MISSING_SERVICE_ID');

      const undefinedResult = Manager.validateServiceId(undefined);
      expect(undefinedResult.valid).toBe(false);
      expect(undefinedResult.errorCode).toBe('MISSING_SERVICE_ID');
    });

    it('should return invalid for empty string', () => {
      const result = Manager.validateServiceId('');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('MISSING_SERVICE_ID');
    });

    it('should return invalid for non-string input', () => {
      const result = Manager.validateServiceId(123);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('MISSING_SERVICE_ID');
    });
  });

  describe('generateWelcomeMessage', () => {
    it('should generate welcome message with email', () => {
      const message = Manager.generateWelcomeMessage('user@example.com');
      expect(message).toContain('user@example.com');
      expect(message).toContain('Welcome');
    });

    it('should return default message for null email', () => {
      const message = Manager.generateWelcomeMessage(null);
      expect(message).toBe('Welcome to SCCCC Services');
    });

    it('should return default message for undefined email', () => {
      const message = Manager.generateWelcomeMessage(undefined);
      expect(message).toBe('Welcome to SCCCC Services');
    });

    it('should return default message for empty string email', () => {
      const message = Manager.generateWelcomeMessage('');
      expect(message).toBe('Welcome to SCCCC Services');
    });

    it('should return default message for non-string email', () => {
      const message = Manager.generateWelcomeMessage(123);
      expect(message).toBe('Welcome to SCCCC Services');
    });
  });

  describe('buildHomePageData', () => {
    it('should build complete home page data', () => {
      const data = Manager.buildHomePageData('test@example.com');
      
      expect(data).toHaveProperty('email');
      expect(data).toHaveProperty('services');
      expect(data).toHaveProperty('welcomeMessage');
    });

    it('should include authenticated email', () => {
      const data = Manager.buildHomePageData('test@example.com');
      expect(data.email).toBe('test@example.com');
    });

    it('should include all services', () => {
      const data = Manager.buildHomePageData('test@example.com');
      expect(data.services.length).toBe(5);
      
      const serviceIds = data.services.map(s => s.id);
      EXPECTED_SERVICES.forEach(expectedId => {
        expect(serviceIds).toContain(expectedId);
      });
    });

    it('should include welcome message', () => {
      const data = Manager.buildHomePageData('test@example.com');
      expect(data.welcomeMessage).toContain('test@example.com');
    });

    it('should handle null email gracefully', () => {
      const data = Manager.buildHomePageData(null);
      expect(data.email).toBe('');
      expect(data.services.length).toBe(5);
      expect(data.welcomeMessage).toBe('Welcome to SCCCC Services');
    });

    it('should handle undefined email gracefully', () => {
      const data = Manager.buildHomePageData(undefined);
      expect(data.email).toBe('');
      expect(data.services.length).toBe(5);
    });
  });

  describe('requiresAdditionalAuth', () => {
    it('should return false for all services (current implementation)', () => {
      EXPECTED_SERVICES.forEach(serviceId => {
        expect(Manager.requiresAdditionalAuth(serviceId)).toBe(false);
      });
    });

    it('should handle null service ID', () => {
      expect(Manager.requiresAdditionalAuth(null)).toBe(false);
    });

    it('should handle undefined service ID', () => {
      expect(Manager.requiresAdditionalAuth(undefined)).toBe(false);
    });
  });

  describe('getServiceCount', () => {
    it('should return 5 services', () => {
      expect(Manager.getServiceCount()).toBe(5);
    });

    it('should match the length of getAvailableServices', () => {
      const services = Manager.getAvailableServices();
      expect(Manager.getServiceCount()).toBe(services.length);
    });
  });

  describe('SERVICE_DEFINITIONS', () => {
    it('should have definitions for all expected services', () => {
      EXPECTED_SERVICES.forEach(serviceId => {
        expect(Manager.SERVICE_DEFINITIONS[serviceId]).toBeDefined();
      });
    });

    it('should have name, description, and icon for each service', () => {
      Object.values(Manager.SERVICE_DEFINITIONS).forEach(definition => {
        expect(definition).toHaveProperty('name');
        expect(definition).toHaveProperty('description');
        expect(definition).toHaveProperty('icon');
      });
    });
  });
});
