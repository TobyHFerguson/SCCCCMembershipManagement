// @ts-check
/**
 * @fileoverview Tests for GroupSync.Manager
 *
 * Tests the pure business logic for group membership sync resolution.
 *
 * TABLE OF CONTENTS:
 * 1. normalizeEmail       - Email normalization
 * 2. isGroupReference     - Group reference detection
 * 3. isSpecialKeyword     - Special keyword detection
 * 4. parseEntryList       - Comma-separated string parsing
 * 5. resolveToEmails      - Core resolution (recursion, cycles, diamond deps)
 * 6. computeDesiredState  - Sync scope rules per Subscription/Type
 * 7. Edge cases           - Empty/whitespace fields, unknown group references
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
