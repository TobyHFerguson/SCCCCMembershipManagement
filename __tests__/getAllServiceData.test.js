// @ts-check
/**
 * Test suite for getAllServiceData() bulk endpoint
 * Tests the combined data fetch for all 5 services in a single call
 *
 * Table of Contents:
 * 1. Invalid token - returns error object when token is invalid/expired
 * 2. All services succeed - returns combined data from all 5 services
 * 3. Partial failure (one service) - failed service gets error object, others succeed
 * 4. Partial failure (multiple services) - multiple failed services get error objects
 * 5. homePageServices - result includes homePageServices array
 * 6. Service data shapes - each service slot matches getData() return shape
 * 7. AppLogger.configure() - called on entry
 * 8. Audit persistence - _persistAuditEntries is called
 */

/** @type {jest.Mock} */
var mockGetEmailFromMUT;
/** @type {jest.Mock} */
var mockGetAvailableServices;
/** @type {jest.Mock} */
var mockPersistAuditEntries;
/** @type {jest.Mock} */
var mockLogServiceAccess;

// Default mock data for each service
var mockDirectoryData = { serviceName: 'Directory', directoryEntries: [], email: 'user@example.com' };
var mockGroupData = { serviceName: 'Group Management', subscriptions: [], deliveryOptions: {} };
var mockProfileData = { serviceName: 'Profile', profile: null, email: 'user@example.com' };
var mockEmailChangeData = { serviceName: 'Email Change', currentEmail: 'user@example.com' };
var mockVotingData = { serviceName: 'Voting', elections: [] };
var mockHomePageServices = [
  { id: 'DirectoryService', name: 'Directory', description: 'Club directory', icon: '📋' }
];

beforeEach(() => {
  jest.resetModules();

  mockGetEmailFromMUT = jest.fn().mockReturnValue('user@example.com');
  mockGetAvailableServices = jest.fn().mockReturnValue(mockHomePageServices);
  mockPersistAuditEntries = jest.fn();
  mockLogServiceAccess = jest.fn().mockReturnValue({ Type: 'ServiceAccess', Outcome: 'success' });

  // Mock TokenManager
  global.TokenManager = /** @type {any} */ ({
    getEmailFromMUT: mockGetEmailFromMUT
  });

  // Mock AppLogger
  global.AppLogger = /** @type {any} */ ({
    configure: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  });

  // Mock Logger (GAS built-in)
  global.Logger = /** @type {any} */ ({
    log: jest.fn()
  });

  // Mock ServiceLogger
  global.ServiceLogger = jest.fn().mockImplementation(() => ({
    logServiceAccess: mockLogServiceAccess,
    logError: jest.fn().mockReturnValue({ Type: 'Error', Outcome: 'fail' })
  }));

  // Mock AuditPersistence
  global.AuditPersistence = /** @type {any} */ ({
    persistAuditEntries: mockPersistAuditEntries
  });

  // Mock Common namespace with HomePage.Manager
  global.Common = /** @type {any} */ ({
    HomePage: {
      Manager: {
        getAvailableServices: mockGetAvailableServices
      }
    }
  });

  // Mock all 5 service Api.getData functions via WebServices registry
  global.DirectoryService = /** @type {any} */ ({
    Api: { getData: jest.fn().mockReturnValue(mockDirectoryData) }
  });
  global.GroupManagementService = /** @type {any} */ ({
    Api: { getData: jest.fn().mockReturnValue(mockGroupData) }
  });
  global.ProfileManagementService = /** @type {any} */ ({
    Api: { getData: jest.fn().mockReturnValue(mockProfileData) }
  });
  global.EmailChangeService = /** @type {any} */ ({
    Api: { getData: jest.fn().mockReturnValue(mockEmailChangeData) }
  });
  global.VotingService = /** @type {any} */ ({
    Api: { getData: jest.fn().mockReturnValue(mockVotingData) }
  });

  global.WebServices = /** @type {any} */ ({
    HomePageService: {},
    DirectoryService: global.DirectoryService,
    GroupManagementService: global.GroupManagementService,
    ProfileManagementService: global.ProfileManagementService,
    EmailChangeService: global.EmailChangeService,
    VotingService: global.VotingService
  });

  // Mock ApiClient (required by module load side-effects guard)
  global.ApiClient = /** @type {any} */ ({
    registerHandler: jest.fn(),
    handleRequest: jest.fn()
  });

  // Mock other globals that webapp_endpoints.js references at load time
  global.DataAccess = /** @type {any} */ ({
    getEmailAddresses: jest.fn().mockReturnValue([])
  });
  global.VerificationCode = /** @type {any} */ ({
    requestCode: jest.fn(),
    verify: jest.fn()
  });
  global.EmailService = /** @type {any} */ ({
    sendTestEmail: jest.fn()
  });
  global.HtmlService = /** @type {any} */ ({
    createTemplateFromFile: jest.fn().mockReturnValue({
      evaluate: jest.fn().mockReturnValue({ getContent: jest.fn().mockReturnValue('') })
    })
  });
});

function loadEndpoints() {
  return require('../src/webapp_endpoints');
}

// ==================== 1. Invalid token ====================

describe('getAllServiceData - invalid token', () => {
  test('returns error object when token is invalid', () => {
    mockGetEmailFromMUT.mockReturnValue(null);
    const { getAllServiceData } = loadEndpoints();

    const result = getAllServiceData('bad-token');

    expect(result).toEqual({ error: 'Invalid or expired session', errorCode: 'INVALID_TOKEN' });
  });

  test('returns error object when token is expired (null)', () => {
    mockGetEmailFromMUT.mockReturnValue(undefined);
    const { getAllServiceData } = loadEndpoints();

    const result = getAllServiceData('expired-token');

    expect(result).toEqual({ error: 'Invalid or expired session', errorCode: 'INVALID_TOKEN' });
  });
});

// ==================== 2. All services succeed ====================

describe('getAllServiceData - all services succeed', () => {
  test('returns combined data from all 5 services', () => {
    const { getAllServiceData } = loadEndpoints();

    const result = getAllServiceData('valid-token');

    expect(result).toMatchObject({
      email: 'user@example.com',
      services: {
        DirectoryService: mockDirectoryData,
        GroupManagementService: mockGroupData,
        ProfileManagementService: mockProfileData,
        EmailChangeService: mockEmailChangeData,
        VotingService: mockVotingData
      }
    });
  });

  test('result has exactly the 5 expected service keys', () => {
    const { getAllServiceData } = loadEndpoints();

    const result = getAllServiceData('valid-token');

    expect(Object.keys(result.services)).toEqual(
      expect.arrayContaining([
        'DirectoryService',
        'GroupManagementService',
        'ProfileManagementService',
        'EmailChangeService',
        'VotingService'
      ])
    );
    expect(Object.keys(result.services)).toHaveLength(5);
  });
});

// ==================== 3. Partial failure - one service ====================

describe('getAllServiceData - partial failure (one service)', () => {
  test('failed service gets error object, others succeed', () => {
    global.DirectoryService.Api.getData.mockImplementation(() => {
      throw new Error('Sheets quota exceeded');
    });
    const { getAllServiceData } = loadEndpoints();

    const result = getAllServiceData('valid-token');

    expect(result.services.DirectoryService).toMatchObject({
      error: 'Failed to load DirectoryService: Sheets quota exceeded',
      serviceName: 'DirectoryService'
    });
    expect(result.services.GroupManagementService).toEqual(mockGroupData);
    expect(result.services.ProfileManagementService).toEqual(mockProfileData);
    expect(result.services.EmailChangeService).toEqual(mockEmailChangeData);
    expect(result.services.VotingService).toEqual(mockVotingData);
  });
});

// ==================== 4. Partial failure - multiple services ====================

describe('getAllServiceData - partial failure (multiple services)', () => {
  test('3 failed services get error objects, 2 succeed', () => {
    global.GroupManagementService.Api.getData.mockImplementation(() => {
      throw new Error('Group API error');
    });
    global.ProfileManagementService.Api.getData.mockImplementation(() => {
      throw new Error('Profile API error');
    });
    global.VotingService.Api.getData.mockImplementation(() => {
      throw new Error('Voting API error');
    });
    const { getAllServiceData } = loadEndpoints();

    const result = getAllServiceData('valid-token');

    expect(result.services.DirectoryService).toEqual(mockDirectoryData);
    expect(result.services.EmailChangeService).toEqual(mockEmailChangeData);

    expect(result.services.GroupManagementService).toMatchObject({
      error: 'Failed to load GroupManagementService: Group API error',
      serviceName: 'GroupManagementService'
    });
    expect(result.services.ProfileManagementService).toMatchObject({
      error: 'Failed to load ProfileManagementService: Profile API error',
      serviceName: 'ProfileManagementService'
    });
    expect(result.services.VotingService).toMatchObject({
      error: 'Failed to load VotingService: Voting API error',
      serviceName: 'VotingService'
    });
  });
});

// ==================== 5. homePageServices ====================

describe('getAllServiceData - homePageServices', () => {
  test('result includes homePageServices array from Common.HomePage.Manager.getAvailableServices()', () => {
    const { getAllServiceData } = loadEndpoints();

    const result = getAllServiceData('valid-token');

    expect(result.homePageServices).toEqual(mockHomePageServices);
    expect(mockGetAvailableServices).toHaveBeenCalled();
  });
});

// ==================== 6. Service data shapes ====================

describe('getAllServiceData - service data shapes', () => {
  test('DirectoryService result matches getData() shape', () => {
    const { getAllServiceData } = loadEndpoints();
    const result = getAllServiceData('valid-token');
    expect(result.services.DirectoryService).toHaveProperty('serviceName');
    expect(result.services.DirectoryService).toHaveProperty('directoryEntries');
  });

  test('GroupManagementService result matches getData() shape', () => {
    const { getAllServiceData } = loadEndpoints();
    const result = getAllServiceData('valid-token');
    expect(result.services.GroupManagementService).toHaveProperty('serviceName');
    expect(result.services.GroupManagementService).toHaveProperty('subscriptions');
  });

  test('ProfileManagementService result matches getData() shape', () => {
    const { getAllServiceData } = loadEndpoints();
    const result = getAllServiceData('valid-token');
    expect(result.services.ProfileManagementService).toHaveProperty('serviceName');
  });

  test('EmailChangeService result matches getData() shape', () => {
    const { getAllServiceData } = loadEndpoints();
    const result = getAllServiceData('valid-token');
    expect(result.services.EmailChangeService).toHaveProperty('serviceName');
    expect(result.services.EmailChangeService).toHaveProperty('currentEmail');
  });

  test('VotingService result matches getData() shape', () => {
    const { getAllServiceData } = loadEndpoints();
    const result = getAllServiceData('valid-token');
    expect(result.services.VotingService).toHaveProperty('serviceName');
    expect(result.services.VotingService).toHaveProperty('elections');
  });
});

// ==================== 7. AppLogger.configure() ====================

describe('getAllServiceData - AppLogger.configure()', () => {
  test('calls AppLogger.configure() at entry', () => {
    const { getAllServiceData } = loadEndpoints();
    getAllServiceData('valid-token');
    expect(global.AppLogger.configure).toHaveBeenCalled();
  });

  test('calls AppLogger.configure() even for invalid token', () => {
    mockGetEmailFromMUT.mockReturnValue(null);
    const { getAllServiceData } = loadEndpoints();
    getAllServiceData('bad-token');
    expect(global.AppLogger.configure).toHaveBeenCalled();
  });
});

// ==================== 8. Audit persistence ====================

describe('getAllServiceData - audit persistence', () => {
  test('calls _persistAuditEntries after fetching all service data', () => {
    const { getAllServiceData } = loadEndpoints();
    getAllServiceData('valid-token');
    expect(mockPersistAuditEntries).toHaveBeenCalled();
  });

  test('creates ServiceLogger for AllServices', () => {
    const { getAllServiceData } = loadEndpoints();
    getAllServiceData('valid-token');
    expect(global.ServiceLogger).toHaveBeenCalledWith('AllServices', 'user@example.com');
  });
});
