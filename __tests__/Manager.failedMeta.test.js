const { MembershipManagement } = require('../src/services/MembershipManagement/Manager');

describe('Manager failedMeta shape', () => {
  const utils = MembershipManagement.Utils;
  const actionSpecs = { Renew: { Subject: 's', Body: 'b' } };
  const today = utils.dateOnly('2025-01-01');
  const groups = [{ Email: 'g@x.com' }];
  const groupManager = { groupAddFun: () => {}, groupRemoveFun: () => {} };

  test('transient failure includes attempts, lastAttemptAt, lastError, nextRetryAt, dead=false', () => {
    const sendEmail = jest.fn(() => { throw new Error('transient') });
    const manager = new MembershipManagement.Manager(actionSpecs, groups, groupManager, sendEmail, today);
    const expired = [{ email: 'a@x.com', subject: 'sub', htmlBody: '<p>hi</p>', attempts: 0 }];

    const res = manager.processExpiredMembers(expired, sendEmail, groupManager.groupRemoveFun, { maxRetries: 5, computeNextRetryAt: utils.computeNextRetryAt });

    expect(Array.isArray(res.failedMeta)).toBe(true);
    expect(res.failedMeta.length).toBe(1);
    const meta = res.failedMeta[0];
    expect(typeof meta.attempts).toBe('number');
    expect(meta.attempts).toBeGreaterThanOrEqual(1);
    expect(typeof meta.lastAttemptAt).toBe('string');
    expect(new Date(meta.lastAttemptAt).getTime()).toBeGreaterThan(0);
    expect(typeof meta.lastError).toBe('string');
    expect(typeof meta.nextRetryAt).toBe('string');
    expect(new Date(meta.nextRetryAt).getTime()).toBeGreaterThan(Date.now());
    expect(meta.dead).toBeFalsy();
  });

  test('permanent failure (exceeded retries) has dead=true and no nextRetryAt', () => {
    const sendEmail = jest.fn(() => { throw new Error('perm') });
    const manager = new MembershipManagement.Manager(actionSpecs, groups, groupManager, sendEmail, today);
    const expired = [{ email: 'b@x.com', subject: 'sub', htmlBody: '<p>hi</p>', attempts: 2 }];

    const res = manager.processExpiredMembers(expired, sendEmail, groupManager.groupRemoveFun, { maxRetries: 2, computeNextRetryAt: utils.computeNextRetryAt });

    expect(Array.isArray(res.failedMeta)).toBe(true);
    expect(res.failedMeta.length).toBe(1);
    const meta = res.failedMeta[0];
    expect(meta.attempts).toBeGreaterThanOrEqual(2);
    expect(meta.dead).toBeTruthy();
    expect(meta.nextRetryAt === '' || meta.nextRetryAt === undefined).toBeTruthy();
  });
});
