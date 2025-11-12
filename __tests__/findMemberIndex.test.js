const { MembershipManagement } = require('../src/services/MembershipManagement/Manager');

describe('findMemberIndex (identity-first resolution)', () => {
  const Manager = MembershipManagement.Manager;

  const makeMember = (email, phone, first, last, status = 'Active') => ({ Email: email, Phone: phone, First: first, Last: last, Status: status });

  test('returns null when no email or phone matches', () => {
    const members = [makeMember('a@example.com','111','Alice','A')];
    const { emailMap, phoneMap } = Manager.buildMultiMaps(members);
    const q = { Email: 'nomatch@example.com', Phone: '999', First: 'No', Last: 'Match' };
    const res = Manager.findMemberIndex(q, members, emailMap, phoneMap);
    expect(res).toBeNull();
  });

  test('returns unique index when single email match', () => {
    const members = [makeMember('a@example.com','111','Alice','A'), makeMember('b@example.com','222','Bob','B')];
    const { emailMap, phoneMap } = Manager.buildMultiMaps(members);
    const q = { Email: 'b@example.com', Phone: '', First: 'Bob', Last: 'B' };
    const res = Manager.findMemberIndex(q, members, emailMap, phoneMap);
    expect(typeof res).toBe('number');
    expect(res).toBe(1);
  });

  test('returns unique index when single phone match', () => {
    const members = [makeMember('a@example.com','111','Alice','A'), makeMember('b@example.com','222','Bob','B')];
    const { emailMap, phoneMap } = Manager.buildMultiMaps(members);
    const q = { Email: '', Phone: '111', First: 'Alice', Last: 'A' };
    const res = Manager.findMemberIndex(q, members, emailMap, phoneMap);
    expect(res).toBe(0);
  });

  test('intersection of email and phone picks single index', () => {
    const members = [makeMember('a@example.com','111','Alice','A'), makeMember('a2@example.com','222','Bob','B'), makeMember('b@example.com','111','Carol','C')];
    // member 0 has email a@example.com, phone 111
    // member 2 shares phone 111, so emailSet={0}, phoneSet={0,2} -> intersection {0}
    const { emailMap, phoneMap } = Manager.buildMultiMaps(members);
    const q = { Email: 'a@example.com', Phone: '111', First: 'Alice', Last: 'A' };
    const res = Manager.findMemberIndex(q, members, emailMap, phoneMap);
    expect(res).toBe(0);
  });

  test('multiple email candidates returns a Set of indices', () => {
    // both candidates share the same normalized name so name disambiguation cannot pick one
    const members = [makeMember('same@example.com','111','Alice','A'), makeMember('same@example.com','222','Alice','A')];
    const { emailMap, phoneMap } = Manager.buildMultiMaps(members);
    const q = { Email: 'same@example.com', Phone: '', First: 'Alice', Last: 'A' };
    const res = Manager.findMemberIndex(q, members, emailMap, phoneMap);
    expect(res instanceof Set).toBe(true);
    expect(Array.from(res).sort()).toEqual([0,1]);
  });

  test('name disambiguation chooses unique match when names differ', () => {
    const members = [makeMember('same@example.com','111','Alice','A'), makeMember('same@example.com','222','Bob','B')];
    const { emailMap, phoneMap } = Manager.buildMultiMaps(members);
    const q = { Email: 'same@example.com', Phone: '', First: 'Bob', Last: 'B' };
    const res = Manager.findMemberIndex(q, members, emailMap, phoneMap);
    expect(res).toBe(1);
  });

  test('cross-channel ambiguous union returns Set when name does not disambiguate', () => {
    const members = [makeMember('a@example.com','111','Alice','A'), makeMember('b@example.com','222','Bob','B')];
    const { emailMap, phoneMap } = Manager.buildMultiMaps(members);
    // Query has email matching member0 and phone matching member1 -> union {0,1}
    const q = { Email: 'a@example.com', Phone: '222', First: 'Someone', Last: 'Else' };
    const res = Manager.findMemberIndex(q, members, emailMap, phoneMap);
    expect(res instanceof Set).toBe(true);
    expect(Array.from(res).sort()).toEqual([0,1]);
  });

  test('intersection with multiple entries (invariant violation) returns the intersection Set', () => {
    // Two rows share both email and phone -> intersection size > 1
    const members = [makeMember('dup@example.com','555','Alice','A'), makeMember('dup@example.com','555','Alicia','A')];
    const { emailMap, phoneMap } = Manager.buildMultiMaps(members);
    const q = { Email: 'dup@example.com', Phone: '555', First: 'Alice', Last: 'A' };
    const res = Manager.findMemberIndex(q, members, emailMap, phoneMap);
    expect(res instanceof Set).toBe(true);
    expect(Array.from(res).sort()).toEqual([0,1]);
  });
});


