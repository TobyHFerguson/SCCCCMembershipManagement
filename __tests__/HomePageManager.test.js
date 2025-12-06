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
  // Mock WebServices object matching the structure in 1namespaces.js
  // This is the single source of truth - service definitions live in WebServices
  const mockWebServices = {
    DirectoryService: {
      name: 'Directory Service',
      service: 'DirectoryService',
      description: 'View the member directory with contact information',
      icon: 'directory'
    },
    EmailChangeService: {
      name: 'Email Change Service',
      service: 'EmailChangeService',
      description: 'Update your email address across all SCCCC systems',
      icon: 'email'
    },
    GroupManagementService: {
      name: 'Group Management Service',
      service: 'GroupManagementService',
      description: 'Manage your Google Group subscriptions',
      icon: 'groups'
    },
    ProfileManagementService: {
      name: 'Profile Management Service',
      service: 'ProfileManagementService',
      description: 'Update your member profile and preferences',
      icon: 'profile'
    },
    VotingService: {
      name: 'Voting Service',
      service: 'VotingService',
      description: 'Participate in SCCCC elections',
      icon: 'voting'
    }
  };

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
      const services = Manager.getAvailableServices(mockWebServices);
      expect(Array.isArray(services)).toBe(true);
      expect(services.length).toBeGreaterThan(0);
    });

    it('should return all expected services', () => {
      const services = Manager.getAvailableServices(mockWebServices);
      const serviceIds = services.map(s => s.id);
      
      EXPECTED_SERVICES.forEach(expectedId => {
        expect(serviceIds).toContain(expectedId);
      });
    });

    it('should return exactly 5 services', () => {
      const services = Manager.getAvailableServices(mockWebServices);
      expect(services.length).toBe(5);
    });

    it('should return services with required properties', () => {
      const services = Manager.getAvailableServices(mockWebServices);
      
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
      const services = Manager.getAvailableServices(mockWebServices);
      
      services.forEach(service => {
        expect(service.id.length).toBeGreaterThan(0);
        expect(service.name.length).toBeGreaterThan(0);
        expect(service.description.length).toBeGreaterThan(0);
        expect(service.icon.length).toBeGreaterThan(0);
      });
    });

    it('should return empty array when no WebServices provided', () => {
      const services = Manager.getAvailableServices({});
      expect(services).toEqual([]);
    });

    it('should skip services without name property', () => {
      const partialWebServices = {
        ...mockWebServices,
        InvalidService: { service: 'InvalidService' } // Missing name
      };
      const services = Manager.getAvailableServices(partialWebServices);
      expect(services.length).toBe(5); // Should not include InvalidService
    });
  });

  describe('getServiceById', () => {
    it('should return service info for valid service ID', () => {
      EXPECTED_SERVICES.forEach(serviceId => {
        const service = Manager.getServiceById(serviceId, mockWebServices);
        expect(service).not.toBeNull();
        expect(service.id).toBe(serviceId);
        expect(service.name).toBeDefined();
        expect(service.description).toBeDefined();
      });
    });

    it('should return null for invalid service ID', () => {
      expect(Manager.getServiceById('InvalidService', mockWebServices)).toBeNull();
      expect(Manager.getServiceById('nonexistent', mockWebServices)).toBeNull();
    });

    it('should return null for null/undefined input', () => {
      expect(Manager.getServiceById(null, mockWebServices)).toBeNull();
      expect(Manager.getServiceById(undefined, mockWebServices)).toBeNull();
    });

    it('should return null for non-string input', () => {
      expect(Manager.getServiceById(123, mockWebServices)).toBeNull();
      expect(Manager.getServiceById({}, mockWebServices)).toBeNull();
      expect(Manager.getServiceById([], mockWebServices)).toBeNull();
    });

    it('should return correct service info for DirectoryService', () => {
      const service = Manager.getServiceById('DirectoryService', mockWebServices);
      expect(service.name).toBe('Directory Service');
      expect(service.description).toContain('directory');
      expect(service.icon).toBe('directory');
    });

    it('should return correct service info for GroupManagementService', () => {
      const service = Manager.getServiceById('GroupManagementService', mockWebServices);
      expect(service.name).toBe('Group Management Service');
      expect(service.description).toContain('Google Group');
      expect(service.icon).toBe('groups');
    });

    it('should return correct service info for ProfileManagementService', () => {
      const service = Manager.getServiceById('ProfileManagementService', mockWebServices);
      expect(service.name).toBe('Profile Management Service');
      expect(service.description).toContain('profile');
      expect(service.icon).toBe('profile');
    });

    it('should return correct service info for EmailChangeService', () => {
      const service = Manager.getServiceById('EmailChangeService', mockWebServices);
      expect(service.name).toBe('Email Change Service');
      expect(service.description).toContain('email');
      expect(service.icon).toBe('email');
    });

    it('should return correct service info for VotingService', () => {
      const service = Manager.getServiceById('VotingService', mockWebServices);
      expect(service.name).toBe('Voting Service');
      expect(service.description).toContain('election');
      expect(service.icon).toBe('voting');
    });
  });

  describe('validateServiceId', () => {
    it('should return valid for all expected services', () => {
      EXPECTED_SERVICES.forEach(serviceId => {
        const result = Manager.validateServiceId(serviceId, mockWebServices);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
        expect(result.errorCode).toBeUndefined();
      });
    });

    it('should return invalid for unknown service', () => {
      const result = Manager.validateServiceId('UnknownService', mockWebServices);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unknown service');
      expect(result.errorCode).toBe('UNKNOWN_SERVICE');
    });

    it('should return invalid for null/undefined', () => {
      const nullResult = Manager.validateServiceId(null, mockWebServices);
      expect(nullResult.valid).toBe(false);
      expect(nullResult.errorCode).toBe('MISSING_SERVICE_ID');

      const undefinedResult = Manager.validateServiceId(undefined, mockWebServices);
      expect(undefinedResult.valid).toBe(false);
      expect(undefinedResult.errorCode).toBe('MISSING_SERVICE_ID');
    });

    it('should return invalid for empty string', () => {
      const result = Manager.validateServiceId('', mockWebServices);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('MISSING_SERVICE_ID');
    });

    it('should return invalid for non-string input', () => {
      const result = Manager.validateServiceId(123, mockWebServices);
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
      const data = Manager.buildHomePageData('test@example.com', mockWebServices);
      
      expect(data).toHaveProperty('email');
      expect(data).toHaveProperty('services');
      expect(data).toHaveProperty('welcomeMessage');
    });

    it('should include authenticated email', () => {
      const data = Manager.buildHomePageData('test@example.com', mockWebServices);
      expect(data.email).toBe('test@example.com');
    });

    it('should include all services', () => {
      const data = Manager.buildHomePageData('test@example.com', mockWebServices);
      expect(data.services.length).toBe(5);
      
      const serviceIds = data.services.map(s => s.id);
      EXPECTED_SERVICES.forEach(expectedId => {
        expect(serviceIds).toContain(expectedId);
      });
    });

    it('should include welcome message', () => {
      const data = Manager.buildHomePageData('test@example.com', mockWebServices);
      expect(data.welcomeMessage).toContain('test@example.com');
    });

    it('should handle null email gracefully', () => {
      const data = Manager.buildHomePageData(null, mockWebServices);
      expect(data.email).toBe('');
      expect(data.services.length).toBe(5);
      expect(data.welcomeMessage).toBe('Welcome to SCCCC Services');
    });

    it('should handle undefined email gracefully', () => {
      const data = Manager.buildHomePageData(undefined, mockWebServices);
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
      expect(Manager.getServiceCount(mockWebServices)).toBe(5);
    });

    it('should match the length of getAvailableServices', () => {
      const services = Manager.getAvailableServices(mockWebServices);
      expect(Manager.getServiceCount(mockWebServices)).toBe(services.length);
    });

    it('should return 0 for empty WebServices', () => {
      expect(Manager.getServiceCount({})).toBe(0);
    });
  });

  describe('_extractServiceInfo', () => {
    it('should extract service info correctly', () => {
      const info = Manager._extractServiceInfo('TestService', {
        name: 'Test Service',
        description: 'A test service',
        icon: 'test'
      });
      
      expect(info.id).toBe('TestService');
      expect(info.name).toBe('Test Service');
      expect(info.description).toBe('A test service');
      expect(info.icon).toBe('test');
    });

    it('should return null for null service object', () => {
      expect(Manager._extractServiceInfo('TestService', null)).toBeNull();
    });

    it('should return null for service without name', () => {
      expect(Manager._extractServiceInfo('TestService', { description: 'desc' })).toBeNull();
    });

    it('should use default icon when not provided', () => {
      const info = Manager._extractServiceInfo('TestService', {
        name: 'Test Service',
        description: 'A test service'
      });
      
      expect(info.icon).toBe('profile'); // Default icon
    });

    it('should handle empty description', () => {
      const info = Manager._extractServiceInfo('TestService', {
        name: 'Test Service'
      });
      
      expect(info.description).toBe('');
    });
  });
});
