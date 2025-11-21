const { MembershipManagement } = require('../src/services/MembershipManagement/Manager');

describe('retry/backoff helper', () => {
  const utils = MembershipManagement.Utils;
  test('computeNextRetryAt exists and returns ISO string', () => {
    expect(typeof utils.computeNextRetryAt).toBe('function');
    const iso = utils.computeNextRetryAt(1, 1);
    expect(typeof iso).toBe('string');
    expect(new Date(iso).toString()).not.toBe('Invalid Date');
  });

  test('computeNextAttemptAt increases exponentially', () => {
    const base = 60;
    const now = Date.now();
    const n1 = new Date(utils.computeNextRetryAt(1, base)).getTime() - now;
    const n2 = new Date(utils.computeNextRetryAt(2, base)).getTime() - now;
    const n3 = new Date(utils.computeNextRetryAt(3, base)).getTime() - now;
    // ordering
    expect(n2).toBeGreaterThan(n1);
    expect(n3).toBeGreaterThan(n2);
    // ratios roughly doubling (allowing some tolerance)
    const r1 = n2 / n1;
    const r2 = n3 / n2;
    expect(r1).toBeGreaterThan(1.5);
    expect(r1).toBeLessThan(2.5);
    expect(r2).toBeGreaterThan(1.5);
    expect(r2).toBeLessThan(2.5);
  });
});
