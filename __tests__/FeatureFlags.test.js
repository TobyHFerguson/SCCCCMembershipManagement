// @ts-check
/**
 * Test suite for FeatureFlags module
 * Tests both the Manager (pure logic) and FeatureFlags (GAS layer) components
 */

const { FeatureFlags, FeatureFlagsManager } = /** @type {any} */ (require('../src/common/config/FeatureFlags'));

describe('FeatureFlagsManager - Pure Logic', () => {
  
  // ==================== validateFlagName Tests ====================
  
  describe('validateFlagName', () => {
    test('accepts valid flag names', () => {
      expect(FeatureFlagsManager.validateFlagName('FEATURE_NEW_AUTH')).toEqual({ valid: true });
      expect(FeatureFlagsManager.validateFlagName('FEATURE_SPA_MODE')).toEqual({ valid: true });
      expect(FeatureFlagsManager.validateFlagName('FEATURE_X')).toEqual({ valid: true });
      expect(FeatureFlagsManager.validateFlagName('FEATURE_123_TEST')).toEqual({ valid: true });
    });

    test('rejects empty or non-string values', () => {
      expect(FeatureFlagsManager.validateFlagName('')).toEqual({ 
        valid: false, 
        error: 'Flag name must be a non-empty string' 
      });
      expect(FeatureFlagsManager.validateFlagName(null)).toEqual({ 
        valid: false, 
        error: 'Flag name must be a non-empty string' 
      });
      expect(FeatureFlagsManager.validateFlagName(undefined)).toEqual({ 
        valid: false, 
        error: 'Flag name must be a non-empty string' 
      });
      expect(FeatureFlagsManager.validateFlagName(/** @type {any} */ (123))).toEqual({ 
        valid: false, 
        error: 'Flag name must be a non-empty string' 
      });
    });

    test('rejects names with whitespace', () => {
      expect(FeatureFlagsManager.validateFlagName(' FEATURE_TEST')).toEqual({ 
        valid: false, 
        error: 'Flag name cannot have leading/trailing whitespace' 
      });
      expect(FeatureFlagsManager.validateFlagName('FEATURE_TEST ')).toEqual({ 
        valid: false, 
        error: 'Flag name cannot have leading/trailing whitespace' 
      });
    });

    test('rejects names not matching pattern', () => {
      expect(FeatureFlagsManager.validateFlagName('feature_test')).toEqual({ 
        valid: false, 
        error: 'Flag name must be uppercase with underscores (e.g., FEATURE_NEW_AUTH)' 
      });
      expect(FeatureFlagsManager.validateFlagName('FEATURE-TEST')).toEqual({ 
        valid: false, 
        error: 'Flag name must be uppercase with underscores (e.g., FEATURE_NEW_AUTH)' 
      });
    });

    test('rejects names without FEATURE_ prefix', () => {
      expect(FeatureFlagsManager.validateFlagName('FLAG_TEST')).toEqual({ 
        valid: false, 
        error: 'Flag name must start with FEATURE_ prefix' 
      });
      // 'TEST' is rejected by the pattern check before the prefix check
      expect(FeatureFlagsManager.validateFlagName('TEST')).toEqual({ 
        valid: false, 
        error: 'Flag name must start with FEATURE_ prefix' 
      });
    });
  });

  // ==================== parseBoolean Tests ====================
  
  describe('parseBoolean', () => {
    test('handles true values', () => {
      expect(FeatureFlagsManager.parseBoolean('true', false)).toBe(true);
      expect(FeatureFlagsManager.parseBoolean('TRUE', false)).toBe(true);
      expect(FeatureFlagsManager.parseBoolean('True', false)).toBe(true);
      expect(FeatureFlagsManager.parseBoolean('1', false)).toBe(true);
      expect(FeatureFlagsManager.parseBoolean('yes', false)).toBe(true);
      expect(FeatureFlagsManager.parseBoolean('on', false)).toBe(true);
      expect(FeatureFlagsManager.parseBoolean(true, false)).toBe(true);
    });

    test('handles false values', () => {
      expect(FeatureFlagsManager.parseBoolean('false', true)).toBe(false);
      expect(FeatureFlagsManager.parseBoolean('FALSE', true)).toBe(false);
      expect(FeatureFlagsManager.parseBoolean('0', true)).toBe(false);
      expect(FeatureFlagsManager.parseBoolean('no', true)).toBe(false);
      expect(FeatureFlagsManager.parseBoolean('off', true)).toBe(false);
      expect(FeatureFlagsManager.parseBoolean(false, true)).toBe(false);
    });

    test('returns default for null/undefined', () => {
      expect(FeatureFlagsManager.parseBoolean(null, true)).toBe(true);
      expect(FeatureFlagsManager.parseBoolean(null, false)).toBe(false);
      expect(FeatureFlagsManager.parseBoolean(undefined, true)).toBe(true);
      expect(FeatureFlagsManager.parseBoolean(undefined, false)).toBe(false);
    });

    test('returns default for unrecognized values', () => {
      expect(FeatureFlagsManager.parseBoolean('maybe', true)).toBe(true);
      expect(FeatureFlagsManager.parseBoolean('maybe', false)).toBe(false);
      expect(FeatureFlagsManager.parseBoolean('', true)).toBe(true);
      expect(FeatureFlagsManager.parseBoolean('', false)).toBe(false);
    });

    test('handles whitespace', () => {
      expect(FeatureFlagsManager.parseBoolean(' true ', false)).toBe(true);
      expect(FeatureFlagsManager.parseBoolean(' false ', true)).toBe(false);
    });
  });

  // ==================== formatForStorage Tests ====================
  
  describe('formatForStorage', () => {
    test('formats boolean values correctly', () => {
      expect(FeatureFlagsManager.formatForStorage(true)).toBe('true');
      expect(FeatureFlagsManager.formatForStorage(false)).toBe('false');
    });
  });

  // ==================== shouldEnableFeature Tests ====================
  
  describe('shouldEnableFeature', () => {
    test('returns flag value when not forced', () => {
      expect(FeatureFlagsManager.shouldEnableFeature(true, true)).toBe(true);
      expect(FeatureFlagsManager.shouldEnableFeature(false, true)).toBe(false);
      expect(FeatureFlagsManager.shouldEnableFeature(true, false)).toBe(true);
      expect(FeatureFlagsManager.shouldEnableFeature(false, false)).toBe(false);
    });

    test('returns true when forced', () => {
      expect(FeatureFlagsManager.shouldEnableFeature(false, true, true)).toBe(true);
      expect(FeatureFlagsManager.shouldEnableFeature(false, false, true)).toBe(true);
    });
  });

  // ==================== summarizeFlags Tests ====================
  
  describe('summarizeFlags', () => {
    test('summarizes empty flags', () => {
      const result = FeatureFlagsManager.summarizeFlags({});
      expect(result).toEqual({ enabled: [], disabled: [], total: 0 });
    });

    test('summarizes mixed flags', () => {
      const flags = {
        'FEATURE_A': true,
        'FEATURE_B': false,
        'FEATURE_C': true,
        'FEATURE_D': false
      };
      const result = FeatureFlagsManager.summarizeFlags(flags);
      
      expect(result.enabled).toEqual(['FEATURE_A', 'FEATURE_C']);
      expect(result.disabled).toEqual(['FEATURE_B', 'FEATURE_D']);
      expect(result.total).toBe(4);
    });

    test('returns sorted arrays', () => {
      const flags = {
        'FEATURE_Z': true,
        'FEATURE_A': true,
        'FEATURE_M': false
      };
      const result = FeatureFlagsManager.summarizeFlags(flags);
      
      expect(result.enabled).toEqual(['FEATURE_A', 'FEATURE_Z']);
      expect(result.disabled).toEqual(['FEATURE_M']);
    });
  });
});

describe('FeatureFlags - GAS Layer', () => {
  let mockProperties;
  
  beforeEach(() => {
    // Reset mock properties for each test
    mockProperties = {};
    
    // Mock PropertiesService
    /** @type {any} */ (global.PropertiesService) = {
      getScriptProperties: () => /** @type {any} */ (({
        getProperty: (key) => mockProperties[key] || null,
        setProperty: /** @type {any} */ ((key, value) => { mockProperties[key] = value; }),
        deleteProperty: /** @type {any} */ ((key) => { delete mockProperties[key]; }),
        getProperties: () => ({ ...mockProperties })
      }))
    };
    
    // Mock Logger
    global.AppLogger = /** @type {any} */ ({
      log: jest.fn()
    });

    // Mock GAS built-in Logger
    global.Logger = {
      log: jest.fn(),
      clear: jest.fn(),
      getLog: jest.fn(() => '')
    };
  });

  afterEach(() => {
    delete global.PropertiesService;
    delete global.Logger;
  });

  // ==================== isEnabled Tests ====================
  
  describe('isEnabled', () => {
    test('returns stored value when set', () => {
      mockProperties['FEATURE_TEST'] = 'true';
      expect(FeatureFlags.isEnabled('FEATURE_TEST')).toBe(true);
      
      mockProperties['FEATURE_TEST'] = 'false';
      expect(FeatureFlags.isEnabled('FEATURE_TEST')).toBe(false);
    });

    test('returns default when not set', () => {
      expect(FeatureFlags.isEnabled('FEATURE_UNKNOWN', false)).toBe(false);
      expect(FeatureFlags.isEnabled('FEATURE_UNKNOWN', true)).toBe(true);
    });

    test('returns known flag default when available', () => {
      // FEATURE_USE_NEW_AUTH has default false
      expect(FeatureFlags.isEnabled('FEATURE_USE_NEW_AUTH')).toBe(false);
    });

    test('returns default for invalid flag names', () => {
      expect(FeatureFlags.isEnabled('invalid_name', true)).toBe(true);
      expect(FeatureFlags.isEnabled('', false)).toBe(false);
    });
  });

  // ==================== setFlag Tests ====================
  
  describe('setFlag', () => {
    test('sets flag successfully', () => {
      const result = FeatureFlags.setFlag('FEATURE_TEST', true);
      
      expect(result.success).toBe(true);
      expect(mockProperties['FEATURE_TEST']).toBe('true');
    });

    test('fails for invalid flag name', () => {
      const result = FeatureFlags.setFlag('invalid', true);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  // ==================== deleteFlag Tests ====================
  
  describe('deleteFlag', () => {
    test('deletes flag successfully', () => {
      mockProperties['FEATURE_TEST'] = 'true';
      
      const result = FeatureFlags.deleteFlag('FEATURE_TEST');
      
      expect(result.success).toBe(true);
      expect(mockProperties['FEATURE_TEST']).toBeUndefined();
    });
  });

  // ==================== getAllFlags Tests ====================
  
  describe('getAllFlags', () => {
    test('returns all feature flags', () => {
      mockProperties['FEATURE_A'] = 'true';
      mockProperties['FEATURE_B'] = 'false';
      mockProperties['OTHER_PROP'] = 'value';
      
      const flags = FeatureFlags.getAllFlags();
      
      expect(flags).toEqual({
        'FEATURE_A': true,
        'FEATURE_B': false
      });
    });
  });

  // ==================== Convenience Methods Tests ====================
  
  describe('convenience methods', () => {
    test('enableNewAuth sets FEATURE_USE_NEW_AUTH to true', () => {
      const result = FeatureFlags.enableNewAuth();
      
      expect(result.success).toBe(true);
      expect(mockProperties['FEATURE_USE_NEW_AUTH']).toBe('true');
    });

    test('emergencyRollback sets FEATURE_USE_NEW_AUTH to false', () => {
      mockProperties['FEATURE_USE_NEW_AUTH'] = 'true';
      
      const result = FeatureFlags.emergencyRollback();
      
      expect(result.success).toBe(true);
      expect(mockProperties['FEATURE_USE_NEW_AUTH']).toBe('false');
    });

    test('isNewAuthEnabled returns correct value', () => {
      mockProperties['FEATURE_USE_NEW_AUTH'] = 'true';
      expect(FeatureFlags.isNewAuthEnabled()).toBe(true);
      
      mockProperties['FEATURE_USE_NEW_AUTH'] = 'false';
      expect(FeatureFlags.isNewAuthEnabled()).toBe(false);
    });

    test('isSPAModeEnabled returns correct value', () => {
      mockProperties['FEATURE_SPA_MODE'] = 'true';
      expect(FeatureFlags.isSPAModeEnabled()).toBe(true);
      
      mockProperties['FEATURE_SPA_MODE'] = 'false';
      expect(FeatureFlags.isSPAModeEnabled()).toBe(false);
    });
  });

  // ==================== getKnownFlags Tests ====================
  
  describe('getKnownFlags', () => {
    test('returns known flags configuration', () => {
      const knownFlags = FeatureFlags.getKnownFlags();
      
      expect(knownFlags['FEATURE_USE_NEW_AUTH']).toBeDefined();
      expect(knownFlags['FEATURE_USE_NEW_AUTH'].defaultValue).toBe(false);
      expect(knownFlags['FEATURE_SPA_MODE']).toBeDefined();
    });

    test('returns a copy, not the original', () => {
      const flags1 = FeatureFlags.getKnownFlags();
      const flags2 = FeatureFlags.getKnownFlags();
      
      (/** @type {any} */ (flags1))['FEATURE_NEW'] = { name: 'test' };
      expect(flags2['FEATURE_NEW']).toBeUndefined();
    });
  });
});
