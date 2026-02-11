// @ts-check
/**
 * Test suite for ApiClient module
 * Tests both the ClientManager (pure logic) and ApiClient (GAS layer) components
 */

const { ApiClient, ClientManager } = require('../src/common/api/ApiClient');

describe('ClientManager - Pure Logic', () => {
  
  // ==================== successResponse Tests ====================
  
  describe('successResponse', () => {
    test('creates success response with data', () => {
      const data = { user: 'test', id: 123 };
      const response = ClientManager.successResponse(data);
      
      expect(response.success).toBe(true);
      expect(response.data).toEqual(data);
      expect(response.error).toBeUndefined();
    });

    test('includes metadata when provided', () => {
      const data = 'test';
      const meta = { requestId: 'abc123', duration: 100 };
      const response = ClientManager.successResponse(data, meta);
      
      expect(response.success).toBe(true);
      expect(response.data).toBe('test');
      expect(response.meta).toEqual(meta);
    });

    test('handles null/undefined data', () => {
      expect(ClientManager.successResponse(null).data).toBeNull();
      expect(ClientManager.successResponse(undefined).data).toBeUndefined();
    });
  });

  // ==================== errorResponse Tests ====================
  
  describe('errorResponse', () => {
    test('creates error response with message', () => {
      const response = ClientManager.errorResponse('Something went wrong');
      
      expect(response.success).toBe(false);
      expect(response.error).toBe('Something went wrong');
      expect(response.errorCode).toBe('ERROR');
    });

    test('includes error code when provided', () => {
      const response = ClientManager.errorResponse('Not found', 'NOT_FOUND');
      
      expect(response.errorCode).toBe('NOT_FOUND');
    });

    test('includes metadata when provided', () => {
      const meta = { requestId: 'abc123' };
      const response = ClientManager.errorResponse('Error', 'ERR', meta);
      
      expect(response.meta).toEqual(meta);
    });
  });

  // ==================== validateRequest Tests ====================
  
  describe('validateRequest', () => {
    test('accepts valid request', () => {
      const result = ClientManager.validateRequest({ action: 'test' });
      expect(result).toEqual({ valid: true });
    });

    test('accepts request with params', () => {
      const result = ClientManager.validateRequest({ 
        action: 'test', 
        params: { foo: 'bar' } 
      });
      expect(result).toEqual({ valid: true });
    });

    test('rejects non-object request', () => {
      expect(ClientManager.validateRequest(null)).toEqual({ 
        valid: false, 
        error: 'Request must be an object' 
      });
      expect(ClientManager.validateRequest('string')).toEqual({ 
        valid: false, 
        error: 'Request must be an object' 
      });
      expect(ClientManager.validateRequest(undefined)).toEqual({ 
        valid: false, 
        error: 'Request must be an object' 
      });
    });

    test('rejects request without action', () => {
      expect(ClientManager.validateRequest({})).toEqual({ 
        valid: false, 
        error: 'Request must have an action string' 
      });
      expect(ClientManager.validateRequest({ params: {} })).toEqual({ 
        valid: false, 
        error: 'Request must have an action string' 
      });
    });

    test('rejects action with whitespace', () => {
      expect(ClientManager.validateRequest({ action: ' test' })).toEqual({ 
        valid: false, 
        error: 'Action cannot have leading/trailing whitespace' 
      });
      expect(ClientManager.validateRequest({ action: 'test ' })).toEqual({ 
        valid: false, 
        error: 'Action cannot have leading/trailing whitespace' 
      });
    });
  });

  // ==================== validateRequiredParams Tests ====================
  
  describe('validateRequiredParams', () => {
    test('passes when all required params present', () => {
      const params = { email: 'test@example.com', name: 'Test' };
      const result = ClientManager.validateRequiredParams(params, ['email', 'name']);
      
      expect(result).toEqual({ valid: true });
    });

    test('fails when params are missing', () => {
      const params = { email: 'test@example.com' };
      const result = ClientManager.validateRequiredParams(params, ['email', 'name']);
      
      expect(result.valid).toBe(false);
      expect(result.missing).toEqual(['name']);
    });

    test('treats empty string as missing', () => {
      const params = { email: '', name: 'Test' };
      const result = ClientManager.validateRequiredParams(params, ['email', 'name']);
      
      expect(result.valid).toBe(false);
      expect(result.missing).toEqual(['email']);
    });

    test('treats null/undefined as missing', () => {
      const params = { email: null, name: undefined };
      const result = ClientManager.validateRequiredParams(params, ['email', 'name']);
      
      expect(result.valid).toBe(false);
      expect(result.missing).toEqual(['email', 'name']);
    });

    test('passes with empty required list', () => {
      const result = ClientManager.validateRequiredParams({}, []);
      expect(result).toEqual({ valid: true });
    });
  });

  // ==================== sanitizeString Tests ====================
  
  describe('sanitizeString', () => {
    test('trims whitespace', () => {
      expect(ClientManager.sanitizeString('  test  ')).toBe('test');
    });

    test('handles null/undefined', () => {
      expect(ClientManager.sanitizeString(null)).toBe('');
      expect(ClientManager.sanitizeString(undefined)).toBe('');
    });

    test('limits length', () => {
      const longString = 'a'.repeat(2000);
      const result = ClientManager.sanitizeString(longString);
      expect(result).toHaveLength(1000);
    });

    test('respects custom max length', () => {
      const result = ClientManager.sanitizeString('abcdefghij', 5);
      expect(result).toBe('abcde');
    });

    test('converts non-strings', () => {
      expect(ClientManager.sanitizeString(123)).toBe('123');
      expect(ClientManager.sanitizeString(true)).toBe('true');
    });
  });

  // ==================== sanitizeParams Tests ====================
  
  describe('sanitizeParams', () => {
    test('sanitizes string values', () => {
      const params = { name: '  Test  ', email: 'test@example.com' };
      const result = ClientManager.sanitizeParams(params);
      
      expect(result.name).toBe('Test');
      expect(result.email).toBe('test@example.com');
    });

    test('preserves non-string values', () => {
      const params = { count: 123, active: true };
      const result = ClientManager.sanitizeParams(params);
      
      expect(result.count).toBe(123);
      expect(result.active).toBe(true);
    });

    test('handles nested objects', () => {
      const params = { 
        user: { 
          name: '  Test  ', 
          email: 'test@example.com' 
        } 
      };
      const result = ClientManager.sanitizeParams(params);
      
      expect(result.user.name).toBe('Test');
    });

    test('respects schema for max lengths', () => {
      const params = { name: 'a'.repeat(100) };
      const schema = { name: 10 };
      const result = ClientManager.sanitizeParams(params, schema);
      
      expect(result.name).toHaveLength(10);
    });

    test('handles null/undefined params', () => {
      expect(ClientManager.sanitizeParams(null)).toEqual({});
      expect(ClientManager.sanitizeParams(undefined)).toEqual({});
    });
  });

  // ==================== createRequestContext Tests ====================
  
  describe('createRequestContext', () => {
    test('creates context with action', () => {
      const context = ClientManager.createRequestContext('testAction');
      
      expect(context.action).toBe('testAction');
      expect(context.requestId).toBeDefined();
      expect(context.startTime).toBeDefined();
      expect(typeof context.startTime).toBe('number');
    });

    test('uses provided request ID', () => {
      const context = ClientManager.createRequestContext('test', 'custom-id-123');
      
      expect(context.requestId).toBe('custom-id-123');
    });
  });

  // ==================== generateRequestId Tests ====================
  
  describe('generateRequestId', () => {
    test('generates unique IDs', () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        ids.add(ClientManager.generateRequestId());
      }
      expect(ids.size).toBe(100);
    });

    test('generates string IDs', () => {
      const id = ClientManager.generateRequestId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });
  });

  // ==================== getRequestDuration Tests ====================
  
  describe('getRequestDuration', () => {
    test('calculates duration', () => {
      const context = { startTime: Date.now() - 100 };
      const duration = ClientManager.getRequestDuration(context);
      
      expect(duration).toBeGreaterThanOrEqual(100);
      expect(duration).toBeLessThan(200); // Should be close to 100ms
    });
  });

  // ==================== createMetaFromContext Tests ====================
  
  describe('createMetaFromContext', () => {
    test('creates metadata object', () => {
      const context = {
        action: 'testAction',
        requestId: 'test-123',
        startTime: Date.now() - 50
      };
      
      const meta = ClientManager.createMetaFromContext(context);
      
      expect(meta.requestId).toBe('test-123');
      expect(meta.action).toBe('testAction');
      expect(meta.duration).toBeGreaterThanOrEqual(50);
    });
  });

  // ==================== actionRequiresAuth Tests ====================
  
  describe('actionRequiresAuth', () => {
    const handlers = {
      'publicAction': { requiresAuth: false },
      'privateAction': { requiresAuth: true },
      'defaultAction': {}
    };

    test('returns false for public actions', () => {
      expect(ClientManager.actionRequiresAuth('publicAction', handlers)).toBe(false);
    });

    test('returns true for private actions', () => {
      expect(ClientManager.actionRequiresAuth('privateAction', handlers)).toBe(true);
    });

    test('returns true by default', () => {
      expect(ClientManager.actionRequiresAuth('defaultAction', handlers)).toBe(true);
    });

    test('returns true for unknown actions', () => {
      expect(ClientManager.actionRequiresAuth('unknown', handlers)).toBe(true);
    });
  });

  // ==================== listActions Tests ====================
  
  describe('listActions', () => {
    const handlers = {
      'publicAction': { requiresAuth: false, description: 'Public action' },
      'privateAction': { requiresAuth: true, description: 'Private action' },
      '_internalAction': { requiresAuth: true }
    };

    test('lists public actions', () => {
      const actions = ClientManager.listActions(handlers);
      
      expect(actions).toHaveLength(2);
      expect(actions.find(a => a.action === 'publicAction')).toBeDefined();
      expect(actions.find(a => a.action === 'privateAction')).toBeDefined();
    });

    test('excludes private actions by default', () => {
      const actions = ClientManager.listActions(handlers);
      
      expect(actions.find(a => a.action === '_internalAction')).toBeUndefined();
    });

    test('includes private actions when requested', () => {
      const actions = ClientManager.listActions(handlers, true);
      
      expect(actions.find(a => a.action === '_internalAction')).toBeDefined();
    });

    test('includes auth requirement and description', () => {
      const actions = ClientManager.listActions(handlers);
      const publicAction = actions.find(a => a.action === 'publicAction');
      
      expect(publicAction.requiresAuth).toBe(false);
      expect(publicAction.description).toBe('Public action');
    });

    test('returns sorted list', () => {
      const actions = ClientManager.listActions(handlers);
      
      expect(actions[0].action).toBe('privateAction');
      expect(actions[1].action).toBe('publicAction');
    });
  });

  // ==================== formatErrorForLogging Tests ====================
  
  describe('formatErrorForLogging', () => {
    test('formats Error object', () => {
      const error = new Error('Test error');
      const result = ClientManager.formatErrorForLogging(error);
      
      expect(result.message).toBe('Test error');
      expect(result.stack).toBeDefined();
    });

    test('formats string error', () => {
      const result = ClientManager.formatErrorForLogging('String error');
      
      expect(result.message).toBe('String error');
      expect(result.stack).toBeUndefined();
    });

    test('includes request info without sensitive data', () => {
      const error = new Error('Test');
      const request = {
        action: 'testAction',
        params: { secret: 'password123' },
        token: 'secret-token'
      };
      
      const result = ClientManager.formatErrorForLogging(error, request);
      
      expect(result.action).toBe('testAction');
      expect(result.hasParams).toBe(true);
      expect(result.hasToken).toBe(true);
      // Should NOT include actual params or token
      expect(result.params).toBeUndefined();
      expect(result.token).toBeUndefined();
    });
  });
});

describe('ApiClient - GAS Layer', () => {
  beforeEach(() => {
    // Clear handlers before each test
    ApiClient.clearHandlers();
    
    // Mock Logger
    global.AppLogger = /** @type {any} */ ({
      log: jest.fn()
    });

    // Mock GAS built-in Logger
    global.Logger = /** @type {any} */ ({
      log: jest.fn(),
      clear: jest.fn(),
      getLog: jest.fn(() => '')
    });
    
    // Mock flat TokenManager class
    global.TokenManager = /** @type {any} */ ({
      getEmailFromMUT: jest.fn()
    });
    
    // Mock Common.Auth.TokenManager for backward compatibility
    global.Common = /** @type {any} */ ({
      Auth: {
        TokenManager: global.TokenManager
      },
      Api: require('../src/common/api/ApiClient')
    });
  });

  afterEach(() => {
    delete global.Logger;
    delete global.TokenManager;
    delete global.Common;
  });

  // ==================== registerHandler Tests ====================
  
  describe('registerHandler', () => {
    test('registers handler', () => {
      const handler = jest.fn();
      ApiClient.registerHandler('test', handler);
      
      const config = ApiClient.getHandler('test');
      expect(config).toBeDefined();
      expect(config.handler).toBe(handler);
    });

    test('sets default requiresAuth to true', () => {
      ApiClient.registerHandler('test', jest.fn());
      
      const config = ApiClient.getHandler('test');
      expect(config.requiresAuth).toBe(true);
    });

    test('respects requiresAuth option', () => {
      ApiClient.registerHandler('test', jest.fn(), { requiresAuth: false });
      
      const config = ApiClient.getHandler('test');
      expect(config.requiresAuth).toBe(false);
    });

    test('stores description', () => {
      ApiClient.registerHandler('test', jest.fn(), { description: 'Test action' });
      
      const config = ApiClient.getHandler('test');
      expect(config.description).toBe('Test action');
    });
  });

  // ==================== handleRequest Tests ====================
  
  describe('handleRequest', () => {
    test('returns error for invalid request', () => {
      const result = JSON.parse(ApiClient.handleRequest(null));
      
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_REQUEST');
    });

    test('returns error for unknown action', () => {
      const result = JSON.parse(ApiClient.handleRequest({ action: 'unknown' }));
      
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('UNKNOWN_ACTION');
    });

    test('returns error when auth required but no token', () => {
      ApiClient.registerHandler('test', jest.fn());
      
      const result = JSON.parse(ApiClient.handleRequest({ action: 'test' }));
      
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('AUTH_REQUIRED');
    });

    test('returns error for invalid token', () => {
      ApiClient.registerHandler('test', jest.fn());
      (/** @type {any} */ (TokenManager.getEmailFromMUT)).mockReturnValue(null);
      
      const result = JSON.parse(ApiClient.handleRequest({ 
        action: 'test', 
        token: 'invalid-token' 
      }));
      
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_TOKEN');
    });

    test('calls handler with params and token', () => {
      const handler = jest.fn().mockReturnValue({ success: true, data: 'result' });
      ApiClient.registerHandler('test', handler);
      (/** @type {any} */ (TokenManager.getEmailFromMUT)).mockReturnValue('user@example.com');
      
      const result = JSON.parse(ApiClient.handleRequest({ 
        action: 'test', 
        params: { foo: 'bar' },
        token: 'valid-token' 
      }));
      
      expect(result.success).toBe(true);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ 
          foo: 'bar',
          _authenticatedEmail: 'user@example.com'
        }),
        'valid-token'
      );
    });

    test('skips auth for public handlers', () => {
      const handler = jest.fn().mockReturnValue({ success: true, data: 'public' });
      ApiClient.registerHandler('public', handler, { requiresAuth: false });
      
      const result = JSON.parse(ApiClient.handleRequest({ 
        action: 'public', 
        params: { test: true } 
      }));
      
      expect(result.success).toBe(true);
      expect(handler).toHaveBeenCalled();
    });

    test('includes metadata in response', () => {
      ApiClient.registerHandler('test', () => ({ success: true }), { requiresAuth: false });
      
      const result = JSON.parse(ApiClient.handleRequest({ action: 'test' }));
      
      expect(result.meta).toBeDefined();
      expect(result.meta.requestId).toBeDefined();
      expect(result.meta.duration).toBeDefined();
      expect(result.meta.action).toBe('test');
    });

    test('handles handler errors gracefully', () => {
      ApiClient.registerHandler('test', () => {
        throw new Error('Handler crashed');
      }, { requiresAuth: false });
      
      const result = JSON.parse(ApiClient.handleRequest({ action: 'test' }));
      
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INTERNAL_ERROR');
      // Should not expose internal error message
      expect(result.error).not.toContain('Handler crashed');
    });
  });

  // ==================== listActions Tests ====================
  
  describe('listActions', () => {
    test('returns JSON list of actions', () => {
      ApiClient.registerHandler('action1', jest.fn(), { description: 'Action 1' });
      ApiClient.registerHandler('action2', jest.fn(), { requiresAuth: false });
      
      const result = JSON.parse(ApiClient.listActions());
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });
  });

  // ==================== clearHandlers Tests ====================
  
  describe('clearHandlers', () => {
    test('removes all handlers', () => {
      ApiClient.registerHandler('test', jest.fn());
      
      ApiClient.clearHandlers();
      
      expect(ApiClient.getHandler('test')).toBeUndefined();
    });
  });
});
