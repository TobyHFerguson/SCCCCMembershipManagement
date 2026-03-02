// @ts-check
/**
 * @fileoverview Tests for GroupSync.Manager
 *
 * Tests the pure business logic for group membership sync resolution.
 *
 * TABLE OF CONTENTS:
 * 1. normalizeEmail          - Email normalization
 * 2. isGroupReference        - Group reference detection
 * 3. isSpecialKeyword        - Special keyword detection
 * 4. parseEntryList          - Comma-separated string parsing
 * 5. resolveToEmails         - Core resolution (recursion, cycles, diamond deps)
 * 6. computeDesiredState     - Sync scope rules per Subscription/Type
 * 7. Edge cases              - Empty/whitespace fields, unknown group references
 * 8. computeActions members  - Member reconciliation (ADD/REMOVE, OWNERs, null)
 * 9. computeActions managers - Manager reconciliation (ADD/PROMOTE/DEMOTE/REMOVE)
 * 10. computeActions combined - Combined scenarios and multi-group
 * 11. computeActions summary  - Summary counts
 * 12. formatActionsSummary    - Human-readable output
 */

jest.mock('../src/common/config/Properties.js', () => ({}));
jest.mock('../src/common/utils/Logger.js', () => ({}));

// GroupSync namespace must exist before requiring Manager
global.GroupSync = {};
const { Manager } = require('../src/services/GroupSync/Manager.js');
global.GroupSync.Manager = Manager;

// ---------------------------------------------------------------------------
// Test-data helpers
// ---------------------------------------------------------------------------

/**
 * @param {Partial<{Name: string, Email: string, Aliases: string, Subscription: string, Type: string, Members: string, Managers: string, Note: string}>} overrides
 * @returns {{Name: string, Email: string, Aliases: string, Subscription: string, Type: string, Members: string, Managers: string, Note: string}}
 */
function makeGroup(overrides = {}) {
  return {
    Name: 'Test Group',
    Email: 'test@sc3.club',
    Aliases: '',
    Subscription: 'auto',
    Type: 'Discussion',
    Members: '',
    Managers: '',
    Note: '',
    ...overrides,
  };
}

// ============================================================================
// 1. normalizeEmail
// ============================================================================

describe('normalizeEmail', () => {
  test('email with @ is returned lowercased and trimmed', () => {
    expect(Manager.normalizeEmail('toby@gmail.com')).toBe('toby@gmail.com');
  });

  test('email with @ in mixed case is lowercased', () => {
    expect(Manager.normalizeEmail('TOBY@Gmail.Com')).toBe('toby@gmail.com');
  });

  test('bare name without @ gets @sc3.club appended', () => {
    expect(Manager.normalizeEmail('board_announcements')).toBe('board_announcements@sc3.club');
  });

  test('bare name with surrounding whitespace is trimmed before appending domain', () => {
    expect(Manager.normalizeEmail('  rides  ')).toBe('rides@sc3.club');
  });

  test('email with whitespace is trimmed', () => {
    expect(Manager.normalizeEmail('  user@example.com  ')).toBe('user@example.com');
  });
});

// ============================================================================
// 2. isGroupReference
// ============================================================================

describe('isGroupReference', () => {
  /** @type {Set<string>} */
  const nameSet = new Set(['officers', 'board discussions', 'directors']);

  test('exact match returns true', () => {
    expect(Manager.isGroupReference('officers', nameSet)).toBe(true);
  });

  test('case-insensitive match returns true', () => {
    expect(Manager.isGroupReference('Officers', nameSet)).toBe(true);
    expect(Manager.isGroupReference('OFFICERS', nameSet)).toBe(true);
    expect(Manager.isGroupReference('Board Discussions', nameSet)).toBe(true);
  });

  test('non-matching entry returns false', () => {
    expect(Manager.isGroupReference('ride leaders', nameSet)).toBe(false);
  });

  test('email-like string that is not a group name returns false', () => {
    expect(Manager.isGroupReference('someone@sc3.club', nameSet)).toBe(false);
  });

  test('entry with surrounding whitespace is trimmed before comparison', () => {
    expect(Manager.isGroupReference('  officers  ', nameSet)).toBe(true);
  });
});

// ============================================================================
// 3. isSpecialKeyword
// ============================================================================

describe('isSpecialKeyword', () => {
  test('"Everyone" is a special keyword', () => {
    expect(Manager.isSpecialKeyword('Everyone')).toBe(true);
  });

  test('"everyone" (lowercase) is a special keyword', () => {
    expect(Manager.isSpecialKeyword('everyone')).toBe(true);
  });

  test('"EVERYONE" (uppercase) is a special keyword', () => {
    expect(Manager.isSpecialKeyword('EVERYONE')).toBe(true);
  });

  test('"Anyone" is a special keyword', () => {
    expect(Manager.isSpecialKeyword('Anyone')).toBe(true);
  });

  
  test('"ANYONE" (uppercase) is a special keyword', () => {
    expect(Manager.isSpecialKeyword('ANYONE')).toBe(true);
  });

  test('arbitrary group name is not a special keyword', () => {
    expect(Manager.isSpecialKeyword('SomeGroup')).toBe(false);
  });

  test('email address is not a special keyword', () => {
    expect(Manager.isSpecialKeyword('user@sc3.club')).toBe(false);
  });
});

// ============================================================================
// 4. parseEntryList
// ============================================================================

describe('parseEntryList', () => {
  test('comma-separated string is split into trimmed array', () => {
    expect(Manager.parseEntryList('alice@test.com, bob@test.com, carol@test.com')).toEqual([
      'alice@test.com',
      'bob@test.com',
      'carol@test.com',
    ]);
  });

  test('empty string returns []', () => {
    expect(Manager.parseEntryList('')).toEqual([]);
  });

  test('null returns []', () => {
    expect(Manager.parseEntryList(null)).toEqual([]);
  });

  test('undefined returns []', () => {
    expect(Manager.parseEntryList(undefined)).toEqual([]);
  });

  test('single entry returns array with one element', () => {
    expect(Manager.parseEntryList('alice@test.com')).toEqual(['alice@test.com']);
  });

  test('entries with extra whitespace are trimmed', () => {
    expect(Manager.parseEntryList('  alice@test.com  ,  bob@test.com  ')).toEqual([
      'alice@test.com',
      'bob@test.com',
    ]);
  });

  test('trailing comma is ignored (empty entries filtered)', () => {
    expect(Manager.parseEntryList('alice@test.com,')).toEqual(['alice@test.com']);
  });
});

// ============================================================================
// 5. resolveToEmails
// ============================================================================

describe('resolveToEmails', () => {
  test('empty entry list returns empty result', () => {
    const result = Manager.resolveToEmails([], [], new Set());
    expect(result.emails).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  test('direct email entries are returned normalised and sorted', () => {
    const result = Manager.resolveToEmails(
      ['toby@gmail.com', 'zara@test.com', 'alice@sc3.club'],
      [],
      new Set()
    );
    expect(result.emails).toEqual(['alice@sc3.club', 'toby@gmail.com', 'zara@test.com']);
  });

  test('bare email name (no @) gets @sc3.club appended', () => {
    const result = Manager.resolveToEmails(['board_announcements'], [], new Set());
    expect(result.emails).toEqual(['board_announcements@sc3.club']);
  });

  test('Everyone keyword is documentary only — resolves to no emails', () => {
    const result = Manager.resolveToEmails(['Everyone'], [], new Set());
    expect(result.emails).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  test('Anyone keyword is documentary only — resolves to no emails', () => {
    const result = Manager.resolveToEmails(['Anyone'], [], new Set());
    expect(result.emails).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  test('single group reference resolves that group\'s members', () => {
    const groups = [
      makeGroup({ Name: 'Officers', Email: 'officers@sc3.club', Subscription: 'invitation', Type: 'Role', Members: 'alice@sc3.club, bob@sc3.club' }),
    ];
    const result = Manager.resolveToEmails(['Officers'], groups, new Set());
    expect(result.emails).toEqual(['alice@sc3.club', 'bob@sc3.club']);
  });

  test('nested group reference is recursively resolved', () => {
    // A → B → carol@sc3.club
    const groups = [
      makeGroup({ Name: 'A', Email: 'a@sc3.club', Subscription: 'invitation', Type: 'Role', Members: 'B' }),
      makeGroup({ Name: 'B', Email: 'b@sc3.club', Subscription: 'invitation', Type: 'Role', Members: 'carol@sc3.club' }),
    ];
    const result = Manager.resolveToEmails(['A'], groups, new Set());
    expect(result.emails).toEqual(['carol@sc3.club']);
  });

  test('diamond dependency: D is included only once', () => {
    // A → B and C; B → D; C → D → dave@sc3.club
    const groups = [
      makeGroup({ Name: 'A', Email: 'a@sc3.club', Subscription: 'invitation', Type: 'Role', Members: 'B, C' }),
      makeGroup({ Name: 'B', Email: 'b@sc3.club', Subscription: 'invitation', Type: 'Role', Members: 'D' }),
      makeGroup({ Name: 'C', Email: 'c@sc3.club', Subscription: 'invitation', Type: 'Role', Members: 'D' }),
      makeGroup({ Name: 'D', Email: 'd@sc3.club', Subscription: 'invitation', Type: 'Role', Members: 'dave@sc3.club' }),
    ];
    const result = Manager.resolveToEmails(['A'], groups, new Set());
    expect(result.emails).toEqual(['dave@sc3.club']);
    expect(result.warnings).toEqual([]);
  });

  test('cycle detection: A → B → A does not infinite-loop and produces a warning', () => {
    const groups = [
      makeGroup({ Name: 'A', Email: 'a@sc3.club', Subscription: 'invitation', Type: 'Role', Members: 'B, alice@sc3.club' }),
      makeGroup({ Name: 'B', Email: 'b@sc3.club', Subscription: 'invitation', Type: 'Role', Members: 'A, bob@sc3.club' }),
    ];
    // Resolve starting with 'A'
    const result = Manager.resolveToEmails(['A'], groups, new Set());
    // Should contain alice and bob (non-cyclic members)
    expect(result.emails).toContain('alice@sc3.club');
    expect(result.emails).toContain('bob@sc3.club');
    // Should warn about the cycle
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toMatch(/cycle/i);
  });

  test('Everyone in a referenced group is skipped during resolution', () => {
    // An invitation group references an auto group whose Members = 'Everyone'
    const groups = [
      makeGroup({ Name: 'Announce', Email: 'announce@sc3.club', Subscription: 'auto', Type: 'Announcement', Members: 'Everyone' }),
      makeGroup({ Name: 'Combo', Email: 'combo@sc3.club', Subscription: 'invitation', Type: 'Discussion', Members: 'Announce, alice@sc3.club' }),
    ];
    const result = Manager.resolveToEmails(['Combo'], groups, new Set());
    // Everyone resolved to nothing; only alice from the direct entry
    expect(result.emails).toEqual(['alice@sc3.club']);
  });

  test('mixed entries: group reference + direct email (Everyone skipped)', () => {
    const groups = [
      makeGroup({ Name: 'Officers', Email: 'officers@sc3.club', Subscription: 'invitation', Type: 'Role', Members: 'alice@sc3.club' }),
    ];
    const result = Manager.resolveToEmails(
      ['Officers', 'external@gmail.com', 'Everyone'],
      groups,
      new Set()
    );
    // Should include alice (from Officers) and external@gmail.com; Everyone is skipped
    expect(result.emails).toEqual(['alice@sc3.club', 'external@gmail.com']);
  });

  test('result is sorted and deduplicated', () => {
    // alice appears twice: once directly and once via group
    const groups = [
      makeGroup({ Name: 'G', Email: 'g@sc3.club', Subscription: 'invitation', Type: 'Role', Members: 'alice@sc3.club' }),
    ];
    const result = Manager.resolveToEmails(
      ['alice@sc3.club', 'G', 'bob@sc3.club'],
      groups,
      new Set()
    );
    expect(result.emails).toEqual(['alice@sc3.club', 'bob@sc3.club']);
    // No duplicates
    expect(new Set(result.emails).size).toBe(result.emails.length);
  });

  test('case-insensitive group lookup', () => {
    const groups = [
      makeGroup({ Name: 'Officers', Email: 'officers@sc3.club', Subscription: 'invitation', Type: 'Role', Members: 'alice@sc3.club' }),
    ];
    const result = Manager.resolveToEmails(['OFFICERS'], groups, new Set());
    expect(result.emails).toEqual(['alice@sc3.club']);
  });
});

// ============================================================================
// 6. computeDesiredState
// ============================================================================

describe('computeDesiredState', () => {
  test('Security groups are excluded from the result', () => {
    const groups = [
      makeGroup({ Name: 'Secret', Email: 'secret@sc3.club', Subscription: 'manual', Type: 'Security', Members: 'Everyone' }),
    ];
    const result = Manager.computeDesiredState(groups);
    expect(result.size).toBe(0);
  });

  test('manual groups are skipped (neither members nor managers synced)', () => {
    const groups = [
      makeGroup({ Name: 'Discussion', Email: 'disc@sc3.club', Subscription: 'manual', Type: 'Discussion', Members: 'Everyone' }),
    ];
    const result = Manager.computeDesiredState(groups);
    expect(result.size).toBe(0);
  });

  test('auto group: desiredMembers=null, desiredManagers resolved', () => {
    const groups = [
      makeGroup({
        Name: 'Announcements',
        Email: 'announce@sc3.club',
        Subscription: 'auto',
        Type: 'Announcement',
        Members: 'Everyone',
        Managers: 'alice@sc3.club',
      }),
    ];
    const result = Manager.computeDesiredState(groups);
    expect(result.has('announce@sc3.club')).toBe(true);
    const state = result.get('announce@sc3.club');
    expect(state.desiredMembers).toBeNull();
    expect(state.desiredManagers).toEqual(['alice@sc3.club']);
  });

  test('invitation + Discussion: desiredMembers resolved, desiredManagers=null when Managers empty', () => {
    const groups = [
      makeGroup({
        Name: 'Rides',
        Email: 'rides@sc3.club',
        Subscription: 'invitation',
        Type: 'Discussion',
        Members: 'alice@sc3.club, bob@sc3.club',
        Managers: '',
      }),
    ];
    const result = Manager.computeDesiredState(groups);
    const state = result.get('rides@sc3.club');
    expect(state.desiredMembers).toEqual(['alice@sc3.club', 'bob@sc3.club']);
    expect(state.desiredManagers).toBeNull();
  });

  test('invitation + Role: desiredMembers resolved, desiredManagers resolved when Managers non-empty', () => {
    const groups = [
      makeGroup({
        Name: 'Officers',
        Email: 'officers@sc3.club',
        Subscription: 'invitation',
        Type: 'Role',
        Members: 'alice@sc3.club',
        Managers: 'bob@sc3.club',
      }),
    ];
    const result = Manager.computeDesiredState(groups);
    const state = result.get('officers@sc3.club');
    expect(state.desiredMembers).toEqual(['alice@sc3.club']);
    expect(state.desiredManagers).toEqual(['bob@sc3.club']);
  });

  test('full scenario: multiple groups of different types produce correct map', () => {
    const groups = [
      makeGroup({ Name: 'Announce', Email: 'announce@sc3.club', Subscription: 'auto', Type: 'Announcement', Members: 'Everyone', Managers: 'alice@sc3.club' }),
      makeGroup({ Name: 'Chat', Email: 'chat@sc3.club', Subscription: 'manual', Type: 'Discussion', Members: 'Everyone' }),
      makeGroup({ Name: 'Rides', Email: 'rides@sc3.club', Subscription: 'invitation', Type: 'Discussion', Members: 'bob@sc3.club', Managers: '' }),
      makeGroup({ Name: 'SecureGroup', Email: 'secure@sc3.club', Subscription: 'manual', Type: 'Security', Members: 'Everyone' }),
    ];
    const result = Manager.computeDesiredState(groups);
    // manual + Security excluded; manual Discussion excluded
    expect(result.has('announce@sc3.club')).toBe(true);
    expect(result.has('chat@sc3.club')).toBe(false);
    expect(result.has('rides@sc3.club')).toBe(true);
    expect(result.has('secure@sc3.club')).toBe(false);

    // Auto group checks
    const announce = result.get('announce@sc3.club');
    expect(announce.desiredMembers).toBeNull();
    expect(announce.desiredManagers).toEqual(['alice@sc3.club']);

    // Invitation group checks
    const rides = result.get('rides@sc3.club');
    expect(rides.desiredMembers).toEqual(['bob@sc3.club']);
    expect(rides.desiredManagers).toBeNull();
  });

  test('nested resolution in computeDesiredState', () => {
    // Officers has Members='alice@sc3.club'; Directors has Members='Officers'
    const groups = [
      makeGroup({ Name: 'Officers', Email: 'officers@sc3.club', Subscription: 'invitation', Type: 'Role', Members: 'alice@sc3.club' }),
      makeGroup({ Name: 'Directors', Email: 'directors@sc3.club', Subscription: 'invitation', Type: 'Role', Members: 'Officers, bob@sc3.club' }),
    ];
    const result = Manager.computeDesiredState(groups);
    const directors = result.get('directors@sc3.club');
    expect(directors.desiredMembers).toEqual(['alice@sc3.club', 'bob@sc3.club']);
  });

  test('DesiredGroupState has correct shape', () => {
    const groups = [
      makeGroup({ Name: 'Announce', Email: 'announce@sc3.club', Subscription: 'auto', Type: 'Announcement', Managers: 'alice@sc3.club' }),
    ];
    const result = Manager.computeDesiredState(groups);
    const state = result.get('announce@sc3.club');
    expect(state).toHaveProperty('groupEmail');
    expect(state).toHaveProperty('groupName');
    expect(state).toHaveProperty('desiredMembers');
    expect(state).toHaveProperty('desiredManagers');
    expect(state).toHaveProperty('warnings');
    expect(state.groupEmail).toBe('announce@sc3.club');
    expect(state.groupName).toBe('Announce');
    expect(Array.isArray(state.warnings)).toBe(true);
  });
});

// ============================================================================
// 7. Edge cases
// ============================================================================

describe('Edge cases', () => {
  test('group definition with empty Members string produces no emails', () => {
    const groups = [
      makeGroup({ Name: 'Empty', Email: 'empty@sc3.club', Subscription: 'invitation', Type: 'Role', Members: '' }),
    ];
    const result = Manager.resolveToEmails(['Empty'], groups, new Set());
    expect(result.emails).toEqual([]);
  });

  test('group definition with only whitespace in Members produces no emails', () => {
    const groups = [
      makeGroup({ Name: 'Whitespace', Email: 'ws@sc3.club', Subscription: 'invitation', Type: 'Role', Members: '   ' }),
    ];
    const result = Manager.resolveToEmails(['Whitespace'], groups, new Set());
    expect(result.emails).toEqual([]);
  });

  test('reference to a group Name that does not exist is treated as bare email', () => {
    // 'UnknownGroup' not in groupDefinitions → normalizeEmail → 'unknowngroup@sc3.club'
    const result = Manager.resolveToEmails(['UnknownGroup'], [], new Set());
    expect(result.emails).toEqual(['unknowngroup@sc3.club']);
  });

  test('computeDesiredState result keyed by lowercase group email', () => {
    const groups = [
      makeGroup({ Name: 'Test', Email: 'Test@SC3.CLUB', Subscription: 'auto', Type: 'Announcement', Managers: 'alice@sc3.club' }),
    ];
    const result = Manager.computeDesiredState(groups);
    expect(result.has('test@sc3.club')).toBe(true);
  });
});

// ============================================================================
// 8. computeActions — Member reconciliation
// ============================================================================

describe('computeActions — Member reconciliation', () => {
  /** @type {Map<string, import('../src/services/GroupSync/Manager.js').DesiredGroupState>} */
  const desiredState = new Map([
    [
      'rides@sc3.club',
      {
        groupEmail: 'rides@sc3.club',
        groupName: 'Rides',
        desiredMembers: ['alice@sc3.club', 'bob@sc3.club'],
        desiredManagers: null,
        warnings: [],
      },
    ],
  ]);

  test('Add missing members: desired has emails not in actual → ADD actions', () => {
    const actualState = new Map([['rides@sc3.club', []]]);
    const result = Manager.computeActions(desiredState, actualState);
    expect(result.actions).toHaveLength(2);
    expect(result.actions.every(a => a.action === 'ADD')).toBe(true);
    expect(result.actions.every(a => a.targetRole === 'MEMBER')).toBe(true);
    const emails = result.actions.map(a => a.userEmail);
    expect(emails).toContain('alice@sc3.club');
    expect(emails).toContain('bob@sc3.club');
  });

  test('Remove extra members: actual has MEMBER emails not in desired → REMOVE actions', () => {
    const actualState = new Map([
      [
        'rides@sc3.club',
        [
          { email: 'alice@sc3.club', role: 'MEMBER' },
          { email: 'bob@sc3.club', role: 'MEMBER' },
          { email: 'extra@sc3.club', role: 'MEMBER' },
        ],
      ],
    ]);
    const result = Manager.computeActions(desiredState, actualState);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].action).toBe('REMOVE');
    expect(result.actions[0].userEmail).toBe('extra@sc3.club');
  });

  test('No changes needed: desired matches actual → empty actions', () => {
    const actualState = new Map([
      [
        'rides@sc3.club',
        [
          { email: 'alice@sc3.club', role: 'MEMBER' },
          { email: 'bob@sc3.club', role: 'MEMBER' },
        ],
      ],
    ]);
    const result = Manager.computeActions(desiredState, actualState);
    expect(result.actions).toHaveLength(0);
  });

  test('OWNERs are sacred: actual OWNER not in desired → NOT removed', () => {
    const actualState = new Map([
      [
        'rides@sc3.club',
        [
          { email: 'alice@sc3.club', role: 'MEMBER' },
          { email: 'bob@sc3.club', role: 'MEMBER' },
          { email: 'owner@sc3.club', role: 'OWNER' },
        ],
      ],
    ]);
    const result = Manager.computeActions(desiredState, actualState);
    expect(result.actions).toHaveLength(0);
    expect(result.actions.some(a => a.userEmail === 'owner@sc3.club')).toBe(false);
  });

  test('OWNERs are sacred: desired email matching OWNER → NOT added again', () => {
    const stateWithOwnerInDesired = new Map([
      [
        'rides@sc3.club',
        {
          groupEmail: 'rides@sc3.club',
          groupName: 'Rides',
          desiredMembers: ['alice@sc3.club', 'owner@sc3.club'],
          desiredManagers: null,
          warnings: [],
        },
      ],
    ]);
    const actualState = new Map([
      [
        'rides@sc3.club',
        [
          { email: 'alice@sc3.club', role: 'MEMBER' },
          { email: 'owner@sc3.club', role: 'OWNER' },
        ],
      ],
    ]);
    const result = Manager.computeActions(stateWithOwnerInDesired, actualState);
    // owner@sc3.club is already OWNER — no ADD action should be generated
    expect(result.actions).toHaveLength(0);
    expect(result.actions.some(a => a.userEmail === 'owner@sc3.club')).toBe(false);
  });

  test('desiredMembers is null: no member reconciliation happens', () => {
    const stateNoMembers = new Map([
      [
        'rides@sc3.club',
        {
          groupEmail: 'rides@sc3.club',
          groupName: 'Rides',
          desiredMembers: null,
          desiredManagers: null,
          warnings: [],
        },
      ],
    ]);
    const actualState = new Map([
      ['rides@sc3.club', [{ email: 'extra@sc3.club', role: 'MEMBER' }]],
    ]);
    const result = Manager.computeActions(stateNoMembers, actualState);
    expect(result.actions).toHaveLength(0);
  });

  test('Empty actual state: all desired members become ADD actions', () => {
    const actualState = new Map(); // group not present at all
    const result = Manager.computeActions(desiredState, actualState);
    expect(result.actions).toHaveLength(2);
    expect(result.actions.every(a => a.action === 'ADD')).toBe(true);
  });

  test('Case-insensitive email comparison: mixed-case actual matches desired', () => {
    const actualState = new Map([
      [
        'rides@sc3.club',
        [
          { email: 'Alice@SC3.Club', role: 'MEMBER' },
          { email: 'BOB@sc3.club', role: 'MEMBER' },
        ],
      ],
    ]);
    const result = Manager.computeActions(desiredState, actualState);
    // Both match after lowercasing — no actions needed
    expect(result.actions).toHaveLength(0);
  });
});

// ============================================================================
// 9. computeActions — Manager reconciliation
// ============================================================================

describe('computeActions — Manager reconciliation', () => {
  /** @type {Map<string, import('../src/services/GroupSync/Manager.js').DesiredGroupState>} */
  const desiredManagersOnly = new Map([
    [
      'announce@sc3.club',
      {
        groupEmail: 'announce@sc3.club',
        groupName: 'Announcements',
        desiredMembers: null,
        desiredManagers: ['alice@sc3.club'],
        warnings: [],
      },
    ],
  ]);

  test('Add new manager: desired manager not in actual at all → ADD as MANAGER', () => {
    const actualState = new Map([['announce@sc3.club', []]]);
    const result = Manager.computeActions(desiredManagersOnly, actualState);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].action).toBe('ADD');
    expect(result.actions[0].targetRole).toBe('MANAGER');
    expect(result.actions[0].userEmail).toBe('alice@sc3.club');
  });

  test('Promote existing member: desired manager is actual MEMBER → PROMOTE', () => {
    const actualState = new Map([
      ['announce@sc3.club', [{ email: 'alice@sc3.club', role: 'MEMBER' }]],
    ]);
    const result = Manager.computeActions(desiredManagersOnly, actualState);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].action).toBe('PROMOTE');
    expect(result.actions[0].targetRole).toBe('MANAGER');
  });

  test('Already a manager: desired manager is actual MANAGER → no action', () => {
    const actualState = new Map([
      ['announce@sc3.club', [{ email: 'alice@sc3.club', role: 'MANAGER' }]],
    ]);
    const result = Manager.computeActions(desiredManagersOnly, actualState);
    expect(result.actions).toHaveLength(0);
  });

  test('OWNER is sacred: desired manager is actual OWNER → no action', () => {
    const stateOwnerAsDesiredManager = new Map([
      [
        'announce@sc3.club',
        {
          groupEmail: 'announce@sc3.club',
          groupName: 'Announcements',
          desiredMembers: null,
          desiredManagers: ['owner@sc3.club'],
          warnings: [],
        },
      ],
    ]);
    const actualState = new Map([
      ['announce@sc3.club', [{ email: 'owner@sc3.club', role: 'OWNER' }]],
    ]);
    const result = Manager.computeActions(stateOwnerAsDesiredManager, actualState);
    expect(result.actions).toHaveLength(0);
  });

  test('Demote extra manager (members managed): actual MANAGER in desired members → DEMOTE', () => {
    const state = new Map([
      [
        'officers@sc3.club',
        {
          groupEmail: 'officers@sc3.club',
          groupName: 'Officers',
          desiredMembers: ['alice@sc3.club', 'bob@sc3.club'],
          desiredManagers: ['alice@sc3.club'],
          warnings: [],
        },
      ],
    ]);
    const actualState = new Map([
      [
        'officers@sc3.club',
        [
          { email: 'alice@sc3.club', role: 'MANAGER' },
          { email: 'bob@sc3.club', role: 'MANAGER' }, // extra manager, but in desiredMembers
        ],
      ],
    ]);
    const result = Manager.computeActions(state, actualState);
    const demotes = result.actions.filter(a => a.action === 'DEMOTE');
    expect(demotes).toHaveLength(1);
    expect(demotes[0].userEmail).toBe('bob@sc3.club');
    expect(demotes[0].targetRole).toBe('MEMBER');
  });

  test('Remove extra manager (members managed): actual MANAGER not in desired members → REMOVE', () => {
    const state = new Map([
      [
        'officers@sc3.club',
        {
          groupEmail: 'officers@sc3.club',
          groupName: 'Officers',
          desiredMembers: ['alice@sc3.club'],
          desiredManagers: ['alice@sc3.club'],
          warnings: [],
        },
      ],
    ]);
    const actualState = new Map([
      [
        'officers@sc3.club',
        [
          { email: 'alice@sc3.club', role: 'MANAGER' },
          { email: 'extra@sc3.club', role: 'MANAGER' }, // not in desiredMembers → REMOVE
        ],
      ],
    ]);
    const result = Manager.computeActions(state, actualState);
    const removes = result.actions.filter(a => a.action === 'REMOVE');
    expect(removes).toHaveLength(1);
    expect(removes[0].userEmail).toBe('extra@sc3.club');
  });

  test('Demote extra manager (members not managed): desiredMembers null → DEMOTE', () => {
    const state = new Map([
      [
        'announce@sc3.club',
        {
          groupEmail: 'announce@sc3.club',
          groupName: 'Announcements',
          desiredMembers: null,
          desiredManagers: ['alice@sc3.club'],
          warnings: [],
        },
      ],
    ]);
    const actualState = new Map([
      [
        'announce@sc3.club',
        [
          { email: 'alice@sc3.club', role: 'MANAGER' },
          { email: 'extra@sc3.club', role: 'MANAGER' }, // desiredMembers=null → DEMOTE
        ],
      ],
    ]);
    const result = Manager.computeActions(state, actualState);
    const demotes = result.actions.filter(a => a.action === 'DEMOTE');
    expect(demotes).toHaveLength(1);
    expect(demotes[0].userEmail).toBe('extra@sc3.club');
    expect(demotes[0].targetRole).toBe('MEMBER');
    // Should NOT be a REMOVE
    expect(result.actions.filter(a => a.action === 'REMOVE')).toHaveLength(0);
  });

  test('desiredManagers is null: no manager reconciliation happens', () => {
    const state = new Map([
      [
        'rides@sc3.club',
        {
          groupEmail: 'rides@sc3.club',
          groupName: 'Rides',
          desiredMembers: null,
          desiredManagers: null,
          warnings: [],
        },
      ],
    ]);
    const actualState = new Map([
      ['rides@sc3.club', [{ email: 'extra@sc3.club', role: 'MANAGER' }]],
    ]);
    const result = Manager.computeActions(state, actualState);
    expect(result.actions).toHaveLength(0);
  });
});

// ============================================================================
// 10. computeActions — Combined scenarios
// ============================================================================

describe('computeActions — Combined scenarios', () => {
  test('Both members and managers synced: invitation+Discussion group', () => {
    const state = new Map([
      [
        'officers@sc3.club',
        {
          groupEmail: 'officers@sc3.club',
          groupName: 'Officers',
          desiredMembers: ['alice@sc3.club', 'bob@sc3.club'],
          desiredManagers: ['alice@sc3.club'],
          warnings: [],
        },
      ],
    ]);
    // Actual: carol is a stale MEMBER; alice is a MANAGER already; bob is missing
    const actualState = new Map([
      [
        'officers@sc3.club',
        [
          { email: 'alice@sc3.club', role: 'MANAGER' },
          { email: 'carol@sc3.club', role: 'MEMBER' },
        ],
      ],
    ]);
    const result = Manager.computeActions(state, actualState);
    const adds = result.actions.filter(a => a.action === 'ADD');
    const removes = result.actions.filter(a => a.action === 'REMOVE');
    // bob should be added as MEMBER
    expect(adds).toHaveLength(1);
    expect(adds[0].userEmail).toBe('bob@sc3.club');
    expect(adds[0].targetRole).toBe('MEMBER');
    // carol should be removed
    expect(removes).toHaveLength(1);
    expect(removes[0].userEmail).toBe('carol@sc3.club');
    // alice is already MANAGER → no promote/demote
    expect(result.actions.filter(a => a.action === 'PROMOTE')).toHaveLength(0);
    expect(result.actions.filter(a => a.action === 'DEMOTE')).toHaveLength(0);
  });

  test('Multiple groups: desiredState with 3 groups → all actions correct', () => {
    const state = new Map([
      [
        'group1@sc3.club',
        {
          groupEmail: 'group1@sc3.club',
          groupName: 'Group1',
          desiredMembers: ['a@sc3.club'],
          desiredManagers: null,
          warnings: [],
        },
      ],
      [
        'group2@sc3.club',
        {
          groupEmail: 'group2@sc3.club',
          groupName: 'Group2',
          desiredMembers: null,
          desiredManagers: ['b@sc3.club'],
          warnings: [],
        },
      ],
      [
        'group3@sc3.club',
        {
          groupEmail: 'group3@sc3.club',
          groupName: 'Group3',
          desiredMembers: ['c@sc3.club'],
          desiredManagers: ['d@sc3.club'],
          warnings: [],
        },
      ],
    ]);
    const actualState = new Map([
      ['group1@sc3.club', []],
      ['group2@sc3.club', [{ email: 'b@sc3.club', role: 'MEMBER' }]],
      ['group3@sc3.club', []],
    ]);
    const result = Manager.computeActions(state, actualState);
    // group1: ADD a as MEMBER
    expect(result.actions.some(a => a.groupEmail === 'group1@sc3.club' && a.userEmail === 'a@sc3.club' && a.action === 'ADD')).toBe(true);
    // group2: PROMOTE b to MANAGER
    expect(result.actions.some(a => a.groupEmail === 'group2@sc3.club' && a.userEmail === 'b@sc3.club' && a.action === 'PROMOTE')).toBe(true);
    // group3: ADD c as MEMBER, ADD d as MANAGER
    expect(result.actions.some(a => a.groupEmail === 'group3@sc3.club' && a.userEmail === 'c@sc3.club' && a.action === 'ADD' && a.targetRole === 'MEMBER')).toBe(true);
    expect(result.actions.some(a => a.groupEmail === 'group3@sc3.club' && a.userEmail === 'd@sc3.club' && a.action === 'ADD' && a.targetRole === 'MANAGER')).toBe(true);
  });

  test('Auto group (managers only): desiredMembers=null, only manager actions produced', () => {
    const state = new Map([
      [
        'announce@sc3.club',
        {
          groupEmail: 'announce@sc3.club',
          groupName: 'Announcements',
          desiredMembers: null,
          desiredManagers: ['alice@sc3.club'],
          warnings: [],
        },
      ],
    ]);
    const actualState = new Map([
      [
        'announce@sc3.club',
        [
          { email: 'stalemanager@sc3.club', role: 'MANAGER' },
          { email: 'randommember@sc3.club', role: 'MEMBER' },
        ],
      ],
    ]);
    const result = Manager.computeActions(state, actualState);
    // alice should be added as MANAGER
    expect(result.actions.some(a => a.userEmail === 'alice@sc3.club' && a.action === 'ADD' && a.targetRole === 'MANAGER')).toBe(true);
    // stalemanager should be demoted (desiredMembers=null → demote not remove)
    expect(result.actions.some(a => a.userEmail === 'stalemanager@sc3.club' && a.action === 'DEMOTE')).toBe(true);
    // randommember should NOT be touched (desiredMembers=null)
    expect(result.actions.some(a => a.userEmail === 'randommember@sc3.club')).toBe(false);
  });
});

// ============================================================================
// 11. computeActions — Summary
// ============================================================================

describe('computeActions — Summary', () => {
  test('Correct counts of adds, removes, promotes, demotes', () => {
    const state = new Map([
      [
        'group@sc3.club',
        {
          groupEmail: 'group@sc3.club',
          groupName: 'Group',
          desiredMembers: ['a@sc3.club', 'b@sc3.club'],
          desiredManagers: ['c@sc3.club'],
          warnings: [],
        },
      ],
    ]);
    // a: missing → ADD MEMBER
    // extra@sc3.club: stale MEMBER → REMOVE
    // b: already MEMBER → no action
    // c: MEMBER → PROMOTE to MANAGER
    // mgr@sc3.club: extra MANAGER, not in desiredMembers → REMOVE
    const actualState = new Map([
      [
        'group@sc3.club',
        [
          { email: 'b@sc3.club', role: 'MEMBER' },
          { email: 'extra@sc3.club', role: 'MEMBER' },
          { email: 'c@sc3.club', role: 'MEMBER' },
          { email: 'mgr@sc3.club', role: 'MANAGER' },
        ],
      ],
    ]);
    const result = Manager.computeActions(state, actualState);
    expect(result.summary.adds).toBe(1);    // a
    expect(result.summary.removes).toBe(2); // extra (member) + mgr (manager not in desired members)
    expect(result.summary.promotes).toBe(1); // c
    expect(result.summary.demotes).toBe(0);
    expect(result.summary.totalActions).toBe(4);
  });

  test('groupsProcessed matches number of entries in desiredState', () => {
    const state = new Map([
      ['g1@sc3.club', { groupEmail: 'g1@sc3.club', groupName: 'G1', desiredMembers: [], desiredManagers: null, warnings: [] }],
      ['g2@sc3.club', { groupEmail: 'g2@sc3.club', groupName: 'G2', desiredMembers: [], desiredManagers: null, warnings: [] }],
      ['g3@sc3.club', { groupEmail: 'g3@sc3.club', groupName: 'G3', desiredMembers: [], desiredManagers: null, warnings: [] }],
    ]);
    const result = Manager.computeActions(state, new Map());
    expect(result.summary.groupsProcessed).toBe(3);
  });
});

// ============================================================================
// 12. formatActionsSummary
// ============================================================================

describe('formatActionsSummary', () => {
  test('Produces readable strings for each action type', () => {
    /** @type {import('../src/services/GroupSync/Manager.js').ComputeActionsResult} */
    const result = {
      actions: [
        { groupEmail: 'g@sc3.club', groupName: 'MyGroup', userEmail: 'a@sc3.club', action: 'ADD', targetRole: 'MANAGER' },
        { groupEmail: 'g@sc3.club', groupName: 'MyGroup', userEmail: 'b@sc3.club', action: 'REMOVE', targetRole: 'MEMBER' },
        { groupEmail: 'g@sc3.club', groupName: 'MyGroup', userEmail: 'c@sc3.club', action: 'PROMOTE', targetRole: 'MANAGER' },
        { groupEmail: 'g@sc3.club', groupName: 'MyGroup', userEmail: 'd@sc3.club', action: 'DEMOTE', targetRole: 'MEMBER' },
      ],
      warnings: [],
      summary: { groupsProcessed: 1, totalActions: 4, adds: 1, removes: 1, promotes: 1, demotes: 1 },
    };
    const lines = Manager.formatActionsSummary(result);
    expect(lines.some(l => l.includes('ADD') && l.includes('a@sc3.club'))).toBe(true);
    expect(lines.some(l => l.includes('REMOVE') && l.includes('b@sc3.club'))).toBe(true);
    expect(lines.some(l => l.includes('PROMOTE') && l.includes('c@sc3.club'))).toBe(true);
    expect(lines.some(l => l.includes('DEMOTE') && l.includes('d@sc3.club'))).toBe(true);
  });

  test('Includes warnings at top', () => {
    /** @type {import('../src/services/GroupSync/Manager.js').ComputeActionsResult} */
    const result = {
      actions: [],
      warnings: ['Cycle detected: skipping group X'],
      summary: { groupsProcessed: 1, totalActions: 0, adds: 0, removes: 0, promotes: 0, demotes: 0 },
    };
    const lines = Manager.formatActionsSummary(result);
    expect(lines[0]).toMatch(/warning/i);
    expect(lines[0]).toContain('Cycle detected');
  });

  test('Includes summary counts at bottom', () => {
    /** @type {import('../src/services/GroupSync/Manager.js').ComputeActionsResult} */
    const result = {
      actions: [
        { groupEmail: 'g@sc3.club', groupName: 'G', userEmail: 'a@sc3.club', action: 'ADD', targetRole: 'MEMBER' },
      ],
      warnings: [],
      summary: { groupsProcessed: 1, totalActions: 1, adds: 1, removes: 0, promotes: 0, demotes: 0 },
    };
    const lines = Manager.formatActionsSummary(result);
    const summaryLine = lines[lines.length - 1];
    expect(summaryLine).toMatch(/summary/i);
    expect(summaryLine).toContain('1');
  });

  test('Empty actions produces "No changes needed" line', () => {
    /** @type {import('../src/services/GroupSync/Manager.js').ComputeActionsResult} */
    const result = {
      actions: [],
      warnings: [],
      summary: { groupsProcessed: 2, totalActions: 0, adds: 0, removes: 0, promotes: 0, demotes: 0 },
    };
    const lines = Manager.formatActionsSummary(result);
    expect(lines.some(l => /no changes/i.test(l))).toBe(true);
  });
});
